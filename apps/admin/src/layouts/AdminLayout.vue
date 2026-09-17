<script setup lang="ts">
/**
 * 主布局：侧边栏菜单 + 顶栏（面包屑/用户信息/退出）+ 内容区
 * 菜单按角色过滤：admin 全部可见；teacher 见基础数据/积分/计价/AI 助手
 */
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox, ElNotification } from 'element-plus';
import { Coin, MagicStick, Odometer, OfficeBuilding } from '@element-plus/icons-vue';
import { APP_NAME } from '@artedu/shared';
import { get } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isAdmin = computed(() => authStore.isAdmin);

/** 当前用户显示名：昵称优先，无则手机号 */
const displayName = computed(
  () => authStore.user?.nickname || authStore.user?.phone || '未知用户',
);

/** 面包屑：首页 / 当前页标题 */
interface CrumbItem {
  title: string;
  path: string;
}
const breadcrumb = computed<CrumbItem[]>(() => {
  const items: CrumbItem[] = [{ title: '首页', path: '/' }];
  if (route.meta.title) items.push({ title: route.meta.title, path: route.path });
  return items;
});

async function handleLogout(): Promise<void> {
  const confirmed = await ElMessageBox.confirm('确定退出登录吗？', '提示', {
    type: 'warning',
  }).then(
    () => true,
    () => false,
  );
  if (!confirmed) return;
  // 登出接口失败（如 token 已过期被强制清理）时仍回到登录页
  await authStore.logout().catch(() => undefined);
  void router.push('/login');
}

/** 积分低额预警阈值：余额低于该值时登录后站内提醒一次 */
const LOW_POINTS_THRESHOLD = 20;

// 进入后台时检查当前账号积分余额，低于阈值弹出站内预警（布局仅挂载一次）
onMounted(async () => {
  try {
    const data = await get<{ balance: number }>('/points/balance');
    if (data.balance <= LOW_POINTS_THRESHOLD) {
      ElNotification.warning({
        title: '积分余额预警',
        message: `当前积分余额 ${data.balance}，已低于预警阈值 ${LOW_POINTS_THRESHOLD}，请及时充值以免影响 AI 功能使用。`,
        position: 'bottom-right',
        duration: 8000,
      });
    }
  } catch {
    // 余额查询失败不打扰用户，错误提示由 axios 拦截器统一处理
  }
});
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="layout-aside">
      <div class="layout-logo">{{ APP_NAME }}</div>
      <el-menu :default-active="route.path" router class="layout-menu">
        <el-menu-item v-if="isAdmin" index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        <el-sub-menu index="base">
          <template #title>
            <el-icon><OfficeBuilding /></el-icon>
            <span>基础数据</span>
          </template>
          <el-menu-item index="/tenant">机构信息</el-menu-item>
          <el-menu-item v-if="isAdmin" index="/users">用户管理</el-menu-item>
          <el-menu-item index="/classes">班级管理</el-menu-item>
          <el-menu-item index="/students">学员管理</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="billing">
          <template #title>
            <el-icon><Coin /></el-icon>
            <span>积分与计费</span>
          </template>
          <el-menu-item index="/points">积分管理</el-menu-item>
          <el-menu-item index="/prices">计价配置</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="ai">
          <template #title>
            <el-icon><MagicStick /></el-icon>
            <span>AI 中心</span>
          </template>
          <el-menu-item v-if="isAdmin" index="/agents">Agent 配置</el-menu-item>
          <el-menu-item v-if="isAdmin" index="/ai-logs">调用日志</el-menu-item>
          <el-menu-item index="/assistant">AI 助手</el-menu-item>
          <el-menu-item v-if="isAdmin" index="/knowledge">知识库</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item
            v-for="(item, index) in breadcrumb"
            :key="index"
            :to="index === 0 ? item.path : undefined"
          >
            {{ item.title }}
          </el-breadcrumb-item>
        </el-breadcrumb>
        <div class="layout-header-right">
          <span class="layout-user-name">{{ displayName }}</span>
          <el-tag :type="isAdmin ? 'danger' : 'primary'" size="small">
            {{ isAdmin ? '管理员' : '老师' }}
          </el-tag>
          <el-button link type="danger" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100%;
}

.layout-aside {
  border-right: 1px solid #e4e7ed;
  background: #fff;
}

.layout-logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: #409eff;
  border-bottom: 1px solid #e4e7ed;
}

.layout-menu {
  border-right: none;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.layout-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.layout-user-name {
  font-size: 14px;
  color: #303133;
}

.layout-main {
  background: #f5f7fa;
}
</style>
