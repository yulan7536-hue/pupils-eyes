/**
 * AI 重绘：把照片真正"画"成插画（而不是加滤镜）。
 *
 * 为什么必须有这条路：
 * 本地滤镜无论怎么调，都只能改颜色、改质感、加描边，改不了"这张图是怎么画的"。
 * 参考图那种扁平数码插画，建筑窗户是一笔笔勾出来的、花是一层层叠上去的 ——
 * 这需要模型理解画面内容后重新绘制，滤镜做不到。试过几种本地方案都止步于
 * 「柔化过的照片」或「印刷网点感」，所以保留 AI 通道。
 *
 * 两条通道，谁通用谁：
 *  - Gemini 2.5 Flash Image：画风迁移效果最好，有免费额度，但需要能访问 Google
 *  - 豆包 Seedream 5.0：国内直连、速度快，但账号要余额（欠费会 403）
 *
 * 两条都失败时，调用方回落到本地引擎。
 */

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const DOUBAO_MODEL = 'doubao-seedream-5-0-flash-260915';
const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

/**
 * 卡通童话绘本风（在钢笔淡彩基础上的卡通化）。
 *
 * 用户反馈「不够卡通、和背景画风不同」——之前那版是「写实钢笔淡彩」：
 * 纤细速写线 + 极淡薄彩 + 大留白，画出来偏写实水彩，和背景童话小镇的
 * 卡通气质不搭。改成：圆润卡通造型 + 明快马卡龙色 + 流畅勾线，同时保留
 * 钢笔线条与轻度水彩质感，让贴纸和背景插画气质统一、更童趣。
 */
export const CARTOON_WATERCOLOR_PROMPT = `把这张照片重新绘制成卡通风格的手绘插画，一眼就是治愈系儿童绘本里的卡通角色，气质要和「钢笔淡彩童话小镇」插画统一：
1. 卡通造型：把主体画成可爱、圆润的卡通形象，头身比偏可爱，五官（眼睛、脸）适当放大、表情生动讨喜，可以适度夸张，但要让看的人一眼认出原物是什么，并保留主要颜色和花纹特征（比如猫的毛色斑纹、姿势）。
2. 勾线：用清晰、流畅、有粗细变化的深棕色钢笔线条勾勒轮廓，线条肯定连贯，像绘本插画师干净利落的勾线，不要密密麻麻的速写短线，也不要电脑式均匀描边。
3. 上色：明快干净的马卡龙粉彩色块（浅粉、奶油白、淡薄荷绿、雾霾蓝、鹅黄、浅杏色），比写实水彩更明快、更饱和一点，局部保留轻度水彩晕染的透明感。
4. 质感：轻度水彩加一点纸纹，治愈系童话绘本内页质感，背景留白或极淡色块，方便抠出主体。
不要照片质感、不要写实感、不要厚涂、不要 3D 渲染、不要文字、不要水印、不要边框。`;

export type AiProvider = 'gemini' | 'doubao';

export interface AiRestyleResult {
  dataUrl: string;
  provider: AiProvider;
}

function geminiKey(): string {
  const env = (import.meta.env as unknown as Record<string, string | undefined>).VITE_GEMINI_API_KEY;
  if (typeof window !== 'undefined') {
    try {
      const local = window.localStorage.getItem('pupils-eyes:gemini-key');
      if (local) return local.trim();
    } catch {
      /* ignore */
    }
  }
  return (env ?? '').trim();
}

function doubaoKey(): string {
  const env = (import.meta.env as unknown as Record<string, string | undefined>).VITE_DOUBAO_API_KEY;
  if (typeof window !== 'undefined') {
    try {
      const local = window.localStorage.getItem('pupils-eyes:doubao-key');
      if (local) return local.trim();
    } catch {
      /* ignore */
    }
  }
  return (env ?? '').trim();
}

/** dataURL → { mime, base64 } */
function splitDataUrl(dataUrl: string): { mime: string; data: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return { mime: 'image/jpeg', data: dataUrl.replace(/^data:.*,/, '') };
  return { mime: m[1], data: m[2] };
}

/* ---------------- Gemini ---------------- */

async function viaGemini(imageDataUrl: string, prompt: string): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error('没有配置 Gemini Key');

  const { mime, data } = splitDataUrl(imageDataUrl);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }],
          },
        ],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 400 && text.includes('User location is not supported')) {
      throw new Error('Google 在当前网络地区不可用');
    }
    if (res.status === 429) throw new Error('Gemini 免费额度用完了，明天再试');
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 120)}`);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part?.inlineData ?? part?.inline_data;
    if (inline?.data) {
      return `data:${inline.mimeType ?? inline.mime_type ?? 'image/png'};base64,${inline.data}`;
    }
  }
  throw new Error('Gemini 没有返回图片');
}

/* ---------------- 豆包 ---------------- */

async function viaDoubao(imageDataUrl: string, prompt: string): Promise<string> {
  const key = doubaoKey();
  if (!key) throw new Error('没有配置豆包 Key');

  const payload = JSON.stringify({
    model: DOUBAO_MODEL,
    prompt,
    image: [imageDataUrl],
    size: '1K',
    output_format: 'png',
    watermark: false,
    response_format: 'b64_json',
  });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };

  /**
   * 方舟的接口没有给浏览器放 CORS 头，直连必报 Failed to fetch。
   * 优先走同源 /generate（dev 用 vite 中间件，线上用 server.js），
   * 静态托管（GitHub Pages）没有这个后端，会 404，那就退回直连。
   */
  let res: Response | null = null;
  try {
    const proxied = await fetch(`/generate`, {
      method: 'POST',
      headers,
      body: payload,
    });
    if (proxied.status !== 404 && proxied.status !== 405) res = proxied;
  } catch {
    /* 代理不可用，继续直连 */
  }
  if (!res) {
    res = await fetch(ARK_ENDPOINT, { method: 'POST', headers, body: payload });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (text.includes('AccountOverdue')) throw new Error('豆包账号欠费，充值后才能用');
    if (res.status === 401) throw new Error('豆包 Key 无效');
    // 线上部署平台的网关会拦截指向火山方舟的代理请求，返回这段 zti 错误。
    // 这是平台限制，不是 Key 问题，单独提示，避免用户误以为「没换模型」。
    if (text.includes('zti') || text.includes('Unsupported')) {
      throw new Error('当前网页环境被平台拦截，无法调豆包，请改用本地预览');
    }
    throw new Error(`豆包 ${res.status}: ${text.slice(0, 120)}`);
  }

  const json = await res.json();
  const first = json?.data?.[0];
  const b64 = first?.b64_json;
  if (!b64) {
    if (first?.url) return first.url as string;
    throw new Error('豆包没有返回图片');
  }
  return `data:image/png;base64,${b64}`;
}

/* ---------------- 对外 ---------------- */

/**
 * 该通道当前能不能用（只检查有没有 Key，真实可用性要调用才知道） */
export function aiProviderReady(p: AiProvider): boolean {
  return p === 'gemini' ? Boolean(geminiKey()) : Boolean(doubaoKey());
}

/** 读当前生效的 Key（给设置面板回填用） */
export function readAiKey(p: AiProvider): string {
  return p === 'gemini' ? geminiKey() : doubaoKey();
}

/** 页面内保存 Key：存 localStorage，刷新后仍生效，只影响当前浏览器 */
export function setAiKey(p: AiProvider, key: string): void {
  if (typeof window === 'undefined') return;
  const storageKey = p === 'gemini' ? 'pupils-eyes:gemini-key' : 'pupils-eyes:doubao-key';
  try {
    const v = key.trim();
    if (v) window.localStorage.setItem(storageKey, v);
    else window.localStorage.removeItem(storageKey);
  } catch {
    /* 隐私模式下写不进去，忽略 */
  }
}

/**
 * 用 AI 重绘一张贴纸。
 *
 * @param sourceImage 输入图（dataURL，建议用抠图前的原图，信息量最全）
 * @param provider    走哪条通道
 * @param prompt      风格描述，默认用扁平插画
 * @param reference   「像哪张图」的参考图 dataURL（Gemini 支持多图输入，做风格模仿）
 */
export async function aiRestyle(
  sourceImage: string,
  provider: AiProvider,
  prompt: string = CARTOON_WATERCOLOR_PROMPT
): Promise<AiRestyleResult> {
  const dataUrl =
    provider === 'gemini'
      ? await viaGemini(sourceImage, prompt)
      : await viaDoubao(sourceImage, prompt);
  return { dataUrl, provider };
}
