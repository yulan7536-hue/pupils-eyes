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
}

export interface LocationChoice {
  province: string;
  city: string;
  district: string;
  lat: number;
  lon: number;
  locationString: string;
}
