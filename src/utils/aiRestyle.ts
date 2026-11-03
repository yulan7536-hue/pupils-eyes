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
 * Q 版卡通绘本风（治愈系儿童绘本角色）。
 *
 * 用户要「更卡通、和背景画风统一」。实测下来，之前的「钢笔淡彩」和
 * 「卡通童话绘本」两版都还是偏写实/淡彩，模型容易落回水彩方向。改成明确的
 * Q 版卡通：大头小身、大眼、夸张表情，配清晰描边 + 明快马卡龙色块，
 * 一眼就是绘本/贴纸里的卡通角色（用猫照片实测效果达标）。
 */
export const CHIBI_PROMPT = `把这张照片改画成 Q 版卡通角色，风格是治愈系儿童绘本里的卡通形象，气质和「钢笔淡彩童话小镇」插画统一：
1. 卡通比例：头放大、身体缩小、整体圆润 Q 萌，眼睛大而有神、表情夸张可爱、四肢短小。可以大幅卡通化变形，但保留主体可辨认的特征（猫的毛色花纹、耳朵形状、姿势）。
2. 勾线：清晰、稍粗、均匀流畅的深棕色轮廓线，像绘本和动画的描边，干净利落，不要密密麻麻的短线。
3. 上色：明亮的马卡龙纯色块（浅粉、奶油、薄荷绿、雾霾蓝、鹅黄、浅杏），色块边缘清晰，颜色比水彩更鲜艳明快，局部可有很淡的晕染。
4. 背景留白或极淡纯色，方便抠出主体。
整体要一眼就是 Q 版卡通角色，明显比写实插画更卡通、更可爱。不要照片质感、不要写实、不要厚涂、不要 3D、不要文字水印边框。`;

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
 * @param prompt      风格描述，默认 Q 版卡通
 */
export async function aiRestyle(
  sourceImage: string,
  prompt: string = CHIBI_PROMPT
): Promise<AiRestyleResult> {
  const dataUrl = await viaDoubao(sourceImage, prompt);
  return { dataUrl };
}
