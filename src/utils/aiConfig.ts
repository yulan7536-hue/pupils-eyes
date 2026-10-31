/**
 * 大模型平台的「Key 与优先级」配置层。
 *
 * 设计目标：用户不必改代码、不必重新构建，直接在页面里粘贴 Key 就能用。
 * 读取顺序：浏览器 localStorage（页面内填写） → 构建期环境变量（.env.local）
 * 因此部署给别人用时，对方在自己浏览器里填一次即可，互不干扰。
 */

export type ProviderId = 'openrouter' | 'siliconflow' | 'zhipu' | 'dashscope' | 'pollinations' | 'gemini';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** 品牌简称，用于状态条上的小字 */
  short: string;
  /** 模型链，按尝试顺序 */
  models: string[];
  /** 免费政策说明，直接展示给用户 */
  freeNote: string;
  /** 申请 Key 的地址；无 Key 平台为空 */
  keyUrl?: string;
  /** 是否需要用户自己填 Key */
  keyless: boolean;
  /** 注册时不需要实名 / 企业认证，零门槛 */
  noVerify?: boolean;
  /** 注册门槛提示，例如「需个人实名」 */
  gate?: string;
  /** 粗粒度速度印象 */
  speed: '极快' | '快' | '中' | '慢';
  /** 环境变量名 */
  envKey?: string;
  /** 输入框占位提示 */
  keyHint?: string;
}

/**
 * 顺序即优先级。
 * 排序依据：先「能不能零门槛拿到 Key」，再「速度快不快」。
 * 国内实名平台延迟更低，但 OpenRouter 是唯一完全不需要认证的，所以放最前。
 */
export const PROVIDERS_META: ProviderMeta[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    short: 'OpenRouter',
    models: [
      // 官方「免费模型路由」：自动挑当前可用的免费模型，不会因为名单轮换而失效
      'openrouter/free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3.5-lightning:free',
      'google/gemma-4-26b-a4b-it:free',
    ],
    freeNote:
      '免费注册，邮箱 / GitHub / Google 登录即可，不绑卡、不实名、不需要企业认证。免费模型每天 50 次、每分钟 20 次。',
    keyUrl: 'https://openrouter.ai/keys',
    keyless: false,
    noVerify: true,
    speed: '快',
    envKey: 'VITE_OPENROUTER_API_KEY',
    keyHint: '形如 sk-or-v1-xxxxxxxx',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    short: '硅基',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen3-8B'],
    freeNote: '9B 以下小模型永久免费；新用户另送 2000 万 Token。国内节点，延迟极低。',
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
    keyless: false,
    gate: '需个人实名',
    speed: '极快',
    envKey: 'VITE_SILICONFLOW_API_KEY',
    keyHint: '形如 sk-xxxxxxxx',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    short: '智谱',
    models: ['glm-4.7-flash', 'glm-4-flash'],
    freeNote:
      'GLM-4-Flash 系本身永久免费，但部分账号在申请 Key 时会被要求企业认证；若卡在这一步，直接用上面的 OpenRouter。',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    keyless: false,
    gate: '可能需企业认证',
    speed: '快',
    envKey: 'VITE_ZHIPU_API_KEY',
    keyHint: '形如 xxxxxxxx.xxxxxxxx',
  },
  {
    id: 'dashscope',
    label: '阿里云百炼 Qwen',
    short: '百炼',
    models: ['qwen-turbo', 'qwen-flash'],
    freeNote: '每个模型赠送 100 万 Token，有效期 90 天。开通服务后创建 API Key 即可用。',
    keyUrl: 'https://bailian.console.aliyun.com/',
    keyless: false,
    gate: '需个人实名',
    speed: '快',
    envKey: 'VITE_DASHSCOPE_API_KEY',
    keyHint: '形如 sk-xxxxxxxx',
  },
  {
    id: 'pollinations',
    label: 'Pollinations（免 Key）',
    short: '免Key',
    models: ['openai-fast'],
    freeNote: '完全公开、无需注册。免费限额为每 IP 每 45 秒 1 次，约 20 秒出结果，适合演示与兜底。',
    keyUrl: 'https://pollinations.ai',
    keyless: true,
    noVerify: true,
    speed: '中',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    short: 'Gemini',
    models: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest'],
    freeNote: '有免费额度，但国内直连常被重置，速度不稳定，建议仅作备用。',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyless: false,
    speed: '慢',
    envKey: 'VITE_GEMINI_API_KEY',
    keyHint: '形如 AQ.xxxxxxxx',
  },
];

const STORE_KEY = 'pupils-eyes:ai-keys';

function readStore(): Partial<Record<ProviderId, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<ProviderId, string>>) : {};
  } catch {
    return {};
  }
}

function writeStore(next: Partial<Record<ProviderId, string>>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式下可能写不进去，忽略即可 */
  }
}

const clean = (v?: string) => (v ?? '').trim().replace(/^["']|["']$/g, '');

/** 取某个平台实际生效的 Key：页面内填写优先于构建期环境变量 */
export function getKey(id: ProviderId): string {
  const stored = clean(readStore()[id]);
  if (stored) return stored;
  const meta = PROVIDERS_META.find((p) => p.id === id);
  if (!meta?.envKey) return '';
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  return clean(env[meta.envKey]);
}

/** 保存/清除某个平台的 Key（传空字符串即清除） */
export function setKey(id: ProviderId, key: string) {
  const store = readStore();
  const v = clean(key);
  if (v) store[id] = v;
  else delete store[id];
  writeStore(store);
}

export type ProviderState = ProviderMeta & { ready: boolean; source: '' | 'local' | 'env' };

/** 给设置面板用：每个平台是否已就绪、Key 从哪来 */
export function providerStates(): ProviderState[] {
  const store = readStore();
  return PROVIDERS_META.map((meta) => {
    const key = getKey(meta.id);
    const fromLocal = Boolean(clean(store[meta.id]));
    return {
      ...meta,
      ready: Boolean(key),
      source: fromLocal ? 'local' : key ? 'env' : ('' as const),
    };
  });
}

/** 实际会按顺序尝试的平台（有 Key 的 + 免 Key 的） */
export function readyProviders(): ProviderId[] {
  return PROVIDERS_META.filter((p) => p.keyless || getKey(p.id)).map((p) => p.id);
}

/* ---------------- 失败短期记忆 ---------------- */

/**
 * 一个平台刚超时/报错，5 分钟内不再重试，避免每次上传都白等十几秒。
 * 只存在内存里，刷新页面即清空。
 */
const FAIL_TTL = 5 * 60 * 1000;
const failedAt = new Map<string, number>();

export function markFailed(key: string) {
  failedAt.set(key, Date.now());
}

export function isFailed(key: string): boolean {
  const t = failedAt.get(key);
  if (!t) return false;
  if (Date.now() - t > FAIL_TTL) {
    failedAt.delete(key);
    return false;
  }
  return true;
}

export function clearFailed(key?: string) {
  if (key) failedAt.delete(key);
  else failedAt.clear();
}
