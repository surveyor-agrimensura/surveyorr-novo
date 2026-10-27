(() => {
  'use strict';

  const SURVEYOR_MAP_UX_VERSION = '21.11.5f-layer-rotation-fix';

  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const state = { bearing: 0, wrapper: null, shield: null, map: null, control: null, orientationHandler: null, gpsPreview: null, gpsPickActive: false, gpsEditingLayer: null, gpsMapClickHandler: null, gpsMapContainerHandler: null, gpsPanelDrag: null, gpsLastSource: 'map-click' };

  function resolveMapInstance() {
    return state.map || window.SurveyorMapRuntime?.map || window.surveyorMapInstance || window.georuralMapInstance || null;
  }

  function ensureGpsLauncherBound() {
    const launchers = [$('markGpsPointBtn'), $('topQuickMarkPointBtn')].filter(Boolean);
    launchers.forEach((button) => {
      if (button.dataset.gpsLauncherBound === '1') return;
      button.dataset.gpsLauncherBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const map = resolveMapInstance();
        if (map) state.map = map;
        openGpsPanel();
      });
    });
  }

  function toast(message, type = '') {
    if (window.SurveyorMapRuntime?.toast) return window.SurveyorMapRuntime.toast(message, type);
    const node = $('toast');
    if (!node) return console[type === 'error' ? 'error' : 'log'](message);
    node.textContent = message;
    node.className = `toast show ${type || ''}`.trim();
    setTimeout(() => node.classList.remove('show'), 3200);
  }

  function normalizeBearing(value) {
    const n = Number(value) || 0;
    const v = ((n % 360) + 360) % 360;
    return Math.abs(v - 360) < .01 || Math.abs(v) < .01 ? 0 : v;
  }

  function rotationScale(angleDeg) {
    const mapEl = $('map');
    const w = Math.max(1, mapEl?.clientWidth || 1);
    const h = Math.max(1, mapEl?.clientHeight || 1);
    const r = Math.abs(Number(angleDeg || 0)) * Math.PI / 180;
    const neededW = Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r));
    const neededH = Math.abs(h * Math.cos(r)) + Math.abs(w * Math.sin(r));
    return Math.min(4, Math.max(1, neededW / w, neededH / h) + .045);
  }

  function canRotateNow() {
    return !body.classList.contains('drawing-active')
      && !body.classList.contains('surveyor-direct-editing')
      && !body.classList.contains('surveyor-gps-pick-mode');
  }

  function updateBearingUi() {
    if (!state.control) return;
    const compass = state.control.querySelector('.compass');
    const needle = state.control.querySelector('.compass-needle');
    const label = state.control.querySelector('.bearing-label');
    if (compass) compass.setAttribute('aria-valuenow', String(Math.round(normalizeBearing(state.bearing))));
    if (needle) needle.style.transform = `rotate(${-state.bearing}deg)`;
    if (label) label.textContent = state.bearing ? `${Math.round(state.bearing)}°` : 'Norte';
  }

  function finishDirectEditBeforeRotation() {
    if (!body.classList.contains('surveyor-direct-editing')) return true;
    try { window.SurveyorMapRuntime?.finishDirectEditForOrientation?.(); } catch {}
    return !body.classList.contains('surveyor-direct-editing');
  }

  function applyBearing(value, options = {}) {
    const next = normalizeBearing(value);
    if (next !== 0 && body.classList.contains('surveyor-direct-editing')) {
      if (!finishDirectEditBeforeRotation()) {
        toast('Finalize a edição antes de girar a visualização do mapa.', 'error');
        return false;
      }
    }
    if (next !== 0 && !canRotateNow() && !options.force) {
      toast('Conclua a edição/desenho antes de girar a visualização do mapa.', 'error');
      return false;
    }
    state.bearing = next;
    if (state.wrapper) {
      const scale = next ? rotationScale(next) : 1;
      state.wrapper.style.transform = next ? `rotate(${-next}deg) scale(${scale})` : '';
    }
    body.classList.toggle('surveyor-map-view-rotated', next !== 0);
    if (state.shield) state.shield.style.pointerEvents = next !== 0 ? 'auto' : 'none';
    updateBearingUi();
    if (!next) {
      const activeMap = resolveMapInstance();
      requestAnimationFrame(() => {
        activeMap?.invalidateSize?.({ animate: false, pan: false });
        requestAnimationFrame(() => activeMap?.invalidateSize?.({ animate: false, pan: false }));
      });
    }
    return true;
  }

  function resetBearing(options = {}) {
    const immediate = options?.immediate === true;
    if (immediate && state.wrapper) {
      const previousInlineTransition = state.wrapper.style.getPropertyValue('transition');
      const previousInlinePriority = state.wrapper.style.getPropertyPriority('transition');
      // O CSS comercial usa transition !important. Precisamos sobrescrevê-lo
      // também com !important para o reset de precisão ser realmente imediato.
      state.wrapper.style.setProperty('transition', 'none', 'important');
      applyBearing(0, { force: true });
      // força o navegador a concluir a remoção da transformação antes que o
      // Leaflet receba um clique de desenho/edição.
      void state.wrapper.offsetWidth;
      requestAnimationFrame(() => {
        if (!state.wrapper) return;
        if (previousInlineTransition) state.wrapper.style.setProperty('transition', previousInlineTransition, previousInlinePriority || '');
        else state.wrapper.style.removeProperty('transition');
      });
    } else {
      applyBearing(0, { force: true });
    }
    state.shield?.classList.remove('is-panning');
    if (state.shield) state.shield.style.pointerEvents = 'none';
    body.classList.remove('surveyor-compass-dragging');
    const activeMap = resolveMapInstance();
    activeMap?.invalidateSize?.({ animate: false, pan: false });
    requestAnimationFrame(() => activeMap?.invalidateSize?.({ animate: false, pan: false }));
  }

  function buildRotationWrapper(map) {
    const pane = map.getPane?.('mapPane');
    const parent = pane?.parentElement;
    if (!pane || !parent || parent.querySelector(':scope > .surveyor-map-rotation-wrapper')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'surveyor-map-rotation-wrapper';
    parent.insertBefore(wrapper, pane);
    wrapper.appendChild(pane);
    state.wrapper = wrapper;

    const shield = document.createElement('div');
    shield.className = 'surveyor-rotated-view-shield';
    shield.setAttribute('aria-label', 'Navegação com mapa rotacionado');
    $('map')?.appendChild(shield);
    state.shield = shield;

    let drag = null;
    const endDrag = (event) => {
      if (!drag) return;
      try { shield.releasePointerCapture?.(drag.pointerId); } catch {}
      drag = null;
      shield.classList.remove('is-panning');
      event?.preventDefault?.();
    };
    shield.addEventListener('pointerdown', (event) => {
      if (!state.bearing || event.button > 0) return;
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      shield.setPointerCapture?.(event.pointerId);
      shield.classList.add('is-panning');
      event.preventDefault();
    });
    shield.addEventListener('pointermove', (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY;
      const rad = state.bearing * Math.PI / 180;
      const ux = dx * Math.cos(rad) - dy * Math.sin(rad);
      const uy = dx * Math.sin(rad) + dy * Math.cos(rad);
      map.panBy([-ux, -uy], { animate: false, noMoveStart: true });
      event.preventDefault();
    });
    shield.addEventListener('pointerup', endDrag);
    shield.addEventListener('pointercancel', endDrag);
    shield.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); });
    shield.addEventListener('dblclick', (event) => { map.zoomIn(); event.preventDefault(); event.stopPropagation(); });
    shield.addEventListener('wheel', (event) => {
      if (!state.bearing) return;
      if (event.deltaY < 0) map.zoomIn(); else map.zoomOut();
      event.preventDefault(); event.stopPropagation();
    }, { passive: false });
  }

  function panMapBy(dx, dy) {
    const map = resolveMapInstance();
    if (!map?.panBy) return;
    map.panBy([dx, dy], { animate: true, duration: 0.25, easeLinearity: 0.25 });
  }

  function restoreInitialView() {
    const map = resolveMapInstance();
    if (!map) return;
    resetBearing();
    if (state.initialView?.center && Number.isFinite(state.initialView?.zoom)) {
      map.setView(state.initialView.center, state.initialView.zoom, { animate: true });
      return;
    }
    map.setView(map.getCenter(), map.getZoom(), { animate: true });
  }

  function focusDrawnContent() {
    const map = resolveMapInstance();
    if (!map?.fitBounds) return false;
    const runtime = window.SurveyorMapRuntime || {};
    let target = null;
    try {
      const selected = runtime.getSelectedLayer?.();
      if (selected?.getBounds?.()?.isValid?.()) target = selected;
      else if (selected?.getLatLng) target = selected;
    } catch {}
    if (!target) {
      try {
        const layers = runtime.drawn?.getLayers?.() || [];
        target = [...layers].reverse().find((layer) => {
          const type = layer?.toGeoJSON?.()?.geometry?.type || '';
          return /Polygon/i.test(type) && layer?.getBounds?.()?.isValid?.();
        }) || null;
      } catch {}
    }
    if (!target) return false;
    resetBearing();
    try {
      if (target.getBounds?.()?.isValid?.()) {
        map.fitBounds(target.getBounds().pad(0.16), { animate: true, maxZoom: 19 });
        return true;
      }
      if (target.getLatLng) {
        map.setView(target.getLatLng(), Math.max(map.getZoom?.() || 16, 18), { animate: true });
        return true;
      }
    } catch {}
    return false;
  }

  function triggerMyLocation() {
    const pageButton = $('myLocationBtn');
    if (pageButton) {
      pageButton.click();
      return;
    }
    const map = resolveMapInstance();
    if (!map?.locate) return;
    map.locate({ setView: true, maxZoom: Math.max(map.getZoom?.() || 16, 17), enableHighAccuracy: true });
  }

  function triggerQuickToolsDrawer() {
    const toggle = $('mapQuickToolsToggle');
    if (toggle) toggle.click();
  }

  function buildOrientationControl(map) {
    if (!window.L?.Control) return;
    const Orientation = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const root = L.DomUtil.create('div', 'surveyor-orientation-control');
        root.innerHTML = `<div class="orientation-stack orientation-stack-compact">
          <div class="orientation-nav-pad" role="group" aria-label="Navegação do mapa">
            <button type="button" class="orientation-nav-button is-up" data-action="north" title="Voltar suavemente para o Norte" aria-label="Voltar suavemente para o Norte"><svg viewBox="0 0 24 24"><path d="m7 14 5-5 5 5"/></svg></button>
            <button type="button" class="orientation-nav-button is-left" data-action="rotate-left" title="Girar mapa para a esquerda" aria-label="Girar mapa para a esquerda"><svg viewBox="0 0 24 24"><path d="m14 7-5 5 5 5"/></svg></button>
            <button type="button" class="orientation-compass-core" data-action="compass" title="Arraste para girar; clique para voltar ao Norte" aria-label="Girar mapa ou voltar ao Norte"><span class="compass" role="slider" aria-label="Orientação atual" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0"><span class="compass-needle" aria-hidden="true"></span><span class="compass-north-label">N</span></span></button>
            <button type="button" class="orientation-nav-button is-right" data-action="rotate-right" title="Girar mapa para a direita" aria-label="Girar mapa para a direita"><svg viewBox="0 0 24 24"><path d="m10 7 5 5-5 5"/></svg></button>
            <button type="button" class="orientation-nav-button is-down" data-action="south" title="Girar suavemente para 180°" aria-label="Girar suavemente para 180 graus"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></button>
          </div>
          <button type="button" class="orientation-stack-button" data-action="home" title="Voltar para a visão inicial" aria-label="Voltar para a visão inicial"><svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5"/><path d="M7 10.5V19h10v-8.5"/></svg></button>
          <button type="button" class="orientation-stack-button" data-action="locate" title="Minha localização" aria-label="Minha localização"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg></button>
          <button type="button" class="orientation-stack-button" data-action="zoom-in" title="Aumentar zoom" aria-label="Aumentar zoom"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
          <button type="button" class="orientation-stack-button" data-action="zoom-out" title="Diminuir zoom" aria-label="Diminuir zoom"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
        </div>`;
        L.DomEvent.disableClickPropagation(root);
        L.DomEvent.disableScrollPropagation(root);

        root.querySelector('[data-action="north"]')?.addEventListener('click', () => applyBearing(0, { force: true }));
        root.querySelector('[data-action="rotate-left"]')?.addEventListener('click', () => applyBearing(state.bearing - 5));
        root.querySelector('[data-action="rotate-right"]')?.addEventListener('click', () => applyBearing(state.bearing + 5));
        root.querySelector('[data-action="south"]')?.addEventListener('click', () => applyBearing(180));
        root.querySelector('[data-action="home"]')?.addEventListener('click', focusDrawnContent);
        root.querySelector('[data-action="focus"]')?.addEventListener('click', focusDrawnContent);
        root.querySelector('[data-action="locate"]')?.addEventListener('click', triggerMyLocation);
        root.querySelector('[data-action="zoom-in"]')?.addEventListener('click', () => map.zoomIn());
        root.querySelector('[data-action="zoom-out"]')?.addEventListener('click', () => map.zoomOut());

        const compass = root.querySelector('.compass');
        const compassCore = root.querySelector('.orientation-compass-core');
        if (compass && compassCore) {
          let draggingCompass = false;
          let dragPointerId = null;
          let dragStartBearing = 0;
          let dragStartAngle = null;
          let dragStartPoint = null;
          let dragDistance = 0;
          let bearingFrame = 0;
          let pendingBearing = null;

          compass.setAttribute('tabindex', '0');
          compass.title = 'Arraste em volta do N para girar o mapa';
          compassCore.title = 'Arraste em volta do N para girar; clique para voltar ao Norte';

          const pointerAngle = (event) => {
            const rect = compassCore.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = event.clientX - cx;
            const dy = event.clientY - cy;
            if (Math.hypot(dx, dy) < 3) return null;
            return normalizeBearing(Math.atan2(dx, -dy) * 180 / Math.PI);
          };

          const shortestAngleDelta = (current, start) => {
            let delta = normalizeBearing(current) - normalizeBearing(start);
            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;
            return delta;
          };

          const queueBearing = (value) => {
            pendingBearing = value;
            if (bearingFrame) return;
            bearingFrame = requestAnimationFrame(() => {
              bearingFrame = 0;
              if (pendingBearing == null) return;
              const next = pendingBearing;
              pendingBearing = null;
              applyBearing(next);
            });
          };

          const endCompassDrag = (event) => {
            if (!draggingCompass) return;
            draggingCompass = false;
            dragPointerId = null;
            dragStartAngle = null;
            dragStartPoint = null;
            if (bearingFrame) {
              cancelAnimationFrame(bearingFrame);
              bearingFrame = 0;
            }
            if (pendingBearing != null) {
              applyBearing(pendingBearing);
              pendingBearing = null;
            }
            compassCore.classList.remove('is-dragging');
            body.classList.remove('surveyor-compass-dragging');
            try { compassCore.releasePointerCapture?.(event.pointerId); } catch {}
            event.preventDefault();
            event.stopPropagation();
          };

          compassCore.addEventListener('pointerdown', (event) => {
            if (event.button > 0) return;
            const angle = pointerAngle(event);
            draggingCompass = true;
            dragPointerId = event.pointerId;
            dragStartBearing = state.bearing;
            dragStartAngle = angle;
            dragStartPoint = { x: event.clientX, y: event.clientY };
            dragDistance = 0;
            compassCore.classList.add('is-dragging');
            body.classList.add('surveyor-compass-dragging');
            compassCore.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            event.stopPropagation();
          });

          compassCore.addEventListener('pointermove', (event) => {
            if (!draggingCompass || (dragPointerId !== null && event.pointerId !== dragPointerId)) return;
            if (dragStartPoint) {
              dragDistance = Math.max(dragDistance, Math.hypot(event.clientX - dragStartPoint.x, event.clientY - dragStartPoint.y));
            }
            const angle = pointerAngle(event);
            if (angle != null && dragStartAngle != null) {
              // Giro circular real. O fator 0,58 deixa a resposta leve, sem acompanhar o mouse de forma brusca.
              const angularDelta = shortestAngleDelta(angle, dragStartAngle);
              queueBearing(dragStartBearing + (angularDelta * 0.58));
            }
            event.preventDefault();
            event.stopPropagation();
          });

          compassCore.addEventListener('pointerup', endCompassDrag);
          compassCore.addEventListener('pointercancel', endCompassDrag);

          compassCore.addEventListener('click', (event) => {
            // Só considera clique quando realmente não houve arraste.
            if (dragDistance <= 4) resetBearing();
            dragDistance = 0;
            event.preventDefault();
            event.stopPropagation();
          });

          compassCore.addEventListener('dblclick', (event) => {
            resetBearing();
            event.preventDefault();
            event.stopPropagation();
          });

          compass.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') { applyBearing(state.bearing - 5); event.preventDefault(); }
            if (event.key === 'ArrowRight') { applyBearing(state.bearing + 5); event.preventDefault(); }
            if (event.key === 'Enter' || event.key === ' ') { resetBearing(); event.preventDefault(); }
          });
        }
        state.control = root;
        updateBearingUi();
        return root;
      }
    });
    new Orientation().addTo(map);
  }

  async function orientFromDevice() {
    if (!('DeviceOrientationEvent' in window)) {
      toast('Este aparelho/navegador não oferece bússola de orientação.', 'error');
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('Permissão de orientação negada.');
      }
    } catch (error) {
      toast(error.message || 'Não foi possível acessar a orientação do aparelho.', 'error');
      return;
    }
    if (state.orientationHandler) {
      window.removeEventListener('deviceorientationabsolute', state.orientationHandler);
      window.removeEventListener('deviceorientation', state.orientationHandler);
    }
    let done = false;
    const finish = (heading) => {
      if (done || !Number.isFinite(heading)) return;
      done = true;
      applyBearing(heading);
      window.removeEventListener('deviceorientationabsolute', handler);
      window.removeEventListener('deviceorientation', handler);
      state.orientationHandler = null;
      toast(`Mapa orientado em ${Math.round(normalizeBearing(heading))}°.`, 'success');
    };
    const handler = (event) => {
      const webkit = Number(event.webkitCompassHeading);
      if (Number.isFinite(webkit)) return finish(webkit);
      const alpha = Number(event.alpha);
      if (Number.isFinite(alpha)) finish(360 - alpha);
    };
    state.orientationHandler = handler;
    window.addEventListener('deviceorientationabsolute', handler, { passive: true });
    window.addEventListener('deviceorientation', handler, { passive: true });
    setTimeout(() => {
      if (done) return;
      window.removeEventListener('deviceorientationabsolute', handler);
      window.removeEventListener('deviceorientation', handler);
      state.orientationHandler = null;
      toast('A bússola não retornou uma orientação válida.', 'error');
    }, 5000);
  }


  function bindBaseMapMenu() {
    const select = $('baseMapSelect');
    const menu = document.querySelector('.top-basemap-menu');
    if (!select || !menu) return;
    const buttons = [...menu.querySelectorAll('[data-basemap]')];
    const sync = () => {
      const value = select.value;
      buttons.forEach((button) => {
        const active = button.dataset.basemap === value;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
      const value = button.dataset.basemap;
      if (!value || select.value === value) {
        menu.open = false;
        sync();
        return;
      }
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      menu.open = false;
      sync();
    }));
    select.addEventListener('change', sync);
    document.addEventListener('pointerdown', (event) => {
      if (menu.open && !event.target.closest?.('.top-basemap-menu')) menu.open = false;
    });
    sync();
  }

  function installScale(map) {
    document.querySelector('.leaflet-control-scale')?.remove();
    L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 160, updateWhenIdle: false }).addTo(map);
  }

  function resetBearingBeforeEditing() {
    if (!state.bearing && !body.classList.contains('surveyor-map-view-rotated')) return;
    resetBearing({ immediate: true });
    toast('Visualização voltou ao Norte/2D para editar a geometria com precisão.', 'success');
  }

  function bindSafeEditingReset() {
    const selectors = '#topQuickPolygonBtn,#topQuickMarkPointBtn,#topEditElementsBtn,#toolsMenuBtn,#cadToolsMenuBtn,#sigToolsMenuBtn,#terrainToolsMenuBtn,#selectToolBtn,#identifyToolBtn,#measureToolBtn,#coordinatesToolBtn,#markGpsPointBtn,[data-draw-tool],.sv-map-modern-drawer button,.map-quick-tools-grid button';
    const maybeReset = (event) => {
      if (event.target.closest?.(selectors)) resetBearingBeforeEditing();
    };
    document.addEventListener('pointerdown', maybeReset, true);
    document.addEventListener('click', maybeReset, true);

    // Alguns fluxos ativam o modo de desenho pelo JS sem passar por um botão
    // conhecido. A classe do próprio mapa é a fonte final de verdade: se uma
    // edição começar, a rotação sai imediatamente e o escudo deixa de capturar cliques.
    const editingObserver = new MutationObserver(() => {
      if (!state.bearing && !body.classList.contains('surveyor-map-view-rotated')) return;
      if (body.classList.contains('drawing-active')
        || body.classList.contains('surveyor-direct-editing')
        || body.classList.contains('surveyor-gps-pick-mode')) {
        resetBearing({ immediate: true });
      }
    });
    editingObserver.observe(body, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('surveyor:map-reset-bearing', (event) => resetBearing({ immediate: event?.detail?.immediate === true }));
    window.SurveyorMapOrientation = {
      getBearing: () => normalizeBearing(state.bearing),
      reset: () => resetBearing(),
      resetForEditing: () => resetBearing({ immediate: true })
    };
  }

  function numeric(value) {
    const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
    const result = Number(normalized);
    return Number.isFinite(result) ? result : NaN;
  }

  function ensureProjDefs() {
    if (!window.proj4?.defs) return;
    try { if (!proj4.defs('EPSG:4674')) proj4.defs('EPSG:4674', '+proj=longlat +ellps=GRS80 +no_defs +type=crs'); } catch {}
    try { if (!proj4.defs('EPSG:31984')) proj4.defs('EPSG:31984', '+proj=utm +zone=24 +south +ellps=GRS80 +units=m +no_defs +type=crs'); } catch {}
  }

  function gpsFieldsToLatLng() {
    const crs = $('gpsPointCrs')?.value || 'EPSG:4326';
    const first = numeric($('gpsPointFirst')?.value);
    const second = numeric($('gpsPointSecond')?.value);
    if (!Number.isFinite(first) || !Number.isFinite(second)) throw new Error('Informe as duas coordenadas do ponto.');
    let lat = first, lng = second;
    if (crs === 'EPSG:31984' || crs === 'EPSG:4674') {
      ensureProjDefs();
      if (!window.proj4) throw new Error('Conversor de coordenadas ainda não carregou. Recarregue a página.');
      const sourcePair = crs === 'EPSG:31984' ? [first, second] : [second, first];
      const out = proj4(crs, 'EPSG:4326', sourcePair);
      lng = Number(out?.[0]); lat = Number(out?.[1]);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Coordenadas fora do intervalo válido. Confira o sistema de coordenadas selecionado.');
    }
    return { lat, lng, crs, originalCoordinates: [first, second] };
  }

  function syncGpsLabels() {
    const utm = $('gpsPointCrs')?.value === 'EPSG:31984';
    if ($('gpsPointFirstLabel')) $('gpsPointFirstLabel').textContent = utm ? 'Easting (E)' : 'Latitude';
    if ($('gpsPointSecondLabel')) $('gpsPointSecondLabel').textContent = utm ? 'Northing (N)' : 'Longitude';
    if ($('gpsPointFirst')) $('gpsPointFirst').placeholder = utm ? '500000.000' : '-13.0312240';
    if ($('gpsPointSecond')) $('gpsPointSecond').placeholder = utm ? '8559000.000' : '-39.6059600';
  }

  function setGpsLatLngFields(lat, lng) {
    if ($('gpsPointCrs')) $('gpsPointCrs').value = 'EPSG:4326';
    syncGpsLabels();
    if ($('gpsPointFirst')) $('gpsPointFirst').value = Number(lat).toFixed(7);
    if ($('gpsPointSecond')) $('gpsPointSecond').value = Number(lng).toFixed(7);
  }

  function showAccuracy(accuracy) {
    const node = $('gpsPointAccuracy');
    if (!node) return;
    if (!Number.isFinite(Number(accuracy))) { node.classList.add('hidden'); node.textContent = ''; delete node.dataset.accuracy; return; }
    node.textContent = `Precisão informada pelo dispositivo: aproximadamente ${Math.round(Number(accuracy))} m.`;
    node.classList.remove('hidden');
    node.dataset.accuracy = String(Number(accuracy));
  }

  function gpsPanel() { return $('gpsPointDialog'); }

  function gpsPanelVisible() {
    const panel = gpsPanel();
    return Boolean(panel && !panel.classList.contains('hidden'));
  }

  function clampGpsPanelToViewport() {
    const panel = gpsPanel();
    if (!panel || !gpsPanelVisible()) return;
    const rect = panel.getBoundingClientRect();
    const gap = 8;
    const maxLeft = Math.max(gap, window.innerWidth - rect.width - gap);
    const maxTop = Math.max(gap, window.innerHeight - rect.height - gap);
    const left = Math.min(maxLeft, Math.max(gap, rect.left));
    const top = Math.min(maxTop, Math.max(gap, rect.top));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function positionGpsPanelDefault() {
    const panel = gpsPanel();
    if (!panel || panel.dataset.userPositioned === '1') return;
    const mapRect = $('map')?.getBoundingClientRect();
    const sideRect = $('geoSidePanel')?.getBoundingClientRect();
    const leftEdge = Math.max(68, Number(mapRect?.left || 0) + 12, Number(sideRect?.right || 0) + 12);
    const topEdge = Math.max(86, Number(mapRect?.top || 0) + 72);
    panel.style.left = `${Math.min(leftEdge, Math.max(8, window.innerWidth - Math.min(360, window.innerWidth - 16) - 8))}px`;
    panel.style.top = `${Math.min(topEdge, Math.max(8, window.innerHeight - 300))}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    requestAnimationFrame(clampGpsPanelToViewport);
  }

  function setGpsPanelVisible(visible) {
    const panel = gpsPanel();
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    body.classList.toggle('surveyor-gps-panel-open', visible);
    if (visible) positionGpsPanelDefault();
  }

  function clearGpsPreview(map = state.map) {
    if (!state.gpsPreview || !map) return;
    try { map.removeLayer(state.gpsPreview); } catch {}
    state.gpsPreview = null;
  }

  function showGpsPreview(map, lat, lng) {
    clearGpsPreview(map);
    if (!map || !window.L || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
    const runtime = window.SurveyorMapRuntime;
    const icon = runtime?.gpsMarkerIcon?.({ draft: true }) || L.divIcon({
      className: 'surveyor-gps-pin-icon is-draft', iconSize: [30, 38], iconAnchor: [15, 36],
      html: '<span class="surveyor-gps-pin-shape"><svg viewBox="0 0 30 38"><path d="M15 1.5C7.82 1.5 2 7.32 2 14.5c0 9.25 13 21.5 13 21.5s13-12.25 13-21.5C28 7.32 22.18 1.5 15 1.5Z"/><circle cx="15" cy="14.5" r="5.2"/></svg></span>'
    });
    state.gpsPreview = L.marker([lat, lng], { pane: 'markerPane', interactive: false, keyboard: false, zIndexOffset: 2100, icon }).addTo(map);
  }

  function setGpsModeText(active) {
    const btn = $('gpsPickMapBtn');
    if (!btn) return;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    const label = btn.querySelector('span');
    if (label) label.textContent = active ? 'Mapa ativo' : 'Clicar no mapa';
    btn.title = active ? 'Clique livremente no mapa para posicionar o alfinete' : 'Ativar escolha pelo mapa';
  }

  function activateGpsMapPick(map, active = true) {
    if (!map) return;
    const container = map.getContainer?.();
    if (state.gpsMapClickHandler) map.off('click', state.gpsMapClickHandler);
    if (state.gpsMapContainerHandler && container) container.removeEventListener('click', state.gpsMapContainerHandler, true);
    state.gpsMapClickHandler = null;
    state.gpsMapContainerHandler = null;
    state.gpsPickActive = Boolean(active);
    body.classList.toggle('surveyor-gps-pick-mode', state.gpsPickActive);
    setGpsModeText(state.gpsPickActive);
    if (!state.gpsPickActive || !container) return;

    const applyMapPoint = (lat, lng) => {
      if (!gpsPanelVisible() || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      state.gpsLastSource = 'map-click';
      setGpsLatLngFields(lat, lng);
      showAccuracy(null);
      showGpsPreview(map, lat, lng);
      const status = $('gpsPointLiveStatus');
      if (status) status.textContent = `Alfinete posicionado em ${lat.toFixed(7)}, ${lng.toFixed(7)}. Clique em outro local para mover.`;
    };

    // Captura no próprio container para funcionar inclusive sobre polígonos/camadas interativas.
    state.gpsMapContainerHandler = (event) => {
      if (!gpsPanelVisible() || !state.gpsPickActive) return;
      if (event.target.closest?.('.leaflet-control, .leaflet-popup, .surveyor-orientation-control')) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
      try { map.closePopup?.(); } catch {}
      const point = map.mouseEventToLatLng?.(event);
      if (!point) return;
      applyMapPoint(Number(point.lat), Number(point.lng));
    };
    container.addEventListener('click', state.gpsMapContainerHandler, true);
  }

  function closeGpsPanel(options = {}) {
    activateGpsMapPick(state.map, false);
    clearGpsPreview(state.map);
    setGpsPanelVisible(false);
    if (options.keepEditing !== true) state.gpsEditingLayer = null;
  }

  function fillGpsPanelFromLayer(layer, props = null, latlng = null) {
    if (!layer) return;
    const ll = latlng || layer.getLatLng?.();
    if (!ll) return;
    const p = props || layer.feature?.properties || {};
    state.gpsEditingLayer = layer;
    state.gpsLastSource = 'map-click';
    if ($('gpsPointName')) $('gpsPointName').value = String(p.name || 'Ponto GPS');
    setGpsLatLngFields(ll.lat, ll.lng);
    showAccuracy(Number.isFinite(Number(p.gpsAccuracyMeters)) ? Number(p.gpsAccuracyMeters) : null);
    const title = $('gpsPointTitle');
    if (title) title.textContent = 'Editar ponto marcado';
    const save = $('gpsCreatePointBtn');
    if (save) save.textContent = 'Salvar alterações';
    const status = $('gpsPointLiveStatus');
    if (status) status.textContent = 'Clique em outro local do mapa para reposicionar este ponto, ou arraste o próprio alfinete.';
  }

  function prepareNewGpsPoint(map) {
    state.gpsEditingLayer = null;
    state.gpsLastSource = 'map-click';
    if ($('gpsPointName')) $('gpsPointName').value = '';
    if ($('gpsPointCrs')) $('gpsPointCrs').value = 'EPSG:4326';
    syncGpsLabels();
    if ($('gpsPointFirst')) $('gpsPointFirst').value = '';
    if ($('gpsPointSecond')) $('gpsPointSecond').value = '';
    showAccuracy(null);
    clearGpsPreview(map);
    const title = $('gpsPointTitle');
    if (title) title.textContent = 'Marcar ponto';
    const save = $('gpsCreatePointBtn');
    if (save) save.textContent = 'Salvar ponto';
    const status = $('gpsPointLiveStatus');
    if (status) status.textContent = 'Clique diretamente no mapa: o alfinete e as coordenadas serão atualizados automaticamente.';
  }

  function openGpsPanel(options = {}) {
    resetBearingBeforeEditing();
    const map = resolveMapInstance();
    if (map) state.map = map;
    if (options.layer) fillGpsPanelFromLayer(options.layer, options.props, options.latlng);
    else prepareNewGpsPoint(map);

    // O painel deve responder imediatamente ao clique, mesmo se o Leaflet ainda
    // estiver terminando a inicialização. Isso evita o botão "Marcar ponto" morto.
    setGpsPanelVisible(true);

    if (map) {
      activateGpsMapPick(map, true);
    } else {
      const status = $('gpsPointLiveStatus');
      if (status) status.textContent = 'Carregando o mapa… o painel já está pronto para uso.';
      let attempts = 0;
      const attachWhenReady = () => {
        if (!gpsPanelVisible()) return;
        const readyMap = resolveMapInstance();
        if (readyMap) {
          state.map = readyMap;
          activateGpsMapPick(readyMap, true);
          if (status) status.textContent = 'Clique diretamente no mapa para posicionar o alfinete.';
          return;
        }
        if ((attempts += 1) < 200) setTimeout(attachWhenReady, 50);
        else if (status) status.textContent = 'O mapa não terminou de carregar. Recarregue a página e tente novamente.';
      };
      setTimeout(attachWhenReady, 0);
    }
  }

  function saveGpsPoint(source = null) {
    try {
      const coords = gpsFieldsToLatLng();
      const runtime = window.SurveyorMapRuntime;
      if (!runtime?.addGpsPoint) throw new Error('Ferramenta de pontos ainda não terminou de carregar.');
      const accuracy = numeric($('gpsPointAccuracy')?.dataset?.accuracy);
      const payload = {
        ...coords,
        name: $('gpsPointName')?.value?.trim() || 'Ponto GPS',
        source: source || state.gpsLastSource || 'manual',
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        capturedAt: new Date().toISOString()
      };
      let layer;
      if (state.gpsEditingLayer && runtime.updateGpsPoint) layer = runtime.updateGpsPoint(state.gpsEditingLayer, payload);
      else layer = runtime.addGpsPoint(payload);
      state.gpsEditingLayer = layer || state.gpsEditingLayer;
      clearGpsPreview(state.map);
      if (state.gpsEditingLayer) fillGpsPanelFromLayer(state.gpsEditingLayer);
      toast(state.gpsEditingLayer ? 'Ponto salvo no projeto.' : 'Ponto marcado e incluído no projeto.', 'success');
    } catch (error) { toast(error.message || 'Não foi possível marcar o ponto.', 'error'); }
  }

  function addTemporaryAccuracyCircle(map, lat, lng, accuracy) {
    if (!Number.isFinite(Number(accuracy)) || Number(accuracy) <= 0) return;
    const circle = L.circle([lat, lng], { radius: Number(accuracy), color: '#d89b00', weight: 1, fillColor: '#facc15', fillOpacity: .08, interactive: false }).addTo(map);
    setTimeout(() => { try { map.removeLayer(circle); } catch {} }, 6000);
  }

  function bindGpsPanelDrag() {
    const panel = gpsPanel();
    const handle = panel?.querySelector?.('[data-gps-drag-handle]');
    if (!panel || !handle || handle.dataset.dragBound === '1') return;
    handle.dataset.dragBound = '1';
    handle.addEventListener('pointerdown', (event) => {
      if (event.button > 0 || event.target.closest('button,input,select,textarea')) return;
      const rect = panel.getBoundingClientRect();
      state.gpsPanelDrag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      handle.setPointerCapture?.(event.pointerId);
      panel.classList.add('is-dragging');
      panel.dataset.userPositioned = '1';
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      const drag = state.gpsPanelDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = panel.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - drag.offsetX));
      const top = Math.max(8, Math.min(window.innerHeight - rect.height - 8, event.clientY - drag.offsetY));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      event.preventDefault();
    });
    const end = (event) => {
      const drag = state.gpsPanelDrag;
      if (!drag || (event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
      try { handle.releasePointerCapture?.(drag.pointerId); } catch {}
      state.gpsPanelDrag = null;
      panel.classList.remove('is-dragging');
      clampGpsPanelToViewport();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function bindGpsPointTool(map) {
    bindGpsPanelDrag();
    gpsPanel()?.querySelector('form')?.addEventListener('submit', (event) => event.preventDefault());
    ensureGpsLauncherBound();
    $('gpsPointCloseBtn')?.addEventListener('click', () => closeGpsPanel());
    $('gpsPointCrs')?.addEventListener('change', () => { syncGpsLabels(); showAccuracy(null); state.gpsLastSource = 'manual'; });
    $('gpsCreatePointBtn')?.addEventListener('click', () => saveGpsPoint());
    $('gpsUseDeviceBtn')?.addEventListener('click', () => {
      if (!navigator.geolocation) return toast('Geolocalização não disponível neste navegador.', 'error');
      const btn = $('gpsUseDeviceBtn');
      btn.disabled = true;
      toast('Obtendo posição GPS do aparelho...');
      navigator.geolocation.getCurrentPosition((position) => {
        btn.disabled = false;
        const { latitude, longitude, accuracy } = position.coords;
        state.gpsLastSource = 'device-gps';
        setGpsLatLngFields(latitude, longitude);
        showAccuracy(accuracy);
        showGpsPreview(map, latitude, longitude);
        map.setView([latitude, longitude], Math.max(map.getZoom(), 18), { animate: true });
        addTemporaryAccuracyCircle(map, latitude, longitude, accuracy);
        const status = $('gpsPointLiveStatus');
        if (status) status.textContent = 'Posição do aparelho carregada. Você ainda pode clicar no mapa para ajustar.';
        toast('Posição do aparelho obtida.', 'success');
      }, (error) => {
        btn.disabled = false;
        const messages = { 1: 'Permissão de localização negada.', 2: 'O aparelho não conseguiu determinar a posição.', 3: 'A localização demorou demais para responder.' };
        toast(messages[error.code] || 'Não foi possível obter o GPS do aparelho.', 'error');
      }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
    });
    $('gpsPickMapBtn')?.addEventListener('click', () => {
      activateGpsMapPick(map, !state.gpsPickActive);
      if (state.gpsPickActive) toast('Clique livremente no mapa para posicionar o alfinete.');
    });
    const manualPreview = () => {
      if (!gpsPanelVisible()) return;
      try {
        const coords = gpsFieldsToLatLng();
        state.gpsLastSource = 'manual';
        showGpsPreview(map, coords.lat, coords.lng);
      } catch {}
    };
    $('gpsPointFirst')?.addEventListener('change', manualPreview);
    $('gpsPointSecond')?.addEventListener('change', manualPreview);
    window.addEventListener('surveyor:gps-point-selected', (event) => {
      const detail = event.detail || {};
      if (!detail.layer || detail.reason !== 'click') return;
      openGpsPanel(detail);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && gpsPanelVisible()) closeGpsPanel();
    });
  }

  function drawToolIcon(tool) {
    const paths = {
      polygon: '<path d="M5 5l12 2 2 10-10 2-5-8Z"/><circle cx="5" cy="5" r="1.4"/><circle cx="17" cy="7" r="1.4"/><circle cx="19" cy="17" r="1.4"/><circle cx="9" cy="19" r="1.4"/>',
      polyline: '<path d="M4 18 9 7l6 7 5-9"/><circle cx="4" cy="18" r="1.4"/><circle cx="9" cy="7" r="1.4"/><circle cx="15" cy="14" r="1.4"/><circle cx="20" cy="5" r="1.4"/>',
      rectangle: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
      circle: '<circle cx="12" cy="12" r="8"/>',
      arc: '<path d="M5 16c2-7 12-9 15-2"/><path d="M5 16h4M20 14l-3-2"/>',
      marker: '<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
      glebas: '<path d="M4 5h16v14H4Z"/><path d="M12 5v14M4 12h8"/>',
      cancel: '<path d="M6 6l12 12M18 6 6 18"/>',
      edit: '<path d="M4 19l5-1 9-9-4-4-9 9Z"/><path d="M13 6l4 4"/>',
      'geom-insert-vertex': '<path d="M4 17 10 7l10 10"/><circle cx="10" cy="7" r="1.5"/><path d="M17 5v6M14 8h6"/>',
      'geom-remove-vertex': '<path d="M4 17 10 7l10 10"/><circle cx="10" cy="7" r="1.5"/><path d="M14 8h6"/>',
      'geom-offset': '<path d="M5 7h12l2 3H7Z"/><path d="M5 14h12l2 3H7Z"/>',
      'geom-rotate': '<path d="M18 8V4l-2 2a7 7 0 1 0 2 10"/><path d="M18 4h-4"/>',
      'geom-mirror': '<path d="M12 3v18"/><path d="m9 7-5 5 5 5M15 7l5 5-5 5"/>',
      'geom-scale': '<path d="M5 10V5h5M14 5h5v5M19 14v5h-5M10 19H5v-5"/><path d="m9 9-4-4M15 9l4-4M15 15l4 4M9 15l-4 4"/>',
      'geom-stretch-side': '<rect x="5" y="6" width="14" height="12"/><path d="M2 12h6M16 12h6M5 9 2 12l3 3M19 9l3 3-3 3"/>',
      'geom-convert': '<path d="M5 7h11l-2-2M16 7l-2 2M19 17H8l2 2M8 17l2-2"/>',
      'geom-split-line': '<path d="M3 12h7M14 12h7"/><path d="m10 7 4 10M14 7l-4 10"/>',
      'geom-merge-lines': '<path d="M4 7h6l4 5h6M4 17h6l4-5"/><circle cx="14" cy="12" r="1.4"/>',
      'geom-snap': '<path d="M6 5v7a6 6 0 0 0 12 0V5"/><path d="M6 5h4v4H6ZM14 5h4v4h-4Z"/>',
      'geom-fix': '<path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7Z"/><path d="m8 12 3 3 5-6"/>',
      delete: '<path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"/>',
      'spatial-union': '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
      'spatial-difference': '<circle cx="9" cy="12" r="6"/><path d="M13 7a6 6 0 0 1 0 10"/>',
      'spatial-intersection': '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 6a7 7 0 0 1 0 12"/>',
      'spatial-clip': '<rect x="5" y="5" width="10" height="10"/><path d="M10 10h9v9h-9Z"/>',
      'spatial-dissolve': '<path d="M4 8c2-3 5-3 7 0 2-3 5-3 9 0v8c-3 2-6 2-9 0-3 2-5 2-7 0Z"/><path d="M11 8v8" stroke-dasharray="2 2"/>',
      'spatial-simplify': '<path d="M4 17 7 8l4 6 4-8 5 11"/><path d="M4 19h16"/>',
      'spatial-topology': '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 7l3 9M16 7l-3 9M8 6h8"/>',
      'spatial-remove-small': '<path d="M4 5h16v14H4Z"/><circle cx="9" cy="12" r="2"/><path d="m15 10 4 4M19 10l-4 4"/>',
      'terrain-profile': '<path d="M3 18 8 9l4 5 3-7 6 11"/><path d="M3 21h18"/>',
      'terrain-cut-fill': '<path d="M3 15c4-5 6-5 9 0s5 5 9 0"/><path d="M3 10h18" stroke-dasharray="3 2"/>',
      'terrain-contours': '<path d="M4 7c3-3 13-3 16 0M3 12c4-3 14-3 18 0M5 17c4-2 10-2 14 0"/>',
      'terrain-spot-points': '<path d="M4 18 9 8l5 7 6-10"/><circle cx="9" cy="8" r="1.4"/><circle cx="14" cy="15" r="1.4"/><circle cx="20" cy="5" r="1.4"/>',
      'cad-dimension': '<path d="M4 7v10M20 7v10M4 12h16"/><path d="m7 9-3 3 3 3m10-6 3 3-3 3"/>',
      'cad-dimension-remove': '<path d="M4 7v10M17 7v10M4 12h13"/><path d="m8 9-3 3 3 3m6-3 6 6m0-6-6 6"/>',
      'sig-certified-neighbors': '<path d="M3 5h8v7H3Z"/><path d="M13 4h8v8h-8Z"/><path d="M7 14h9v7H7Z"/><path d="M11 8h2M10 14l2-2"/>',
      'terrain-elevation-click': '<path d="M3 19 9 8l4 6 3-5 5 10Z"/><circle cx="16" cy="9" r="1.5"/>'
    };
    const content = paths[tool] || '<circle cx="12" cy="12" r="7"/><path d="M8 12h8"/>';
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
  }

  function iconifyToolPopovers() {
    document.querySelectorAll('.draw-tools-popover button[data-draw-tool]').forEach((button) => {
      const label = String(button.getAttribute('aria-label') || button.textContent || '').trim() || 'Ferramenta';
      const tool = button.dataset.drawTool || '';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.classList.add('surveyor-popover-icon-tool');
      button.innerHTML = drawToolIcon(tool);
    });
  }



  function quickToolSvgFromSelector(selector, fallbackTool = '') {
    const source = document.querySelector(selector);
    const svg = source?.querySelector?.('svg');
    if (svg) return svg.outerHTML;
    return drawToolIcon(fallbackTool || 'polygon');
  }

  function quickToolDefinitions() {
    return [
      { label: 'Selecionar', selector: '#selectToolBtn', svg: quickToolSvgFromSelector('#selectToolBtn') },
      { label: 'Identificar', selector: '#identifyToolBtn', svg: quickToolSvgFromSelector('#identifyToolBtn') },
      { label: 'Desenhar polígono', selector: '[data-draw-tool="polygon"]', svg: drawToolIcon('polygon') },
      { label: 'Desenhar linha', selector: '[data-draw-tool="polyline"]', svg: drawToolIcon('polyline') },
      { label: 'Retângulo', selector: '[data-draw-tool="rectangle"]', svg: drawToolIcon('rectangle') },
      { label: 'Círculo', selector: '[data-draw-tool="circle"]', svg: drawToolIcon('circle') },
      { label: 'Arco', selector: '[data-draw-tool="arc"]', svg: drawToolIcon('arc') },
      { label: 'Ponto desenhado', selector: '[data-draw-tool="marker"]', svg: drawToolIcon('marker') },
      { label: 'Editar vértices', selector: '[data-draw-tool="edit"]', svg: drawToolIcon('edit') },
      { key: 'auto-points', label: 'Pontos automáticos', selector: '#editMidpointsToggleBtn', svg: quickToolSvgFromSelector('#editMidpointsToggleBtn'), cornerRow: 1 },
      { key: 'hide-vertex', label: 'Remover vértice', selector: '#vertexHideToolBtn', svg: quickToolSvgFromSelector('#vertexHideToolBtn'), cornerRow: 2 },
      { label: 'Excluir desenho', selector: '[data-draw-tool="delete"]', svg: drawToolIcon('delete') },
      { label: 'Atualizar mapa', selector: '#refreshMapBtn', svg: quickToolSvgFromSelector('#refreshMapBtn') },
      { label: 'Medir', selector: '#measureToolBtn', svg: quickToolSvgFromSelector('#measureToolBtn') },
      { label: 'Marcar ponto', selector: '#markGpsPointBtn', svg: quickToolSvgFromSelector('#markGpsPointBtn') },
      { label: 'Coordenadas', selector: '#coordinatesToolBtn', svg: quickToolSvgFromSelector('#coordinatesToolBtn') },
      { label: 'Cotas', selector: '#segmentMeasuresToggleBtn', svg: quickToolSvgFromSelector('#segmentMeasuresToggleBtn') },
      { label: 'Frente/Fundo', selector: '#glebaFrontBackToggleBtn', svg: quickToolSvgFromSelector('#glebaFrontBackToggleBtn') },
      { label: 'Terreno', selector: '#terrainToolsMenuBtn', svg: quickToolSvgFromSelector('#terrainToolsMenuBtn') },
      { label: 'Perfil do terreno', selector: '[data-draw-tool="terrain-profile"]', svg: drawToolIcon('terrain-profile') },
      { label: 'Corte/Aterro', selector: '[data-draw-tool="terrain-cut-fill"]', svg: drawToolIcon('terrain-cut-fill') },
      { label: 'Curvas de nível', selector: '[data-draw-tool="terrain-contours"]', svg: drawToolIcon('terrain-contours') },
      { label: 'Pontos cotados', selector: '[data-draw-tool="terrain-spot-points"]', svg: drawToolIcon('terrain-spot-points') },
      { label: 'Earth 3D', selector: '#earthExploreBtn', svg: quickToolSvgFromSelector('#earthExploreBtn') },
      { label: 'Cancelar ferramenta', selector: '#cancelToolBtn', svg: quickToolSvgFromSelector('#cancelToolBtn') }
    ];
  }

  function setQuickToolsDrawerOpen(open) {
    const toggle = $('mapQuickToolsToggle');
    const drawer = $('mapQuickToolsDrawer');
    if (!toggle || !drawer) return;
    const active = Boolean(open);
    drawer.classList.toggle('hidden', !active);
    drawer.setAttribute('aria-hidden', active ? 'false' : 'true');
    toggle.setAttribute('aria-expanded', active ? 'true' : 'false');
    toggle.classList.toggle('active', active);
    document.body.classList.toggle('map-quick-tools-open', active);
  }

  function bindQuickTools() {
    const polygonBtn = $('topQuickPolygonBtn');
    const pointBtn = $('topQuickMarkPointBtn');
    const toggleBtn = $('mapQuickToolsToggle');
    const grid = $('mapQuickToolsGrid');
    const drawer = $('mapQuickToolsDrawer');
    if (grid && !grid.dataset.quickToolsBuilt) {
      grid.dataset.quickToolsBuilt = '1';
      quickToolDefinitions().forEach((item) => {
        if (!document.querySelector(item.selector)) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `map-quick-grid-tool${item.cornerRow ? ' map-quick-grid-tool-corner' : ''}`;
        if (item.key) button.dataset.quickTool = item.key;
        if (item.cornerRow) button.dataset.cornerRow = String(item.cornerRow);
        button.setAttribute('title', item.label);
        button.setAttribute('aria-label', item.label);
        button.innerHTML = item.svg;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          if (item.selector === '#markGpsPointBtn') {
            openGpsPanel();
            return;
          }
          const target = document.querySelector(item.selector);
          if (!target) return;
          target.click();
          setQuickToolsDrawerOpen(false);
        });
        grid.appendChild(button);
      });
    }
    polygonBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      document.querySelector('[data-draw-tool="polygon"]')?.click();
    });
    // O botão rápido é um lançador GPS real, não um proxy do botão lateral.
    // O vínculo principal já é instalado no boot por ensureGpsLauncherBound().
    if (pointBtn) ensureGpsLauncherBound();
    toggleBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      setQuickToolsDrawerOpen(toggleBtn.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('pointerdown', (event) => {
      if (!drawer || drawer.classList.contains('hidden')) return;
      if (event.target.closest?.('.map-quick-tools-anchor, .sv-map-modern-drawer, .sv-map-toolbar-more')) return;
      setQuickToolsDrawerOpen(false);
    });
  }

  window.SurveyorGpsPointUI = {
    ...(window.SurveyorGpsPointUI || {}),
    open: (options = {}) => openGpsPanel(options),
    close: () => closeGpsPanel(),
    isOpen: () => gpsPanelVisible()
  };

  function install(map) {
    const mapEl = $('map');
    if (!mapEl || mapEl.dataset.surveyorMapUx2114a === '1') return;
    mapEl.dataset.surveyorMapUx2114a = '1';
    state.map = map;
    state.initialView = { center: map.getCenter(), zoom: map.getZoom() };
    try { map.zoomControl?.remove?.(); } catch {}
    buildRotationWrapper(map);
    installScale(map);
    buildOrientationControl(map);
    bindBaseMapMenu();
    bindSafeEditingReset();
    iconifyToolPopovers();
    bindGpsPointTool(map);
    bindQuickTools();
    window.addEventListener('resize', () => { if (state.bearing) applyBearing(state.bearing, { force: true }); clampGpsPanelToViewport(); });
  }

  function waitForMap(attempt = 0) {
    const map = window.SurveyorMapRuntime?.map || window.surveyorMapInstance || window.georuralMapInstance;
    if (map?.getPane && window.L) return install(map);
    if (attempt < 100) setTimeout(() => waitForMap(attempt + 1), 80);
  }

  const boot = () => {
    ensureGpsLauncherBound();
    waitForMap();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
