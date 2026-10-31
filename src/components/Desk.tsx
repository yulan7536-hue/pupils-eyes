import type { RefObject } from 'react';

interface DeskProps {
  noteCount: number;
  albumCount: number;
  onOpenNote: () => void;
  onOpenAlbum: () => void;
  /** 地球仪的落座位置由这个占位元素量出来 */
  globeSlotRef: RefObject<HTMLDivElement | null>;
}

/**
 * 正面平视的 3D 黏土书桌：桌板 + 板材厚度 + 四条腿（后腿更短更暗，交代进深）。
 * 三件套并排站在桌板上：教案本 / 地球仪 / 成果相册。
 */
export default function Desk({
  noteCount,
  albumCount,
  onOpenNote,
  onOpenAlbum,
  globeSlotRef,
}: DeskProps) {
  return (
    <div className="desk-stage">
      <div className="desk">
        <div className="desk__items">
          {/* 左：《教案实录手账》 */}
          <button
            type="button"
            className="book book--note"
            onClick={onOpenNote}
            aria-label={`翻开《教案实录手账》，共 ${noteCount} 篇教学实录`}
          >
            <span className="book__pages" aria-hidden="true" />
            <span className="book__cover">
              <span className="book__spine" aria-hidden="true" />
              <span className="book__plate">
                <span className="book__label">《教案实录手账》</span>
              </span>
              <span className="book__foot">
                <span>教学实录</span>
                <span className="tnum">{noteCount} 篇</span>
              </span>
            </span>
          </button>

          {/* 中：地球仪的落座占位 */}
          <div className="globe-slot" ref={globeSlotRef} aria-hidden="true" />

          {/* 右：《学生成果展示》 */}
          <button
            type="button"
            className="book book--album"
            onClick={onOpenAlbum}
            aria-label={`翻开《学生成果展示》，共 ${albumCount} 份成果`}
          >
            <span className="book__pages" aria-hidden="true" />
            <span className="book__cover">
              <span className="book__spine" aria-hidden="true" />
              <span className="corner corner--tl" aria-hidden="true" />
              <span className="corner corner--tr" aria-hidden="true" />
              <span className="corner corner--bl" aria-hidden="true" />
              <span className="corner corner--br" aria-hidden="true" />
              <span className="book__plate">
                <span className="book__label">《学生成果展示》</span>
              </span>
              <span className="book__foot">
                <span>成果相册</span>
                <span className="tnum">{albumCount} 份</span>
              </span>
            </span>
          </button>
        </div>

        <div className="desk__top" aria-hidden="true" />
        <div className="desk__edge" aria-hidden="true" />

        <div className="desk__legs" aria-hidden="true">
          <div className="desk__shadow" />
          <div className="desk__leg desk__leg--fl" />
          <div className="desk__leg desk__leg--fr" />
        </div>
      </div>
    </div>
  );
}
