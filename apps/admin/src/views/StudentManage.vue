<script setup lang="ts">
/**
 * 学员管理：按班级筛选 + 分页列表 + 新建/编辑/软删（写操作全 POST）
 * 班级下拉来自班级列表；家长下拉来自 role=parent 用户列表
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { get, post } from '@/api/http';
import type { ClassRow, PageResult, StudentRow, UserRow } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { formatTime } from '@/utils/format';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const loading = ref(false);
const rows = ref<StudentRow[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, classId: undefined as number | undefined });

/** 班级选项（筛选与表单共用） */
const classes = ref<ClassRow[]>([]);
/** 家长选项（用于关联家长下拉） */
const parents = ref<UserRow[]>([]);

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<PageResult<StudentRow>>('/student/list', {
      page: query.page,
      pageSize: query.pageSize,
      classId: query.classId,
    });
    rows.value = data.rows;
    total.value = data.total;
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
}

async function loadOptions(): Promise<void> {
  try {
    const [classData, userPage] = await Promise.all([
      get<ClassRow[]>('/class/list'),
      get<PageResult<UserRow>>('/user/list', { page: 1, pageSize: 100, role: 'parent' }),
    ]);
    classes.value = classData;
    parents.value = userPage.rows;
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  }
}

onMounted(() => {
  void loadList();
  void loadOptions();
});

function handleSearch(): void {
  query.page = 1;
  void loadList();
}

// ---------- 新建/编辑对话框 ----------
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
/** 正在编辑的学员 id，null 表示新建 */
const editingId = ref<number | null>(null);
/** 关联班级/家长（null 表示清空关联） */
const classId = ref<number | null>(null);
const parentUserId = ref<number | null>(null);

const form = reactive({ name: '', level: '' });

const rules: FormRules = {
  name: [{ required: true, message: '请输入学员姓名', trigger: 'blur' }],
};

function openCreate(): void {
  editingId.value = null;
  form.name = '';
  form.level = '';
  classId.value = query.classId ?? null;
  parentUserId.value = null;
  dialogVisible.value = true;
}

function openEdit(row: StudentRow): void {
  editingId.value = row.id;
  form.name = row.name;
  form.level = row.level ?? '';
  classId.value = row.classId;
  parentUserId.value = row.parentUserId;
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
      await post('/student/create', {
        name: form.name,
        classId: classId.value ?? undefined,
        parentUserId: parentUserId.value ?? undefined,
        level: form.level || undefined,
      });
      ElMessage.success('学员创建成功');
    } else {
      await post('/student/update', {
        id: editingId.value,
        name: form.name,
        classId: classId.value,
        parentUserId: parentUserId.value,
        level: form.level || undefined,
      });
      ElMessage.success('学员已更新');
    }
    dialogVisible.value = false;
    await loadList();
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: StudentRow): Promise<void> {
  const confirmed = await ElMessageBox.confirm(
    `确定删除学员「${row.name}」吗？`,
    '提示',
    { type: 'warning' },
  ).then(
    () => true,
    () => false,
  );
  if (!confirmed) return;
  try {
    await post('/student/delete', { id: row.id });
    ElMessage.success('学员已删除');
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
        <span>学员管理</span>
        <div class="toolbar-actions">
          <el-select
            v-model="query.classId"
            placeholder="全部班级"
            clearable
            style="width: 180px"
            @change="handleSearch"
          >
            <el-option
              v-for="c in classes"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
          <el-button v-if="isAdmin" type="primary" @click="openCreate">新建学员</el-button>
        </div>
      </div>
    </template>

    <el-table v-loading="loading" :data="rows">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="姓名" min-width="120" />
      <el-table-column prop="className" label="所属班级" min-width="140">
        <template #default="{ row }">{{ (row as StudentRow).className ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="level" label="级别" width="100">
        <template #default="{ row }">{{ (row as StudentRow).level ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="关联家长" width="140">
        <template #default="{ row }">
          {{
            (row as StudentRow).parentUserId !== null
              ? parents.find((p) => p.id === (row as StudentRow).parentUserId)?.nickname ??
                `用户 ${(row as StudentRow).parentUserId}`
              : '-'
          }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="(row as StudentRow).status === 1 ? 'success' : 'info'">
            {{ (row as StudentRow).status === 1 ? '正常' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime((row as StudentRow).createdAt) }}</template>
      </el-table-column>
      <el-table-column v-if="isAdmin" label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as StudentRow)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row as StudentRow)">删除</el-button>
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
      :title="editingId === null ? '新建学员' : '编辑学员'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入学员姓名" />
        </el-form-item>
        <el-form-item label="所属班级">
          <el-select v-model="classId" placeholder="不关联" clearable style="width: 100%">
            <el-option
              v-for="c in classes"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联家长">
          <el-select
            v-model="parentUserId"
            placeholder="不关联"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="p in parents"
              :key="p.id"
              :label="p.nickname || p.phone || `用户 ${p.id}`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="级别">
          <el-input v-model="form.level" placeholder="如：启蒙/初级/中级" />
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
