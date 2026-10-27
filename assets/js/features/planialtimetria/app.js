(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const BR = 'pt-BR';
  let lastSvg = '';
  let lastHtml = '';
  let lastRing = [];
  let confrontanteEditor = null;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const documentConfrontantes = window.SurveyorDocumentConfrontantes?.create?.({ escape: escapeHtml }) || null;
  const technicalMapBridge = window.SurveyorTechnicalMapBridge || null;

  function toast(message, type = '') {
    const el = $('suiteToast');
    if (!el) return;
    clearTimeout(toast.timer);
    el.textContent = message;
    el.className = `toast show ${type}`;
    toast.timer = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  function num(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString(BR, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function parsePtValue(value) {
    if (value == null) return NaN;
    return Number(String(value).trim().replace(',', '.'));
  }


  function svgTechnicalLabel(x, y, text, opts = {}) {
    const label = String(text || '');
    const fontSize = Number(opts.fontSize || 5.2);
    const textColor = opts.textColor || '#111827';
    const weight = Number(opts.fontWeight || 650);
    const anchor = opts.anchor === 'middle' ? 'middle' : 'start';
    const halo = Number(opts.halo ?? 0.7);
    return `<text class="sv-technical-label" x="${x}" y="${y}" ${anchor === 'middle' ? 'text-anchor="middle" ' : ''}font-size="${fontSize}" font-weight="${weight}" fill="${textColor}" stroke="#ffffff" stroke-width="${halo}" stroke-linejoin="round" paint-order="stroke fill">${escapeHtml(label)}</text>`;
  }

  const TERRARIUM_DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const TERRARIUM_DEM_ZOOM = 14;
  const TERRARIUM_TILE_SIZE = 256;
  const terrainTileCache = new Map();
  const terrainTileCacheOrder = [];

  function rememberTerrainTile(key, value) {
    if (terrainTileCache.has(key)) return;
    terrainTileCache.set(key, value);
    terrainTileCacheOrder.push(key);
    while (terrainTileCacheOrder.length > 180) {
      const oldest = terrainTileCacheOrder.shift();
      if (oldest) terrainTileCache.delete(oldest);
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lonLatToTilePixel(lng, lat, zoom = TERRARIUM_DEM_ZOOM) {
    const z = clamp(Math.round(Number(zoom) || TERRARIUM_DEM_ZOOM), 0, 15);
    const safeLat = clamp(Number(lat), -85.05112878, 85.05112878);
    const safeLng = ((Number(lng) + 180) % 360 + 360) % 360 - 180;
    const n = 2 ** z;
    const xFloat = ((safeLng + 180) / 360) * n;
    const latRad = safeLat * Math.PI / 180;
    const yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    const x = clamp(Math.floor(xFloat), 0, n - 1);
    const y = clamp(Math.floor(yFloat), 0, n - 1);
    const px = clamp(Math.floor((xFloat - x) * TERRARIUM_TILE_SIZE), 0, TERRARIUM_TILE_SIZE - 1);
    const py = clamp(Math.floor((yFloat - y) * TERRARIUM_TILE_SIZE), 0, TERRARIUM_TILE_SIZE - 1);
    return { z, x, y, px, py };
  }

  function decodeTerrariumElevation(data, index) {
    return (data[index] * 256 + data[index + 1] + data[index + 2] / 256) - 32768;
  }

  async function loadTerrainTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    const cached = terrainTileCache.get(key);
    if (cached) return cached;
    const url = TERRARIUM_DEM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) throw new Error(`DEM HTTP ${response.status}`);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = TERRARIUM_TILE_SIZE;
    canvas.height = TERRARIUM_TILE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, TERRARIUM_TILE_SIZE, TERRARIUM_TILE_SIZE);
    const image = ctx.getImageData(0, 0, TERRARIUM_TILE_SIZE, TERRARIUM_TILE_SIZE);
    rememberTerrainTile(key, image);
    return image;
  }

  async function terrainElevationAt(lat, lng) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return NaN;
    const t = lonLatToTilePixel(Number(lng), Number(lat));
    const tile = await loadTerrainTile(t.z, t.x, t.y);
    const data = tile.data;
    const idx = (t.py * TERRARIUM_TILE_SIZE + t.px) * 4;
    const center = decodeTerrariumElevation(data, idx);

    // Pequena suavização 3x3 para evitar leitura isolada de pixel em borda/ruído do DEM.
    let sum = 0;
    let weightSum = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = t.px + dx;
        const y = t.py + dy;
        if (x < 0 || y < 0 || x >= TERRARIUM_TILE_SIZE || y >= TERRARIUM_TILE_SIZE) continue;
        const w = dx === 0 && dy === 0 ? 4 : 1;
        sum += decodeTerrariumElevation(data, (y * TERRARIUM_TILE_SIZE + x) * 4) * w;
        weightSum += w;
      }
    }
    return weightSum ? sum / weightSum : center;
  }

  async function fillMissingAltitudesFromTerrain(points, project, mode = 'auto') {
    const current = (points || []).map((point) => ({ ...point }));
    if (!current.length || mode === 'file') return current;

    const ringForAuto = projectRing(project, current);
    const bounds = boundsFrom(ringForAuto, current);

    if (mode === 'demo') {
      return current.map((point, index) => Number.isFinite(point.alt)
        ? point
        : { ...point, alt: autoAltitudeFor(point.lng, point.lat, bounds, index), source: 'demonstrativa' });
    }

    const controls = realTerrainControls(project);
    if (controls.length >= 3) {
      current.forEach((point) => {
        if (Number.isFinite(point.alt)) return;
        const alt = idwValue(point.lng, point.lat, controls, 2);
        if (Number.isFinite(alt)) {
          point.alt = alt;
          point.source = 'interpolada';
        }
      });
    }

    const missing = current.filter((point) => !Number.isFinite(point.alt));
    if (!missing.length) return current;

    let loaded = 0;
    for (const point of missing) {
      try {
        const alt = await terrainElevationAt(point.lat, point.lng);
        if (Number.isFinite(alt)) {
          point.alt = alt;
          point.source = 'dem';
          loaded += 1;
        }
      } catch (error) {
        console.warn('Não foi possível consultar altitude DEM para o ponto:', point.name, error);
      }
    }
    if (loaded) toast(`${loaded} altitude(s) carregada(s) do DEM real do mapa.`, 'success');
    return current;
  }

  function parseElevationPoints() {
    const raw = $('elevationPoints')?.value || '';
    return raw.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const parts = line.split(/[;\t]/).map((part) => part.trim());
        const name = parts[0] || `P-${String(index + 1).padStart(2, '0')}`;
        return {
          name,
          lat: parsePtValue(parts[1]),
          lng: parsePtValue(parts[2]),
          alt: parsePtValue(parts[3])
        };
      })
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }

  function closedRing(coords = []) {
    const clean = coords
      .filter((c) => Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1])))
      .map((c) => [Number(c[0]), Number(c[1])]);
    if (clean.length < 3) return [];
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-12 && Math.abs(first[1] - last[1]) < 1e-12) return clean;
    return clean.concat([first]);
  }

  function projectRing(project, points) {
    const features = project?.geojson?.features || [];
    const polygon = globalThis.SurveyorProjectGeometry?.resolvePerimeter?.({ geojson: { type: 'FeatureCollection', features } })
      || features.filter((feature) => /Polygon/i.test(feature?.geometry?.type || '')).sort((a,b)=>(globalThis.turf?.area?.(b)||0)-(globalThis.turf?.area?.(a)||0))[0];
    const geom = polygon?.geometry;
    if (geom?.type === 'Polygon') return closedRing(geom.coordinates?.[0] || []);
    if (geom?.type === 'MultiPolygon') return closedRing(geom.coordinates?.[0]?.[0] || []);
    if (points.length >= 3) return closedRing(points.map((point) => [point.lng, point.lat]));
    return [];
  }


  function projectPolygonFeature(project) {
    const features = project?.geojson?.features || [];
    return features.find((feature) => feature?.properties?.category === 'perimetro' && /Polygon/i.test(feature?.geometry?.type || ''))
      || features.find((feature) => /Polygon/i.test(feature?.geometry?.type || ''))
      || null;
  }

  function rawPolygonRing(project) {
    const polygon = projectPolygonFeature(project);
    const geom = polygon?.geometry;
    if (geom?.type === 'Polygon') return geom.coordinates?.[0] || [];
    if (geom?.type === 'MultiPolygon') return geom.coordinates?.[0]?.[0] || [];
    return [];
  }

  function propertyAltitude(props = {}, index = 0) {
    const directKeys = ['altitude', 'elevation', 'elevacao', 'elev', 'cota', 'cotas', 'alt', 'z', 'height', 'altura', 'nivel', 'nivel_altimetrico'];
    for (const key of directKeys) {
      const value = parsePtValue(props[key]);
      if (Number.isFinite(value)) return value;
    }
    const arrays = [props.altitudes, props.elevations, props.cotas, props.zValues, props.altitudeValues];
    for (const arr of arrays) {
      if (Array.isArray(arr)) {
        const value = parsePtValue(arr[index]);
        if (Number.isFinite(value)) return value;
      }
      if (typeof arr === 'string') {
        const value = parsePtValue(arr.split(/[;,\s]+/)[index]);
        if (Number.isFinite(value)) return value;
      }
    }
    return NaN;
  }

  function coordAltitude(coord, props = {}, index = 0) {
    const z = parsePtValue(coord?.[2]);
    if (Number.isFinite(z)) return z;
    return propertyAltitude(props, index);
  }

  function projectTitle(project) {
    return project?.title || project?.propertyName || project?.name || 'SEM NOME';
  }

  function formatElevationLine(point) {
    return `${point.name};${Number(point.lat).toFixed(8)};${Number(point.lng).toFixed(8)};${Number(point.alt).toFixed(2)}`;
  }

  function autoAltitudeFor(lng, lat, bounds, index = 0) {
    const dx = Math.max(bounds.maxx - bounds.minx, 1e-9);
    const dy = Math.max(bounds.maxy - bounds.miny, 1e-9);
    const nx = (lng - bounds.minx) / dx;
    const ny = (lat - bounds.miny) / dy;
    // Superfície demonstrativa determinística: macrodeclive contínuo + ondulação leve.
    // Não usa número aleatório; se houver cotas reais/terreno, elas sempre têm prioridade.
    const macroSlope = 0.62 * nx + 0.38 * (1 - ny);
    const ridge = Math.sin((nx * 1.15 + ny * 0.85) * Math.PI) * 7;
    const valley = Math.cos((nx * 1.8 - ny * 1.1) * Math.PI) * 4;
    return 780 + macroSlope * 58 + ridge + valley;
  }

  function extractAltitudeControlPoints(project) {
    const features = project?.geojson?.features || [];
    const controls = [];
    features.forEach((feature, featureIndex) => {
      const props = feature?.properties || {};
      const geom = feature?.geometry || {};
      const add = (coord, index) => {
        if (!Array.isArray(coord) || !Number.isFinite(Number(coord[0])) || !Number.isFinite(Number(coord[1]))) return;
        const alt = coordAltitude(coord, props, index);
        if (!Number.isFinite(alt)) return;
        controls.push({
          name: props.name || props.codigo || props.code || `P-${String(controls.length + 1).padStart(2, '0')}`,
          lng: Number(coord[0]),
          lat: Number(coord[1]),
          alt,
          source: 'arquivo'
        });
      };
      if (geom.type === 'Point') add(geom.coordinates, featureIndex);
      if (geom.type === 'LineString') (geom.coordinates || []).forEach(add);
      if (geom.type === 'Polygon') (geom.coordinates?.[0] || []).forEach(add);
      if (geom.type === 'MultiPolygon') (geom.coordinates?.[0]?.[0] || []).forEach(add);
    });
    return controls;
  }



  function metadataAltitudeControls(project) {
    const metadata = project?.metadata || {};
    const candidates = [metadata.altimetryPoints, metadata.elevationPoints, metadata.mdtPoints, metadata.terrainPoints, project?.altimetryPoints, project?.elevationPoints, project?.terrainPoints];
    const controls = [];
    const add = (item, index) => {
      if (!item) return;
      if (Array.isArray(item)) {
        const lng = parsePtValue(item[0] ?? item.lng ?? item.longitude);
        const lat = parsePtValue(item[1] ?? item.lat ?? item.latitude);
        const alt = parsePtValue(item[2] ?? item.alt ?? item.altitude ?? item.cota ?? item.elevation);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(alt)) controls.push({ name: `MDT-${index + 1}`, lat, lng, alt, source: 'terreno' });
        return;
      }
      const lat = parsePtValue(item.lat ?? item.latitude ?? item.y);
      const lng = parsePtValue(item.lng ?? item.lon ?? item.longitude ?? item.x);
      const alt = parsePtValue(item.alt ?? item.altitude ?? item.elevation ?? item.cota ?? item.z);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(alt)) controls.push({ name: item.name || item.nome || `MDT-${index + 1}`, lat, lng, alt, source: 'terreno' });
    };
    candidates.forEach((candidate) => {
      if (Array.isArray(candidate)) candidate.forEach(add);
      else if (typeof candidate === 'string') {
        candidate.split(/\r?\n/).forEach((line, index) => {
          const parts = line.split(/[;,\t]/).map((value) => value.trim());
          add({ name: parts[0], lat: parts[1], lng: parts[2], alt: parts[3] }, index);
        });
      }
    });
    return controls;
  }

  function realTerrainControls(project) {
    const controls = [...extractAltitudeControlPoints(project), ...metadataAltitudeControls(project)]
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Number.isFinite(point.alt));
    const seen = new Set();
    return controls.filter((point) => {
      const key = `${point.lat.toFixed(7)}:${point.lng.toFixed(7)}:${point.alt.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function shouldInvertEstimatedRelief() {
    return $('reliefCorrection')?.value === 'invert';
  }

  function applyEstimatedReliefCorrection(points) {
    if (!shouldInvertEstimatedRelief()) return points;
    const estimated = points.filter((point) => ['estimada', 'demonstrativa'].includes(point.source) && Number.isFinite(point.alt));
    if (estimated.length < 2) return points;
    const min = Math.min(...estimated.map((point) => point.alt));
    const max = Math.max(...estimated.map((point) => point.alt));
    return points.map((point) => ['estimada', 'demonstrativa'].includes(point.source) && Number.isFinite(point.alt)
      ? { ...point, alt: min + max - point.alt, source: 'estimada-invertida' }
      : point);
  }

  function extractProjectElevationPoints(project, mode = 'auto') {
    const raw = rawPolygonRing(project);
    const props = projectPolygonFeature(project)?.properties || {};
    const clean = raw
      .filter((coord) => Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1])))
      .map((coord, index) => {
        const alt = coordAltitude(coord, props, index);
        return {
          name: props.vertexNames?.[index] || props.vertices?.[index]?.name || `V-${String(index + 1).padStart(2, '0')}`,
          lng: Number(coord[0]),
          lat: Number(coord[1]),
          alt,
          source: Number.isFinite(alt) ? 'arquivo' : 'pendente'
        };
      });
    if (clean.length > 1) {
      const first = clean[0];
      const last = clean[clean.length - 1];
      if (Math.abs(first.lng - last.lng) < 1e-12 && Math.abs(first.lat - last.lat) < 1e-12) clean.pop();
    }
    if (clean.length < 3) return [];

    const bounds = boundsFrom(closedRing(clean.map((point) => [point.lng, point.lat])), clean);
    if (mode === 'demo') {
      return clean.map((point, index) => Number.isFinite(point.alt)
        ? point
        : { ...point, alt: autoAltitudeFor(point.lng, point.lat, bounds, index), source: 'demonstrativa' });
    }

    // No modo normal, não inventa altitude. Retorna os vértices com as cotas existentes
    // e deixa fillMissingAltitudesFromTerrain consultar o DEM real do mapa.
    return clean;
  }

  function altitudeSourceLabel(points) {
    const sources = new Set(points.map((point) => point.source).filter(Boolean));
    const uncertain = sources.has('estimada') || sources.has('estimada-invertida') || sources.has('demonstrativa');
    if (sources.has('dem') && !uncertain && !sources.has('interpolada')) return 'Altitudes carregadas automaticamente do DEM real Terrarium usado na camada altimétrica do mapa. Valores aproximados; não substituem levantamento GNSS/RTK ou nivelamento técnico.';
    if (sources.has('dem') && sources.has('interpolada') && !uncertain) return 'Altitudes combinadas entre DEM real Terrarium do mapa e interpolação por pontos cotados do projeto. Valores aproximados.';
    if (sources.has('terreno') && !uncertain) return 'Altitudes obtidas de pontos/cotas do terreno vinculados ao projeto.';
    if (sources.has('arquivo') && !sources.has('interpolada') && !uncertain && !sources.has('dem')) return 'Altitudes do arquivo/projeto.';
    if (sources.has('interpolada') && !uncertain && !sources.has('dem')) return 'Altitudes interpoladas a partir de pontos cotados do projeto.';
    if (sources.has('demonstrativa') || sources.has('estimada') || sources.has('estimada-invertida')) return 'Altitudes demonstrativas geradas somente para estudo visual. Não usar como resultado técnico final.';
    return 'Altitudes informadas pelo usuário.';
  }

  let planialtProjectLoadToken = 0;
  function setPlanialtLoading(active) {
    let overlay=document.getElementById('planialtDocumentLoadingOverlay');
    if(active){
      if(!overlay){overlay=document.createElement('div');overlay.id='planialtDocumentLoadingOverlay';overlay.className='sv-document-app-loader';overlay.setAttribute('role','status');overlay.setAttribute('aria-label','Carregando planialtimetria');overlay.innerHTML='<span class="sv-document-app-loader-spinner" aria-hidden="true"></span>';document.body.appendChild(overlay);}
      overlay.hidden=false;overlay.setAttribute('aria-hidden','false');
    }else if(overlay){overlay.hidden=true;overlay.setAttribute('aria-hidden','true');}
  }
  async function loadAndRenderSelectedProject() {
    const select=$('projectSelect');
    if(!select?.value){lastSvg='';lastHtml='';const preview=$('elevationPreview');if(preview){preview.innerHTML='<p>Selecione um projeto para preparar automaticamente a pré-visualização planialtimétrica.</p>';preview.hidden=false;}return false;}
    const token=++planialtProjectLoadToken;setPlanialtLoading(true);
    try{await loadSelectedProjectAltitudes();if(token!==planialtProjectLoadToken)return false;await renderPlanialtimetria();if(token!==planialtProjectLoadToken)return false;window.dispatchEvent(new CustomEvent('surveyor:document-generation-finished',{detail:{page:'planialtimetria.html'}}));return true;}
    finally{if(token===planialtProjectLoadToken)setPlanialtLoading(false);}
  }

  async function getSelectedProject() {
    const id = $('projectSelect')?.value;
    if (!id || !window.GeoRuralProjects?.get) return null;
    try {
      const project = await window.GeoRuralProjects.get(id, true);
      return globalThis.SurveyorDocumentScope?.apply?.(project) || project;
    }
    catch (error) { console.warn('Projeto não carregado para planialtimetria:', error); return null; }
  }

  function haversine(a, b) {
    const R = 6371008.8;
    const rad = (x) => x * Math.PI / 180;
    const dLat = rad(b[1] - a[1]);
    const dLon = rad(b[0] - a[0]);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function perimeterMeters(ring) {
    return ring.slice(0, -1).reduce((sum, point, index) => sum + haversine(point, ring[index + 1]), 0);
  }

  function areaHa(ring) {
    try {
      if (window.turf && ring.length >= 4) return window.turf.area(window.turf.polygon([ring])) / 10000;
    } catch {}
    return 0;
  }

  function boundsFrom(ring, points) {
    const coords = ring.length ? ring : points.map((p) => [p.lng, p.lat]);
    const xs = coords.map((c) => c[0]);
    const ys = coords.map((c) => c[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const dx = Math.max(maxx - minx, 0.0001);
    const dy = Math.max(maxy - miny, 0.0001);
    return { minx: minx - dx * 0.08, maxx: maxx + dx * 0.08, miny: miny - dy * 0.08, maxy: maxy + dy * 0.08 };
  }

  function colorRamp(t) {
    const stops = [
      [0.00, [30, 92, 200]],
      [0.20, [20, 180, 210]],
      [0.42, [62, 211, 122]],
      [0.62, [192, 235, 118]],
      [0.78, [245, 219, 114]],
      [1.00, [129, 104, 94]]
    ];
    const v = Math.max(0, Math.min(1, t));
    for (let i = 1; i < stops.length; i += 1) {
      if (v <= stops[i][0]) {
        const [p0, c0] = stops[i - 1];
        const [p1, c1] = stops[i];
        const k = (v - p0) / (p1 - p0 || 1);
        const c = c0.map((a, j) => Math.round(a + (c1[j] - a) * k));
        return `rgb(${c[0]},${c[1]},${c[2]})`;
      }
    }
    return 'rgb(129,104,94)';
  }

  function idwValue(lng, lat, points, power = 2) {
    let numerator = 0;
    let denominator = 0;
    for (const p of points) {
      if (!Number.isFinite(p.alt)) continue;
      const dist = Math.max(haversine([lng, lat], [p.lng, p.lat]), 0.01);
      const weight = 1 / (dist ** power);
      numerator += weight * p.alt;
      denominator += weight;
    }
    return denominator ? numerator / denominator : NaN;
  }

  function makeGrid(bounds, points, cols = 64, rows = 64) {
    const grid = [];
    for (let y = 0; y <= rows; y += 1) {
      const row = [];
      const lat = bounds.maxy - (bounds.maxy - bounds.miny) * (y / rows);
      for (let x = 0; x <= cols; x += 1) {
        const lng = bounds.minx + (bounds.maxx - bounds.minx) * (x / cols);
        row.push(idwValue(lng, lat, points));
      }
      grid.push(row);
    }
    return grid;
  }

  function interpolationPoint(a, b, va, vb, level) {
    const k = (level - va) / (vb - va || 1e-9);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }

  function contourSegments(grid, project, levels) {
    const rows = grid.length - 1;
    const cols = grid[0].length - 1;
    const results = [];
    for (const level of levels) {
      const lines = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const p0 = project(x, y);
          const p1 = project(x + 1, y);
          const p2 = project(x + 1, y + 1);
          const p3 = project(x, y + 1);
          const v0 = grid[y][x], v1 = grid[y][x + 1], v2 = grid[y + 1][x + 1], v3 = grid[y + 1][x];
          if (![v0, v1, v2, v3].every(Number.isFinite)) continue;
          const hits = [];
          if ((v0 < level && v1 >= level) || (v0 >= level && v1 < level)) hits.push(interpolationPoint(p0, p1, v0, v1, level));
          if ((v1 < level && v2 >= level) || (v1 >= level && v2 < level)) hits.push(interpolationPoint(p1, p2, v1, v2, level));
          if ((v2 < level && v3 >= level) || (v2 >= level && v3 < level)) hits.push(interpolationPoint(p2, p3, v2, v3, level));
          if ((v3 < level && v0 >= level) || (v3 >= level && v0 < level)) hits.push(interpolationPoint(p3, p0, v3, v0, level));
          if (hits.length === 2) lines.push(hits);
          if (hits.length === 4) { lines.push([hits[0], hits[1]]); lines.push([hits[2], hits[3]]); }
        }
      }
      results.push({ level, lines });
    }
    return results;
  }

  function pointInProjectedPolygon(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function pointSegmentDistance(point, a, b) {
    const [px, py] = point;
    const [ax, ay] = a;
    const [bx, by] = b;
    const vx = bx - ax;
    const vy = by - ay;
    const denom = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / denom));
    return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
  }

  function projectedPolygonEdgeDistance(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return 0;
    let min = Infinity;
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      min = Math.min(min, pointSegmentDistance(point, a, b));
    }
    return min;
  }

  function contourGroupLabel(group, polygon) {
    const candidates = (group?.lines || []).map((segment) => ({
      segment,
      mid: [(segment[0][0] + segment[1][0]) / 2, (segment[0][1] + segment[1][1]) / 2]
    })).filter((item) => pointInProjectedPolygon(item.mid, polygon) && projectedPolygonEdgeDistance(item.mid, polygon) >= 16);
    if (!candidates.length) return '';
    const chosen = candidates[Math.floor(candidates.length / 2)];
    return svgTechnicalLabel(Number(chosen.mid[0].toFixed(1)), Number(chosen.mid[1].toFixed(1)), `${num(group.level, 1)} m`, {
      fontSize: 7.2, textColor: '#111827', fontWeight: 700, anchor: 'middle', halo: 0.62
    });
  }

  function tinyQr(x, y, size = 100) {
    const cells = [
      '1111111001011111111','1000001001010000001','1011101001010111001','1011101000010111001','1011101011110111001','1000001010010000001','1111111010101111111','0000000011100000000','1110101110011010111','0011010001110011001','1010111110101110101','0101000101110001010','1110101010011110101','0000000010100001000','1111111001111011111','1000001010001000001','1011101011101011101','1000001010101000101','1111111011111111111'
    ];
    const c = size / cells.length;
    let rects = `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff"/>`;
    cells.forEach((row, r) => [...row].forEach((value, col) => {
      if (value === '1') rects += `<rect x="${(x + col * c).toFixed(2)}" y="${(y + r * c).toFixed(2)}" width="${(c + 0.2).toFixed(2)}" height="${(c + 0.2).toFixed(2)}" fill="#111827"/>`;
    }));
    return rects;
  }


  async function makeQrDataUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const qrLib = window.GeoRuralQR || window.QRCode;
    if (!qrLib?.toDataURL) return '';
    try {
      return await qrLib.toDataURL(text, { width: 180, margin: 2, errorCorrectionLevel: 'M' });
    } catch (error) {
      console.warn('Não foi possível gerar QR Code real da planialtimetria:', error);
      return '';
    }
  }

  function northArrow(x, y) {
    return `<g transform="translate(${x} ${y})">
      <circle cx="34" cy="34" r="31" fill="none" stroke="#111827" stroke-width="1.6"/>
      <circle cx="34" cy="34" r="27.4" fill="none" stroke="#111827" stroke-width="1.1"/>
      <polygon points="34,5 38.3,23.2 34,34 29.7,23.2" fill="#111827"/>
      <polygon points="63,34 44.8,38.3 34,34 44.8,29.7" fill="#111827"/>
      <polygon points="34,63 38.3,44.8 34,34 29.7,44.8" fill="#111827"/>
      <polygon points="5,34 23.2,38.3 34,34 23.2,29.7" fill="#111827"/>
      <polygon points="34,15.2 42.1,25.9 34,34 25.9,25.9" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="52.8,34 42.1,42.1 34,34 42.1,25.9" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="34,52.8 42.1,42.1 34,34 25.9,42.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="15.2,34 25.9,42.1 34,34 25.9,25.9" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <text x="34" y="-8" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">N</text>
      <text x="77" y="39" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">E</text>
      <text x="34" y="84" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">S</text>
      <text x="-9" y="39" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">W</text>
    </g>`;
  }

  function wrapSvgText(value, maxChars = 28, maxLines = 4) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return [];
    const lines = [];
    let rest = raw;
    while (rest.length && lines.length < maxLines) {
      if (rest.length <= maxChars) {
        lines.push(rest);
        break;
      }
      const slice = rest.slice(0, maxChars);
      let cut = Math.max(slice.lastIndexOf('/'), slice.lastIndexOf('-'), slice.lastIndexOf('_'), slice.lastIndexOf(' '));
      if (cut < Math.floor(maxChars * 0.45)) cut = maxChars;
      lines.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest && lines.length) {
      const last = lines.length - 1;
      lines[last] = `${lines[last].slice(0, Math.max(0, maxChars - 1)).trim()}…`;
    }
    return lines;
  }

  function svgTextBlock(lines, x, y, options = {}) {
    const fontSize = options.fontSize || 11;
    const lineHeight = options.lineHeight || Math.round(fontSize * 1.35);
    const fill = options.fill || '#111827';
    const weight = options.weight ? ` font-weight="${options.weight}"` : '';
    const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : '';
    return (lines || []).map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" font-size="${fontSize}" fill="${fill}"${weight}${anchor}>${escapeHtml(line)}</text>`).join('');
  }

  function truncateSvgText(value, maxChars = 34) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
  }

  function sheetSvg({ project, points, ring, qrDataUrl = '', publicLink = '', customization = {}, logoData = '' }) {
    const validAlt = points.filter((p) => Number.isFinite(p.alt));
    const alts = validAlt.map((p) => p.alt);
    const minAlt = alts.length ? Math.min(...alts) : 0;
    const maxAlt = alts.length ? Math.max(...alts) : 0;
    const hasRelief = validAlt.length >= 3 && Math.abs(maxAlt - minAlt) >= 0.01;

    const W = 900, H = 1260;
    const map = { x: 58, y: 76, w: 680, h: 775 };
    const colorbar = { x: 768, y: 76, w: 42, h: 700 };
    const bounds = boundsFrom(ring, points);
    const dx = bounds.maxx - bounds.minx;
    const dy = bounds.maxy - bounds.miny;
    const scale = Math.min(map.w / (dx || 1), map.h / (dy || 1));
    const usedW = dx * scale;
    const usedH = dy * scale;
    const ox = map.x + (map.w - usedW) / 2;
    const oy = map.y + (map.h - usedH) / 2;
    const projectGeo = ([lng, lat]) => [ox + (lng - bounds.minx) * scale, oy + usedH - (lat - bounds.miny) * scale];
    const projectGrid = (gx, gy, cols = 64, rows = 64) => [map.x + map.w * (gx / cols), map.y + map.h * (gy / rows)];

    const perimeterFeature = projectPolygonFeature(project);
    const visualSettings = technicalMapBridge?.readSettings?.(project, confrontanteEditor, project?.id || $('projectSelect')?.value || 'sem-projeto') || {};
    const polygonVisual = technicalMapBridge?.polygonAttributes?.(perimeterFeature, visualSettings, { color:'#dc2626', opacity:.16, category:'perimetro', perimeter:true, name:projectTitle(project) }) || { className:'sv-document-editable-polygon sv-document-perimeter-fill', data:'data-polygon-key="perimetro:principal" data-polygon-name="Perímetro" data-polygon-category="perimetro" data-polygon-color="#dc2626"', fill:'#dc2626', stroke:'#dc2626', fillOpacity:.16 };
    const confrontanteLabels = documentConfrontantes && perimeterFeature
      ? documentConfrontantes.smartConfrontanteLabels(perimeterFeature, ring, projectGeo, map, {
          fontSize: 9.2, offset: 27, maxOffset: 82, edgePadding: 7, maxChars: 24,
          manualOffsets: (confrontanteEditor?.readProjectSegments?.() || []).length ? {} : (confrontanteEditor?.readOffsets?.() || {}),
          segmentOverrides: confrontanteEditor?.readProjectSegments?.() || []
        })
      : '';

    const projectedRing = ring.length ? ring.slice(0, -1).map(projectGeo) : [];
    const polygonPoints = projectedRing.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const clipId = `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const mapClipId = `${clipId}-map`;
    const gridLines = [];
    const ticks = 6;
    for (let i = 0; i <= ticks; i += 1) {
      const x = map.x + map.w * (i / ticks);
      const y = map.y + map.h * (i / ticks);
      const lon = bounds.minx + dx * (i / ticks);
      const lat = bounds.maxy - dy * (i / ticks);
      gridLines.push(`<line x1="${x}" y1="${map.y}" x2="${x}" y2="${map.y + map.h}" stroke="#9ca3af" stroke-width="1"/>`);
      gridLines.push(`<line x1="${map.x}" y1="${y}" x2="${map.x + map.w}" y2="${y}" stroke="#9ca3af" stroke-width="1"/>`);
      gridLines.push(`<text x="${x}" y="${map.y + map.h + 24}" text-anchor="middle" font-size="10" fill="#111827">${lon.toFixed(4)}</text>`);
      gridLines.push(`<text x="${map.x - 18}" y="${y + 4}" text-anchor="middle" font-size="10" fill="#111827" transform="rotate(-90 ${map.x - 18} ${y + 4})">${lat.toFixed(4)}</text>`);
      gridLines.push(`<text x="${map.x + map.w + 20}" y="${y + 4}" text-anchor="middle" font-size="10" fill="#111827" transform="rotate(-90 ${map.x + map.w + 20} ${y + 4})">${lat.toFixed(4)}</text>`);
    }

    let relief = '';
    let contours = '';
    let legendScale = '';
    if (hasRelief) {
      const cols = 64, rows = 64;
      const grid = makeGrid(bounds, validAlt, cols, rows);
      const cellW = map.w / cols;
      const cellH = map.h / rows;
      const rects = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const values = [grid[y][x], grid[y][x + 1], grid[y + 1][x], grid[y + 1][x + 1]].filter(Number.isFinite);
          if (!values.length) continue;
          const v = values.reduce((a, b) => a + b, 0) / values.length;
          rects.push(`<rect x="${(map.x + x * cellW).toFixed(2)}" y="${(map.y + y * cellH).toFixed(2)}" width="${(cellW + 0.35).toFixed(2)}" height="${(cellH + 0.35).toFixed(2)}" fill="${colorRamp((v - minAlt) / (maxAlt - minAlt || 1))}"/>`);
        }
      }
      relief = `<g clip-path="url(#${clipId})">${rects.join('')}</g>`;
      const step = (maxAlt - minAlt) / 8;
      const levels = Array.from({ length: 8 }, (_, i) => minAlt + step * (i + 1));
      const segments = contourSegments(grid, (x, y) => projectGrid(x, y, cols, rows), levels);
      const contourLineArt = segments.map((group) => group.lines.map((line) => `<line x1="${line[0][0].toFixed(1)}" y1="${line[0][1].toFixed(1)}" x2="${line[1][0].toFixed(1)}" y2="${line[1][1].toFixed(1)}" stroke="#111827" stroke-width="1.05" stroke-linecap="round"/>`).join('')).join('');
      const contourLabelArt = segments.map((group) => contourGroupLabel(group, projectedRing)).join('');
      contours = `<g clip-path="url(#${clipId})">${contourLineArt}</g><g class="planialt-contour-labels">${contourLabelArt}</g>`;
      legendScale = Array.from({ length: 12 }, (_, i) => {
        const t = i / 11;
        const h = colorbar.h / 12;
        return `<rect x="${colorbar.x}" y="${(colorbar.y + colorbar.h - (i + 1) * h).toFixed(1)}" width="${colorbar.w}" height="${(h + 0.2).toFixed(1)}" fill="${colorRamp(t)}"/>`;
      }).join('');
    } else {
      relief = polygonPoints ? `<polygon points="${polygonPoints}" fill="#d9f99d" fill-opacity=".75"/>` : '';
      contours = `<text x="${map.x + map.w / 2}" y="${map.y + map.h / 2}" text-anchor="middle" font-size="17" fill="#475569" font-weight="700">Informe altitudes diferentes para gerar curvas de nível.</text>`;
      legendScale = `<rect x="${colorbar.x}" y="${colorbar.y}" width="${colorbar.w}" height="${colorbar.h}" fill="#e2e8f0"/>`;
    }

    const labelStep = points.length <= 18 ? 1 : points.length <= 60 ? 5 : 10;
    const pointMarkers = points.map((p, index) => {
      const q = projectGeo([p.lng, p.lat]);
      const label = p.name || `V-${String(index + 1).padStart(2, '0')}`;
      const showLabel = index % labelStep === 0 || index === points.length - 1;
      const vertexVisual = technicalMapBridge?.vertexVisual?.(label, visualSettings, 4.8) || { attrs:'class="sv-technical-label sv-vertex-label"', fontSize:4.8 };
      const labelX=Math.max(map.x+6,Math.min(map.x+map.w-28,q[0]+3.4));
      const labelY=Math.max(map.y+10,Math.min(map.y+map.h-5,q[1]-3.1));
      const labelSvg = showLabel ? `<text ${vertexVisual.attrs} x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" font-size="${Number(vertexVisual.fontSize || 4.8).toFixed(2)}" font-weight="550" fill="#111827" stroke="#ffffff" stroke-width="0.45" stroke-linejoin="round" paint-order="stroke fill">${escapeHtml(label)}</text>` : '';
      return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="2.1" fill="#dc2626" stroke="#fff" stroke-width="0.7"/>${labelSvg}`;
    }).join('');

    const city = [project?.city || project?.municipality || 'Não informado', project?.uf || project?.stateCode || ''].filter(Boolean).join('/');
    const title = (project?.title || project?.propertyName || project?.name || 'SEM NOME').toUpperCase();
    const owner = window.GeoRuralProjects?.ownerNames?.(project) || project?.owner || project?.ownerName || 'Sem proprietário';
    const area = areaHa(ring);
    const per = perimeterMeters(ring);
    const logo = logoData || customization.logoDataUrl || '/assets/logo.png';
    const responsible = customization.responsibleTechnician || 'Não informado';
    const registry = customization.professionalRegistry || '';
    const footerText = customization.footerText || '';
    const today = new Date().toLocaleDateString(BR);
    const altitudeNote = altitudeSourceLabel(points);
    const companyName = customization.companyName || customization.officeName || customization.company || 'Surveyor';
    publicLink = publicLink || project?.publicUrl || project?.shareUrl || (() => {
      try { return new URL('/public-project/', window.location.origin).href; }
      catch (_error) { return String(window.location?.href || ''); }
    })();
    const linkLines = wrapSvgText(publicLink, 19, 6);
    const ownerLines = wrapSvgText(owner, 24, 2);
    const responsibleLines = wrapSvgText(responsible, 22, 2);
    const registryLines = wrapSvgText(registry || footerText || '', 22, 2);
    const companyLines = wrapSvgText(companyName, 16, 3);

    const colorTicks = Array.from({ length: 5 }, (_, i) => {
      const t = i / 4;
      const y = colorbar.y + colorbar.h - colorbar.h * t;
      const v = minAlt + (maxAlt - minAlt) * t;
      return `<line x1="${colorbar.x + colorbar.w}" y1="${y}" x2="${colorbar.x + colorbar.w + 8}" y2="${y}" stroke="#111827"/><text x="${colorbar.x + colorbar.w + 12}" y="${y + 4}" font-size="11">${num(v, 0)}</text>`;
    }).join('');

    return `
<svg class="planialt-sheet-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa planialtimétrico técnico">
  <defs><clipPath id="${clipId}">${polygonPoints ? `<polygon points="${polygonPoints}"/>` : `<rect x="${map.x}" y="${map.y}" width="${map.w}" height="${map.h}"/>`}</clipPath><clipPath id="${mapClipId}"><rect x="${map.x}" y="${map.y}" width="${map.w}" height="${map.h}"/></clipPath></defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="10" y="10" width="880" height="1240" fill="none" stroke="#111827" stroke-width="4"/>
  <text x="450" y="46" text-anchor="middle" font-size="20" font-weight="900" letter-spacing=".5">PLANIALTIMÉTRICO DO IMÓVEL ${escapeHtml(title)}</text>
  <rect x="${map.x}" y="${map.y}" width="${map.w}" height="${map.h}" fill="#f8fafc" stroke="#111827" stroke-width="2"/>
  ${technicalMapBridge?.areaNameMarkup?.(perimeterFeature, projectGeo, map, visualSettings) || technicalMapBridge?.mapMetadata?.(map) || ''}
  ${gridLines.join('')}
  ${relief}
  ${polygonPoints ? `<polygon class="${polygonVisual.className}" ${polygonVisual.data} points="${polygonPoints}" fill="${polygonVisual.fill}" fill-opacity="${polygonVisual.fillOpacity}" stroke="${polygonVisual.stroke}" stroke-width="${(0.95*Number(polygonVisual.strokeWidth||1)).toFixed(3)}" stroke-dasharray="12 7"/>` : ''}
  ${contours}
  <g clip-path="url(#${mapClipId})">${pointMarkers}</g>
  ${technicalMapBridge?.coordinateTable?.(ring, map, visualSettings) || ''}
  ${confrontanteLabels}
  ${northArrow(map.x + 10, map.y + 14)}
  <rect x="${colorbar.x}" y="${colorbar.y}" width="${colorbar.w}" height="${colorbar.h}" fill="none" stroke="#111827" stroke-width="1.4"/>
  ${legendScale}${hasRelief ? colorTicks : ''}
  <text x="${colorbar.x + 82}" y="${colorbar.y + colorbar.h / 2}" text-anchor="middle" font-size="14" transform="rotate(-90 ${colorbar.x + 82} ${colorbar.y + colorbar.h / 2})">Altitude (metros)</text>
  <g transform="translate(25 885)">
    <rect width="850" height="285" fill="#ffffff" stroke="#111827" stroke-width="2.2"/>
    <line x1="300" y1="0" x2="300" y2="285" stroke="#111827" stroke-width="1.6"/>
    <line x1="700" y1="0" x2="700" y2="285" stroke="#111827" stroke-width="1.6"/>
    <line x1="0" y1="84" x2="300" y2="84" stroke="#111827" stroke-width="1.2"/>
    <line x1="300" y1="158" x2="700" y2="158" stroke="#111827" stroke-width="1.2"/>

    <text x="150" y="25" text-anchor="middle" font-size="13" font-weight="900">SISTEMA DE COORDENADAS</text>
    <text x="150" y="43" text-anchor="middle" font-size="13" font-weight="900">GEOGRÁFICAS</text>
    <text x="104" y="64" font-size="11.5" font-weight="800">Datum:</text>
    <text x="154" y="64" font-size="11.5">SIRGAS 2000</text>
    <text x="92" y="78" font-size="10.5" font-weight="800">Escala visual:</text>
    <text x="178" y="78" font-size="10.5">zoom 15</text>

    <g transform="translate(24 112)">
      <rect x="0" y="0" width="96" height="96" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      ${qrDataUrl ? `<image href="${escapeHtml(qrDataUrl)}" x="4" y="4" width="88" height="88" preserveAspectRatio="xMidYMid meet"/>` : tinyQr(4, 4, 88)}
      <text x="48" y="122" text-anchor="middle" font-size="9.5">Mapa público</text>
    </g>

    <text x="150" y="111" font-size="13" font-weight="900">LEGENDAS</text>
    <rect x="150" y="129" width="18" height="14" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="5 4"/>
    <text x="178" y="141" font-size="11">Perímetro</text>
    <rect x="150" y="152" width="18" height="14" fill="#cbd5e1" stroke="#64748b"/>
    <text x="178" y="164" font-size="11">Outros</text>
    <rect x="150" y="175" width="18" height="14" fill="#fecaca" stroke="#ef4444"/>
    <text x="178" y="187" font-size="11">APP</text>
    <rect x="150" y="198" width="18" height="14" fill="#fde68a" stroke="#f59e0b"/>
    <text x="178" y="210" font-size="11">Área produtiva</text>
    <rect x="150" y="221" width="18" height="14" fill="#bbf7d0" stroke="#16a34a"/>
    <text x="178" y="233" font-size="11">Reserva Legal</text>

    <text x="500" y="28" text-anchor="middle" font-size="16" font-weight="900">DADOS DO IMÓVEL</text>
    <text x="320" y="63" font-size="12.5" font-weight="900">Imóvel:</text>
    <text x="386" y="63" font-size="12.5">${escapeHtml(truncateSvgText(title, 32))}</text>
    <text x="320" y="89" font-size="12.5" font-weight="900">Matrícula:</text>
    <text x="402" y="89" font-size="12.5">${escapeHtml(truncateSvgText(project?.registrationNumber || 'Não informado', 29))}</text>
    <text x="320" y="115" font-size="12.5" font-weight="900">Município/UF:</text>
    <text x="426" y="115" font-size="12.5">${escapeHtml(truncateSvgText(city || 'Não informado', 28))}</text>
    <text x="320" y="144" font-size="12.5" font-weight="900">Área:</text>
    <text x="372" y="144" font-size="12.5">${num(area, 4)} ha</text>
    <text x="505" y="144" font-size="12.5" font-weight="900">Perímetro:</text>
    <text x="590" y="144" font-size="12.5">${num(per, 2)} m</text>

    <text x="320" y="194" font-size="12.5" font-weight="900">Proprietário(a):</text>
    ${svgTextBlock(ownerLines, 320, 216, { fontSize: 12.2, lineHeight: 13.8, fill: '#111827' })}
    <text x="510" y="194" font-size="12.2" font-weight="900">Responsável técnico(a):</text>
    ${svgTextBlock(responsibleLines, 510, 216, { fontSize: 11.8, lineHeight: 13.2, fill: '#111827' })}
    ${svgTextBlock(registryLines, 510, 244, { fontSize: 9.6, lineHeight: 10.8, fill: '#111827' })}
    <text x="320" y="268" font-size="12.5" font-weight="900">Data:</text>
    <text x="374" y="268" font-size="12.5">${today}</text>

    <rect x="745" y="36" width="58" height="58" rx="7" fill="#f8fafc" stroke="#e2e8f0"/>
    <image href="${escapeHtml(logo)}" x="750" y="41" width="48" height="48" preserveAspectRatio="xMidYMid meet"/>
    ${svgTextBlock(companyLines, 774, 120, { fontSize: 11, lineHeight: 11.6, fill: '#111827', weight: '900', anchor: 'middle' })}
    <text x="774" y="153" text-anchor="middle" font-size="9.2">Prancha técnica</text>
    <text x="774" y="167" text-anchor="middle" font-size="9.2">gerada digitalmente</text>
    <text x="714" y="202" font-size="10.2" font-weight="900">Link:</text>
    ${svgTextBlock(linkLines, 714, 214, { fontSize: 7.1, lineHeight: 9.8, fill: '#111827' })}
  </g>
  <text x="450" y="1224" text-anchor="middle" font-size="10" fill="#475569">${escapeHtml(altitudeNote)}</text>
</svg>`;
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function slug(value) {
    return String(value || 'planialtimetria')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'planialtimetria';
  }

  async function renderPlanialtimetria() {
    const project = await getSelectedProject();
    const mode = $('altitudeSource')?.value || 'auto';
    let points = parseElevationPoints();
    if (points.length < 3 && project) {
      points = extractProjectElevationPoints(project, mode);
      const field = $('elevationPoints');
      if (field && points.length >= 3) field.value = points.map((point) => Number.isFinite(point.alt) ? formatElevationLine(point) : `${point.name};${Number(point.lat).toFixed(8)};${Number(point.lng).toFixed(8)};`).join('\n');
    }
    if (points.length < 3) {
      toast('Selecione um projeto ou informe ao menos 3 pontos com latitude e longitude.', 'error');
      return;
    }

    points = await fillMissingAltitudesFromTerrain(points, project, mode);
    points = applyEstimatedReliefCorrection(points);

    const withAltitude = points.filter((p) => Number.isFinite(p.alt));
    const field = $('elevationPoints');
    if (field) field.value = points.map((point) => Number.isFinite(point.alt) ? formatElevationLine(point) : `${point.name};${Number(point.lat).toFixed(8)};${Number(point.lng).toFixed(8)};`).join('\n');

    if (withAltitude.length < 3) {
      const message = mode === 'file'
        ? 'Informe altitude real em pelo menos 3 pontos ou mude a fonte para DEM real do mapa.'
        : 'Não consegui carregar altitudes suficientes do DEM real. Verifique a internet, a fonte DEM ou informe cotas reais manualmente.';
      toast(message, 'error');
      return;
    }
    const ring = projectRing(project, points);
    lastRing = Array.isArray(ring) ? ring.map((coord) => Array.isArray(coord) ? [...coord] : coord) : [];
    if (ring.length < 4) {
      toast('Não encontrei perímetro válido. Selecione um projeto ou informe pontos do perímetro.', 'error');
      return;
    }
    const customization = window.SurveyorDocumentAssets?.loadCustomization
      ? await window.SurveyorDocumentAssets.loadCustomization({ forceRefresh: true })
      : (window.GeoRuralDocumentTheme?.get?.() || {});
    const logoData = window.SurveyorDocumentAssets?.resolveLogo
      ? await window.SurveyorDocumentAssets.resolveLogo(customization, { timeoutMs: 6000 })
      : (customization.logoDataUrl || '/assets/logo.png');
    let publicLink = project?.publicUrl || project?.shareUrl || '';
    let qrDataUrl = '';
    if (project?.id && window.SurveyorDocumentAssets?.publicProjectAccess) {
      const access = await window.SurveyorDocumentAssets.publicProjectAccess(project, { qrSize: 180 });
      publicLink = access?.url || publicLink;
      qrDataUrl = access?.qr || '';
    }
    if (!publicLink) {
      try { publicLink = new URL('/public-project/', window.location.origin).href; }
      catch (_error) { publicLink = String(window.location?.href || ''); }
    }
    if (!qrDataUrl) qrDataUrl = await makeQrDataUrl(publicLink);
    const svg = sheetSvg({ project, points, ring, qrDataUrl, publicLink, customization, logoData });
    lastSvg = svg;
    confrontanteEditor?.updateControls?.();
    lastHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Planialtimetria</title><style>body{margin:0;background:#eef2f7;display:grid;place-items:center;padding:24px;font-family:Arial,sans-serif}.planialt-sheet-svg{width:min(960px,100%);height:auto;background:#fff;box-shadow:0 20px 45px rgba(15,23,42,.18)}@media print{body{background:#fff;padding:0}.planialt-sheet-svg{width:100%;box-shadow:none}}</style></head><body>${svg}</body></html>`;
    const previewHost = $('elevationPreview');
    const previewHtml = `<div class="planialt-document-preview">${svg}</div>`;
    if (previewHost) {
      previewHost.hidden = false;
      previewHost.innerHTML = previewHtml;
      previewHost.classList.add('document-preview-visible','is-live-svg-preview');
    }
    const altitudes = withAltitude.map((p) => p.alt);
    $('elevCount').textContent = String(points.length);
    $('elevMin').textContent = altitudes.length ? `${num(Math.min(...altitudes), 2)} m` : '—';
    $('elevMax').textContent = altitudes.length ? `${num(Math.max(...altitudes), 2)} m` : '—';
    $('elevRange').textContent = altitudes.length ? `${num(Math.max(...altitudes) - Math.min(...altitudes), 2)} m` : '—';
    const hasDem = points.some((p) => p.source === 'dem');
    toast(hasDem ? 'Mapa planialtimétrico gerado com altitudes do DEM real do mapa.' : 'Mapa planialtimétrico atualizado com altitudes reais/informadas.', 'success');
  }


  async function populateProjectSelect() {
    const select = $('projectSelect');
    if (!select || !window.GeoRuralProjects?.list) return;
    try {
      const projects = await window.GeoRuralProjects.list({ full: false, refresh: true });
      const current = select.value;
      select.innerHTML = '<option value="">Selecione um projeto</option>' + (projects || []).map((project) => {
        const id = project.id || project.projectId || project.uuid || '';
        const label = project.propertyName || project.title || project.name || 'Projeto sem nome';
        const city = [project.municipality || project.city, project.stateCode || project.uf].filter(Boolean).join('/');
        return `<option value="${escapeHtml(id)}">${escapeHtml(label)}${city ? ` — ${escapeHtml(city)}` : ''}</option>`;
      }).join('');
      if (current) select.value = current;
    } catch (error) {
      console.warn('Não foi possível listar projetos na planialtimetria:', error);
    }
  }

  async function loadSelectedProjectAltitudes() {
    const project = await getSelectedProject();
    if (!project) return;
    const mode = $('altitudeSource')?.value || 'auto';
    let points = extractProjectElevationPoints(project, mode);
    points = await fillMissingAltitudesFromTerrain(points, project, mode);
    points = applyEstimatedReliefCorrection(points);
    if (points.length < 3) return;
    const field = $('elevationPoints');
    if (field) field.value = points.map((point) => Number.isFinite(point.alt) ? formatElevationLine(point) : `${point.name};${Number(point.lat).toFixed(8)};${Number(point.lng).toFixed(8)};`).join('\n');
    const titleInput = $('idwLat');
    const lngInput = $('idwLng');
    const ring = projectRing(project, points);
    if (ring.length >= 4 && titleInput && lngInput) {
      const center = ring.slice(0, -1).reduce((acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]], [0, 0]).map((v) => v / (ring.length - 1));
      titleInput.value = center[1].toFixed(8);
      lngInput.value = center[0].toFixed(8);
    }
    const hasDem = points.some((point) => point.source === 'dem');
    toast(hasDem ? `Vértices e altitudes DEM carregados para ${projectTitle(project)}.` : `Vértices e altitudes carregados para ${projectTitle(project)}.`, 'success');
  }

  function injectAltitudeControls() {
    if ($('altitudeSource')) return;
    const grid = $('projectSelect')?.closest('.form-grid');
    if (!grid) return;
    const label = document.createElement('label');
    label.innerHTML = 'Fonte das altitudes<select id="altitudeSource"><option value="auto" selected>Automático: cotas do arquivo/manual ou DEM real do mapa</option><option value="file">Somente cotas reais do arquivo/manual</option><option value="demo">Modo demonstração visual (não técnico)</option></select>';
    const correction = document.createElement('label');
    correction.innerHTML = 'Correção do modo demonstração<select id="reliefCorrection"><option value="auto" selected>Automático</option><option value="invert">Inverter alto/baixo demonstrativo</option></select>';
    grid.appendChild(correction);
    grid.appendChild(label);
    const load = document.createElement('button');
    load.type = 'button';
    load.id = 'loadProjectAltitudes';
    load.className = 'btn';
    load.textContent = 'Carregar vértices + altitudes';
    load.onclick = loadSelectedProjectAltitudes;
    grid.appendChild(load);
    $('altitudeSource')?.addEventListener('change', loadSelectedProjectAltitudes);
    $('reliefCorrection')?.addEventListener('change', loadSelectedProjectAltitudes);
  }

  function ensureButtons() {
    injectAltitudeControls();
    const analyze = $('analyzeElevation');
    if (!analyze) return;
    analyze.textContent = 'Gerar planialtimétrico';
    analyze.onclick = renderPlanialtimetria;
    $('printFormat')?.addEventListener('change', () => {
      if (lastSvg) renderPlanialtimetria();
    });

    const print = $('printPreview');
    if (print) {
      print.textContent = 'Imprimir / PDF técnico';
      print.onclick = () => {
        const state = window.SurveyorPdfPreview?.getState?.('elevationPreview');
        if (state?.url) {
          const win = window.open(state.url, '_blank', 'noopener,noreferrer');
          if (!win) return toast('O navegador bloqueou a janela do PDF.', 'error');
          return;
        }
        if (!lastHtml) return toast('Gere o planialtimétrico primeiro.', 'error');
        const win = window.open('', '_blank');
        if (!win) return toast('O navegador bloqueou a janela de impressão.', 'error');
        win.addEventListener('load', () => setTimeout(() => win.print(), 350), { once: true });
        win.document.open();
        win.document.write(lastHtml);
        win.document.close();
      };
    }

    const row = analyze.closest('.button-row');
    const planialtPage = document.body?.dataset?.page === 'planialtimetria.html';
    if (row && !$('downloadPlanialtSvg')) {
      const svgButton = document.createElement('button');
      svgButton.type = 'button';
      svgButton.id = 'downloadPlanialtSvg';
      svgButton.className = 'btn';
      svgButton.textContent = 'Baixar SVG técnico';
      svgButton.onclick = () => {
        if (!lastSvg) return toast('Gere o planialtimétrico primeiro.', 'error');
        download('planialtimetrico-tecnico.svg', lastSvg, 'image/svg+xml;charset=utf-8');
      };
      row.appendChild(svgButton);
    }

    const select = $('projectSelect');
    if (select && select.dataset.planialtBound !== '1') {
      select.dataset.planialtBound = '1';
      select.addEventListener('change', () => {
        loadAndRenderSelectedProject().catch((error)=>console.error('[Surveyor] Falha ao preparar planialtimetria ao vivo:',error));
      });
    }

    const calc = $('calculateIdw');
    if (calc && calc.dataset.planialtBound !== '1') {
      calc.dataset.planialtBound = '1';
      calc.onclick = () => {
        const points = parseElevationPoints().filter((p) => Number.isFinite(p.alt));
        const lat = parsePtValue($('idwLat')?.value);
        const lng = parsePtValue($('idwLng')?.value);
        const power = Math.max(1, Math.min(5, parsePtValue($('idwPower')?.value) || 2));
        if (points.length < 3 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          $('idwOutput').textContent = 'Informe pontos com altitude e uma coordenada válida.';
          return;
        }
        const value = idwValue(lng, lat, points, power);
        $('idwOutput').textContent = Number.isFinite(value) ? `Altitude estimada por IDW: ${num(value, 2)} m` : 'Não foi possível calcular.';
      };
    }
  }

  function injectIntro() {
    const panel = $('elevationPreview')?.closest('.panel');
    if (!panel || panel.dataset.planialtEnhanced === '1') return;
    panel.dataset.planialtEnhanced = '1';
    const desc = panel.querySelector('.panel-desc');
    if (desc) {
      desc.innerHTML = 'Selecione um projeto salvo e informe as altitudes no formato <b>nome;latitude;longitude;altitude</b>. O sistema gera uma prancha técnica com grade cartográfica, perímetro, faixas coloridas de altitude, curvas de nível, legenda, QR Code e carimbo do imóvel.';
    }
  }

  function relocateWorkspaceTools() {
    if (document.body?.dataset?.page !== 'planialtimetria.html') return;
    const finalSection = document.querySelector('.sv-doc-config-card .sv-step-section-final');
    const previewCard = document.querySelector('.sv-doc-preview-card');
    if (!finalSection || !previewCard) return;
    const footer = finalSection.querySelector('.sv-step-footer-final');
    if (!footer) return;

    let utilities = finalSection.querySelector('.sv-planialt-utility-zone');
    if (!utilities) {
      utilities = document.createElement('div');
      utilities.className = 'sv-planialt-utility-zone';
      utilities.innerHTML = [
        '<h4>Resumo, downloads e ferramentas</h4>',
        '<div class="sv-planialt-stats-host"></div>',
        '<div class="sv-planialt-utility-host"></div>',
        '<div class="sv-planialt-data-host"></div>'
      ].join('');
      finalSection.insertBefore(utilities, footer);
    }

    const statsHost = utilities.querySelector('.sv-planialt-stats-host');
    const host = utilities.querySelector('.sv-planialt-utility-host');
    const dataHost = utilities.querySelector('.sv-planialt-data-host');
    const summary = previewCard.querySelector('.summary') || document.querySelector('.summary');
    const exportRow = previewCard.querySelector('.gr-export-row') || document.querySelector('.gr-export-row');
    const idwOutput = previewCard.querySelector('#idwOutput') || document.querySelector('#idwOutput');
    const tableWrap = previewCard.querySelector('.table-wrap') || document.querySelector('.table-wrap');

    if (statsHost && summary && statsHost !== summary.parentElement) statsHost.appendChild(summary);
    if (host && exportRow && host !== exportRow.parentElement) host.appendChild(exportRow);
    if (dataHost && idwOutput && dataHost !== idwOutput.parentElement) dataHost.appendChild(idwOutput);
    if (dataHost && tableWrap && dataHost !== tableWrap.parentElement) dataHost.appendChild(tableWrap);
    previewCard.classList.toggle('sv-planialt-preview-only', true);

    footer.querySelector('#printPreview')?.remove();
    footer.querySelector('#downloadPlanialtSvg')?.remove();

    const buttonRow = footer.querySelector('.sv-step-actions-main .button-row');
    if (buttonRow) buttonRow.classList.add('sv-planialt-action-row');
    const sideNav = footer.querySelector('.sv-step-actions-side .sv-step-nav');
    if (sideNav) sideNav.classList.add('sv-planialt-back-nav');
  }

  function installWorkspaceTweaks() {
    relocateWorkspaceTools();
    const target = document.querySelector('.sv-doc-workspace') || document.body;
    if (!target || target.dataset.planialtWorkspaceObserved === '1') return;
    target.dataset.planialtWorkspaceObserved = '1';
    const observer = new MutationObserver(() => relocateWorkspaceTools());
    observer.observe(target, { childList: true, subtree: true });
    window.setTimeout(relocateWorkspaceTools, 60);
    window.setTimeout(relocateWorkspaceTools, 240);
    window.setTimeout(relocateWorkspaceTools, 600);
  }

  async function startPlanialtimetriaPersonalization(workspace) {
    if (!workspace || !confrontanteEditor) return false;
    if (!lastSvg) {
      try { await renderPlanialtimetria(); }
      catch (error) {
        console.warn('[Surveyor] Personalização planialtimétrica aguardando uma análise válida:', error);
        return false;
      }
    }
    if (!lastSvg) return false;
    const started = await confrontanteEditor.start?.({ mode:'inline', mount:workspace });
    if (started !== false) {
      requestAnimationFrame(() => confrontanteEditor?.fitToViewport?.());
      return true;
    }
    return false;
  }

  function suspendPlanialtimetriaPersonalization() {
    confrontanteEditor?.setVisible?.(false);
  }

  function installPersonalizationFlow() {
    window.addEventListener('surveyor:document-step-change', (event) => {
      if (event.detail?.page !== 'planialtimetria.html') return;
      if (event.detail?.title === 'Personalização') startPlanialtimetriaPersonalization(event.detail.workspace);
      else suspendPlanialtimetriaPersonalization();
    });
    window.addEventListener('surveyor:open-beta-personalization', (event) => {
      if (event.detail?.page === 'planialtimetria.html') startPlanialtimetriaPersonalization(event.detail.workspace);
    });
  }

  function init() {
    ensureButtons();
    confrontanteEditor = window.SurveyorTechnicalDocumentEditor?.create?.({
      getSvg: () => lastSvg,
      projectId: () => $('projectSelect')?.value || 'sem-projeto',
      page: () => 'planialtimetria.html',
      layoutId: () => `planialtimetria-${$('printFormat')?.value || 'a4'}`,
      anchor: () => $('analyzeElevation'),
      regenerate: () => renderPlanialtimetria(),
      standaloneControls: false,
      getCoordinateRows: () => {
        const ring = Array.isArray(lastRing) ? lastRing : [];
        const clean = ring.length > 1 && Number(ring[0]?.[0]) === Number(ring.at(-1)?.[0]) && Number(ring[0]?.[1]) === Number(ring.at(-1)?.[1]) ? ring.slice(0,-1) : ring;
        return clean.map((coord,index) => ({ label:`V-${String(index + 1).padStart(2,'0')}`, lng:Number(coord?.[0]), lat:Number(coord?.[1]) })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
      },
      toast
    }) || null;
    confrontanteEditor?.ensureControls?.();
    installPersonalizationFlow();
    injectIntro();
    installWorkspaceTweaks();
    populateProjectSelect().then(() => {
      const activate=()=>{const select=$('projectSelect');if(select?.value&&!lastSvg)loadAndRenderSelectedProject().catch((error)=>console.warn('[Surveyor] Prévia planialtimétrica inicial aguardando dados válidos:',error));};
      [0,160,500,1200].forEach((delay)=>window.setTimeout(activate,delay));
    });
    window.GeoRuralPlanialtimetria = { render: renderPlanialtimetria, load: loadSelectedProjectAltitudes, getLastSvg: () => lastSvg, getLastHtml: () => lastHtml };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
