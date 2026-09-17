<script setup lang="ts">
/**
 * 计价配置：三类 Agent 调用单价查看 + 在线调整（admin，写操作 POST）
 * tenantId=0 为全局默认价；租户自定义后 isCustom=true 并覆盖展示
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { get, post } from '@/api/http';
import type { PriceRow } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { formatTime } from '@/utils/format';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const loading = ref(false);
const rows = ref<PriceRow[]>([]);
/** 行内编辑值 */
const editPrices = reactive<Record<string, number>>({});

const agentTypeLabel: Record<string, string> = {
  report: 'AI 点评',
  copywriting: '招生文案',
  chat: 'AI 对话',
};

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<PriceRow[]>('/points/prices');
    rows.value = data;
    for (const row of data) {
      editPrices[row.agentType] = row.price;
    }
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
}

onMounted(loadList);

async function handleSave(row: PriceRow): Promise<void> {
  const price = editPrices[row.agentType];
  if (price === undefined || price < 0) {
    ElMessage.warning('请输入正确的单价');
    return;
  }
  try {
    await post('/points/prices/update', { agentType: row.agentType, price });
    ElMessage.success(`「${agentTypeLabel[row.agentType] ?? row.agentType}」单价已更新`);
    await loadList();
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  }
}
</script>

<template>
  <el-card>
    <template #header>计价配置（单次调用消耗积分）</template>
    <el-table v-loading="loading" :data="rows">
      <el-table-column prop="agentType" label="功能" width="140">
        <template #default="{ row }">{{ agentTypeLabel[(row as PriceRow).agentType] ?? (row as PriceRow).agentType }}</template>
      </el-table-column>
      <el-table-column label="单价（积分/次）" width="200">
        <template #default="{ row }">
          <el-input-number
            v-if="isAdmin"
            v-model="editPrices[(row as PriceRow).agentType]"
            :min="0"
            :step="1"
          />
          <span v-else>{{ (row as PriceRow).price }}</span>
        </template>
      </el-table-column>
      <el-table-column label="价格来源" width="140">
        <template #default="{ row }">
          <el-tag :type="(row as PriceRow).tenantId === 0 ? 'info' : 'success'">
            {{ (row as PriceRow).tenantId === 0 ? '全局默认' : '租户自定义' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatTime((row as PriceRow).updatedAt) }}</template>
      </el-table-column>
      <el-table-column v-if="isAdmin" label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleSave(row as PriceRow)">保存</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>
