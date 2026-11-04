import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';

/**
 * 右上角的账号入口。
 *
 * 不登录也能逛完整站，所以这里默认只是一个轻量的「登录」药丸；登录后变成
 * 尾号 + 下拉里的「退出」。放进 HUD 的按钮列，不额外占版面。
 */
export default function AccountButton() {
  const { status, label, openLogin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  if (status === 'loading') return null;

  if (status === 'anon') {
    return (
      <button type="button" className="hud__action hud__action--account" onClick={openLogin}>
        <span className="btn-cn">登录</span>
        <span className="btn-en" lang="en">
          Sign in
        </span>
      </button>
    );
  }

  return (
    <div className="account" ref={box}>
      <button
        type="button"
        className="hud__action hud__action--account"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="btn-cn">
          <span className="account__dot" aria-hidden="true" />
          {label}
        </span>
        <span className="btn-en" lang="en">
          Signed in
        </span>
      </button>

      {open && (
        <div className="account__menu" role="menu">
          <button
            type="button"
            className="account__item"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
