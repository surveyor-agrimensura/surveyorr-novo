(() => {
  'use strict';
  if (document.body?.dataset?.page !== 'mapa.html') return;

  const icons = {
    project: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h6l2 2h8v12H4V5Z"/><path d="M8 11h8M8 15h5"/></svg>',
    layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 11 8 4 8-4M4 15l8 4 8-4"/></svg>',
    glebas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4Z"/><path d="M12 4v16M4 12h16"/></svg>',
    tools: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-4-4 3-3Z"/></svg>'
  };
  const labels = { project:'PROJETO', layers:'CAMADAS', glebas:'GLEBAS', tools:'FERRAMENTAS' };

  document.querySelectorAll('.sidepanel-tabs-four [data-side-tab]').forEach((button) => {
    const key = button.dataset.sideTab;
    if (!icons[key] || button.dataset.friendlyDecorated === '1') return;
    button.dataset.friendlyDecorated = '1';
    button.innerHTML = `${icons[key]}<span class="sv-tab-label">${labels[key]}</span>`;
  });

  const titleHost = document.querySelector('.gps-point-head-title');
  if (titleHost && !titleHost.querySelector('.gps-point-title-icon')) {
    const icon = document.createElement('span');
    icon.className = 'gps-point-title-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>';
    titleHost.prepend(icon);
  }

  const savePoint = document.getElementById('gpsCreatePointBtn');
  if (savePoint && !savePoint.querySelector('svg')) {
    savePoint.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg><span>Salvar ponto</span>';
  }

  // Improve tool labels without replacing the tested controls or handlers.
  const nicerLabels = {
    selectToolBtn:'Selecionar', identifyToolBtn:'Informações', toolsMenuBtn:'Desenhar', cadToolsMenuBtn:'CAD', sigToolsMenuBtn:'SIG',
    undoToolBtn:'Desfazer', cancelToolBtn:'Cancelar', refreshMapBtn:'Atualizar', measureToolBtn:'Distância', markGpsPointBtn:'Ponto',
    coordinatesToolBtn:'Coordenadas', segmentMeasuresToggleBtn:'Cotas', glebaFrontBackToggleBtn:'Frente / fundo', terrainToolsMenuBtn:'Terreno', earthExploreBtn:'Earth 3D'
  };
  Object.entries(nicerLabels).forEach(([id,label]) => {
    const button = document.getElementById(id);
    const span = button?.querySelector(':scope > span');
    if (span) span.textContent = label;
  });
})();
