/**
 * 前端业务类型定义（对应后端接口出入参）
 * 注意：后端 ok() 已将 BigInt 递归转换为 Number，此处均为 number
 */
import type { Role } from '@artedu/shared';

/** 登录用户信息（登录/刷新/me 接口返回） */
export interface UserInfo {
  id: number;
  tenantId: number;
  openid: string | null;
  phone: string | null;
  nickname: string | null;
  avatar: string | null;
  role: Role;
  status: number;
}

/** 登录/刷新接口返回的 token 对 */
export interface TokenPair {
  access: string;
  refresh: string;
  user: UserInfo;
}

/** 分页返回结构 */
export interface PageResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 用户行（/api/user/list） */
export interface UserRow {
  id: number;
  tenantId: number;
  openid: string | null;
  phone: string | null;
  nickname: string | null;
  avatar: string | null;
  role: Role;
  status: number;
  createdAt: string;
  updatedAt: string;
}

/** 班级行（/api/class/list，含在册学员数） */
export interface ClassRow {
  id: number;
  tenantId: number;
  name: string;
  teacherId: number | null;
  status: number;
  createdAt: string;
  updatedAt: string;
  studentCount: number;
}

/** 学员行（/api/student/list，含所属班级名） */
export interface StudentRow {
  id: number;
  tenantId: number;
  name: string;
  parentUserId: number | null;
  classId: number | null;
  className: string | null;
  level: string | null;
  status: number;
  createdAt: string;
  updatedAt: string;
}

/** 机构信息（/api/tenant） */
export interface TenantInfo {
  id: number;
  name: string;
  logo: string | null;
  contact: string | null;
  expireAt: string | null;
  status: number;
  createdAt: string;
  updatedAt: string;
}

/** 积分流水行（/api/points/ledger） */
export interface LedgerRow {
  id: number;
  tenantId: number;
  userId: number;
  changeType: 'recharge' | 'consume' | 'rollback';
  changeAmount: number;
  balanceAfter: number;
  bizId: string;
  bizType: string | null;
  remark: string | null;
  createdAt: string;
}

/** 计价行（/api/points/prices） */
export interface PriceRow {
  id: number;
  agentType: string;
  price: number;
  tenantId: number;
  status: number;
  updatedAt: string;
}

/** Agent 配置行（/api/ai/agents，全局默认与租户自定义合并） */
export interface AgentRow {
  id: number;
  agentType: string;
  provider: 'coze' | 'dify' | 'openai';
  botId: string | null;
  model: string | null;
  promptTemplate: string | null;
  tenantId: number;
  status: number;
  updatedAt: string;
  isCustom: boolean;
}

/** AI 调用日志行（/api/ai/logs） */
export interface AiLogRow {
  id: number;
  tenantId: number;
  userId: number | null;
  agentType: string | null;
  prompt: string | null;
  response: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costPoints: number | null;
  durationMs: number | null;
  status: number;
  createdAt: string;
}

/** 看板汇总（/api/dashboard/summary） */
export interface DashboardSummary {
  studentCount: number;
  classCount: number;
  monthReportCount: number;
  monthPointsConsumed: number;
  reportTrend: { date: string; count: number }[];
  consumeTrend: { date: string; points: number }[];
}
