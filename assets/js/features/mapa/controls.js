(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let gpsPreview = null;
  let gpsMultiPreviewGroup = null;
  let gpsMultiPreviewLine = null;
  let gpsContainer = null;
  let gpsContainerHandler = null;
  let gpsRetryTimer = null;
  let panelDrag = null;
  let editingLayer = null;
  let explicitOpen = false;
  let additionalPointSeq = 0;

  const POINT_TYPE_META = Object.freeze({
    V: Object.freeze({ code: 'V', label: 'Virtual' }),
    P: Object.freeze({ code: 'P', label: 'Ponto' }),
    M: Object.freeze({ code: 'M', label: 'Marco' })
  });

  function normalizePointType(value) {
    const type = String(value || '').trim().toUpperCase();
    return POINT_TYPE_META[type] ? type : 'V';
  }

  function pointTypeForRow(row) {
    if (!row) return 'P';
    const selector = row.querySelector('.gps-point-type-select');
    if (selector) return normalizePointType(selector.value || 'P');
    const mark = row.querySelector('.gps-point-has-mark');
    return mark?.checked ? 'M' : 'P';
  }

  function pointRowClassifications() {
    const counters = { V: 0, P: 0, M: 0 };
    return pointRows().map((row) => {
      const type = pointTypeForRow(row);
      counters[type] += 1;
      const code = `${type}-${String(counters[type]).padStart(2, '0')}`;
      const imported = row.dataset.imported === '1';
      row.dataset.pointType = type;
      row.dataset.pointCode = code;
      const badge = row.querySelector('[data-point-type-badge]');
      if (badge) badge.textContent = `${code} · ${POINT_TYPE_META[type].label}`;
      const markWrap = row.querySelector('.gps-point-mark-option');
      const mark = row.querySelector('.gps-point-has-mark');
      // O seletor P/M é explícito para pontos inseridos e importados.
      // Mantemos o checkbox legado no DOM apenas para migração.
      if (markWrap) markWrap.classList.toggle('hidden', Boolean(row.querySelector('.gps-point-type-select')) || !imported);
      if (mark) { mark.checked = type === 'M'; mark.disabled = Boolean(row.querySelector('.gps-point-type-select')) || !imported; }
      return { row, type, code, imported };
    });
  }

  function syncPointClassifications() {
    pointRowClassifications();
  }

  function resolveMap() {
    return window.SurveyorMapRuntime?.map || window.surveyorMapInstance || window.georuralMapInstance || null;
  }

  function setDrawer(open) {
    const drawer = $('mapQuickToolsDrawer');
    const toggle = $('mapQuickToolsToggle');
    if (!drawer || !toggle) return;
    const active = Boolean(open);
    drawer.classList.toggle('hidden', !active);
    drawer.setAttribute('aria-hidden', active ? 'false' : 'true');
    drawer.style.setProperty('display', active ? 'inline-block' : 'none', 'important');
    toggle.setAttribute('aria-expanded', active ? 'true' : 'false');
    toggle.classList.toggle('active', active);
    document.body.classList.toggle('map-quick-tools-open', active);
  }

  function closeElementDetails() {
    try { resolveMap()?.closePopup?.(); } catch {}
    document.querySelectorAll('.map-layer-info-help-popup').forEach((node) => node.remove());
    const details = document.querySelector('.details');
    if (details) details.classList.add('hidden');
    window.SurveyorRightPanelStack?.sync?.('rural');
  }

  function clampPanel(left, top) {
    const panel = $('gpsPointDialog');
    if (!panel) return { left: 8, top: 8 };
    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    return {
      left: Math.max(8, Math.min(maxLeft, Number(left) || 8)),
      top: Math.max(8, Math.min(maxTop, Number(top) || 8))
    };
  }

  function storePanelPosition(left, top) {
    try { sessionStorage.setItem('surveyor:gps-panel-position', JSON.stringify({ left, top })); } catch {}
  }

  function loadPanelPosition() {
    try {
      const raw = sessionStorage.getItem('surveyor:gps-panel-position');
      const parsed = raw ? JSON.parse(raw) : null;
      if (Number.isFinite(parsed?.left) && Number.isFinite(parsed?.top)) return parsed;
    } catch {}
    return null;
  }

  function placePanel() {
    const panel = $('gpsPointDialog');
    if (!panel) return;
    const remembered = loadPanelPosition();
    let left, top;
    if (remembered) ({ left, top } = clampPanel(remembered.left, remembered.top));
    else {
      const mapRect = $('map')?.getBoundingClientRect();
      const sideRect = $('geoSidePanel')?.getBoundingClientRect();
      left = Math.max(76, Number(mapRect?.left || 0) + 12, Number(sideRect?.right || 0) + 12);
      top = Math.max(88, Number(mapRect?.top || 0) + 48);
      ({ left, top } = clampPanel(left, top));
    }
    panel.style.setProperty('left', `${left}px`, 'important');
    panel.style.setProperty('top', `${top}px`, 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('bottom', 'auto', 'important');
    panel.style.setProperty('transform', 'none', 'important');
  }

  function setStatus(message = '', kind = '') {
    const status = $('gpsPointLiveStatus');
    if (!status) return;
    status.textContent = String(message || '');
    status.dataset.kind = kind || '';
    status.classList.toggle('hidden', !message);
  }

  function bindPanelDrag() {
    const panel = $('gpsPointDialog');
    const oldHandle = panel?.querySelector?.('[data-gps-drag-handle]');
    if (!panel || !oldHandle) return;
    let handle = oldHandle;
    if (oldHandle.dataset.runtimeDragExclusive !== '1') {
      const cleanHandle = oldHandle.cloneNode(true);
      cleanHandle.dataset.runtimeDragExclusive = '1';
      oldHandle.replaceWith(cleanHandle);
      handle = cleanHandle;
    }
    if (handle.dataset.pointDragBound === '1') return;
    handle.dataset.pointDragBound = '1';

    handle.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button > 0) return;
      if (event.target.closest?.('button,input,select,textarea,a')) return;
      const rect = panel.getBoundingClientRect();
      panelDrag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      panel.style.setProperty('left', `${rect.left}px`, 'important');
      panel.style.setProperty('top', `${rect.top}px`, 'important');
      panel.style.setProperty('right', 'auto', 'important');
      panel.style.setProperty('bottom', 'auto', 'important');
      panel.style.setProperty('transform', 'none', 'important');
      panel.classList.add('is-dragging');
      try { handle.setPointerCapture?.(event.pointerId); } catch {}
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, true);

    window.addEventListener('pointermove', (event) => {
      if (!panelDrag) return;
      if (panelDrag.pointerId != null && event.pointerId != null && panelDrag.pointerId !== event.pointerId) return;
      const pos = clampPanel(event.clientX - panelDrag.offsetX, event.clientY - panelDrag.offsetY);
      panel.style.setProperty('left', `${pos.left}px`, 'important');
      panel.style.setProperty('top', `${pos.top}px`, 'important');
      storePanelPosition(pos.left, pos.top);
      event.preventDefault();
    }, true);

    const end = (event) => {
      if (!panelDrag) return;
      if (panelDrag.pointerId != null && event?.pointerId != null && panelDrag.pointerId !== event.pointerId) return;
      try { handle.releasePointerCapture?.(panelDrag.pointerId); } catch {}
      panelDrag = null;
      panel.classList.remove('is-dragging');
      const rect = panel.getBoundingClientRect();
      const pos = clampPanel(rect.left, rect.top);
      storePanelPosition(pos.left, pos.top);
    };
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  }

  function clearPreview() {
    const map = resolveMap();
    if (gpsPreview && map) { try { map.removeLayer(gpsPreview); } catch {} }
    gpsPreview = null;
  }

  function clearMultiPreview() {
    const map = resolveMap();
    if (gpsMultiPreviewGroup && map) { try { map.removeLayer(gpsMultiPreviewGroup); } catch {} }
    if (gpsMultiPreviewLine && map) { try { map.removeLayer(gpsMultiPreviewLine); } catch {} }
    gpsMultiPreviewGroup = null;
    gpsMultiPreviewLine = null;
  }

  function yellowPinIcon() {
    const runtimeIcon = window.SurveyorMapRuntime?.gpsMarkerIcon?.({ draft: true });
    if (runtimeIcon) return runtimeIcon;
    if (!window.L?.divIcon) return null;
    return L.divIcon({
      className: 'surveyor-gps-pin-icon is-draft', iconSize: [30, 38], iconAnchor: [15, 36],
      html: '<span class="surveyor-gps-pin-shape" aria-hidden="true"><svg viewBox="0 0 30 38"><path d="M15 1.5C7.82 1.5 2 7.32 2 14.5c0 9.25 13 21.5 13 21.5s13-12.25 13-21.5C28 7.32 22.18 1.5 15 1.5Z"/><circle cx="15" cy="14.5" r="5.2"/></svg></span>'
    });
  }

  function putPreview(lat, lng) {
    const map = resolveMap();
    if (!map || !window.L?.marker) return;
    clearPreview();
    const options = { interactive: false, keyboard: false, zIndexOffset: 2200 };
    const icon = yellowPinIcon();
    if (icon) options.icon = icon;
    gpsPreview = L.marker([lat, lng], options).addTo(map);
  }

  function resetForm() {
    editingLayer = null;
    clearPreview();
    clearMultiPreview();
    if ($('gpsPointName')) $('gpsPointName').value = '';
    if ($('gpsPointCrs')) $('gpsPointCrs').value = 'EPSG:4326';
    if ($('gpsPointFirst')) $('gpsPointFirst').value = '';
    if ($('gpsPointSecond')) $('gpsPointSecond').value = '';
    if ($('gpsPointCoords')) $('gpsPointCoords').value = '';
    const mainRow = document.querySelector('.gps-point-main-fields');
    if (mainRow) {
      delete mainRow.dataset.imported;
      delete mainRow.dataset.importSource;
      mainRow.dataset.pointType = 'P';
      mainRow.dataset.pointCode = 'P-01';
      const selector=mainRow.querySelector('.gps-point-type-select');
      if(selector){selector.querySelector('option[value="V"]')?.remove();selector.value='P';}
    }
    if ($('gpsPointHasMark')) $('gpsPointHasMark').checked = false;
    if ($('gpsAdditionalPoints')) $('gpsAdditionalPoints').innerHTML = '';
    additionalPointSeq = 0;
    if ($('gpsPointFirstLabel')) $('gpsPointFirstLabel').textContent = 'Latitude';
    if ($('gpsPointSecondLabel')) $('gpsPointSecondLabel').textContent = 'Longitude';
    const accuracy = $('gpsPointAccuracy');
    if (accuracy) { accuracy.classList.add('hidden'); accuracy.textContent=''; delete accuracy.dataset.accuracy; }
    const title = $('gpsPointTitle');
    if (title) title.textContent = 'Marcar pontos';
    const save = $('gpsCreatePointBtn');
    if (save) save.textContent = 'Salvar pontos';
    $('gpsPointDialog')?.classList.remove('is-editing-single');
    syncPointClassifications();
    updatePolygonSuggestion();
    setStatus('');
  }

  function fillEditForm(detail = {}) {
    const layer = detail.layer;
    const ll = detail.latlng || layer?.getLatLng?.();
    if (!layer || !ll) return false;
    editingLayer = layer;
    clearPreview();
    clearMultiPreview();
    const props = detail.props || layer.feature?.properties || {};
    if ($('gpsPointName')) $('gpsPointName').value = String(props.name || 'Ponto');
    if ($('gpsPointCrs')) $('gpsPointCrs').value = 'EPSG:4326';
    if ($('gpsPointFirst')) $('gpsPointFirst').value = Number(ll.lat).toFixed(7);
    if ($('gpsPointSecond')) $('gpsPointSecond').value = Number(ll.lng).toFixed(7);
    if ($('gpsPointCoords')) $('gpsPointCoords').value = `${Number(ll.lat).toFixed(7)}, ${Number(ll.lng).toFixed(7)}`;
    const mainRow = document.querySelector('.gps-point-main-fields');
    const storedType = normalizePointType(props.surveyPointType || props.pointType || (props.hasPhysicalMark ? 'M' : (props.importedPoint ? 'P' : 'V')));
    if (mainRow) {
      if (storedType === 'P' || storedType === 'M' || props.importedPoint === true) mainRow.dataset.imported = '1';
      else delete mainRow.dataset.imported;
      mainRow.dataset.importSource = String(props.source || 'edited-point');
      mainRow.dataset.pointType = storedType;
    }
    if ($('gpsPointHasMark')) $('gpsPointHasMark').checked = storedType === 'M' || props.hasPhysicalMark === true;
    const typeSelect=mainRow?.querySelector('.gps-point-type-select');
    if(typeSelect){
      // Um antigo ponto V salvo permanece identificável até edição explícita.
      if(storedType==='V' && !typeSelect.querySelector('[value="V"]'))typeSelect.add(new Option('V · Virtual (cadastro antigo)','V'));
      typeSelect.value=storedType;
    }
    if ($('gpsAdditionalPoints')) $('gpsAdditionalPoints').innerHTML = '';
    syncPointClassifications();
    $('gpsPointDialog')?.classList.add('is-editing-single');
    const title = $('gpsPointTitle');
    if (title) title.textContent = 'Editar ponto';
    const save = $('gpsCreatePointBtn');
    if (save) save.textContent = 'Salvar alterações';
    setStatus('');
    return true;
  }

  function setPanelVisible(visible) {
    const panel = $('gpsPointDialog');
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    panel.style.setProperty('display', visible ? 'block' : 'none', 'important');
    document.body.classList.toggle('surveyor-gps-panel-open', visible);
    try { window.dispatchEvent(new CustomEvent('surveyor:gps-panel-visibility', { detail: { visible: Boolean(visible) } })); } catch {}
    if (visible) { placePanel(); bindPanelDrag(); }
  }

  function showNewPointPanel() {
    explicitOpen = true;
    closeElementDetails();
    resetForm();
    setPanelVisible(true);
    activateMapPick();
  }

  function showGpsPanel() { showNewPointPanel(); }

  function showEditPointPanel(detail) {
    explicitOpen = true;
    closeElementDetails();
    if (!fillEditForm(detail)) return;
    setPanelVisible(true);
    activateMapPick();
  }

  function hidePointPanel() {
    setPanelVisible(false);
    detachMapPick();
    clearPreview();
    clearMultiPreview();
    editingLayer = null;
    document.body.classList.remove('surveyor-gps-pick-mode');
    setStatus('');
  }

  function setCoordinates(lat, lng) {
    if ($('gpsPointCrs')) $('gpsPointCrs').value = 'EPSG:4326';
    if ($('gpsPointFirst')) $('gpsPointFirst').value = Number(lat).toFixed(7);
    if ($('gpsPointSecond')) $('gpsPointSecond').value = Number(lng).toFixed(7);
    const target = lastEmptyCoordinateInput() || $('gpsPointCoords');
    if (target) target.value = `${Number(lat).toFixed(7)}, ${Number(lng).toFixed(7)}`;
    syncMainHiddenCoordinates();
    updatePolygonSuggestion();
    if ($('gpsPointFirstLabel')) $('gpsPointFirstLabel').textContent = 'Latitude';
    if ($('gpsPointSecondLabel')) $('gpsPointSecondLabel').textContent = 'Longitude';
    const accuracy = $('gpsPointAccuracy');
    if (accuracy) { accuracy.classList.add('hidden'); accuracy.textContent=''; delete accuracy.dataset.accuracy; }
  }

  function applyMapClick(event, map) {
    if ($('gpsPointDialog')?.classList.contains('hidden')) return;
    if (event.target.closest?.('.leaflet-control, .leaflet-popup, .gps-point-dialog, .surveyor-orientation-control')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeElementDetails();
    try { map.closePopup?.(); } catch {}
    let point = null;
    try { point = map.mouseEventToLatLng?.(event); } catch {}
    if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) return;
    setCoordinates(point.lat, point.lng);
    if (editingLayer) putPreview(point.lat, point.lng);
  }

  function detachMapPick() {
    if (gpsRetryTimer) clearTimeout(gpsRetryTimer);
    gpsRetryTimer = null;
    if (gpsContainer && gpsContainerHandler) gpsContainer.removeEventListener('click', gpsContainerHandler, true);
    gpsContainer = null;
    gpsContainerHandler = null;
  }

  function activateMapPick(attempt = 0) {
    const map = resolveMap();
    const container = map?.getContainer?.();
    if (!map || !container) {
      if (attempt < 240 && !$('gpsPointDialog')?.classList.contains('hidden')) gpsRetryTimer = setTimeout(() => activateMapPick(attempt + 1), 50);
      return;
    }
    detachMapPick();
    gpsContainer = container;
    gpsContainerHandler = (event) => applyMapClick(event, map);
    container.addEventListener('click', gpsContainerHandler, true);
    document.body.classList.add('surveyor-gps-pick-mode');
  }

  function numericPoint(value) {
    const n = Number(String(value ?? '').trim().replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  function parseCoordinatePair(value, crs = 'EPSG:4326') {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const parts = raw.split(/[;,\s]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const a = Number(parts[0].replace(',', '.'));
    const b = Number(parts[1].replace(',', '.'));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (crs === 'EPSG:31984') {
      if (!window.proj4) return null;
      try {
        const converted = proj4('EPSG:31984', 'EPSG:4326', [a, b]);
        const lng = Number(converted?.[0]);
        const lat = Number(converted?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng, original: [a, b], crs };
      } catch { return null; }
    }
    if (a < -90 || a > 90 || b < -180 || b > 180) return null;
    return { lat: a, lng: b, original: [a, b], crs };
  }

  function syncMainHiddenCoordinates() {
    const crs = $('gpsPointCrs')?.value || 'EPSG:4326';
    const parsed = parseCoordinatePair($('gpsPointCoords')?.value, crs);
    if ($('gpsPointFirst')) $('gpsPointFirst').value = parsed ? String(parsed.lat) : '';
    if ($('gpsPointSecond')) $('gpsPointSecond').value = parsed ? String(parsed.lng) : '';
    return parsed;
  }

  function pointRows() {
    const rows = [];
    const main = document.querySelector('.gps-point-main-fields');
    if (main) rows.push(main);
    document.querySelectorAll('#gpsAdditionalPoints .gps-additional-point-row').forEach((row) => rows.push(row));
    return rows;
  }

  function validPanelPoints() {
    const crs = $('gpsPointCrs')?.value || 'EPSG:4326';
    const classifications = pointRowClassifications();
    return classifications.map(({ row, type, code, imported }, index) => {
      const coordsInput = row.querySelector('.gps-multi-coords');
      const nameInput = row.querySelector('.gps-multi-name');
      const parsed = parseCoordinatePair(coordsInput?.value, crs);
      if (!parsed) return null;
      const source = imported ? String(row.dataset.importSource || 'file-import') : 'manual-map-point';
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        name: String(nameInput?.value || '').trim() || code,
        vertexLabel: code,
        pointCode: code,
        surveyPointType: type,
        hasPhysicalMark: type === 'M',
        imported,
        crs: 'EPSG:4326',
        originalCoordinates: parsed.original,
        source,
        capturedAt: new Date().toISOString()
      };
    }).filter(Boolean);
  }

  function lastEmptyCoordinateInput() {
    const inputs = [...document.querySelectorAll('.gps-multi-coords')];
    return [...inputs].reverse().find((input) => !String(input.value || '').trim()) || null;
  }

  function updateMultiPointPreview() {
    if (editingLayer) { clearMultiPreview(); return; }
    const map = resolveMap();
    if (!map || !window.L) return;
    clearMultiPreview();
    const points = validPanelPoints();
    if (!points.length) return;

    gpsMultiPreviewGroup = L.layerGroup().addTo(map);
    points.forEach((point, index) => {
      const icon = yellowPinIcon();
      const marker = L.marker([point.lat, point.lng], {
        interactive: false,
        keyboard: false,
        zIndexOffset: 2100 + index,
        ...(icon ? { icon } : {})
      }).addTo(gpsMultiPreviewGroup);
      const tooltipName = point.name && point.name !== point.pointCode ? `${point.pointCode} · ${point.name}` : point.pointCode;
      marker.bindTooltip(tooltipName || `Ponto ${index + 1}`, {
        permanent: false,
        direction: 'top',
        className: 'gps-staged-point-tooltip'
      });
    });
    if (points.length >= 2) {
      gpsMultiPreviewLine = L.polyline(points.map((point) => [point.lat, point.lng]), {
        color: '#2563eb', weight: 3, opacity: .9, dashArray: '7 6', interactive: false,
        lineCap: 'round', lineJoin: 'round'
      }).addTo(map);
    }
  }

  function updatePolygonSuggestion() {
    const suggestion = $('gpsPolygonSuggestion');
    if (!suggestion) return;
    if (editingLayer) {
      suggestion.classList.add('hidden');
      clearMultiPreview();
      return;
    }
    const total = validPanelPoints().length;
    suggestion.classList.toggle('hidden', total < 3);
    const title = $('gpsPolygonSuggestionTitle');
    if (title) title.textContent = `${total} pontos válidos`;
    updateMultiPointPreview();
  }

  function createAdditionalPointRow({ focus = true } = {}) {
    const host = $('gpsAdditionalPoints');
    if (!host || editingLayer) return;
    additionalPointSeq += 1;
    const row = document.createElement('div');
    row.className = 'gps-additional-point-row';
    row.dataset.pointRow = String(additionalPointSeq);
    row.innerHTML = `
      <div class="gps-additional-point-index">Ponto ${additionalPointSeq + 1}</div>
      <label>Nome do ponto
        <input class="gps-multi-name" type="text" maxlength="120" placeholder="Ex.: Ponto da divisa" autocomplete="off">
      </label>
      <div class="gps-point-classification" data-point-classification>
        <span>Tipo do ponto</span>
        <strong class="gps-point-type-badge" data-point-type-badge>P-01 · Ponto</strong>
        <select class="gps-point-type-select" aria-label="Tipo do ponto"><option value="P">P · Ponto</option><option value="M">M · Marco</option></select>
        <label class="gps-point-mark-option hidden">
          <input class="gps-point-has-mark" type="checkbox">
          <span>Possui marco</span>
        </label>
      </div>
      <label>Coordenadas
        <input class="gps-multi-coords" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex.: -13.0312240, -39.6059600">
      </label>`;
    host.appendChild(row);
    row.querySelector('.gps-multi-coords')?.addEventListener('input', updatePolygonSuggestion);
    row.querySelector('.gps-point-type-select')?.addEventListener('change', () => { syncPointClassifications(); updatePolygonSuggestion(); });
    if (focus) row.querySelector('.gps-multi-name')?.focus();
    syncPointClassifications();
    updatePolygonSuggestion();
    requestAnimationFrame(placePanel);
    return row;
  }

  function savePoint() {
    const runtime = window.SurveyorMapRuntime;
    if (!runtime?.addGpsPoint) return false;

    if (editingLayer) {
      const parsed = syncMainHiddenCoordinates();
      if (!parsed) {
        setStatus('Informe coordenadas válidas. Ex.: -13.0312, -39.6059.', 'error');
        return true;
      }
      const classification = pointRowClassifications()[0] || { type: 'P', code: 'P-01', imported: false };
      const payload = {
        lat: parsed.lat, lng: parsed.lng,
        name: $('gpsPointName')?.value?.trim() || classification.code,
        source: classification.imported ? String(document.querySelector('.gps-point-main-fields')?.dataset.importSource || 'edited-imported-point') : 'edited-point',
        crs: 'EPSG:4326', originalCoordinates: parsed.original,
        surveyPointType: classification.type,
        pointCode: classification.code,
        hasPhysicalMark: classification.type === 'M',
        imported: classification.imported,
        capturedAt: new Date().toISOString(), silent: true
      };
      try {
        runtime.updateGpsPoint?.(editingLayer, payload);
        clearPreview(); closeElementDetails(); hidePointPanel();
      } catch (error) {
        console.error('[Surveyor] Falha ao salvar ponto:', error);
        setStatus(error?.message || 'Não foi possível salvar o ponto.', 'error');
      }
      return true;
    }

    const points = validPanelPoints();
    if (!points.length) {
      setStatus('Informe ao menos um ponto com coordenadas válidas. Ex.: -13.0312, -39.6059.', 'error');
      return true;
    }
    try {
      const layers = [];
      points.forEach((point, index) => {
        const layer = runtime.addGpsPoint({ ...point, silent: true, focus: false, skipUndo: index > 0 });
        if (layer) layers.push(layer);
      });
      const map = resolveMap();
      if (map && window.L?.latLngBounds && layers.length) {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
        if (bounds?.isValid?.()) map.fitBounds(bounds.pad(0.15), { maxZoom: 18 });
      }
      clearPreview(); closeElementDetails(); hidePointPanel();
    } catch (error) {
      console.error('[Surveyor] Falha ao salvar pontos:', error);
      setStatus(error?.message || 'Não foi possível salvar os pontos.', 'error');
    }
    return true;
  }

  function createPolygonFromPanelPoints() {
    const runtime = window.SurveyorMapRuntime;
    const points = validPanelPoints();
    if (!runtime?.addPolygonFromImportedPoints) {
      setStatus('O editor de polígonos ainda está carregando.', 'error');
      return;
    }
    if (points.length < 3) {
      setStatus('Adicione pelo menos 3 pontos válidos para criar um polígono.', 'error');
      return;
    }
    try {
      const polygon = runtime.addPolygonFromImportedPoints(points, {
        name: $('gpsPointName')?.value?.trim() || 'Polígono por coordenadas',
        source: 'manual-multi-point', skipUndo: false, editable: true
      });
      if (!polygon) throw new Error('Não foi possível criar o polígono.');
      const map = resolveMap();
      const bounds = polygon.getBounds?.();
      if (map && bounds?.isValid?.()) map.fitBounds(bounds.pad(0.15), { maxZoom: 18 });
      hidePointPanel();
    } catch (error) {
      setStatus(error?.message || 'Não foi possível criar o polígono.', 'error');
    }
  }

  function normalizeHeader(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function numeric(value) {
    const n = Number(String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  function textHeaderIndexes(cells = []) {
    const headers = cells.map(normalizeHeader);
    const find = (keys) => headers.findIndex((header) => keys.includes(header));
    return {
      lat: find(['latitude', 'lat', 'y']),
      lng: find(['longitude', 'long', 'lon', 'lng', 'x']),
      name: find(['nome', 'name', 'ponto', 'point', 'marco', 'id', 'codigo', 'code'])
    };
  }

  function detectTxtDelimiter(line = '') {
    const value = String(line || '');
    if (value.includes('\t')) return '\t';
    if (value.includes(';')) return ';';
    if (value.includes('|')) return '|';
    const normalized = normalizeHeader(value);
    if (value.includes(',') && /(?:longitude|long|lon|lng)/.test(normalized) && /(?:latitude|lat)/.test(normalized)) return ',';
    return null;
  }

  function splitTxtLine(line = '', delimiter = null) {
    const value = String(line || '').trim();
    if (!value) return [];
    if (delimiter) return value.split(delimiter).map((cell) => String(cell || '').trim().replace(/^['\"]|['\"]$/g, ''));
    return value.split(/\s+/).map((cell) => String(cell || '').trim()).filter(Boolean);
  }

  function cleanTxtPointName(value = '') {
    return String(value || '')
      .replace(/^[\s;,|:\-]+|[\s;,|:\-]+$/g, '')
      .replace(/^['\"]|['\"]$/g, '')
      .trim();
  }

  function txtNumericCandidates(line = '') {
    const source = String(line || '');
    const out = [];
    const pattern = /[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)/g;
    let match;
    while ((match = pattern.exec(source))) {
      const value = numeric(match[0]);
      if (!Number.isFinite(value)) continue;
      out.push({ raw: match[0], value, start: match.index, end: pattern.lastIndex });
    }
    return out;
  }

  function scoreTxtLngLatPair(line, first, second, index) {
    const lng = Number(first?.value);
    const lat = Number(second?.value);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) return -Infinity;
    let score = 0;
    if (lng >= -74.5 && lng <= -32 && lat >= -34.5 && lat <= 6.5) score += 14;
    if (/[.,]\d/.test(first.raw)) score += 3;
    if (/[.,]\d/.test(second.raw)) score += 3;
    if (Math.abs(lng) >= 20) score += 1;
    if (Math.abs(lat) <= 40) score += 1;
    const before = String(line || '').slice(Math.max(0, first.start - 1), first.start);
    if (/[A-Za-zÀ-ÿ]/.test(before)) score -= 8;
    if (index > 0) score += Math.min(index, 3) * 0.5;
    return score;
  }

  function inferTxtLngLat(line = '') {
    const candidates = txtNumericCandidates(line);
    let best = null;
    for (let i = 0; i < candidates.length - 1; i += 1) {
      const first = candidates[i];
      const second = candidates[i + 1];
      const score = scoreTxtLngLatPair(line, first, second, i);
      if (!Number.isFinite(score)) continue;
      if (!best || score > best.score) best = { first, second, score };
    }
    if (!best) return null;
    const before = cleanTxtPointName(String(line || '').slice(0, best.first.start));
    const after = cleanTxtPointName(String(line || '').slice(best.second.end));
    return {
      lng: Number(best.first.value),
      lat: Number(best.second.value),
      name: before || after || '',
      original: [Number(best.first.value), Number(best.second.value)]
    };
  }

  function parseTxtPoints(text, fileName = 'TXT') {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const lines = source.split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter((line) => line && !/^\s*(?:#|\/\/)/.test(line));
    if (!lines.length) throw new Error('O TXT está vazio.');

    let headerIndex = -1;
    let headerDelimiter = null;
    let headerColumns = null;
    const headerSearchLimit = Math.min(lines.length, 12);
    for (let i = 0; i < headerSearchLimit; i += 1) {
      const delimiter = detectTxtDelimiter(lines[i]);
      const cells = splitTxtLine(lines[i], delimiter);
      const indexes = textHeaderIndexes(cells);
      if (indexes.lng >= 0 && indexes.lat >= 0) {
        headerIndex = i;
        headerDelimiter = delimiter;
        headerColumns = indexes;
        break;
      }
    }

    const baseName = String(fileName || 'TXT').replace(/\.[^.]+$/, '') || 'Ponto';
    const points = [];
    if (headerColumns) {
      for (let i = headerIndex + 1; i < lines.length && points.length < 5000; i += 1) {
        const row = splitTxtLine(lines[i], headerDelimiter);
        const lng = numeric(row[headerColumns.lng]);
        const lat = numeric(row[headerColumns.lat]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) continue;
        points.push({
          lat,
          lng,
          name: cleanTxtPointName(headerColumns.name >= 0 ? row[headerColumns.name] : '') || `${baseName} ${points.length + 1}`,
          source: 'txt-import',
          crs: 'EPSG:4326',
          originalCoordinates: [lng, lat],
          capturedAt: new Date().toISOString()
        });
      }
    } else {
      for (const line of lines) {
        if (points.length >= 5000) break;
        const parsed = inferTxtLngLat(line);
        if (!parsed) continue;
        points.push({
          lat: parsed.lat,
          lng: parsed.lng,
          name: parsed.name || `${baseName} ${points.length + 1}`,
          source: 'txt-import',
          crs: 'EPSG:4326',
          originalCoordinates: parsed.original,
          capturedAt: new Date().toISOString()
        });
      }
    }

    if (!points.length) {
      throw new Error('Não encontrei coordenadas válidas no TXT. Sem cabeçalho, use Longitude na 1ª coluna e Latitude na 2ª.');
    }
    points.importMeta = {
      kind: 'txt',
      validPoints: points.length,
      headerDetected: Boolean(headerColumns),
      order: headerColumns ? 'header-detected' : 'longitude-latitude'
    };
    return points;
  }

  function parseCsv(text) {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const firstLine = source.split(/\r?\n/, 1)[0] || '';
    const counts = [',', ';', '\t'].map((d) => [d, (firstLine.match(new RegExp(d === '\t' ? '\\t' : `\\${d}`, 'g')) || []).length]);
    counts.sort((a, b) => b[1] - a[1]);
    const delimiter = counts[0][0];
    const rows = [];
    let row = [], cell = '', quote = false;
    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '"') {
        if (quote && source[i + 1] === '"') { cell += '"'; i += 1; }
        else quote = !quote;
      } else if (!quote && ch === delimiter) {
        row.push(cell); cell = '';
      } else if (!quote && (ch === '\n' || ch === '\r')) {
        if (ch === '\r' && source[i + 1] === '\n') i += 1;
        row.push(cell); cell = '';
        if (row.some((v) => String(v).trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((v) => String(v).trim() !== '')) rows.push(row);
    return rows;
  }

  function colIndex(ref) {
    const letters = String(ref || '').match(/[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
    let n = 0;
    for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
    return n - 1;
  }

  async function parseXlsx(file) {
    if (!window.JSZip) throw new Error('Leitor XLSX ainda não carregou. Atualize a página e tente novamente.');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const shared = [];
    const sharedEntry = zip.file('xl/sharedStrings.xml');
    if (sharedEntry) {
      const doc = new DOMParser().parseFromString(await sharedEntry.async('text'), 'application/xml');
      for (const si of [...doc.getElementsByTagName('si')]) {
        shared.push([...si.getElementsByTagName('t')].map((n) => n.textContent || '').join(''));
      }
    }
    let sheetPath = 'xl/worksheets/sheet1.xml';
    const wbEntry = zip.file('xl/workbook.xml');
    const relEntry = zip.file('xl/_rels/workbook.xml.rels');
    if (wbEntry && relEntry) {
      const wb = new DOMParser().parseFromString(await wbEntry.async('text'), 'application/xml');
      const firstSheet = wb.getElementsByTagName('sheet')[0];
      const rid = firstSheet?.getAttribute('r:id') || firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      if (rid) {
        const rels = new DOMParser().parseFromString(await relEntry.async('text'), 'application/xml');
        const rel = [...rels.getElementsByTagName('Relationship')].find((n) => n.getAttribute('Id') === rid);
        const target = rel?.getAttribute('Target');
        if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      }
    }
    const sheetEntry = zip.file(sheetPath) || zip.file('xl/worksheets/sheet1.xml');
    if (!sheetEntry) throw new Error('A planilha não possui uma aba legível.');
    const doc = new DOMParser().parseFromString(await sheetEntry.async('text'), 'application/xml');
    const rows = [];
    for (const rowNode of [...doc.getElementsByTagName('row')]) {
      const row = [];
      for (const c of [...rowNode.getElementsByTagName('c')]) {
        const idx = colIndex(c.getAttribute('r'));
        const type = c.getAttribute('t');
        let value = '';
        if (type === 'inlineStr') value = [...c.getElementsByTagName('t')].map((n) => n.textContent || '').join('');
        else {
          const raw = c.getElementsByTagName('v')[0]?.textContent ?? '';
          value = type === 's' ? (shared[Number(raw)] ?? raw) : raw;
        }
        row[idx] = value;
      }
      if (row.some((v) => String(v ?? '').trim() !== '')) rows.push(row);
    }
    return rows;
  }

  function rowsToPoints(rows, fileName = 'Planilha') {
    if (!rows?.length) throw new Error('A planilha está vazia.');
    const headers = rows[0].map(normalizeHeader);
    const find = (keys) => headers.findIndex((h) => keys.includes(h));
    let latIdx = find(['latitude', 'lat', 'y']);
    let lngIdx = find(['longitude', 'long', 'lon', 'lng', 'x']);
    const eastIdx = find(['easting', 'este', 'e', 'utmeste']);
    const northIdx = find(['northing', 'norte', 'n', 'utmnorte']);
    const nameIdx = find(['nome', 'name', 'ponto', 'point', 'marco', 'id', 'codigo', 'code']);
    let start = 1;
    if (latIdx < 0 || lngIdx < 0) {
      const a = numeric(rows[0]?.[0]);
      const b = numeric(rows[0]?.[1]);
      if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) {
        latIdx = 0; lngIdx = 1; start = 0;
      }
    }
    const selectedCrs = $('gpsPointCrs')?.value || 'EPSG:4326';
    const out = [];
    for (let i = start; i < rows.length && out.length < 5000; i += 1) {
      const row = rows[i] || [];
      let lat = latIdx >= 0 ? numeric(row[latIdx]) : NaN;
      let lng = lngIdx >= 0 ? numeric(row[lngIdx]) : NaN;
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && eastIdx >= 0 && northIdx >= 0 && selectedCrs === 'EPSG:31984' && window.proj4) {
        const e = numeric(row[eastIdx]);
        const n = numeric(row[northIdx]);
        if (Number.isFinite(e) && Number.isFinite(n)) {
          try {
            const converted = proj4('EPSG:31984', 'EPSG:4326', [e, n]);
            lng = Number(converted?.[0]); lat = Number(converted?.[1]);
          } catch {}
        }
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      const sourceLabel = String(nameIdx >= 0 ? (row[nameIdx] ?? '') : '').trim();
      out.push({
        lat, lng,
        name: sourceLabel || `${fileName.replace(/\.[^.]+$/, '')} ${out.length + 1}`,
        vertexLabel: sourceLabel,
        source: 'spreadsheet-import',
        crs: 'EPSG:4326',
        originalCoordinates: [lat, lng],
        capturedAt: new Date().toISOString()
      });
    }
    if (!out.length) throw new Error('Não encontrei pontos válidos. Use colunas Latitude/Longitude (ou E/N com UTM 24S selecionado).');
    return out;
  }

  function parseKmlPoints(text, fileName = 'KML') {
    const doc = new DOMParser().parseFromString(String(text || ''), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('KML inválido.');
    const points = [];
    const placemarks = [...doc.getElementsByTagName('Placemark')];
    for (const placemark of placemarks) {
      const point = placemark.getElementsByTagName('Point')[0];
      const raw = point?.getElementsByTagName('coordinates')[0]?.textContent?.trim();
      if (!raw) continue;
      const first = raw.split(/\s+/)[0];
      const [lngRaw, latRaw] = first.split(',');
      const lat = Number(latRaw), lng = Number(lngRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      const name = placemark.getElementsByTagName('name')[0]?.textContent?.trim() || `${fileName.replace(/\.[^.]+$/, '')} ${points.length + 1}`;
      points.push({ lat, lng, name, source: 'kml-import', crs: 'EPSG:4326', originalCoordinates: [lat, lng], capturedAt: new Date().toISOString() });
      if (points.length >= 5000) break;
    }
    if (!points.length) throw new Error('O KML não possui pontos válidos.');
    return points;
  }

  function naturalFileCompare(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
  }

  async function parseZipKmlPoints(file) {
    if (!window.JSZip) throw new Error('Leitor ZIP ainda não carregou. Atualize a página e tente novamente.');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files || {})
      .filter((entry) => !entry.dir && /\.kml$/i.test(String(entry.name || '')) && !/(^|\/)__MACOSX(\/|$)/i.test(String(entry.name || '')))
      .sort((a, b) => naturalFileCompare(a.name, b.name));

    if (!entries.length) throw new Error('O ZIP não contém arquivos KML. Coloque um KML para cada ponto.');
    if (entries.length > 5000) throw new Error('O ZIP contém KMLs demais. O limite por importação é de 5.000 pontos.');

    const points = [];
    const warnings = [];
    for (const entry of entries) {
      const shortName = String(entry.name || '').split('/').pop() || 'Ponto.kml';
      try {
        const parsed = parseKmlPoints(await entry.async('text'), shortName);
        if (!parsed.length) continue;
        // O fluxo ZIP é 1 KML = 1 ponto. Se um KML trouxer vários Point,
        // usa o primeiro e informa a inconsistência sem duplicar o ponto.
        const point = parsed[0];
        const fallbackName = shortName.replace(/\.kml$/i, '').trim() || `Ponto ${points.length + 1}`;
        const currentName = String(point.name || '').trim();
        if (!currentName || currentName === `${fallbackName} 1`) {
          point.name = fallbackName;
        }
        point.source = 'zip-kml-import';
        point.kmlFileName = shortName;
        points.push(point);
        if (parsed.length > 1) warnings.push(`${shortName}: ${parsed.length} pontos encontrados; usado o primeiro.`);
      } catch (error) {
        warnings.push(`${shortName}: ${error?.message || 'KML inválido'}`);
      }
    }

    if (!points.length) throw new Error('Nenhum KML válido com ponto foi encontrado dentro do ZIP.');
    points.importMeta = {
      kind: 'zip-kml',
      kmlFiles: entries.length,
      validPoints: points.length,
      warnings
    };
    return points;
  }

  async function parsePointFile(file) {
    const name = String(file?.name || 'arquivo');
    const ext = name.toLowerCase().split('.').pop();
    if (ext === 'zip') return parseZipKmlPoints(file);
    if (ext === 'kml') return parseKmlPoints(await file.text(), name);
    if (ext === 'csv') return rowsToPoints(parseCsv(await file.text()), name);
    if (ext === 'txt') return parseTxtPoints(await file.text(), name);
    if (ext === 'xlsx') return rowsToPoints(await parseXlsx(file), name);
    throw new Error('Formato não suportado. Use TXT, ZIP com KMLs, KML, CSV ou XLSX.');
  }

  function setPointRowValues(row, point) {
    if (!row || !point) return;
    const nameInput = row.querySelector('.gps-multi-name');
    const coordsInput = row.querySelector('.gps-multi-coords');
    if (nameInput) nameInput.value = String(point.name || '').trim() || 'Ponto';
    if (coordsInput) coordsInput.value = `${Number(point.lat).toFixed(7)}, ${Number(point.lng).toFixed(7)}`;
    row.dataset.importSource = String(point.source || 'file-import');
    row.dataset.imported = '1';
    const explicitType = normalizePointType(point.surveyPointType || point.pointType || (point.hasPhysicalMark ? 'M' : 'P'));
    const hasMark = row.querySelector('.gps-point-has-mark');
    if (hasMark) hasMark.checked = explicitType === 'M' || point.hasPhysicalMark === true;
    const select=row.querySelector('.gps-point-type-select');
    if(select)select.value=explicitType==='M'?'M':'P';
    syncPointClassifications();
  }

  function importTargetRow() {
    const rows = pointRows();
    if (rows.length <= 1) return rows[0] || null; // primeiro KML sobrescreve/preenche o Ponto 1
    const last = rows[rows.length - 1];
    const coords = last?.querySelector?.('.gps-multi-coords');
    if (last && !String(coords?.value || '').trim()) return last; // após clicar +, o KML entra no novo ponto
    return createAdditionalPointRow({ focus: false });
  }

  async function stageImportedPoints(file) {
    if (editingLayer) throw new Error('Finalize a edição do ponto atual antes de importar novos pontos.');
    const points = await parsePointFile(file);
    if (!points.length) throw new Error('Nenhum ponto válido foi encontrado no arquivo.');
    if (points.every((point) => point?.crs === 'EPSG:4326') && $('gpsPointCrs')) $('gpsPointCrs').value = 'EPSG:4326';

    let target = importTargetRow();
    points.forEach((point, index) => {
      if (!target) target = createAdditionalPointRow({ focus: false });
      setPointRowValues(target, point);
      if (index < points.length - 1) target = createAdditionalPointRow({ focus: false });
    });

    syncMainHiddenCoordinates();
    updatePolygonSuggestion();
    const staged = validPanelPoints();
    const map = resolveMap();
    if (map && window.L?.latLngBounds && staged.length) {
      const bounds = L.latLngBounds(staged.map((point) => [point.lat, point.lng]));
      if (bounds?.isValid?.()) map.fitBounds(bounds.pad(0.18), { maxZoom: 18 });
    }
    const meta = points.importMeta || null;
    let importedLabel = points.length === 1 ? 'Ponto importado para o formulário.' : `${points.length} pontos importados para o formulário.`;
    if (meta?.kind === 'zip-kml') {
      importedLabel = `ZIP lido: ${meta.kmlFiles} KML${meta.kmlFiles === 1 ? '' : 's'}; ${meta.validPoints} ponto${meta.validPoints === 1 ? '' : 's'} carregado${meta.validPoints === 1 ? '' : 's'}.`;
      if (meta.warnings?.length) importedLabel += ` ${meta.warnings.length} arquivo${meta.warnings.length === 1 ? '' : 's'} com aviso.`;
    }
    const importedNameNote = meta?.kind === 'zip-kml'
      ? 'Os nomes definidos nos KMLs foram preservados.'
      : meta?.kind === 'txt'
        ? (meta.headerDetected
          ? 'TXT reconhecido pelo cabeçalho de Longitude/Latitude.'
          : 'TXT reconhecido automaticamente: 1ª coordenada = Longitude; 2ª = Latitude.')
        : 'Nomes disponíveis no arquivo foram preservados.';
    setStatus(`${importedLabel} ${importedNameNote} Os pontos entram como P por padrão. Use Tipo do ponto para selecionar P (ponto) ou M (marco).`, 'success');
    setTimeout(() => setStatus(''), 3800);
    requestAnimationFrame(placePanel);
    return points;
  }

  async function importPoints(file) {
    const runtime = window.SurveyorMapRuntime;
    if (!runtime?.addGpsPoint || !runtime?.addPolygonFromImportedPoints) {
      throw new Error('O mapa ainda está carregando. Tente novamente em alguns segundos.');
    }
    const points = (await parsePointFile(file)).map((point, index) => ({
      ...point,
      imported: true,
      surveyPointType: 'P',
      hasPhysicalMark: false,
      pointCode: `P-${String(index + 1).padStart(2, '0')}`,
      vertexLabel: `P-${String(index + 1).padStart(2, '0')}`
    }));
    let polygon = null;
    const layers = [];

    // Quando existem 3+ pontos, a importação representa um perímetro: cria somente
    // o polígono editável. Os alfinetes individuais não entram no projeto nem ficam
    // cobrindo os vértices. Para 1–2 pontos, mantém os alfinetes porque não há área.
    if (points.length >= 3) {
      polygon = runtime.addPolygonFromImportedPoints(points, {
        name: `${String(file?.name || 'Pontos').replace(/\.[^.]+$/, '')} — Perímetro`,
        fileName: String(file?.name || ''),
        source: 'points-import',
        skipUndo: false,
        editable: true
      });
      if (!polygon) throw new Error('Não foi possível gerar o polígono a partir dos pontos importados.');
    } else {
      points.forEach((point, index) => {
        try {
          const layer = runtime.addGpsPoint({
            ...point,
            imported: true,
            focus: false,
            silent: true,
            skipUndo: index > 0
          });
          if (layer) layers.push(layer);
        } catch {}
      });
      if (!layers.length) throw new Error('Nenhum ponto pôde ser adicionado ao mapa.');
    }

    const map = resolveMap();
    if (map && window.L?.latLngBounds) {
      const bounds = polygon?.getBounds?.() || L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      if (bounds?.isValid?.()) map.fitBounds(bounds.pad(0.15), { maxZoom: 18 });
    }
    clearPreview();
    if (polygon) {
      setStatus(`${points.length} pontos lidos. Polígono gerado e pronto para editar no lápis.`, 'success');
    } else {
      setStatus(`${layers.length} ponto${layers.length === 1 ? '' : 's'} importado${layers.length === 1 ? '' : 's'}. São necessários 3 pontos para gerar um polígono.`, 'success');
    }
    setTimeout(() => setStatus(''), 4200);
  }



  document.addEventListener('click', (event) => {
    const toggle = event.target.closest?.('#mapQuickToolsToggle');
    if (toggle) {
      event.preventDefault(); event.stopImmediatePropagation();
      setDrawer(toggle.getAttribute('aria-expanded') !== 'true');
      return;
    }
    const launcher = event.target.closest?.('#topQuickMarkPointBtn, #markGpsPointBtn, .map-quick-grid-tool[aria-label="Marcar ponto"]');
    if (launcher) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!$('gpsPointDialog')?.classList.contains('hidden')) { hidePointPanel(); return; }
      try { $('cancelToolBtn')?.click(); } catch {}
      showGpsPanel();
      return;
    }
    const addPoint = event.target.closest?.('#gpsAddPointBtn');
    if (addPoint) {
      event.preventDefault(); event.stopImmediatePropagation(); createAdditionalPointRow(); return;
    }
    const makePolygon = event.target.closest?.('#gpsCreatePolygonBtn');
    if (makePolygon) {
      event.preventDefault(); event.stopImmediatePropagation(); createPolygonFromPanelPoints(); return;
    }
    const importButton = event.target.closest?.('#gpsImportPointsBtn');
    if (importButton) {
      event.preventDefault(); event.stopImmediatePropagation();
      $('gpsImportPointsInput')?.click();
      return;
    }
    const close = event.target.closest?.('#gpsPointCloseBtn');
    if (close) {
      event.preventDefault(); event.stopImmediatePropagation(); hidePointPanel(); return;
    }
    const save = event.target.closest?.('#gpsCreatePointBtn');
    if (save && savePoint()) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
  }, true);

  window.addEventListener('surveyor:gps-point-selected', (event) => {
    const detail = event.detail || {};
    if (detail.reason !== 'click' || !detail.layer) return;
    showEditPointPanel(detail);
  });

  function boot() {
    setDrawer(false);
    // Estado inicial sempre limpo: o painel nunca aparece sozinho ao abrir o mapa.
    setPanelVisible(false);
    detachMapPick();
    clearPreview();
    editingLayer = null;
    explicitOpen = false;
    bindPanelDrag();

    $('gpsPointCoords')?.addEventListener('input', () => { syncMainHiddenCoordinates(); syncPointClassifications(); updatePolygonSuggestion(); });
    $('gpsPointCrs')?.addEventListener('change', () => { syncMainHiddenCoordinates(); updatePolygonSuggestion(); });
    $('gpsPointHasMark')?.addEventListener('change', () => { syncPointClassifications(); updatePolygonSuggestion(); });
    $('gpsPointTypeSelect')?.addEventListener('change', () => { syncPointClassifications(); updatePolygonSuggestion(); });
    $('gpsAdditionalPoints')?.addEventListener('input', updatePolygonSuggestion);
    $('gpsAdditionalPoints')?.addEventListener('change', (event) => {
      if (event.target?.matches?.('.gps-point-type-select,.gps-point-has-mark')) { syncPointClassifications(); updatePolygonSuggestion(); }
    });
    syncPointClassifications();

    $('gpsImportPointsInput')?.addEventListener('change', async (event) => {
      const input = event.currentTarget;
      const file = input?.files?.[0];
      if (!file) return;
      try {
        setStatus('Importando pontos…');
        await stageImportedPoints(file);
      } catch (error) {
        console.error('[Surveyor] Importação de pontos falhou:', error);
        setStatus(error?.message || 'Não foi possível importar os pontos.', 'error');
      } finally { if (input) input.value = ''; }
    });

    window.addEventListener('resize', () => {
      if (!$('gpsPointDialog')?.classList.contains('hidden')) placePanel();
    });

  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
