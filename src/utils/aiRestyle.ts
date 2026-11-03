/**
 * AI 重绘：把照片真正"画"成插画（而不是加滤镜）。
 *
 * 本地滤镜无论怎么调，都只能改颜色、改质感、加描边，改不了"这张图是怎么画的"。
 * 参考图那种一笔笔勾出来的卡通角色，必须让模型理解画面内容后重新绘制，滤镜做不到。
 *
 * 只有豆包一条通道。原来还接了 Gemini 2.5 Flash Image，已移除：
 * 国内访问不了 Google（返回 User location is not supported），免费额度也经常用完，
 * 留着只会把豆包的真实失败原因覆盖成「Gemini 额度用完」，反而误导排查。
 * 豆包失败时调用方回落到本地引擎。
 */

const DOUBAO_MODEL = 'doubao-seedream-5-0-flash-260915';
const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

/**
 * 写实水彩绘本风（照片的真实形体 + 水彩的上色技法）。
 *
 * 这条 prompt 是五版迭代的最终收敛点，每一步都被用户否过一次：
 * - 「钢笔淡彩」「卡通童话绘本」→ 偏写实插画，但描线太满。
 * - 「Q 版卡通 + 马卡龙纯色块」→ 卡通到位，用户嫌「太卡通」、像矢量贴纸。
 * - 「透明水彩 + 手绘勾线」→ 直接画成水彩写生，连背景百叶窗都画上，没法做贴纸。
 * - 「卡通造型 + 水彩上色」→ 水彩好看，但眼睛和头身比还是被放大了。
 * 最终版把两件事拆开：**形体按照片真实比例走，水彩只负责上色和笔触**，
 * 并且明确要求背景留白、主体之外的杂物不画，出图才能直接抠成贴纸。
 */
export const WATERCOLOR_PROMPT = `把这张照片画成一幅手绘水彩插画，风格是治愈系儿童绘本插图：
1. 造型：按照片的真实比例和姿态来画，神态自然。只做温和的简化——把零碎的细节概括成干净的形状，轮廓圆润柔和，保留主体可辨认的特征（毛色花纹、耳朵形状、姿势）。眼睛保持真实大小，不要放大成卡通大眼。
2. 线条：细而轻的棕灰色铅笔或细墨水线，只在结构转折处勾几笔，有轻重提按；不要描满全身、不要粗黑描边。
3. 上色：透明水彩，薄涂、多层叠色，同一颜色有深浅渐变；色块边缘自然晕开，留出水痕和纸白缝隙，暗部有颜料沉积。颜色清透柔和（浅赭、橘黄、雾霾蓝、薄荷、浅粉）。
4. 背景：大面积纸白留白，最多一层极淡的水彩晕染，主体之外的杂物不要画，方便抠出主体。
整体是一幅手绘水彩插画：写实的形体 + 水彩的笔触和透光感，比照片柔和，比卡通更接近真实。不要大头小身、不要夸张大眼、不要纯色块平涂、不要矢量贴纸感、不要照片质感、不要厚涂、不要 3D、不要文字水印边框。`;

export interface AiRestyleResult {
  dataUrl: string;
}

function doubaoKey(): string {
  const env = (import.meta.env as unknown as Record<string, string | undefined>).VITE_DOUBAO_API_KEY;
  if (typeof window !== 'undefined') {
    try {
      const local = window.localStorage.getItem('pupils-eyes:doubao-key');
      if (local) return local.trim();
    } catch {
      /* 隐私模式下读不到，忽略 */
    }
  }
  return (env ?? '').trim();
}

/** 有没有配置豆包 Key（真实可用性要调用才知道） */
export function hasDoubaoKey(): boolean {
  return Boolean(doubaoKey());
}

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
   * 优先走同源 /generate（dev 用 vite 中间件，线上用 server.js / Vercel function），
   * 静态托管（GitHub Pages）没有这个后端会 404，那就退回直连。
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
    // 部署平台的网关会拦截指向火山方舟的代理请求，返回这段 zti 错误。
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

/**
 * 用 AI 重绘一张贴纸。
 *
 * @param sourceImage 输入图（dataURL，建议用抠图前的原图，信息量最全）
 * @param prompt      风格描述，默认写实水彩
 */
export async function aiRestyle(
  sourceImage: string,
  prompt: string = WATERCOLOR_PROMPT
): Promise<AiRestyleResult> {
  const dataUrl = await viaDoubao(sourceImage, prompt);
  return { dataUrl };
}
