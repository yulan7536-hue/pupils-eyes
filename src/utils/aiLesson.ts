import { RADAR_DIMENSIONS, type RadarAnalysis, type RadarAxis, type RadarDimension } from '../types';
import {
  PROVIDERS_META,
  getKey,
  isFailed,
  markFailed,
  type ProviderId,
} from './aiConfig';

/**
 * AI 教案解析服务层。
 * 目标：把一段教案实录文本，解析成「行智开物 · 教案六维智能雷达图」。
 *
 * 平台优先级（见 aiConfig.ts 的 PROVIDERS_META，顺序即优先级）：
 *  1) OpenRouter —— 唯一完全零门槛：邮箱/GitHub 登录即可，不实名、不绑卡、不要企业认证
 *  2) 硅基流动 Qwen2.5-7B / Qwen3-8B —— 9B 以下永久免费，国内节点延迟极低（需个人实名）
 *  3) 智谱 GLM-4.7-Flash / GLM-4-Flash —— 永久免费，但部分账号申请时要企业认证
 *  4) 阿里云百炼 Qwen —— 每模型 100 万 Token / 90 天（需个人实名）
 *  5) Pollinations —— 完全免 Key、公开可用，限额每 IP 45 秒 1 次
 *  6) Google Gemini —— 有免费额度但国内直连不稳定，仅作备用
 *  7) 本地规则引擎 —— 不联网、零延迟，任何情况下都能出图
 *
 * 两个关键体验设计：
 *  · 规则引擎先出图（毫秒级），大模型结果回来后再覆盖，教师不用盯着转圈等
 *  · 某个平台刚失败过，5 分钟内直接跳过，避免每次上传都白等十几秒
 */

/* ---------------- 请求构造 ---------------- */

interface BuiltRequest {
  url: string;
  init: RequestInit;
  /** 该平台的超时毫秒数 */
  timeout: number;
}

const SYS = '你是严谨的课程评阅专家，只输出 JSON，不要任何解释性文字。';

const chatBody = (model: string, prompt: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    model,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    stream: false,
    ...extra,
  });

function buildRequest(id: ProviderId, model: string, key: string, prompt: string): BuiltRequest {
  switch (id) {
    case 'openrouter':
      return {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            // OpenRouter 建议带上来源标识，便于它做路由与限流
            'HTTP-Referer': typeof location !== 'undefined' ? location.origin : 'http://localhost:3000',
            'X-Title': 'pupils-eyes',
          },
          body: chatBody(model, prompt),
        },
        timeout: 25_000,
      };

    case 'dashscope':
      return {
        url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: chatBody(model, prompt),
        },
        timeout: 20_000,
      };

    case 'zhipu':
      return {
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: chatBody(model, prompt),
        },
        timeout: 20_000,
      };

    case 'siliconflow':
      return {
        url: 'https://api.siliconflow.cn/v1/chat/completions',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          // Qwen3 默认带思考链，会拖慢 3-5 倍；这里显式关掉
          body: chatBody(model, prompt, model.startsWith('Qwen/Qwen3') ? { enable_thinking: false } : {}),
        },
        timeout: 20_000,
      };

    case 'pollinations':
      return {
        url: 'https://text.pollinations.ai/openai',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: chatBody(model, prompt, { max_tokens: 1200 }),
        },
        timeout: 45_000,
      };

    case 'gemini':
      return {
        // 新式 AQ. Key 必须用 ?key= 查询参数；用 x-goog-api-key 头会 404
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${SYS}\n\n${prompt}` }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
          }),
        },
        timeout: 12_000,
      };
  }
}

function readText(id: ProviderId, data: unknown): string {
  if (id === 'gemini') {
    const d = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  }
  const d = data as { choices?: { message?: { content?: string; reasoning?: string } }[] };
  const msg = d.choices?.[0]?.message;
  // 少数推理型模型会把结果塞进 reasoning，正文为空，做一次兜底
  return msg?.content || msg?.reasoning || '';
}

/* ---------------- 六维量规 ---------------- */

export const RADAR_RUBRICS: Record<RadarDimension, string> = {
  具身感知度: '学生是否通过身体、多感官的直接参与建立对事物的第一手感知——触摸、观察、倾听、移动与操作，而非停留在纸面或屏幕的抽象认知。',
  思维建模深度: '是否引导学生把零散观察提炼为可解释的模型或因果链条——用变量、结构、流程把现象抽象出来，并据此做出预测与验证。',
  人机协同创造: '是否恰当地引入数字工具或机器作为协作伙伴——数据采集、可视化、建模、生成，让技术成为放大而非替代创造力的手段。',
  跨学科融合度: '是否打破单一学科边界，在科学、技术、工程、艺术、人文之间形成有机勾连，服务于同一个真实问题。',
  地域文化连接: '是否扎根本地自然与人文资源，把地方物产、民俗、技艺、生态转化为真实而有归属感的学习情境。',
  方案成果可行性: '方案是否具备可落地的实施路径——材料可得、步骤清晰、时间可调度、成果可展示与可迁移，而非停留在设想。',
};

/* ---------------- 规则引擎兜底 ---------------- */

interface KwGroup {
  dim: RadarDimension;
  kws: string[];
  base: number;
}

const KW_GROUPS: KwGroup[] = [
  { dim: '具身感知度', kws: ['触摸', '观察', '探访', '采集', '动手', '实践', '听诊', '拓印', '测量', '体验', '感官', '闻', '捏', '画', '走', '走访', '实地', '操作', '实验'], base: 62 },
  { dim: '思维建模深度', kws: ['结构', '模型', '因果', '变量', '预测', '验证', '对比', '分析', '推理', '假设', '数据', '原理', '规律', '关系', '曲线', '参数', '分类', '归纳'], base: 60 },
  { dim: '人机协同创造', kws: ['数字', '平板', '传感器', '程序', '编程', 'AI', '智能', '软件', '3D', '建模', '拍摄', '录制', '微纪录片', '资源包', '可视化', '算法', '剪辑', '扫描'], base: 58 },
  { dim: '跨学科融合度', kws: ['跨学科', '融合', '工程', '科学', '美育', '艺术', '语文', '数学', '音乐', '劳动', '信息', '综合', 'STEAM', '学科', '美术', '写作', '日记'], base: 58 },
  { dim: '地域文化连接', kws: ['本土', '本地', '家乡', '社区', '胡同', '竹林', '茶园', '果园', '湿地', '秦岭', '洱海', '民俗', '非遗', '传统', '地方', '物候', '老', '竹', '手艺', '校园'], base: 58 },
  { dim: '方案成果可行性', kws: ['实施', '步骤', '材料', '工具', '时间', '安排', '分组', '成果', '展示', '评价', '反思', '目标', '任务', '流程', '收尾', '分钟', '课时'], base: 60 },
];

function contentRigor(text: string): number {
  let v = 0;
  if (/【[^】]+】/.test(text)) v += 6;
  if (/\d+[、.．]\s*/.test(text)) v += 6;
  if (/反思|评价|小结|延伸/.test(text)) v += 5;
  if (/分钟|课时|学时/.test(text)) v += 5;
  if (text.length > 260) v += 5;
  return v;
}

function heuristicAnalyze(text: string): RadarAnalysis {
  const rigor = contentRigor(text);
  const axes: RadarAxis[] = RADAR_DIMENSIONS.map((dim) => {
    const g = KW_GROUPS.find((k) => k.dim === dim)!;
    const hits = g.kws.filter((k) => text.includes(k)).length;
    let score = Math.min(96, Math.round(g.base + hits * 7 + rigor * 0.4));
    score = Math.max(34, score);
    const matched = g.kws.filter((k) => text.includes(k)).slice(0, 3);
    const highlight = matched.length
      ? `本篇教案在「${matched.join('、')}」等环节有明显着墨，${dim}得到扎实体现；若再补足结构化的反思与迁移设计，还能更上一层。`
      : `本篇教案在${dim}上的直接证据较少，建议补充相关实践环节，让这一维度不再停留在设想。`;
    return { dimension: dim, score, rubric: RADAR_RUBRICS[dim], highlight };
  });

  const top = [...axes].sort((a, b) => b.score - a.score)[0];
  const summary = `整体来看，这篇教案在「${top.dimension}」上表现最突出（${top.score} 分）。当前为本地规则引擎的初步解析，接入大模型后可获得更贴合语境的量化与点评。`;

  return { axes, summary, source: 'heuristic', generatedAt: new Date().toISOString() };
}

/* ---------------- 真 AI 解析 ---------------- */

const SYSTEM_PROMPT = `你是「行智开物」课程的教案评阅专家。请对用户提供的教案实录，围绕以下 6 个固定维度做量化评估：
1 具身感知度 2 思维建模深度 3 人机协同创造 4 跨学科融合度 5 地域文化连接 6 方案成果可行性。

严格只输出一个 JSON 对象，不要任何多余文字或 Markdown 代码块，格式如下：
{
  "axes": [
    {"dimension": "具身感知度", "score": 82, "highlight": "针对本篇教案在该维度的亮点解析，一句话到两句话"},
    ...共 6 项，dimension 顺序与上面 1-6 完全一致
  ],
  "summary": "一段 60 字以内的整体点评"
}
score 为 0-100 整数。`;

function parseAiJson(raw: string): Omit<RadarAnalysis, 'source' | 'generatedAt'> {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型未返回 JSON');
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
    axes: { dimension: string; score: number; highlight: string }[];
    summary: string;
  };
  if (!Array.isArray(obj.axes)) throw new Error('JSON 缺少 axes');

  const axes: RadarAxis[] = RADAR_DIMENSIONS.map((dim) => {
    const found = obj.axes.find((a) => a.dimension === dim) ?? obj.axes[RADAR_DIMENSIONS.indexOf(dim)];
    if (!found) throw new Error(`缺少维度 ${dim}`);
    const score = Math.max(0, Math.min(100, Math.round(Number(found.score) || 0)));
    return {
      dimension: dim,
      score,
      rubric: RADAR_RUBRICS[dim],
      highlight: String(found.highlight || '').slice(0, 200),
    };
  });

  return { axes, summary: String(obj.summary || '').slice(0, 160) };
}

/** 单次调用：带超时，超时/报错都抛出，由上层切下一个平台 */
async function callProvider(
  id: ProviderId,
  model: string,
  prompt: string
): Promise<{ text: string; model: string }> {
  const key = getKey(id);
  const { url, init, timeout } = buildRequest(id, model, key, prompt);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${id}/${model} ${res.status}: ${detail.slice(0, 140)}`);
    }
    const data: unknown = await res.json();
    const text = readText(id, data);
    if (!text) throw new Error(`${id}/${model} 返回为空`);
    // OpenRouter 的 openrouter/free 是路由模型，真实执行的是别的模型，取回来显示
    const actual = (data as { model?: string }).model;
    return { text, model: actual || model };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- 结果缓存：同一份教案不重复花额度 ---------------- */

const cache = new Map<string, RadarAnalysis>();
const CACHE_MAX = 24;

const fingerprint = (text: string) => `${text.length}:${text.slice(0, 64)}:${text.slice(-64)}`;

/* ---------------- 对外入口 ---------------- */

export interface AnalyzeOptions {
  /** 是否允许调用大模型。false 则只跑规则引擎（节约免费额度） */
  useAi?: boolean;
  /** 大模型成功返回时回调，用于在界面上显示「本次由哪个模型解析」 */
  onProvider?: (label: string, ms: number) => void;
  /** 正在尝试哪个平台时回调，便于界面提示「正在用智谱识别」 */
  onTrying?: (label: string) => void;
}

export interface AiAttempt {
  provider: string;
  ok: boolean;
  ms: number;
  error?: string;
}

/**
 * 依次尝试所有可用平台，返回首个成功结果。
 * 已配置 Key 的平台按优先级在前，免 Key 平台在后。
 */
async function aiAnalyze(
  text: string,
  opts: AnalyzeOptions
): Promise<{ analysis: Omit<RadarAnalysis, 'source' | 'generatedAt'>; label: string; model: string; ms: number }> {
  const prompt = `${SYSTEM_PROMPT}\n\n教案实录如下：\n"""\n${text.slice(0, 12000)}\n"""`;

  const chain = PROVIDERS_META.filter((meta) => meta.keyless || getKey(meta.id));
  if (chain.length === 0) throw new Error('未配置任何模型平台');

  let lastErr: unknown = null;

  for (const meta of chain) {
    for (const model of meta.models) {
      const failKey = `${meta.id}:${model}`;
      if (isFailed(failKey)) {
        lastErr = lastErr ?? new Error(`${meta.label} 刚失败过，暂时跳过`);
        continue;
      }

      opts.onTrying?.(`${meta.label} · ${model.replace(/^.*\//, '')}`);
      const t0 = performance.now();
      try {
        const { text: raw, model: usedModel } = await callProvider(meta.id, model, prompt);
        const analysis = parseAiJson(raw);
        const ms = Math.round(performance.now() - t0);
        const displayName = usedModel.replace(/^.*\//, '');
        console.info(`[aiLesson] ${meta.label} · ${usedModel} · ${ms}ms`);
        return { analysis, label: meta.label, model: displayName, ms };
      } catch (err) {
        markFailed(failKey);
        lastErr = err;
        console.warn(`[aiLesson] ${meta.label}/${model} 失败：`, err);
      }
    }
  }

  throw lastErr ?? new Error('所有平台均不可用');
}

export async function analyzeLesson(
  text: string,
  opts: AnalyzeOptions = {}
): Promise<RadarAnalysis> {
  const trimmed = text.trim();
  if (!trimmed) return heuristicAnalyze('');
  if (opts.useAi === false) return heuristicAnalyze(trimmed);

  const fp = fingerprint(trimmed);
  const cached = cache.get(fp);
  if (cached) {
    opts.onProvider?.(cached.model ?? '缓存', cached.latencyMs ?? 0);
    return cached;
  }

  try {
    const { analysis, model, ms } = await aiAnalyze(trimmed, opts);
    const result: RadarAnalysis = {
      ...analysis,
      source: 'ai',
      model,
      latencyMs: ms,
      generatedAt: new Date().toISOString(),
    };
    opts.onProvider?.(model, ms);

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(fp, result);
    return result;
  } catch (err) {
    console.warn('[aiLesson] 大模型解析失败，回退规则引擎：', err);
    return heuristicAnalyze(trimmed);
  }
}

/** 同步的规则引擎入口：给「浏览已有教案但尚未解析」的场景即时兜底 */
export function analyzeLessonSync(text: string): RadarAnalysis {
  return heuristicAnalyze(text);
}

/** 设置面板里的连通性自测：只问一句话，返回耗时 */
export async function testProvider(id: ProviderId): Promise<{ ok: boolean; ms: number; detail: string }> {
  const meta = PROVIDERS_META.find((p) => p.id === id)!;
  const t0 = performance.now();
  try {
    const { text: raw, model } = await callProvider(id, meta.models[0], '请只回复两个字：可用');
    return {
      ok: Boolean(raw),
      ms: Math.round(performance.now() - t0),
      detail: `${model} · ${raw.trim().slice(0, 30) || '空响应'}`,
    };
  } catch (err) {
    return {
      ok: false,
      ms: Math.round(performance.now() - t0),
      detail: err instanceof Error ? err.message.slice(0, 120) : '未知错误',
    };
  }
}
