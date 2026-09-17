<script setup lang="ts">
/**
 * 用户管理：分页列表（角色筛选）+ 新建/编辑/软删（写操作全 POST）
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import type { Role } from '@artedu/shared';
import { get, post } from '@/api/http';
import type { PageResult, UserRow } from '@/api/types';
import { formatTime } from '@/utils/format';

/** 角色下拉选项 */
const roleOptions: { label: string; value: Role }[] = [
  { label: '管理员', value: 'admin' },
  { label: '老师', value: 'teacher' },
  { label: '家长', value: 'parent' },
];

/** 角色标签文案 */
function roleLabel(role: Role): string {
  return roleOptions.find((r) => r.value === role)?.label ?? role;
}

const loading = ref(false);
const rows = ref<UserRow[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, role: '' });

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<PageResult<UserRow>>('/user/list', {
      page: query.page,
      pageSize: query.pageSize,
      role: query.role || undefined,
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

// ---------- 新建/编辑对话框 ----------
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
/** 正在编辑的用户 id，null 表示新建 */
const editingId = ref<number | null>(null);

const form = reactive({
  phone: '',
  password: '',
  nickname: '',
  role: 'teacher' as 'admin' | 'teacher',
  status: 1,
});

/** 新建时密码必填，编辑时留空表示不修改 */
const rules = computed<FormRules>(() => ({
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password:
    editingId.value === null ? [{ required: true, message: '请输入密码', trigger: 'blur' }] : [],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}));

function openCreate(): void {
  editingId.value = null;
  form.phone = '';
  form.password = '';
  form.nickname = '';
  form.role = 'teacher';
  form.status = 1;
  dialogVisible.value = true;
}

function openEdit(row: UserRow): void {
  editingId.value = row.id;
  form.phone = row.phone ?? '';
  form.password = '';
  form.nickname = row.nickname ?? '';
  form.role = row.role === 'admin' ? 'admin' : 'teacher';
  form.status = row.status;
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
    if (editingId.value === null) {
      await post('/user/create', {
        phone: form.phone,
        password: form.password,
        nickname: form.nickname || undefined,
        role: form.role,
      });
      ElMessage.success('用户创建成功');
    } else {
      await post('/user/update', {
        id: editingId.value,
        phone: form.phone,
        nickname: form.nickname || undefined,
        role: form.role,
        status: form.status,
        password: form.password || undefined,
      });
      ElMessage.success('用户已更新');
    }
    dialogVisible.value = false;
    await loadList();
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: UserRow): Promise<void> {
  const confirmed = await ElMessageBox.confirm(
    `确定停用用户「${row.nickname || row.phone}」吗？`,
    '提示',
    { type: 'warning' },
  ).then(
    () => true,
    () => false,
  );
  if (!confirmed) return;
  try {
    await post('/user/delete', { id: row.id });
    ElMessage.success('用户已停用');
    await loadList();
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  }
}
</script>

<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <span>用户管理</span>
        <div class="toolbar-actions">
          <el-select
            v-model="query.role"
            placeholder="全部角色"
            clearable
            style="width: 140px"
            @change="handleSearch"
          >
            <el-option
              v-for="item in roleOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-button type="primary" @click="openCreate">新建用户</el-button>
        </div>
      </div>
    </template>

    <el-table v-loading="loading" :data="rows">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column prop="nickname" label="昵称" min-width="120" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : row.role === 'teacher' ? 'primary' : 'info'">
            {{ roleLabel(row.role as Role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ row.status === 1 ? '正常' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as UserRow)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row as UserRow)">停用</el-button>
        </template>
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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId === null ? '新建用户' : '编辑用户'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="editingId === null ? '请输入密码' : '留空表示不修改'"
          />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="管理员" value="admin" />
            <el-option label="老师" value="teacher" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editingId !== null" label="状态">
          <el-switch
            v-model="form.status"
            :active-value="1"
            :inactive-value="0"
            active-text="正常"
            inactive-text="停用"
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
