(() => {
  'use strict';

  const STORAGE_KEY = 'surveyor-live-snap-enabled-v1';
  const TOLERANCE_PX = 15;
  let enabled = false;
  let currentCandidate = null;
  let indicator = null;
  let tooltip = null;
  let patched = false;

  const runtime = () => window.SurveyorMapRuntime;
  const map = () => runtime()?.map;
  const drawn = () => runtime()?.drawn;

  function readPreference() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  }

  function writePreference(value) {
    try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch {}
  }

  function isDrawingSession() {
    if (!enabled || !map() || !drawn()) return false;
    if (document.body.classList.contains('surveyor-direct-editing')) return false;
    return document.body.classList.contains('drawing-active') || Boolean(document.querySelector('.leaflet-draw-tooltip'));
  }

  function layerMeta(layer) {
    return layer?.feature?.properties || layer?.__geoMeta || {};
  }

  function latLngPairsFromGeometry(geometry, out = []) {
    if (!geometry) return out;
    const walk = (coords) => {
      if (!Array.isArray(coords)) return;
      if (coords.length >= 2 && Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))) {
        out.push([Number(coords[1]), Number(coords[0])]);
        return;
      }
      coords.forEach(walk);
    };
    walk(geometry.coordinates);
    return out;
  }

  function segmentPairsFromGeometry(geometry, out = []) {
    if (!geometry) return out;
    const type = String(geometry.type || '');
    const addLine = (coords = [], closed = false) => {
      const pts = coords.map((c) => Array.isArray(c) ? [Number(c[1]), Number(c[0])] : null)
        .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
      for (let i = 0; i < pts.length - 1; i += 1) out.push([pts[i], pts[i + 1]]);
      if (closed && pts.length > 2) {
        const a = pts[pts.length - 1], b = pts[0];
        if (Math.abs(a[0] - b[0]) > 1e-12 || Math.abs(a[1] - b[1]) > 1e-12) out.push([a, b]);
      }
    };
    if (type === 'LineString') addLine(geometry.coordinates || [], false);
    if (type === 'MultiLineString') (geometry.coordinates || []).forEach((line) => addLine(line, false));
    if (type === 'Polygon') (geometry.coordinates || []).forEach((ring) => addLine(ring, true));
    if (type === 'MultiPolygon') (geometry.coordinates || []).forEach((polygon) => (polygon || []).forEach((ring) => addLine(ring, true)));
    return out;
  }

  function projectOnLine(point, a, b, clamp) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const denom = vx * vx + vy * vy;
    if (!denom) return null;
    let t = ((point.x - a.x) * vx + (point.y - a.y) * vy) / denom;
    const rawT = t;
    if (clamp) t = Math.max(0, Math.min(1, t));
    return { x: a.x + vx * t, y: a.y + vy * t, t, rawT };
  }

  function distancePx(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function candidateAt(latlng) {
    const m = map();
    const group = drawn();
    if (!m || !group || !latlng) return null;
    const pointer = m.latLngToLayerPoint(latlng);
    let best = null;
    const consider = (candidate, priority = 0) => {
      if (!candidate || candidate.distancePx > TOLERANCE_PX) return;
      const score = candidate.distancePx + priority;
      if (!best || score < best.score) best = { ...candidate, score };
    };

    group.eachLayer((layer) => {
      if (!m.hasLayer(layer) || !layer.toGeoJSON) return;
      const feature = layer.toGeoJSON();
      const name = String(layerMeta(layer).name || 'elemento');
      const vertices = latLngPairsFromGeometry(feature.geometry, []);
      vertices.forEach(([lat, lng], index) => {
        const ll = L.latLng(lat, lng);
        const pt = m.latLngToLayerPoint(ll);
        const px = distancePx(pointer, pt);
        consider({ type: 'vertex', latlng: ll, distancePx: px, label: `V-${String(index + 1).padStart(2, '0')} • ${m.distance(latlng, ll).toFixed(2)} m`, sourceName: name }, -3);
      });

      const segments = segmentPairsFromGeometry(feature.geometry, []);
      segments.forEach(([aLL, bLL]) => {
        const a = m.latLngToLayerPoint(L.latLng(aLL[0], aLL[1]));
        const b = m.latLngToLayerPoint(L.latLng(bLL[0], bLL[1]));
        const inside = projectOnLine(pointer, a, b, true);
        if (inside) {
          const p = L.point(inside.x, inside.y);
          const ll = m.layerPointToLatLng(p);
          consider({ type: 'segment', latlng: ll, distancePx: distancePx(pointer, p), label: `Segmento ⟂ • ${m.distance(latlng, ll).toFixed(2)} m`, sourceName: name }, 0);
        }
        const extended = projectOnLine(pointer, a, b, false);
        if (extended && (extended.rawT < 0 || extended.rawT > 1) && extended.rawT > -0.45 && extended.rawT < 1.45) {
          const p = L.point(extended.x, extended.y);
          const ll = m.layerPointToLatLng(p);
          consider({ type: 'extension', latlng: ll, distancePx: distancePx(pointer, p), label: `Prolongamento • ${m.distance(latlng, ll).toFixed(2)} m`, sourceName: name }, 2);
        }
      });
    });
    return best;
  }

  function clearIndicator() {
    currentCandidate = null;
    try { indicator?.remove?.(); } catch {}
    indicator = null;
    tooltip = null;
  }

  function showCandidate(candidate) {
    const m = map();
    if (!m || !candidate) return clearIndicator();
    currentCandidate = { ...candidate, updatedAt: Date.now() };
    if (!indicator) {
      indicator = L.marker(candidate.latlng, {
        interactive: false,
        keyboard: false,
        zIndexOffset: 3600,
        icon: L.divIcon({ className: 'surveyor-live-snap-icon', html: '<span>⊕</span>', iconSize: [26, 26], iconAnchor: [13, 13] })
      }).addTo(m);
      tooltip = indicator.bindTooltip('', { permanent: true, direction: 'top', offset: [0, -12], className: 'surveyor-live-snap-tooltip', opacity: 1 }).openTooltip();
    }
    indicator.setLatLng(candidate.latlng);
    indicator.setTooltipContent?.(`${candidate.label}${candidate.sourceName ? ` · ${candidate.sourceName}` : ''}`);
  }

  function onMouseMove(event) {
    if (!isDrawingSession()) return clearIndicator();
    const candidate = candidateAt(event.latlng);
    if (candidate) showCandidate(candidate);
    else clearIndicator();
  }

  function activeCandidateFor(latlng) {
    if (!enabled || !currentCandidate || Date.now() - Number(currentCandidate.updatedAt || 0) > 850) return null;
    const m = map();
    if (!m || !latlng) return null;
    const sourcePt = m.latLngToLayerPoint(latlng);
    const targetPt = m.latLngToLayerPoint(currentCandidate.latlng);
    return distancePx(sourcePt, targetPt) <= TOLERANCE_PX + 5 ? currentCandidate : null;
  }

  function patchLeafletDraw() {
    if (patched || !window.L?.Draw?.Polyline?.prototype) return;
    const proto = L.Draw.Polyline.prototype;
    const original = proto.addVertex;
    if (typeof original !== 'function') return;
    proto.addVertex = function surveyorSnapAddVertex(latlng) {
      const candidate = activeCandidateFor(latlng);
      const target = candidate?.latlng || latlng;
      const result = original.call(this, target);
      if (candidate) {
        try { window.SurveyorMapRuntime?.toast?.(`Snap ao vivo: ${candidate.label}`, 'success'); } catch {}
      }
      return result;
    };
    proto.addVertex.__surveyorLiveSnapPatched = true;
    patched = true;
  }

  function syncButton() {
    const button = document.getElementById('liveSnapToggleBtn');
    if (!button) return;
    button.setAttribute('aria-pressed', String(enabled));
    button.classList.toggle('active', enabled);
    button.textContent = enabled ? '✓ Snap durante desenho' : 'Snap durante desenho';
    button.title = enabled
      ? 'Snap ao vivo ligado: aproxima vértices de vértices, segmentos e prolongamentos.'
      : 'Ativar snap ao vivo durante desenho.';
  }

  function mountToggle() {
    if (document.getElementById('liveSnapToggleBtn')) return;
    const host = document.getElementById('cadToolsPopover');
    if (!host) return;
    const cancel = host.querySelector('[data-draw-tool="cancel"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'liveSnapToggleBtn';
    button.className = 'surveyor-live-snap-toggle';
    button.addEventListener('click', () => {
      enabled = !enabled;
      writePreference(enabled);
      if (!enabled) clearIndicator();
      syncButton();
      window.SurveyorMapRuntime?.toast?.(enabled
        ? 'Snap durante desenho ativado. O ponto gruda em vértices, segmentos e prolongamentos próximos.'
        : 'Snap durante desenho desativado.', 'success');
    });
    if (cancel) host.insertBefore(button, cancel);
    else host.appendChild(button);
    syncButton();
  }

  function start() {
    enabled = readPreference();
    patchLeafletDraw();
    mountToggle();
    const m = map();
    m?.on?.('mousemove', onMouseMove);
    m?.on?.('draw:drawstop', clearIndicator);
    m?.on?.('draw:created', clearIndicator);
    m?.on?.('draw:editstart', clearIndicator);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') clearIndicator(); });
    setTimeout(mountToggle, 300);
  }

  window.SurveyorLiveSnap = {
    isEnabled: () => enabled,
    setEnabled: (value) => { enabled = Boolean(value); writePreference(enabled); syncButton(); if (!enabled) clearIndicator(); },
    getCandidate: () => currentCandidate ? { ...currentCandidate } : null,
    tolerancePx: TOLERANCE_PX
  };

  if (runtime()?.map) start();
  else window.addEventListener('surveyor:map-runtime-ready', start, { once: true });
})();
