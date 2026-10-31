import { useEffect, useMemo, useState } from 'react';
import ClayMotif, { motifFor } from './ClayMotif';
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const select = (id: string) => {
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

  /* ---------------- 相册页 ---------------- */

  // 成果左右两页均分，缺的位置用"待收录"占位：
  // 像一本真的相册那样留着相角，而不是让某一页整页空白
  const half = Math.ceil(list.length / 2);
  const slotsFor = (n: number) => (n <= 2 ? 2 : 4);

  const placeholder = (key: string) => (
    <div className="tile tile--empty" key={key} aria-hidden="true">
      <span className="tile__well">
        <span className="tile__plus">+</span>
      </span>
      <span className="tile__cap tile__cap--empty">待收录</span>
    </div>
  );

  const albumPage = (items: WorkItem[], side: 'l' | 'r', total: number) => (
    <div className="page__inner">
      <div className="page__head">
        {side === 'l' ? (
          <h2 className="page__book">《学生成果展示》</h2>
        ) : (
          <h2 className="page__book page__book--soft">学生成果 · 续</h2>
        )}
        <span className="page__count tnum">
          {side === 'l' ? '一' : '二'} · 共 {total} 份
        </span>
      </div>
      <div className="page__body page__body--album no-scrollbar">
        <div className="grid">
          {items.map((w) => (
            <button
              key={w.id}
              type="button"
              className="tile"
              onClick={() => {
                storySound.playPinDrop();
                onOpenWork(w);
              }}
            >
              <span className="tile__well">
                <ClayMotif kind={motifFor(w.title)} />
              </span>
              <span className="tile__cap">{w.title}</span>
              <span className="tile__sub">
                {w.region.split('·').pop()} · {w.author}
              </span>
            </button>
          ))}
          {Array.from({ length: Math.max(0, slotsFor(items.length) - items.length) }, (_, i) =>
            placeholder(`${side}-gap-${i}`)
          )}
        </div>
      </div>
      <div className="page__foot">行影 · 学生成果</div>
    </div>
  );

  const albumLeft = albumPage(list.slice(0, half), 'l', list.length);
  const albumRight = albumPage(list.slice(half), 'r', list.length);

  const left = isNote ? noteIndex : albumLeft;
  const right = isNote ? noteDetail : albumRight;

  return (
    <div
      className="veil"
      role="dialog"
      aria-modal="true"
      aria-label={isNote ? '教案实录手账' : '学生成果展示'}
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

      <div className="spread">
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
            <div className="page page--single">{panel === 'l' ? left : right}</div>
            <div className="pager pager--float">
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setPanel('l')}
                disabled={panel === 'l'}
              >
                {isNote ? '目录' : '上一页'}
              </button>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setPanel('r')}
                disabled={panel === 'r'}
              >
                {isNote ? '正文' : '下一页'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
