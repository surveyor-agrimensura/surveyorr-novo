(() => {
  'use strict';

  let group = null;
  let trigger = null;
  let panel = null;

  const runtime = () => window.SurveyorMapRuntime;

  function timeLabel(timestamp) {
    const date = new Date(Number(timestamp || Date.now()));
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function findHistoryGroup() {
    return [...document.querySelectorAll('.sv-map-toolbar-group')].find((node) => node.querySelector('.sv-map-toolbar-group-caption')?.textContent?.trim() === 'Histórico') || null;
  }

  function close() {
    if (!panel) return;
    panel.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
  }

  function render() {
    if (!panel) return;
    const entries = runtime()?.getHistoryEntries?.() || [];
    const list = panel.querySelector('.sv-history-session-list');
    if (!list) return;
    list.innerHTML = '';
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'sv-history-empty';
      empty.textContent = 'Nenhuma alteração nesta sessão.';
      list.appendChild(empty);
      return;
    }
    entries.slice().reverse().forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sv-history-entry';
      button.innerHTML = `<time>${timeLabel(entry.at)}</time><span>${escapeHtml(entry.label || 'Alteração no mapa')}</span>`;
      button.title = `Voltar para o estado anterior a: ${entry.label || 'alteração'}`;
      button.addEventListener('click', () => {
        const ok = runtime()?.jumpToHistoryIndex?.(Number(entry.index));
        if (ok) runtime()?.toast?.(`Histórico restaurado: ${entry.label || 'alteração'}.`, 'success');
        close();
      });
      list.appendChild(button);
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function mount() {
    if (panel) return true;
    group = findHistoryGroup();
    if (!group) return false;
    const caption = group.querySelector('.sv-map-toolbar-group-caption');
    if (!caption) return false;
    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = 'svHistoryOpenBtn';
    trigger.className = 'sv-map-toolbar-group-caption sv-history-open';
    trigger.textContent = 'Histórico';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    caption.replaceWith(trigger);

    panel = document.createElement('section');
    panel.id = 'svHistoryPanel';
    panel.className = 'sv-history-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Histórico de alterações do projeto');
    panel.innerHTML = `
      <header><div><b>Alterações da sessão</b><small>Até 30 passos rápidos</small></div><button type="button" class="sv-history-close" aria-label="Fechar histórico">×</button></header>
      <div class="sv-history-session-list"></div>
      <footer><span>Marcos permanentes ficam nas versões da nuvem.</span><button type="button" class="sv-history-cloud">Abrir versões</button></footer>`;
    group.appendChild(panel);
    group.classList.add('sv-history-group');

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const opening = panel.hidden;
      if (opening) render();
      panel.hidden = !opening;
      trigger.setAttribute('aria-expanded', String(opening));
    });
    panel.querySelector('.sv-history-close')?.addEventListener('click', close);
    panel.querySelector('.sv-history-cloud')?.addEventListener('click', () => {
      close();
      document.getElementById('projectVersionsBtn')?.click();
    });
    document.addEventListener('click', (event) => { if (!group?.contains(event.target)) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    render();
    return true;
  }

  window.addEventListener('surveyor:history-changed', () => render());
  let attempts = 0;
  const timer = setInterval(() => {
    if (mount() || ++attempts > 40) clearInterval(timer);
  }, 100);
  mount();
})();
