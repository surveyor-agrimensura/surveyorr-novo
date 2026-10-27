(() => {
  'use strict';

  const safe = (value) => String(value ?? '');
  const esc = (value) => safe(value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const slug = (value) => safe(value || 'item').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'item';

  function formatCpfCnpj(value) {
    const digits = safe(value).replace(/\D/g, '').slice(0, 14);
    if (!digits) return '';
    if (digits.length <= 11) {
      return digits
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1-$2');
    }
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\/\d{4})(\d)/, '$1-$2');
  }

  function cpfCnpjDisplay(value) {
    const digits = safe(value).replace(/\D/g, '').slice(0, 14);
    const formatted = formatCpfCnpj(digits);
    if (!formatted) return { digits:'', value:'', type:'', label:'' };
    if (digits.length === 11) return { digits, value:formatted, type:'cpf', label:`CPF: ${formatted}` };
    if (digits.length === 14) return { digits, value:formatted, type:'cnpj', label:`CNPJ: ${formatted}` };
    return { digits, value:formatted, type:'cpfCnpj', label:`CPF/CNPJ: ${formatted}` };
  }

  function normalizeHexColor(value, fallback = '#111827') {
    const text = safe(value).trim();
    const fallbackText = safe(fallback).trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    return /^#[0-9a-f]{6}$/i.test(fallbackText) ? fallbackText.toLowerCase() : '#111827';
  }

  function readableLabelColor(value, fallback = '#111827') {
    const color = normalizeHexColor(value, fallback);
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = ((0.299 * r) + (0.587 * g) + (0.114 * b)) / 255;
    return luminance >= 0.88 ? normalizeHexColor(fallback, '#111827') : color;
  }

  function perimeterFeature(project) {
    const features = Array.isArray(project?.geojson?.features) ? project.geojson.features : [];
    return globalThis.SurveyorProjectGeometry?.resolvePerimeter?.(project)
      || features.find((feature) => feature?.geometry?.type === 'Polygon' && feature?.properties?.category === 'perimetro')
      || features.find((feature) => /Polygon/i.test(feature?.geometry?.type || ''))
      || null;
  }

  function normalizeAreaNames(value = {}) {
    const hasCollection = Array.isArray(value?.areaNames);
    const source = hasCollection ? value.areaNames : [];
    const legacy = safe(value?.areaName).trim();
    const inferredDefault = safe(value?.defaultAreaName ?? value?.projectAreaName).trim();
    // Uma coleção explícita, inclusive vazia, é o estado oficial. O campo legado
    // só migra projetos antigos que ainda não possuem `areaNames`. Quando o projeto
    // ainda não possui coleção persistida, o nome principal do imóvel passa a ser o
    // rótulo padrão central do polígono.
    const raw = hasCollection
      ? source
      : (legacy
        ? [{ id:'area-1', text:legacy, x:value?.areaNameX, y:value?.areaNameY, scale:value?.areaNameScale, rotation:value?.areaNameRotation }]
        : (inferredDefault ? [{ id:'area-1', text:inferredDefault, scale:1, rotation:0 }] : []));
    const seen = new Set();
    return raw.map((item, index) => {
      let id = safe(item?.id || `area-${index + 1}`).trim() || `area-${index + 1}`;
      if (seen.has(id)) id = `${id}-${index + 1}`;
      seen.add(id);
      const x = Number(item?.x), y = Number(item?.y), xG = Number(item?.xG), yG = Number(item?.yG);
      const geometrySpace = safe(item?.coordinateSpace).trim() === 'geometry-v1' && Number.isFinite(xG) && Number.isFinite(yG);
      return {
        id,
        text: safe(item?.text ?? item?.name).trim(),
        coordinateSpace: geometrySpace ? 'geometry-v1' : '',
        x: Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : null,
        y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : null,
        xG: Number.isFinite(xG) ? xG : null,
        yG: Number.isFinite(yG) ? yG : null,
        scale: Math.max(.5, Math.min(3, Number(item?.scale || 1) || 1)),
        rotation: Math.max(-180, Math.min(180, Number(item?.rotation || 0) || 0)),
        color: normalizeHexColor(safe(item?.color).trim(), '#111827')
      };
    }).filter((item) => item.text);
  }

  function normalizeManualServitudes(value = {}) {
    const source = Array.isArray(value?.manualServitudes) ? value.manualServitudes : [];
    const seen = new Set();
    return source.map((item, index) => {
      let id = safe(item?.id || `servidao-${index + 1}`).trim() || `servidao-${index + 1}`;
      if (seen.has(id)) id = `${id}-${index + 1}`;
      seen.add(id);
      const rawPoints = Array.isArray(item?.pointsG) && item.pointsG.length >= 2
        ? item.pointsG
        : [{ xG:item?.x1G, yG:item?.y1G }, { xG:item?.x2G, yG:item?.y2G }];
      const pointsG = [];
      rawPoints.slice(0, 80).forEach((point) => {
        const xG = Number(point?.xG ?? point?.x), yG = Number(point?.yG ?? point?.y);
        if (!Number.isFinite(xG) || !Number.isFinite(yG)) return;
        const previous = pointsG[pointsG.length - 1];
        if (previous && Math.hypot(xG - previous.xG, yG - previous.yG) < 1e-6) return;
        pointsG.push({ xG, yG });
      });
      if (pointsG.length < 2) return null;
      const widthG = Number(item?.widthG);
      return {
        id,
        coordinateSpace: 'geometry-v1',
        pointsG,
        widthG: Number.isFinite(widthG) ? Math.max(.004, Math.min(.30, widthG)) : .04
      };
    }).filter(Boolean);
  }

  function normalizeTechnicalLines(value = {}) {
    const source = Array.isArray(value?.technicalLines) ? value.technicalLines : [];
    const seen = new Set();
    return source.map((item, index) => {
      let id = safe(item?.id || `linha-${index + 1}`).trim() || `linha-${index + 1}`;
      if (seen.has(id)) id = `${id}-${index + 1}`;
      seen.add(id);
      const x1G = Number(item?.x1G), y1G = Number(item?.y1G), x2G = Number(item?.x2G), y2G = Number(item?.y2G);
      const x1N = Number(item?.x1N), y1N = Number(item?.y1N), x2N = Number(item?.x2N), y2N = Number(item?.y2N);
      const hasGeometry = [x1G,y1G,x2G,y2G].every(Number.isFinite);
      const hasMap = [x1N,y1N,x2N,y2N].every(Number.isFinite);
      if (!hasGeometry && !hasMap) return null;
      return {
        id,
        coordinateSpace: hasGeometry ? 'geometry-v1' : 'map-v1',
        x1G: hasGeometry ? x1G : null, y1G: hasGeometry ? y1G : null,
        x2G: hasGeometry ? x2G : null, y2G: hasGeometry ? y2G : null,
        x1N: hasMap ? x1N : null, y1N: hasMap ? y1N : null,
        x2N: hasMap ? x2N : null, y2N: hasMap ? y2N : null,
        color: normalizeHexColor(safe(item?.color).trim(), safe(value?.technicalLineColor).trim() || '#111827')
      };
    }).filter(Boolean);
  }

  function technicalLinesFromLegacySegments(segments = []) {
    const legacy = (Array.isArray(segments) ? segments : []).find((item) => safe(item?.id).trim() === '__linhas-gerais__');
    if (!legacy || !Array.isArray(legacy.extraLines)) return [];
    return normalizeTechnicalLines({ technicalLines:legacy.extraLines });
  }

  function sampleManualServitudeCenterline(points, samplesPerSegment = 12) {
    const clean = Array.isArray(points) ? points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)) : [];
    if (clean.length < 2) return [];
    if (clean.length === 2) return clean.map((point) => ({ x:Number(point.x), y:Number(point.y) }));
    const samples = [];
    const steps = Math.max(4, Math.min(24, Math.round(Number(samplesPerSegment) || 12)));
    const pointAt = (index) => clean[Math.max(0, Math.min(clean.length - 1, index))];
    for (let segment = 0; segment < clean.length - 1; segment += 1) {
      const p0 = pointAt(segment - 1), p1 = pointAt(segment), p2 = pointAt(segment + 1), p3 = pointAt(segment + 2);
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps, t2 = t * t, t3 = t2 * t;
        const x = .5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3);
        const y = .5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3);
        const previous = samples[samples.length - 1];
        if (!previous || Math.hypot(x - previous.x, y - previous.y) > 1e-4) samples.push({ x, y });
      }
    }
    const last = clean[clean.length - 1];
    samples.push({ x:Number(last.x), y:Number(last.y) });
    return samples;
  }

  function offsetManualServitudeLine(points, distance) {
    if (!Array.isArray(points) || points.length < 2) return [];
    return points.map((point, index) => {
      const previous = points[Math.max(0, index - 1)], next = points[Math.min(points.length - 1, index + 1)];
      let dx = Number(next.x) - Number(previous.x), dy = Number(next.y) - Number(previous.y);
      let length = Math.hypot(dx, dy);
      if (!(length > 1e-8)) {
        const fallback = index ? points[index - 1] : points[index + 1];
        dx = Number(point.x) - Number(fallback?.x ?? point.x);
        dy = Number(point.y) - Number(fallback?.y ?? point.y);
        length = Math.hypot(dx, dy) || 1;
      }
      const nx = -dy / length, ny = dx / length;
      return { x:Number(point.x) + nx * distance, y:Number(point.y) + ny * distance };
    });
  }

  function manualServitudeGeometry(item, geometryBox) {
    const geom = geometryBox && [geometryBox.x,geometryBox.y,geometryBox.w,geometryBox.h].every((value) => Number.isFinite(Number(value)))
      ? { x:Number(geometryBox.x), y:Number(geometryBox.y), w:Math.max(1,Number(geometryBox.w)), h:Math.max(1,Number(geometryBox.h)) }
      : null;
    if (!geom) return null;
    const normalized = normalizeManualServitudes({ manualServitudes:[item] })[0];
    if (!normalized) return null;
    const controlPoints = normalized.pointsG.map((point) => ({ x:geom.x + point.xG * geom.w, y:geom.y + point.yG * geom.h }));
    const centerline = sampleManualServitudeCenterline(controlPoints);
    if (centerline.length < 2) return null;
    const basis = Math.max(1, Math.min(geom.w, geom.h));
    const gap = Math.max(2, normalized.widthG * basis), half = gap / 2;
    return {
      widthG:normalized.widthG,
      controlPoints,
      centerline,
      left:offsetManualServitudeLine(centerline, half),
      right:offsetManualServitudeLine(centerline, -half)
    };
  }

  function svgPathFromPoints(points) {
    if (!Array.isArray(points) || points.length < 2) return '';
    return points.map((point, index) => `${index ? 'L' : 'M'} ${Number(point.x).toFixed(2)} ${Number(point.y).toFixed(2)}`).join(' ');
  }

  const ELEMENT_VISIBILITY_DEFAULTS = Object.freeze({
    cotas:true, glebaCotas:false, vertices:true, confrontantes:true,
    north:true, grid:true, scale:true
  });
  function normalizeElementVisibility(value = {}) {
    const source = value?.elementVisibility && typeof value.elementVisibility === 'object' && !Array.isArray(value.elementVisibility)
      ? value.elementVisibility : {};
    return Object.fromEntries(Object.entries(ELEMENT_VISIBILITY_DEFAULTS).map(([key, fallback]) =>
      [key, typeof source[key] === 'boolean' ? source[key] : fallback]));
  }
  const ELEMENT_VISUAL_DEFAULTS = Object.freeze({
    cotas:{scale:1,color:'#111827'},
    glebaCotas:{scale:1,color:'#64748b'},
    vertices:{scale:1,color:'#111827'},
    confrontantes:{scale:1,color:'#111827'},
    north:{scale:1,color:'#111827'},
    grid:{scale:1,color:'#94a3b8'},
    scale:{scale:1,color:'#111827'}
  });

  function normalizeElementVisuals(value = {}) {
    const source = value?.elementVisuals && typeof value.elementVisuals === 'object' && !Array.isArray(value.elementVisuals) ? value.elementVisuals : {};
    const out = {};
    Object.entries(ELEMENT_VISUAL_DEFAULTS).forEach(([key, defaults]) => {
      const item = source?.[key] && typeof source[key] === 'object' ? source[key] : {};
      const fallbackScale = key === 'cotas' ? Number(value?.dimensionScale ?? defaults.scale) : key === 'vertices' ? Number(value?.vertexScale ?? defaults.scale) : defaults.scale;
      const rawScale = Number(item.scale ?? fallbackScale);
      const fallbackColor = key === 'cotas' ? value?.dimensionColor : defaults.color;
      out[key] = {
        scale: Number.isFinite(rawScale) ? Math.max(.25, Math.min(3, rawScale)) : defaults.scale,
        color: normalizeHexColor(item.color || fallbackColor, defaults.color)
      };
    });
    return out;
  }

  function normalizeDimensionVisualSettings(value = {}) {
    const dimensionLabelOffsets = {};
    Object.entries(value?.dimensionLabelOffsets && typeof value.dimensionLabelOffsets === 'object' && !Array.isArray(value.dimensionLabelOffsets) ? value.dimensionLabelOffsets : {}).forEach(([key, item]) => {
      const id = safe(key).trim();
      if (!id || !item || typeof item !== 'object') return;
      const dx = Number(item.dx), dy = Number(item.dy);
      dimensionLabelOffsets[id] = { dx:Number.isFinite(dx) ? dx : 0, dy:Number.isFinite(dy) ? dy : 0 };
    });
    const dimensionLabelScales = {};
    Object.entries(value?.dimensionLabelScales && typeof value.dimensionLabelScales === 'object' && !Array.isArray(value.dimensionLabelScales) ? value.dimensionLabelScales : {}).forEach(([key, item]) => {
      const id = safe(key).trim(), scale = Number(item);
      if (!id || !Number.isFinite(scale)) return;
      dimensionLabelScales[id] = Math.max(0, Math.min(5, scale));
    });
    const rawScale = Number(value?.dimensionScale ?? 1);
    return {
      dimensionScale: Number.isFinite(rawScale) ? Math.max(0, Math.min(5, rawScale)) : 1,
      dimensionColor: normalizeHexColor(safe(value?.dimensionColor).trim(), '#111827'),
      dimensionLabelOffsets,
      dimensionLabelScales
    };
  }

  function dimensionScaleForKey(value = {}, key = '', legacyKey = '') {
    const normalizedKey = safe(key).trim();
    const visuals = normalizeElementVisuals(value);
    const visualKey = normalizedKey.startsWith('perimeter:') || Boolean(legacyKey) ? 'cotas' : 'glebaCotas';
    const globalRaw = Number(visuals?.[visualKey]?.scale ?? value?.dimensionScale ?? 1);
    const globalScale = Number.isFinite(globalRaw) ? Math.max(0, Math.min(5, globalRaw)) : 1;
    const scales = value?.dimensionLabelScales && typeof value.dimensionLabelScales === 'object' && !Array.isArray(value.dimensionLabelScales)
      ? value.dimensionLabelScales : {};
    const individualRaw = Number(scales[normalizedKey] ?? (legacyKey ? scales[safe(legacyKey).trim()] : undefined) ?? 1);
    const individualScale = Number.isFinite(individualRaw) ? Math.max(0, Math.min(5, individualRaw)) : 1;
    return Math.max(0, Math.min(5, globalScale * individualScale));
  }

  function normalizeSettings(value = {}) {
    const vertexLabelOffsets = {};
    Object.entries(value?.vertexLabelOffsets && typeof value.vertexLabelOffsets === 'object' ? value.vertexLabelOffsets : {}).forEach(([key, item]) => {
      const label = safe(key).trim().toUpperCase();
      const dx = Number(item?.dx || 0), dy = Number(item?.dy || 0);
      if (label && Number.isFinite(dx) && Number.isFinite(dy)) vertexLabelOffsets[label] = { dx, dy };
    });
    const polygonStyles = {};
    Object.entries(value?.polygonStyles && typeof value.polygonStyles === 'object' ? value.polygonStyles : {}).forEach(([key, item]) => {
      if (!item || typeof item !== 'object') return;
      const opacity = Number(item.opacity);
      const strokeWidth = Number(item.strokeWidth);
      const legacyColor = /^#[0-9a-f]{6}$/i.test(safe(item.color).trim()) ? safe(item.color).trim().toLowerCase() : '#f3c410';
      const fillColor = /^#[0-9a-f]{6}$/i.test(safe(item.fillColor).trim()) ? safe(item.fillColor).trim().toLowerCase() : legacyColor;
      const strokeColor = /^#[0-9a-f]{6}$/i.test(safe(item.strokeColor).trim()) ? safe(item.strokeColor).trim().toLowerCase() : legacyColor;
      polygonStyles[key] = {
        color: fillColor, fillColor, strokeColor,
        strokeWidth: Number.isFinite(strokeWidth) ? Math.max(.25, Math.min(4, strokeWidth)) : 1,
        fill: item.fill !== false,
        opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : .22
      };
    });
    const areaNames = normalizeAreaNames(value);
    const tableRows = Math.round(Number(value?.coordinateTableRows || 8) || 8);
    const tableX = Number(value?.coordinateTableX);
    const tableY = Number(value?.coordinateTableY);
    const signatureX = Number(value?.signatureX);
    const signatureY = Number(value?.signatureY);
    const dimensionVisual = normalizeDimensionVisualSettings(value);
    return {
      vertexScale: Math.max(.55, Math.min(2.5, Number(value?.vertexScale || 1) || 1)),
      elementVisuals: normalizeElementVisuals(value),
      elementVisibility:normalizeElementVisibility(value),
      ...dimensionVisual,
      polygonFill: value?.polygonFill !== false,
      polygonStyles,
      vertexLabelOffsets,
      vertexLabelScales:{},
      areaNames,
      manualServitudes: normalizeManualServitudes(value),
      technicalLines: normalizeTechnicalLines(value).filter((item) => item?.owner !== 'vertex-guide' && !safe(item?.id).startsWith('vertex-guide-')),
      areaNameColor: normalizeHexColor(safe(value?.areaNameColor).trim(), '#111827'),
      technicalLineColor: normalizeHexColor(safe(value?.technicalLineColor).trim(), '#111827'),
      signatureEnabled: value?.signatureEnabled === true,
      signatureScale: Math.max(.55, Math.min(8, Number(value?.signatureScale || 1) || 1)),
      signatureX: Number.isFinite(signatureX) ? Math.max(0, Math.min(1, signatureX)) : null,
      signatureY: Number.isFinite(signatureY) ? Math.max(0, Math.min(1, signatureY)) : null,
      coordinateTableEnabled: value?.coordinateTableEnabled === true,
      coordinateTableRows: Math.max(1, Math.min(999, tableRows || 8)),
      coordinateTableScale: Math.max(.7, Math.min(1.8, Number(value?.coordinateTableScale || 1) || 1)),
      coordinateTableX: Number.isFinite(tableX) ? Math.max(0, Math.min(1, tableX)) : null,
      coordinateTableY: Number.isFinite(tableY) ? Math.max(0, Math.min(1, tableY)) : null,
      miniMapKind: ['sat','road','terrain','relief'].includes(safe(value?.miniMapKind).trim()) ? safe(value?.miniMapKind).trim() : 'road',
      miniMapOpacity: Math.max(.2, Math.min(1, Number(value?.miniMapOpacity ?? .88) || .88)),
      miniMapPerimeterVisible: value?.miniMapPerimeterVisible !== false
    };
  }

  function readSettings(project, editor = null, projectId = '') {
    const feature = perimeterFeature(project);
    const remote = feature?.properties?.documentVisualSettings || {};
    let cached = {};
    const id = safe(projectId || project?.id || '').trim();
    if (id) {
      try { cached = JSON.parse(localStorage.getItem(`surveyor:document-visual-settings:v1:${id}`) || '{}') || {}; } catch (_error) {}
    }
    const transactional = editor?.readProjectDocumentSettings?.() || null;
    return normalizeSettings({ ...remote, ...cached, ...(transactional || {}) });
  }

  function polygonKey(feature, fallbackCategory = 'perimetro') {
    const props = feature?.properties || {};
    const category = safe(props.category || (props.generatedBy === 'map-glebas' ? 'gleba' : fallbackCategory || 'outros')).toLowerCase();
    const geometry = feature?.geometry || {};
    const first = geometry.type === 'Polygon' ? geometry.coordinates?.[0]?.[0]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0]?.[0] : null;
    const coord = Array.isArray(first) ? `${Number(first[0] || 0).toFixed(7)}-${Number(first[1] || 0).toFixed(7)}` : 'sem-coord';
    const seed = props.id || props.uuid || props.featureId || feature?.id || props.name || props.title || `${category}-${coord}`;
    return `${category}:${slug(seed) || slug(coord)}`;
  }

  function polygonStyle(feature, settings = {}, defaults = {}) {
    const key = polygonKey(feature, defaults.category || 'perimetro');
    const saved = settings?.polygonStyles?.[key] || null;
    const props = feature?.properties || {};
    const category = safe(props.category || defaults.category || 'perimetro').toLowerCase();
    const defaultColor = /^#[0-9a-f]{6}$/i.test(safe(defaults.color).trim()) ? safe(defaults.color).trim().toLowerCase() : '#f3c410';
    const legacyColor = saved?.color && /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : defaultColor;
    const fillColor = saved?.fillColor && /^#[0-9a-f]{6}$/i.test(saved.fillColor) ? saved.fillColor : legacyColor;
    const strokeColor = saved?.strokeColor && /^#[0-9a-f]{6}$/i.test(saved.strokeColor) ? saved.strokeColor : legacyColor;
    const opacity = Number(saved?.opacity), strokeWidth=Number(saved?.strokeWidth);
    return {
      key,
      name: safe(props.name || props.title || props.label || defaults.name || (category === 'perimetro' ? 'Perímetro do imóvel' : 'Polígono')).trim(),
      category,
      color: fillColor, fillColor, strokeColor,
      strokeWidth: Number.isFinite(strokeWidth) ? Math.max(.25, Math.min(4, strokeWidth)) : 1,
      fill: saved ? saved.fill !== false : true,
      opacity: saved && Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : Math.max(0, Math.min(1, Number(defaults.opacity ?? .22)))
    };
  }

  function polygonAttributes(feature, settings = {}, defaults = {}) {
    const style = polygonStyle(feature, settings, defaults);
    const isPerimeter = style.category === 'perimetro' || defaults.perimeter === true;
    const klass = `sv-document-editable-polygon${isPerimeter ? ' sv-document-perimeter-fill' : ''}`;
    const fillOpacity = settings?.polygonFill === false || style.fill === false ? 0 : style.opacity;
    return {
      style,
      className: klass,
      data: `data-polygon-key="${esc(style.key)}" data-polygon-name="${esc(style.name)}" data-polygon-category="${esc(style.category)}" data-polygon-color="${esc(style.fillColor)}"`,
      fill: style.fillColor,
      stroke: style.strokeColor,
      strokeWidth: style.strokeWidth,
      fillOpacity
    };
  }

  function projectedFeatureBounds(feature, projector, fallbackBox = null) {
    const geometry = feature?.geometry || {};
    const ring = geometry.type === 'Polygon' ? geometry.coordinates?.[0]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0] : [];
    const points = (Array.isArray(ring) ? ring : []).map((coord) => {
      try { return projector(coord); } catch (_error) { return null; }
    }).filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
    if (points.length) {
      const xs = points.map((point) => Number(point[0]));
      const ys = points.map((point) => Number(point[1]));
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w:Math.max(1, Math.max(...xs) - x), h:Math.max(1, Math.max(...ys) - y) };
    }
    return fallbackBox || { x:0, y:0, w:1, h:1 };
  }

  function mapMetadata(box = {}, geometryBox = null) {
    const x = Number(box.x || 0), y = Number(box.y || 0), w = Math.max(1, Number(box.w || 1)), h = Math.max(1, Number(box.h || 1));
    const geom = geometryBox && [geometryBox.x,geometryBox.y,geometryBox.w,geometryBox.h].every((value) => Number.isFinite(Number(value)))
      ? ` data-geom-x="${Number(geometryBox.x).toFixed(4)}" data-geom-y="${Number(geometryBox.y).toFixed(4)}" data-geom-w="${Math.max(1,Number(geometryBox.w)).toFixed(4)}" data-geom-h="${Math.max(1,Number(geometryBox.h)).toFixed(4)}"`
      : '';
    return `<g class="sv-document-map-metadata" data-map-x="${x}" data-map-y="${y}" data-map-w="${w}" data-map-h="${h}"${geom}></g>`;
  }

  function manualServitudeMarkup(feature, projector, box, settings = {}) {
    const servitudes = normalizeManualServitudes(settings);
    if (!servitudes.length || typeof projector !== 'function') return '';
    const geom = projectedFeatureBounds(feature, projector, box);
    return servitudes.map((item) => {
      const geometry = manualServitudeGeometry(item, geom);
      if (!geometry) return '';
      const leftPath = svgPathFromPoints(geometry.left), rightPath = svgPathFromPoints(geometry.right);
      const encodedPoints = esc(JSON.stringify(item.pointsG));
      return `<g class="sv-document-manual-servitude" data-servitude-id="${esc(item.id)}" data-coordinate-space="geometry-v1" data-points-g="${encodedPoints}" data-width-g="${item.widthG}" data-geom-x="${geom.x.toFixed(4)}" data-geom-y="${geom.y.toFixed(4)}" data-geom-w="${geom.w.toFixed(4)}" data-geom-h="${geom.h.toFixed(4)}"><path class="sv-document-manual-servitude-line" d="${leftPath}" fill="none" stroke="#f97316" stroke-width="1.55" stroke-linecap="butt" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><path class="sv-document-manual-servitude-line" d="${rightPath}" fill="none" stroke="#f97316" stroke-width="1.55" stroke-linecap="butt" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g>`;
    }).join('');
  }

  function technicalLinesMarkup(feature, projector, box, settings = {}) {
    if (typeof projector !== 'function') return '';
    const lines = normalizeTechnicalLines(settings);
    if (!lines.length) return '';
    const geom = projectedFeatureBounds(feature, projector, box);
    const mx = Number(box?.x || 0), my = Number(box?.y || 0), mw = Math.max(1, Number(box?.w || 1)), mh = Math.max(1, Number(box?.h || 1));
    return lines.map((item) => {
      const geometrySpace = item.coordinateSpace === 'geometry-v1' && [item.x1G,item.y1G,item.x2G,item.y2G].every(Number.isFinite);
      const x1 = geometrySpace ? geom.x + item.x1G * geom.w : mx + item.x1N * mw;
      const y1 = geometrySpace ? geom.y + item.y1G * geom.h : my + item.y1N * mh;
      const x2 = geometrySpace ? geom.x + item.x2G * geom.w : mx + item.x2N * mw;
      const y2 = geometrySpace ? geom.y + item.y2G * geom.h : my + item.y2N * mh;
      const stroke = normalizeHexColor(safe(item?.color).trim(), normalizeHexColor(safe(settings?.technicalLineColor).trim(), '#111827'));
      return `<line class="sv-document-technical-line" data-technical-line-id="${esc(item.id)}" data-coordinate-space="${geometrySpace?'geometry-v1':'map-v1'}" data-line-color="${esc(stroke)}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${esc(stroke)}" stroke-width="1.35" stroke-linecap="round" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`;
    }).join('');
  }

  function visualOverlayMarkup(feature, projector, box, settings = {}) {
    const names = Array.isArray(settings?.areaNames) ? settings.areaNames : normalizeAreaNames(settings);
    const geom = typeof projector === 'function' ? projectedFeatureBounds(feature, projector, box) : box;
    const metadata = mapMetadata(box, geom);
    const servitudes = manualServitudeMarkup(feature, projector, box, settings);
    const technicalLines = technicalLinesMarkup(feature, projector, box, settings);
    if (!names.length || typeof projector !== 'function') return metadata + servitudes + technicalLines;
    const geometry = feature?.geometry || {};
    const ring = geometry.type === 'Polygon' ? geometry.coordinates?.[0]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0] : [];
    let defaultPoint = [Number(box.x || 0) + Number(box.w || 1) / 2, Number(box.y || 0) + Number(box.h || 1) / 2];
    if (Array.isArray(ring) && ring.length) {
      const clean = ring.slice(0, -1).length ? ring.slice(0, -1) : ring;
      const center = clean.reduce((acc, coord) => [acc[0] + Number(coord?.[0] || 0), acc[1] + Number(coord?.[1] || 0)], [0, 0]);
      const geographic = [center[0] / clean.length, center[1] / clean.length];
      try { defaultPoint = projector(geographic); } catch (_error) {}
    }
    const labels = names.map((item, index) => {
      const geometrySpace = item.coordinateSpace === 'geometry-v1' && Number.isFinite(item.xG) && Number.isFinite(item.yG);
      const x = geometrySpace ? Number(geom.x) + item.xG * Number(geom.w) : (Number.isFinite(item.x) ? Number(box.x) + item.x * Number(box.w) : defaultPoint[0] + index * 18);
      const y = geometrySpace ? Number(geom.y) + item.yG * Number(geom.h) : (Number.isFinite(item.y) ? Number(box.y) + item.y * Number(box.h) : defaultPoint[1] + index * 18);
      const textColor = normalizeHexColor(safe(item?.color).trim(), normalizeHexColor(safe(settings?.areaNameColor).trim(), '#111827'));
      const textHalo = (() => { const hex=textColor.slice(1); const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16); return ((0.299*r+0.587*g+0.114*b)/255)>=0.62 ? '#111827' : '#ffffff'; })();
      return `<g class="sv-area-name-label" data-area-name-id="${esc(item.id)}" data-area-name-color="${esc(textColor)}" data-coordinate-space="${geometrySpace?'geometry-v1':''}" data-map-x="${Number(box.x)}" data-map-y="${Number(box.y)}" data-map-w="${Number(box.w)}" data-map-h="${Number(box.h)}" data-geom-x="${Number(geom.x).toFixed(4)}" data-geom-y="${Number(geom.y).toFixed(4)}" data-geom-w="${Number(geom.w).toFixed(4)}" data-geom-h="${Number(geom.h).toFixed(4)}" data-x="${x.toFixed(2)}" data-y="${y.toFixed(2)}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${Number(item.rotation || 0).toFixed(2)}) scale(${Number(item.scale || 1).toFixed(3)})"><text class="sv-area-name-text" x="0" y="5" text-anchor="middle" font-size="17" font-weight="650" fill="${esc(textColor)}" paint-order="stroke fill" stroke="${esc(textHalo)}" stroke-width="1.6" stroke-linejoin="round">${esc(item.text)}</text></g>`;
    }).join('');
    return metadata + servitudes + technicalLines + labels;
  }

  function servitudeRoadLabel(feature) {
    const props = feature?.properties || {};
    const explicit = safe(props.servitudeRoadLabel || props.roadRef).trim();
    if (explicit) return explicit;
    const roadName = safe(props.servitudeRoadName).trim();
    if (roadName) return roadName;
    const hasServitude = props.servitudeDedicatedTool === true || props.servitudeGenerated === true || Number(props.servitudeWidthMeters) > 0 || Number(props.bufferMeters) > 0;
    const fallback = safe(props.name).trim();
    if (hasServitude && fallback && !/^(servid[aã]o|estrada\/?servid[aã]o|linha t[eé]cnica)$/i.test(fallback)) return fallback;
    return '';
  }

  function servitudeLabelMarkup(feature, projector, options = {}) {
    if (typeof projector !== 'function' || !feature || !/LineString/.test(safe(feature?.geometry?.type))) return '';
    const label = servitudeRoadLabel(feature);
    if (!label) return '';
    const coords = feature.geometry?.type === 'LineString' ? feature.geometry.coordinates : (feature.geometry?.coordinates?.[0] || []);
    if (!Array.isArray(coords) || coords.length < 2) return '';
    let centerIndex = Math.max(0, Math.floor((coords.length - 1) / 2));
    let a = coords[centerIndex], b = coords[Math.min(coords.length - 1, centerIndex + 1)];
    if (!Array.isArray(a) || !Array.isArray(b)) return '';
    let pa, pb;
    try { pa = projector(a); pb = projector(b); } catch (_error) { return ''; }
    if (!Array.isArray(pa) || !Array.isArray(pb)) return '';
    const x = (Number(pa[0]) + Number(pb[0])) / 2;
    const y = (Number(pa[1]) + Number(pb[1])) / 2;
    let angle = Math.atan2(Number(pb[1]) - Number(pa[1]), Number(pb[0]) - Number(pa[0])) * 180 / Math.PI;
    while (angle > 180) angle -= 360;
    while (angle <= -180) angle += 360;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    const fontSize = Math.max(8, Math.min(24, Number(options.fontSize || 11) || 11));
    const offset = Math.max(4, Math.min(28, Number(options.offset || 8) || 8));
    return `<g class="sv-document-servitude-road-label" data-servitude-road-label="${esc(label)}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)})"><text x="0" y="${(-offset).toFixed(2)}" text-anchor="middle" font-size="${fontSize.toFixed(2)}" font-weight="800" fill="#111827" paint-order="stroke fill" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${esc(label)}</text></g>`;
  }

  function servitudeLineMarkup(feature, projector, options = {}) {
    if (typeof projector !== 'function' || !feature || !/LineString/.test(safe(feature?.geometry?.type))) return '';
    const geometry = feature.geometry || {};
    const parts = geometry.type === 'LineString' ? [geometry.coordinates] : (geometry.coordinates || []);
    const stroke = safe(options.stroke || '#f97316');
    const strokeWidth = Math.max(.6, Math.min(5, Number(options.strokeWidth || 1.4) || 1.4));
    const lines = parts.map((part) => `<polyline class="sv-document-servitude-centerline" points="${(part || []).map(projector).map((pt) => `${Number(pt[0]).toFixed(2)},${Number(pt[1]).toFixed(2)}`).join(' ')}" fill="none" stroke="${esc(stroke)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('');
    return lines + servitudeLabelMarkup(feature, projector, options);
  }

  function vertexLabelsForFeature(feature, count = 0) {
    const total = Math.max(0, Number(count) || 0);
    const props = feature?.properties || {};
    const candidateArrays = [props.importedPointNames, props.vertexLabels, props.vertexNames, props.pointNames]
      .filter((value) => Array.isArray(value));
    const labels = Array.from({ length: total }, () => '');
    for (const source of candidateArrays) {
      for (let index = 0; index < Math.min(total, source.length); index += 1) {
        const value = safe(source[index]).trim();
        if (value && !labels[index]) labels[index] = value;
      }
    }
    const confrontantes = Array.isArray(props.confrontantes) ? props.confrontantes : [];
    confrontantes.forEach((item, index) => {
      if (index < total && !labels[index]) labels[index] = safe(item?.from).trim();
      const next = total ? (index + 1) % total : 0;
      if (next < total && !labels[next]) labels[next] = safe(item?.to).trim();
    });
    return labels.map((value, index) => value || `V-${String(index + 1).padStart(2, '0')}`);
  }

  function vertexVisual(label, settings = {}, baseFontSize = 10) {
    const key = safe(label).trim().toUpperCase();
    const offset = settings?.vertexLabelOffsets?.[key] || { dx:0, dy:0 };
    const globalScale = Math.max(.55, Math.min(2.5, Number(settings?.vertexScale || 1) || 1));
    return {
      key,
      dx: Number(offset.dx || 0) || 0,
      dy: Number(offset.dy || 0) || 0,
      scale: 1,
      fontSize: Number(baseFontSize || 10) * globalScale,
      attrs: `class="sv-technical-label sv-vertex-label" data-label="${esc(key)}" data-offset-dx="${Number(offset.dx || 0) || 0}" data-offset-dy="${Number(offset.dy || 0) || 0}" data-source-vertex-scale="${globalScale}" data-individual-scale="1" transform="translate(${Number(offset.dx || 0) || 0} ${Number(offset.dy || 0) || 0})"`
    };
  }

  function coordinateTable(coords = [], box, settings = {}) {
    if (!settings?.coordinateTableEnabled || !box) return '';
    let rows = Array.isArray(coords) ? coords.slice() : [];
    if (rows.length > 1) {
      const first = rows[0], last = rows[rows.length - 1];
      if (Array.isArray(first) && Array.isArray(last) && Number(first[0]) === Number(last[0]) && Number(first[1]) === Number(last[1])) rows = rows.slice(0, -1);
    }
    const totalRows = rows.length;
    const rowCount = Math.max(1, Math.min(totalRows || 1, Math.round(Number(settings.coordinateTableRows || totalRows || 1) || (totalRows || 1))));
    rows = rows.slice(0, rowCount);
    if (!rows.length) return '';
    const scale = Math.max(.7, Math.min(1.8, Number(settings.coordinateTableScale || 1) || 1));
    const baseWidth = Math.min(350, Math.max(260, Number(box.w) * .43));
    const width = baseWidth * scale;
    const rowH = 20 * scale, headH = 24 * scale, radius = Math.max(4, 4 * scale), height = headH + rows.length * rowH + 4 * scale;
    const defaultX = Number(box.x) + Number(box.w) - width - 10;
    const defaultY = Number(box.y) + Number(box.h) - height - 10;
    const normalizedX = Number(settings.coordinateTableX);
    const normalizedY = Number(settings.coordinateTableY);
    const rawX = Number.isFinite(normalizedX) ? Number(box.x) + normalizedX * Number(box.w) : defaultX;
    const rawY = Number.isFinite(normalizedY) ? Number(box.y) + normalizedY * Number(box.h) : defaultY;
    const minX = Number(box.x), maxX = Number(box.x) + Number(box.w) - width;
    const minY = Number(box.y), maxY = Number(box.y) + Number(box.h) - height;
    const x = Math.max(minX, Math.min(maxX, rawX));
    const y = Math.max(minY, Math.min(maxY, rawY));
    const col1 = x + 9 * scale, col2 = x + width * .25, col3 = x + width * .63;
    const body = rows.map((coord, index) => {
      const yy = y + headH + index * rowH;
      const bg = index % 2 ? `<rect x="${x + 1}" y="${yy}" width="${width - 2}" height="${rowH}" fill="#f8fafc"/>` : '';
      const label = Array.isArray(settings?.vertexLabels) && settings.vertexLabels[index] ? safe(settings.vertexLabels[index]) : `V-${String(index + 1).padStart(2,'0')}`;
      return `${bg}<text x="${col1}" y="${yy + 14 * scale}" font-size="${(9 * scale).toFixed(2)}" fill="#334155">${esc(label)}</text><text x="${col2}" y="${yy + 14 * scale}" font-size="${(9 * scale).toFixed(2)}" fill="#334155">${Number(coord?.[1]).toFixed(7)}</text><text x="${col3}" y="${yy + 14 * scale}" font-size="${(9 * scale).toFixed(2)}" fill="#334155">${Number(coord?.[0]).toFixed(7)}</text><line x1="${x}" y1="${yy + rowH}" x2="${x + width}" y2="${yy + rowH}" stroke="#dbe3ee" stroke-width=".6"/>`;
    }).join('');
    return `<g class="sv-coordinate-table-overlay"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="#fff" fill-opacity=".96" stroke="#1f2937" stroke-width="1"/><rect x="${x}" y="${y}" width="${width}" height="${headH}" rx="${radius}" fill="#dbeafe"/><text x="${col1}" y="${y + 16 * scale}" font-size="${(10 * scale).toFixed(2)}" font-weight="600" fill="#10243c">Vértice</text><text x="${col2}" y="${y + 16 * scale}" font-size="${(10 * scale).toFixed(2)}" font-weight="600" fill="#10243c">Latitude</text><text x="${col3}" y="${y + 16 * scale}" font-size="${(10 * scale).toFixed(2)}" font-weight="600" fill="#10243c">Longitude</text>${body}</g>`;
  }

  window.SurveyorTechnicalMapBridge = Object.freeze({
    formatCpfCnpj,
    cpfCnpjDisplay,
    normalizeHexColor,
    readableLabelColor,
    perimeterFeature,
    normalizeSettings,
    normalizeAreaNames,
    normalizeElementVisuals,
    normalizeDimensionVisualSettings,
    dimensionScaleForKey,
    normalizeManualServitudes,
    normalizeTechnicalLines,
    technicalLinesFromLegacySegments,
    readSettings,
    polygonKey,
    polygonStyle,
    polygonAttributes,
    mapMetadata,
    manualServitudeMarkup,
    manualServitudeGeometry,
    sampleManualServitudeCenterline,
    technicalLinesMarkup,
    visualOverlayMarkup,
    areaNameMarkup: visualOverlayMarkup,
    servitudeRoadLabel,
    servitudeLabelMarkup,
    servitudeLineMarkup,
    vertexVisual,
    vertexLabelsForFeature,
    coordinateTable
  });
})();
