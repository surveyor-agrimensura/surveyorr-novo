(() => {
  'use strict';

  const ITEM_SELECTOR = 'a[data-tool-route="/consulta-car"], a[href$="/consulta-car/"], a[href$="/consulta-car"]';

  function deployBase() {
    const meta = document.querySelector('meta[name="surveyor-deploy-base"]')?.content;
    if (meta) return String(meta).replace(/\/$/, '');
    const parts = location.pathname.split('/').filter(Boolean);
    if (/github\.io$/i.test(location.hostname) && parts.length) return `/${parts[0]}`;
    return '';
  }

  function iconMarkup() {
    return `<span class="tool-icon"><span class="module-icon-safe" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5 12 3l8 3.5V12c0 4.6-3.1 7.4-8 9-4.9-1.6-8-4.4-8-9V6.5Z"/><path d="M8 12.5c2.8-4 6.1-4.9 9-4.5-1 4.2-3.4 7-7.2 7.1"/><path d="M8 17c1.1-2.4 2.8-4.2 5.5-5.6"/></svg></span></span>`;
  }

  function ensureConsultaCar() {
    const menu = document.getElementById('svHomeToolsMenu');
    if (!menu || menu.querySelector(ITEM_SELECTOR)) return;

    const sections = [...menu.querySelectorAll(':scope > section')];
    let campoMapa = sections.find((section) => /campo\s+e\s+mapa/i.test(section.querySelector('h3')?.textContent || ''));
    if (!campoMapa) campoMapa = sections[0];
    if (!campoMapa) {
      campoMapa = document.createElement('section');
      campoMapa.innerHTML = '<h3>CAMPO E MAPA</h3>';
      menu.prepend(campoMapa);
    }

    const base = deployBase();
    const link = document.createElement('a');
    link.href = `${base}/consulta-car/`;
    link.setAttribute('role', 'menuitem');
    link.dataset.toolRoute = '/consulta-car';
    link.dataset.svConsultaCarFixed = '1';
    link.innerHTML = `${iconMarkup()}<span><b>Consulta Pública CAR</b><small>Pesquisa em dados públicos do Cadastro Ambiental Rural</small></span>`;

    const firstLink = campoMapa.querySelector('a');
    if (firstLink?.nextSibling) campoMapa.insertBefore(link, firstLink.nextSibling);
    else if (firstLink) firstLink.after(link);
    else campoMapa.appendChild(link);
  }

  function scheduleEnsure() {
    ensureConsultaCar();
    requestAnimationFrame(ensureConsultaCar);
    setTimeout(ensureConsultaCar, 60);
    setTimeout(ensureConsultaCar, 250);
    setTimeout(ensureConsultaCar, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleEnsure, { once: true });
  } else {
    scheduleEnsure();
  }

  const observer = new MutationObserver(() => ensureConsultaCar());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('pageshow', scheduleEnsure);
  window.addEventListener('surveyor:session-ready', scheduleEnsure);
  window.addEventListener('surveyor:permissions-updated', scheduleEnsure);
})();
