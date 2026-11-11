import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  clearSession, login as loginRequest, logout as logoutRequest,
  readSession, verifyLogin as verifyLoginRequest,
  ACTIVITY_KEY, IDLE_TIMEOUT_MS,
  type LoginResult, type SurveyorSession
} from './authService';
import { ApiError } from '../../lib/api';
import { refreshAuthenticatedSession, subscribeAuthenticatedSession } from '../../lib/authenticatedRequest';

type AuthStatus = 'checking' | 'ready' | 'offline';
interface AuthContextValue {
  session: SurveyorSession | null;
  status: AuthStatus;
  error: string;
  retry: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  confirmCode: (email: string, code: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SurveyorSession | null>(() => readSession());
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [error, setError] = useState('');

  const retry = useCallback(async () => {
    const cached = readSession();
    if (!cached) { setSession(null); setStatus('ready'); return; }
    setStatus('checking');
    try {
      const verified = await refreshAuthenticatedSession(cached);
      setSession(verified);
      setError('');
      setStatus('ready');
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        clearSession(); setSession(null); setStatus('ready');
      } else {
        setError(e instanceof Error ? e.message : 'Não foi possível validar sua sessão.');
        setStatus('offline');
      }
    }
  }, []);

  useEffect(() => { void retry(); }, [retry]);
  useEffect(() => subscribeAuthenticatedSession(updated => {
    setSession(updated);
    setError('');
    setStatus('ready');
  }), []);
  useEffect(() => {
    if (!session) return;
    let lastWrite = 0;
    const track = () => {
      const now = Date.now();
      if (now - lastWrite < 15000) return;
      lastWrite = now;
      const previous = Number(sessionStorage.getItem(ACTIVITY_KEY) || now);
      if (now - previous <= IDLE_TIMEOUT_MS) sessionStorage.setItem(ACTIVITY_KEY, String(now));
    };
    // Atividade no mapa envolve arrastar, mover a câmera, zoom e rolar a tela.
    // O servidor, não um relógio de inatividade local, decide se o token expirou.
    window.addEventListener('pointerdown', track, { passive: true });
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('wheel', track, { passive: true });
    window.addEventListener('touchmove', track, { passive: true });
    window.addEventListener('keydown', track, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', track);
      window.removeEventListener('pointermove', track);
      window.removeEventListener('wheel', track);
      window.removeEventListener('touchmove', track);
      window.removeEventListener('keydown', track);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let disposed=false;
    // Refresh preventivo durante o trabalho ativo: o token pode expirar no servidor
    // mesmo quando a interface não é recarregada. Falha de rede não desconecta.
    const heartbeat=async()=>{
      if(document.visibilityState!=='visible')return;
      try{
        const current=readSession();
        if(!current)return;
        const updated=await refreshAuthenticatedSession(current);
        if(!disposed){setSession(updated);setError('');setStatus('ready');}
      }catch(error){
        if(disposed)return;
        // Não apagar uma edição local em andamento por indisponibilidade da API.
        if(error instanceof ApiError && error.status===401){
          setError('Sessão não confirmada pela API. Salve um backup local antes de atualizar a página.');
        }
      }
    };
    const interval=window.setInterval(()=>void heartbeat(),5*60*1000);
    return()=>{disposed=true;window.clearInterval(interval);};
  },[session?.accessToken]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    if (result.kind === 'success') {
      setSession(result.session); setStatus('ready'); setError('');
    }
    return result;
  }, []);
  const confirmCode = useCallback(async (email: string, code: string, token: string) => {
    const updated = await verifyLoginRequest(email, code, token);
    setSession(updated); setStatus('ready'); setError('');
  }, []);
  const signOut = useCallback(async () => {
    const current = session;
    setSession(null); setStatus('ready');
    await logoutRequest(current);
  }, [session]);
  const value = useMemo(() => ({ session, status, error, retry, signIn, confirmCode, signOut }),
    [session, status, error, retry, signIn, confirmCode, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa de AuthProvider');
  return context;
}
