import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { App } from './app/App';
import './styles/global.css';
import './styles/workspace.css';
import './features/pwa/pwa.css';
import './styles/institutional.css';

window.addEventListener('vite:preloadError', event => {
  const retryKey = `surveyor-preload-retry:${location.pathname}`;
  const retryWindowMs = 30_000;
  try {
    const previousAttempt = Number(sessionStorage.getItem(retryKey));
    if (previousAttempt && Date.now() - previousAttempt < retryWindowMs) return;
    sessionStorage.setItem(retryKey, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  location.reload();
});

if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => console.warn('SURVEYOR PWA: registro indisponível', error));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider><App /></ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
