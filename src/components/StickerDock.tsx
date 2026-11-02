import { useRef } from 'react';
import { makePresetSticker, PRESET_STICKERS, presetLabel } from '../utils/stickerAssets';
import type { MySticker } from '../utils/stickerStore';

/**
 * 底部贴纸背包抽屉：
 *  - 「我的贴纸」：上传照片生成并确认收藏的自制贴纸，可点击贴上、可删除
 *  - 「预置贴纸」：内置的花草蝴蝶等素材
 *  - 上传入口：AI 识别主体 → 抠图 → 预览确认后入背包
 */
interface StickerDockProps {
  quota: number;
  /** 自制贴纸库 */
  library: MySticker[];
  onAddPreset: (name: string) => void;
  onAddMySticker: (stk: MySticker) => void;
  onRemoveMySticker: (id: string) => void;
  onUpload: (file: File) => void;
  onClose: () => void;
}

export default function StickerDock({
  quota,
  library,
  onAddPreset,
  onAddMySticker,
  onRemoveMySticker,
  onUpload,
  onClose,
}: StickerDockProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = () => {
    inputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onUpload(file);
  };

  return (
    <div className="sticker-dock">
      <div className="sticker-dock__head">
        <h3 className="sticker-dock__title">贴纸背包</h3>
        <button type="button" className="sticker-dock__close" onClick={onClose} aria-label="收起">
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {library.length > 0 && (
        <div className="sticker-dock__section">
          <h4 className="sticker-dock__label">我的贴纸 · {library.length}</h4>
          <div className="sticker-dock__presets">
            {library.map((s) => (
              <div key={s.id} className="sticker-dock__mine">
                <button
                  type="button"
                  className="sticker-dock__preset"
                  onClick={() => onAddMySticker(s)}
                  title="贴到花园"
                >
                  <img src={s.src} alt="我的贴纸" />
                </button>
                <button
                  type="button"
                  className="sticker-dock__del"
                  onClick={() => onRemoveMySticker(s.id)}
                  aria-label="从背包删除"
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticker-dock__section">
        <h4 className="sticker-dock__label">预置贴纸</h4>
        <div className="sticker-dock__presets">
          {PRESET_STICKERS.map((name) => (
            <button
              key={name}
              type="button"
              className="sticker-dock__preset"
              onClick={() => onAddPreset(name)}
            >
              <img src={makePresetSticker(name)} alt={presetLabel(name)} />
              <span>{presetLabel(name)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sticker-dock__upload">
        <button
          type="button"
          className="sticker-dock__upload-btn"
          onClick={pickFile}
          disabled={quota <= 0}
        >
          + 上传照片变贴纸
        </button>
        <span className="sticker-dock__quota">
          {quota > 0 ? `还剩 ${quota} 次 AI 上传` : '额度用完 · 完成任务可解锁'}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </div>
  );
}
