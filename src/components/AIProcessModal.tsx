import type { CSSProperties } from 'react';

/**
 * AI 处理中的强制等待模态框。
 * 显示阶段文案 + 进度条（0–100%）。进度由 stylizeImage 的回调驱动，
 * 豆包生成期间停在 40% 左右，这里用平滑动画 + 呼吸光点提示「仍在工作」。
 */
interface AIProcessModalProps {
  progress: number;
  stage: string;
  onCancel: () => void;
}

export default function AIProcessModal({ progress, stage, onCancel }: AIProcessModalProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="ai-modal" role="dialog" aria-modal="true" aria-label="正在处理贴纸">
      <div className="ai-modal__card">
        <div className="ai-modal__spark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h3 className="ai-modal__title">正在把它变成贴纸</h3>
        <p className="ai-modal__stage">{stage}</p>

        <div className="ai-modal__bar">
          <div
            className="ai-modal__bar-fill"
            style={{ '--p': `${pct}%` } as CSSProperties}
          />
        </div>
        <div className="ai-modal__pct">{pct}%</div>

        <button type="button" className="ai-modal__cancel" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
