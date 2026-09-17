<script setup lang="ts">
/**
 * 登录页：账号密码登录（admin/teacher）
 * 登录成功后跳转 redirect 参数或角色对应首页
 */
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { Lock, User } from '@element-plus/icons-vue';
import { APP_NAME } from '@artedu/shared';
import { useAuthStore } from '@/stores/auth';
import { homePathFor } from '@/router';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  phone: '13800000000',
  password: '',
  tenantId: 1,
});

const rules: FormRules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  tenantId: [{ required: true, message: '请输入租户 ID', trigger: 'blur' }],
};

async function handleLogin(): Promise<void> {
  const valid = await formRef.value?.validate().then(
    () => true,
    () => false,
  );
  if (!valid) return;
  loading.value = true;
  try {
    const user = await authStore.login({ ...form });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    await router.push(redirect || homePathFor(user.role));
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card">
      <h2 class="login-title">{{ APP_NAME }} 管理后台</h2>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large">
        <el-form-item prop="phone">
          <el-input v-model="form.phone" placeholder="手机号" :prefix-icon="User" clearable />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item prop="tenantId">
          <el-input v-model.number="form.tenantId" placeholder="租户 ID" />
        </el-form-item>
        <el-button
          type="primary"
          class="login-submit"
          :loading="loading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #1f2d3d 0%, #2b4a6f 100%);
}

.login-card {
  width: 380px;
}

.login-title {
  margin: 0 0 24px;
  text-align: center;
  font-size: 20px;
  color: #303133;
}

.login-submit {
  width: 100%;
}
</style>
