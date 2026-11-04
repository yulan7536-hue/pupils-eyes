import { useCallback, useEffect, useState } from 'react';
import {
  adminGetWork,
  adminList,
  adminReview,
  adminSetPassword,
  type AdminWork,
} from '../utils/adminStore';
import type { ReviewStatus } from '../utils/worksStore';

/**
 * 审核台。
 *
 * 左边是提交队列（按状态筛），右边是正文与配图，看完直接通过或驳回。
 * 驳回必须写理由——作者会原样看到这句话，所以它得是能指导修改的话，
 * 而不是「不符合要求」这种等于没说的。
 */
type Tab = ReviewStatus | '';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' },
  { key: '', label: '全部' },
];

const statusText: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

interface Props {
  password: string;
}

export default function AdminConsole({ password }: Props) {
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<AdminWork[]>([]);
  const [total, setTotal] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<(AdminWork & { image_data?: string | null }) | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await adminList(password, tab, 60, 0);
      setItems(res.items);
      setTotal(res.total);
      setActiveId((prev) => {
        if (prev && res.items.some((x) => x.id === prev)) return prev;
        return res.items[0]?.id ?? null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '读取失败');
    } finally {
      setLoading(false);
    }
  }, [password, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (activeId == null) {
      setDetail(null);
      return;
    }
    let alive = true;
    void adminGetWork(password, activeId)
      .then((d) => {
        if (alive) {
          setDetail(d);
          setNote('');
        }
      })
      .catch(() => {
        if (alive) setDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [password, activeId]);

  const review = async (status: ReviewStatus) => {
    if (activeId == null || busy) return;
    if (status === 'rejected' && !note.trim()) {
      setToast('驳回要写一句理由，作者会看到');
      return;
    }
    setBusy(true);
    try {
      await adminReview(password, activeId, status, note.trim());
      setToast(status === 'approved' ? '已通过，现在所有人可见' : '已驳回');
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const changePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) {
      setPassMsg('新口令至少 6 位');
      return;
    }
    try {
      await adminSetPassword(password, newPass);
      setPassMsg('已改好，下次进入请用新口令');
      setNewPass('');
    } catch (err2) {
      setPassMsg(err2 instanceof Error ? err2.message : '改口令失败');
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__brand">
          童眼成果墙 · 开发者后台
          <span className="admin__count tnum">{total} 条</span>
        </div>
        <div className="admin__tabs">
          {TABS.map((t) => (
            <button
              key={t.key || 'all'}
              type="button"
              className={`admin__tab${tab === t.key ? ' is-on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="admin__bar-right">
          <button type="button" className="admin__ghost" onClick={() => void load()} disabled={loading}>
            {loading ? '刷新中…' : '刷新'}
          </button>
          <button
            type="button"
            className="admin__ghost"
            onClick={() => {
              window.location.hash = '';
              window.location.reload();
            }}
          >
            返回成果墙
          </button>
        </div>
      </header>

      {err && <p className="admin__err">{err}</p>}

      <div className="admin__body">
        <aside className="admin__list">
          {items.length === 0 && !loading && <p className="admin__empty">这个分类里还没有内容</p>}
          {items.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`admin__item${w.id === activeId ? ' is-on' : ''}`}
              onClick={() => setActiveId(w.id)}
            >
              <span className="admin__item-top">
                <span className={`admin__pill admin__pill--${w.status}`}>{statusText[w.status]}</span>
                <span className="admin__item-role">{w.role === 'TEACHER' ? '课题' : '成果'}</span>
                <span className="admin__item-time tnum">{w.created_at?.slice(5, 16).replace('T', ' ')}</span>
              </span>
              <span className="admin__item-title">{w.title}</span>
              <span className="admin__item-meta">
                {w.author} · {w.school || w.region}
              </span>
            </button>
          ))}
        </aside>

        <main className="admin__detail">
          {!detail && <p className="admin__empty">从左边选一条看成内容</p>}

          {detail && (
            <>
              <div className="admin__detail-head">
                <h2>{detail.title}</h2>
                <div className="admin__detail-meta">
                  <span>{detail.region}</span>
                  <span>{detail.school}</span>
                  <span>
                    {detail.role === 'TEACHER' ? '执教' : '作者'} · {detail.author}
                  </span>
                  <span className="tnum">{detail.created_at?.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div className="admin__detail-tags">
                  <span className={`admin__pill admin__pill--${detail.status}`}>
                    {statusText[detail.status]}
                  </span>
                  {detail.review_note && <span className="admin__note">上次批注：{detail.review_note}</span>}
                </div>
              </div>

              {detail.image_data && (
                <img className="admin__image" src={detail.image_data} alt={detail.title} />
              )}

              <pre className="admin__content">{detail.content}</pre>

              <div className="admin__actions">
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="批注（驳回时必填，作者会看到这句话）"
                />
                <div className="admin__action-btns">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || detail.status === 'approved'}
                    onClick={() => void review('approved')}
                  >
                    通过
                  </button>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    disabled={busy || detail.status === 'rejected'}
                    onClick={() => void review('rejected')}
                  >
                    驳回
                  </button>
                  {detail.status !== 'pending' && (
                    <button
                      type="button"
                      className="btn btn--quiet"
                      disabled={busy}
                      onClick={() => void review('pending')}
                    >
                      退回待审
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <footer className="admin__foot">
        <form className="admin__pass" onSubmit={changePass}>
          <span className="admin__pass-label">修改后台口令</span>
          <input
            className="input"
            type="password"
            value={newPass}
            onChange={(e) => {
              setNewPass(e.target.value);
              setPassMsg(null);
            }}
            placeholder="新口令（至少 6 位）"
          />
          <button type="submit" className="admin__ghost">
            保存
          </button>
          {passMsg && <span className="admin__pass-msg">{passMsg}</span>}
        </form>
        <span className="admin__audit">所有审核动作都会留痕</span>
      </footer>

      {toast && <div className="admin__toast">{toast}</div>}
    </div>
  );
}
