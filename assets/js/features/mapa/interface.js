(() => {
  'use strict';
  const STORE_KEY = 'surveyor.mega.interface.v22';
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const defaults = {
    theme: 'light',
    language: 'pt-BR',
    density: 'comfortable',
    showMinimap: true,
    showCompass: false,
    showScale: true,
    showToolbarLabels: true,
    mapCache: true,
    groups: { consulta: true, desenho: true, analise: true, arquivos: true },
    panelWidth: 344
  };

  function readPrefs() {
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(STORE_KEY) || '{}')) }; }
    catch { return { ...defaults }; }
  }
  function writePrefs(prefs) { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); }
  let prefs = readPrefs();

  function toast(message, type = 'info') {
    let box = $('megaToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'megaToast';
      box.className = 'mega-toast';
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.dataset.type = type;
    box.classList.add('visible');
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove('visible'), 2800);
  }

  function getMap() { return window.surveyorMapInstance || window.georuralMapInstance || null; }

  function applyPrefs() {
    // Interface simplificada: sem troca de tema, idiomas, densidade,
    // pesquisa global ou atalhos. Mantém apenas recursos visuais úteis do mapa.
    prefs.language = 'pt-BR';
    prefs.density = 'comfortable';
    prefs.showToolbarLabels = true;
    prefs.showCompass = false;
    prefs.groups = { consulta: true, desenho: true, analise: true, arquivos: true };
    document.documentElement.lang = 'pt-BR';
    document.body.classList.remove('mega-density-compact', 'mega-hide-toolbar-labels');
    const fileArea = qs('.geo-toolbar-right-map');
    if (fileArea) fileArea.hidden = false;
    const groups = qsa('.geo-toolbar-center .geo-tool-group');
    groups.forEach((group) => { group.hidden = false; });
    const panel = $('geoSidePanel');
    if (panel && Number(prefs.panelWidth) >= 280) {
      document.body.style.setProperty('--panel-w', `${prefs.panelWidth}px`);
      document.documentElement.style.setProperty('--panel-w', `${prefs.panelWidth}px`);
      panel.style.width = `${prefs.panelWidth}px`;
      panel.style.minWidth = `${prefs.panelWidth}px`;
      panel.style.maxWidth = `${prefs.panelWidth}px`;
    }
    updateMiniMapVisibility();
    updateCompassScaleVisibility();
  }

  function ensureSettingsPanel() {
    if ($('megaInterfaceBtn')) return;
    const button = document.createElement('button');
    button.id = 'megaInterfaceBtn';
    button.type = 'button';
    button.className = 'geo-tool mega-interface-btn';
    button.title = 'Minimapa, escala e tela cheia';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg><span>Interface</span>';
    const center = qs('.geo-toolbar-center');
    center?.appendChild(button);

    const inline = document.createElement('div');
    inline.id = 'megaInterfaceInline';
    inline.className = 'mega-interface-inline hidden';
    inline.innerHTML = `
      <div class="mega-inline-title">Interface do mapa</div>
      <button id="megaToggleMinimapBtn" type="button">Minimapa: ligado</button>
      <button id="megaToggleScaleBtn" type="button">Escala gráfica: ligada</button>
      <button id="megaFullscreenBtn" type="button">Tela cheia</button>`;
    button.insertAdjacentElement('afterend', inline);

    const refreshLabels = () => {
      const mini = $('megaToggleMinimapBtn');
      const scale = $('megaToggleScaleBtn');
      if (mini) mini.textContent = `Minimapa: ${prefs.showMinimap ? 'ligado' : 'desligado'}`;
      if (scale) scale.textContent = `Escala gráfica: ${prefs.showScale ? 'ligada' : 'desligada'}`;
    };

    button.addEventListener('click', () => {
      inline.classList.toggle('hidden');
      refreshLabels();
    });
    $('megaToggleMinimapBtn')?.addEventListener('click', () => {
      prefs.showMinimap = !prefs.showMinimap;
      writePrefs(prefs); applyPrefs(); refreshLabels();
      toast(`Minimapa ${prefs.showMinimap ? 'ligado' : 'desligado'}.`);
    });
    $('megaToggleScaleBtn')?.addEventListener('click', () => {
      prefs.showScale = !prefs.showScale;
      writePrefs(prefs); applyPrefs(); refreshLabels();
      toast(`Escala gráfica ${prefs.showScale ? 'ligada' : 'desligada'}.`);
    });
    $('megaFullscreenBtn')?.addEventListener('click', toggleFullscreen);
    refreshLabels();
  }

  function ensureResizeHandle() {
    const panel = $('geoSidePanel');
    const workspace = qs('.geo-workspace');
    if (!panel || $('megaPanelResizeHandle')) return;
    const handle = document.createElement('div');
    handle.id = 'megaPanelResizeHandle';
    handle.title = 'Arraste para redimensionar o painel';
    panel.appendChild(handle);
    let active = false;
    handle.addEventListener('pointerdown', (event) => {
      active = true; handle.setPointerCapture(event.pointerId); document.body.classList.add('mega-resizing');
    });
    handle.addEventListener('pointermove', (event) => {
      if (!active) return;
      const left = workspace?.getBoundingClientRect().left || 0;
      const width = Math.max(280, Math.min(520, event.clientX - left));
      document.body.style.setProperty('--panel-w', `${width}px`);
      document.documentElement.style.setProperty('--panel-w', `${width}px`);
      panel.style.width = `${width}px`; panel.style.minWidth = `${width}px`; panel.style.maxWidth = `${width}px`;
      prefs.panelWidth = width; writePrefs(prefs);
      getMap()?.invalidateSize?.();
    });
    handle.addEventListener('pointerup', () => { active = false; document.body.classList.remove('mega-resizing'); });
  }

  let minimap;
  function ensureMinimap() {
    if ($('megaMiniMap')) return;
    const div = document.createElement('div');
    div.id = 'megaMiniMap';
    div.className = 'mega-minimap';
    div.innerHTML = '<span>Minimapa</span><div id="megaMiniMapCanvas"></div>';
    qs('.geo-map-stage')?.appendChild(div);
    // RC10 V37 — o minimapa também usa tiles remotos. Criá-lo antes do
    // `window.load` fazia essas imagens participarem do carregamento principal e,
    // quando o servidor demorava, o navegador mantinha a aba em loading contínuo.
    const mountMiniMap = () => {
      setTimeout(() => {
        const main = getMap();
        if (!main || !window.L || minimap) return;
        minimap = L.map('megaMiniMapCanvas', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(minimap);
        const sync = () => {
          const z = Math.max(2, main.getZoom() - 5);
          minimap.setView(main.getCenter(), z, { animate: false });
        };
        main.on('moveend zoomend', sync); sync();
      }, 0);
    };
    if (document.readyState === 'complete') mountMiniMap();
    else window.addEventListener('load', mountMiniMap, { once: true });
  }
  function updateMiniMapVisibility() {
    ensureMinimap();
    const div = $('megaMiniMap');
    if (div) div.hidden = !prefs.showMinimap;
  }

  let scaleControlAdded = false;
  function ensureCompassScale() {
    if (!$('megaCompass')) {
      const compass = document.createElement('div');
      compass.id = 'megaCompass'; compass.className = 'mega-compass'; compass.innerHTML = '<b>N</b><span>▲</span>';
      qs('.geo-map-stage')?.appendChild(compass);
    }
    const map = getMap();
    if (map && window.L && !scaleControlAdded) {
      L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(map);
      scaleControlAdded = true;
    }
  }
  function updateCompassScaleVisibility() {
    ensureCompassScale();
    const c = $('megaCompass'); if (c) c.hidden = !prefs.showCompass;
    document.body.classList.toggle('mega-hide-leaflet-scale', !prefs.showScale);
  }

  function openGlobalSearch() {
    let dialog = $('megaGlobalSearchDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'megaGlobalSearchDialog';
      dialog.className = 'mega-search-dialog';
      dialog.innerHTML = `
      <form method="dialog"><div class="mega-dialog-head"><b>Pesquisa global</b><button>×</button></div></form>
      <input id="megaGlobalSearchInput" placeholder="Buscar módulo, ferramenta ou recurso...">
      <div id="megaGlobalSearchResults" class="mega-search-results"></div>`;
      document.body.appendChild(dialog);
      $('megaGlobalSearchInput')?.addEventListener('input', renderSearchResults);
    }
    dialog.showModal();
    setTimeout(() => { $('megaGlobalSearchInput')?.focus(); renderSearchResults(); }, 50);
  }
  const searchItems = [
    ['Mapa e Cadastro', '/mapa/', 'Abrir módulo principal de mapa'], ['Minha Nuvem', '/nuvem/', 'Arquivos e Google Drive'], ['Administração', '/admin/', 'Painel administrativo'], ['Personalização', '/customizacao/', 'Logo, cores e modelos'],
    ['Desenhar', '#toolsMenuBtn', 'Ferramentas de desenho'], ['CAD', '#cadToolsMenuBtn', 'Edição geométrica'], ['SIG', '#sigToolsMenuBtn', 'Operações espaciais'], ['Terreno', '#terrainToolsMenuBtn', 'Altimetria e relevo'],
    ['Projeto', '#project', 'Compartilhamento, versões e ZIP'], ['Interface', '#megaInterfaceBtn', 'Preferências, tema e atalhos']
  ];
  function renderSearchResults() {
    const term = ($('megaGlobalSearchInput')?.value || '').toLowerCase();
    const list = $('megaGlobalSearchResults'); if (!list) return;
    const filtered = searchItems.filter((item) => item.join(' ').toLowerCase().includes(term)).slice(0, 12);
    list.innerHTML = filtered.map((item) => `<button type="button" data-target="${item[1]}"><b>${item[0]}</b><span>${item[2]}</span></button>`).join('') || '<p>Nada encontrado.</p>';
    qsa('[data-target]', list).forEach((btn) => btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      $('megaGlobalSearchDialog')?.close();
      if (target.startsWith('/')) location.href = target;
      else if (target === '#project') qs('.top-project-menu')?.setAttribute('open', '');
      else qs(target)?.click?.();
    }));
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  function showShortcuts() {
    alert('Atalhos do Surveyor:\n\nCtrl+K: pesquisa global\nF: tela cheia\nS: selecionar\nI: identificar\nD: desenhar\nC: CAD\nG: SIG\nT: terreno\nM: medir\nEsc: cancelar ferramenta');
  }

  function bindShortcuts() {
    // Atalhos globais removidos a pedido do usuário.
    // Tela cheia permanece disponível pelo botão Interface > Tela cheia.
  }

  function addProjectExtras() {
    const list = qs('.map-project-list');
    if (!list || $('megaTrashProjectBtn')) return;
    list.insertAdjacentHTML('beforeend', `
      <button id="megaTrashProjectBtn" type="button">Enviar para lixeira</button>
      <button id="megaProjectTrashBtn" type="button">Lixeira de projetos</button>
      <button id="megaFullReportBtn" type="button">Relatório completo PDF</button>`);
    $('megaTrashProjectBtn')?.addEventListener('click', trashCurrentProject);
    $('megaProjectTrashBtn')?.addEventListener('click', showTrash);
    $('megaFullReportBtn')?.addEventListener('click', printFullReport);
  }
  function getProjectKey() { return new URLSearchParams(location.search).get('project') || ''; }
  async function trashCurrentProject() {
    const projectId = getProjectKey();
    if (!projectId) return toast('Salve o projeto antes de enviá-lo para a lixeira.', 'info');
    if (!window.GeoRuralAuth?.deleteProject) return toast('Serviço de projetos indisponível.', 'error');
    const name = $('propertyName')?.value || 'Projeto sem nome';
    if (!window.confirm(`Enviar “${name}” para a lixeira?`)) return;
    try {
      await window.GeoRuralAuth.deleteProject(projectId);
      toast('Projeto enviado para a lixeira.', 'success');
      setTimeout(() => { location.href = '/mapa/'; }, 500);
    } catch (error) {
      toast(error?.message || 'Não foi possível enviar o projeto para a lixeira.', 'error');
    }
  }
  async function showTrash() {
    if (!window.GeoRuralAuth?.listTrashedProjects) return toast('Serviço de lixeira indisponível.', 'error');
    try {
      const trash = await window.GeoRuralAuth.listTrashedProjects();
      if (!trash.length) return window.alert('Lixeira de projetos\n\nNenhum projeto na lixeira.');
      const lines = trash.map((project, index) => `${index + 1}. ${project.propertyName || project.name || 'Projeto sem nome'} — ${new Date(project.updatedAt || Date.now()).toLocaleDateString('pt-BR')}`);
      const choice = window.prompt(`Lixeira de projetos\n\n${lines.join('\n')}\n\nDigite o número do projeto que deseja restaurar ou deixe vazio para fechar:`);
      if (!choice) return;
      const index = Number(choice) - 1;
      if (!Number.isInteger(index) || !trash[index]) return toast('Seleção inválida.', 'info');
      const project = await window.GeoRuralAuth.restoreProject(trash[index].id || trash[index].$id);
      toast('Projeto restaurado.', 'success');
      if (project?.id) setTimeout(() => { location.href = `/mapa/?project=${encodeURIComponent(project.id)}`; }, 450);
    } catch (error) {
      toast(error?.message || 'Não foi possível carregar a lixeira.', 'error');
    }
  }
  function printFullReport() {
    const name = $('propertyName')?.value || 'Projeto sem nome';
    const owner = [$('ownerName')?.value, $('additionalOwnerName')?.value].filter(value=>String(value||'').trim()).join(' / ') || 'Não informado';
    const city = `${$('city')?.value || ''}/${$('uf')?.value || ''}`.replace(/^\//, '').replace(/\/$/, '');
    const html = `<!doctype html><html><head><title>Relatório completo - ${name}</title><style>body{font-family:Arial,sans-serif;padding:36px;color:#0f172a}h1{text-align:center}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{border:1px solid #cbd5e1;padding:8px;text-align:left}.sign{margin-top:70px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.line{border-top:1px solid #111;text-align:center;padding-top:8px}</style></head><body><h1>RELATÓRIO COMPLETO DO PROJETO</h1><table><tr><th>Projeto</th><td>${name}</td></tr><tr><th>Proprietário</th><td>${owner}</td></tr><tr><th>Município/UF</th><td>${city || 'Não informado'}</td></tr><tr><th>Área total</th><td>${$('totalArea')?.textContent || '-'}</td></tr><tr><th>Perímetro selecionado</th><td>${$('selectedPerimeter')?.textContent || '-'}</td></tr><tr><th>Elementos</th><td>${$('totalElements')?.textContent || '-'}</td></tr><tr><th>Vértices</th><td>${$('totalVertices')?.textContent || '-'}</td></tr></table><h2>Histórico e documentos</h2><p>Relatório consolidado auxiliar com dados e informações disponíveis no projeto.</p><div class="sign"><div class="line">Responsável técnico</div><div class="line">Contratante / Cliente</div></div></body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.addEventListener('load', () => setTimeout(() => win.print(), 250), { once: true });
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  }
  function init() {
    ensureSettingsPanel();
    ensureResizeHandle();
    ensureMinimap();
    ensureCompassScale();
    bindShortcuts();
    addProjectExtras();
    applyPrefs();
    setTimeout(() => getMap()?.invalidateSize?.(), 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
