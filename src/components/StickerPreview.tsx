/**
 * AI 抠图结果的预览确认框。
 *
 * 流程：上传照片 → AI 识别主体并抠图 → 这里先给用户看结果，
 * 确认后才收进「我的贴纸」背包（不确认就丢弃，不会污染素材库）。
 * 预览用棋盘格衬底，透明区域一眼可辨。
 */
interface StickerPreviewProps {
  /** 生成好的贴纸图（透明背景 dataURL） */
  src: string;
  onConfirm: () => void;
  /** 重新选一张照片 */
  onRetry: () => void;
  onDiscard: () => void;
}

export default function StickerPreview({ src, onConfirm, onRetry, onDiscard }: StickerPreviewProps) {
  return (
    <div className="sticker-preview" role="dialog" aria-modal="true" aria-label="贴纸预览">
      <div className="sticker-preview__card">
        <button
          type="button"
          className="sticker-preview__close"
          onClick={onDiscard}
          aria-label="关闭"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <h3 className="sticker-preview__title">抠好啦，看看这张贴纸</h3>
        <p className="sticker-preview__sub">AI 已自动认出主体，背景已经去掉</p>

        <div className="sticker-preview__stage">
          <img src={src} alt="生成的贴纸预览" />
        </div>

        <div className="sticker-preview__actions">
          <button type="button" className="sticker-preview__primary" onClick={onConfirm}>
            收进贴纸背包
          </button>
          <button type="button" className="sticker-preview__ghost" onClick={onRetry}>
            换一张照片
          </button>
        </div>
      </div>
    </div>
  );
}
