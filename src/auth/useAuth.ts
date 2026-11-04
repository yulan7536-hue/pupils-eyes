import { useContext } from 'react';
import { AuthContext } from './AuthProvider';

/** 读登录态。必须在 <AuthProvider> 里面用。 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
