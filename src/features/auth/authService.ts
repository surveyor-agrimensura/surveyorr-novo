import { ApiError, apiRequest } from '../../lib/api';

export interface SurveyorUser {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  planName?: string;
  planSlug?: string;
  plan?: string;
  expiresAt?: string;
  mustChangePassword?: boolean;
  isSubuser?:boolean;workspaceOwnerUserId?:string;workspaceRole?:string;planInherited?:boolean;
}

export interface SurveyorSession {
  user: SurveyorUser;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  updatedAt: string;
}

export interface AuthenticationResponse {
  ok?: boolean;
  user?: SurveyorUser;
  session?: { user?: SurveyorUser; accessToken?: string; token?: string; refreshToken?: string };
  accessToken?: string;
  token?: string;
  jwt?: string;
  access_token?: string;
  refreshToken?: string;
  refreshCookie?: boolean;
  tokenType?: string;
  expiresIn?: number;
  requiresEmailVerification?: boolean;
  requiresVerification?: boolean;
  verificationToken?: string;
  verificationCookie?: boolean;
  maskedEmail?: string;
  requiresPasswordChange?: boolean;
  mustChangePassword?: boolean;
  firstAccessToken?: string;
  firstAccessCookie?: boolean;
  message?: string;
}

export type LoginResult =
  | { kind: 'success'; session: SurveyorSession }
  | { kind: 'verification'; token: string; email: string; maskedEmail: string; message: string }
  | { kind: 'first-access'; token: string; email: string; message: string };

export const SESSION_KEY = 'georural-auth-session-v3';
export const ACTIVITY_KEY = 'georural-auth-last-activity-v2';
export const LEGACY_ACTIVITY_KEY = 'georural-auth-last-activity-v1';
export const SESSION_NOTICE_KEY = 'georural-auth-session-notice-v1';
export const IDLE_LOGOUT_ATTEMPT_KEY = 'georural-auth-idle-logout-attempted-v1';
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_TIMEOUT_REASON = 'idle_timeout';
export const IDLE_TIMEOUT_MESSAGE = 'Sua sessão expirou após 30 minutos sem atividade. Entre novamente.';

export function getLastSessionActivity(session?: SurveyorSession | null): number | null {
  let stored = localStorage.getItem(ACTIVITY_KEY);
  if (stored === null) {
    const legacy = sessionStorage.getItem(ACTIVITY_KEY) ?? sessionStorage.getItem(LEGACY_ACTIVITY_KEY);
    if (legacy !== null) {
      localStorage.setItem(ACTIVITY_KEY, legacy);
      sessionStorage.removeItem(ACTIVITY_KEY);
      sessionStorage.removeItem(LEGACY_ACTIVITY_KEY);
      stored = legacy;
    }
  }
  const timestamp = stored === null ? Date.parse(session?.updatedAt || '') : Number(stored);
  if (stored === null && Number.isFinite(timestamp) && timestamp > 0) {
    recordSessionActivity(timestamp);
  }
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function isSessionIdleExpired(lastActivity: number | null, now = Date.now()): boolean {
  return lastActivity === null || !Number.isFinite(lastActivity) || now - lastActivity >= IDLE_TIMEOUT_MS;
}

export function recordSessionActivity(now = Date.now()): void {
  localStorage.setItem(ACTIVITY_KEY, String(now));
  sessionStorage.removeItem(LEGACY_ACTIVITY_KEY);
}

export function revokeExpiredSession(session: SurveyorSession | null): void {
  if (sessionStorage.getItem(SESSION_NOTICE_KEY) !== IDLE_TIMEOUT_REASON
      || sessionStorage.getItem(IDLE_LOGOUT_ATTEMPT_KEY) === '1') return;
  sessionStorage.setItem(IDLE_LOGOUT_ATTEMPT_KEY, '1');
  void revokeServerSession(session);
}

export function markSessionExpiredByInactivity(session: SurveyorSession | null): void {
  clearSession(IDLE_TIMEOUT_REASON);
  revokeExpiredSession(session);
}

export function normalizeSession(data: AuthenticationResponse): SurveyorSession {
  const user = data.user || data.session?.user;
  const accessToken = data.accessToken || data.token || data.jwt || data.access_token || data.session?.accessToken || data.session?.token;
  if (!user || !accessToken) throw new ApiError('A API não devolveu uma sessão de usuário válida.', 502);
  return {
    user,
    accessToken,
    ...(data.refreshCookie !== true && (data.refreshToken || data.session?.refreshToken)
      ? { refreshToken: data.refreshToken || data.session?.refreshToken } : {}),
    tokenType: data.tokenType || 'Bearer',
    expiresIn: data.expiresIn,
    updatedAt: new Date().toISOString()
  };
}

export function saveSession(session: SurveyorSession, resetActivity = true): void {
  // Acesso permanece apenas na memória; a renovação persistente usa o cookie HttpOnly do servidor.
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, accessToken: '' }));
  if (resetActivity) recordSessionActivity();
  else getLastSessionActivity(); // Migra o registro antigo sem renovar o prazo durante um refresh.
  sessionStorage.removeItem(SESSION_NOTICE_KEY);
  sessionStorage.removeItem(IDLE_LOGOUT_ATTEMPT_KEY);
  // Compatível com o modelo de sessão por aba do SURVEYOR antigo.
  localStorage.removeItem(SESSION_KEY);
}

export function readSession(): SurveyorSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as SurveyorSession | null;
    if (!value?.user) return null;
    const lastActivity = getLastSessionActivity(value);
    if (isSessionIdleExpired(lastActivity)) {
      markSessionExpiredByInactivity(value);
      return null;
    }
    const session = { ...value, accessToken: String(value.accessToken || '') };
    // Remove tokens de acesso legados do sessionStorage sem interromper a aba atual.
    if (session.accessToken) saveSession(session, false);
    return session;
  } catch { return null; }
}

export function clearSession(notice?: typeof IDLE_TIMEOUT_REASON): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ACTIVITY_KEY);
  sessionStorage.removeItem(LEGACY_ACTIVITY_KEY);
  sessionStorage.removeItem('surveyor-map-visited-session-v1');
  sessionStorage.removeItem('surveyor-map-last-view-v1');
  sessionStorage.removeItem('surveyor-map-place-v1');
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ACTIVITY_KEY);
  if (notice) sessionStorage.setItem(SESSION_NOTICE_KEY, notice);
  else sessionStorage.removeItem(SESSION_NOTICE_KEY);
  sessionStorage.removeItem(IDLE_LOGOUT_ATTEMPT_KEY);
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await apiRequest<AuthenticationResponse>('/api/auth/login', {
    method: 'POST', body: { email: email.trim().toLowerCase(), password }
  });
  if (response.requiresEmailVerification || response.requiresVerification) {
    return {
      kind: 'verification',
      token: response.verificationToken || '',
      email: email.trim().toLowerCase(),
      maskedEmail: response.maskedEmail || '',
      message: response.message || 'Confira o código enviado para seu e-mail.'
    };
  }
  if (response.requiresPasswordChange || response.mustChangePassword) {
    return {
      kind: 'first-access', token: response.firstAccessToken || '', email: email.trim().toLowerCase(),
      message: response.message || 'Defina sua senha definitiva.'
    };
  }
  const session = normalizeSession(response);
  saveSession(session);
  return { kind: 'success', session };
}

export async function verifyLogin(email: string, code: string, token: string): Promise<SurveyorSession> {
  const result = await apiRequest<AuthenticationResponse>('/api/auth/verify-login-code', {
    method: 'POST', body: { email, code: code.replace(/\D/g, '').slice(0, 6), verificationToken: token }
  });
  const session = normalizeSession(result);
  saveSession(session);
  return session;
}

export async function completeFirstAccess(token: string, password: string): Promise<void> {
  await apiRequest('/api/auth/first-access/password', {
    method: 'POST', body: { firstAccessToken: token, password, passwordConfirmation: password }
  });
}

export interface ResetRequest { resetToken?: string; maskedEmail?: string; message?: string }
export interface ResetVerification { resetAuthorization?: string; message?: string }

export function requestPasswordReset(email: string): Promise<ResetRequest> {
  return apiRequest('/api/auth/password-reset/request', { method: 'POST', body: { email } });
}
export function verifyResetCode(email: string, code: string, resetToken: string): Promise<ResetVerification> {
  return apiRequest('/api/auth/password-reset/verify', { method: 'POST', body: { email, code, resetToken } });
}
export function confirmPasswordReset(email: string, password: string, resetAuthorization: string): Promise<unknown> {
  return apiRequest('/api/auth/password-reset/confirm', { method: 'POST', body: { email, password, resetAuthorization } });
}

export async function checkSession(session: SurveyorSession): Promise<SurveyorSession> {
  try {
    if (session.accessToken) {
      const data = await apiRequest<{ user: SurveyorUser }>('/api/auth/me', { accessToken: session.accessToken });
      const updated = { ...session, user: data.user || session.user };
      saveSession(updated, false);
      return updated;
    }
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  // O servidor renova pela credencial HttpOnly; o JSON legado só é usado em ambientes sem cookie.
  const refresh = await apiRequest<AuthenticationResponse>('/api/auth/refresh', {
    method: 'POST', body: session.refreshToken ? { refreshToken: session.refreshToken } : {}
  });
  const updated = normalizeSession({ ...refresh, user: refresh.user || session.user });
  saveSession(updated, false);
  return updated;
}

export async function revokeServerSession(session: SurveyorSession | null): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', {
      method: 'POST', accessToken: session?.accessToken,
      body: session?.refreshToken ? { refreshToken: session.refreshToken } : {}
    });
  } catch { /* A sessão local precisa ser encerrada mesmo sem conexão. */ }
}

export async function logout(session: SurveyorSession | null): Promise<void> {
  try { await revokeServerSession(session); }
  finally { clearSession(); }
}
