import { useMemo, useState } from 'react';
import type { Task } from '../types';
import { TASK_DEFS, claimTask, loadTasks } from '../utils/stickerStore';

/**
 * 任务中心「魔法手账」：每日任务列表 + 领取奖励结算动画。
 * 完成任务 → 点「领取」→ 额度 +1 并弹出星星结算；未领取的任务在入口亮红点。
 */
interface TaskCenterProps {
  onClose: () => void;
  /** 领取奖励后回调，把最新额度同步回场景 HUD */
  onQuotaChange: (quota: number) => void;
}

export default function TaskCenter({ onClose, onQuotaChange }: TaskCenterProps) {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [reward, setReward] = useState<{ id: string; title: string } | null>(null);

  const iconOf = (id: string) => TASK_DEFS.find((d) => d.id === id)?.icon ?? '⭐';

  const claimable = useMemo(
    () => tasks.filter((t) => t.progress >= t.goal && !t.claimed).length,
    [tasks]
  );

  const handleClaim = (t: Task) => {
    const newQuota = claimTask(t.id);
    setTasks(loadTasks());
    onQuotaChange(newQuota);
    setReward({ id: t.id, title: t.title });
    window.setTimeout(() => setReward(null), 1800);
  };

  return (
    <div className="task-center" role="dialog" aria-modal="true" aria-label="任务中心">
      <div className="task-center__card">
        <header className="task-center__head">
          <div>
            <h3 className="task-center__title">魔法手账</h3>
            <p className="task-center__sub">完成任务，攒更多贴纸额度</p>
          </div>
          <button type="button" className="task-center__close" onClick={onClose} aria-label="关闭">
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <ul className="task-center__list">
          {tasks.map((t) => {
            const done = t.progress >= t.goal;
            const claimed = t.claimed;
            return (
              <li
                key={t.id}
                className={`task-item${done ? ' is-done' : ''}${claimed ? ' is-claimed' : ''}`}
              >
                <span className="task-item__icon" aria-hidden="true">
                  {iconOf(t.id)}
                </span>
                <div className="task-item__body">
                  <span className="task-item__title">{t.title}</span>
                  <span className="task-item__desc">{t.desc}</span>
                </div>
                <div className="task-item__right">
                  {claimed ? (
                    <span className="task-item__claimed">已领取</span>
                  ) : done ? (
                    <button type="button" className="task-item__claim" onClick={() => handleClaim(t)}>
                      领取 +1
                    </button>
                  ) : (
                    <span className="task-item__progress">
                      {t.progress}/{t.goal}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="task-center__foot">
          {claimable > 0
            ? `还有 ${claimable} 份奖励等你领取`
            : '今天的小任务都完成啦，明天再来'}
        </footer>
      </div>

      {/* 领取奖励结算动画 */}
      {reward && (
        <div className="task-reward" key={reward.id}>
          <div className="task-reward__burst" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="task-reward__star" style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>
          <div className="task-reward__text">
            <strong>+1 贴纸额度</strong>
            <span>已完成 · {reward.title}</span>
          </div>
        </div>
      )}
    </div>
  );
}
