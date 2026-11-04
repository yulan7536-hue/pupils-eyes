import { useEffect, useRef, useState } from 'react';
import { makePresetSticker, PRESET_STICKERS, presetLabel } from '../utils/stickerAssets';
import type { MySticker } from '../utils/stickerStore';
import type { Model3DItem } from '../utils/modelStore';
import { listPublicStickers, markStickerUsed, type PublicSticker } from '../utils/stickerCloud';
import { useAuth } from '../auth/useAuth';

/**
 * 底部贴纸背包抽屉：
 *  - 「3D 摆件」：照片经 Seed3D 生成的立体模型，可点击摆进花园、可删除
 *  - 「我的贴纸」：上传照片 AI 抠图后确认收藏的平面贴纸，可点击贴上、可删除
 *  - 「预置贴纸」：内置花草蝴蝶等素材
 *  - 两个入口：抠图贴纸（几秒）、3D 摆件（3–10 分钟）
 */
interface StickerDockProps {
  quota: number;
  /** 平面贴纸素材库 */
  library: MySticker[];
  /** 已生成的 3D 摆件 */
  models: Model3DItem[];
  onAddPreset: (name: string) => void;
  onAddMySticker: (stk: MySticker) => void;
  onRemoveMySticker: (id: string) => void;
  /** 公开 / 取消公开自己的贴纸 */
  onTogglePublish: (id: string) => void;
  /** 正在发布的那一张，用来显示 loading */
  publishingId?: string | null;
  /** 把公共素材库里的贴纸贴进自己花园 */
  onAddPublicSticker: (src: string, remoteId: string) => void;
  onAddModel: (item: Model3DItem) => void;
  onRemoveModel: (id: string) => void;
  onUpload: (file: File) => void;
  onUpload3D: (file: File) => void;
  onClose: () => void;
  /** 抠图模型是否已缓存到本地；false 时提示首次要下载 */
  modelReady?: boolean;
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function StickerDock({
  quota,
  library,
  models,
  onAddPreset,
  onAddMySticker,
  onRemoveMySticker,
  onTogglePublish,
  publishingId = null,
  onAddPublicSticker,
  onAddModel,
  onRemoveModel,
  onUpload,
  onUpload3D,
  onClose,
  modelReady = true,
}: StickerDockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const input3dRef = useRef<HTMLInputElement>(null);
  const { status } = useAuth();

  // 公共素材库：谁都能看（公开读），所以不等登录
  const [publics, setPublics] = useState<PublicSticker[]>([]);
  const [pubLoading, setPubLoading] = useState(true);
  const [pubErr, setPubErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPubLoading(true);
    listPublicStickers()
      .then((list) => {
        if (alive) {
          setPublics(list);
          setPubErr(null);
        }
      })
      .catch((err) => {
        if (alive) setPubErr(err instanceof Error ? err.message : '素材库暂时取不到');
      })
      .finally(() => {
        if (alive) setPubLoading(false);
      });
    return () => {
      alive = false;
    };
    // 自己刚发布/撤下之后要重拉一次
  }, [library, publishingId]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onUpload(file);
  };

  const onFile3dChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onUpload3D(file);
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

      {models.length > 0 && (
        <div className="sticker-dock__section">
          <h4 className="sticker-dock__label">3D 摆件 · {models.length}</h4>
          <p className="sticker-dock__hint">模型文件较大，只保存在这台设备上</p>
          <div className="sticker-dock__presets">
            {models.map((m) => (
              <div key={m.id} className="sticker-dock__mine">
                <button
                  type="button"
                  className="sticker-dock__preset sticker-dock__model"
                  onClick={() => onAddModel(m)}
                  title="摆进花园"
                >
                  {m.thumb ? (
                    <img className="sticker-dock__thumb" src={m.thumb} alt="3D 摆件预览" />
                  ) : (
                    <span className="sticker-dock__cube" aria-hidden="true" />
                  )}
                  <span>{mb(m.bytes)}</span>
                </button>
                <button
                  type="button"
                  className="sticker-dock__del"
                  onClick={() => onRemoveModel(m.id)}
                  aria-label="删除 3D 摆件"
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {library.length > 0 && (
        <div className="sticker-dock__section">
          <h4 className="sticker-dock__label">我的贴纸 · {library.length}</h4>
          <p className="sticker-dock__hint">点「公开」会放进公共素材库，别人可以拿去用</p>
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

                {status === 'authed' && (
                  <button
                    type="button"
                    className={`sticker-dock__pub${s.isPublic ? ' is-on' : ''}`}
                    onClick={() => onTogglePublish(s.id)}
                    disabled={publishingId === s.id}
                    title={s.isPublic ? '取消公开' : '公开给所有人用'}
                  >
                    {publishingId === s.id ? '···' : s.isPublic ? '已公开' : '公开'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticker-dock__section">
        <h4 className="sticker-dock__label">公共素材库 · {publics.length}</h4>
        <p className="sticker-dock__hint">大家公开的贴纸，点一下就能贴进自己的花园</p>
        {pubErr && <p className="sticker-dock__hint">{pubErr}</p>}
        {pubLoading && publics.length === 0 && <p className="sticker-dock__hint">正在取素材…</p>}
        {!pubLoading && !pubErr && publics.length === 0 && (
          <p className="sticker-dock__hint">还没有人公开贴纸，你可以做第一个</p>
        )}
        {publics.length > 0 && (
          <div className="sticker-dock__presets">
            {publics.map((s) => (
              <button
                key={s.id}
                type="button"
                className="sticker-dock__preset"
                title={`${s.title || '贴纸'} · 已被使用 ${s.useCount} 次`}
                onClick={() => {
                  void markStickerUsed(s.id);
                  onAddPublicSticker(s.src, s.id);
                }}
              >
                <img src={s.src} alt={s.title || '公共贴纸'} />
                <span className="tnum">{s.useCount > 0 ? `用 ${s.useCount}` : '新'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
        <div className="sticker-dock__upload-group">
          <button
            type="button"
            className="sticker-dock__upload-btn"
            onClick={() => inputRef.current?.click()}
            disabled={quota <= 0}
          >
            + 照片变贴纸
          </button>
          <button
            type="button"
            className="sticker-dock__upload-btn sticker-dock__upload-btn--3d"
            onClick={() => input3dRef.current?.click()}
            disabled={quota <= 0}
          >
            + 照片变 3D 摆件
          </button>
          <span className="sticker-dock__quota">
            {quota > 0 ? `还剩 ${quota} 次 AI 上传` : '额度用完 · 完成任务可解锁'}
          </span>
        </div>
        <span className="sticker-dock__tip">
          {modelReady
            ? '3D 生成约 3–10 分钟，可以先关掉背包逛花园'
            : '首次使用需下载智能抠图模型（约 56MB），下完就秒开；现在正在后台下载'}
        </span>
      </div>

      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
      <input ref={input3dRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile3dChange} />
    </div>
  );
}
