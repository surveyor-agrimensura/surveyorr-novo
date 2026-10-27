(() => {
  'use strict';

  function showStatus(message) {
    console.warn('[Admin shell]', message);
  }

  function activateTab(button) {
    if (!button) return;
    document.querySelectorAll('.admin-tabs button').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.admin-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `tab-${button.dataset.tab}`);
    });
  }

  function bootstrapShell() {
    document.querySelectorAll('.admin-tabs button').forEach((button) => {
      if (button.dataset.shellBound === 'true') return;
      button.dataset.shellBound = 'true';
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => activateTab(button));
    });

    document.getElementById('mobileToggle')?.addEventListener('click', () => {
      document.getElementById('side')?.classList.toggle('open');
    });

    document.documentElement.dataset.adminShellReady = 'true';
    setTimeout(() => {
      if (document.documentElement.dataset.adminAppReady !== 'true') {
        showStatus('Os controles básicos foram recuperados, mas os dados ainda não carregaram. Pressione Ctrl+F5. Se persistir, verifique a API e o console do navegador.');
      }
    }, 6000);
  }

  window.addEventListener('error', (event) => {
    if (!event?.message) return;
    showStatus(`Erro de inicialização: ${event.message}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = event?.reason?.message || String(event?.reason || 'Falha assíncrona desconhecida.');
    showStatus(`Falha ao carregar o painel: ${message}`);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapShell, { once: true });
  } else {
    bootstrapShell();
  }
})();
