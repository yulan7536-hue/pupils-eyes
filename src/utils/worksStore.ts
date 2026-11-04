import { cloud } from './cloudClient';
import { cloudReachable } from './cloudConfig';
import { compressThumb, compressWorkImage } from './imageCompress';
import type { Comment, RadarAnalysis, Role, SubmissionPayload, WorkItem } from '../types';

/**
 * 作品库的数据访问层。
 *
 * 「课题」和「成果」是同一张表，用 role 区分——它们本来就是同一门课的两端。
 * 可见性交给 RLS：审核通过的给所有人，没通过的只有作者自己看得到，
 * 所以前端不需要（也不该）自己拼 status 条件去决定给谁看。
 */

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface CloudWork extends WorkItem {
  status: ReviewStatus;
  reviewNote?: string;
  ownerId?: string;
  clientRef?: string;
  createdAt?: string;
}

export const isCloudWork = (w: WorkItem): w is CloudWork =>
  typeof (w as CloudWork).status === 'string';

const LIST_COLUMNS = [
  'id',
  'owner_id',
  'client_ref',
  'role',
  'title',
  'province',
  'city',
  'district',
  'region',
  'lat',
  'lon',
  'school',
  'author',
  'content',
  'thumb_data',
  'video_url',
  'digital_resource_url',
  'radar',
  'likes',
  'date_label',
  'status',
  'review_note',
  'created_at',
].join(', ');

interface WorkRow {
  id: number | string;
  owner_id?: string;
  client_ref?: string | null;
  role?: string;
  title: string;
  province: string;
  city: string;
  district: string;
  region: string;
  lat: number | string;
  lon: number | string;
  school: string;
  author: string;
  content: string;
  thumb_data?: string | null;
  video_url?: string | null;
  digital_resource_url?: string | null;
  radar?: RadarAnalysis | null;
  likes?: number;
  date_label?: string;
  status?: string;
  review_note?: string | null;
  created_at?: string;
}

function toWork(r: WorkRow): CloudWork {
  const status: ReviewStatus =
    r.status === 'approved' || r.status === 'rejected' ? r.status : 'pending';
  return {
    id: String(r.id),
    region: r.region || [r.province, r.city, r.district].filter(Boolean).join(' · '),
    province: r.province ?? '',
    city: r.city ?? '',
    district: r.district ?? '',
    lat: Number(r.lat) || 0,
    lon: Number(r.lon) || 0,
    title: r.title,
    role: (r.role === 'TEACHER' ? 'TEACHER' : 'STUDENT') as Role,
    school: r.school ?? '',
    author: r.author ?? '',
    content: r.content ?? '',
    imageUrl: r.thumb_data ?? undefined,
    videoUrl: r.video_url ?? undefined,
    digitalResourceUrl: r.digital_resource_url ?? undefined,
    date: r.date_label ?? '',
    likes: Number(r.likes ?? 0),
    comments: [],
    radar: r.radar ?? undefined,
    status,
    reviewNote: r.review_note ?? undefined,
    ownerId: r.owner_id,
    clientRef: r.client_ref ?? undefined,
    createdAt: r.created_at,
  };
}

/** 把云端错误翻成一句人话 */
export function explainCloud(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (/failed to fetch|network|load failed/i.test(raw)) {
    return cloudReachable() ? '网络不通，稍后再试一次' : '这个域名连不上云端，请用发布后的地址打开';
  }
  if (/row-level security|42501/i.test(raw)) return '没有权限做这件事，请先登录';
  if (/relation .* does not exist|42P01/i.test(raw)) return '云端数据表还没建好';
  if (/duplicate key|23505/i.test(raw)) return '这条记录已经存在';
  return raw.slice(0, 120) || '云端返回了未知错误';
}

const db = () => cloud.database;

/** 公开作品 + 自己的待审作品（RLS 负责区分，见不到别人的 pending） */
export async function listWorks(limit = 120): Promise<CloudWork[]> {
  const { data, error } = await db()
    .from('works')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(explainCloud(error));
  return ((data ?? []) as WorkRow[]).map(toWork);
}

/** 详情用原图：列表不带 image_data，点开才按 id 取，避免一次拉几百兆 */
export async function getWorkImage(id: string): Promise<string | null> {
  const { data, error } = await db().from('works').select('image_data').eq('id', id).limit(1);
  if (error) throw new Error(explainCloud(error));
  const row = ((data ?? []) as { image_data?: string | null }[])[0];
  return row?.image_data ?? null;
}

/** 当前登录用户点过亮的作品 id */
export async function listMyLikes(): Promise<Set<string>> {
  const { data, error } = await db().from('work_likes').select('work_id');
  if (error) return new Set();
  return new Set(((data ?? []) as { work_id: number | string }[]).map((r) => String(r.work_id)));
}

export interface CreateWorkInput {
  payload: SubmissionPayload;
  image?: File | null;
}

/** 提交一份作品。status 由 RLS 强制为 pending，前端不传。 */
export async function createWork({ payload, image }: CreateWorkInput): Promise<CloudWork> {
  let imageData: string | null = null;
  let thumbData: string | null = null;

  if (image) {
    const [full, thumb] = await Promise.all([compressWorkImage(image), compressThumb(image)]);
    imageData = full.dataUrl;
    thumbData = thumb.dataUrl;
  }

  const row = {
    client_ref: payload.id,
    role: payload.role,
    title: payload.title,
    province: payload.province,
    city: payload.city,
    district: payload.district,
    region: payload.region,
    lat: payload.lat,
    lon: payload.lon,
    school: payload.school,
    author: payload.author,
    content: payload.content,
    image_data: imageData,
    thumb_data: thumbData,
    video_url: payload.videoUrl ?? null,
    digital_resource_url: payload.digitalResourceUrl ?? null,
    radar: payload.radar ?? null,
    date_label: payload.date,
  };

  const { data, error } = await db()
    .from('works')
    .insert([row] as never[])
    .select(LIST_COLUMNS);

  if (error) throw new Error(explainCloud(error));
  const created = ((data ?? []) as WorkRow[])[0];
  if (!created) throw new Error('云端没有返回这条记录，可能被策略拦下了');
  return toWork(created);
}

/** 编辑自己的作品：改完自动回到待审（由 RLS 的 WITH CHECK 保证） */
export async function updateWork(
  id: string,
  patch: Partial<Pick<WorkItem, 'title' | 'content' | 'school' | 'author' | 'digitalResourceUrl'>> & {
    image?: File | null;
  }
): Promise<void> {
  const row: Record<string, unknown> = { status: 'pending' };

  if (patch.title !== undefined) row.title = patch.title;
  if (patch.content !== undefined) row.content = patch.content;
  if (patch.school !== undefined) row.school = patch.school;
  if (patch.author !== undefined) row.author = patch.author;
  if (patch.digitalResourceUrl !== undefined) row.digital_resource_url = patch.digitalResourceUrl || null;

  if (patch.image) {
    const [full, thumb] = await Promise.all([compressWorkImage(patch.image), compressThumb(patch.image)]);
    row.image_data = full.dataUrl;
    row.thumb_data = thumb.dataUrl;
  }

  const { error } = await db().from('works').update(row as never).eq('id', id);
  if (error) throw new Error(explainCloud(error));
}

export async function deleteWork(id: string): Promise<void> {
  const { error } = await db().from('works').delete().eq('id', id);
  if (error) throw new Error(explainCloud(error));
}

/** 点亮 / 取消点亮，计数由数据库函数保证一致 */
export async function toggleLike(id: string): Promise<{ liked: boolean; likes: number }> {
  const { data, error } = await db().rpc('toggle_like', { p_work_id: Number(id) } as never);
  if (error) throw new Error(explainCloud(error));
  const res = data as { ok?: boolean; liked?: boolean; likes?: number; reason?: string } | null;
  if (!res?.ok) throw new Error(res?.reason === 'anon' ? '登录后才能点亮' : '点亮失败，请稍后再试');
  return { liked: Boolean(res.liked), likes: Number(res.likes ?? 0) };
}

interface CommentRow {
  id: number | string;
  owner_id: string;
  owner_name: string;
  content: string;
  created_at: string;
}

const toComment = (r: CommentRow): Comment => ({
  id: String(r.id),
  user: r.owner_name || '同行学者',
  text: r.content,
  time: (r.created_at ?? '').slice(5, 16).replace('T', ' '),
});

export async function listComments(workId: string): Promise<Comment[]> {
  const { data, error } = await db()
    .from('work_comments')
    .select('id, owner_id, owner_name, content, created_at')
    .eq('work_id', workId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw new Error(explainCloud(error));
  return ((data ?? []) as CommentRow[]).map(toComment);
}

export async function addComment(workId: string, text: string, name: string): Promise<Comment> {
  const { data, error } = await db()
    .from('work_comments')
    .insert([{ work_id: workId, content: text.slice(0, 500), owner_name: name.slice(0, 16) }] as never[])
    .select('id, owner_id, owner_name, content, created_at');

  if (error) throw new Error(explainCloud(error));
  const row = ((data ?? []) as CommentRow[])[0];
  if (!row) throw new Error('评论没有保存成功');
  return toComment(row);
}
