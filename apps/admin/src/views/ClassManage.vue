<script setup lang="ts">
/**
 * 班级管理：列表（含在册学员数）+ 新建/编辑/软删（写操作全 POST）
 * schema 无 Class->User 关联，负责老师姓名由前端用用户列表映射
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { get, post } from '@/api/http';
import type { ClassRow, PageResult, UserRow } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { formatTime } from '@/utils/format';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const loading = ref(false);
const rows = ref<ClassRow[]>([]);
/** 老师选项（用于下拉与姓名映射） */
const teachers = ref<UserRow[]>([]);

const teacherName = (id: number | null): string =>
  teachers.value.find((t) => t.id === id)?.nickname ?? (id !== null ? `用户 ${id}` : '-');

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const [classData, userPage] = await Promise.all([
      get<ClassRow[]>('/class/list'),
      get<PageResult<UserRow>>('/user/list', { page: 1, pageSize: 100, role: 'teacher' }),
    ]);
    rows.value = classData;
    teachers.value = userPage.rows;
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
}

onMounted(loadList);

// ---------- 新建/编辑对话框 ----------
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
/** 正在编辑的班级 id，null 表示新建 */
const editingId = ref<number | null>(null);
/** 负责老师（null 表示清空关联） */
const teacherId = ref<number | null>(null);

const form = reactive({ name: '' });

const rules: FormRules = {
  name: [{ required: true, message: '请输入班级名称', trigger: 'blur' }],
};

function openCreate(): void {
  editingId.value = null;
  form.name = '';
  teacherId.value = null;
  dialogVisible.value = true;
}

function openEdit(row: ClassRow): void {
  editingId.value = row.id;
  form.name = row.name;
  teacherId.value = row.teacherId;
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
      await post('/class/create', {
        name: form.name,
        teacherId: teacherId.value ?? undefined,
      });
      ElMessage.success('班级创建成功');
    } else {
      await post('/class/update', {
        id: editingId.value,
        name: form.name,
        teacherId: teacherId.value,
      });
      ElMessage.success('班级已更新');
    }
    dialogVisible.value = false;
    await loadList();
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: ClassRow): Promise<void> {
  const confirmed = await ElMessageBox.confirm(
    `确定删除班级「${row.name}」吗？`,
    '提示',
    { type: 'warning' },
  ).then(
    () => true,
    () => false,
  );
  if (!confirmed) return;
  try {
    await post('/class/delete', { id: row.id });
    ElMessage.success('班级已删除');
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
        <span>班级管理</span>
        <el-button v-if="isAdmin" type="primary" @click="openCreate">新建班级</el-button>
      </div>
    </template>

    <el-table v-loading="loading" :data="rows">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="班级名称" min-width="160" />
      <el-table-column label="负责老师" width="140">
        <template #default="{ row }">{{ teacherName((row as ClassRow).teacherId) }}</template>
      </el-table-column>
      <el-table-column prop="studentCount" label="在册学员" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="(row as ClassRow).status === 1 ? 'success' : 'info'">
            {{ (row as ClassRow).status === 1 ? '正常' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime((row as ClassRow).createdAt) }}</template>
      </el-table-column>
      <el-table-column v-if="isAdmin" label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as ClassRow)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row as ClassRow)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId === null ? '新建班级' : '编辑班级'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="班级名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入班级名称" />
        </el-form-item>
        <el-form-item label="负责老师">
          <el-select v-model="teacherId" placeholder="不指定" clearable style="width: 100%">
            <el-option
              v-for="t in teachers"
              :key="t.id"
              :label="t.nickname || t.phone || `用户 ${t.id}`"
              :value="t.id"
            />
          </el-select>
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
</style>
