(() => {
  'use strict';
  if (document.body?.dataset?.page !== 'mapa.html') return;
  if (window.__SURVEYOR_MAP_WORKSPACE_CLEAN_2115__) return;
  window.__SURVEYOR_MAP_WORKSPACE_CLEAN_2115__ = true;

  const $ = (id) => document.getElementById(id);
  const panel = $('geoSidePanel');
  const workspace = document.querySelector('.geo-workspace');
  const scroll = panel?.querySelector('.sidepanel-scroll');
  const panelTitle = $('svContextPanelTitle');
  const panelIcon = $('svContextPanelIcon');
  const closeButton = $('svContextPanelClose');
  const legacySave = $('saveBtn');
  const legacyAddLayer = $('toggleLayersPanel');
  const propertyName = $('propertyName');
  let activePanel = null;
  let highlightLayer = null;
  let highlightHalo = null;
  let highlightMarker = null;
  let carSearchToken = 0;
  let carSearchController = null;
  let activeToolbarTool = null;
  let toastTimer = null;

  const panelConfig = {
    project: { title: 'Projeto', icon: '<svg viewBox="0 0 24 24"><path d="M4 5h6l2 2h8v12H4V5Z"/><path d="M8 11h8M8 15h5"/></svg>' },
    layers: { title: 'Camadas', icon: '<svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 11 8 4 8-4M4 15l8 4 8-4"/></svg>' },
    glebas: { title: 'Gleba', icon: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4Z"/><path d="M12 4v16M4 12h16"/></svg>' },
    tools: { title: 'Ferramentas', icon: '<svg viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-4-4 3-3Z"/></svg>' }
  };

  function getMap() { return window.surveyorMapInstance || window.georuralMapInstance || null; }

  function showToast(message, type = 'info') {
    let node = $('svMapContextToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'svMapContextToast';
      document.body.appendChild(node);
    }
    node.textContent = String(message || '');
    node.dataset.type = type;
    node.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('visible'), 3200);
  }

  function resizeMapSoon() {
    requestAnimationFrame(() => {
      const map = getMap();
      try { map?.invalidateSize?.({ animate: false }); } catch {}
      window.dispatchEvent(new Event('resize'));
    });
  }

  function clearTransientToolbarActive(except = null) {
    const toolbar = document.querySelector('.sv-map-toolbar-modern');
    if (!toolbar) return;
    toolbar.querySelectorAll('.sv-tool-active').forEach((node) => {
      if (node !== except) node.classList.remove('sv-tool-active');
    });
    if (!except) activeToolbarTool = null;
  }

  function setTransientToolbarActive(node, active = true) {
    if (!node) return;
    clearTransientToolbarActive(active ? node : null);
    node.classList.toggle('sv-tool-active', Boolean(active));
    activeToolbarTool = active ? node : null;
  }

  function syncToolbarActive() {
    const toolbar = document.querySelector('.sv-map-toolbar-modern');
    if (!toolbar) return;
    toolbar.querySelectorAll('.sv-panel-active').forEach((node) => node.classList.remove('sv-panel-active'));
    if (!activePanel || panel?.classList.contains('collapsed')) return;
    if (activePanel === 'project') toolbar.querySelector('[data-proxy-for="saveBtn"]')?.classList.add('sv-panel-active');
    if (activePanel === 'layers') findToolbarButton('Camadas')?.classList.add('sv-panel-active');
    if (activePanel === 'glebas') toolbar.querySelector('.sv-map-toolbar-more')?.classList.add('sv-panel-active');
  }

  function closePanel() {
    if (!panel || !workspace) return;
    panel.classList.add('collapsed');
    panel.setAttribute('aria-hidden', 'true');
    workspace.classList.add('panel-collapsed');
    document.body.classList.add('map-panel-collapsed');
    activePanel = null;
    const addLayerHeader = $('svAddLayerFromPanel');
    if (addLayerHeader) addLayerHeader.hidden = true;
    syncToolbarActive();
    resizeMapSoon();
  }

  function openPanel(name, options = {}) {
    if (!panel || !workspace || !panelConfig[name]) return;
    const toggle = options.toggle !== false;
    if (toggle && activePanel === name && !panel.classList.contains('collapsed')) {
      closePanel();
      return;
    }
    panel.querySelectorAll('[data-side-panel]').forEach((section) => {
      section.classList.toggle('active', section.dataset.sidePanel === name);
    });
    panel.querySelectorAll('[data-side-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.sideTab === name);
    });
    panelTitle.textContent = panelConfig[name].title;
    panelIcon.innerHTML = panelConfig[name].icon;
    panel.classList.remove('collapsed');
    panel.setAttribute('aria-hidden', 'false');
    workspace.classList.remove('panel-collapsed');
    document.body.classList.remove('map-panel-collapsed');
    activePanel = name;
    const addLayerHeader = $('svAddLayerFromPanel');
    if (addLayerHeader) addLayerHeader.hidden = name !== 'layers';
    if (scroll) scroll.scrollTop = 0;
    syncToolbarActive();
    resizeMapSoon();
    if (name === 'project' && options.focusName) setTimeout(() => propertyName?.focus(), 120);
  }

  function findToolbarButton(label) {
    return [...document.querySelectorAll('.sv-map-toolbar-modern .sv-map-toolbar-item')]
      .find((button) => button.querySelector('.sv-map-label')?.textContent?.trim() === label) || null;
  }


  const DRAW_GUIDE_SIZE_KEY = 'surveyor:map:draw-guide-size:v1';
  const DRAW_GUIDE_MIN = 6;
  const DRAW_GUIDE_MAX = 26;
  const DRAW_GUIDE_DEFAULT = 16;

  function clampDrawGuideSize(value) {
    return Math.max(DRAW_GUIDE_MIN, Math.min(DRAW_GUIDE_MAX, Math.round(Number(value) || DRAW_GUIDE_DEFAULT)));
  }

  function readDrawGuideSize() {
    try { return clampDrawGuideSize(localStorage.getItem(DRAW_GUIDE_SIZE_KEY)); }
    catch (_error) { return DRAW_GUIDE_DEFAULT; }
  }

  function applyDrawGuideSize(value, { persist = false } = {}) {
    const size = clampDrawGuideSize(value);
    document.documentElement.style.setProperty('--surveyor-draw-guide-size', `${size}px`);
    if (persist) {
      try { localStorage.setItem(DRAW_GUIDE_SIZE_KEY, String(size)); } catch (_error) {}
    }
    window.dispatchEvent(new CustomEvent('surveyor:draw-guide-size', { detail: { size } }));
    return size;
  }

  function closeDrawGuideRegulator() {
    document.getElementById('svDrawGuideRegulator')?.remove();
    document.body.classList.remove('sv-draw-guide-regulator-open');
  }

  function positionDrawGuideRegulator(node, anchor) {
    if (!node || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 7;
    const width = Math.max(190, node.offsetWidth || 210);
    let left = rect.left + (rect.width / 2) - (width / 2);
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
    let top = rect.bottom + gap;
    if (top + (node.offsetHeight || 72) > window.innerHeight - 8) top = Math.max(8, rect.top - (node.offsetHeight || 72) - gap);
    node.style.left = `${Math.round(left)}px`;
    node.style.top = `${Math.round(top)}px`;
  }

  function openDrawGuideRegulator(anchor) {
    closeDrawGuideRegulator();
    const popup = document.createElement('div');
    popup.id = 'svDrawGuideRegulator';
    popup.className = 'sv-draw-guide-regulator';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Regular precisão do desenho');
    popup.innerHTML = '<button type="button" class="sv-draw-guide-regulator-entry" data-action="open-slider">Regular</button>';
    document.body.appendChild(popup);
    document.body.classList.add('sv-draw-guide-regulator-open');
    positionDrawGuideRegulator(popup, anchor);

    popup.querySelector('[data-action="open-slider"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = readDrawGuideSize();
      popup.innerHTML = `<div class="sv-draw-guide-regulator-head"><strong>Regular precisão</strong><output data-draw-guide-size-output>${current}px</output></div><input type="range" min="${DRAW_GUIDE_MIN}" max="${DRAW_GUIDE_MAX}" step="1" value="${current}" data-draw-guide-size aria-label="Tamanho do guia de desenho"><div class="sv-draw-guide-regulator-scale"><span>menor</span><span>maior</span></div>`;
      const slider = popup.querySelector('[data-draw-guide-size]');
      const output = popup.querySelector('[data-draw-guide-size-output]');
      slider?.addEventListener('input', () => {
        const size = applyDrawGuideSize(slider.value, { persist: true });
        if (output) output.textContent = `${size}px`;
      });
      positionDrawGuideRegulator(popup, anchor);
      slider?.focus();
    });

    const closeOnPointer = (event) => {
      if (popup.contains(event.target) || anchor.contains(event.target)) return;
      document.removeEventListener('pointerdown', closeOnPointer, true);
      closeDrawGuideRegulator();
    };
    requestAnimationFrame(() => document.addEventListener('pointerdown', closeOnPointer, true));
  }

  function enhanceProjectPanel() {
    const section = panel?.querySelector('[data-side-panel="project"] .compact-section');
    if (!section || section.querySelector('.sv-project-save-actions')) return;
    const heading = section.querySelector('.compact-heading b');
    if (heading) heading.textContent = 'Dados do projeto';
    const action = document.createElement('div');
    action.className = 'sv-project-save-actions';
    action.innerHTML = '<button type="button" id="svProjectConfirmSave"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-7h8v7"/></svg><span>Salvar projeto</span></button>';
    section.appendChild(action);
    const nextSection = panel.querySelector('[data-side-panel="project"] .compact-section:nth-of-type(2) .compact-fields');
    if (nextSection && !nextSection.querySelector('.sv-next-drawing-note')) {
      const note = document.createElement('p');
      note.className = 'field-hint sv-next-drawing-note';
      note.textContent = 'Após salvar o projeto, você pode começar a desenhar no mapa usando as ferramentas da barra superior.';
      nextSection.appendChild(note);
    }
    $('svProjectConfirmSave')?.addEventListener('click', () => {
      if (!String(propertyName?.value || '').trim()) {
        showToast('Informe o nome do projeto para salvar.', 'error');
        propertyName?.focus();
        return;
      }
      legacySave?.click();
    });
  }

  function enhanceLayersPanel() {
    const section = panel?.querySelector('[data-side-panel="layers"] .compact-section');
    const list = $('layerList');
    const head = $('svContextPanelHead');
    if (!section || !list || !head) return;
    if (!$('svAddLayerFromPanel')) {
      const add = document.createElement('button');
      add.type = 'button';
      add.id = 'svAddLayerFromPanel';
      add.className = 'sv-layer-header-add';
      add.hidden = activePanel !== 'layers';
      add.setAttribute('aria-label', 'Adicionar camada');
      add.setAttribute('title', 'Adicionar camada');
      add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
      head.insertBefore(add, closeButton || null);
      add.addEventListener('click', () => legacyAddLayer?.click());
    }
    section.querySelector('.sv-layer-panel-actions')?.remove();
  }

  function decorateQuickDrawer() {
    const grid = $('mapQuickToolsGrid');
    if (!grid || grid.dataset.svContextEntries === '1') return Boolean(grid);
    // Wait for the production quick-tools builder to populate its controls first.
    if (!grid.children.length) return false;
    grid.dataset.svContextEntries = '1';
    const entries = [
      ['glebas', 'Glebas', '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4Z"/><path d="M12 4v16M4 12h16"/></svg>'],
      ['tools', 'Ferramentas avançadas', '<svg viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-4-4 3-3Z"/></svg>']
    ];
    entries.forEach(([name, label, svg]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `map-quick-grid-tool sv-context-launcher sv-context-${name}`;
      if (name === 'glebas') button.classList.add('sv-context-glebas');
      if (name === 'tools') button.classList.add('sv-context-tools');
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.innerHTML = svg;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPanel(name, { toggle: false });
        const drawer = $('mapQuickToolsDrawer');
        const more = document.querySelector('.sv-map-toolbar-more');
        drawer?.classList.add('hidden');
        drawer?.setAttribute('aria-hidden', 'true');
        more?.setAttribute('aria-expanded', 'false');
      });
      grid.appendChild(button);
    });
    return true;
  }

  function bindAdvancedToolsMenu() {
    const menu = $('svAdvancedToolsMenu');
    if (!menu || menu.dataset.bound === '1') return Boolean(menu);
    menu.dataset.bound = '1';
    menu.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-advanced-selector]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const selector = String(button.dataset.advancedSelector || '').trim();
      const target = selector ? document.querySelector(selector) : null;
      if (!target) { showToast('Ferramenta indisponível neste momento.', 'error'); return; }
      closePanel();
      requestAnimationFrame(() => target.click());
    });
    return true;
  }

  function bindModernToolbar() {
    const toolbar = document.querySelector('.sv-map-toolbar-modern');
    if (!toolbar || toolbar.dataset.svContextBound === '1') return false;
    toolbar.dataset.svContextBound = '1';

    const saveProxy = toolbar.querySelector('[data-proxy-for="saveBtn"]');
    saveProxy?.addEventListener('click', (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      clearTransientToolbarActive();
      openPanel('project', { focusName: !String(propertyName?.value || '').trim() });
    }, true);

    const layers = findToolbarButton('Camadas');
    layers?.addEventListener('click', (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      clearTransientToolbarActive();
      openPanel('layers');
    }, true);

    const polygon = findToolbarButton('Polígono');
    polygon?.addEventListener('click', (event) => {
      if (polygon.classList.contains('sv-tool-active')) {
        event.preventDefault(); event.stopImmediatePropagation();
        polygon.classList.remove('sv-tool-active'); activeToolbarTool = null;
        try { $('cancelToolBtn')?.click(); } catch {}
        return;
      }
      closeDrawGuideRegulator();
      closePanel();
      setTransientToolbarActive(polygon, true);
    }, true);
    polygon?.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openDrawGuideRegulator(polygon);
    }, true);

    const point = findToolbarButton('Marcar ponto');
    point?.addEventListener('click', () => {
      closePanel();
      requestAnimationFrame(() => {
        const open = !$('gpsPointDialog')?.classList.contains('hidden');
        setTransientToolbarActive(point, open);
      });
    }, true);

    const more = toolbar.querySelector('.sv-map-toolbar-more');
    more?.addEventListener('click', () => {
      requestAnimationFrame(() => {
        const open = more.getAttribute('aria-expanded') === 'true';
        setTransientToolbarActive(more, open);
      });
    }, true);

    toolbar.querySelectorAll('details').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (details.open) setTransientToolbarActive(details, true);
        else if (details.classList.contains('sv-tool-active')) setTransientToolbarActive(details, false);
      });
    });

    toolbar.addEventListener('click', (event) => {
      const item = event.target.closest('.sv-map-toolbar-item');
      if (!item || item === saveProxy || item === layers || item === polygon || item === point || item === more) return;
      // Ações pontuais não representam um modo ativo. O destaque azul só é
      // mantido para painéis, menus ou ferramentas que realmente continuam
      // abertos depois do clique.
      if (item.dataset.svActivation === 'action') clearTransientToolbarActive();
    });

    window.addEventListener('surveyor:gps-panel-visibility', (event) => {
      const open = Boolean(event.detail?.visible);
      setTransientToolbarActive(point, open);
    });
    window.addEventListener('surveyor:map-tool-cancelled', () => clearTransientToolbarActive());
    window.addEventListener('surveyor:map-tool-finished', () => clearTransientToolbarActive());

    syncToolbarActive();
    return true;
  }

  function normalizeCar(value) {
    const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    const match = raw.match(/^([A-Z]{2})[-.]?(\d{7})[-.]?(.+)$/);
    if (!match) return raw;
    const suffix = String(match[3] || '').replace(/[^A-Z0-9]/g, '');
    return `${match[1]}-${match[2]}-${suffix}`;
  }
  function formatCarDotted(value) {
    const car = normalizeCar(value);
    const match = car.match(/^([A-Z]{2}-\d{7}-)([A-Z0-9]{32})$/);
    if (!match) return car;
    return match[1] + (match[2].match(/.{1,4}/g) || []).join('.');
  }
  function carStateCode(value) {
    const normalized = normalizeCar(value);
    const code = String(normalized || '').slice(0, 2).toUpperCase();
    return /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(code) ? code : '';
  }
  function selectedSicarStateCode() {
    const code = String(window.GeoRuralAuth?.getLayerCatalogState?.() || 'BA').trim().toUpperCase();
    return /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(code) ? code : 'BA';
  }
  function looksLikeCar(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!/^[A-Z]{2}(?:[-.]|\d)/.test(raw)) return false;
    return Boolean(carStateCode(value));
  }
  function isCar(value) { return /^[A-Z]{2}-\d{7}-[A-Z0-9]{32}$/.test(normalizeCar(value)) && Boolean(carStateCode(value)); }
  function sicarTypeName(car = '') {
    const code = carStateCode(car) || selectedSicarStateCode();
    return `sicar:sicar_imoveis_${code.toLowerCase()}`;
  }

  function clearCarHighlight(options = {}) {
    const cancelSearch = options?.cancelSearch === true;
    if (cancelSearch) {
      carSearchToken += 1;
      try { carSearchController?.abort?.(); } catch {}
      carSearchController = null;
    }
    const map = getMap();
    [highlightMarker, highlightLayer, highlightHalo].forEach((layer) => {
      if (!layer || !map) return;
      try { map.removeLayer(layer); } catch {}
    });
    highlightMarker = highlightLayer = highlightHalo = null;
    if (cancelSearch) window.dispatchEvent(new CustomEvent('surveyor:map-search-result', { detail: { type: 'none' } }));
  }

  function ensureCarPanes(map) {
    if (!map.getPane('svCarSearchHalo')) {
      map.createPane('svCarSearchHalo');
      map.getPane('svCarSearchHalo').style.zIndex = '730';
      map.getPane('svCarSearchHalo').style.pointerEvents = 'none';
    }
    if (!map.getPane('svCarSearchResult')) {
      map.createPane('svCarSearchResult');
      map.getPane('svCarSearchResult').style.zIndex = '740';
      // O vermelho é somente destaque visual: não pode bloquear o clique
      // nos imóveis amarelos usados pela ferramenta de informações.
      map.getPane('svCarSearchResult').style.pointerEvents = 'none';
    }
    if (!map.getPane('svCarSearchMarker')) {
      map.createPane('svCarSearchMarker');
      map.getPane('svCarSearchMarker').style.zIndex = '760';
    }
    if (!map.getPane('svCarPopup')) {
      map.createPane('svCarPopup');
      map.getPane('svCarPopup').style.zIndex = '980';
      map.getPane('svCarPopup').style.pointerEvents = 'auto';
    }
  }

  function carWfsUrl(car) {
    const compact = normalizeCar(car);
    const safe = String(compact).replace(/'/g, "''");
    const params = new URLSearchParams({
      service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName: sicarTypeName(car),
      outputFormat: 'application/json', srsName: 'EPSG:4326', maxFeatures: '2',
      CQL_FILTER: `cod_imovel='${safe}'`
    });
    return `https://geoserver.car.gov.br/geoserver/sicar/ows?${params.toString()}`;
  }

  function carGeoservicesBase() {
    return String(window.GEORURAL_CONFIG?.geoservicesBaseUrl || window.GEORURAL_GEOSERVICES_URL || '').replace(/\/+$/, '');
  }

  function base64UrlEncodeCar(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function carWfsCandidateUrls(car) {
    const upstream = carWfsUrl(car);
    const base = carGeoservicesBase();
    return [...new Set([
      base ? (typeof window.GEORURAL_SECURE_GEOSERVICES_URL === 'function' ? window.GEORURAL_SECURE_GEOSERVICES_URL(`${base}/wfs-url/${base64UrlEncodeCar(upstream)}`) : `${base}/wfs-url/${base64UrlEncodeCar(upstream)}`) : '',
      upstream
    ].filter(Boolean))];
  }

  async function readBoundedResponseText(response, maxBytes = 1_500_000) {
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > maxBytes) throw new Error('O SICAR retornou dados demais para esta consulta.');
    if (!response.body?.getReader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('O SICAR retornou dados demais para esta consulta.');
      return text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let bytes = 0;
    let text = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value?.byteLength || 0;
        if (bytes > maxBytes) {
          try { await reader.cancel(); } catch {}
          throw new Error('O SICAR retornou dados demais para esta consulta.');
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      return text;
    } finally {
      try { reader.releaseLock?.(); } catch {}
    }
  }

  async function fetchCarGeometryCandidate(car, signal) {
    let lastError = null;
    for (const url of carWfsCandidateUrls(car)) {
      try {
        const response = await fetch(url, { cache: 'no-store', mode: 'cors', credentials: 'omit', signal, headers: { Accept: 'application/geo+json,application/json;q=0.9,*/*;q=0.1' } });
        if (!response.ok) throw new Error(`SICAR respondeu HTTP ${response.status}`);
        const text = await readBoundedResponseText(response, 1_500_000);
        const payload = JSON.parse(text);
        const features = Array.isArray(payload?.features) ? payload.features : [];
        const exact = features.find((item) => normalizeCar(item?.properties?.cod_imovel || '') === normalizeCar(car)) || null;
        if (exact) return exact;
        if (features[0]) return features[0];
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Imóvel não encontrado no serviço público do SICAR.');
  }

  function compactCarLabel(value) {
    const text = String(value || '');
    if (text.length <= 34) return text;
    return `${text.slice(0, 17)}…${text.slice(-10)}`;
  }

  function escapeAttr(value) {
    return String(value ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function selectedCarPopup(car, properties = {}) {
    const municipality = properties.municipio || properties.nom_munici || properties.municipio_nome || '';
    const stateCode = carStateCode(car) || selectedSicarStateCode();
    const place = municipality ? `${String(municipality)} / ${stateCode}` : stateCode;
    const fullCar = normalizeCar(car);
    return `<div class="sv-car-selected-card"><strong>Imóvel selecionado</strong><span>${place}</span><button type="button" class="sv-car-copy-code" data-copy-car="${escapeAttr(fullCar)}" title="Clique para copiar o número completo do CAR"><code>${compactCarLabel(fullCar)}</code><small>Copiar CAR</small></button></div>`;
  }

  async function searchCarOnMap(rawValue) {
    const car = normalizeCar(rawValue);
    if (!isCar(car)) return false;
    const carUf = carStateCode(car);
    const selectedUf = selectedSicarStateCode();
    if (carUf !== selectedUf) {
      showToast(`Este CAR pertence a ${carUf}. Selecione ${carUf} no catálogo de camadas antes de pesquisar.`, 'info');
      return true;
    }
    window.SurveyorMapSearch?.clearCoordinateResult?.({ clearInput: false });
    window.SurveyorMapSearch?.clearPropertyNameResult?.();
    const token = ++carSearchToken;
    carSearchController?.abort();
    carSearchController = new AbortController();
    const signal = carSearchController.signal;
    const map = getMap();
    if (!map || !window.L) {
      showToast('O mapa ainda está carregando. Tente novamente em alguns segundos.', 'info');
      return true;
    }
    ensureCarPanes(map);
    clearCarHighlight();
    showToast('Localizando o imóvel CAR…', 'info');
    const input = $('coordSearch');
    if (input) input.value = car;
    try {
      // Quando a Pesquisa rápida da UF estiver instalada, o CAR é procurado
      // primeiro no IndexedDB local. A fonte oficial online permanece como
      // fallback para manter a consulta funcionando sem instalação local.
      let feature = null;
      let lastError = null;
      try {
        const cache = window.SurveyorPropertyLocalCache;
        const manifest = await cache?.getManifest?.(carUf);
        if (manifest?.generation) {
          const localHits = await cache.search({ stateCode: carUf, query: car, limit: 5 });
          feature = localHits.find((item) => normalizeCar(item?.properties?.cod_imovel || item?.properties?.numero_car || item?.properties?.num_sicar || '') === car) || localHits[0] || null;
        }
      } catch (error) {
        console.debug('[Surveyor] CAR local indisponível; usando fonte oficial:', error?.message || error);
      }

      // Consulta diretamente o WFS público do SICAR pelo código exato do CAR
      // somente quando a base local não resolveu a pesquisa.
      const candidates = [...new Set([car, formatCarDotted(car)])];
      for (const candidate of feature?.geometry ? [] : candidates) {
        if (signal.aborted) return true;
        const timeout = new AbortController();
        const relay = () => timeout.abort();
        signal.addEventListener('abort', relay, { once: true });
        const timer = setTimeout(() => timeout.abort(), 8000);
        try {
          feature = await fetchCarGeometryCandidate(candidate, timeout.signal);
          if (feature?.geometry) break;
        } catch (error) {
          lastError = error;
        } finally {
          clearTimeout(timer);
          signal.removeEventListener('abort', relay);
        }
      }
      if (token !== carSearchToken || signal.aborted) return true;
      if (!feature?.geometry) throw lastError || new Error('Imóvel não encontrado na geometria pública do CAR.');

      const geojson = { type: 'Feature', properties: feature.properties || {}, geometry: feature.geometry };
      highlightHalo = L.geoJSON(geojson, {
        pane: 'svCarSearchHalo', interactive: false,
        style: { color: '#ffffff', weight: 5, opacity: .96, fillOpacity: 0, className: 'sv-car-search-halo' }
      }).addTo(map);
      highlightLayer = L.geoJSON(geojson, {
        pane: 'svCarSearchResult',
        interactive: false,
        style: { color: '#dc2626', weight: 3, opacity: 1, fillColor: '#ef4444', fillOpacity: .14 },
        onEachFeature: (f, layer) => layer.bindPopup(selectedCarPopup(car, f.properties || {}), { maxWidth: 230, minWidth: 0, className: 'sv-car-selected-popup', pane: 'svCarPopup', autoPan: false })
      }).addTo(map);
      const bounds = highlightLayer.getBounds?.();
      if (bounds?.isValid?.()) {
        const center = bounds.getCenter();
        const icon = L.divIcon({ className: '', html: '<span class="sv-car-search-pin" aria-hidden="true"></span>', iconSize: [30,38], iconAnchor: [15,36], popupAnchor: [0,-34] });
        highlightMarker = L.marker(center, { pane: 'svCarSearchMarker', icon, zIndexOffset: 5000, title: 'Imóvel CAR pesquisado' }).addTo(map);
        highlightMarker.bindTooltip('Imóvel CAR pesquisado', { permanent: true, direction: 'top', offset: [0,-34], className: 'sv-car-search-tooltip' });
        highlightMarker.bindPopup(selectedCarPopup(car, feature.properties || {}), { maxWidth: 230, minWidth: 0, className: 'sv-car-selected-popup', pane: 'svCarPopup', autoPan: false });
        map.fitBounds(bounds.pad(.22), { maxZoom: 18, animate: true });
      }
      highlightLayer.bringToFront?.();
      window.dispatchEvent(new CustomEvent('surveyor:map-search-result', { detail: { type: 'car' } }));
      showToast('Imóvel localizado e destacado em vermelho.', 'success');
    } catch (error) {
      if (token !== carSearchToken || signal.aborted) return true;
      console.warn('[Surveyor] Consulta CAR no mapa:', error);
      clearCarHighlight();
      showToast(error?.name === 'AbortError' ? 'A consulta foi cancelada ou demorou além do esperado.' : (error?.message || 'Não foi possível localizar este imóvel CAR.'), 'error');
    }
    return true;
  }


  function bindCarCopyAction() {
    if (document.body.dataset.svCarCopyBound === '1') return;
    document.body.dataset.svCarCopyBound = '1';
    document.addEventListener('click', async (event) => {
      const button = event.target.closest?.('[data-copy-car]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const value = String(button.dataset.copyCar || '').trim();
      if (!value) return;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
        else {
          const input = document.createElement('textarea');
          input.value = value; input.setAttribute('readonly','');
          input.style.position='fixed'; input.style.opacity='0';
          document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
        }
        button.classList.add('copied');
        const label = button.querySelector('small');
        const previous = label?.textContent || '';
        if (label) label.textContent = 'CAR copiado';
        showToast('Número do CAR copiado.', 'success');
        setTimeout(() => { button.classList.remove('copied'); if (label) label.textContent = previous || 'Copiar CAR'; }, 1500);
      } catch (error) {
        console.warn('[Surveyor] Falha ao copiar CAR:', error);
        showToast('Não foi possível copiar automaticamente. Selecione o número do CAR.', 'error');
      }
    });
  }

  function toDms(value, latitude) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    const abs = Math.abs(number);
    const degrees = Math.floor(abs);
    const minutesFloat = (abs - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = (minutesFloat - minutes) * 60;
    const hemisphere = latitude ? (number < 0 ? 'S' : 'N') : (number < 0 ? 'W' : 'E');
    return `${degrees}°${String(minutes).padStart(2,'0')}'${seconds.toFixed(2)}\"${hemisphere}`;
  }

  function niceDistance(maxMeters) {
    const value = Math.max(0, Number(maxMeters) || 0);
    if (!value) return 0;
    const pow10 = Math.pow(10, Math.floor(Math.log(value) / Math.LN10));
    let d = value / pow10;
    if (d >= 10) d = 10;
    else if (d >= 5) d = 5;
    else if (d >= 3) d = 3;
    else if (d >= 2) d = 2;
    else d = 1;
    return pow10 * d;
  }

  function formatDistance(meters) {
    const n = Number(meters) || 0;
    if (n >= 1000) return `${(n / 1000).toLocaleString('pt-BR',{maximumFractionDigits:n % 1000 ? 1 : 0})} km`;
    return `${Math.round(n).toLocaleString('pt-BR')} m`;
  }

  function scaleInfo(map, lat) {
    const zoom = Number(map?.getZoom?.() ?? 0);
    const metersPerPixel = Math.cos(Number(lat || 0) * Math.PI / 180) * 2 * Math.PI * 6378137 / (256 * Math.pow(2, zoom));
    const denominator = Math.max(1, Math.round(metersPerPixel / 0.0002645833333));
    const roundedDen = denominator >= 1000 ? Math.round(denominator / 1000) * 1000 : Math.round(denominator / 100) * 100;
    return {
      ratio: `1:${Math.max(100, roundedDen).toLocaleString('pt-BR')}`,
      wide: formatDistance(niceDistance(metersPerPixel * 160)),
      compact: formatDistance(niceDistance(metersPerPixel * 100))
    };
  }

  function utmInfo(lat, lng) {
    const zone = Math.max(1, Math.min(60, Math.floor((Number(lng) + 180) / 6) + 1));
    const band = Number(lat) < 0 ? 'S' : 'N';
    try {
      if (window.proj4) {
        const target = `+proj=utm +zone=${zone} ${Number(lat)<0?'+south ':''}+datum=WGS84 +units=m +no_defs`;
        const pair = window.proj4('EPSG:4326', target, [Number(lng), Number(lat)]);
        if (Array.isArray(pair) && pair.every(Number.isFinite)) {
          return `UTM ${zone}${band} · E ${Math.round(pair[0]).toLocaleString('pt-BR')} · N ${Math.round(pair[1]).toLocaleString('pt-BR')}`;
        }
      }
    } catch (error) { console.debug?.('[Surveyor] UTM status bar:', error); }
    return `UTM ${zone}${band}`;
  }

  function installTechnicalStatusBar() {
    const map = getMap();
    const stage = document.querySelector('.geo-map-stage');
    if (!map || !stage) return false;
    let bar = $('svMapTechnicalBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'svMapTechnicalBar';
      bar.className = 'sv-map-technical-bar';
      bar.innerHTML = `
        <span class="sv-tech-online"><i></i>Sistema conectado</span>
        <span class="sv-tech-scale" id="svTechScale">Escala —</span>
        <span class="sv-tech-scale-bars" id="svTechScaleBars">—</span>
        <span class="sv-tech-decimal" id="svTechDecimal">Lat/Lon —</span>
        <span class="sv-tech-dms" id="svTechDms">DMS —</span>
        <span class="sv-tech-utm" id="svTechUtm">UTM —</span>
        <span class="sv-tech-attribution" id="svTechAttribution"></span>`;
      stage.appendChild(bar);
    }
    if (bar.dataset.bound === '1') return true;
    bar.dataset.bound = '1';

    const decimal = $('svTechDecimal'), dms = $('svTechDms'), utm = $('svTechUtm');
    const scale = $('svTechScale'), bars = $('svTechScaleBars'), attributionSlot = $('svTechAttribution');
    let last = map.getCenter?.() || { lat: -13, lng: -39.6 };

    const moveAttribution = () => {
      const node = document.querySelector('.leaflet-control-attribution');
      if (node && attributionSlot && node.parentElement !== attributionSlot) attributionSlot.appendChild(node);
    };
    const update = (latlng = last) => {
      if (latlng && Number.isFinite(latlng.lat) && Number.isFinite(latlng.lng)) last = latlng;
      const lat = Number(last.lat), lng = Number(last.lng);
      if (decimal) decimal.textContent = `DD ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      if (dms) dms.textContent = `DMS ${toDms(lat,true)} · ${toDms(lng,false)}`;
      if (utm) utm.textContent = utmInfo(lat,lng);
      const info = scaleInfo(map,lat);
      if (scale) scale.textContent = `Escala ${info.ratio}`;
      if (bars) bars.textContent = `${info.wide} · ${info.compact}`;
      moveAttribution();
    };
    map.on('mousemove', (event) => update(event.latlng));
    map.on('zoomend moveend baselayerchange layeradd', () => update(last));
    document.querySelector('#baseMapSelect')?.addEventListener('change', () => setTimeout(() => update(last), 50));
    setTimeout(() => update(last), 50);
    setTimeout(() => update(last), 500);
    return true;
  }

  function bindCarSearch() {
    const input = $('coordSearch');
    const locate = $('locateBtn');
    const suggestions = $('citySuggestBox');
    if (!input || !locate) return false;

    if (!document.getElementById('svSmartSearchMode')) {
      input.placeholder = 'Digite o nome da cidade';
    }
    input.setAttribute('aria-label', 'Pesquisar no mapa');
    input.title = 'Escolha o tipo de pesquisa no seletor destacado';

    // A pesquisa inteira pertence ao app principal. O workspace só fornece o
    // botão visual de lupa e jamais tenta adivinhar se o texto é CAR/cidade.
    // Isso evita falsos positivos como "Amargosa" (AM = código de UF).
    const runUnifiedSearch = () => {
      // O app principal conhece o modo explícito selecionado e é a única fonte
      // de roteamento. O workspace apenas encaminha o clique da lupa.
      locate.click();
    };

    const wrap = input.closest('.geo-search-input-wrap');
    let submit = wrap?.querySelector('#svMapSearchSubmit');
    if (wrap && !submit) {
      submit = document.createElement('button');
      submit.id = 'svMapSearchSubmit';
      submit.type = 'button';
      submit.title = 'Pesquisar';
      submit.setAttribute('aria-label', 'Pesquisar no mapa');
      submit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg>';
      wrap.appendChild(submit);
    }

    let clearButton = wrap?.querySelector('#svMapSearchClear');
    if (wrap && !clearButton) {
      clearButton = document.createElement('button');
      clearButton.id = 'svMapSearchClear';
      clearButton.type = 'button';
      clearButton.hidden = true;
      clearButton.title = 'Limpar resultado da consulta';
      clearButton.setAttribute('aria-label', 'Limpar resultado da consulta');
      clearButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"></path></svg>';
      wrap.appendChild(clearButton);
      clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (window.SurveyorMapSearch?.clearActiveResult) window.SurveyorMapSearch.clearActiveResult({ clearInput: true });
        else { clearCarHighlight({ cancelSearch: true }); input.value = ''; }
        clearButton.hidden = true;
        input.focus();
        showToast('Consulta limpa.', 'info');
      });
    }

    if (wrap && wrap.dataset.svSearchResultBound !== '1') {
      wrap.dataset.svSearchResultBound = '1';
      window.addEventListener('surveyor:map-search-result', (event) => {
        const type = String(event?.detail?.type || 'none');
        const visible = type === 'car' || type === 'coordinate' || type === 'property-name';
        const btn = wrap.querySelector('#svMapSearchClear');
        if (btn) btn.hidden = !visible;
        wrap.classList.toggle('has-clear-search', visible);
      });
    }

    if (input.dataset.svCarSearchBound !== '1') {
      input.dataset.svCarSearchBound = '1';
      // A lupa usa o mesmo roteador de pesquisa. Teclado, digitação e
      // sugestões ficam sob responsabilidade do app principal para existir
      // apenas um conjunto de listeners no campo (evita loop/congelamento).
      submit?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        runUnifiedSearch();
      });
    }
    return true;
  }

  function init() {
    applyDrawGuideSize(readDrawGuideSize());
    enhanceProjectPanel();
    enhanceLayersPanel();
    closeButton?.addEventListener('click', closePanel);
    // Always start with map only; existing project data remains loaded, only its panel is closed.
    closePanel();
    setTimeout(() => { if (!activePanel) closePanel(); }, 0);
    setTimeout(() => { if (!activePanel) closePanel(); }, 320);
    window.addEventListener('load', () => { if (!activePanel) closePanel(); }, { once: true });
    bindCarSearch();
    bindCarCopyAction();
    installTechnicalStatusBar();

    let attempts = 0;
    const timer = setInterval(() => {
      const toolbarReady = bindModernToolbar();
      const drawerReady = decorateQuickDrawer();
      const advancedReady = bindAdvancedToolsMenu();
      bindCarSearch();
      bindCarCopyAction();
      installTechnicalStatusBar();
      attempts += 1;
      if ((toolbarReady || document.querySelector('.sv-map-toolbar-modern')?.dataset.svContextBound === '1') &&
          (drawerReady || $('mapQuickToolsGrid')?.dataset.svContextEntries === '1') &&
          (advancedReady || $('svAdvancedToolsMenu')?.dataset.bound === '1')) {
        clearInterval(timer);
      } else if (attempts > 80) clearInterval(timer);
    }, 100);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activePanel && !panel?.classList.contains('collapsed')) closePanel();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  window.SurveyorMapWorkspace = { openPanel, closePanel, searchCar: searchCarOnMap, clearCarHighlight };
})();
