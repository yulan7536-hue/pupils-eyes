import { cloud } from './cloudClient';
import { explainCloud } from './worksStore';
import type { ReviewStatus } from './worksStore';

/**
 * 开发者后台。
 *
 * 管理员不是登录用户（一个口令即可进入），而 RLS 只放行 approved 的作品，
 * 所以后台的「列出全部 / 审核」必须走数据库里的 SECURITY DEFINER 函数，
 * 口令在服务端用 bcrypt 比对，前端只把它放在 sessionStorage，关掉标签页就没了。
 */

export type AdminCheck = 'ok' | 'bad' | 'locked' | 'nokey';

export interface AdminWork {
  id: number;
  owner_id: string;
  role: string;
  title: string;
  province: string;
  city: string;
  district: string;
  region: string;
  school: string;
  author: string;
  content: string;
  likes: number;
  date_label: string;
  status: ReviewStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  has_image: boolean;
}

interface RpcResult<T> {
  ok?: boolean;
  reason?: string;
  total?: number;
  items?: T;
  item?: T;
  status?: string;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  const { data, error } = await cloud.database.rpc(fn, args as never);
  if (error) throw new Error(explainCloud(error));
  return (data ?? {}) as RpcResult<T>;
}

const reasonText: Record<string, string> = {
  bad: '口令不对',
  locked: '失败次数太多，请 15 分钟后再试',
  nokey: '服务端还没有设置后台口令',
  notfound: '这条记录不存在',
  weak: '新口令至少 6 位',
  badstatus: '状态不合法',
};

const explain = (reason?: string) => reasonText[reason ?? ''] ?? '操作失败，请稍后再试';

export async function adminCheck(password: string): Promise<AdminCheck> {
  try {
    const res = await callRpc<string>('admin_check', { p_password: password });
    const value = res as unknown as string;
    if (value === 'ok' || value === 'bad' || value === 'locked' || value === 'nokey') return value;
    return 'bad';
  } catch {
    return 'bad';
  }
}

export async function adminList(
  password: string,
  status: ReviewStatus | '',
  limit = 50,
  offset = 0
): Promise<{ total: number; items: AdminWork[] }> {
  const res = await callRpc<AdminWork[]>('admin_list_works', {
    p_password: password,
    p_status: status || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (!res.ok) throw new Error(explain(res.reason));
  return { total: Number(res.total ?? 0), items: res.items ?? [] };
}

/** 单条详情（带原图）。列表不带 image_data，点开某一篇才取 */
export async function adminGetWork(
  password: string,
  id: number
): Promise<(AdminWork & { image_data?: string | null }) | null> {
  const res = await callRpc<AdminWork & { image_data?: string | null }>('admin_get_work', {
    p_password: password,
    p_id: id,
  });
  if (!res.ok) throw new Error(explain(res.reason));
  return res.item ?? null;
}

export async function adminReview(
  password: string,
  id: number,
  status: ReviewStatus,
  note = ''
): Promise<void> {
  const res = await callRpc<unknown>('admin_review', {
    p_password: password,
    p_work_id: id,
    p_status: status,
    p_note: note,
  });
  if (!res.ok) throw new Error(explain(res.reason));
}

export async function adminSetPassword(password: string, next: string): Promise<void> {
  const res = await callRpc<unknown>('admin_set_password', { p_password: password, p_new: next });
  if (!res.ok) throw new Error(explain(res.reason));
}
