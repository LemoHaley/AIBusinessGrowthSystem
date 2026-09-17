<script setup lang="ts">
/**
 * Agent 配置管理：三类 Agent（点评/文案/对话）的 provider、bot、模型与 Prompt 在线编辑
 * 全局默认 + 租户自定义合并展示（isCustom 标记），编辑即 upsert 租户自定义行
 */
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { get, post } from '@/api/http';
import type { AgentRow } from '@/api/types';
import { formatTime } from '@/utils/format';

const loading = ref(false);
const rows = ref<AgentRow[]>([]);

const agentTypeLabel: Record<string, string> = {
  report: 'AI 点评',
  copywriting: '招生文案',
  chat: 'AI 对话',
};

const providerLabel: Record<AgentRow['provider'], string> = {
  coze: 'Coze',
  dify: 'Dify',
  openai: 'OpenAI 兼容',
};

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await get<AgentRow[]>('/ai/agents');
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
}

onMounted(loadList);

// ---------- 编辑对话框 ----------
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
/** 正在编辑的 Agent 类型 */
const editingType = ref('');

const form = reactive({
  provider: 'coze' as AgentRow['provider'],
  botId: '',
  model: '',
  promptTemplate: '',
});

const rules: FormRules = {
  provider: [{ required: true, message: '请选择服务商', trigger: 'change' }],
};

function openEdit(row: AgentRow): void {
  editingType.value = row.agentType;
  form.provider = row.provider;
  form.botId = row.botId ?? '';
  form.model = row.model ?? '';
  form.promptTemplate = row.promptTemplate ?? '';
  dialogVisible.value = true;
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().then(
    () => true,
    () => false,
  );
  if (!valid) return;
  saving.value = true;
  try {
    await post('/ai/agents/update', {
      agentType: editingType.value,
      provider: form.provider,
      botId: form.botId,
      model: form.model,
      promptTemplate: form.promptTemplate,
    });
    ElMessage.success('Agent 配置已更新');
    dialogVisible.value = false;
    await loadList();
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-card>
    <template #header>Agent 配置（在线切换服务商与 Prompt，无需重新部署）</template>
    <el-table v-loading="loading" :data="rows">
      <el-table-column prop="agentType" label="功能" width="120">
        <template #default="{ row }">{{ agentTypeLabel[(row as AgentRow).agentType] ?? (row as AgentRow).agentType }}</template>
      </el-table-column>
      <el-table-column label="服务商" width="120">
        <template #default="{ row }">
          <el-tag>{{ providerLabel[(row as AgentRow).provider] ?? (row as AgentRow).provider }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="botId" label="Bot ID" min-width="160">
        <template #default="{ row }">{{ (row as AgentRow).botId ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="model" label="模型" width="140">
        <template #default="{ row }">{{ (row as AgentRow).model ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="Prompt 模板" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ (row as AgentRow).promptTemplate ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="配置来源" width="120">
        <template #default="{ row }">
          <el-tag :type="(row as AgentRow).isCustom ? 'success' : 'info'">
            {{ (row as AgentRow).isCustom ? '自定义' : '全局默认' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatTime((row as AgentRow).updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as AgentRow)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="`编辑 Agent 配置（${agentTypeLabel[editingType] ?? editingType}）`"
      width="640px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="服务商" prop="provider">
          <el-select v-model="form.provider" style="width: 100%">
            <el-option label="Coze" value="coze" />
            <el-option label="Dify" value="dify" />
            <el-option label="OpenAI 兼容" value="openai" />
          </el-select>
        </el-form-item>
        <el-form-item label="Bot ID">
          <el-input v-model="form.botId" placeholder="Coze bot id / Dify app id" />
        </el-form-item>
        <el-form-item label="模型名">
          <el-input v-model="form.model" placeholder="OpenAI/DeepSeek 模型名" />
        </el-form-item>
        <el-form-item label="Prompt 模板">
          <el-input
            v-model="form.promptTemplate"
            type="textarea"
            :rows="8"
            placeholder="系统 Prompt 模板，支持变量插值"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
