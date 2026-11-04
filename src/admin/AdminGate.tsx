import { useEffect, useState, type ReactNode } from 'react';
import { adminCheck } from '../utils/adminStore';

/**
 * 后台口令闸门。
 *
 * 后台不绑账号：一个口令进去，所以口令只放在 sessionStorage —— 关掉标签页就失效，
 * 不会在某台公用电脑上一直留着。真正的比对发生在数据库函数里（bcrypt），
 * 前端拿不到哈希，也绕不过去。
 */
const KEY = 'pupils-eyes:admin-pass';

export default function AdminGate({ children }: { children: (password: string) => ReactNode }) {
  const [pass, setPass] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(KEY);
      if (saved) setPass(saved);
    } catch {
      /* 隐私模式读不到就每次重新输 */
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const res = await adminCheck(input);
    setBusy(false);

    if (res === 'ok') {
      try {
        window.sessionStorage.setItem(KEY, input);
      } catch {
        /* ignore */
      }
      setPass(input);
      return;
    }
    setErr(
      res === 'locked'
        ? '失败次数太多，请 15 分钟后再试'
        : res === 'nokey'
          ? '服务端还没有设置后台口令'
          : '口令不对'
    );
  };

  if (pass) return <>{children(pass)}</>;

  return (
    <div className="admin admin--gate">
      <form className="admin__gate" onSubmit={submit}>
        <h1 className="admin__gate-title">开发者后台</h1>
        <p className="admin__gate-sub">输入后台口令，审核所有用户提交的课题与成果。</p>

        <label className="field">
          <span className="field__label">后台口令</span>
          <input
            className="input"
            type="password"
            autoFocus
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setErr(null);
            }}
            placeholder="口令"
          />
        </label>

        {err && <p className="auth-err">{err}</p>}

        <button type="submit" className="btn btn--full" disabled={busy || !input.trim()}>
          {busy ? '校验中…' : '进入后台'}
        </button>

        <button
          type="button"
          className="admin__gate-back"
          onClick={() => {
            window.location.hash = '';
            window.location.reload();
          }}
        >
          返回成果墙
        </button>
      </form>
    </div>
  );
}
