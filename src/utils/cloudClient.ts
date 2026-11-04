import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';
import { PUBLIC_CONFIG } from './cloudConfig';

/**
 * 全站唯一的云客户端。
 *
 * SDK 内部持有当前登录态，必须单例：建两个实例会出现「这边登录了、那边还是匿名」，
 * 表现为写入被 RLS 拦掉却看不出原因。所以这里单独一层，认证、数据库、存储都从这里取。
 *
 * publishableKey 只标识「是哪个应用」，服务端按 Origin 校验，随前端发布是安全的；
 * 真正有权限的东西（豆包 Key、后台口令）一律在服务端。
 */
export const cloud = createWorkBuddyCloud({ ...PUBLIC_CONFIG });
