(() => {
  'use strict';

  const root = document.getElementById('territorialNavigator');
  const mapCanvas = document.getElementById('territorialMapCanvas');
  const search = document.getElementById('coordSearch');
  const suggestions = document.getElementById('citySuggestBox');
  if (!root || !mapCanvas || !search || !suggestions) return;

  const STATES = [
    ['11','RO','Rondônia'],['12','AC','Acre'],['13','AM','Amazonas'],['14','RR','Roraima'],['15','PA','Pará'],['16','AP','Amapá'],['17','TO','Tocantins'],
    ['21','MA','Maranhão'],['22','PI','Piauí'],['23','CE','Ceará'],['24','RN','Rio Grande do Norte'],['25','PB','Paraíba'],['26','PE','Pernambuco'],['27','AL','Alagoas'],['28','SE','Sergipe'],['29','BA','Bahia'],
    ['31','MG','Minas Gerais'],['32','ES','Espírito Santo'],['33','RJ','Rio de Janeiro'],['35','SP','São Paulo'],['41','PR','Paraná'],['42','SC','Santa Catarina'],['43','RS','Rio Grande do Sul'],
    ['50','MS','Mato Grosso do Sul'],['51','MT','Mato Grosso'],['52','GO','Goiás'],['53','DF','Distrito Federal']
  ].map(([id, uf, name]) => ({ id, uf, name }));
  const STATES_BY_ID = new Map(STATES.map((item) => [item.id, item]));
  const STATES_BY_UF = new Map(STATES.map((item) => [item.uf, item]));
  const LAST_KEY = 'surveyor-territorial-last-v1';
  const SESSION_SEEN_KEY = 'surveyor-territorial-seen-session-v1';
  const OPERATIONAL_VIEW_KEY = 'surveyor-operational-map-view-session-v1';
  const IBGE_MESH = 'https://servicodados.ibge.gov.br/api/v3/malhas';
  const IBGE_LOCAL = 'https://servicodados.ibge.gov.br/api/v1/localidades';
  const GEOJSON = encodeURIComponent('application/vnd.geo+json');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  // Paleta visual calibrada pela referência aprovada pelo usuário (imagem 2).
  // Os fills são opacos para a cor percebida não variar com o fundo/renderer.
  const TERRITORIAL_PALETTE = Object.freeze({
    stateStroke: '#e7eef2',
    stateFill: '#b6c1cb',
    stateActiveStroke: '#dfe9ed',
    stateActiveFill: '#aebfc6',
    municipalityStroke: '#eef3f5',
    municipalityFill: '#9fb7c1',
    municipalityActiveStroke: '#ffffff',
    municipalityActiveFill: '#89aab7'
  });

  const status = root.querySelector('[data-territorial-status]');

  let territorialMap = null;
  let statesLayer = null;
  let municipalitiesLayer = null;
  let selectedState = null;
  let selectedMunicipality = null;
  let municipalityNames = new Map();
  let stateLayersById = new Map();
  let municipalityLayersById = new Map();
  let projectIndex = [];
  let projectCountIndex = new Map();
  let statesRenderer = null;
  let municipalitiesRenderer = null;
  const municipalityCache = new Map();
  let mode = 'states';
  let opening = false;
  let entering = false;
  let requestToken = 0;
  let statesLoaded = false;
  let hoveredStateLayer = null;

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function setStatus(message, tone = 'idle') {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  async function fetchJson(url, timeoutMs = 14000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json, application/vnd.geo+json;q=0.9' },
        cache: 'force-cache',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function projectCount(uf, municipalityName) {
    const targetUf = normalize(uf);
    const targetCity = normalize(municipalityName);
    if (!targetCity) return 0;
    return Number(projectCountIndex.get(`${targetUf}|${targetCity}`) || projectCountIndex.get(`|${targetCity}`) || 0);
  }

  async function loadProjectsIndex() {
    try {
      if (!window.GeoRuralProjects?.list) return;
      const rows = await window.GeoRuralProjects.list({ full: false, refresh: false });
      projectIndex = Array.isArray(rows) ? rows : [];
      projectCountIndex = new Map();
      for (const project of projectIndex) {
        const pUf = normalize(project?.uf || project?.stateCode || project?.metadata?.stateCode);
        const pCity = normalize(project?.city || project?.municipality || project?.metadata?.municipality);
        if (!pCity) continue;
        const key = `${pUf}|${pCity}`;
        projectCountIndex.set(key, Number(projectCountIndex.get(key) || 0) + 1);
      }
    } catch (error) {
      console.warn('[territorial] índice de projetos indisponível:', error);
      projectIndex = [];
      projectCountIndex = new Map();
    }
  }

  function mainMap() {
    return window.SurveyorMapRuntime?.map || window.surveyorMapInstance || window.georuralMapInstance || null;
  }

  function authSessionIdentity() {
    let session = null;
    try { session = (window.SurveyorAuth || window.GeoRuralAuth)?.getSession?.() || null; } catch {}
    if (!session) {
      try { session = JSON.parse(sessionStorage.getItem('georural-auth-session-v3') || 'null') || null; } catch {}
    }
    const user = session?.user || {};
    const userId = String(user.id || user.sub || user.email || '').trim().toLowerCase();
    const createdAt = String(session?.createdAt || session?.issuedAt || '').trim();
    if (!userId) return '';
    return `${userId}::${createdAt || String(session?.accessToken || '').slice(-24)}`;
  }

  function territorialAlreadyShownThisSession() {
    const identity = authSessionIdentity();
    if (!identity) return false;
    try { return sessionStorage.getItem(SESSION_SEEN_KEY) === identity; } catch { return false; }
  }

  function markTerritorialShownThisSession() {
    const identity = authSessionIdentity();
    if (!identity) return;
    try { sessionStorage.setItem(SESSION_SEEN_KEY, identity); } catch {}
  }

  function readOperationalView() {
    try {
      const value = JSON.parse(sessionStorage.getItem(OPERATIONAL_VIEW_KEY) || 'null');
      const lat = Number(value?.lat);
      const lng = Number(value?.lng);
      const zoom = Number(value?.zoom);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
      return { lat, lng, zoom };
    } catch { return null; }
  }

  function persistOperationalView() {
    if (document.body.classList.contains('surveyor-territorial-mode')) return;
    const operationalMap = mainMap();
    const center = operationalMap?.getCenter?.();
    const zoom = Number(operationalMap?.getZoom?.());
    if (!center || !Number.isFinite(Number(center.lat)) || !Number.isFinite(Number(center.lng)) || !Number.isFinite(zoom)) return;
    try {
      sessionStorage.setItem(OPERATIONAL_VIEW_KEY, JSON.stringify({
        lat: Number(center.lat),
        lng: Number(center.lng),
        zoom,
        savedAt: new Date().toISOString()
      }));
    } catch {}
  }

  function restoreOperationalView() {
    const operationalMap = mainMap();
    const saved = readOperationalView();
    if (!operationalMap || !saved) return false;
    try {
      operationalMap.setView([saved.lat, saved.lng], saved.zoom, { animate: false });
      operationalMap.invalidateSize?.({ pan: false, animate: false });
      return true;
    } catch { return false; }
  }

  function bindOperationalViewPersistence() {
    const operationalMap = mainMap();
    if (!operationalMap || operationalMap.__surveyorOperationalViewPersistenceBound) return;
    operationalMap.__surveyorOperationalViewPersistenceBound = true;
    operationalMap.on?.('moveend zoomend', persistOperationalView);
    window.addEventListener('pagehide', persistOperationalView, { passive: true });
  }

  function ensureMap() {
    if (territorialMap) return territorialMap;
    if (!window.L) throw new Error('Leaflet ainda não está disponível.');
    territorialMap = L.map(mapCanvas, {
      center: [-14.4, -52.5],
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      fadeAnimation: true,
      zoomAnimation: true,
      zoomAnimationThreshold: 8,
      markerZoomAnimation: true,
      doubleClickZoom: false,
      boxZoom: false
    });
    const statesPane = territorialMap.createPane('svTerritorialStates');
    const municipalitiesPane = territorialMap.createPane('svTerritorialMunicipalities');
    statesPane.style.zIndex = '410';
    municipalitiesPane.style.zIndex = '420';
    const tooltipPane = territorialMap.getPane('tooltipPane');
    const popupPane = territorialMap.getPane('popupPane');
    if (tooltipPane) tooltipPane.style.zIndex = '960';
    if (popupPane) popupPane.style.zIndex = '970';
    // Estados usam SVG para manter contorno nítido;
    // a malha municipal pesada continua em Canvas para desempenho.
    statesRenderer = L.svg({ pane: 'svTerritorialStates', padding: 0.12 });
    municipalitiesRenderer = L.canvas({ pane: 'svTerritorialMunicipalities', padding: 0.10, tolerance: 5 });
    L.control.zoom({ position: 'bottomright' }).addTo(territorialMap);
    return territorialMap;
  }

  function animationDuration(seconds = 0.66) {
    if (reducedMotion) return 0;
    const value = Math.max(0.24, Math.min(0.9, Number(seconds) || 0.66));
    mapCanvas.style.setProperty('--sv-territorial-zoom-duration', `${value}s`);
    return value;
  }

  function fitViewForBounds(bounds, options = {}) {
    if (!territorialMap || !bounds?.isValid?.()) return null;
    const padding = options.padding || [44, 44];
    const padPoint = L.point(Number(padding[0]) || 0, Number(padding[1]) || Number(padding[0]) || 0);
    let zoom = territorialMap.getBoundsZoom(bounds, false, padPoint);
    if (Number.isFinite(options.maxZoom)) zoom = Math.min(zoom, Number(options.maxZoom));
    if (Number.isFinite(options.minZoom)) zoom = Math.max(zoom, Number(options.minZoom));
    const snap = Number(territorialMap.options.zoomSnap) || 0.25;
    zoom = Math.floor((zoom + 1e-9) / snap) * snap;
    return { center: bounds.getCenter(), zoom };
  }

  function animateToBounds(bounds, options = {}) {
    const view = fitViewForBounds(bounds, options);
    if (!view) return Promise.resolve();
    territorialMap.stop();
    const duration = animationDuration(options.duration ?? 0.66);
    if (!duration || options.animate === false) {
      territorialMap.setView(view.center, view.zoom, { animate: false });
      return Promise.resolve();
    }
    territorialMap.setView(view.center, view.zoom, { animate: true, duration });
    return wait(Math.ceil(duration * 1000) + 70);
  }

  function municipalityPaneElement() {
    return territorialMap?.getPane?.('svTerritorialMunicipalities') || null;
  }

  function hideMunicipalityPane() {
    const pane = municipalityPaneElement();
    if (!pane) return;
    pane.classList.remove('is-visible');
    pane.classList.add('is-preparing');
  }

  function revealMunicipalityPane() {
    const pane = municipalityPaneElement();
    if (!pane) return;
    pane.classList.add('is-preparing');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      pane.classList.remove('is-preparing');
      pane.classList.add('is-visible');
    }));
  }

  async function loadMunicipalityBundle(state) {
    const key = String(state.id);
    if (municipalityCache.has(key)) return municipalityCache.get(key);
    const meshUrl = `${IBGE_MESH}/estados/${state.id}?intrarregiao=municipio&formato=${GEOJSON}&qualidade=minima`;
    const namesUrl = `${IBGE_LOCAL}/estados/${state.id}/municipios?orderBy=nome`;
    const bundle = await Promise.all([fetchJson(meshUrl, 16000), fetchJson(namesUrl, 12000)]).then(([mesh, names]) => ({ mesh, names }));
    municipalityCache.set(key, bundle);
    while (municipalityCache.size > 2) {
      const oldest = municipalityCache.keys().next().value;
      if (oldest === undefined) break;
      municipalityCache.delete(oldest);
    }
    return bundle;
  }

  function stateFromFeature(feature) {
    const id = String(feature?.properties?.codarea || feature?.properties?.id || '').padStart(2, '0').slice(0, 2);
    return STATES_BY_ID.get(id) || null;
  }

  function stateStyle(feature) {
    const state = stateFromFeature(feature);
    const active = selectedState && state?.id === selectedState.id;
    const faded = Boolean(selectedState && !active);
    return {
      color: active ? TERRITORIAL_PALETTE.stateActiveStroke : TERRITORIAL_PALETTE.stateStroke,
      weight: active ? 2.0 : 1.05,
      opacity: 1,
      fillColor: active ? TERRITORIAL_PALETTE.stateActiveFill : TERRITORIAL_PALETTE.stateFill,
      fillOpacity: 1,
      lineJoin: 'round'
    };
  }

  function municipalityStyle(feature) {
    const id = String(feature?.properties?.codarea || feature?.properties?.id || '');
    const active = selectedMunicipality && String(selectedMunicipality.id) === id;
    const faded = Boolean(selectedMunicipality && !active);
    return {
      color: active ? TERRITORIAL_PALETTE.municipalityActiveStroke : TERRITORIAL_PALETTE.municipalityStroke,
      weight: active ? 2.2 : 0.82,
      opacity: faded ? 0.52 : 1,
      fillColor: active ? TERRITORIAL_PALETTE.municipalityActiveFill : TERRITORIAL_PALETTE.municipalityFill,
      fillOpacity: faded ? 0.48 : 1,
      lineJoin: 'round'
    };
  }

  function tooltipHtml(name, meta = '') {
    return `<strong>${escapeHtml(name)}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}`;
  }

  function searchModeBadge() {
    return document.getElementById('svSmartSearchMode');
  }

  function coordinateSubtypeBadge() {
    return document.getElementById('svCoordinateSubtypeMode');
  }

  function searchWrap() {
    return search.closest('.geo-search-input-wrap');
  }

  function hideSuggestions() {
    suggestions.classList.add('hidden');
    suggestions.classList.remove('property-context-box', 'sv-map-search-overlay');
    suggestions.replaceChildren();
    suggestions.style.display = 'none';
    search.setAttribute('aria-expanded', 'false');
  }

  function showSuggestions() {
    suggestions.classList.remove('hidden');
    suggestions.style.display = 'grid';
    search.setAttribute('aria-expanded', 'true');
  }

  function updateSearchChrome() {
    const badge = searchModeBadge();
    const subtype = coordinateSubtypeBadge();
    const wrap = searchWrap();
    const stateMode = mode === 'states' || !selectedState;
    const label = stateMode ? 'ESTADO' : `MUNICÍPIO · ${selectedState.uf}`;
    const placeholder = stateMode ? 'Digite o nome do estado ou UF' : `Digite o município em ${selectedState.name}`;

    search.placeholder = placeholder;
    search.setAttribute('aria-label', stateMode ? 'Pesquisar estado ou UF' : `Pesquisar município em ${selectedState.name}`);
    search.title = stateMode ? 'Pesquise um estado brasileiro ou a sigla da UF.' : `Pesquise somente municípios de ${selectedState.name}.`;
    if (badge) {
      badge.textContent = label;
      badge.setAttribute('aria-label', label);
      badge.setAttribute('aria-disabled', 'true');
    }
    if (subtype) subtype.hidden = true;
    if (wrap) {
      wrap.classList.add('has-smart-mode', 'sv-territorial-global-search');
      wrap.style.setProperty('--sv-smart-mode-offset', stateMode ? '82px' : '124px');
    }
    document.getElementById('svSearchModeMenu')?.classList.add('hidden');
    document.getElementById('svCoordinateSubtypeMenu')?.classList.add('hidden');
  }

  function restoreOperationalSearch() {
    hideSuggestions();
    search.value = '';
    const wrap = searchWrap();
    wrap?.classList.remove('sv-territorial-global-search');
    wrap?.style.removeProperty('--sv-smart-mode-offset');
    const badge = searchModeBadge();
    if (badge) badge.removeAttribute('aria-disabled');
    window.SurveyorMapSearch?.refreshExplicitMode?.();
  }

  function renderSuggestions(items) {
    suggestions.replaceChildren();
    if (!items.length) return hideSuggestions();
    items.slice(0, 10).forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-suggest-item sv-territorial-search-result';
      button.setAttribute('role', 'option');
      const label = document.createElement('strong');
      label.textContent = item.label;
      const meta = document.createElement('small');
      meta.textContent = item.meta || '';
      button.append(label, meta);
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', item.action);
      suggestions.appendChild(button);
    });
    showSuggestions();
  }

  function matchingItems(query) {
    const q = normalize(query);
    if (!q) return [];
    if (mode === 'states') {
      return STATES
        .filter((state) => normalize(`${state.name} ${state.uf}`).includes(q))
        .map((state) => ({
          label: state.name,
          meta: state.uf,
          action: () => {
            hideSuggestions();
            search.value = '';
            showStateMunicipalities(state, { animate: true, layer: stateLayersById.get(state.id) });
          }
        }));
    }
    if (!selectedState) return [];
    return [...municipalityNames.entries()]
      .map(([id, name]) => ({ id, name }))
      .filter((item) => normalize(item.name).includes(q))
      .slice(0, 20)
      .map((item) => ({
        label: item.name,
        meta: `${selectedState.uf} · ${projectCount(selectedState.uf, item.name)} projeto(s)`,
        action: () => {
          hideSuggestions();
          search.value = '';
          const layer = municipalityLayersById.get(String(item.id));
          if (layer) selectMunicipality(String(item.id), layer);
        }
      }));
  }

  function searchItems(query) {
    renderSuggestions(matchingItems(query));
  }

  function runSearch(query = search.value) {
    const items = matchingItems(query);
    if (!items.length) {
      setStatus(mode === 'states' ? 'Nenhum estado encontrado.' : `Nenhum município encontrado em ${selectedState?.name || 'esta UF'}.`, 'error');
      hideSuggestions();
      search.focus();
      return false;
    }
    items[0].action();
    return true;
  }

  function clearStateHover() {
    if (!statesLayer || selectedState) {
      hoveredStateLayer = null;
      return;
    }
    statesLayer.setStyle(stateStyle);
    hoveredStateLayer = null;
  }

  function hoverState(layer, state, active) {
    if (!state || selectedState || !statesLayer) return;
    if (active) {
      // Restaura qualquer UF destacada anteriormente antes de aplicar o novo hover.
      // Isso evita que mouseover/mouseout interrompidos pelo tooltip deixem várias UFs azuis.
      statesLayer.setStyle(stateStyle);
      hoveredStateLayer = layer;
      layer.setStyle({ fillColor: '#2386a4', fillOpacity: 0.98, color: '#ffffff', weight: 1.8 });
      return;
    }
    if (hoveredStateLayer === layer) clearStateHover();
    else statesLayer.resetStyle(layer);
  }

  async function loadStates() {
    if (statesLoaded && statesLayer) return;
    const map = ensureMap();
    setStatus('Carregando divisões estaduais do IBGE...', 'loading');
    const url = `${IBGE_MESH}/paises/BR?intrarregiao=UF&formato=${GEOJSON}&qualidade=intermediaria`;
    const data = await fetchJson(url);
    if (!Array.isArray(data?.features) || !data.features.length) throw new Error('A malha estadual retornou vazia.');

    stateLayersById = new Map();
    statesLayer = L.geoJSON(data, {
      renderer: statesRenderer,
      pane: 'svTerritorialStates',
      smoothFactor: 1.25,
      style: stateStyle,
      onEachFeature(feature, layer) {
        const state = stateFromFeature(feature);
        if (!state) return;
        stateLayersById.set(state.id, layer);
        layer.bindTooltip(tooltipHtml(state.name, state.uf), { sticky: true, direction: 'top', className: 'sv-territorial-tooltip', opacity: 1 });
        layer.on('mouseover', () => hoverState(layer, state, true));
        layer.on('mouseout', () => hoverState(layer, state, false));
        layer.on('click', () => showStateMunicipalities(state, { animate: true, layer }));
      }
    }).addTo(map);
    statesLoaded = true;
    map.getContainer().addEventListener('mouseleave', clearStateHover, { passive: true });
    map.fitBounds(statesLayer.getBounds(), { padding: [34, 34], animate: false });
    setStatus('Passe o mouse, clique em um estado ou use a busca do topo.', 'success');
  }

  function clearMunicipalities() {
    hideMunicipalityPane();
    if (municipalitiesLayer && territorialMap?.hasLayer(municipalitiesLayer)) territorialMap.removeLayer(municipalitiesLayer);
    municipalitiesLayer = null;
    municipalityLayersById = new Map();
    municipalityNames = new Map();
    selectedMunicipality = null;
  }

  async function showStateMunicipalities(state, options = {}) {
    if (!state || opening) return;
    opening = true;
    const token = ++requestToken;
    clearStateHover();
    selectedState = state;
    selectedMunicipality = null;
    mode = 'municipalities';
    search.value = '';
    hideSuggestions();
    updateSearchChrome();
    statesLayer?.setStyle(stateStyle);

    const stateLayer = options.layer || stateLayersById.get(state.id);
    const compactViewport = window.innerWidth <= 900;
    const stateBounds = stateLayer?.getBounds?.().pad(compactViewport ? 0.08 : 0.055);
    const cameraTransition = stateBounds?.isValid?.()
      ? animateToBounds(stateBounds, {
          padding: compactViewport ? [26, 26] : [54, 48],
          maxZoom: 7.5,
          duration: 0.68,
          animate: options.animate !== false
        })
      : Promise.resolve();
    setStatus(`Carregando municípios de ${state.name}...`, 'loading');
    clearMunicipalities();

    try {
      const bundlePromise = loadMunicipalityBundle(state);
      const [{ mesh, names }] = await Promise.all([bundlePromise, cameraTransition]);
      if (token !== requestToken) return;
      if (!Array.isArray(mesh?.features) || !mesh.features.length) throw new Error('A malha municipal retornou vazia.');
      municipalityNames = new Map((Array.isArray(names) ? names : []).map((item) => [String(item.id), String(item.nome || item.id)]));
      municipalityLayersById = new Map();

      municipalitiesLayer = L.geoJSON(mesh, {
        renderer: municipalitiesRenderer,
        pane: 'svTerritorialMunicipalities',
        smoothFactor: 1.75,
        style: municipalityStyle,
        onEachFeature(feature, layer) {
          const id = String(feature?.properties?.codarea || feature?.properties?.id || '');
          const name = municipalityNames.get(id) || `Município ${id}`;
          municipalityLayersById.set(id, layer);
          const count = projectCount(state.uf, name);
          layer.bindTooltip(tooltipHtml(name, count ? `${count} projeto(s) no SURVEYOR` : `${state.uf} · IBGE`), {
            sticky: true,
            direction: 'top',
            className: 'sv-territorial-tooltip',
            opacity: 1
          });
          // O tooltip dá o feedback de hover sem redesenhar centenas de polígonos no Canvas.
          layer.on('click', () => selectMunicipality(id, layer));
        }
      }).addTo(territorialMap);

      // O Brasil permanece no mapa. A malha municipal entra apenas por cima da UF
      // escolhida, mantendo o contexto territorial completo durante o zoom.
      statesLayer?.setStyle(stateStyle);
      municipalitiesLayer.bringToFront?.();
      revealMunicipalityPane();
      setStatus(`${municipalityNames.size || mesh.features.length} municípios disponíveis em ${state.name}.`, 'success');
    } catch (error) {
      console.error('[territorial] falha ao carregar municípios:', error);
      setStatus('Não foi possível carregar os municípios. Volte ao Brasil e tente novamente.', 'error');
    } finally {
      if (token === requestToken) opening = false;
    }
  }

  function persistSelection(bounds) {
    if (!selectedState || !selectedMunicipality || !bounds?.isValid?.()) return;
    const payload = {
      stateId: selectedState.id,
      uf: selectedState.uf,
      stateName: selectedState.name,
      municipalityId: String(selectedMunicipality.id),
      municipalityName: selectedMunicipality.name,
      bounds: [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]]
    };
    try { localStorage.setItem(LAST_KEY, JSON.stringify(payload)); } catch {}
  }

  function playOperationalChromeEntrance() {
    const body = document.body;
    if (!body || reducedMotion) return Promise.resolve();
    body.classList.remove('surveyor-operational-chrome-enter');
    // Reinicia de forma determinística caso o usuário volte à visão territorial
    // e entre em outro município na mesma sessão.
    void body.offsetWidth;
    body.classList.add('surveyor-operational-chrome-enter');
    return wait(640).finally(() => body.classList.remove('surveyor-operational-chrome-enter'));
  }

  async function enterOperationalMap(layer) {
    if (entering) return;
    entering = true;
    const bounds = layer?.getBounds?.();
    const operationalMap = mainMap();
    if (bounds?.isValid?.()) persistSelection(bounds);

    setStatus(`Abrindo ${selectedMunicipality?.name || 'município'} no mapa operacional...`, 'loading');

    // Primeiro restauramos o layout operacional ATRÁS da camada territorial.
    // O mapa real é enquadrado uma única vez enquanto ainda está oculto pelo overlay;
    // só depois a camada territorial faz o crossfade, evitando salto ou repetição visual.
    document.body.classList.remove('surveyor-territorial-mode');
    document.documentElement.classList.remove('surveyor-territorial-pending');
    restoreOperationalSearch();
    const chromeEntrance = playOperationalChromeEntrance();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      operationalMap?.invalidateSize?.({ pan: false, animate: false });
      document.activeElement?.blur?.();
      if (operationalMap && bounds?.isValid?.()) {
        // Entrar na área urbana com aproximação útil, em vez de enquadrar todo o
        // território municipal, que pode ocupar centenas de quilômetros.
        const cityCenter = bounds.getCenter();
        operationalMap.setView(cityCenter, 13, { animate: false });
        persistOperationalView();
      }
    } catch {}

    await wait(reducedMotion ? 0 : 70);
    root.classList.add('is-leaving');
    await wait(reducedMotion ? 0 : 430);
    root.hidden = true;
    root.classList.remove('is-leaving');
    await chromeEntrance;
    entering = false;
  }

  async function selectMunicipality(id, layer) {
    if (!layer || entering) return;
    const name = municipalityNames.get(String(id)) || `Município ${id}`;
    selectedMunicipality = { id: String(id), name };
    mode = 'municipality';
    updateSearchChrome();
    municipalitiesLayer?.setStyle(municipalityStyle);
    layer.bringToFront?.();
    const count = projectCount(selectedState?.uf, name);
    setStatus(count ? `${name} · ${count} projeto(s) encontrado(s) · entrando...` : `${name} selecionado · entrando...`, 'success');
    await animateToBounds(layer.getBounds().pad(0.055), {
      padding: [42, 42],
      maxZoom: 10.5,
      duration: 0.56,
      animate: true
    });
    await enterOperationalMap(layer);
  }

  function resetToBrazil(animate = true) {
    ++requestToken;
    opening = false;
    entering = false;
    hoveredStateLayer = null;
    selectedState = null;
    selectedMunicipality = null;
    mode = 'states';
    clearMunicipalities();
    if (statesLayer && !territorialMap.hasLayer(statesLayer)) statesLayer.addTo(territorialMap);
    statesLayer?.setStyle(stateStyle);
    hideSuggestions();
    search.value = '';
    updateSearchChrome();
    if (statesLayer?.getBounds?.().isValid?.()) {
      animateToBounds(statesLayer.getBounds(), {
        padding: [44, 44],
        maxZoom: 5.5,
        duration: 0.58,
        animate: Boolean(animate)
      });
    }
    setStatus('Passe o mouse, clique em um estado ou use a busca do topo.', 'success');
  }

  async function openNavigator({ restore = false } = {}) {
    markTerritorialShownThisSession();
    document.activeElement?.blur?.();
    root.hidden = false;
    root.classList.remove('is-leaving');
    document.body.classList.add('surveyor-territorial-mode');
    ensureMap();
    document.documentElement.classList.remove('surveyor-territorial-pending');
    requestAnimationFrame(() => territorialMap.invalidateSize());
    hideSuggestions();
    search.value = '';
    updateSearchChrome();
    setStatus('Preparando navegação territorial...', 'loading');
    try {
      loadProjectsIndex();
      await loadStates();
      if (restore) {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch {}
        const state = saved?.stateId ? STATES_BY_ID.get(String(saved.stateId)) : (saved?.uf ? STATES_BY_UF.get(String(saved.uf).toUpperCase()) : null);
        if (state) await showStateMunicipalities(state, { animate: false, layer: stateLayersById.get(state.id) });
        else resetToBrazil(false);
      } else resetToBrazil(false);
    } catch (error) {
      console.error('[territorial] falha ao iniciar:', error);
      setStatus('A navegação territorial não pôde carregar o IBGE.', 'error');
    }
  }

  function closeToFreeMap() {
    root.classList.add('is-leaving');
    wait(reducedMotion ? 0 : 350).then(() => {
      root.hidden = true;
      root.classList.remove('is-leaving');
      document.body.classList.remove('surveyor-territorial-mode');
      document.documentElement.classList.remove('surveyor-territorial-pending');
      restoreOperationalSearch();
      mainMap()?.invalidateSize?.();
      persistOperationalView();
    });
  }

  search.addEventListener('input', () => {
    if (!document.body.classList.contains('surveyor-territorial-mode')) return;
    searchItems(search.value);
  });
  search.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('surveyor-territorial-mode')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!suggestions.classList.contains('hidden')) {
        search.value = '';
        hideSuggestions();
        return;
      }
      if (mode !== 'states') resetToBrazil(true);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch(search.value);
    }
  });
  search.addEventListener('focus', () => {
    if (!document.body.classList.contains('surveyor-territorial-mode')) return;
    if (search.value.trim()) searchItems(search.value);
  });


  document.addEventListener('pointerdown', (event) => {
    if (!document.body.classList.contains('surveyor-territorial-mode')) return;
    if (suggestions.classList.contains('hidden')) return;
    if (event.target === search || suggestions.contains(event.target) || searchWrap()?.contains(event.target)) return;
    hideSuggestions();
  });

  const projectId = new URLSearchParams(location.search).get('project');
  const start = () => {
    bindOperationalViewPersistence();
    if (projectId) {
      root.hidden = true;
      document.body.classList.remove('surveyor-territorial-mode');
      document.documentElement.classList.remove('surveyor-territorial-pending');
      return;
    }
    if (territorialAlreadyShownThisSession()) {
      root.hidden = true;
      document.body.classList.remove('surveyor-territorial-mode');
      document.documentElement.classList.remove('surveyor-territorial-pending');
      restoreOperationalSearch();
      restoreOperationalView();
      return;
    }
    openNavigator({ restore: false });
  };
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', start, { once: true });

  window.SurveyorTerritorialNavigator = {
    open: () => openNavigator({ restore: true }),
    reset: () => resetToBrazil(true),
    search: (query) => runSearch(query),
    closeToFreeMap,
    isActive: () => document.body.classList.contains('surveyor-territorial-mode'),
    getSelection: () => ({
      state: selectedState ? { ...selectedState } : null,
      municipality: selectedMunicipality ? { ...selectedMunicipality } : null
    })
  };
})();
