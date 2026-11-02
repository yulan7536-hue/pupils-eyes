import type { Role, WorkItem } from '../types';

/**
 * 云服务的"常量与纯函数"部分。
 *
 * 单独拆出来是因为这里一个 import 都不会把 SDK 拉进首屏包里：
 * 照片墙只在点开某门课之后才出现，主包不该替它背那 250KB。
 * SDK 本身在 cloudStore.ts 里，由 PhotoWall 按需 import。
 */

/**
 * endpoint 必须写死，不能从 location 推：
 * 站点可能挂在任何域名下，而数据面只认这一个来源域。
 */
export const PUBLIC_CONFIG = {
  endpoint: 'https://pupils-eyes.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_3uFQaZdmCfq2blcK1SFSm2_tss0O6FGF36rIP67hJfk1Mf0Z9K2FOnS',
} as const;

/** 站点是否跑在云服务授权的那个域上。不是的话所有云请求都会被网关按 Origin 拒掉。 */
export const CLOUD_ORIGIN = new URL(PUBLIC_CONFIG.endpoint).origin;

/**
 * 云端现在能不能连。
 *
 * 数据面按 Origin 白名单放行：pupils-eyes.app.workbuddy.host 和本地调试地址是通的，
 * 别的域名（比如 GitHub Pages）预检直接 403。与其让人看到一排加载失败的骨架屏，
 * 不如先问清楚自己站在哪，再决定是去拉数据还是给一句说明。
 */
const DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/;

export const cloudReachable = () =>
  typeof window !== 'undefined' &&
  (window.location.origin === CLOUD_ORIGIN || DEV_HOST.test(window.location.hostname));

/**
 * 主题键 = 省|市|区县|课题。
 *
 * 选"按课题"归类的道理：一颗图钉就是一门课，老师的教案和学生的成果本来就是同一门课
 * 的两端，只是不同时间、不同的人分别传上来的。把区县编进键里是为了两个区县恰好同名
 * 的课题不会并到一起；把课题名编进去则是为了让"安吉竹林听笋"和"安吉竹器手作"分开。
 * 传上来的照片不用人选主题，点开哪门课就落在哪门课里。
 */
export function themeKeyOf(work: Pick<WorkItem, 'province' | 'city' | 'district' | 'title'>) {
  return [work.province, work.city, work.district, work.title].join('|');
}

export interface ThemePhoto {
  id: string;
  themeKey: string;
  themeTitle: string;
  district: string;
  caption: string | null;
  uploader: string;
  role: Role;
  /** data:image/webp;base64,… —— 直接当 img src 用 */
  imageData: string;
  createdAt: string;
}
