<script setup lang="ts">
/**
 * AI 调用日志：按 agentType / status 筛选 + 分页列表（admin）
 */
import { onMounted, reactive, ref } from 'vue';
import { get } from '@/api/http';
import type { AiLogRow, PageResult } from '@/api/types';
import { formatTime } from '@/utils/format';

const loading = ref(false);
const rows = ref<AiLogRow[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 20,
  agentType: '',
  status: undefined as number | undefined,
});

const agentTypeOptions = [
  { label: 'AI 点评', value: 'report' },
  { label: '招生文案', value: 'copywriting' },
  { label: 'AI 对话', value: 'chat' },
];

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<PageResult<AiLogRow>>('/ai/logs', {
      page: query.page,
      pageSize: query.pageSize,
      agentType: query.agentType || undefined,
      status: query.status,
    });
    rows.value = data.rows;
    total.value = data.total;
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
}

onMounted(loadList);

function handleSearch(): void {
  query.page = 1;
  void loadList();
}
</script>

<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <span>AI 调用日志</span>
        <div class="toolbar-actions">
          <el-select
            v-model="query.agentType"
            placeholder="全部功能"
            clearable
            style="width: 140px"
            @change="handleSearch"
          >
            <el-option
              v-for="item in agentTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="query.status"
            placeholder="全部状态"
            clearable
            style="width: 120px"
            @change="handleSearch"
          >
            <el-option label="成功" :value="1" />
            <el-option label="失败" :value="0" />
          </el-select>
        </div>
      </div>
    </template>

    <el-table v-loading="loading" :data="rows">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="userId" label="用户 ID" width="90">
        <template #default="{ row }">{{ (row as AiLogRow).userId ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="agentType" label="功能" width="110">
        <template #default="{ row }">{{ (row as AiLogRow).agentType ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="prompt" label="输入提示词" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ (row as AiLogRow).prompt ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="response" label="模型输出" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ (row as AiLogRow).response ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="costPoints" label="消耗积分" width="90">
        <template #default="{ row }">{{ (row as AiLogRow).costPoints ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="durationMs" label="耗时(ms)" width="90">
        <template #default="{ row }">{{ (row as AiLogRow).durationMs ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="(row as AiLogRow).status === 1 ? 'success' : 'danger'">
            {{ (row as AiLogRow).status === 1 ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="180">
        <template #default="{ row }">{{ formatTime((row as AiLogRow).createdAt) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="loadList"
        @size-change="handleSearch"
      />
    </div>
  </el-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
