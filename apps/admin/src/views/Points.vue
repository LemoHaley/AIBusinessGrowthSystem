<script setup lang="ts">
/**
 * 积分管理：当前用户余额卡 + 流水分页 + 充值对话框（admin，bizId 前端生成幂等键）
 * 注意：流水接口返回的是当前登录用户自己的流水
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { get, post } from '@/api/http';
import type { LedgerRow, PageResult, UserRow } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { formatAmount, formatTime } from '@/utils/format';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

// ---------- 余额 ----------
const balance = ref(0);
const balanceLoading = ref(false);

async function loadBalance(): Promise<void> {
  balanceLoading.value = true;
  try {
    const data = await get<{ balance: number }>('/points/balance');
    balance.value = data.balance;
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    balanceLoading.value = false;
  }
}

// ---------- 流水 ----------
const loading = ref(false);
const rows = ref<LedgerRow[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20 });

const changeTypeLabel: Record<LedgerRow['changeType'], string> = {
  recharge: '充值',
  consume: '消耗',
  rollback: '回滚',
};

async function loadLedger(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<PageResult<LedgerRow>>('/points/ledger', {
      page: query.page,
      pageSize: query.pageSize,
    });
    rows.value = data.rows;
    total.value = data.total;
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadBalance();
  void loadLedger();
});

// ---------- 充值对话框（admin） ----------
const rechargeVisible = ref(false);
const rechargeSaving = ref(false);
/** 充值目标用户（全角色可选） */
const users = ref<UserRow[]>([]);
const rechargeForm = reactive({
  userId: undefined as number | undefined,
  amount: 100,
});

async function openRecharge(): Promise<void> {
  rechargeForm.userId = undefined;
  rechargeForm.amount = 100;
  rechargeVisible.value = true;
  if (users.value.length === 0) {
    try {
      const data = await get<PageResult<UserRow>>('/user/list', { page: 1, pageSize: 100 });
      users.value = data.rows;
    } catch {
      // 错误提示由 axios 拦截器统一弹出
    }
  }
}

async function handleRecharge(): Promise<void> {
  if (!rechargeForm.userId || rechargeForm.amount <= 0) {
    ElMessage.warning('请选择充值目标用户并输入正确数量');
    return;
  }
  rechargeSaving.value = true;
  try {
    // bizId 由前端生成（幂等键）：网络重试时复用同一单号可防重复充值
    const data = await post<{ balance: number }>('/points/recharge', {
      userId: rechargeForm.userId,
      amount: rechargeForm.amount,
      bizId: crypto.randomUUID(),
    });
    ElMessage.success(`充值成功，目标用户当前余额 ${data.balance}`);
    rechargeVisible.value = false;
    await loadBalance();
    await loadLedger();
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    rechargeSaving.value = false;
  }
}
</script>

<template>
  <div class="points">
    <el-row :gutter="16">
      <el-col :span="8">
        <el-card v-loading="balanceLoading">
          <template #header>当前账号积分余额</template>
          <div class="balance-value">{{ balance }}</div>
          <el-button v-if="isAdmin" type="primary" @click="openRecharge">充值</el-button>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="ledger-card">
      <template #header>积分流水</template>
      <el-table v-loading="loading" :data="rows">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="(row as LedgerRow).changeType === 'recharge' ? 'success' : (row as LedgerRow).changeType === 'rollback' ? 'warning' : 'danger'">
              {{ changeTypeLabel[(row as LedgerRow).changeType] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="变动" width="100">
          <template #default="{ row }">
            <span :class="(row as LedgerRow).changeAmount >= 0 ? 'amount-in' : 'amount-out'">
              {{ formatAmount((row as LedgerRow).changeAmount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balanceAfter" label="变动后余额" width="110" />
        <el-table-column prop="bizType" label="业务类型" width="110">
          <template #default="{ row }">{{ (row as LedgerRow).bizType ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="bizId" label="业务单号" min-width="200" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="120">
          <template #default="{ row }">{{ (row as LedgerRow).remark ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatTime((row as LedgerRow).createdAt) }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadLedger"
          @size-change="() => { query.page = 1; void loadLedger(); }"
        />
      </div>
    </el-card>

    <el-dialog v-model="rechargeVisible" title="积分充值" width="480px">
      <el-form label-width="100px">
        <el-form-item label="目标用户" required>
          <el-select
            v-model="rechargeForm.userId"
            placeholder="选择充值目标用户"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="u in users"
              :key="u.id"
              :label="`${u.nickname || u.phone || '用户 ' + u.id}（${u.role}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="充值数量" required>
          <el-input-number v-model="rechargeForm.amount" :min="1" :step="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeVisible = false">取消</el-button>
        <el-button type="primary" :loading="rechargeSaving" @click="handleRecharge">确认充值</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.balance-value {
  font-size: 36px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 16px;
}

.ledger-card {
  margin-top: 16px;
}

.amount-in {
  color: #67c23a;
}

.amount-out {
  color: #f56c6c;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
