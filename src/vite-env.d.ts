/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OpenRouter —— 唯一零门槛通道：邮箱/GitHub 登录即可，不实名、不绑卡、无需企业认证 */
  readonly VITE_OPENROUTER_API_KEY?: string;
  /** 硅基流动 —— 9B 以下小模型长期免费（需个人实名） */
  readonly VITE_SILICONFLOW_API_KEY?: string;
  /** 智谱 AI —— GLM-Flash 系免费，但部分账号申请时需企业认证 */
  readonly VITE_ZHIPU_API_KEY?: string;
  /** 阿里云百炼 —— 每模型 100 万 Token / 90 天（需个人实名） */
  readonly VITE_DASHSCOPE_API_KEY?: string;
  /** Google Gemini —— 备用通道 */
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
