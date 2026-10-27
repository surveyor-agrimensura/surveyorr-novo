(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let azimuthGeojson = null;
  let loadedProject = null;
  let projectCache = [];
  let lastAzimuthSvg = '';
  let lastAzimuthReportHtml = '';
  let confrontanteEditor = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  const documentConfrontantes = window.SurveyorDocumentConfrontantes?.create?.({ escape: escapeHtml }) || null;
  const technicalMapBridge = window.SurveyorTechnicalMapBridge || null;

  function num(value, digits = 2) {
    return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }


  function isAzimuthProject(project) {
    const module = String(project?.metadata?.module || '').toLowerCase();
    return module.includes('azimuth') || module.includes('azimute');
  }

  function projectTitle(project) {
    return project?.propertyName || project?.title || project?.name || 'Projeto sem nome';
  }

  function appendProjectOption(project) {
    const select = $('projectSelect');
    if (!select || !project?.id || isAzimuthProject(project)) return;
    const title = projectTitle(project);
    const city = project.city || project.municipality || '';
    const uf = project.uf || project.stateCode || '';
    if (![...select.options].some((option) => option.value === project.id)) {
      select.add(new Option(`${title}${city ? ` — ${city}/${uf}` : ''}`, project.id));
    }
  }

  async function loadProjectOptions() {
    if (!window.GeoRuralProjects?.list || !$('projectSelect')) return;
    try {
      projectCache = await window.GeoRuralProjects.list({ full: true, refresh: true });
      projectCache.filter((project) => !isAzimuthProject(project)).forEach(appendProjectOption);
      const requested = new URLSearchParams(location.search).get('project');
      if (requested && [...$('projectSelect').options].some((option) => option.value === requested)) $('projectSelect').value = requested;
      if ($('projectSelect').value) await loadSelectedProject({ renderNow: true });
    } catch (error) {
      console.warn('Não foi possível carregar projetos para perímetros por azimute:', error);
    }
  }

  async function resolveProject(id) {
    if (!id) return null;
    let project = projectCache.find((item) => item.id === id);
    try {
      if ((!project || !project?.geojson?.features?.length) && window.GeoRuralProjects?.get) project = await window.GeoRuralProjects.get(id, true);
    } catch (error) {
      console.warn('Falha ao carregar projeto completo:', error);
    }
    if (project) {
      const index = projectCache.findIndex((item) => item.id === project.id);
      if (index >= 0) projectCache[index] = project;
      else projectCache.push(project);
    }

    if (isAzimuthProject(project)) {
      const sourceId = project?.metadata?.sourceProjectId;
      if (sourceId && sourceId !== project.id) {
        const sourceProject = await resolveProject(sourceId);
        if (sourceProject) return sourceProject;
      }
      const sameTitle = projectCache.find((candidate) => candidate.id !== project.id && !isAzimuthProject(candidate)
        && projectTitle(candidate).trim().toLowerCase() === projectTitle(project).trim().toLowerCase());
      if (sameTitle) {
        const resolved = sameTitle.geojson?.features?.length ? sameTitle : await window.GeoRuralProjects.get(sameTitle.id, true).catch(() => sameTitle);
        if (resolved) return resolved;
      }
      throw new Error('Este item foi gerado pelo módulo de azimutes e não contém o desenho original do mapa. Selecione o projeto original salvo em “Mapa e cadastro”.');
    }

    if (project) appendProjectOption(project);
    return globalThis.SurveyorDocumentScope?.apply?.(project) || project || null;
  }

  function hav(a, b) {
    const R = 6371008.8;
    const rad = (x) => x * Math.PI / 180;
    const dlat = rad(b[1] - a[1]);
    const dlon = rad(b[0] - a[0]);
    const x = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function areaHa(feature) {
    try { return (window.turf?.area(feature) || 0) / 10000; } catch { return 0; }
  }


  function svgTechnicalLabel(x, y, text, opts = {}) {
    const label = String(text || '');
    const fontSize = Number(opts.fontSize || 5.4);
    const textColor = opts.textColor || '#111827';
    const weight = Number(opts.fontWeight || 650);
    const anchor = opts.anchor === 'middle' ? 'middle' : 'start';
    const halo = Number(opts.halo ?? 0.72);
    return `<text class="sv-technical-label" x="${x}" y="${y}" ${anchor === 'middle' ? 'text-anchor="middle" ' : ''}font-size="${fontSize}" font-weight="${weight}" fill="${textColor}" stroke="#ffffff" stroke-width="${halo}" stroke-linejoin="round" paint-order="stroke fill">${escapeHtml(label)}</text>`;
  }




  function smartVertexMarks(coords, project, mapBox, options = {}) {
    const vertices = (coords || []).slice(0, -1).map((coord, index) => {
      const [x, y] = project(coord);
      return { x, y, index };
    });
    if (!vertices.length) return '';

    const count = vertices.length;
    const dense = count > 36;
    const veryDense = count > 70;
    const cx = vertices.reduce((sum, point) => sum + point.x, 0) / count;
    const cy = vertices.reduce((sum, point) => sum + point.y, 0) / count;
    const fontSize = Number(options.fontSize || (veryDense ? 3.75 : dense ? 4.15 : 5.1));
    const pointRadius = Number(options.pointRadius || (veryDense ? 1.45 : dense ? 1.7 : 2.25));
    const pointFill = options.pointFill || '#dc2626';
    const edgePadding = Number(options.edgePadding || 4);
    const labelOffset = Number(options.offset || (veryDense ? 6.2 : dense ? 7.2 : 10));
    const clearGap = Number(options.clearGap || (dense ? 1.2 : 1.8));
    const maxLabels = Number(options.maxLabels || (veryDense ? 16 : dense ? 22 : count));
    const minLabelDistance = Number(options.minLabelDistance || (veryDense ? 24 : dense ? 20 : 11));
    const parts = [];
    const occupied = [];
    const labelledPoints = [];
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const overlaps = (a, b, gap = clearGap) => !(a.x2 + gap < b.x1 || a.x1 - gap > b.x2 || a.y2 + gap < b.y1 || a.y1 - gap > b.y2);

    // Todos os vértices continuam visíveis, mas pontos densos usam marcadores menores.
    vertices.forEach((point) => {
      parts.push(`<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${pointRadius}" fill="${pointFill}" stroke="#fff" stroke-width="${dense ? 0.55 : 0.75}"/>`);
    });

    const turnAngle = (index) => {
      const prev = vertices[(index - 1 + count) % count];
      const cur = vertices[index];
      const next = vertices[(index + 1) % count];
      const a1 = Math.atan2(prev.y - cur.y, prev.x - cur.x);
      const a2 = Math.atan2(next.y - cur.y, next.x - cur.x);
      let delta = Math.abs(a2 - a1);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      return Math.abs(Math.PI - delta) * 180 / Math.PI;
    };

    // Em perímetros com muitos vértices, rotular todos torna a planta ilegível.
    // Mantemos cantos relevantes e uma amostragem uniforme. A tabela continua com todos.
    const selected = new Set();
    const addIfSpaced = (index, force = false) => {
      if (selected.size >= maxLabels || selected.has(index)) return false;
      const point = vertices[index];
      if (!force && labelledPoints.some((used) => Math.hypot(used.x - point.x, used.y - point.y) < minLabelDistance)) return false;
      selected.add(index);
      labelledPoints.push(point);
      return true;
    };

    addIfSpaced(0, true);
    if (count > 1) addIfSpaced(count - 1, true);

    if (!dense) {
      for (let i = 1; i < count - 1; i += 1) addIfSpaced(i, true);
    } else {
      const cornerCandidates = vertices
        .map((_, index) => ({ index, turn: turnAngle(index) }))
        .filter((item) => item.index !== 0 && item.index !== count - 1 && item.turn >= (veryDense ? 18 : 14))
        .sort((a, b) => b.turn - a.turn);
      cornerCandidates.forEach((item) => addIfSpaced(item.index));

      const step = Math.max(2, Math.ceil(count / Math.max(8, maxLabels - selected.size)));
      for (let i = 1; i < count - 1 && selected.size < maxLabels; i += step) addIfSpaced(i);
    }

    [...selected].sort((a, b) => a - b).forEach((index) => {
      const point = vertices[index];
      const prev = vertices[(index - 1 + count) % count];
      const next = vertices[(index + 1) % count];
      const label = `V-${String(point.index + 1).padStart(2, '0')}`;

      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const tangentLength = Math.hypot(tx, ty) || 1;
      tx /= tangentLength; ty /= tangentLength;
      let nx = -ty; let ny = tx;
      const d1 = Math.hypot(point.x + nx * 8 - cx, point.y + ny * 8 - cy);
      const d2 = Math.hypot(point.x - nx * 8 - cx, point.y - ny * 8 - cy);
      if (d2 > d1) { nx *= -1; ny *= -1; }

      const rectW = Math.max(fontSize * 3.2, label.length * fontSize * 0.57 + 2.2);
      const rectH = fontSize + 2.1;
      const candidates = [
        [labelOffset, 0], [labelOffset + 3, 0], [labelOffset + 5, 3], [labelOffset + 5, -3],
        [labelOffset + 8, 0], [labelOffset + 8, 5], [labelOffset + 8, -5]
      ];
      let best = null;

      for (const [radial, tangent] of candidates) {
        let lx = point.x + nx * radial + tx * tangent;
        let ly = point.y + ny * radial + ty * tangent;
        lx = clamp(lx, mapBox.x + rectW / 2 + edgePadding, mapBox.x + mapBox.w - rectW / 2 - edgePadding);
        ly = clamp(ly, mapBox.y + rectH / 2 + edgePadding, mapBox.y + mapBox.h - rectH / 2 - edgePadding);
        const rect = { x1: lx - rectW / 2, y1: ly - rectH / 2, x2: lx + rectW / 2, y2: ly + rectH / 2 };
        const collisionCount = occupied.reduce((sum, used) => sum + (overlaps(rect, used) ? 1 : 0), 0);
        const score = collisionCount * 1000 + radial + Math.abs(tangent) * 0.6;
        if (!best || score < best.score) best = { x: lx, y: ly, rect, score, collisionCount };
        if (collisionCount === 0) break;
      }

      if (!best) return;
      if (dense && best.collisionCount > 0) return;
      occupied.push(best.rect);

      if (!dense) {
        const guideEndX = point.x + nx * Math.max(2.5, labelOffset - 2.2);
        const guideEndY = point.y + ny * Math.max(2.5, labelOffset - 2.2);
        parts.push(`<line x1="${point.x.toFixed(2)}" y1="${point.y.toFixed(2)}" x2="${guideEndX.toFixed(2)}" y2="${guideEndY.toFixed(2)}" stroke="#334155" stroke-width="0.7" opacity="0.42"/>`);
      }

      const vertexVisual = technicalMapBridge?.vertexVisual?.(label, options.settings || {}, fontSize) || { dx:0, dy:0, fontSize, attrs:'class="sv-technical-label sv-vertex-label"' };
      parts.push(`<text ${vertexVisual.attrs} x="${best.x.toFixed(2)}" y="${(best.y + fontSize * 0.34).toFixed(2)}" text-anchor="middle" font-size="${Number(vertexVisual.fontSize || fontSize).toFixed(2)}" font-weight="700" fill="#111827" stroke="#ffffff" stroke-width="${dense ? 0.46 : 0.58}" stroke-linejoin="round" paint-order="stroke fill">${escapeHtml(label)}</text>`);
    });

    return parts.join('');
  }

  function findPerimeterFeature(project) {
    return globalThis.SurveyorProjectGeometry?.resolvePerimeter?.(project)
      || (project?.geojson?.features || []).filter((feature) => /Polygon/.test(feature?.geometry?.type || '')).sort((a,b)=>(globalThis.turf?.area?.(b)||0)-(globalThis.turf?.area?.(a)||0))[0]
      || null;
  }

  function ringCoords(feature) {
    const geometry = feature?.geometry || {};
    if (geometry.type === 'Polygon') return geometry.coordinates?.[0] || [];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0] || [];
    return [];
  }

  function destination(lat, lng, az, dist) {
    const R = 6371008.8;
    const d = dist / R;
    const t = az * Math.PI / 180;
    const p1 = lat * Math.PI / 180;
    const l1 = lng * Math.PI / 180;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
    const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [p2 * 180 / Math.PI, ((l2 * 180 / Math.PI + 540) % 360) - 180];
  }


  function bearingDegrees(a, b) {
    const rad = (value) => value * Math.PI / 180;
    const deg = (value) => value * 180 / Math.PI;
    const lon1 = rad(Number(a?.[0] || 0));
    const lon2 = rad(Number(b?.[0] || 0));
    const lat1 = rad(Number(a?.[1] || 0));
    const lat2 = rad(Number(b?.[1] || 0));
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }

  function bounds(coords) {
    const xs = coords.map((c) => c[0]);
    const ys = coords.map((c) => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const zoom = Number(document.getElementById('azimuthMapZoom')?.value || 15);
    // Margem técnica moderada: a versão anterior aplicava quase 40% no zoom 15,
    // encolhendo imóveis estreitos e deixando os rótulos amontoados no centro.
    const factor = Math.max(0.04, Math.min(0.18, (20 - zoom) / 32));
    const padX = Math.max((maxX - minX) * factor, 0.00008);
    const padY = Math.max((maxY - minY) * factor, 0.00008);
    return [minX - padX, minY - padY, maxX + padX, maxY + padY];
  }

  function projector(bbox, box) {
    const [minX, minY, maxX, maxY] = bbox;
    const sx = box.w / Math.max(maxX - minX, 1e-9);
    const sy = box.h / Math.max(maxY - minY, 1e-9);
    const s = Math.min(sx, sy);
    const usedW = (maxX - minX) * s;
    const usedH = (maxY - minY) * s;
    const ox = box.x + (box.w - usedW) / 2;
    const oy = box.y + (box.h - usedH) / 2;
    return ([x, y]) => [ox + (x - minX) * s, oy + usedH - (y - minY) * s];
  }

  function boundsWithAspect(bbox, width, height, extraPad = 0.12) {
    const [minX, minY, maxX, maxY] = bbox;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let boxW = Math.max((maxX - minX) * (1 + extraPad), 1e-9);
    let boxH = Math.max((maxY - minY) * (1 + extraPad), 1e-9);
    const target = Math.max(width, 1) / Math.max(height, 1);
    const current = boxW / boxH;
    if (current > target) boxH = boxW / target;
    else boxW = boxH * target;
    return [cx - boxW / 2, cy - boxH / 2, cx + boxW / 2, cy + boxH / 2];
  }

  function toWebMercator(coord) {
    const [lng, latRaw] = coord;
    const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(latRaw || 0)));
    const x = 6378137 * Number(lng || 0) * Math.PI / 180;
    const y = 6378137 * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 360)));
    return [x, y];
  }

  function mercatorBounds(coords, width, height, extraPad = 0.12) {
    const points = (coords || []).map((coord) => toWebMercator(coord));
    const xs = points.map((c) => c[0]);
    const ys = points.map((c) => c[1]);
    return boundsWithAspect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], width, height, extraPad);
  }


  function lonLatToTilePixel(coord, zoom) {
    const [lng, latRaw] = coord;
    const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(latRaw || 0)));
    const scale = 256 * (2 ** zoom);
    const sin = Math.sin(lat * Math.PI / 180);
    return [
      ((Number(lng || 0) + 180) / 360) * scale,
      (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    ];
  }

  function pixelBoundsWithAspect(coords, width, height, zoom, extraPad = 0.16) {
    const points = (coords || []).map((coord) => lonLatToTilePixel(coord, zoom));
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let spanX = Math.max((maxX - minX) * (1 + extraPad), 96);
    let spanY = Math.max((maxY - minY) * (1 + extraPad), 64);
    const target = Math.max(width, 1) / Math.max(height, 1);
    const current = spanX / spanY;
    if (current > target) spanY = spanX / target;
    else spanX = spanY * target;
    return [cx - spanX / 2, cy - spanY / 2, cx + spanX / 2, cy + spanY / 2];
  }

  function tilePixelProjector(pixelBounds, box, zoom) {
    const [minX, minY, maxX, maxY] = pixelBounds;
    const spanX = Math.max(1e-9, maxX - minX);
    const spanY = Math.max(1e-9, maxY - minY);
    return (coord) => {
      const [px, py] = lonLatToTilePixel(coord, zoom);
      return [box.x + ((px - minX) / spanX) * box.w, box.y + ((py - minY) / spanY) * box.h];
    };
  }

  function satelliteTilesSvg(pixelBounds, box, zoom, clipId) {
    const [minX, minY, maxX, maxY] = pixelBounds;
    const spanX = Math.max(1e-9, maxX - minX);
    const spanY = Math.max(1e-9, maxY - minY);
    const minTileX = Math.floor(minX / 256);
    const maxTileX = Math.floor(maxX / 256);
    const minTileY = Math.floor(minY / 256);
    const maxTileY = Math.floor(maxY / 256);
    const maxIndex = (2 ** zoom) - 1;
    const tiles = [];
    for (let ty = Math.max(0, minTileY); ty <= Math.min(maxIndex, maxTileY); ty += 1) {
      for (let tx = minTileX; tx <= maxTileX; tx += 1) {
        const wrappedX = ((tx % (maxIndex + 1)) + (maxIndex + 1)) % (maxIndex + 1);
        const x = box.x + (((tx * 256) - minX) / spanX) * box.w;
        const y = box.y + (((ty * 256) - minY) / spanY) * box.h;
        const w = (256 / spanX) * box.w;
        const h = (256 / spanY) * box.h;
        tiles.push(`<image href="https://mt1.google.com/vt/lyrs=s&amp;x=${wrappedX}&amp;y=${ty}&amp;z=${zoom}" x="${x}" y="${y}" width="${w + 0.6}" height="${h + 0.6}" preserveAspectRatio="none" clip-path="url(#${clipId})"/>`);
      }
    }
    return tiles.join('');
  }

  function northArrow(x, y, scale = 1) {
    return `<g transform="translate(${x},${y}) scale(${scale})">
      <circle cx="0" cy="0" r="31" fill="none" stroke="#111827" stroke-width="1.6"/>
      <circle cx="0" cy="0" r="27.4" fill="none" stroke="#111827" stroke-width="1.1"/>
      <polygon points="0,-29 4.3,-10.8 0,0 -4.3,-10.8" fill="#111827"/>
      <polygon points="29,0 10.8,4.3 0,0 10.8,-4.3" fill="#111827"/>
      <polygon points="0,29 4.3,10.8 0,0 -4.3,10.8" fill="#111827"/>
      <polygon points="-29,0 -10.8,4.3 0,0 -10.8,-4.3" fill="#111827"/>
      <polygon points="0,-18.8 8.1,-8.1 0,0 -8.1,-8.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="18.8,0 8.1,8.1 0,0 8.1,-8.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="0,18.8 8.1,8.1 0,0 -8.1,8.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="-18.8,0 -8.1,8.1 0,0 -8.1,-8.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <text x="0" y="-43" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">N</text>
      <text x="43" y="5" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">E</text>
      <text x="0" y="50" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">S</text>
      <text x="-43" y="5" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">W</text>
    </g>`;
  }

  function grid(box) {
    return Array.from({ length: 7 }).map((_, i) => {
      const x = box.x + i * box.w / 6;
      return `<line x1="${x}" y1="${box.y}" x2="${x}" y2="${box.y + box.h}" stroke="#e5e7eb"/>`;
    }).join('') + Array.from({ length: 6 }).map((_, i) => {
      const y = box.y + i * box.h / 5;
      return `<line x1="${box.x}" y1="${y}" x2="${box.x + box.w}" y2="${y}" stroke="#e5e7eb"/>`;
    }).join('');
  }

  function svgTextBlock(text, x, y, options = {}) {
    const maxChars = Number(options.maxChars || 32);
    const maxLines = Number(options.maxLines || 2);
    const size = Number(options.size || 12);
    const lineHeight = Number(options.lineHeight || size + 3);
    const weight = options.weight ? ` font-weight="${escapeHtml(options.weight)}"` : '';
    const anchor = options.anchor ? ` text-anchor="${escapeHtml(options.anchor)}"` : '';
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else current = next;
    });
    if (current) lines.push(current);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) visible[visible.length - 1] = `${visible[visible.length - 1].replace(/\s+$/,'')}...`;
    return visible.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" font-size="${size}"${weight}${anchor}>${escapeHtml(line)}</text>`).join('');
  }

  function azimuthSheet(fc, records, meta = {}) {
    const feature = fc.features[0];
    const coords = feature.geometry.coordinates[0];
    const drawingCoords = coords.slice(0, -1);
    const W = 1200, H = 900;
    const frame = { x: 34, y: 28, w: 1132, h: 836 };
    const mapBox = { x: 58, y: 82, w: 1084, h: 520 };
    const footerBox = { x: 58, y: 620, w: 1084, h: 218 };
    const mapBounds = boundsWithAspect(bounds(drawingCoords), mapBox.w, mapBox.h, 0.08);
    const project = projector(mapBounds, mapBox);
    const sourceFeature = technicalMapBridge?.perimeterFeature?.(loadedProject) || feature;
    const visualSettings = technicalMapBridge?.readSettings?.(loadedProject || { id:$('projectSelect')?.value || 'manual', geojson:fc }, confrontanteEditor, $('projectSelect')?.value || loadedProject?.id || 'manual') || {};
    const polygonVisual = technicalMapBridge?.polygonAttributes?.(sourceFeature, visualSettings, { color:'#dc2626', opacity:.12, category:'perimetro', perimeter:true, name:feature.properties?.name || 'Perímetro por azimute' }) || { className:'sv-document-editable-polygon sv-document-perimeter-fill', data:'data-polygon-key="perimetro:principal" data-polygon-name="Perímetro" data-polygon-category="perimetro" data-polygon-color="#dc2626"', fill:'#dc2626', stroke:'#dc2626', fillOpacity:.12 };
    const points = drawingCoords.map((coord) => project(coord).join(',')).join(' ');
    const area = areaHa(feature);
    const total = records.reduce((sum, item) => sum + item.dist, 0);
    const areaTitleRaw = meta.title || feature.properties?.name || 'Perímetro por azimute';
    const areaTitle = escapeHtml(areaTitleRaw);
    const owner = meta.owner || 'Não informado';
    const technician = meta.technician || meta.customization?.responsibleTechnician || window.GeoRuralDocumentTheme?.get?.()?.responsibleTechnician || 'Não informado';
    const cityUf = [meta.city || meta.municipality, meta.uf || meta.stateCode].filter(Boolean).join('/') || 'Não informado';
    const date = new Date().toLocaleDateString('pt-BR');
    const logoData = meta.logoData || meta.customization?.logoDataUrl || window.GeoRuralDocumentTheme?.get?.()?.logoDataUrl || '/assets/logo.png';
    const leftW = 360;
    const midW = 475;
    const rightX = footerBox.x + leftW + midW;
    const rightW = footerBox.w - leftW - midW;
    const gridPattern = `<defs>
      <pattern id="azCleanGrid" width="58" height="58" patternUnits="userSpaceOnUse"><path d="M58 0H0V58" fill="none" stroke="#e2e8f0" stroke-width="1"/></pattern>
      <clipPath id="azCleanMapClip"><rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}"/></clipPath>
    </defs>`;
    const vertexMarks = smartVertexMarks(coords, project, mapBox, { pointFill: '#dc2626', edgePadding: 6, settings: visualSettings });
    const confrontanteLabels = documentConfrontantes
      ? documentConfrontantes.smartConfrontanteLabels(feature, coords, project, mapBox, {
          fontSize: 11.2, offset: 32, maxOffset: 96, edgePadding: 8, maxChars: 26,
          manualOffsets: (confrontanteEditor?.readProjectSegments?.() || []).length ? {} : (confrontanteEditor?.readOffsets?.() || {}),
          segmentOverrides: confrontanteEditor?.readProjectSegments?.() || []
        })
      : '';

    const segmentCandidates = drawingCoords.map((coord, index) => {
      const next = coords[index + 1] || coords[0];
      const [x1, y1] = project(coord);
      const [x2, y2] = project(next);
      const pxLength = Math.hypot(x2 - x1, y2 - y1);
      return {
        index, x1, y1, x2, y2, pxLength,
        mx: (x1 + x2) / 2,
        my: (y1 + y2) / 2,
        dist: records[index]?.dist || hav(coord, next),
        az: Number.isFinite(records[index]?.az) ? records[index].az : bearingDegrees(coord, next)
      };
    }).sort((a, b) => b.pxLength - a.pxLength);
    const occupiedLabels = [];
    const selectedSegments = new Set();
    segmentCandidates.forEach((item) => {
      if (item.pxLength < 72 || selectedSegments.size >= 12) return;
      const collision = occupiedLabels.some((point) => Math.hypot(point[0] - item.mx, point[1] - item.my) < 92);
      if (collision) return;
      occupiedLabels.push([item.mx, item.my]);
      selectedSegments.add(item.index);
    });
    const segmentLabels = drawingCoords.map((coord, index) => {
      if (!selectedSegments.has(index)) return '';
      const item = segmentCandidates.find((candidate) => candidate.index === index);
      if (!item) return '';
      const dx = item.x2 - item.x1;
      const dy = item.y2 - item.y1;
      const length = Math.max(1, Math.hypot(dx, dy));
      let nx = -dy / length;
      let ny = dx / length;
      const mapCenterX = mapBox.x + mapBox.w / 2;
      const mapCenterY = mapBox.y + mapBox.h / 2;
      if (((mapCenterX - item.mx) * nx + (mapCenterY - item.my) * ny) < 0) { nx *= -1; ny *= -1; }
      const offset = 13;
      const labelX = item.mx + nx * offset;
      const labelY = item.my + ny * offset;
      const label = `Az ${num(item.az, 2)}° • ${num(item.dist, 1)} m`;
      return svgTechnicalLabel(Number(labelX.toFixed(1)), Number(labelY.toFixed(1)), label, { fontSize: 6.6, textColor: '#111827', fontWeight: 700, anchor: 'middle', halo: 0.68 });
    }).join('');

    return `<svg id="azimuthSheetSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
      ${gridPattern}
      <rect width="${W}" height="${H}" fill="#eef2f6"/>
      <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="#fff" stroke="#111827" stroke-width="3"/>
      <text x="${W / 2}" y="64" text-anchor="middle" font-size="23" font-weight="900">PLANTA DO PERÍMETRO POR AZIMUTE</text>

      <rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="#fff" stroke="#111827" stroke-width="1.7"/>
      <rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="url(#azCleanGrid)" clip-path="url(#azCleanMapClip)"/>
      ${technicalMapBridge?.areaNameMarkup?.(sourceFeature, project, mapBox, visualSettings) || technicalMapBridge?.mapMetadata?.(mapBox) || ''}
      <polygon class="${polygonVisual.className}" ${polygonVisual.data} points="${points}" fill="${polygonVisual.fill}" fill-opacity="${polygonVisual.fillOpacity}" stroke="${polygonVisual.stroke}" stroke-width="${(0.95*Number(polygonVisual.strokeWidth||1)).toFixed(3)}" stroke-linejoin="round" clip-path="url(#azCleanMapClip)"/>
      <g clip-path="url(#azCleanMapClip)">${segmentLabels}${vertexMarks}</g>
      ${technicalMapBridge?.coordinateTable?.(coords, mapBox, visualSettings) || ''}
      ${confrontanteLabels}
      ${northArrow(mapBox.x + 62, mapBox.y + 70, .78)}
      <rect x="${mapBox.x + 14}" y="${mapBox.y + mapBox.h - 30}" width="360" height="21" rx="4" fill="#fff" fill-opacity=".90" stroke="#cbd5e1"/>
      <text x="${mapBox.x + 24}" y="${mapBox.y + mapBox.h - 15}" font-size="10.5" fill="#334155">SIRGAS 2000 • rótulos adaptativos para legibilidade • tabela: todos os vértices e segmentos</text>

      <rect x="${footerBox.x}" y="${footerBox.y}" width="${footerBox.w}" height="${footerBox.h}" fill="#fff" stroke="#111827" stroke-width="2"/>
      <line x1="${footerBox.x + leftW}" y1="${footerBox.y}" x2="${footerBox.x + leftW}" y2="${footerBox.y + footerBox.h}" stroke="#111827" stroke-width="1.4"/>
      <line x1="${rightX}" y1="${footerBox.y}" x2="${rightX}" y2="${footerBox.y + footerBox.h}" stroke="#111827" stroke-width="1.4"/>
      <line x1="${footerBox.x}" y1="${footerBox.y + 84}" x2="${footerBox.x + leftW}" y2="${footerBox.y + 84}" stroke="#111827" stroke-width="1"/>

      <text x="${footerBox.x + leftW / 2}" y="${footerBox.y + 28}" text-anchor="middle" font-size="14" font-weight="900">SISTEMA DE COORDENADAS GEOGRÁFICAS</text>
      <text x="${footerBox.x + 34}" y="${footerBox.y + 55}" font-size="12.5" font-weight="800">Datum: SIRGAS 2000</text>
      <text x="${footerBox.x + 34}" y="${footerBox.y + 75}" font-size="11.5">Representação técnica sem mapa de fundo</text>
      <text x="${footerBox.x + 34}" y="${footerBox.y + 118}" font-size="14" font-weight="900">LEGENDAS</text>
      <rect x="${footerBox.x + 34}" y="${footerBox.y + 137}" width="16" height="12" fill="#dc2626" fill-opacity=".18" stroke="#dc2626"/>
      <text x="${footerBox.x + 60}" y="${footerBox.y + 148}" font-size="12">Perímetro</text>
      <circle cx="${footerBox.x + 42}" cy="${footerBox.y + 173}" r="5" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
      <text x="${footerBox.x + 60}" y="${footerBox.y + 177}" font-size="12">Vértices V-01, V-02...</text>

      <text x="${footerBox.x + leftW + midW / 2}" y="${footerBox.y + 30}" text-anchor="middle" font-size="17" font-weight="900">DADOS DO IMÓVEL</text>
      <text x="${footerBox.x + leftW + 24}" y="${footerBox.y + 62}" font-size="13" font-weight="900">Imóvel:</text>
      ${svgTextBlock(areaTitleRaw, footerBox.x + leftW + 86, footerBox.y + 62, { maxChars: 38, maxLines: 1, size: 12.5, lineHeight: 14 })}
      <text x="${footerBox.x + leftW + 24}" y="${footerBox.y + 91}" font-size="13"><tspan font-weight="900">Município/UF:</tspan> ${escapeHtml(cityUf)}</text>
      <text x="${footerBox.x + leftW + 24}" y="${footerBox.y + 119}" font-size="13"><tspan font-weight="900">Área:</tspan> ${num(area, 4)} ha</text>
      <text x="${footerBox.x + leftW + 230}" y="${footerBox.y + 119}" font-size="13"><tspan font-weight="900">Perímetro:</tspan> ${num(total, 2)} m</text>
      <text x="${footerBox.x + leftW + 24}" y="${footerBox.y + 151}" font-size="13"><tspan font-weight="900">Vértices:</tspan> ${drawingCoords.length}</text>
      <text x="${footerBox.x + leftW + 230}" y="${footerBox.y + 151}" font-size="13"><tspan font-weight="900">Fechamento:</tspan> ${num(meta.closure || 0, 3)} m</text>
      <text x="${footerBox.x + leftW + 24}" y="${footerBox.y + 181}" font-size="13" font-weight="900">Proprietário(a):</text>
      ${svgTextBlock(owner, footerBox.x + leftW + 134, footerBox.y + 181, { maxChars: 32, maxLines: 2, size: 12, lineHeight: 14 })}
      <text x="${footerBox.x + leftW + 24}" y="${footerBox.y + 207}" font-size="12"><tspan font-weight="900">Data:</tspan> ${date}</text>

      <defs><clipPath id="azBrandClip"><rect x="${rightX + 8}" y="${footerBox.y + 8}" width="${rightW - 16}" height="${footerBox.h - 16}"/></clipPath></defs>
      <g clip-path="url(#azBrandClip)">
        <image href="${escapeHtml(logoData)}" x="${rightX + (rightW - 104) / 2}" y="${footerBox.y + 28}" width="104" height="56" preserveAspectRatio="xMidYMid meet"/>
        <text x="${rightX + rightW / 2}" y="${footerBox.y + 108}" text-anchor="middle" font-size="15" font-weight="900">Surveyor</text>
        <text x="${rightX + rightW / 2}" y="${footerBox.y + 137}" text-anchor="middle" font-size="10.5">Prancha técnica gerada digitalmente</text>
        <text x="${rightX + 28}" y="${footerBox.y + 170}" font-size="11" font-weight="900">Responsável técnico(a):</text>
        ${svgTextBlock(technician || 'Não informado', rightX + 28, footerBox.y + 190, { maxChars: 28, maxLines: 2, size: 10.5, lineHeight: 12 })}
      </g>
    </svg>`;
  }


  function azimuthReportCss() {
    return `
      <style>
        .sv-az-report{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#fff;padding:18px 20px 22px;box-sizing:border-box}
        .sv-az-report *{box-sizing:border-box}
        .sv-az-report h1{margin:4px 0 14px;text-align:center;font-size:23px;letter-spacing:.03em;color:#0b2d5c}
        .sv-az-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:0 0 12px}
        .sv-az-meta div{border:1px solid #cbd5e1;background:#f8fbff;padding:7px 9px;min-width:0}
        .sv-az-meta span{display:block;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
        .sv-az-meta strong{display:block;margin-top:2px;color:#0f172a;font-size:12px;overflow-wrap:anywhere}
        .sv-az-drawing{margin:0 0 16px;border:1px solid #b8c8da;background:#fff;padding:6px;break-inside:avoid;page-break-inside:avoid}
        .sv-az-drawing svg{display:block;width:100%!important;height:auto!important;max-height:none!important;background:#fff}
        .sv-az-report h2{margin:8px 0 7px;font-size:15px;color:#0b2d5c}
        .sv-az-table{width:100%;border-collapse:collapse;font-size:10px;background:#fff}
        .sv-az-table th,.sv-az-table td{border:1px solid #b8c8da;padding:6px 7px;text-align:left;white-space:nowrap}
        .sv-az-table thead th{background:#0f63e9;color:#fff;font-weight:800;letter-spacing:.01em}
        .sv-az-table tbody tr:nth-child(even){background:#eef5ff}
        .sv-az-table tbody tr:nth-child(odd){background:#fff}
        .sv-az-table td:first-child{font-weight:800;color:#0b4fae}
        .sv-az-footnote{margin-top:9px;color:#64748b;font-size:9px;text-align:right}
      </style>`;
  }

  function azimuthReportHtml(result, svg) {
    const feature = result?.fc?.features?.[0] || {};
    const area = areaHa(feature);
    const header = window.GeoRuralDocumentTheme?.headerHtml?.('Perímetro por azimute') || '';
    const footer = window.GeoRuralDocumentTheme?.footerHtml?.() || '';
    const tableRows = (result?.records || []).map((record) => `
      <tr>
        <td>V-${String(record.i).padStart(2, '0')}</td>
        <td>${Number(record.start?.[1] || 0).toFixed(8)}</td>
        <td>${Number(record.start?.[0] || 0).toFixed(8)}</td>
        <td>${Number(record.az || 0).toFixed(4)}°</td>
        <td>${Number(record.dist || 0).toFixed(3)} m</td>
      </tr>`).join('');
    return `${azimuthReportCss()}
      <main class="sv-az-report">
        ${header}
        <h1>RELATÓRIO DE PERÍMETRO POR AZIMUTE</h1>
        <section class="sv-az-meta">
          <div><span>Imóvel</span><strong>${escapeHtml(result?.title || 'Não informado')}</strong></div>
          <div><span>Proprietário</span><strong>${escapeHtml(result?.owner || 'Não informado')}</strong></div>
          <div><span>Município/UF</span><strong>${escapeHtml([result?.city, result?.uf].filter(Boolean).join('/') || 'Não informado')}</strong></div>
          <div><span>Área</span><strong>${num(area, 4)} ha</strong></div>
          <div><span>Perímetro</span><strong>${num(result?.total || 0, 3)} m</strong></div>
          <div><span>Fechamento</span><strong>${num(result?.closure || 0, 3)} m</strong></div>
        </section>
        <section class="sv-az-drawing">${svg}</section>
        <section class="sv-az-table-block">
          <h2>Planilha técnica de vértices</h2>
          <table class="sv-az-table">
            <thead><tr><th>Vértice</th><th>Latitude</th><th>Longitude</th><th>Azimute</th><th>Distância</th></tr></thead>
            <tbody>${tableRows || '<tr><td colspan="5">Nenhum vértice calculado.</td></tr>'}</tbody>
          </table>
        </section>
        <div class="sv-az-footnote">Documento técnico gerado pelo Surveyor.</div>
        ${footer}
      </main>`;
  }

  window.SurveyorAzimuthDocument = {
    getHtml: () => lastAzimuthReportHtml,
    getSvg: () => lastAzimuthSvg,
    getCss: azimuthReportCss
  };


  function buildFromProject(project) {
    const perimeter = findPerimeterFeature(project);
    const ring = ringCoords(perimeter).filter((coord) => Number.isFinite(Number(coord?.[0])) && Number.isFinite(Number(coord?.[1])));
    if (ring.length < 4) throw new Error('O projeto selecionado não possui um perímetro válido.');

    const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice()
      : [...ring, ring[0]];
    const drawingCoords = closed.slice(0, -1);
    const records = drawingCoords.map((coord, index) => {
      const next = closed[index + 1] || closed[0];
      return {
        i: index + 1,
        start: [Number(coord[0]), Number(coord[1])],
        az: bearingDegrees(coord, next),
        dist: hav(coord, next)
      };
    });

    const title = project.propertyName || project.title || project.name || $('azProjectName').value || 'Perímetro por azimute';
    const feature = JSON.parse(JSON.stringify(perimeter));
    feature.properties = { ...(feature.properties || {}), name: title, category: 'perimetro' };
    const fc = { type: 'FeatureCollection', features: [feature] };
    const total = records.reduce((sum, item) => sum + item.dist, 0);
    return {
      fc,
      records,
      closure: 0,
      total,
      title,
      owner: window.GeoRuralProjects?.ownerNames?.(project) || project.owner || project.ownerName || project.metadata?.owner || 'Não informado',
      city: project.city || project.municipality || project.metadata?.city || '',
      uf: project.uf || project.stateCode || project.metadata?.uf || project.metadata?.stateCode || '',
      technician: project.technician || project.responsibleTechnician || project.metadata?.technician || project.metadata?.responsibleTechnician || '',
      source: 'project'
    };
  }

  function fillInputsFromProject(result) {
    const first = result?.fc?.features?.[0]?.geometry?.coordinates?.[0]?.[0];
    if (first) {
      $('startLat').value = Number(first[1]).toFixed(8);
      $('startLng').value = Number(first[0]).toFixed(8);
    }
    $('azProjectName').value = result.title || $('azProjectName').value;
    $('azimuthLines').value = (result.records || []).map((record) => `${record.az.toFixed(8)};${record.dist.toFixed(3)}`).join('\n');
  }

  async function renderResult(result) {
    azimuthGeojson = result.fc;
    const setText = (id, value) => {
      const node = $(id);
      if (node) node.textContent = value;
    };
    const tableHost = $('azimuthTable');
    const previewHost = $('azimuthPreview');

    setText('azVertices', result.records.length);
    setText('azDistance', `${num(result.total, 3)} m`);
    setText('azClosure', `${num(result.closure, 3)} m`);
    setText('azArea', `${num(areaHa(result.fc.features[0]), 4)} ha`);

    if (tableHost) {
      tableHost.innerHTML = result.records.map((record) => `<tr><td>V-${String(record.i).padStart(2, '0')}</td><td>${Number(record.start[1]).toFixed(8)}</td><td>${Number(record.start[0]).toFixed(8)}</td><td>${record.az.toFixed(4)}°</td><td>${record.dist.toFixed(3)} m</td></tr>`).join('');
    }

    if (!previewHost) return;
    previewHost.classList.add('croqui-preview');
    const customization = window.SurveyorDocumentAssets?.loadCustomization
      ? await window.SurveyorDocumentAssets.loadCustomization({ forceRefresh: true })
      : (window.GeoRuralDocumentTheme?.get?.() || {});
    const logoData = window.SurveyorDocumentAssets?.resolveLogo
      ? await window.SurveyorDocumentAssets.resolveLogo(customization, { timeoutMs: 6000 })
      : (customization.logoDataUrl || '/assets/logo.png');
    const previewHtml = azimuthSheet(result.fc, result.records, { title: result.title, closure: result.closure, owner: result.owner || 'Não informado', city: result.city || '', uf: result.uf || '', technician: result.technician || customization.responsibleTechnician || '', source: result.source || 'manual', customization, logoData });
    lastAzimuthSvg = previewHtml;
    lastAzimuthReportHtml = azimuthReportHtml(result, previewHtml);
    confrontanteEditor?.updateControls?.();
    previewHost.hidden = false;
    previewHost.innerHTML = lastAzimuthReportHtml;
    previewHost.classList.add('document-preview-visible','is-live-svg-preview');
    try { window.dispatchEvent(new CustomEvent('surveyor:document-generation-finished',{detail:{page:'perimetros.html'}})); } catch (_error) {}
  }

  function buildFromInputs() {
    let lat = Number(String($('startLat').value).replace(',', '.'));
    let lng = Number(String($('startLng').value).replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Coordenada inicial inválida.');

    const rows = $('azimuthLines').value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/[;\t,]/).map((value) => Number(String(value).replace(',', '.'))))
      .filter((row) => Number.isFinite(row[0]) && Number.isFinite(row[1]) && row[1] > 0);

    if (!rows.length) throw new Error('Informe azimutes e distâncias.');

    const coords = [[lng, lat]];
    const records = [];
    let total = 0;
    rows.forEach((row, index) => {
      const start = [lng, lat];
      const [nextLat, nextLng] = destination(lat, lng, row[0], row[1]);
      records.push({ i: index + 1, start, az: row[0], dist: row[1] });
      lat = nextLat;
      lng = nextLng;
      coords.push([lng, lat]);
      total += row[1];
    });

    const closure = hav(coords.at(-1), coords[0]);
    coords.push(coords[0]);

    const title = $('azProjectName').value || 'Perímetro por azimute';
    const fc = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: title, category: 'perimetro' },
        geometry: { type: 'Polygon', coordinates: [coords] }
      }]
    };

    return { fc, records, closure, total, title, owner: 'Não informado', city: '', uf: '', technician: '', source: 'manual' };
  }

  function clearGeneratedResult() {
    azimuthGeojson = null;
    lastAzimuthSvg = '';
    lastAzimuthReportHtml = '';
    confrontanteEditor?.updateControls?.();
    if ($('azVertices')) $('azVertices').textContent = '0';
    if ($('azDistance')) $('azDistance').textContent = '0 m';
    if ($('azClosure')) $('azClosure').textContent = '—';
    if ($('azArea')) $('azArea').textContent = '—';
    if ($('azimuthTable')) $('azimuthTable').innerHTML = '';
    const previewHost = $('azimuthPreview');
    if (previewHost) {
      previewHost.hidden = true;
      previewHost.innerHTML = '<p>Projeto carregado. Clique em “Calcular perímetro” para gerar a visualização e os resultados.</p>';
    }
  }

  async function loadSelectedProject({ renderNow = true } = {}) {
    const id = $('projectSelect')?.value || '';
    if (!id) {
      loadedProject = null;
      clearGeneratedResult();
      return false;
    }
    const project = await resolveProject(id);
    if (!project) throw new Error('Não foi possível carregar o projeto selecionado.');
    loadedProject = project;
    const result = buildFromProject(project);
    fillInputsFromProject(result);
    if (renderNow) await renderResult(result);
    else clearGeneratedResult();
    return true;
  }

  async function render() {
    try {
      if ($('projectSelect')?.value) {
        await loadSelectedProject();
        return;
      }
      loadedProject = null;
      const result = buildFromInputs();
      await renderResult(result);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Não foi possível calcular o perímetro.');
    }
  }

  async function ensureAzimuthResult() {
    if (azimuthGeojson?.features?.length) return azimuthGeojson;
    throw new Error('Clique em “Calcular perímetro” antes de salvar ou baixar.');
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function startPerimeterPersonalization(workspace) {
    if (!workspace || !confrontanteEditor) return false;
    if (!lastAzimuthSvg) {
      try { await render(); }
      catch (error) {
        console.warn('[Surveyor] Personalização do perímetro aguardando uma geometria válida:', error);
        return false;
      }
    }
    if (!lastAzimuthSvg) return false;
    const started = await confrontanteEditor.start?.({ mode:'inline', mount:workspace });
    if (started !== false) {
      requestAnimationFrame(() => confrontanteEditor?.fitToViewport?.());
      return true;
    }
    return false;
  }

  function suspendPerimeterPersonalization() {
    confrontanteEditor?.setVisible?.(false);
  }

  function installPersonalizationFlow() {
    window.addEventListener('surveyor:document-step-change', (event) => {
      if (event.detail?.page !== 'perimetros.html') return;
      if (event.detail?.title === 'Personalização') startPerimeterPersonalization(event.detail.workspace);
      else suspendPerimeterPersonalization();
    });
    window.addEventListener('surveyor:open-beta-personalization', (event) => {
      if (event.detail?.page === 'perimetros.html') startPerimeterPersonalization(event.detail.workspace);
    });
  }

  function install() {
    if (!$('generateAzimuth')) return;
    document.body.dataset.azimuthRuntime = 'perimetros-v21.9.130-rotulos-adaptativos';
    confrontanteEditor = window.SurveyorTechnicalDocumentEditor?.create?.({
      getSvg: () => lastAzimuthSvg,
      projectId: () => $('projectSelect')?.value || 'manual',
      page: () => 'perimetros.html',
      layoutId: () => `azimute-${$('azimuthMapZoom')?.value || '15'}`,
      anchor: () => $('generateAzimuth'),
      regenerate: () => render(),
      editorNoun: 'planta de perímetro',
      standaloneControls: false,
      getCoordinateRows: () => {
        const feature = azimuthGeojson?.features?.[0];
        const coords = feature?.geometry?.coordinates?.[0] || [];
        const clean = coords.length > 1 && Number(coords[0]?.[0]) === Number(coords.at(-1)?.[0]) && Number(coords[0]?.[1]) === Number(coords.at(-1)?.[1]) ? coords.slice(0,-1) : coords;
        return clean.map((coord,index) => ({ label:`V-${String(index + 1).padStart(2,'0')}`, lng:Number(coord?.[0]), lat:Number(coord?.[1]) })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
      },
      toast: (message) => { if (message) alert(message); }
    }) || null;
    confrontanteEditor?.ensureControls?.();
    installPersonalizationFlow();
    $('generateAzimuth').onclick = () => render();
    $('projectSelect')?.addEventListener('change', async () => {
      try {
        if ($('projectSelect').value) await loadSelectedProject({ renderNow: true });
        else { loadedProject = null; clearGeneratedResult(); }
      } catch (error) { console.error(error); alert(error.message || 'Não foi possível carregar o projeto selecionado.'); }
    });
    $('downloadAzimuthGeojson').onclick = async () => {
      try {
        const fc = await ensureAzimuthResult();
        download('perimetro-azimutes.geojson', JSON.stringify(fc, null, 2), 'application/geo+json');
      } catch (error) {
        console.error(error);
        alert(error.message || 'Não foi possível preparar o perímetro para download.');
      }
    };
    $('saveAzimuthProject').onclick = async () => {
      try {
        await ensureAzimuthResult();
      } catch (error) {
        console.error(error);
        return alert(error.message || 'Não foi possível preparar o perímetro.');
      }
      if (!window.GeoRuralProjects?.saveLegacy) return alert('Módulo de nuvem indisponível.');
      const coords = azimuthGeojson.features[0].geometry.coordinates[0];
      const center = coords.reduce((sum, coord) => [sum[0] + coord[0], sum[1] + coord[1]], [0, 0]).map((value) => value / coords.length);
      await window.GeoRuralProjects.saveLegacy({
        title: $('azProjectName').value || 'Perímetro por azimutes',
        owner: loadedProject?.owner || loadedProject?.ownerName || '',
        city: loadedProject?.city || loadedProject?.municipality || '',
        uf: loadedProject?.uf || loadedProject?.stateCode || 'BA',
        geojson: azimuthGeojson,
        metadata: { module: 'azimuth-v21.9.3', sourceProjectId: loadedProject?.id || null },
        view: { center: { lat: center[1], lng: center[0] }, zoom: 15 }
      });
      alert('Projeto salvo no Appwrite. Abra o módulo de mapa.');
    };
    loadProjectOptions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();