/**
 * 贴纸预览确认框。
 *
 * 流程：上传照片 → 本地 AI 抠图 → 这里看效果、调风格 → 确认后才收进背包。
 *
 * 因为抠图只做了一次，换风格只是在本地重算几百毫秒，
 * 所以这里可以放心给滑块：拖一拖就换一版，不联网也不用重新识别主体。
 */
import { useEffect, useRef, useState } from 'react';
import { paintSticker, finalizeExternal, type PreparedPhoto, type StickerStyle } from '../utils/stickerAI';
import { aiRestyle, aiProviderReady, type AiProvider } from '../utils/aiRestyle';

interface StickerPreviewProps {
  prepared: PreparedPhoto;
  /** 确认：把最终的贴纸图交出去 */
  onConfirm: (dataUrl: string) => void;
  /** 重新选一张照片 */
  onRetry: () => void;
  onDiscard: () => void;
}

type Mode = StickerStyle | 'whole';

const STYLE_TABS: { id: Mode; label: string; hint: string }[] = [
  { id: 'watercolor', label: '抠主体·淡彩', hint: '自动分离主体，画成水彩贴纸' },
  { id: 'original', label: '抠主体·原色', hint: '只去掉背景，保留照片原样' },
  { id: 'whole', label: '整张贴纸', hint: '不抠图，整张裁成圆角贴纸（适合一堆积木、风景、画作）' },
];

export default function StickerPreview({ prepared, onConfirm, onRetry, onDiscard }: StickerPreviewProps) {
  const [mode, setMode] = useState<Mode>('watercolor');
  const [wash, setWash] = useState(0.5);
  const [ink, setInk] = useState(0.45);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(true);

  /** 序号：只认最后一次请求的结果，避免快速拖滑块时旧结果覆盖新结果 */
  const seq = useRef(0);

  /** AI 重绘：本地滤镜改不了"这张图是怎么画的"，要真正像插画只能让模型重绘一次 */
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiTag, setAiTag] = useState('');
  const [aiReady] = useState(() => aiProviderReady('gemini') || aiProviderReady('doubao'));

  const runAiRestyle = async () => {
    setAiError('');
    setAiBusy(true);
    const order = (['gemini', 'doubao'] as AiProvider[]).filter(aiProviderReady);
    if (!order.length) {
      setAiError('没有可用的 AI Key（Gemini 或豆包）');
      setAiBusy(false);
      return;
    }

    let lastErr = '';
    for (const provider of order) {
      try {
        const { dataUrl, provider: used } = await aiRestyle(prepared.source, provider);
        const sticker = await finalizeExternal(dataUrl);
        setResult(sticker);
        setAiTag(used === 'gemini' ? 'Gemini 重绘' : '豆包重绘');
        setAiBusy(false);
        return;
      } catch (err) {
        lastErr = (err as Error).message || 'AI 重绘失败';
      }
    }
    setAiError(lastErr);
    setAiBusy(false);
  };

  useEffect(() => {
    const mine = ++seq.current;
    setBusy(true);

    // 小防抖：拖滑块时不必每一帧都算
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const url = await paintSticker(prepared, {
            style: mode === 'original' ? 'original' : 'watercolor',
            whole: mode === 'whole',
            wash,
            ink,
          });
          if (mine === seq.current) setResult(url);
        } catch (err) {
          console.warn('[sticker] 出图失败', err);
        } finally {
          if (mine === seq.current) setBusy(false);
        }
      })();
    }, 140);

    return () => window.clearTimeout(timer);
  }, [prepared, mode, wash, ink]);

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

        <h3 className="sticker-preview__title">看看这张贴纸</h3>
        <p className="sticker-preview__sub">
          {mode === 'whole' ? '整张照片裁成圆角贴纸，背景保留' : '主体已自动分离，背景透明'}
        </p>

        <div className="sticker-preview__stage">
          {result ? (
            <img
              src={result}
              alt="生成的贴纸预览"
              style={{ opacity: busy ? 0.45 : 1, transition: 'opacity 0.18s ease' }}
            />
          ) : (
            <span className="sticker-preview__loading">正在出图…</span>
          )}
        </div>

        <div className="sticker-preview__styles" role="tablist" aria-label="贴纸模式">
          {STYLE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              className={`sticker-preview__style${mode === tab.id ? ' is-active' : ''}`}
              onClick={() => setMode(tab.id)}
              title={tab.hint}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode !== 'original' && (
          <div className="sticker-preview__knobs">
            <label className="sticker-preview__knob">
              <span>水彩浓度</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={wash}
                onChange={(e) => setWash(Number(e.target.value))}
              />
              <em>{wash <= 0.3 ? '浓' : wash >= 0.75 ? '很淡' : '适中'}</em>
            </label>
            <label className="sticker-preview__knob">
              <span>钢笔线</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ink}
                onChange={(e) => setInk(Number(e.target.value))}
              />
              <em>{ink <= 0.15 ? '不要线' : ink >= 0.75 ? '重' : '适中'}</em>
            </label>
          </div>
        )}

        <div className="sticker-preview__ai">
          <button
            type="button"
            className="sticker-preview__ai-btn"
            onClick={runAiRestyle}
            disabled={aiBusy}
          >
            {aiBusy ? 'AI 正在画…（10–30 秒）' : '✨ 让 AI 重画一版'}
          </button>
          {aiTag && !aiBusy && <span className="sticker-preview__ai-tag">来自 {aiTag}</span>}
          {aiError && !aiBusy && <span className="sticker-preview__ai-err">{aiError}</span>}
        </div>

        <div className="sticker-preview__actions">
          <button
            type="button"
            className="sticker-preview__primary"
            onClick={() => result && onConfirm(result)}
            disabled={!result || busy}
          >
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
