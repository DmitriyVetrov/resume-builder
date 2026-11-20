import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest, type SessionInfo } from '../../shared/api/client';

type SessionState = { session: SessionInfo | null; loading: boolean; error: boolean };
type SessionOwner = SessionState & { refresh: (fresh?: boolean) => Promise<SessionInfo>; clear: () => void; retry: () => void };
const accountPaths = new Set(['/sign-up', '/login', '/verify-email', '/reset-password', '/reset-password/confirm', '/account', '/auth/sign-up', '/auth/login', '/auth/verify-email', '/auth/password-reset', '/auth/password-reset/confirm']);
const SessionContext = createContext<SessionOwner | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const active = accountPaths.has(location.pathname);
  const [state, setState] = useState<SessionState>({ session: null, loading: true, error: false });
  const generation = useRef(0);
  const pending = useRef<Promise<SessionInfo> | null>(null);
  const refresh = useCallback((fresh = false) => {
    if (!fresh && pending.current) return pending.current;
    const current = ++generation.current;
    const request = apiRequest('/session').then(value => {
      const session = value as SessionInfo;
      if (generation.current === current) setState({ session, loading: false, error: false });
      return session;
    }).catch(error => {
      if (generation.current === current) setState({ session: null, loading: false, error: true });
      throw error;
    }).finally(() => { if (pending.current === request) pending.current = null; });
    pending.current = request;
    return request;
  }, []);
  const clear = useCallback(() => {
    generation.current++;
    pending.current = null;
    setState({ session: null, loading: false, error: false });
  }, []);
  const retry = useCallback(() => {
    setState(previous => ({ ...previous, loading: true, error: false }));
    void refresh().catch(() => {});
  }, [refresh]);
  useEffect(() => { if (active) void refresh().catch(() => {}); }, [active, refresh]);
  return <SessionContext value={{ ...state, refresh, clear, retry }}>{children}</SessionContext>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Account routes require a session provider');
  return session;
}
