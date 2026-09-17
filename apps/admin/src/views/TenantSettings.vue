<script setup lang="ts">
/**
 * 机构信息页：查询 + 更新名称/Logo/联系方式（更新仅 admin 可操作）
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { get, post } from '@/api/http';
import type { TenantInfo } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { formatTime } from '@/utils/format';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);
/** 只读信息（服务到期时间等展示用） */
const info = ref<TenantInfo | null>(null);

const form = reactive({
  name: '',
  logo: '',
  contact: '',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入机构名称', trigger: 'blur' }],
};

onMounted(async () => {
  loading.value = true;
  try {
    const data = await get<TenantInfo>('/tenant');
    info.value = data;
    form.name = data.name;
    form.logo = data.logo ?? '';
    form.contact = data.contact ?? '';
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
});

async function handleSave(): Promise<void> {
  const valid = await formRef.value?.validate().then(
    () => true,
    () => false,
  );
  if (!valid) return;
  saving.value = true;
  try {
    await post('/tenant/update', {
      name: form.name,
      logo: form.logo || undefined,
      contact: form.contact || undefined,
    });
    ElMessage.success('机构信息已更新');
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-card v-loading="loading">
    <template #header>机构信息</template>
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      style="max-width: 560px"
    >
      <el-form-item label="机构名称" prop="name">
        <el-input v-model="form.name" :disabled="!isAdmin" placeholder="请输入机构名称" />
      </el-form-item>
      <el-form-item label="Logo 地址">
        <el-input v-model="form.logo" :disabled="!isAdmin" placeholder="https://..." />
      </el-form-item>
      <el-form-item label="联系方式">
        <el-input v-model="form.contact" :disabled="!isAdmin" placeholder="电话/微信/邮箱" />
      </el-form-item>
      <el-form-item label="服务到期">
        <el-input :model-value="formatTime(info?.expireAt)" disabled />
      </el-form-item>
      <el-form-item v-if="isAdmin">
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>
