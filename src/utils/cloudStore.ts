import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';
import type { Role, WorkItem } from '../types';
import { CLOUD_ORIGIN, cloudReachable, PUBLIC_CONFIG, themeKeyOf } from './cloudConfig';
import type { ThemePhoto } from './cloudConfig';

/**
 * 云服务连接。
 *
 * publishableKey 只标识"是哪个应用"，本身不含任何权限，服务端按 Origin 校验，
 * 所以它可以随前端发布；真正有权限的东西一律留在服务端。
 *
 * 这个文件会把 SDK 一起带进来，所以只该被按需 import —— 常量与纯函数都在 cloudConfig.ts。
 */
export const cloud = createWorkBuddyCloud({ ...PUBLIC_CONFIG });

export { CLOUD_ORIGIN, cloudReachable, themeKeyOf };
export type { ThemePhoto };

interface PhotoRow {
  id: number | string;
  theme_key: string;
  theme_title: string;
  district: string;
  caption: string | null;
  uploader: string;
  role: string;
  image_data: string;
  created_at: string;
}

const COLUMNS =
  'id, theme_key, theme_title, district, caption, uploader, role, image_data, created_at';

const toPhoto = (r: PhotoRow): ThemePhoto => ({
  id: String(r.id),
  themeKey: r.theme_key,
  themeTitle: r.theme_title,
  district: r.district,
  caption: r.caption,
  uploader: r.uploader,
  role: r.role === 'TEACHER' ? 'TEACHER' : 'STUDENT',
  imageData: r.image_data,
  createdAt: r.created_at,
});

/** 把网络层抛出来的东西翻成一句人话，别把原始 error 直接糊到界面上。 */
function explain(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return cloudReachable()
      ? '网络不通，稍后再试一次'
      : `这个域名连不上云端。请在 ${CLOUD_ORIGIN} 上传与查看。`;
  }
  if (/relation .* does not exist|42P01/i.test(raw)) return '云端数据表还没建好';
  if (/row-level security|42501/i.test(raw)) return '云端拒绝了这次写入';
  return raw.slice(0, 120) || '云端返回了未知错误';
}

/** 某门课下的全部照片，新传的排在前面 */
export async function listThemePhotos(themeKey: string, limit = 60): Promise<ThemePhoto[]> {
  const { data, error } = await cloud.database
    .from('theme_photos')
    .select(COLUMNS)
    .eq('theme_key', themeKey)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(explain(error));
  return ((data ?? []) as PhotoRow[]).map(toPhoto);
}

/**
 * 把一张手机照片压到能塞进一行的尺寸。
 *
 * 走数据库而不是对象存储是有意的：云端存储只对已登录用户开放，也不发公开链接，
 * 展示得靠 1 小时就过期的签名 URL —— 那就必须先把登录体系搭起来，而"学生课间
 * 随手传一张"不该先注册。缩到 900px、WebP q0.72，一张 30~60KB，横滑墙够用，
 * 点开也能看清。体积超预算就降一档再压，最多三轮。
 */
async function compressImage(file: File): Promise<{ dataUrl: string; bytes: number }> {
  const bitmap = await createImageBitmap(file);
  const ladder = [
    { side: 900, quality: 0.72 },
    { side: 720, quality: 0.66 },
    { side: 560, quality: 0.6 },
  ];
  let last = '';

  for (const step of ladder) {
    const scale = Math.min(1, step.side / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('这个浏览器不支持图片压缩');
    ctx.drawImage(bitmap, 0, 0, w, h);

    // WebP 不被支持时 toDataURL 会悄悄退回 PNG，体积直接翻几倍 —— 那就改用 JPEG
    let out = canvas.toDataURL('image/webp', step.quality);
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', step.quality);
    last = out;

    if (out.length <= 240_000) break;
  }

  bitmap.close?.();
  return { dataUrl: last, bytes: last.length };
}

export interface NewPhoto {
  theme: Pick<WorkItem, 'province' | 'city' | 'district' | 'title'>;
  uploader: string;
  role: Role;
  caption?: string;
  file: File;
}

/** 上传一张成果照片，自动归到传入的那门课下 */
export async function addThemePhoto(input: NewPhoto): Promise<ThemePhoto> {
  const { dataUrl, bytes } = await compressImage(input.file);

  const { data, error } = await cloud.database
    .from('theme_photos')
    // 没给客户端挂 schema 泛型，行类型会退化成 never[]；这里只是把它显式放开
    .insert([
      {
        theme_key: themeKeyOf(input.theme),
        theme_title: input.theme.title,
        district: input.theme.district,
        city: input.theme.city,
        province: input.theme.province,
        caption: input.caption?.trim() ? input.caption.trim().slice(0, 60) : null,
        uploader: input.uploader.trim().slice(0, 16),
        role: input.role,
        image_data: dataUrl,
        bytes,
      },
    ] as never[])
    .select(COLUMNS);

  if (error) throw new Error(explain(error));
  const row = ((data ?? []) as PhotoRow[])[0];
  if (!row) throw new Error('云端没有返回这张照片，可能被策略拦下了');
  return toPhoto(row);
}
