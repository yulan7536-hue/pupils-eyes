import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { storySound } from '../utils/sound';

/**
 * 登录 / 注册。
 *
 * 平台只支持「手机号 + 密码」，不支持自定义用户名，而且注册必须先过一次短信验证码
 * （没办法只凭手机号+密码凭空建号）。所以注册被拆成两步：先拿码，再设密码。
 * 视觉上沿用站点现有的 .veil / .dialog 纸片体系，不做另一套设计语言。
 */
export default function LoginDialog() {
  const { loginOpen, closeLogin, signIn, register, sendCode } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [left, setLeft] = useState(0);

  const timer = useRef<number | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!loginOpen) return;
    setErr(null);
    setBusy(false);
    const t = window.setTimeout(() => phoneRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [loginOpen, mode]);

  useEffect(() => {
    if (left <= 0) return;
    timer.current = window.setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [left]);

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLogin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loginOpen, closeLogin]);

  if (!loginOpen) return null;

  const validPhone = /^1\d{10}$/.test(phone);

  const getCode = async () => {
    setErr(null);
    if (!validPhone) {
      setErr('请输入正确的 11 位手机号');
      return;
    }
    setBusy(true);
    try {
      await sendCode(phone);
      setSent(true);
      setLeft(60);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '验证码发送失败');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(phone, password);
        storySound.playPaperTurn();
      } else {
        await register(phone, code, password);
        storySound.playPinDrop();
      }
      setPassword('');
      setCode('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '登录失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLogin();
      }}
    >
      <div className="dialog auth-dialog">
        <h2 className="dialog__title" id="auth-title">
          {mode === 'login' ? '登录童眼成果墙' : '注册一个账号'}
        </h2>
        <p className="dialog__sub">
          {mode === 'login'
            ? '用手机号和密码登录。不登录也可以浏览全部公开成果。'
            : '注册需要一次短信验证码，之后用手机号 + 密码登录。'}
        </p>

        <form onSubmit={submit}>
          <label className="field">
            <span className="field__label">手机号</span>
            <input
              ref={phoneRef}
              className="input tnum"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={11}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 11));
                setErr(null);
              }}
              placeholder="11 位手机号"
            />
          </label>

          {mode === 'register' && (
            <label className="field">
              <span className="field__label">短信验证码</span>
              <div className="auth-code">
                <input
                  className="input tnum"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setErr(null);
                  }}
                  placeholder="6 位验证码"
                />
                <button
                  type="button"
                  className="btn btn--quiet auth-code__btn"
                  onClick={() => void getCode()}
                  disabled={busy || left > 0 || !validPhone}
                >
                  {left > 0 ? `${left}s` : sent ? '重新发送' : '获取验证码'}
                </button>
              </div>
            </label>
          )}

          <label className="field">
            <span className="field__label">密码</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErr(null);
              }}
              placeholder={mode === 'login' ? '你的密码' : '至少 6 位，记牢一点'}
            />
          </label>

          {err && <p className="auth-err">{err}</p>}

          <button type="submit" className="btn btn--full" disabled={busy}>
            {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              还没有账号？
              <button type="button" className="auth-link" onClick={() => setMode('register')}>
                去注册
              </button>
            </>
          ) : (
            <>
              已经有账号？
              <button type="button" className="auth-link" onClick={() => setMode('login')}>
                去登录
              </button>
            </>
          )}
        </div>

        <p className="auth-note">
          {mode === 'register'
            ? '验证码由平台短信通道下发，收不到时可稍等 1 分钟再试。'
            : '密码由平台加密保存，本站不会看到明文。'}
        </p>
      </div>
    </div>
  );
}
