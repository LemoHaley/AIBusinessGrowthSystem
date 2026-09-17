/**
 * 路由与全局守卫（plan.md 阶段 8）
 * - 未登录访问受保护页跳转 /login（携带 redirect 回跳参数）
 * - meta.minRole 按角色层级控制页面访问（admin=3 > teacher=2 > parent=1）
 */
import { createRouter, createWebHistory } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { Role } from '@artedu/shared';
import { getAccessToken, getStoredUser } from '@/api/token';
import AdminLayout from '@/layouts/AdminLayout.vue';
import Login from '@/views/Login.vue';

/** 角色层级 */
const ROLE_RANK: Record<Role, number> = { parent: 1, teacher: 2, admin: 3 };

/** 按角色返回登录后的首页 */
export function homePathFor(role: Role | null | undefined): string {
  return role === 'admin' ? '/dashboard' : '/classes';
}

declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题（面包屑/菜单） */
    title?: string;
    /** 最低访问角色 */
    minRole?: Role;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login, meta: { title: '登录' } },
    {
      path: '/',
      component: AdminLayout,
      redirect: () => homePathFor(getStoredUser()?.role),
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: { title: '数据看板', minRole: 'admin' },
        },
        {
          path: 'tenant',
          name: 'tenant',
          component: () => import('@/views/TenantSettings.vue'),
          meta: { title: '机构信息', minRole: 'teacher' },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UserManage.vue'),
          meta: { title: '用户管理', minRole: 'admin' },
        },
        {
          path: 'classes',
          name: 'classes',
          component: () => import('@/views/ClassManage.vue'),
          meta: { title: '班级管理', minRole: 'teacher' },
        },
        {
          path: 'students',
          name: 'students',
          component: () => import('@/views/StudentManage.vue'),
          meta: { title: '学员管理', minRole: 'teacher' },
        },
        {
          path: 'points',
          name: 'points',
          component: () => import('@/views/Points.vue'),
          meta: { title: '积分管理', minRole: 'teacher' },
        },
        {
          path: 'prices',
          name: 'prices',
          component: () => import('@/views/PriceConfig.vue'),
          meta: { title: '计价配置', minRole: 'teacher' },
        },
        {
          path: 'agents',
          name: 'agents',
          component: () => import('@/views/AgentConfig.vue'),
          meta: { title: 'Agent 配置', minRole: 'admin' },
        },
        {
          path: 'ai-logs',
          name: 'ai-logs',
          component: () => import('@/views/AiLogs.vue'),
          meta: { title: '调用日志', minRole: 'admin' },
        },
        {
          path: 'assistant',
          name: 'assistant',
          component: () => import('@/views/AiAssistant.vue'),
          meta: { title: 'AI 助手', minRole: 'teacher' },
        },
        {
          path: 'knowledge',
          name: 'knowledge',
          component: () => import('@/views/Knowledge.vue'),
          meta: { title: '知识库', minRole: 'admin' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// 全局守卫：登录态 + 角色检查
router.beforeEach((to) => {
  const loggedIn = !!getAccessToken();
  if (to.name !== 'login' && !loggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && loggedIn) {
    return homePathFor(getStoredUser()?.role);
  }
  const minRole = to.meta.minRole;
  if (minRole) {
    const role = getStoredUser()?.role;
    if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
      ElMessage.warning('当前角色无权访问该页面');
      return homePathFor(role);
    }
  }
  return true;
});

export default router;
