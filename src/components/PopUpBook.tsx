import { useRef, useState } from 'react';
import ClayMotif, { motifFor } from './ClayMotif';
import type { WorkItem } from '../types';
import { storySound } from '../utils/sound';

interface PopUpBookProps {
  works: WorkItem[]; // 学生成果
  onOpenWork: (work: WorkItem) => void;
}

/**
 * CSS 3D 照片立体书（Pop-up Book）。
 * 摒弃平面网格：成果照片卡以底边为轴 rotateX(-85deg)→0 折起，
 * 前后多层纸片（后景背景卡 / 中景成果照 / 前景小花草折纸）随鼠标晃动产生视差。
 */

const FRONT_FRILLS = [
  { left: '6%', bottom: '6%', s: 0.9, rot: -8 },
  { left: '88%', bottom: '8%', s: 0.7, rot: 10 },
  { left: '14%', bottom: '14%', s: 0.55, rot: 4 },
];

export default function PopUpBook({ works, onOpenWork }: PopUpBookProps) {
  const [page, setPage] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const PER_PAGE = 3;
  const pageCount = Math.max(1, Math.ceil(works.length / PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = works.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTilt({ x: -ny * 6, y: nx * 8 });
    });
  };

  const onLeave = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTilt({ x: 0, y: 0 });
  };

  const go = (dir: 1 | -1) => {
    storySound.playPaperTurn();
    setPage((p) => Math.min(pageCount - 1, Math.max(0, p + dir)));
  };

  const open = (w: WorkItem) => {
    storySound.playPinDrop();
    onOpenWork(w);
  };

  return (
    <div className="popup" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div
        className="popup__spread"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.18s ease-out',
        }}
      >
        {/* 后景：课题背景卡 */}
        <div className="popup__bg" aria-hidden="true" />

        {/* 中景：立起的学生成果照片卡 */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(slice.length, 3)}, 1fr)` }}>
          {slice.map((w, i) => (
            <button
              key={w.id}
              type="button"
              className="popup__card"
              style={{ animationDelay: `${i * 0.12}s`, ['--tilt' as string]: `${-4 + i * 2}deg` }}
              onClick={() => open(w)}
            >
              <span className="popup__frame">
                <span className="popup__media">
                  <ClayMotif kind={motifFor(w.title)} />
                </span>
                <span className="popup__crease" aria-hidden="true" />
              </span>
              <span className="popup__cap">{w.title}</span>
              <span className="popup__sub tile__sub">
                {w.region.split('·').pop()} · {w.author}
              </span>
            </button>
          ))}
        </div>

        {/* 前景：小花草折纸 */}
        {FRONT_FRILLS.map((f, i) => (
          <svg
            key={i}
            className="popup__frill"
            viewBox="0 0 40 52"
            aria-hidden="true"
            style={{
              left: f.left,
              bottom: f.bottom,
              width: `calc(var(--u) * ${2.6 * f.s})`,
              height: `calc(var(--u) * ${3.4 * f.s})`,
              transform: `translateX(-50%) translateZ(50px) rotate(${f.rot}deg)`,
            }}
          >
            <path d="M20 52 C 20 40 20 32 20 24" stroke="#5f8f3d" strokeWidth="2.6" strokeLinecap="round" />
            {[0, 72, 144, 216, 288].map((deg) => (
              <ellipse key={deg} cx="20" cy="14" rx="5.2" ry="8" fill="#f8f3da" transform={`rotate(${deg} 20 20)`} />
            ))}
            <circle cx="20" cy="20" r="4" fill="#ecc96b" />
          </svg>
        ))}
      </div>

      {/* 翻页控制 + 下载入口 */}
      <div className="popup__nav">
        <span className="popup__nav-meta tnum">
          第 {safePage + 1} / {pageCount} 页 · 共 {works.length} 份
        </span>
        <div className="popup__nav-actions">
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => go(-1)}
            disabled={safePage === 0}
          >
            上一页
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => go(1)}
            disabled={safePage >= pageCount - 1}
          >
            下一页
          </button>
          <a
            className="btn btn--rose"
            href={slice[0]?.digitalResourceUrl ?? '#download'}
            onClick={(e) => {
              if (!slice[0]?.digitalResourceUrl) {
                e.preventDefault();
                storySound.playChime();
              }
            }}
          >
            下载资源包
          </a>
        </div>
      </div>
    </div>
  );
}
