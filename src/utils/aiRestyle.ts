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

/** 参考图（扁平数码插画）的风格描述，写成模型容易照做的分条指令 */
export const FLAT_ILLUSTRATION_PROMPT = `把这张照片重新绘制成扁平数码插画，风格要求：
1. 用清晰的深棕黑色细线勾勒出所有物体的轮廓和主要结构，线条要连贯。
2. 配色改成马卡龙粉彩：浅粉、奶油白、淡薄荷绿、雾霾蓝、鹅黄、浅杏色。
3. 颜色以大块平涂为主，块面之间的过渡要干净，不要照片的渐变和噪点。
4. 保留原图的构图、主体外形和关键特征，不要改变主体是什么东西。
5. 光影简化：只用一整块受光面和一整块背光面表现体积，不要真实反射和高光点。
6. 背景简化为干净的色块或在主体周围留白。
整体要像手绘的儿童绘本插画，而不是照片加了滤镜。不要文字、不要水印、不要边框。`;

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
   * 优先走同源的 /api/proxy（dev 与 preview 都挂了），
   * 静态托管（GitHub Pages）没有这个后端，会 404，那就退回直连。
   */
  let res: Response | null = null;
  try {
    const proxied = await fetch(`/api/proxy?url=${encodeURIComponent(ARK_ENDPOINT)}`, {
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
  prompt: string = FLAT_ILLUSTRATION_PROMPT
): Promise<AiRestyleResult> {
  const dataUrl =
    provider === 'gemini'
      ? await viaGemini(sourceImage, prompt)
      : await viaDoubao(sourceImage, prompt);
  return { dataUrl, provider };
}
