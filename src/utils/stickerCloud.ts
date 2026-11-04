import { cloud } from './cloudClient';
import { explainCloud } from './worksStore';

/**
 * 公共贴纸素材库。
 *
 * 图走数据库的 dataURL，不走云存储：存储桶不支持公开读、链接一小时就过期，
 * 而「别人能拿去用」要求长期可读。代价是每张要压在 70 万字符以内，
 * 所以发布前会再收一次尺寸。
 */

export interface PublicSticker {
  id: string;
  ownerId: string;
  title: string;
  src: string;
  width: number;
  height: number;
  useCount: number;
  createdAt: string;
}

interface StickerRow {
  id: number | string;
  owner_id: string;
  title: string;
  image_data: string;
  width: number;
  height: number;
  use_count: number;
  created_at: string;
}

const COLUMNS = 'id, owner_id, title, image_data, width, height, use_count, created_at';

const toSticker = (r: StickerRow): PublicSticker => ({
  id: String(r.id),
  ownerId: r.owner_id,
  title: r.title,
  src: r.image_data,
  width: r.width,
  height: r.height,
  useCount: r.use_count ?? 0,
  createdAt: r.created_at,
});

/** 单行的硬上限（见 stickers_image_data_shape 约束） */
const MAX_CHARS = 690_000;

/** 超过上限就重编码：先缩到 384，再不行降到 256，仍不行就报错 */
async function fitForUpload(dataUrl: string): Promise<string> {
  if (dataUrl.length <= MAX_CHARS) return dataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('这张贴纸读不出来'));
    el.src = dataUrl;
  });

  for (const side of [384, 256, 192]) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, w, h);
    // WebP 也支持透明通道，体积只有 PNG 的几分之一
    const out = canvas.toDataURL('image/webp', 0.82);
    if (out.length <= MAX_CHARS) return out;
  }

  throw new Error('这张贴纸太大了，发布不了');
}

export async function listPublicStickers(limit = 30): Promise<PublicSticker[]> {
  const { data, error } = await cloud.database
    .from('stickers')
    .select(COLUMNS)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(explainCloud(error));
  return ((data ?? []) as StickerRow[]).map(toSticker);
}

export interface PublishInput {
  dataUrl: string;
  title: string;
  width?: number;
  height?: number;
}

/** 发布到公共素材库，返回远端 id */
export async function publishSticker({ dataUrl, title, width, height }: PublishInput): Promise<string> {
  const fitted = await fitForUpload(dataUrl);

  const { data, error } = await cloud.database
    .from('stickers')
    .insert([
      {
        title: title.slice(0, 40),
        image_data: fitted,
        width: width ?? 0,
        height: height ?? 0,
        is_public: true,
      },
    ] as never[])
    .select('id');

  if (error) throw new Error(explainCloud(error));
  const row = ((data ?? []) as { id: number | string }[])[0];
  if (!row) throw new Error('发布没有成功，可能被策略拦下了');
  return String(row.id);
}

/** 重新公开一张之前撤下的贴纸 */
export async function setStickerPublic(remoteId: string, isPublic: boolean): Promise<void> {
  const { error } = await cloud.database
    .from('stickers')
    .update({ is_public: isPublic } as never)
    .eq('id', remoteId);
  if (error) throw new Error(explainCloud(error));
}

export async function removeRemoteSticker(remoteId: string): Promise<void> {
  const { error } = await cloud.database.from('stickers').delete().eq('id', remoteId);
  if (error) throw new Error(explainCloud(error));
}

/** 被拿去用一次，计数 +1（失败不影响摆放，所以只吞掉错误） */
export async function markStickerUsed(remoteId: string): Promise<void> {
  try {
    await cloud.database.rpc('use_sticker', { p_id: Number(remoteId) } as never);
  } catch {
    /* 统计而已 */
  }
}
