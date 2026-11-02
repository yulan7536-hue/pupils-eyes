import { useEffect, useState } from 'react';
import ClayMotif, { motifFor } from './ClayMotif';
import RadarChart from './RadarChart';
import PhotoWall from './PhotoWall';
import type { WorkItem } from '../types';

interface WorkSheetProps {
  work: WorkItem;
  onClose: () => void;
  onLike: (id: string) => void;
  onComment: (id: string, text: string) => void;
}

/** 单份成果：从相册里抽出来的一张卡片 */
export default function WorkSheet({ work, onClose, onLike, onComment }: WorkSheetProps) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="veil veil--soft"
      role="dialog"
      aria-modal="true"
      aria-label={work.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className="veil__close" onClick={onClose} aria-label="收好这张卡片">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <article className="sheet">
        <div className="sheet__motif">
          <ClayMotif kind={motifFor(work.title)} />
        </div>

        <div className="sheet__body no-scrollbar">
          <h2 className="detail__title">{work.title}</h2>
          <div className="detail__meta">
            <span>{work.region}</span>
            <span>{work.school}</span>
            <span>
              {work.role === 'TEACHER' ? '执教' : '作者'} · {work.author}
            </span>
            <span>{work.date}</span>
          </div>

          <p className="prose">{work.content}</p>

          {/* 教师教案：六维智能雷达图 */}
          {work.role === 'TEACHER' && work.radar && (
            <div className="radar-wrap">
              <div className="radar-wrap__head">
                <span className="radar-wrap__title">教案六维智能雷达图</span>
              </div>
              <RadarChart analysis={work.radar} />
            </div>
          )}

          {/* 课题成果照片墙：老师和学生陆续传上来的现场照片，按这门课自动归在一起 */}
          <PhotoWall work={work} />

          <div className="note">
            {work.comments.map((c) => (
              <p className="note__item" key={c.id}>
                <span className="note__who">{c.user}</span>
                <span>{c.text}</span>
              </p>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="留一句话…"
                aria-label="写一条便签"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft.trim()) {
                    onComment(work.id, draft.trim());
                    setDraft('');
                  }
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!draft.trim()) return;
                  onComment(work.id, draft.trim());
                  setDraft('');
                }}
              >
                贴便签
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            background: 'var(--paper-2)',
          }}
        >
          <span className="tnum" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            已有 {work.likes} 人点亮
          </span>
          <button type="button" className="btn btn--rose" onClick={() => onLike(work.id)}>
            点亮这份成果
          </button>
        </div>
      </article>
    </div>
  );
}
