import { useEffect, useMemo, useRef, useState } from 'react';
import RadarChart from './RadarChart';
import PopUpBook from './PopUpBook';
import type { WorkItem } from '../types';
import { storySound } from '../utils/sound';

interface BookSpreadProps {
  book: 'note' | 'album';
  works: WorkItem[];
  onClose: () => void;
  onOpenWork: (work: WorkItem) => void;
}

function useWide() {
  const [wide, setWide] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 900px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/**
 * 摊开的书：点击桌面上的书之后，整本书放大到铺满屏幕并翻开。
 * 背景由 .veil 的高斯模糊接管，只剩中间摊开的两页。
 */
export default function BookSpread({ book, works, onClose, onOpenWork }: BookSpreadProps) {
  const wide = useWide();
  const isNote = book === 'note';

  const list = useMemo(
    () => works.filter((w) => (isNote ? w.role === 'TEACHER' : w.role === 'STUDENT')),
    [works, isNote]
  );

  const [activeId, setActiveId] = useState(() => list[0]?.id ?? '');
  const [flip, setFlip] = useState(0);
  const [panel, setPanel] = useState<'l' | 'r'>('l');

  const active = list.find((w) => w.id === activeId) ?? list[0];

  // 换篇之后把正文卷回顶部：滚动容器是复用的，不重置会接着上一篇的位置往下读
  const spreadRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    spreadRef.current?.querySelectorAll('.page__body').forEach((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
  }, [activeId]);

  useEffect(() => {
    // 相册由 PopUpBook 自己接管键盘与滚动锁（它要配合折平动画再关闭）
    if (!isNote) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, isNote]);

  const select = (id: string) => {
    // 窄屏只摊开一页：点目录条目必须同时把页面翻到正文，否则点了跟没点一样。
    // 放在最前面，点当前这一条也能从目录翻进正文。
    setPanel('r');
    if (id === activeId) return;
    storySound.playPaperTurn();
    setActiveId(id);
    setFlip((f) => f + 1);
  };

  /* ---------------- 左页 ---------------- */

  const noteIndex = (
    <div className="page__inner">
      <div className="page__head">
        <h2 className="page__book">《教案实录手账》</h2>
        <span className="page__count tnum">{list.length} 篇</span>
      </div>
      <div className="page__body no-scrollbar">
        {list.map((w) => (
          <button
            key={w.id}
            type="button"
            className="entry"
            aria-current={w.id === active?.id}
            onClick={() => select(w.id)}
          >
            <span className="entry__meta">
              <span>{w.region}</span>
              <span>·</span>
              <span>{w.author}</span>
            </span>
            <span className="entry__title">{w.title}</span>
          </button>
        ))}
        {list.length === 0 && <p className="prose">这本手账还空着。</p>}
      </div>
      <div className="page__foot">行智开物 · 教学实录</div>
    </div>
  );

  const noteDetail = active ? (
    <div className="page__inner">
      <div className="page__head">
        <h2 className="page__book">第 {list.findIndex((w) => w.id === active.id) + 1} 篇</h2>
        <span className="page__count">{active.date}</span>
      </div>
      <div className="page__body no-scrollbar">
        <h3 className="detail__title">{active.title}</h3>
        <div className="detail__meta">
          <span>{active.region}</span>
          <span>{active.school}</span>
          <span>执教 · {active.author}</span>
        </div>

        {/* AI 教案解析：六维智能雷达图 */}
        {active.radar ? (
          <div className="radar-wrap">
            <div className="radar-wrap__head">
              <span className="radar-wrap__title">行智开物 · 教案六维智能雷达图</span>
              <span className="radar-wrap__tag tnum">
                {active.radar.source === 'ai'
                  ? `${active.radar.model ?? 'AI'}${active.radar.latencyMs ? ` · ${(active.radar.latencyMs / 1000).toFixed(1)}s` : ''}`
                  : '规则引擎'}
              </span>
            </div>
            <RadarChart analysis={active.radar} />
          </div>
        ) : (
          <p className="prose">这篇教案还未生成六维雷达图。</p>
        )}

        <p className="prose">{active.content}</p>

        {active.comments.length > 0 && (
          <div className="note">
            {active.comments.map((c) => (
              <p className="note__item" key={c.id}>
                <span className="note__who">{c.user}</span>
                <span>{c.text}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="page__foot">行智开物 · 教学实录</div>
    </div>
  ) : (
    <div className="page__inner">
      <p className="prose">还没有收录这篇教案。</p>
    </div>
  );

  /* ---------------- 相册：整本交给 3D 立体书舞台 ---------------- */

  if (!isNote) {
    return <PopUpBook works={list} onClose={onClose} onOpenWork={onOpenWork} />;
  }

  const left = noteIndex;
  const right = noteDetail;

  return (
    <div
      className="veil veil--note"
      role="dialog"
      aria-modal="true"
      aria-label="教案实录手账"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className="veil__close" onClick={onClose} aria-label="合上书本">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M3 3l12 12M15 3L3 15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="spread" ref={spreadRef}>
        {wide ? (
          <>
            <div className="page page--l">{left}</div>
            <div className="page page--r">
              {right}
              {flip > 0 && <div className="flip" key={flip} />}
            </div>
            <div className="spread__spine" aria-hidden="true" />
          </>
        ) : (
          <>
            <div className="page page--single">
              {panel === 'l' ? left : right}
              {/* 单页模式翻页时也盖一张纸：从目录翻进正文要有"翻过去了"的手感 */}
              {panel === 'r' && flip > 0 && <div className="flip" key={flip} />}
            </div>
            <div className="pager pager--float">
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setPanel('l')}
                disabled={panel === 'l'}
              >
                {panel === 'r' ? '返回目录' : '目录'}
              </button>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setPanel('r')}
                disabled={panel === 'r'}
              >
                正文
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
