import type { RefObject } from 'react';

interface DeskProps {
  noteCount: number;
  albumCount: number;
  onOpenNote: () => void;
  onOpenAlbum: () => void;
  /** 地球仪的落座位置由这个占位元素量出来 */
  globeSlotRef: RefObject<HTMLDivElement | null>;
}

/** 卷号补零：4 篇 → Vol. 04 */
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 正面平视的绘本长凳：台面受光层 + 木料切面厚度 + 两条凳腿。
 * 三件物品并排立在长凳上：教案手账 / 地球仪 / 成果相册。
 * 长凳与封面都走"2px 墨线 + 实体切面"的插画语言，与背后的黏土草坪分工。
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
            aria-label={`翻开《教案实录手账》 Pedagogical Chronicle，共 ${noteCount} 篇教学实录`}
          >
            <span className="book__pages" aria-hidden="true" />
            <span className="book__cover">
              <span className="book__spine" aria-hidden="true" />
              <span className="book__plate">
                <span className="book__label">《教案实录手账》</span>
                <span className="book__en" aria-hidden="true">
                  Pedagogical Chronicle
                </span>
                <span className="book__foot">
                  <span>教学实录 {noteCount} 篇</span>
                  <span>· Vol. {pad2(noteCount)}</span>
                </span>
              </span>
            </span>
          </button>

          {/* 中：地球仪的落座占位 */}
          <div className="globe-slot" ref={globeSlotRef} />

          {/* 右：《学生成果展示》 */}
          <button
            type="button"
            className="book book--album"
            onClick={onOpenAlbum}
            aria-label={`翻开《学生成果展示》 Creative Portfolio，共 ${albumCount} 份成果`}
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
                <span className="book__en" aria-hidden="true">
                  Creative Portfolio
                </span>
                <span className="book__foot">
                  <span>成果相册 {albumCount} 份</span>
                  <span>· Folio {pad2(albumCount)}</span>
                </span>
              </span>
            </span>
          </button>
        </div>

        <div className="desk__top" aria-hidden="true" />
        {/* 展签刻在长凳正面：真球的支架与底座一直伸到球座底部，
            贴在球下面的字会被铜架压掉，挪到木板上反而像博物馆的藏品牌 */}
        <div className="desk__edge" aria-hidden="true">
          <span className="bench-plate">
            <span className="bench-plate__cn">地方视野 · 乡土探索</span>
            <span className="bench-plate__en" lang="en">
              Local Landscapes &amp; Horizons
            </span>
          </span>
        </div>

        <div className="desk__legs" aria-hidden="true">
          <div className="desk__shadow" />
          <div className="desk__leg desk__leg--fl" />
          <div className="desk__leg desk__leg--fr" />
        </div>
      </div>
    </div>
  );
}
