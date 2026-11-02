/** 全局数据契约：图钉、成果、提交载荷。原先散落在各个组件里，统一到这里。 */

export type Role = 'TEACHER' | 'STUDENT';

export interface PinItem {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  school: string;
  desc: string;
  author?: string;
  role?: Role;
  date?: string;
}

export interface Comment {
  id: string;
  user: string;
  text: string;
  time: string;
}

export interface WorkItem {
  id: string;
  region: string;
  province: string;
  city: string;
  district: string;
  lat: number;
  lon: number;
  title: string;
  role: Role;
  school: string;
  author: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  digitalResourceUrl?: string;
  date: string;
  likes: number;
  comments: Comment[];
  /**
   * 这份成果是否在地球仪上被点亮。
   * 点了「点亮这份成果」之后写 true，球面那盏小灯就亮起来；跟着 works 一起存本地。
   */
  lit?: boolean;
  /** AI 教案解析结果：教师上传后由 analyzeLesson 生成，学生成果为 undefined */
  radar?: RadarAnalysis;
}

/** 表单提交载荷（不含点赞与评论，由 App 补齐） */
export interface SubmissionPayload {
  id: string;
  region: string;
  province: string;
  city: string;
  district: string;
  lat: number;
  lon: number;
  title: string;
  role: Role;
  school: string;
  author: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  digitalResourceUrl?: string;
  date: string;
  /** 教师教案：可选的初始雷达分析（规则引擎即时兜底），真 AI 结果稍后异步覆盖 */
  radar?: RadarAnalysis;
}

export interface LocationChoice {
  province: string;
  city: string;
  district: string;
  lat: number;
  lon: number;
  locationString: string;
}

/* ---------------- AI 教案解析：六维智能雷达图 ---------------- */

/** 六维雷达图的 6 个固定维度（顺序即雷达图的顶点顺序，不可变） */
export const RADAR_DIMENSIONS = [
  '具身感知度',
  '思维建模深度',
  '人机协同创造',
  '跨学科融合度',
  '地域文化连接',
  '方案成果可行性',
] as const;

export type RadarDimension = (typeof RADAR_DIMENSIONS)[number];

/** 单个维度的解析结果：0-100 评分 + 量规描述 + AI 对本篇教案的亮点解析 */
export interface RadarAxis {
  dimension: RadarDimension;
  score: number; // 0-100
  rubric: string; // 该维度的评价量规标准
  highlight: string; // AI 针对本篇教案在该维度下的亮点解析
}

export interface RadarAnalysis {
  axes: RadarAxis[]; // 长度恒为 6，顺序与 RADAR_DIMENSIONS 一致
  summary: string; // 一段整体点评
  source: 'ai' | 'heuristic'; // ai = 真大模型解析；heuristic = 本地规则兜底
  generatedAt: string;
  /** source 为 ai 时，记录实际生效的模型名，界面上要显示「谁解析的」 */
  model?: string;
  /** 该模型本次解析耗时（毫秒） */
  latencyMs?: number;
}
