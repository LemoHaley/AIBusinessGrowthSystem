/**
 * 展示格式化工具
 */

/** 时间格式化：ISO 字符串 -> YYYY-MM-DD HH:mm:ss（本地时区），空值返回 - */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 积分变动展示：正数带 + 前缀 */
export function formatAmount(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
