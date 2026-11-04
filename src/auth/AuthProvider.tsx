import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cloud } from '../utils/cloudClient';

/**
 * 登录态。
 *
 * 站点的定位是「公开资源库」：不登录也能看所有已通过审核的课题与成果，
 * 只有「写」的动作用得着身份（上传、贴纸、花园、点赞、评论）。所以这里不做
 * 强制守卫，只提供 requireAuth(action) —— 需要身份时才把登录框叫出来，
 * 登录成功再把刚才那步接着做完，用户不会觉得自己点了个空按钮。
 */

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  name?: string;
}

export type AuthStatus = 'loading' | 'anon' | 'authed';

type PendingOtp = { phone: string; verificationId: string; isExistingUser: boolean };

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** 已登录时的展示名：手机号后四位，没有就退成昵称/已登录 */
  label: string;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  /** 需要身份才能做的事：已登录直接执行，未登录先弹登录框、登录后自动续做 */
  requireAuth: (action: () => void) => void;
  /** 发短信验证码（注册第一步）；失败时抛出可直接展示的错误 */
  sendCode: (phone: string) => Promise<void>;
  /** 验证码 + 密码完成注册（老用户会直接登录） */
  register: (phone: string, code: string, password: string) => Promise<void>;
  /** 手机号 + 密码登录 */
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

type CloudUserShape = { id?: string; phone?: string; email?: string; name?: string };

function toUser(session: unknown): AuthUser | null {
  if (!session || typeof session !== 'object') return null;
  const u = (session as { user?: CloudUserShape }).user;
  if (!u) return null;
  return {
    id: String(u.id ?? u.phone ?? u.email ?? ''),
    phone: u.phone,
    email: u.email,
    name: u.name,
  };
}

function messageOf(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!raw) return fallback;
  if (/network|fetch|load failed/i.test(raw)) return '网络不通，稍后再试一次';
  if (/rate|too many|429/i.test(raw)) return '请求太频繁，请稍后再试';
  if (/verification|code/i.test(raw) && /invalid|incorrect|expire/i.test(raw)) return '验证码不对或已过期';
  return raw.slice(0, 100);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const pendingAction = useRef<(() => void) | null>(null);
  const pendingOtp = useRef<PendingOtp | null>(null);
  const mounted = useRef(true);

  const applySession = useCallback((session: unknown) => {
    const next = toUser(session);
    setUser(next);
    setStatus(next ? 'authed' : 'anon');
    if (next) {
      setLoginOpen(false);
      const run = pendingAction.current;
      pendingAction.current = null;
      if (run) window.setTimeout(run, 0);
    }
  }, []);

  /* 首屏恢复登录态。等 getSession 回来再结束 loading，避免先闪一下"未登录"。 */
  useEffect(() => {
    mounted.current = true;
    let alive = true;

    void (async () => {
      try {
        const { data } = await cloud.auth.getSession();
        if (!alive) return;
        applySession(data);
      } catch {
        if (alive) setStatus('anon');
      }
    })();

    const unsubscribe = cloud.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      applySession(session ?? null);
    });

    return () => {
      alive = false;
      mounted.current = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [applySession]);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => {
    pendingAction.current = null;
    setLoginOpen(false);
  }, []);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (status === 'authed') {
        action();
        return;
      }
      pendingAction.current = action;
      setLoginOpen(true);
    },
    [status]
  );

  const sendCode = useCallback(async (phone: string) => {
    if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的 11 位手机号');
    const { data, error } = await cloud.auth.sendOtp({ phone });
    if (error) throw new Error(messageOf(error, '验证码发送失败'));
    const d = data as { verificationId?: string; isExistingUser?: boolean } | null;
    if (!d?.verificationId) throw new Error('验证码发送失败，请重试');
    pendingOtp.current = {
      phone,
      verificationId: d.verificationId,
      isExistingUser: Boolean(d.isExistingUser),
    };
  }, []);

  const register = useCallback(
    async (phone: string, code: string, password: string) => {
      if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的 11 位手机号');
      if (password.length < 6) throw new Error('密码至少 6 位');
      const pending = pendingOtp.current;
      if (!pending || pending.phone !== phone) throw new Error('请先点「获取验证码」');

      const { data, error } = await cloud.auth.verifyOtp({
        phone: pending.phone,
        verificationId: pending.verificationId,
        isExistingUser: pending.isExistingUser,
        token: code.trim(),
        password: pending.isExistingUser ? undefined : password,
      });
      if (error) throw new Error(messageOf(error, '注册失败，请检查验证码'));
      pendingOtp.current = null;
      applySession(data);
    },
    [applySession]
  );

  const signIn = useCallback(
    async (phone: string, password: string) => {
      if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的 11 位手机号');
      if (!password) throw new Error('请输入密码');
      const { data, error } = await cloud.auth.signInWithPassword({ phone, password });
      if (error) throw new Error(messageOf(error, '手机号或密码不正确'));
      applySession(data);
    },
    [applySession]
  );

  const signOut = useCallback(async () => {
    try {
      await cloud.auth.signOut();
    } finally {
      setUser(null);
      setStatus('anon');
    }
  }, []);

  const label = useMemo(() => {
    if (!user) return '';
    const phone = (user.phone ?? '').replace(/\D/g, '');
    if (phone.length >= 4) return phone.slice(-4);
    if (user.name) return user.name;
    return '已登录';
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      label,
      loginOpen,
      openLogin,
      closeLogin,
      requireAuth,
      sendCode,
      register,
      signIn,
      signOut,
    }),
    [status, user, label, loginOpen, openLogin, closeLogin, requireAuth, sendCode, register, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
