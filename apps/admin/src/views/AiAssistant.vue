<script setup lang="ts">
/**
 * AI 经营助手（plan.md 阶段 8.4，核心）
 * 三个工具：AI 点评生成器 / 招生文案 / AI 对话，均走 SSE 流式打字机。
 * 幂等计费：每次发起由前端生成 bizId（crypto.randomUUID），生成失败后重试复用同一 bizId，
 * 服务端按 bizId 幂等只扣一次费；生成失败时后端已自动回滚积分。
 */
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { get, post } from '@/api/http';
import { streamPost } from '@/api/sse';
import type { PageResult, StudentRow } from '@/api/types';

// ---------- 学员选项（点评生成器用） ----------
const studentsLoading = ref(false);
const students = ref<StudentRow[]>([]);

async function loadStudents(): Promise<void> {
  studentsLoading.value = true;
  try {
    const data = await get<PageResult<StudentRow>>('/student/list', { page: 1, pageSize: 100 });
    students.value = data.rows.filter((s) => s.status === 1);
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    studentsLoading.value = false;
  }
}

onMounted(loadStudents);

// ---------- 工具一：AI 点评生成器 ----------
const reportTypeOptions = [
  { label: '课后点评', value: 'daily' },
  { label: '周报', value: 'weekly' },
  { label: '月报', value: 'monthly' },
];

const reportForm = reactive({
  studentId: undefined as number | undefined,
  performance: '',
  reportType: 'daily',
});

const reportGenerating = ref(false);
const reportSaving = ref(false);
/** 流式结果（可人工编辑） */
const reportContent = ref('');
/** done 事件返回的报告 ID 与消耗积分 */
const reportId = ref<number | null>(null);
const reportCost = ref<number | null>(null);
const reportFailed = ref(false);
/** 进行中/待重试的 bizId：成功后置空，失败保留用于重试，保证不重复扣费 */
const reportBizId = ref<string | null>(null);

async function generateReport(): Promise<void> {
  if (reportGenerating.value) return;
  if (!reportForm.studentId) {
    ElMessage.warning('请选择学员');
    return;
  }
  if (!reportForm.performance.trim()) {
    ElMessage.warning('请输入课堂表现');
    return;
  }

  reportGenerating.value = true;
  reportFailed.value = false;
  reportContent.value = '';
  reportId.value = null;
  reportCost.value = null;
  const bizId = reportBizId.value ?? crypto.randomUUID();
  reportBizId.value = bizId;

  try {
    await streamPost(
      '/ai/report/generate',
      {
        studentId: reportForm.studentId,
        performance: reportForm.performance,
        reportType: reportForm.reportType,
        bizId,
      },
      {
        onChunk: (delta) => {
          reportContent.value += delta;
        },
        onDone: (meta) => {
          reportContent.value = meta.content;
          reportId.value = meta.reportId ?? null;
          reportCost.value = meta.costPoints;
          reportBizId.value = null;
          ElMessage.success(`点评生成完成，本次消耗 ${meta.costPoints} 积分`);
        },
        onError: (_code, message, rolledBack) => {
          reportFailed.value = true;
          // 服务端已回滚说明该单已了结，重试需换新单；网络未知则保留原单号防重复扣费
          if (rolledBack) reportBizId.value = null;
          ElMessage.error(message);
        },
      },
    );
  } finally {
    reportGenerating.value = false;
  }
}

async function saveReport(): Promise<void> {
  if (reportId.value === null || !reportContent.value.trim()) return;
  reportSaving.value = true;
  try {
    await post('/report/save', { id: reportId.value, content: reportContent.value });
    ElMessage.success('点评已保存');
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    reportSaving.value = false;
  }
}

// ---------- 工具二：AI 招生文案 ----------
const copyForm = reactive({
  features: '',
  topic: '',
});

const copyGenerating = ref(false);
const copyContent = ref('');
const copyCost = ref<number | null>(null);
const copyFailed = ref(false);
const copyBizId = ref<string | null>(null);
const copyCopied = ref(false);

async function generateCopy(): Promise<void> {
  if (copyGenerating.value) return;
  if (!copyForm.features.trim()) {
    ElMessage.warning('请输入机构特色');
    return;
  }

  copyGenerating.value = true;
  copyFailed.value = false;
  copyContent.value = '';
  copyCost.value = null;
  copyCopied.value = false;
  const bizId = copyBizId.value ?? crypto.randomUUID();
  copyBizId.value = bizId;

  try {
    await streamPost(
      '/ai/copywriting/generate',
      { features: copyForm.features, topic: copyForm.topic || undefined, bizId },
      {
        onChunk: (delta) => {
          copyContent.value += delta;
        },
        onDone: (meta) => {
          copyContent.value = meta.content;
          copyCost.value = meta.costPoints;
          copyBizId.value = null;
          ElMessage.success(`招生文案生成完成，本次消耗 ${meta.costPoints} 积分`);
        },
        onError: (_code, message, rolledBack) => {
          copyFailed.value = true;
          if (rolledBack) copyBizId.value = null;
          ElMessage.error(message);
        },
      },
    );
  } finally {
    copyGenerating.value = false;
  }
}

async function copyText(): Promise<void> {
  if (!copyContent.value) return;
  try {
    await navigator.clipboard.writeText(copyContent.value);
    copyCopied.value = true;
    ElMessage.success('已复制到剪贴板');
  } catch {
    ElMessage.error('复制失败，请手动选择文本复制');
  }
}

// ---------- 工具三：AI 对话 ----------
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  error?: boolean;
}

const chatMessages = ref<ChatMessage[]>([]);
const chatInput = ref('');
const chatSending = ref(false);
/** 待重试 bizId（失败保留，成功置空） */
const chatBizId = ref<string | null>(null);
/** 最近一次提问，失败重试时复用 */
const lastQuestion = ref('');
const chatListRef = ref<HTMLDivElement>();

/** 最后一条是否为失败的 AI 回复（用于展示"重试上一条"） */
const lastMessageError = computed(() => {
  const last = chatMessages.value[chatMessages.value.length - 1];
  return !!last && last.role === 'assistant' && !!last.error;
});

function scrollToBottom(): void {
  const el = chatListRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function submitChat(): Promise<void> {
  const text = chatInput.value.trim();
  if (!text || chatSending.value) return;
  chatInput.value = '';
  await runChat(text, false);
}

async function retryChat(): Promise<void> {
  if (chatSending.value || !lastQuestion.value) return;
  // 移除上一条失败的 AI 气泡后重发同一问题（复用 chatBizId，不重复扣费）
  const last = chatMessages.value[chatMessages.value.length - 1];
  if (last && last.role === 'assistant' && last.error) chatMessages.value.pop();
  await runChat(lastQuestion.value, true);
}

async function runChat(question: string, isRetry: boolean): Promise<void> {
  chatSending.value = true;

  // 历史多轮：只取已成功完成的消息，不含本轮提问与失败气泡
  const history = chatMessages.value
    .filter((m) => !m.streaming && !m.error)
    .map((m) => ({ role: m.role, content: m.content }));

  if (!isRetry) {
    chatMessages.value.push({ role: 'user', content: question });
    lastQuestion.value = question;
  }

  const assistant = reactive<ChatMessage>({ role: 'assistant', content: '', streaming: true });
  chatMessages.value.push(assistant);
  await nextTick();
  scrollToBottom();

  const bizId = chatBizId.value ?? crypto.randomUUID();
  chatBizId.value = bizId;

  try {
    await streamPost(
      '/ai/chat',
      { message: question, history, bizId },
      {
        onChunk: (delta) => {
          assistant.content += delta;
          scrollToBottom();
        },
        onDone: (meta) => {
          assistant.content = meta.content || assistant.content;
          assistant.streaming = false;
          chatBizId.value = null;
          scrollToBottom();
        },
        onError: (_code, message, rolledBack) => {
          assistant.content = `生成失败：${message}${
            rolledBack ? '（积分已自动回滚）' : '（结果未知，重试不会重复扣费）'
          }`;
          assistant.streaming = false;
          assistant.error = true;
          // 已回滚的单子已了结，重试换新单；网络未知则保留原单号
          if (rolledBack) chatBizId.value = null;
        },
      },
    );
  } finally {
    chatSending.value = false;
    await nextTick();
    scrollToBottom();
  }
}
</script>

<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>AI 经营助手</span>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="header-tip"
          title="AI 生成按次扣减积分；生成失败自动回滚。网络异常后点击重试会复用同一单号，不会重复扣费。"
        />
      </div>
    </template>

    <el-tabs>
      <!-- AI 点评生成器 -->
      <el-tab-pane label="AI 点评" name="report">
        <el-form label-width="90px" class="pane-form">
          <el-form-item label="选择学员">
            <el-select
              v-model="reportForm.studentId"
              filterable
              placeholder="选择学员"
              :loading="studentsLoading"
              style="width: 320px"
            >
              <el-option
                v-for="s in students"
                :key="s.id"
                :label="`${s.name}${s.className ? '（' + s.className + '）' : ''}`"
                :value="s.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="报告类型">
            <el-select v-model="reportForm.reportType" style="width: 200px">
              <el-option
                v-for="opt in reportTypeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="课堂表现">
            <el-input
              v-model="reportForm.performance"
              type="textarea"
              :rows="4"
              placeholder="例如：本节课练习了基本功与旋转动作，节奏感有进步，但下腰稳定性仍需加强……"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="reportGenerating"
              @click="generateReport"
            >
              {{ reportGenerating ? '生成中...' : reportFailed ? '重新生成（不重复扣费）' : '生成点评' }}
            </el-button>
            <el-button
              v-if="reportId !== null"
              type="success"
              :loading="reportSaving"
              @click="saveReport"
            >
              保存点评
            </el-button>
            <span v-if="reportCost !== null" class="cost-hint">本次消耗 {{ reportCost }} 积分</span>
          </el-form-item>
        </el-form>

        <el-divider v-if="reportContent || reportGenerating" />
        <el-input
          v-if="reportContent || reportGenerating"
          v-model="reportContent"
          type="textarea"
          :rows="14"
          placeholder="AI 生成的点评将在此流式展示，可直接人工编辑后保存"
        />
      </el-tab-pane>

      <!-- AI 招生文案 -->
      <el-tab-pane label="招生文案" name="copy">
        <el-form label-width="90px" class="pane-form">
          <el-form-item label="机构特色">
            <el-input
              v-model="copyForm.features"
              type="textarea"
              :rows="4"
              placeholder="例如：十年舞蹈教学经验、名师带队、小班授课、定期舞台展演、升学率高……"
            />
          </el-form-item>
          <el-form-item label="活动主题">
            <el-input v-model="copyForm.topic" placeholder="如：春季班招生 / 暑期特训营（可留空）" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="copyGenerating" @click="generateCopy">
              {{ copyGenerating ? '生成中...' : copyFailed ? '重新生成（不重复扣费）' : '生成文案' }}
            </el-button>
            <el-button v-if="copyContent" @click="copyText">
              {{ copyCopied ? '已复制' : '一键复制' }}
            </el-button>
            <span v-if="copyCost !== null" class="cost-hint">本次消耗 {{ copyCost }} 积分</span>
          </el-form-item>
        </el-form>

        <el-divider v-if="copyContent || copyGenerating" />
        <el-input
          v-if="copyContent || copyGenerating"
          v-model="copyContent"
          type="textarea"
          :rows="14"
          placeholder="AI 生成的招生文案将在此流式展示"
        />
      </el-tab-pane>

      <!-- AI 对话 -->
      <el-tab-pane label="AI 对话" name="chat">
        <div ref="chatListRef" class="chat-list">
          <div v-if="chatMessages.length === 0" class="chat-empty">
            可向 AI 助手提问课程安排、学员进展、艺术教育等问题
          </div>
          <div
            v-for="(msg, index) in chatMessages"
            :key="index"
            class="chat-row"
            :class="msg.role === 'user' ? 'is-user' : 'is-assistant'"
          >
            <div class="chat-bubble" :class="{ 'is-error': msg.error }">
              <span v-if="msg.streaming && !msg.content" class="chat-thinking">正在思考...</span>
              <template v-else>{{ msg.content }}</template>
            </div>
          </div>
        </div>
        <div class="chat-toolbar">
          <el-button
            v-if="lastMessageError"
            link
            type="warning"
            :disabled="chatSending"
            @click="retryChat"
          >
            重试上一条（不重复扣费）
          </el-button>
        </div>
        <div class="chat-input">
          <el-input
            v-model="chatInput"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            @keydown.enter.exact.prevent="submitChat"
          />
          <el-button
            type="primary"
            :loading="chatSending"
            style="margin-left: 12px"
            @click="submitChat"
          >
            发送
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-tip {
  flex: 1;
}

.pane-form {
  max-width: 760px;
}

.cost-hint {
  margin-left: 12px;
  font-size: 13px;
  color: #e6a23c;
}

.chat-list {
  height: 420px;
  overflow-y: auto;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.chat-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}

.chat-row {
  display: flex;
  margin-bottom: 12px;
}

.chat-row.is-user {
  justify-content: flex-end;
}

.chat-bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  background: #fff;
  border: 1px solid #e4e7ed;
}

.chat-row.is-user .chat-bubble {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

.chat-bubble.is-error {
  background: #fef0f0;
  color: #f56c6c;
  border-color: #fbc4c4;
}

.chat-thinking {
  color: #909399;
}

.chat-toolbar {
  margin: 8px 0;
  min-height: 20px;
}

.chat-input {
  display: flex;
  align-items: flex-end;
}
</style>
