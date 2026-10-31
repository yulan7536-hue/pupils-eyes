import { RADAR_DIMENSIONS, type RadarAnalysis, type RadarAxis, type RadarDimension } from '../types';

/**
 * AI 教案解析服务层。
 * 目标：把一段教案实录文本，解析成「行智开物 · 教案六维智能雷达图」。
 *
 * 策略：
 *  1) 若配置了 GEMINI_API_KEY（Vite 会把 import.meta.env.VITE_GEMINI_API_KEY 暴露给前端），
 *     走真大模型解析，返回 JSON。
 *  2) 没有 Key、或请求失败、或超时，回退到本地规则引擎（关键词/句式加权打分），
 *     保证「上传 → 生成雷达图」这条链路任何情况下都不会断。
 *
 * 说明：纯前端 SPA 直连 Gemini 存在密钥暴露风险，生产环境建议改用后端代理；
 * 这里先用 import.meta.env 注入，便于演示与本地联调。
 */

const MODEL = 'gemini-3.8-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** 六个维度的量规描述（评价标准原文，独立于 AI，保持稳定） */
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
  base: number; // 命中少量关键词时的基础分
}

const KW_GROUPS: KwGroup[] = [
  { dim: '具身感知度', kws: ['触摸', '观察', '探访', '采集', '动手', '实践', '听诊', '拓印', '测量', '体验', '感官', '闻', '捏', '画', '走'], base: 62 },
  { dim: '思维建模深度', kws: ['结构', '模型', '因果', '变量', '预测', '验证', '对比', '分析', '推理', '假设', '数据', '原理', '规律', '关系'], base: 60 },
  { dim: '人机协同创造', kws: ['数字', '平板', '传感器', '程序', '编程', 'AI', '智能', '软件', '3D', '建模', '拍摄', '录制', '微纪录片', '资源包', '可视化'], base: 58 },
  { dim: '跨学科融合度', kws: ['跨学科', '融合', '工程', '科学', '美育', '艺术', '语文', '数学', '音乐', '劳动', '信息', '综合', 'STEAM', '学科'], base: 58 },
  { dim: '地域文化连接', kws: ['本土', '本地', '家乡', '社区', '胡同', '竹林', '茶园', '果园', '湿地', '秦岭', '洱海', '民俗', '非遗', '传统', '地方', '物候', '老'], base: 58 },
  { dim: '方案成果可行性', kws: ['实施', '步骤', '材料', '工具', '时间', '安排', '分组', '成果', '展示', '评价', '反思', '目标', '任务', '流程', '收尾'], base: 60 },
];

/** 教案越具体（数字步骤、明确目标、反思），整体分越高 */
function contentRigor(text: string): number {
  let v = 0;
  if (/【[^】]+】/.test(text)) v += 6; // 用了结构化小标题
  if (/\d+[、.．]\s*/.test(text)) v += 6; // 编号步骤
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
    // 命中越多越高，上限 96，下限保底 34，避免全 0 或全 100
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
  // 模型偶尔会包一层 ```json，先剥掉
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const json = cleaned.slice(start, end + 1);
  const obj = JSON.parse(json) as {
    axes: { dimension: string; score: number; highlight: string }[];
    summary: string;
  };

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

async function aiAnalyze(text: string): Promise<Omit<RadarAnalysis, 'source' | 'generatedAt'>> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error('未配置 VITE_GEMINI_API_KEY');

  // 直接走 REST 端点（AQ. 前缀的新式 Key 与较新的模型都以此为准），
  // 避免 SDK 的默认 apiVersion 与新模型名不兼容。
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n教案实录如下：\n"""\n${text.slice(0, 4000)}\n"""` }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!raw) throw new Error('AI 返回为空');
  return parseAiJson(raw);
}

/* ---------------- 对外入口 ---------------- */

export async function analyzeLesson(text: string): Promise<RadarAnalysis> {
  const trimmed = text.trim();
  if (!trimmed) return heuristicAnalyze('');

  try {
    const result = await aiAnalyze(trimmed);
    return { ...result, source: 'ai', generatedAt: new Date().toISOString() };
  } catch (err) {
    console.warn('[aiLesson] 大模型解析失败，回退规则引擎：', err);
    return heuristicAnalyze(trimmed);
  }
}

/** 同步的规则引擎入口：给「浏览已有教案但尚未解析」的场景即时兜底 */
export function analyzeLessonSync(text: string): RadarAnalysis {
  return heuristicAnalyze(text);
}
