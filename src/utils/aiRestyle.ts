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
 * 钢笔淡彩（Line and Wash）风格描述。
 * 与上一版「扁平数码插画」（大块平涂 + 均匀描边）的关键区别：
 * 线条是速写式的细线（断笔、轻重顿挫），颜色是透出纸白的薄水彩，留白多。
 * 写成模型容易照做的分条指令，并显式排除平涂/厚涂，避免模型落回扁平滑向。
 */
export const LINE_WASH_PROMPT = `把这张照片重新绘制成【钢笔淡彩 Line and Wash】手绘插画，务必和扁平平涂插画拉开明显差距：
1. 线稿：用纤细、带有随性手绘感的深棕色墨水线条，密集勾勒出主体的全部轮廓和细节（毛发纹理、衣纹褶皱、五官、叶脉、花纹、结构转折）。线条要有轻重顿挫和断笔，像速写，不要均匀、不要僵硬、不要电脑描边。
2. 上色：在线稿上薄薄地叠水彩，颜料极淡、几乎透明，能透出纸白；配色用马卡龙粉彩（浅粉、奶油白、淡薄荷绿、雾霾蓝、鹅黄、浅杏色）。
3. 留白：大面积留白，主体周围和受光面保留纸白，不要把颜色填满、不要大块平涂。
4. 保留原图的构图、主体外形和关键特征，不要改变主体是什么东西。
5. 整体是治愈系童话绘本质感，像儿童插画或明信片，透视不必精确，略带童趣和适度夸张。
6. 背景简化为淡淡的色块或直接留白，方便后续抠出主体。
不要照片质感、不要厚涂、不要 3D 渲染、不要文字、不要水印、不要边框。`;

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
  prompt: string = LINE_WASH_PROMPT
): Promise<AiRestyleResult> {
  const dataUrl =
    provider === 'gemini'
      ? await viaGemini(sourceImage, prompt)
      : await viaDoubao(sourceImage, prompt);
  return { dataUrl, provider };
}
