import { useMemo, useRef } from 'react';
import GlobeStage from './GlobeStage';
import type { PinItem, WorkItem } from '../types';

interface ToonDeskProps {
  pins: PinItem[];
  works: WorkItem[];
  globeOpen: boolean;
  /** 地球仪放大时是否显示关闭按钮（有弹窗时让位给弹窗） */
  globeChrome: boolean;
  activeTargetCoord: { lat: number; lon: number } | null;
  newlyDroppedPinId: string | null;
  onToggleGlobe: () => void;
  onPinAnchor: (at: { x: number; y: number } | null) => void;
  onSelectPin: (pin: PinItem) => void;
  onOpenUpload: () => void;
  onOpenNote: () => void;
  onOpenAlbum: () => void;
  onOpenStudio: () => void;
  /** 回到原来那片 3D 草坪场景 */
  onBackToLawn: () => void;
}

/**
 * 绘本课桌 · 纯 CSS 三渲二桌面
 *
 * 与草坪场景的区别：不加载 WebGL，整套立体感靠 2px 墨线 + 实体切面阴影
 * 和一张 12° 微俯角的桌面撑起来，首屏没有建场景的等待。
 *
 * 三个物件都接了真实动作，不做假弹窗：地球仪 → 放大真球；手帐 → 教案实录；
 * 展架 → 成果相册。台面上的数字取自实际数据，不是写死的样例。
 */
export default function ToonDesk({
  pins,
  works,
  globeOpen,
  globeChrome,
  activeTargetCoord,
  newlyDroppedPinId,
  onToggleGlobe,
  onPinAnchor,
  onSelectPin,
  onOpenUpload,
  onOpenNote,
  onOpenAlbum,
  onOpenStudio,
  onBackToLawn,
}: ToonDeskProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);

  const noteCount = useMemo(() => works.filter((w) => w.role === 'TEACHER').length, [works]);
  const albumCount = useMemo(() => works.filter((w) => w.role === 'STUDENT').length, [works]);
  // works 恒为新在前，取第一份学生成果当作展架上的那张拍立得
  const latest = useMemo(() => works.find((w) => w.role === 'STUDENT') ?? null, [works]);

  return (
    <>
      <div className="tdk">
        <div className="tdk__aura" aria-hidden="true" />

        <header className="tdk__header">
          <div className="tdk__brand">
            <span className="tdk__brand-parent">行智开物</span>
            <span className="tdk__brand-divider">/</span>
            <span className="tdk__brand-sub">童眼看世界 · 工作台</span>
          </div>

          <p className="tdk__tip">点击课桌上的物件，开启今日探索</p>

          <div className="tdk__actions">
            <button type="button" className="toon-btn toon-btn-pink toon-btn--sm" onClick={onOpenUpload}>
              上传课题
            </button>
            <button type="button" className="toon-btn toon-btn-sage toon-btn--sm" onClick={onOpenStudio}>
              感官工作台
            </button>
            <button type="button" className="toon-btn toon-btn-ghost toon-btn--sm" onClick={onBackToLawn}>
              回到草坪
            </button>
          </div>
        </header>

        <div className="tdk__stage">
          <div className="tdk__surface">
            {/* 物件一：三渲二地球仪 */}
            <button
              type="button"
              className="tdk__item"
              onClick={onToggleGlobe}
              aria-label={`打开地球仪，已落钉 ${pins.length} 处`}
            >
              <span className="tdk__tag">🌍 地方视野</span>
              <span className="tdk__globe-wrap">
                <span className="tdk__globe-stand" aria-hidden="true" />
                <span className="tdk__globe" aria-hidden="true">
                  <span className="tdk__continent tdk__continent--a" />
                  <span className="tdk__continent tdk__continent--b" />
                  <span className="tdk__glint" />
                </span>
                <span className="tdk__globe-base" aria-hidden="true" />
                {/* 真球从这儿落座：量这个空位的尺寸做进门动画 */}
                <span className="tdk__globe-slot" ref={slotRef} aria-hidden="true" />
              </span>
              <span className="tdk__label">主题探索 · 地球仪</span>
              <span className="tdk__meta tnum">{pins.length} 处已落钉</span>
            </button>

            {/* 物件二：教案实录手帐 */}
            <button
              type="button"
              className="tdk__item"
              onClick={onOpenNote}
              aria-label={`翻开教案实录手帐，共 ${noteCount} 篇`}
            >
              <span className="tdk__tag">📖 教学备课</span>
              <span className="tdk__notebook">
                <span className="tdk__bookmark tdk__bookmark--a">行</span>
                <span className="tdk__bookmark tdk__bookmark--b">智</span>
                <span className="tdk__bookmark tdk__bookmark--c">开物</span>
                <span className="tdk__cover">
                  <span className="tdk__stitch" aria-hidden="true" />
                  <span className="tdk__plate">
                    <span className="tdk__plate-icon" aria-hidden="true">✏️</span>
                    <span className="tdk__plate-text">教案实录</span>
                  </span>
                </span>
                <span className="tdk__pages" aria-hidden="true" />
              </span>
              <span className="tdk__label">思维模型 · 实录手帐</span>
              <span className="tdk__meta tnum">{noteCount} 篇实录</span>
            </button>

            {/* 物件三：学生成果展架（拍立得 + 和纸胶带） */}
            <button
              type="button"
              className="tdk__item"
              onClick={onOpenAlbum}
              aria-label={`浏览成果相册，共 ${albumCount} 份`}
            >
              <span className="tdk__tag">🎨 童眼大作</span>
              <span className="tdk__easel">
                <span className="tdk__tape" aria-hidden="true" />
                <span className="tdk__polaroid">
                  <span className="tdk__thumb">
                    {latest ? (
                      <span className="tdk__art">{latest.title}</span>
                    ) : (
                      <span className="tdk__art tdk__art--empty">等待第一份童眼作品</span>
                    )}
                  </span>
                  <span className="tdk__caption">
                    <span className="tdk__author">
                      {latest ? latest.author : '尚未落钉'}
                    </span>
                    <span className="tdk__pill">
                      {latest ? latest.district || latest.city : '空展架'}
                    </span>
                  </span>
                </span>
              </span>
              <span className="tdk__label">学生成果 · 灵感墙</span>
              <span className="tdk__meta tnum">{albumCount} 份成果</span>
            </button>

            {/* 桌面小物件：一支铅笔、一颗石子，给台面一点故事感 */}
            <div className="tdk__decor" aria-hidden="true">
              <span className="tdk__pencil" />
              <span className="tdk__pebble" />
            </div>
          </div>
        </div>
      </div>

      {/* 真球浮层：和草坪场景共用同一颗 */}
      <GlobeStage
        slotRef={slotRef}
        pins={pins}
        zoomed={globeOpen}
        chrome={globeChrome}
        activeTargetCoord={activeTargetCoord}
        newlyDroppedPinId={newlyDroppedPinId}
        onSelectPin={onSelectPin}
        onToggleZoom={onToggleGlobe}
        onPinAnchor={onPinAnchor}
        idleHidden
        chromeTone="toon"
      />
    </>
  );
}
