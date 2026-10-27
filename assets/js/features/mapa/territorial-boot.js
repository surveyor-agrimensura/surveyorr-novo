(() => {
  'use strict';
  const projectId = new URLSearchParams(window.location.search).get('project');
  if (projectId) return;
  const sessionIdentity = () => {
    try {
      const session = JSON.parse(sessionStorage.getItem('georural-auth-session-v3') || 'null') || {};
      const user = session.user || {};
      const userId = String(user.id || user.sub || user.email || '').trim().toLowerCase();
      const createdAt = String(session.createdAt || session.issuedAt || '').trim();
      if (!userId) return '';
      return `${userId}::${createdAt || String(session.accessToken || '').slice(-24)}`;
    } catch { return ''; }
  };
  const identity = sessionIdentity();
  let alreadyShown = false;
  try { alreadyShown = Boolean(identity && sessionStorage.getItem('surveyor-territorial-seen-session-v1') === identity); } catch {}
  if (!alreadyShown) document.documentElement.classList.add('surveyor-territorial-pending');
})();
