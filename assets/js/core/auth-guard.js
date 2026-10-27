(() => {
  'use strict';

  const html = document.documentElement;
  const SESSION_KEY = 'georural-auth-session-v3';
  const LAST_ACTIVITY_KEY = 'georural-auth-last-activity-v1';
  const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
  const returnTarget = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;

  html.classList.add('surveyor-auth-pending');
  html.style.visibility = 'hidden';

  function clearClientSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    try { sessionStorage.removeItem(LAST_ACTIVITY_KEY); } catch {}
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch { return null; }
  }

  // V48 — Ctrl+R/reload preserva a sessão e a rota atual. O login só é
  // exigido quando existe inatividade real por 20 minutos ou quando a sessão
  // foi explicitamente revogada/invalidada pelo backend.
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  const session = readSession();
  let lastActivityAt = 0;
  try { lastActivityAt = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || 0); } catch {}
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) {
    // Migração segura das versões anteriores: a primeira carga após a atualização
    // não expulsa quem já estava trabalhando; a partir daí o relógio passa a valer.
    lastActivityAt = Date.now();
    try { sessionStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityAt)); } catch {}
  }
  const idleExpired = Boolean(session?.user) && Date.now() - lastActivityAt > IDLE_TIMEOUT_MS;
  if (idleExpired) {
    clearClientSession();
    try { sessionStorage.removeItem(LAST_ACTIVITY_KEY); } catch {}
    const target = encodeURIComponent(returnTarget);
    location.replace(`/login/?return=${target}&reason=idle_timeout`);
    return;
  }
  const hasCachedSession = Boolean(session?.user && (session?.accessToken || session?.token));
  if (!hasCachedSession) {
    clearClientSession();
    const target = encodeURIComponent(returnTarget);
    location.replace(`/login/?return=${target}`);
  }
})();
