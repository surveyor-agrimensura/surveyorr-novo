(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const technicalMapBridge = window.SurveyorTechnicalMapBridge || null;
  const select = $('projectSelect');
  let projects = [];
  let lastSvg = '';
  let lastSvgProjectId = '';
  let lastNativeDocument = null;
  let lastNativeDocumentProjectId = '';
  let generationToken = 0;
  let technicalDocumentEditor = null;
  let editorSessionProjectId = '';
  let mapPreviewResizeObserver = null;
  let mapPreviewFitHost = null;
  let mapPreviewFitRaf = 0;
  let mapasPreviewAwaitingRefresh = false;
  let mapasProjectPreviewStructuralPending = false;
  const publicProjectAccessCache = new Map();

  // Fonte única de limpeza da cena SVG usada pelas exportações e lotes.
  const printableDocumentSvg = (svgText) => {
      const raw = String(svgText || '').trim();
      if (!raw || !raw.includes('<svg')) return raw;
      try {
        const parsed = new DOMParser().parseFromString(raw,'image/svg+xml');
        if (parsed.querySelector('parsererror')) return raw;
        parsed.querySelectorAll('.sv-confrontante-editor-anchors,.sv-vertex-anchor,.sv-editor-servitude-handle,.sv-editor-servitude-hitbox,.sv-editor-servitude-center,.sv-editor-servitude-temp').forEach((node)=>node.remove());
        parsed.querySelectorAll('.sv-document-manual-servitude.is-selected').forEach((node)=>node.classList.remove('is-selected'));
        return new XMLSerializer().serializeToString(parsed.documentElement);
      } catch (_error) { return raw; }
  };


  const CONFRONTANTE_LABEL_STORAGE_PREFIX = 'surveyor:confrontante-label-layout:v1';
  const confrontanteStorageKey = () => {
    const projectId = String(select?.value || 'sem-projeto');
    const page = String(document.body?.dataset?.page || 'documento');
    const layout = String($('mapSheetLayout')?.value || 'padrao');
    return `${CONFRONTANTE_LABEL_STORAGE_PREFIX}:${page}:${projectId}:${layout}`;
  };
  function readConfrontanteLabelOffsets() {
    try {
      const raw = localStorage.getItem(confrontanteStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) { return {}; }
  }
  function writeConfrontanteLabelOffsets(offsets) {
    try { localStorage.setItem(confrontanteStorageKey(), JSON.stringify(offsets || {})); } catch (_error) {}
  }
  function clearConfrontanteLabelOffsets() {
    try { localStorage.removeItem(confrontanteStorageKey()); } catch (_error) {}
  }
  function editorProjectLayout() {
    return technicalDocumentEditor?.readProjectLayout?.() || { segments: [], documentSettings: null, updatedAt: '' };
  }
  function layoutTimestamp(value) { return Date.parse(String(value || '')) || 0; }
  function readConfrontanteSegmentOverrides(project = null) {
    const feature = project ? perimeter(project) : null;
    const remoteLayout = feature?.properties?.confrontanteVisualLayout || {};
    const remote = Array.isArray(remoteLayout?.segments) ? remoteLayout.segments : [];
    const localLayout = editorProjectLayout();
    const local = Array.isArray(localLayout?.segments) ? localLayout.segments : [];
    if (local.length && layoutTimestamp(localLayout.updatedAt) >= layoutTimestamp(remoteLayout.updatedAt)) return local;
    if (remote.length) return remote;
    return local.length ? local : (technicalDocumentEditor?.readProjectSegments?.() || []);
  }
  function readConfrontanteVisualOffsets(project = null) {
    return readConfrontanteSegmentOverrides(project).length ? {} : (technicalDocumentEditor?.readOffsets?.() || readConfrontanteLabelOffsets());
  }

  const categoryColors = {
    perimetro: '#ff1f13', gleba: '#c7924d', reserva: '#15803d', app: '#ef4444', produtiva: '#f59e0b',
    vegetacao: '#22c55e', consolidada: '#a855f7', estrada: '#f97316', agua: '#0ea5e9',
    benfeitoria: '#eab308', municipio: '#334155', outros: '#64748b'
  };
  const categoryLabels = {
    perimetro: 'Perímetro', gleba: 'Gleba', reserva: 'Reserva Legal', app: 'APP', produtiva: 'Área produtiva',
    vegetacao: 'Vegetação nativa', consolidada: 'Área consolidada', estrada: 'Estrada/servidão',
    agua: 'Curso d’água', benfeitoria: 'Benfeitoria', municipio: 'Limite municipal', outros: 'Outros'
  };

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const slug = (value) => String(value || 'croqui').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const num = (value, digits = 2) => Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits, maximumFractionDigits: digits
  });
  const perimeter = (p) => globalThis.SurveyorProjectGeometry?.resolvePerimeter?.(p)
    || p?.geojson?.features?.filter((f) => /Polygon/i.test(f?.geometry?.type || '')).sort((a,b)=>(globalThis.turf?.area?.(b)||0)-(globalThis.turf?.area?.(a)||0))[0] || null;
  const normalizeHexColor = (value, fallback = '#f3c410') => {
    const shared = window.SurveyorTechnicalMapBridge?.normalizeHexColor;
    if (typeof shared === 'function') return shared(value, fallback);
    const text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
  };
  const documentPolygonKey = (feature) => {
    const props = feature?.properties || {};
    const category = String(props.category || (props.generatedBy === 'map-glebas' ? 'gleba' : 'outros')).toLowerCase();
    const geometry = feature?.geometry || {};
    const first = geometry.type === 'Polygon' ? geometry.coordinates?.[0]?.[0]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0]?.[0] : null;
    const fallbackCoord = Array.isArray(first) ? `${Number(first[0] || 0).toFixed(7)}-${Number(first[1] || 0).toFixed(7)}` : 'sem-coord';
    const seed = props.id || props.uuid || props.featureId || feature?.id || props.name || props.title || `${category}-${fallbackCoord}`;
    return `${category}:${slug(seed) || slug(fallbackCoord)}`;
  };
  const documentPolygonName = (feature) => {
    const props = feature?.properties || {};
    const category = String(props.category || (props.generatedBy === 'map-glebas' ? 'gleba' : 'outros')).toLowerCase();
    return String(props.name || props.title || props.label || props.propertyName || (category === 'perimetro' ? 'Perímetro do imóvel' : categoryLabels[category] || 'Polígono')).trim();
  };
  const documentPolygonStyle = (feature, visualSettings, defaults = {}) => {
    const key = documentPolygonKey(feature);
    const saved = visualSettings?.polygonStyles?.[key] || null;
    const defaultColor = normalizeHexColor(defaults.color || '#f3c410', '#f3c410');
    const legacyColor = saved ? normalizeHexColor(saved.color, defaultColor) : defaultColor;
    const opacity = Number(saved?.opacity), strokeWidth=Number(saved?.strokeWidth);
    const fillColor = saved ? normalizeHexColor(saved.fillColor, legacyColor) : defaultColor;
    const strokeColor = saved ? normalizeHexColor(saved.strokeColor, legacyColor) : defaultColor;
    return {
      key,
      name: documentPolygonName(feature),
      category: String(feature?.properties?.category || (feature?.properties?.generatedBy === 'map-glebas' ? 'gleba' : 'outros')).toLowerCase(),
      color: fillColor, fillColor, strokeColor,
      strokeWidth:Number.isFinite(strokeWidth)?Math.max(.25,Math.min(4,strokeWidth)):1,
      fill: saved ? saved.fill !== false : true,
      opacity: saved && Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : Math.max(0, Math.min(1, Number(defaults.opacity ?? .22)))
    };
  };
  const polygonDataAttrs = (style) => `data-polygon-key="${escape(style.key)}" data-polygon-name="${escape(style.name)}" data-polygon-category="${escape(style.category)}" data-polygon-color="${escape(style.color)}"`;

  function servitudeWidthMeters(feature) {
    const props = feature?.properties || {};
    const direct = Number(props.servitudeWidthMeters);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const half = Number(props.bufferMeters);
    return Number.isFinite(half) && half > 0 ? half * 2 : 0;
  }

  function servitudeDocumentCorridor(feature) {
    const geometryType = String(feature?.geometry?.type || '');
    const category = String(feature?.properties?.category || '').toLowerCase();
    const width = servitudeWidthMeters(feature);
    if (category !== 'estrada' || !/LineString/.test(geometryType) || !(width > 0) || !globalThis.turf?.buffer) return null;
    try {
      const buffered = globalThis.turf.buffer(feature, width / 2, { units: 'meters', steps: 16 });
      if (!buffered?.geometry || !/Polygon/.test(String(buffered.geometry.type || ''))) return null;
      return { ...buffered, properties: { ...(buffered.properties || {}), generatedFrom: 'servitude-line-derived-document', servitudeWidthMeters: width } };
    } catch (error) {
      console.warn('[Surveyor] Não foi possível reconstruir a faixa de servidão no documento técnico:', error);
      return null;
    }
  }

  function svgServitudeCorridor(feature, project, options = {}) {
    const corridor = servitudeDocumentCorridor(feature);
    if (!corridor) return '';
    const geometry = corridor.geometry || {};
    const fillColor = '#fb923c';
    const strokeColor = '#f97316';
    const strokeWidth = Number(options.strokeWidth || 1.15);
    const fillOpacity = Number(options.fillOpacity ?? .22);
    const polygon = (parts) => (parts || []).map((part) => `<polygon class="sv-document-servitude-corridor" data-servitude-derived="1" data-servitude-width-m="${Number(corridor.properties?.servitudeWidthMeters || 0).toFixed(2)}" points="${(part || []).map(project).map((pt) => pt.join(',')).join(' ')}" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="${strokeColor}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"/>`).join('');
    if (geometry.type === 'Polygon') return polygon(geometry.coordinates);
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).map(polygon).join('');
    return '';
  }

  const documentVisualSettings = (p) => {
    const feature = perimeter(p);
    const defaultAreaName = cleanDocumentValue(p?.propertyName || p?.title || p?.name || '');
    const remote = feature?.properties?.documentVisualSettings || {};
    const remoteLayoutTime = layoutTimestamp(feature?.properties?.confrontanteVisualLayout?.updatedAt);
    const localProjectLayout = editorProjectLayout();
    let local = {};
    try { local = JSON.parse(localStorage.getItem(`surveyor:document-visual-settings:v1:${String(p?.id || select?.value || 'sem-projeto')}`) || '{}') || {}; } catch (_error) {}
    const transactionalLocal = localProjectLayout?.documentSettings || null;
    const value = transactionalLocal && layoutTimestamp(localProjectLayout.updatedAt) >= remoteLayoutTime
      ? { ...remote, ...local, ...transactionalLocal }
      : { ...local, ...remote };
    const legacyTechnicalLines = technicalMapBridge?.technicalLinesFromLegacySegments?.(readConfrontanteSegmentOverrides(p)) || [];
    if ((!Array.isArray(value.technicalLines) || !value.technicalLines.length) && legacyTechnicalLines.length) value.technicalLines = legacyTechnicalLines;
    const normalized = technicalMapBridge?.normalizeSettings?.({ ...value, defaultAreaName });
    if (!normalized) {
      const areaNames = technicalMapBridge?.normalizeAreaNames?.({ ...value, defaultAreaName }) || [], primary = areaNames[0] || null;
      return {
        vertexScale:1, dimensionScale:1, dimensionColor:'#111827', dimensionLabelOffsets:{}, dimensionLabelScales:{}, polygonFill:value?.polygonFill!==false,
        polygonStyles:{}, vertexLabelOffsets:{}, vertexLabelScales:{}, areaNames, manualServitudes:[], technicalLines:[],
        areaName:primary?.text||'', areaNameX:primary?.x??null, areaNameY:primary?.y??null, areaNameScale:primary?.scale??1, areaNameRotation:primary?.rotation??0,
        areaNameColor:'#111827', technicalLineColor:'#111827',
        signatureEnabled:false, signatureScale:1, signatureX:null, signatureY:null,
        coordinateTableEnabled:false, coordinateTableRows:8, coordinateTableScale:1, coordinateTableX:null, coordinateTableY:null,
        miniMapKind:'road', miniMapOpacity:.88, miniMapPerimeterVisible:true, elementVisibility:value?.elementVisibility || {}
      };
    }
    const primary = normalized.areaNames?.[0] || null;
    return {
      ...normalized,
      areaName: primary?.text || '',
      areaNameX: primary?.x ?? null,
      areaNameY: primary?.y ?? null,
      areaNameScale: primary?.scale ?? 1,
      areaNameRotation: primary?.rotation ?? 0
    };
  };

  function documentLegendEntries(project, rootFeature, visualSettings, options = {}) {
    const entries=[];
    const seen=new Set();
    const add=(key,label,color,kind='area')=>{
      const id=String(key||label||'').toLowerCase();
      if(!id||seen.has(id))return;
      seen.add(id);entries.push({key:id,label:String(label||key||'Item'),color:normalizeHexColor(color,'#64748b'),kind});
    };
    if(rootFeature){
      const style=documentPolygonStyle(rootFeature,visualSettings,{color:categoryColors.perimetro,opacity:.18});
      add('perimetro','Perímetro',style.color,'line');
    }
    const features=Array.isArray(project?.geojson?.features)?project.geojson.features:[];
    features.forEach((item)=>{
      if(!item||item===rootFeature)return;
      const category=String(item?.properties?.category||'outros').toLowerCase();
      if(category==='perimetro')return;
      if(category==='estrada' && /LineString/i.test(String(item?.geometry?.type||''))){add('servidao','Servidão',categoryColors.estrada,'line');return;}
      if(/Polygon/i.test(String(item?.geometry?.type||''))){
        const style=documentPolygonStyle(item,visualSettings,{color:categoryColors[category]||categoryColors.outros,opacity:.22});
        add(`polygon:${category}`,categoryLabels[category]||style.name||category,style.color,'area');
      } else add(`category:${category}`,categoryLabels[category]||category,categoryColors[category]||categoryColors.outros,'line');
    });
    if((visualSettings?.manualServitudes||[]).length) add('servidao','Servidão',categoryColors.estrada,'line');
    if(options.showCotas||options.showGlebaCotas) add('cotas','Cotas','#111827','line');
    if(options.showVertices) add('vertices','Vértices','#111827','point');
    return entries.slice(0,Math.max(1,Number(options.max||6)||6));
  }

  function legendEntryMarkup(entry, x, y, options = {}) {
    const size=Number(options.size||12),sw=Number(options.swatchWidth||18),labelX=x+sw+8;
    const color=normalizeHexColor(entry?.color,'#64748b');
    const symbol=entry?.kind==='point'
      ? `<circle cx="${x+sw/2}" cy="${y-4}" r="${Math.max(3,sw*.25)}" fill="#fff" stroke="${color}" stroke-width="1.4"/>`
      : entry?.kind==='line'
        ? `<line x1="${x}" y1="${y-4}" x2="${x+sw}" y2="${y-4}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`
        : `<rect x="${x}" y="${y-12}" width="${sw}" height="12" fill="${color}" fill-opacity=".30" stroke="${color}"/>`;
    return `${symbol}<text x="${labelX}" y="${y}" font-size="${size}">${escape(entry?.label||'Item')}</text>`;
  }

  function documentSignatureMarkup({ p, custom = {}, width, height, defaultX, defaultY, baseWidth = 120, baseHeight = 34 }) {
    const visualSettings = documentVisualSettings(p);
    const signatureData = String(custom?.planDocumentSignatureDataUrl || window.GeoRuralDocumentTheme?.getSignature?.() || '').trim();
    const signatureScale = Math.max(.55, Math.min(8, Number(visualSettings.signatureScale || 1) || 1));
    const signatureWidth = baseWidth * signatureScale;
    const signatureHeight = baseHeight * signatureScale;
    const W = Math.max(1, Number(width || 1));
    const H = Math.max(1, Number(height || 1));
    const anchorX = Number.isFinite(Number(visualSettings.signatureX)) ? Math.max(signatureWidth / 2, Math.min(W - signatureWidth / 2, Number(visualSettings.signatureX) * W)) : Number(defaultX || W / 2);
    const anchorY = Number.isFinite(Number(visualSettings.signatureY)) ? Math.max(signatureHeight, Math.min(H, Number(visualSettings.signatureY) * H)) : Number(defaultY || H / 2);
    return `<image data-document-signature="1" data-base-width="${baseWidth}" data-base-height="${baseHeight}" data-anchor-x="${anchorX}" data-anchor-y="${anchorY}" href="${escape(signatureData)}" x="${anchorX - signatureWidth/2}" y="${anchorY - signatureHeight}" width="${signatureWidth}" height="${signatureHeight}" preserveAspectRatio="xMidYMid meet" style="display:${signatureData && visualSettings.signatureEnabled?'':'none'}" opacity="${signatureData && visualSettings.signatureEnabled?1:0}"/>`;
  }

  const vertexLabelsForFeature = (feature, count = 0) => {
    const shared = window.SurveyorTechnicalMapBridge?.vertexLabelsForFeature;
    if (typeof shared === 'function') return shared(feature, count);
    return Array.from({ length: Math.max(0, Number(count) || 0) }, (_item, index) => `V-${String(index + 1).padStart(2, '0')}`);
  };
  const hiddenVertexIndexesForFeature = (feature, coords = []) => {
    const hidden = new Set((Array.isArray(feature?.properties?.surveyorHiddenVertexKeys) ? feature.properties.surveyorHiddenVertexKeys : []).filter(Boolean));
    if (!hidden.size) return [];
    return (coords || []).slice(0, -1).map((coord, index) => {
      const [lng, lat] = coord || [];
      const key = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? `${Number(lat).toFixed(8)},${Number(lng).toFixed(8)}` : '';
      return key && hidden.has(key) ? index : -1;
    }).filter((index) => index >= 0);
  };
  const ring = (p) => {
    const fromHelper = globalThis.SurveyorProjectGeometry?.perimeterRing?.(p);
    if (Array.isArray(fromHelper) && fromHelper.length) return fromHelper;
    const f = perimeter(p);
    if (!f?.geometry) return [];
    if (f.geometry.type === 'Polygon') return f.geometry.coordinates?.[0] || [];
    if (f.geometry.type === 'MultiPolygon') return f.geometry.coordinates?.[0]?.[0] || [];
    return [];
  };
  const ringOfFeature = (feature) => {
    const geometry = feature?.geometry;
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return geometry.coordinates?.[0] || [];
    if (geometry.type === 'MultiPolygon') {
      const parts = (geometry.coordinates || []).map((coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: coords } }));
      const largest = parts.sort((a, b) => area(b) - area(a))[0];
      return largest?.geometry?.coordinates?.[0] || [];
    }
    return [];
  };
  const area = (f) => { try { return turf.area(f); } catch { return 0; } };
  const hav = (a, b) => {
    const R = 6371008.8;
    const rad = (x) => x * Math.PI / 180;
    const dlat = rad(b[1] - a[1]);
    const dlon = rad(b[0] - a[0]);
    const q = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(q));
  };

  const optionEnabled = (id, fallback = true) => {
    const el = $(id);
    return el ? Boolean(el.checked) : fallback;
  };

  const documentDimensions = window.SurveyorDocumentDimensions?.create?.({ area, ringOfFeature, hav, num, escape, dimensionScaleForKey:technicalMapBridge?.dimensionScaleForKey });
  if (!documentDimensions) throw new Error('Módulo de cotas não carregado.');
  const { resolveGlebaFeatures, glebaFeatureId, glebaFeatureParentId, isNestedGleba, resolveLeafGlebaFeatures, canonicalDimensionSegmentKey, glebaHierarchyDepth, resolveDimensionGlebaFeatures, projectedDimensionSegment, projectedPointLineDistance, projectedSegmentOverlapInfo, dimensionSegmentsForRing, isDescendantGleba, glebaDimensionLabels, ensureClosedRing, projectRingPoints, pointOnProjectedSegment, pointInProjectedRing, resolveDimensionAnchor, dimensionLabelRect, rectsOverlap, chooseCollisionFreeDimensionAnchor, fittedDimensionFontSize, cadDimensionLabels } = documentDimensions;

  const documentConfrontantes = window.SurveyorDocumentConfrontantes?.create?.({ escape, pointInProjectedRing });
  if (!documentConfrontantes) throw new Error('Módulo de confrontantes não carregado.');
  const { normalizeConfrontanteKey, confrontanteItem, buildConfrontanteGroups, buildConfrontanteColorMaps, svgStyledPerimeter, svgLabelWithBackground, smartConfrontanteLabels, confrontanteLabel } = documentConfrontantes;

  const documentVertices = window.SurveyorDocumentVertices?.create?.({ escape });
  if (!documentVertices) throw new Error('Módulo de vértices não carregado.');
  const { smartVertexMarks, automaticCartographicLayoutProfile, projectedVertexProtectionRects, croquiVertexMarks } = documentVertices;
































  let documentToastTimer = 0;
  function toast(message, type = '') {
    const host = $('suiteToast');
    if (!host) return;
    clearTimeout(documentToastTimer);
    host.textContent = String(message || '');
    host.className = `toast show ${type || ''}`.trim();
    documentToastTimer = window.setTimeout(() => { host.className = 'toast'; }, 2800);
  }

  let projectSwitchLoadingToken = 0;
  function ensureProjectSwitchOverlay() {
    let node=document.querySelector('[data-document-project-switch-overlay]');
    if(node)return node;
    node=document.createElement('div');
    node.className='sv-document-app-loader';
    node.dataset.documentProjectSwitchOverlay='1';
    node.hidden=true;
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    node.setAttribute('aria-label','Carregando projeto');
    node.setAttribute('aria-hidden','true');
    node.innerHTML='<span class="sv-document-app-loader-spinner" aria-hidden="true"></span>';
    document.body.appendChild(node);
    return node;
  }
  function setProjectSwitchLoading(visible) {
    const node=ensureProjectSwitchOverlay();
    node.hidden=!visible;
    node.setAttribute('aria-hidden',visible?'false':'true');
    node.setAttribute('aria-busy',visible?'true':'false');
  }

  function setPreviewMessage(message) {
    $('mapPreview').innerHTML = `<p class="empty">${escape(message)}</p>`;
  }

  function syncProjectSelectProxies() {
    if (!select) return;
    document.querySelectorAll('[data-beta-proxy-for="projectSelect"]').forEach((proxy) => {
      if (!(proxy instanceof HTMLSelectElement)) return;
      const current = String(proxy.value || select.value || '');
      proxy.innerHTML = Array.from(select.options).map((option) => `<option value="${escape(option.value)}">${escape(option.textContent || '')}</option>`).join('');
      proxy.value = [...proxy.options].some((option) => option.value === current) ? current : String(select.value || '');
      proxy.disabled = Boolean(select.disabled);
    });
  }

  function appendProjectOption(p) {
    const title = p?.title || p?.name || p?.propertyName || 'Projeto sem nome';
    const city = p?.city || p?.municipality || '';
    const uf = p?.uf || p?.stateCode || '';
    if (![...select.options].some((o) => o.value === p.id)) {
      select.add(new Option(`${title}${city ? ` — ${city}/${uf}` : ''}`, p.id));
      syncProjectSelectProxies();
    }
  }

  async function loadProjects() {
    const requested = new URLSearchParams(location.search).get('project') || '';
    const cached = await window.GeoRuralProjects.list({ full: false, refresh: false, cacheOnly: true });
    projects = Array.isArray(cached) ? cached : [];
    projects.forEach(appendProjectOption);
    if (!requested && select?.dataset?.projectChoiceExplicit !== '1') select.value = '';
    if (requested && [...select.options].some((option) => option.value === requested)) select.value = requested;
    syncProjectSelectProxies();
    if (select.value) {
      setProjectSwitchLoading(true);
      try {
        const ready = await withTimeout(
          generateSelected({ silent: document.body?.dataset?.page === 'pranchas.html', inlineOnly: document.body?.dataset?.page === 'pranchas.html', fastPreview: ['mapas.html','pranchas.html'].includes(document.body?.dataset?.page || ''), preferCache:true }),
          30000, 'O projeto demorou demais para carregar.'
        );
        if (!ready) setPreviewMessage('Não foi possível preparar a prévia. Confira o perímetro do projeto e tente novamente.');
        const workspace = document.querySelector('.sv-doc-workspace');
        if (document.body?.dataset?.page === 'pranchas.html' && workspace?.dataset?.pranchaInlineMode === 'project') {
          await startPranchaProjectLive(workspace);
        }
      } catch (error) {
        clearPranchaPreparingShell(document.querySelector('.sv-doc-workspace'));
        setPreviewMessage(error?.message || 'Falha ao abrir o projeto.');
        toast(error?.message || 'Falha ao abrir o projeto.', 'error');
      } finally {
        setProjectSwitchLoading(false);
      }
    }
  }

  function projectHasRenderablePerimeter(project) {
    if (!project) return false;
    const candidate = globalThis.SurveyorProjectGeometry?.resolvePerimeter?.(project)
      || project?.geojson?.features?.find((feature) => feature?.geometry && /Polygon/i.test(String(feature.geometry.type || '')));
    return Boolean(candidate?.geometry && /Polygon/i.test(String(candidate.geometry.type || '')));
  }

  async function resolveProject(id, options = {}) {
    if (!id) return null;
    let p = projects.find((item) => item.id === id) || null;
    // Uma entrada cache-first pode ser apenas resumo. Ela nunca deve ser entregue ao
    // renderer como se fosse um projeto geométrico completo, pois isso gera o falso
    // erro de “perímetro inválido” visto durante a troca de projeto.
    if (!projectHasRenderablePerimeter(p)) {
      try {
        p = await window.GeoRuralProjects?.get?.(id, false) || p;
        if (!projectHasRenderablePerimeter(p) && options.refreshIfIncomplete !== false) {
          p = await window.GeoRuralProjects?.get?.(id, true) || p;
        }
      } catch (err) {
        console.warn('Erro ao carregar projeto completo:', err);
      }
    }
    if (p) {
      const idx = projects.findIndex((item) => item.id === id);
      if (idx >= 0) projects[idx] = { ...projects[idx], ...p };
      else {
        projects.push(p);
        appendProjectOption(p);
      }
    }
    return globalThis.SurveyorDocumentScope?.apply?.(p) || p;
  }

  async function shareUrl(projectId) {
    if (!projectId) return '';
    try {
      let share = await window.GeoRuralAuth.getProjectShare(projectId).catch(() => null);
      if (!share?.active || (!share?.token && !share?.url && !share?.publicUrl)) {
        share = await window.GeoRuralAuth.createProjectShare(projectId, { expiresInDays: 3650 });
      }
      const direct = String(share?.publicUrl || share?.url || '').trim();
      const origin = (() => {
        try {
          const current = new URL(location.href);
          const host = String(current.hostname || '').toLowerCase();
          if (current.protocol === 'https:' && (host === 'surveyorr.com.br' || host.endsWith('.surveyorr.com.br'))) return current.origin;
        } catch {}
        return 'https://surveyorr.com.br';
      })();
      if (direct) return new URL(direct, `${origin}/`).href;
      if (share?.token) return `${origin}/public-project/#token=${encodeURIComponent(share.token)}`;
      return '';
    } catch (error) {
      console.warn('Link público do croqui indisponível:', error);
      return '';
    }
  }


  async function resolveDocumentPublicAccess(p) {
    if (window.SurveyorBatchDocumentContext?.active) return { url:'', qr:'' };
    const id = String(p?.id || '').trim();
    if (!id) return { url:'', qr:'' };
    const cached = publicProjectAccessCache.get(id);
    if (cached) return cached;
    const pending = (async () => {
      const documentAssets = window.SurveyorDocumentAssets;
      if (documentAssets?.publicProjectAccess) {
        try {
          const access = await documentAssets.publicProjectAccess(p, { qrSize:300 });
          if (access?.url) return { url:String(access.url), qr:String(access.qr || '') };
        } catch (error) {
          console.warn('[Surveyor] Acesso público persistente indisponível; usando compartilhamento compatível.', error);
        }
      }
      const url = String(p?.publicUrl || p?.shareUrl || '').trim() || await shareUrl(id);
      if (!url) return { url:'', qr:'' };
      const qrLib = window.GeoRuralQR || window.QRCode;
      const qr = qrLib?.toDataURL ? await qrLib.toDataURL(url, { width:300, margin:1, errorCorrectionLevel:'M' }).catch(() => '') : '';
      return { url, qr:String(qr || '') };
    })();
    publicProjectAccessCache.set(id,pending);
    try {
      const resolved = await pending;
      publicProjectAccessCache.set(id,Promise.resolve(resolved));
      return resolved;
    } catch (error) {
      publicProjectAccessCache.delete(id);
      throw error;
    }
  }

  function collectGeometryCoords(geometry, target = []) {
    if (!geometry?.type || !geometry?.coordinates) return target;
    if (geometry.type === 'Point') {
      if (Array.isArray(geometry.coordinates) && Number.isFinite(Number(geometry.coordinates[0])) && Number.isFinite(Number(geometry.coordinates[1]))) {
        target.push(geometry.coordinates);
      }
    } else if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
      (geometry.coordinates || []).forEach((pt) => {
        if (Array.isArray(pt) && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1]))) target.push(pt);
      });
    } else if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') {
      (geometry.coordinates || []).forEach((part) => {
        (part || []).forEach((pt) => {
          if (Array.isArray(pt) && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1]))) target.push(pt);
        });
      });
    } else if (geometry.type === 'MultiPolygon') {
      (geometry.coordinates || []).forEach((poly) => {
        (poly || []).forEach((part) => {
          (part || []).forEach((pt) => {
            if (Array.isArray(pt) && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1]))) target.push(pt);
          });
        });
      });
    }
    return target;
  }

  function boundsFromFeatures(features) {
    const coords = [];
    (features || []).forEach((feature) => collectGeometryCoords(feature?.geometry, coords));
    const valid = coords.filter((c) => Array.isArray(c) && Number.isFinite(Number(c?.[0])) && Number.isFinite(Number(c?.[1])));
    if (!valid.length) return null;
    const xs = valid.map((c) => Number(c[0]));
    const ys = valid.map((c) => Number(c[1]));
    const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { minX, minY, maxX, maxY };
  }

  function mercatorWorld(lng, lat, zoom) {
    const size = 256 * (2 ** zoom);
    const sin = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180);
    return {
      x: (lng + 180) / 360 * size,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
      size
    };
  }

  function inverseMercator(x, y, size) {
    const lng = x / size * 360 - 180;
    const n = Math.PI - 2 * Math.PI * y / size;
    const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return [lng, lat];
  }

  function boundsForZoom(featureBounds, zoom, widthPx, heightPx) {
    const centerLng = (featureBounds.minX + featureBounds.maxX) / 2;
    const centerLat = (featureBounds.minY + featureBounds.maxY) / 2;
    const center = mercatorWorld(centerLng, centerLat, zoom);
    const nw = inverseMercator(center.x - widthPx / 2, center.y - heightPx / 2, center.size);
    const se = inverseMercator(center.x + widthPx / 2, center.y + heightPx / 2, center.size);
    return { minX: nw[0], maxY: nw[1], maxX: se[0], minY: se[1] };
  }

  function boundsContain(outer, inner) {
    return outer.minX <= inner.minX && outer.minY <= inner.minY && outer.maxX >= inner.maxX && outer.maxY >= inner.maxY;
  }

  function paddedBounds(bounds, factor = 0.14) {
    const dx = Math.max(0.00005, bounds.maxX - bounds.minX);
    const dy = Math.max(0.00005, bounds.maxY - bounds.minY);
    return { minX: bounds.minX - dx * factor, minY: bounds.minY - dy * factor, maxX: bounds.maxX + dx * factor, maxY: bounds.maxY + dy * factor };
  }

  function boundsWithAspect(bounds, widthPx, heightPx) {
    // Mantém a mesma proporção do quadro da prancha antes de pedir a imagem
    // cartográfica. Isso evita deslocamento entre a base do mapa e o desenho
    // do imóvel na planta de situação.
    const minX = Number(bounds.minX);
    const minY = Number(bounds.minY);
    const maxX = Number(bounds.maxX);
    const maxY = Number(bounds.maxY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let spanX = Math.max(0.00005, maxX - minX);
    let spanY = Math.max(0.00005, maxY - minY);
    const target = Math.max(0.1, widthPx / Math.max(1, heightPx));
    const current = spanX / spanY;
    if (current < target) spanX = spanY * target;
    else spanY = spanX / target;
    return { minX: cx - spanX / 2, maxX: cx + spanX / 2, minY: cy - spanY / 2, maxY: cy + spanY / 2 };
  }

  function effectiveMapBounds(featureBounds, zoom, w, h) {
    // Para documentos técnicos o imóvel nunca pode ficar perdido no centro da
    // imagem. O seletor de zoom passa a controlar apenas a quantidade de
    // contexto cartográfico ao redor do perímetro; o enquadramento continua
    // sendo calculado a partir do próprio imóvel e da proporção da prancha.
    const z = Math.max(1, Math.min(22, Number(zoom || 15)));
    const paddingByZoom = z >= 19 ? 0.12
      : z >= 17 ? 0.17
      : z >= 15 ? 0.24
      : z >= 13 ? 0.34
      : 0.46;
    return boundsWithAspect(paddedBounds(featureBounds, paddingByZoom), w, h);
  }

  function ruralReferenceMapBounds(featureBounds, zoom, w, h) {
    // O modelo lateral usa outro aspecto de mapa. O fundo cartográfico e a
    // geometria PRECISAM compartilhar exatamente os mesmos bounds para evitar
    // deformação/deslocamento. Também reservamos margem extra para cotas e
    // rótulos externos não encostarem nem serem cortados pelo quadro.
    const z = Math.max(1, Math.min(22, Number(zoom || 15)));
    const paddingByZoom = z >= 19 ? 0.20
      : z >= 17 ? 0.25
      : z >= 15 ? 0.34
      : z >= 13 ? 0.44
      : 0.56;
    return boundsWithAspect(paddedBounds(featureBounds, paddingByZoom), w, h);
  }

  function projector(bounds, box) {
    const spanX = Math.max(1e-9, bounds.maxX - bounds.minX);
    const spanY = Math.max(1e-9, bounds.maxY - bounds.minY);
    return ([lng, lat]) => [
      box.x + ((lng - bounds.minX) / spanX) * box.w,
      box.y + box.h - ((lat - bounds.minY) / spanY) * box.h
    ];
  }


  function toWebMercator(coord) {
    const [lng, latRaw] = coord;
    const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(latRaw || 0)));
    const x = 6378137 * Number(lng || 0) * Math.PI / 180;
    const y = 6378137 * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 360)));
    return [x, y];
  }

  function boundsToWebMercator(bounds) {
    const sw = toWebMercator([bounds.minX, bounds.minY]);
    const ne = toWebMercator([bounds.maxX, bounds.maxY]);
    return { minX: Math.min(sw[0], ne[0]), minY: Math.min(sw[1], ne[1]), maxX: Math.max(sw[0], ne[0]), maxY: Math.max(sw[1], ne[1]) };
  }

  function boundsFromWebMercator(mercatorBounds) {
    const lon = (x) => Number(x) * 180 / (Math.PI * 6378137);
    const lat = (y) => (2 * Math.atan(Math.exp(Number(y) / 6378137)) - Math.PI / 2) * 180 / Math.PI;
    return { minX:lon(mercatorBounds.minX), minY:lat(mercatorBounds.minY), maxX:lon(mercatorBounds.maxX), maxY:lat(mercatorBounds.maxY) };
  }

  function centeredMiniMapMercatorBounds(featureBounds, widthPx, heightPx, paddingFactor = 0.62) {
    const mercatorBase = boundsWithAspect(boundsToWebMercator(featureBounds), widthPx, heightPx);
    const spanX = Math.max(1, mercatorBase.maxX - mercatorBase.minX);
    const spanY = Math.max(1, mercatorBase.maxY - mercatorBase.minY);
    const cx = (mercatorBase.minX + mercatorBase.maxX) / 2;
    const cy = (mercatorBase.minY + mercatorBase.maxY) / 2;
    return {
      minX: cx - (spanX * (1 + paddingFactor * 2)) / 2,
      maxX: cx + (spanX * (1 + paddingFactor * 2)) / 2,
      minY: cy - (spanY * (1 + paddingFactor * 2)) / 2,
      maxY: cy + (spanY * (1 + paddingFactor * 2)) / 2
    };
  }

  function projectorMercator(bounds, box) {
    const spanX = Math.max(1e-9, bounds.maxX - bounds.minX);
    const spanY = Math.max(1e-9, bounds.maxY - bounds.minY);
    return (coord) => {
      const [mx, my] = toWebMercator(coord);
      return [
        box.x + ((mx - bounds.minX) / spanX) * box.w,
        box.y + box.h - ((my - bounds.minY) / spanY) * box.h
      ];
    };
  }

  function projectedFeatureCenter(feature, project, fallbackBox = null) {
    const geometry = feature?.geometry;
    let coordinate = null;
    try {
      if (globalThis.turf?.centroid) coordinate = globalThis.turf.centroid(feature)?.geometry?.coordinates || null;
    } catch (_error) {}
    if (!Array.isArray(coordinate) || coordinate.length < 2) {
      const ring = ringOfFeature(feature).filter((item) => Array.isArray(item) && item.length >= 2);
      if (ring.length) coordinate = [ring.reduce((sum,item)=>sum+Number(item[0]||0),0)/ring.length, ring.reduce((sum,item)=>sum+Number(item[1]||0),0)/ring.length];
    }
    if (Array.isArray(coordinate) && coordinate.length >= 2) return project(coordinate);
    return fallbackBox ? [fallbackBox.x + fallbackBox.w/2, fallbackBox.y + fallbackBox.h/2] : [0,0];
  }

  function projectedFeatureBounds(feature, project, fallbackBox = null) {
    const ring = ringOfFeature(feature).filter((coord) => Array.isArray(coord) && coord.length >= 2);
    const points = ring.map((coord) => project(coord)).filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
    if (points.length) {
      const xs = points.map((point) => Number(point[0]));
      const ys = points.map((point) => Number(point[1]));
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
      return { x, y, w, h };
    }
    return fallbackBox || { x:0, y:0, w:1, h:1 };
  }

  function svgDocumentVisualOverlay(feature, project, mapBox, settings = {}) {
    if (technicalMapBridge?.visualOverlayMarkup) return technicalMapBridge.visualOverlayMarkup(feature, project, mapBox, settings);
    if (technicalMapBridge?.areaNameMarkup) return technicalMapBridge.areaNameMarkup(feature, project, mapBox, settings);
    const geomBox=projectedFeatureBounds(feature,project,mapBox);
    const metadata = `<g class="sv-document-map-metadata" data-map-x="${mapBox.x}" data-map-y="${mapBox.y}" data-map-w="${mapBox.w}" data-map-h="${mapBox.h}" data-geom-x="${geomBox.x.toFixed(4)}" data-geom-y="${geomBox.y.toFixed(4)}" data-geom-w="${geomBox.w.toFixed(4)}" data-geom-h="${geomBox.h.toFixed(4)}"></g>`;
    const names=technicalMapBridge?.normalizeAreaNames?.(settings) || []; if(!names.length)return metadata;
    const readableLabelColor = technicalMapBridge?.readableLabelColor || ((value, fallback = '#111827') => normalizeHexColor(value, fallback));
    const globalAreaNameColor = readableLabelColor(settings?.areaNameColor || '#111827', '#111827');
    const [defaultX,defaultY]=projectedFeatureCenter(feature,project,mapBox);
    const labels=names.map((item,index)=>{const geometrySpace=item.coordinateSpace==='geometry-v1'&&Number.isFinite(item.xG)&&Number.isFinite(item.yG),x=geometrySpace?geomBox.x+item.xG*geomBox.w:(Number.isFinite(item.x)?mapBox.x+item.x*mapBox.w:defaultX+index*18),y=geometrySpace?geomBox.y+item.yG*geomBox.h:(Number.isFinite(item.y)?mapBox.y+item.y*mapBox.h:defaultY+index*18),scale=Math.max(.5,Math.min(3,Number(item.scale||1)||1)),rotation=Math.max(-180,Math.min(180,Number(item.rotation||0)||0)),textColor=readableLabelColor(item.color||globalAreaNameColor,globalAreaNameColor);return `<g class="sv-area-name-label" data-area-name-id="${escape(item.id)}" data-area-name-color="${escape(textColor)}" data-coordinate-space="${geometrySpace?'geometry-v1':''}" data-map-x="${mapBox.x}" data-map-y="${mapBox.y}" data-map-w="${mapBox.w}" data-map-h="${mapBox.h}" data-geom-x="${geomBox.x.toFixed(4)}" data-geom-y="${geomBox.y.toFixed(4)}" data-geom-w="${geomBox.w.toFixed(4)}" data-geom-h="${geomBox.h.toFixed(4)}" data-x="${x.toFixed(2)}" data-y="${y.toFixed(2)}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotation.toFixed(2)}) scale(${scale.toFixed(3)})"><text class="sv-area-name-text" x="0" y="5" text-anchor="middle" font-size="19" font-weight="800" fill="${textColor}" paint-order="stroke fill" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${escape(item.text)}</text></g>`;}).join('');
    return metadata+labels;
  }

  function svgForFeature(feature, project, visualSettings = null) {
    const geometry = feature?.geometry || {};
    const props = feature?.properties || {};
    const category = String(props.category || (props.generatedBy === 'map-glebas' ? 'gleba' : 'outros')).toLowerCase();
    const color = categoryColors[category] || categoryColors.outros;
    const weight = category === 'perimetro' ? 0.95 : (category === 'gleba' ? 1.15 : 2.5);
    const defaultOpacity = category === 'perimetro' ? 0.18 : (category === 'gleba' ? 0.30 : 0.20);
    const polygonStyle = documentPolygonStyle(feature, visualSettings, { color, opacity: defaultOpacity });
    const fillOpacity = visualSettings?.polygonFill === false || polygonStyle.fill === false ? 0 : polygonStyle.opacity;
    const polygonClass = `sv-document-editable-polygon${category === 'perimetro' ? ' sv-document-perimeter-fill' : ''}`;
    const polygon = (parts) => (parts || []).map((part) => `<polygon class="${polygonClass}" ${polygonDataAttrs(polygonStyle)} points="${(part || []).map(project).map((pt) => pt.join(',')).join(' ')}" fill="${polygonStyle.fillColor}" fill-opacity="${fillOpacity}" stroke="${polygonStyle.strokeColor}" stroke-width="${(weight*polygonStyle.strokeWidth).toFixed(3)}" vector-effect="non-scaling-stroke"/>`).join('');
    const line = (part) => `<polyline points="${(part || []).map(project).map((pt) => pt.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    const point = (coord) => { const [x, y] = project(coord); return `<circle cx="${x}" cy="${y}" r="2.3" fill="${color}" stroke="#fff" stroke-width="0.8"/>`; };
    if (geometry.type === 'Polygon') return polygon(geometry.coordinates);
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).map(polygon).join('');
    if (geometry.type === 'LineString') return `${svgServitudeCorridor(feature, project, { strokeWidth: 1.35, fillOpacity: .22 })}${line(geometry.coordinates)}${technicalMapBridge?.servitudeLabelMarkup?.(feature, project, { fontSize: 11, offset: 8 }) || ''}`;
    if (geometry.type === 'MultiLineString') return `${svgServitudeCorridor(feature, project, { strokeWidth: 1.35, fillOpacity: .22 })}${(geometry.coordinates || []).map(line).join('')}${technicalMapBridge?.servitudeLabelMarkup?.(feature, project, { fontSize: 11, offset: 8 }) || ''}`;
    if (geometry.type === 'Point') return point(geometry.coordinates);
    if (geometry.type === 'MultiPoint') return (geometry.coordinates || []).map(point).join('');
    return '';
  }

  function northArrow(x, y) {
    return `<g transform="translate(${x},${y})">
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

  function backgroundService(kind) {
    if (kind === 'none') return null;
    if (kind === 'road' || kind === 'osm') return 'World_Street_Map';
    if (kind === 'terrain' || kind === 'topo') return 'World_Topo_Map';
    if (kind === 'topographicReal' || kind === 'relief') return 'World_Physical_Map';
    return 'World_Imagery';
  }

  function backgroundSourceLabel(kind) {
    if (kind === 'sat' || kind === 'satOriginal') return 'IMAGEM DE SATÉLITE (MESMA BASE DO MAPA)';
    if (kind === 'hybrid') return 'IMAGEM DE SATÉLITE COM REFERÊNCIAS';
    if (kind === 'satClarity') return 'IMAGEM HISTÓRICA ESRI WORLD IMAGERY CLARITY';
    if (kind === 'satWayback2023') return 'IMAGEM HISTÓRICA ESRI WAYBACK 2023-12-07';
    return 'IMAGEM CARTOGRÁFICA DE REFERÊNCIA';
  }

  function isGoogleBackground(kind) {
    return kind === 'sat' || kind === 'satOriginal' || kind === 'hybrid';
  }

  function googleLayerCode(kind) {
    if (kind === 'hybrid') return 'y';
    return 's';
  }

  // Alternativa histórica mantida pela Esri (World Imagery Clarity).
  // A camada pode estar indisponível em certas regiões/níveis de zoom.
  // Não substitui o satélite atual sem escolha explícita do usuário.
  function backgroundTileBaseUrl(kind, service) {
    if (isGoogleBackground(kind)) return 'https://mt1.google.com/vt';
    if (kind === 'satClarity') return 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer';
    // WMTS da coleção Wayback com release identificado pela Esri (2023-12-07).
    if (kind === 'satWayback2023') return 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/56102';
    return `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer`;
  }

  function backgroundUrl(kind, bounds, width, height, options = {}) {
    // As bases do mesmo provedor do mapa interativo são compostas por tiles.
    // Não usam endpoint de exportação ArcGIS.
    if (isGoogleBackground(kind)) return '';
    const service = backgroundService(kind);
    if (!service) return '';
    const spatialRef = String(options.spatialRef || 4326);
    const params = new URLSearchParams({
      bbox: `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`,
      bboxSR: spatialRef, imageSR: spatialRef, size: `${Math.round(width)},${Math.round(height)}`,
      format: 'png32', transparent: 'false', f: 'image'
    });
    return `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/export?${params}`;
  }

  function backgroundUrls(kind, bounds, width, height) {
    const urls = [];
    const primary = backgroundUrl(kind, bounds, width, height);
    if (primary) urls.push(primary);
    if (kind !== 'none') {
      try {
        const mercatorBounds = boundsToWebMercator(bounds);
        const mercator = backgroundUrl(kind, mercatorBounds, width, height, { spatialRef: 102100 });
        if (mercator) urls.push(mercator);
      } catch (_error) {}
    }
    return [...new Set(urls.filter(Boolean))];
  }

  const embeddedAssetCache = new Map();

  function lonLatWorldPixel(lon, lat, zoom) {
    const z = Math.max(0, Math.min(22, Number(zoom) || 0));
    const scale = 256 * (2 ** z);
    const safeLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat) || 0));
    const x = ((Number(lon) + 180) / 360) * scale;
    const sin = Math.sin(safeLat * Math.PI / 180);
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    return [x, y];
  }

  async function imageBitmapFromBlob(blob) {
    if (!blob) return null;
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob); } catch (_error) {}
    }
    return await new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
      image.onerror = (error) => { URL.revokeObjectURL(objectUrl); reject(error); };
      image.src = objectUrl;
    });
  }

  function arcgisMaxUsefulZoom(kind) {
    if (isGoogleBackground(kind)) return 20;
    // World Imagery costuma devolver o tile cinza "Map data not yet available"
    // quando o documento força LOD acima da cobertura publicada para a região.
    // Mantemos a nitidez máxima útil sem ultrapassar o nível seguro da base.
    if (kind === 'satClarity' || kind === 'satWayback2023') return 18;
    if (kind === 'road' || kind === 'osm') return 19;
    return 18;
  }

  function arcgisTileZoomForViewport(bounds, width, height, zoomHint = 15, kind = 'sat') {
    const maxUsefulZoom = arcgisMaxUsefulZoom(kind);
    if (!bounds) return Math.max(2, Math.min(maxUsefulZoom, Math.round(Number(zoomHint) || 15)));
    const z0A = lonLatWorldPixel(bounds.minX, bounds.maxY, 0);
    const z0B = lonLatWorldPixel(bounds.maxX, bounds.minY, 0);
    const spanX0 = Math.max(1e-6, Math.abs(z0B[0] - z0A[0]));
    const spanY0 = Math.max(1e-6, Math.abs(z0B[1] - z0A[1]));
    const needX = Math.log2(Math.max(1, Number(width) || 1) / spanX0);
    const needY = Math.log2(Math.max(1, Number(height) || 1) / spanY0);
    const target = Math.ceil(Math.max(needX, needY));
    return Math.max(2, Math.min(maxUsefulZoom, Math.max(Math.round(Number(zoomHint) || 15), target)));
  }

  function arcgisTileRange(bounds, zoom) {
    const [leftPx, topPx] = lonLatWorldPixel(bounds.minX, bounds.maxY, zoom);
    const [rightPx, bottomPx] = lonLatWorldPixel(bounds.maxX, bounds.minY, zoom);
    const minTileX = Math.floor(Math.min(leftPx, rightPx) / 256);
    const maxTileX = Math.floor((Math.max(leftPx, rightPx) - 0.001) / 256);
    const minTileY = Math.floor(Math.min(topPx, bottomPx) / 256);
    const maxTileY = Math.floor((Math.max(topPx, bottomPx) - 0.001) / 256);
    const tileCount = Math.max(0, maxTileX - minTileX + 1) * Math.max(0, maxTileY - minTileY + 1);
    return {
      leftPx:Math.min(leftPx,rightPx), rightPx:Math.max(leftPx,rightPx),
      topPx:Math.min(topPx,bottomPx), bottomPx:Math.max(topPx,bottomPx),
      minTileX, maxTileX, minTileY, maxTileY, tileCount
    };
  }

  function arcgisRasterLooksUnavailable(image) {
    if (!image) return true;
    const sample = document.createElement('canvas');
    sample.width = 24; sample.height = 24;
    const ctx = sample.getContext('2d', { willReadFrequently:true });
    if (!ctx) return false;
    try {
      ctx.drawImage(image,0,0,24,24);
      const data = ctx.getImageData(0,0,24,24).data;
      let placeholderGray = 0;
      let visible = 0;
      for (let i=0;i<data.length;i+=4) {
        const a=data[i+3]; if(a<16) continue;
        const r=data[i],g=data[i+1],b=data[i+2]; visible+=1;
        const neutral=Math.max(r,g,b)-Math.min(r,g,b)<=5;
        const midGray=r>=170&&r<=225&&g>=170&&g<=225&&b>=170&&b<=225;
        if(neutral&&midGray) placeholderGray+=1;
      }
      return visible>0 && placeholderGray/visible>=0.62;
    } catch (_error) { return false; }
  }

  async function blobToDataUrl(blob) {
    if (!blob) return '';
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function backgroundTileUrl(kind, service, zoom, row, col) {
    const base = backgroundTileBaseUrl(kind, service);
    if (isGoogleBackground(kind)) return `${base}?lyrs=${googleLayerCode(kind)}&x=${col}&y=${row}&z=${zoom}`;
    return `${base}/tile/${zoom}/${row}/${col}`;
  }

  async function arcgisTileBackgroundDataUrl(kind, bounds, width, height, zoomHint = 15, timeoutMs = 6000) {
    const service = backgroundService(kind);
    if (!service || !bounds) return '';
    const targetWidth = Math.max(64, Math.round(Number(width) || 0));
    const targetHeight = Math.max(64, Math.round(Number(height) || 0));
    let zoom = arcgisTileZoomForViewport(bounds, targetWidth, targetHeight, zoomHint, kind);
    const minZoom = Math.max(2, Math.min(zoom, Math.max(12, Math.round(Number(zoomHint) || 15) - 3)));

    while (zoom >= minZoom) {
      const range = arcgisTileRange(bounds, zoom);
      if (!range.tileCount || range.tileCount > 64) { zoom -= 1; continue; }
      const key = `arcgis-tiles:${backgroundTileBaseUrl(kind, service)}:${zoom}:${bounds.minX.toFixed(7)},${bounds.minY.toFixed(7)},${bounds.maxX.toFixed(7)},${bounds.maxY.toFixed(7)}:${targetWidth}x${targetHeight}`;
      if (embeddedAssetCache.has(key)) return embeddedAssetCache.get(key);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth; canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha:false });
      if (!ctx) return '';
      ctx.fillStyle = '#eef2f6'; ctx.fillRect(0,0,targetWidth,targetHeight);
      const spanX = Math.max(1, range.rightPx - range.leftPx);
      const spanY = Math.max(1, range.bottomPx - range.topPx);
      const sx = targetWidth / spanX, sy = targetHeight / spanY;
      const worldTiles = 2 ** zoom;
      const jobs = [];
      for (let ty = range.minTileY; ty <= range.maxTileY; ty += 1) {
        if (ty < 0 || ty >= worldTiles) continue;
        for (let tx = range.minTileX; tx <= range.maxTileX; tx += 1) {
          const wrappedX = ((tx % worldTiles) + worldTiles) % worldTiles;
          jobs.push({ tx, ty, url:backgroundTileUrl(kind, service, zoom, ty, wrappedX) });
        }
      }

      let drawn = 0;
      await Promise.all(jobs.map(async (job) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(job.url, { mode:'cors', cache:'force-cache', signal:controller.signal });
          if (!response.ok) return;
          const image = await imageBitmapFromBlob(await response.blob());
          if (!image) return;
          if (arcgisRasterLooksUnavailable(image)) { if (typeof image.close === 'function') image.close(); return; }
          const dx = (job.tx * 256 - range.leftPx) * sx;
          const dy = (job.ty * 256 - range.topPx) * sy;
          ctx.drawImage(image, dx, dy, 256 * sx + 0.6, 256 * sy + 0.6);
          if (typeof image.close === 'function') image.close();
          drawn += 1;
        } catch (_error) {
          // O nível atual pode não ter cobertura. A rotina tenta automaticamente
          // um nível inferior antes de desistir do fundo cartográfico.
        } finally { clearTimeout(timer); }
      }));

      const minimumCoverage = jobs.length <= 2 ? 1 : Math.max(1, Math.ceil(jobs.length * 0.55));
      if (drawn >= minimumCoverage) {
        const rasterBackground = isGoogleBackground(kind) || kind === 'satClarity' || kind === 'satWayback2023' || kind === 'satOriginal';
        const result = canvas.toDataURL(rasterBackground ? 'image/jpeg' : 'image/png', rasterBackground ? 0.95 : undefined);
        if (result) embeddedAssetCache.set(key, result);
        return result;
      }
      zoom -= 1;
    }
    return '';
  }

  function arcgisSafeExportSize(kind, bounds, width, height, zoomHint = 15, pixelRatio = 1) {
    const desiredWidth = Math.max(64, Math.round((Number(width) || 0) * Math.max(1, Number(pixelRatio) || 1)));
    const desiredHeight = Math.max(64, Math.round((Number(height) || 0) * Math.max(1, Number(pixelRatio) || 1)));
    if (!bounds) return { width:desiredWidth, height:desiredHeight };
    const zoom = arcgisMaxUsefulZoom(kind);
    const [left, top] = lonLatWorldPixel(bounds.minX,bounds.maxY,zoom);
    const [right, bottom] = lonLatWorldPixel(bounds.maxX,bounds.minY,zoom);
    const maxWidth = Math.max(128,Math.ceil(Math.abs(right-left)*1.04));
    const maxHeight = Math.max(128,Math.ceil(Math.abs(bottom-top)*1.04));
    const scale = Math.min(1,maxWidth/desiredWidth,maxHeight/desiredHeight);
    return { width:Math.max(64,Math.round(desiredWidth*scale)), height:Math.max(64,Math.round(desiredHeight*scale)) };
  }

  async function resolveBackgroundImage(kind, bounds, width, height, zoom, options = {}) {
    if (!backgroundService(kind)) return '';
    const ratio = Math.max(1, Math.min(2, Number(options.pixelRatio || ((isGoogleBackground(kind) || kind === 'satClarity' || kind === 'satWayback2023') ? 1.6 : 1.35)) || 1));
    const safeSize = arcgisSafeExportSize(kind,bounds,width,height,zoom,ratio);
    const sourceWidth = Math.min(2400, safeSize.width);
    const sourceHeight = Math.min(1800, safeSize.height);
    const rawUrls = backgroundUrls(kind, bounds, sourceWidth, sourceHeight);
    const satellite = isGoogleBackground(kind) || kind === 'satClarity' || kind === 'satWayback2023';

    if (kind !== 'satClarity' && kind !== 'satWayback2023') {
      for (const url of rawUrls) {
        if (embeddedAssetCache.has(url)) return embeddedAssetCache.get(url);
      }
    }

    // Para imagem de satélite, nunca colocamos no SVG uma URL ArcGIS sem validar:
    // em áreas sem cobertura no LOD pedido o serviço devolve tiles cinza com a
    // mensagem "Map data not yet available". Primeiro montamos o mosaico em um
    // LOD seguro e descemos automaticamente se aquele nível não tiver imagem.
    if (satellite) {
      const tiled = await arcgisTileBackgroundDataUrl(kind,bounds,sourceWidth,sourceHeight,zoom,options.timeoutMs || 4500);
      if (tiled) return tiled;
      // Clarity é uma base de arquivo; não trocar silenciosamente a escolha por
      // World Imagery atual, que poderia voltar a exibir nuvens no PDF.
      if (isGoogleBackground(kind)) return '';
      if (kind === 'satClarity' || kind === 'satWayback2023') return '';
      const exported = await dataUrl(rawUrls, options.timeoutMs || 5000, { rejectArcgisUnavailable:true });
      if (exported) return exported;
      return '';
    }

    if (options.preferDirectUrl === true) return String(rawUrls[0] || '');
    const tileFirst = options.tileFirst === true;
    if (tileFirst) {
      const tiled = await arcgisTileBackgroundDataUrl(kind, bounds, sourceWidth, sourceHeight, zoom, 4500);
      if (tiled) return tiled;
    }
    const exported = await dataUrl(rawUrls, options.timeoutMs || 5000, { rejectArcgisUnavailable:true });
    if (exported) return exported;
    if (!tileFirst) {
      const tiled = await arcgisTileBackgroundDataUrl(kind, bounds, sourceWidth, sourceHeight, zoom, 5000);
      if (tiled) return tiled;
    }
    return '';
  }

  async function dataUrl(url, timeoutMs = 12000, options = {}) {
    if (!url || (Array.isArray(url) && !url.length)) return '';
    const rawCandidates = Array.isArray(url) ? url.filter(Boolean) : [url];
    const candidates = [];
    rawCandidates.forEach((candidate) => {
      if (!candidate) return;
      candidates.push(candidate);
      if (/services\.arcgisonline\.com/i.test(candidate)) candidates.push(candidate.replace(/services\.arcgisonline\.com/i, 'server.arcgisonline.com'));
    });
    let lastError = null;
    for (const candidate of [...new Set(candidates)]) {
      if (embeddedAssetCache.has(candidate)) return embeddedAssetCache.get(candidate);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(candidate, { mode: 'cors', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (options.rejectArcgisUnavailable === true) {
          const image = await imageBitmapFromBlob(blob);
          if (image) {
            const unavailable = arcgisRasterLooksUnavailable(image);
            if (typeof image.close === 'function') image.close();
            if (unavailable) throw new Error('ArcGIS retornou raster sem cobertura para este nível de detalhe.');
          }
        }
        const result = await blobToDataUrl(blob);
        if (result) embeddedAssetCache.set(candidate, result);
        return result;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
    }
    console.warn('Recurso externo não pôde ser incorporado ao SVG; o documento seguirá sem esse fundo.', lastError);
    // Nunca devolva a URL externa quebrada para dentro do SVG/PDF: isso fazia
    // o preview ficar aguardando indefinidamente por um recurso que já falhou.
    return '';
  }










  function svgWrappedText(text, x, y, options = {}) {
    const maxChars = Math.max(12, Number(options.maxChars || 38));
    const maxLines = Math.max(1, Number(options.maxLines || 2));
    const lineHeight = Number(options.lineHeight || 16);
    const words = [];
    String(text || '').trim().split(/\s+/).filter(Boolean).forEach((word) => {
      if (word.length <= maxChars) words.push(word);
      else for (let i = 0; i < word.length; i += maxChars) words.push(word.slice(i, i + maxChars));
    });
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) current = candidate;
      else { if (current) lines.push(current); current = word; }
      if (lines.length >= maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);
    const consumed = lines.join('').replace(/\s+/g, '').length;
    const total = String(text || '').replace(/\s+/g, '').length;
    if (total > consumed && lines.length) {
      lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(4, maxChars - 1)).trim()}…`;
    }
    const anchor = options.anchor || 'start';
    const size = Number(options.size || 12);
    const weight = options.weight || '400';
    const liveField = String(options.liveField || '').trim();
    const liveValueField = String(options.liveValueField || '').trim();
    const liveAttr = liveField ? ` data-live-field="${escape(liveField)}"` : (liveValueField ? ` data-live-field-value="${escape(liveValueField)}"` : '');
    return `<text${liveAttr} x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escape(line)}</tspan>`).join('')}</text>`;
  }


  function tinyLegendItem(x, y, color, label, dashed = false) {
    const dash = dashed ? ' stroke-dasharray="8 6"' : '';
    return `<rect x="${x}" y="${y - 12}" width="22" height="14" fill="${color}" fill-opacity=".22" stroke="${color}" stroke-width="2"${dash}/><text x="${x + 32}" y="${y}" font-size="13">${escape(label)}</text>`;
  }

  function scaleBarSvg(x, y, width, meters) {
    const raw = Math.max(1, meters);
    const pow = 10 ** Math.floor(Math.log10(raw));
    const candidates = [1, 2, 2.5, 5, 10].map((v) => v * pow);
    const nice = candidates.find((v) => v >= raw * 0.58) || candidates[candidates.length - 1];
    const barW = Math.max(120, Math.min(width, width * (nice / raw)));
    const segments = 4;
    const segmentW = barW / segments;
    const labels = [0, nice / 4, nice / 2, (nice * 3) / 4, nice].map((v) => Math.round(v));
    return `<g transform="translate(${x},${y})">
      ${Array.from({ length: segments }).map((_, i) => `<rect x="${i * segmentW}" y="0" width="${segmentW}" height="16" fill="${i % 2 ? '#fff' : '#111827'}" stroke="#111827" stroke-width="1"/>`).join('')}
      <line x1="0" y1="16" x2="${barW}" y2="16" stroke="#111827" stroke-width="2"/>
      ${labels.map((label, i) => `<text x="${i * segmentW}" y="35" text-anchor="middle" font-size="11">${label}</text>`).join('')}
      <text x="${barW + 18}" y="14" font-size="12">m</text>
    </g>`;
  }


  function technicalCoordinateTableSvg(coords = [], box, settings = {}) {
    if (!settings?.coordinateTableEnabled || !box) return '';
    let rows = Array.isArray(coords) ? coords.slice() : [];
    if (rows.length > 1) {
      const a = rows[0], b = rows[rows.length - 1];
      if (Array.isArray(a) && Array.isArray(b) && Number(a[0]) === Number(b[0]) && Number(a[1]) === Number(b[1])) rows = rows.slice(0, -1);
    }
    rows = rows.slice(0, Math.max(4, Math.min(12, Number(settings.coordinateTableRows || 8))));
    if (!rows.length) return '';
    const width = Math.min(350, Math.max(260, box.w * .43));
    const rowH = 20, headH = 24, height = headH + rows.length * rowH + 4;
    const x = box.x + box.w - width - 10, y = box.y + box.h - height - 10;
    const col1 = x + 9, col2 = x + width * .25, col3 = x + width * .63;
    const body = rows.map((coord, index) => {
      const yy = y + headH + index * rowH;
      const bg = index % 2 ? `<rect x="${x + 1}" y="${yy}" width="${width - 2}" height="${rowH}" fill="#f8fafc"/>` : '';
      const label = Array.isArray(settings?.vertexLabels) && settings.vertexLabels[index] ? String(settings.vertexLabels[index]) : `V-${String(index + 1).padStart(2,'0')}`;
      return `${bg}<text x="${col1}" y="${yy + 14}" font-size="9" fill="#334155">${escape(label)}</text><text x="${col2}" y="${yy + 14}" font-size="9" fill="#334155">${Number(coord[1]).toFixed(7)}</text><text x="${col3}" y="${yy + 14}" font-size="9" fill="#334155">${Number(coord[0]).toFixed(7)}</text><line x1="${x}" y1="${yy + rowH}" x2="${x + width}" y2="${yy + rowH}" stroke="#dbe3ee" stroke-width=".6"/>`;
    }).join('');
    return `<g class="sv-coordinate-table-overlay"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="#fff" fill-opacity=".96" stroke="#1f2937" stroke-width="1"/><rect x="${x}" y="${y}" width="${width}" height="${headH}" rx="4" fill="#dbeafe"/><text x="${col1}" y="${y + 16}" font-size="10" font-weight="800" fill="#10243c">Vértice</text><text x="${col2}" y="${y + 16}" font-size="10" font-weight="800" fill="#10243c">Latitude</text><text x="${col3}" y="${y + 16}" font-size="10" font-weight="800" fill="#10243c">Longitude</text>${body}</g>`;
  }

  function georefGrid(bounds, box, idSuffix = 'geo') {
    const lines = [];
    const vx = 5;
    const vy = 5;
    for (let i = 0; i <= vx; i += 1) {
      const x = box.x + (box.w * i / vx);
      const lng = bounds.minX + (bounds.maxX - bounds.minX) * i / vx;
      const edgePad = 6;
      const anchor = i === 0 ? 'start' : (i === vx ? 'end' : 'middle');
      const labelX = i === 0 ? x + edgePad : (i === vx ? x - edgePad : x);
      lines.push(`<line x1="${x}" y1="${box.y}" x2="${x}" y2="${box.y + box.h}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5 5"/>`);
      lines.push(`<text x="${x}" y="${box.y - 8}" text-anchor="middle" font-size="9">${num(lng, 4)}</text>`);
      lines.push(`<text x="${labelX}" y="${box.y + box.h + 20}" text-anchor="${anchor}" font-size="9">${num(lng, 4)}</text>`);
    }
    for (let i = 0; i <= vy; i += 1) {
      const y = box.y + (box.h * i / vy);
      const lat = bounds.maxY - (bounds.maxY - bounds.minY) * i / vy;
      lines.push(`<line x1="${box.x}" y1="${y}" x2="${box.x + box.w}" y2="${y}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5 5"/>`);
      if (i > 0 && i < vy) {
        lines.push(`<text x="${box.x - 12}" y="${y + 3}" text-anchor="middle" font-size="9" transform="rotate(-90,${box.x - 12},${y + 3})">${num(lat, 4)}</text>`);
        lines.push(`<text x="${box.x + box.w + 12}" y="${y + 3}" text-anchor="middle" font-size="9" transform="rotate(-90,${box.x + box.w + 12},${y + 3})">${num(lat, 4)}</text>`);
      }
    }
    return `<g id="grade-${idSuffix}">${lines.join('')}</g>`;
  }

  function svgForFeatureGeoref(feature, project, visualSettings = null) {
    const geometry = feature?.geometry || {};
    const props = feature?.properties || {};
    const category = String(props.category || (props.generatedBy === 'map-glebas' ? 'gleba' : 'outros')).toLowerCase();
    const color = categoryColors[category] || categoryColors.outros;
    const isGleba = category === 'gleba' || props.generatedBy === 'map-glebas';
    const isPerimeter = category === 'perimetro' || (!isGleba && category === 'outros' && /Polygon/.test(geometry.type || ''));
    const defaultColor = isPerimeter ? '#f2c313' : (isGleba ? '#b9782e' : color);
    const defaultOpacity = isPerimeter ? .14 : (isGleba ? .30 : .22);
    const polygonStyle = documentPolygonStyle(feature, visualSettings, { color: defaultColor, opacity: defaultOpacity });
    const polygon = (parts) => (parts || []).map((part) => {
      const pts = (part || []).map(project).map((pt) => pt.join(',')).join(' ');
      const fillOpacity = visualSettings?.polygonFill === false || polygonStyle.fill === false ? 0 : polygonStyle.opacity;
      const klass = `sv-document-editable-polygon${isPerimeter ? ' sv-document-perimeter-fill' : ''}`;
      const width = isPerimeter ? 1.15 : (isGleba ? 1.05 : .9);
      return `<polygon class="${klass}" ${polygonDataAttrs(polygonStyle)} points="${pts}" fill="${polygonStyle.fillColor}" fill-opacity="${fillOpacity}" stroke="${polygonStyle.strokeColor}" stroke-width="${(width*polygonStyle.strokeWidth).toFixed(3)}" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    const line = (part) => `<polyline points="${(part || []).map(project).map((pt) => pt.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    const point = (coord) => { const [x, y] = project(coord); return `<circle cx="${x}" cy="${y}" r="2.2" fill="${color}" stroke="#fff" stroke-width="0.8"/>`; };
    if (geometry.type === 'Polygon') return polygon(geometry.coordinates);
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).map(polygon).join('');
    if (geometry.type === 'LineString') return `${svgServitudeCorridor(feature, project, { strokeWidth: .9, fillOpacity: .20 })}${line(geometry.coordinates)}${technicalMapBridge?.servitudeLabelMarkup?.(feature, project, { fontSize: 10, offset: 7 }) || ''}`;
    if (geometry.type === 'MultiLineString') return `${svgServitudeCorridor(feature, project, { strokeWidth: .9, fillOpacity: .20 })}${(geometry.coordinates || []).map(line).join('')}${technicalMapBridge?.servitudeLabelMarkup?.(feature, project, { fontSize: 10, offset: 7 }) || ''}`;
    if (geometry.type === 'Point') return point(geometry.coordinates);
    if (geometry.type === 'MultiPoint') return (geometry.coordinates || []).map(point).join('');
    return '';
  }

  function cleanDocumentValue(value){
    const raw=String(value??'').trim();
    if(!raw)return '';
    const normalized=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return ['nao informado','nao informada','sem informacao','-','--'].includes(normalized)?'':raw;
  }
  function technicalIdentityRowsSvg(rows,x,y,{lineHeight=23,labelWidth=140,maxChars=38,size=14}={}){
    let currentY = y;
    return (Array.isArray(rows)?rows:[]).map((row)=>{
      const label=String(row?.label||'').trim();
      const value=cleanDocumentValue(row?.value);
      const field=String(row?.field||'').trim();
      const rawLines = Array.isArray(row?.lines) ? row.lines : String(value || '').split(/\n+/);
      const lines = rawLines.map((line)=>cleanDocumentValue(line)).filter(Boolean);
      if(!label)return '';
      const yy=currentY;
      const liveRowAttr=field?` data-live-field-row="${escape(field)}"`:'';
      const style=lines.length?'':' style="display:none"';
      const multiLineGap = Math.max(size + 4, 17);
      const content = (lines.length > 1
        ? lines.map((line,index)=>svgWrappedText(line,x+labelWidth,yy + (index * multiLineGap),{maxChars,maxLines:1,size,lineHeight:size+1,liveValueField:index===0?field:''})).join('')
        : svgWrappedText(lines[0] || '',x+labelWidth,yy,{maxChars,maxLines:1,size,lineHeight:size+1,liveValueField:field})
      );
      const extraLines = Math.max(0, lines.length - 1);
      const rowHeight = Math.max(lineHeight, lineHeight + (extraLines * multiLineGap));
      currentY += rowHeight;
      return `<g${liveRowAttr}${style}><text x="${x}" y="${yy}" font-size="${size}" font-weight="800">${escape(label)}</text>${content}</g>`;
    }).join('');
  }

  function liveElementAttrs(key, visible = true) {
    const id = escape(String(key || '').trim());
    return `data-live-element="${id}" aria-hidden="${visible ? 'false' : 'true'}"${visible ? '' : ' style="display:none"'}`;
  }

  function liveElementLayer(key, visible, markup) {
    const content = String(markup || '');
    if (!content) return '';
    const classKey = String(key || '').replace(/[^a-zA-Z0-9_-]/g,'');
    return `<g class="sv-live-element-layer sv-live-element-${classKey}" ${liveElementAttrs(key, visible)}>${content}</g>`;
  }

  function tagLiveElementNodes(markup, key, visible, markers = []) {
    let output = String(markup || '');
    if (!output) return '';
    const attrs = liveElementAttrs(key, visible);
    markers.forEach((marker) => {
      output = output.split(marker).join(`${marker.slice(0, marker.indexOf('class='))}${attrs} ${marker.slice(marker.indexOf('class='))}`);
    });
    return output;
  }

  function georefSheet({ p, feature, coords, features, featureBounds, sorted, areaHa, totalPerimeter, title, registration, custom, technician, publicUrl, qrData, logoData, miniMapData, zoom, renderOptions = {} }) {
    const W = 1600;
    const H = 1000;
    const frame = { x: 18, y: 18, w: 1564, h: 956 };
    const fold = { x: 18, y: 18, w: 72, h: 956 };
    const mapBox = { x: 112, y: 40, w: 800, h: 845 };
    const panel = { x: 930, y: 30, w: 622, h: 930 };
    const property = p.propertyName || p.title || p.name || 'Imóvel rural';
    const owner = cleanDocumentValue(window.GeoRuralProjects?.ownerNames?.(p) || p.owner || p.ownerName || p.metadata?.owner || '');
    const ownerPrimary = cleanDocumentValue(p.owner || p.ownerName || p.metadata?.owner || '');
    const ownerSecondary = cleanDocumentValue(window.GeoRuralProjects?.additionalOwner?.(p)?.name || '');
    const cityUf = cleanDocumentValue([p.city || p.municipality, p.uf || p.stateCode].filter(Boolean).join('/'));
    const comarca = cleanDocumentValue(String(renderOptions.district ?? $('mapDistrict')?.value ?? '').trim() || p.comarca || p.city || p.municipality || '');
    const registryOffice = cleanDocumentValue(String(renderOptions.registryOffice ?? $('mapRegistryOffice')?.value ?? '').trim() || p.cartorio || '');
    const incra = cleanDocumentValue(String(renderOptions.incra ?? $('mapIncra')?.value ?? '').trim() || p.incra || p.metadata?.incra || '');
    const cnib = cleanDocumentValue(String(renderOptions.cnib ?? $('mapCnib')?.value ?? '').trim() || p.cnib || p.metadata?.cnib || '');
    const scaleText = String(renderOptions.scaleText ?? $('mapScale')?.value ?? '').trim() || '1:3.500';
    const sheetNumber = String(renderOptions.sheetNumber ?? $('mapSheetNumber')?.value ?? '').trim() || 'ÚNICA';
    const date = new Date().toLocaleDateString('pt-BR');
    const bounds = paddedBounds(featureBounds, 0.22);
    const project = projector(bounds, mapBox);
    const visualSettings = documentVisualSettings(p);
    // Os pontos GPS são cadastro de campo e não símbolos cartográficos do
    // documento. O perímetro tem seus próprios vértices/cotas controláveis.
    const art = svgForFeatureGeoref(feature, project, visualSettings) + sorted
      .filter((f) => f !== feature && !['Point','MultiPoint'].includes(f?.geometry?.type))
      .map((f) => svgForFeatureGeoref(f, project, visualSettings)).join('');
    const areaNameLabel = svgDocumentVisualOverlay(feature, project, mapBox, visualSettings);
    const enabled = (key, id, fallback = true) => Object.prototype.hasOwnProperty.call(renderOptions, key) ? Boolean(renderOptions[key]) : optionEnabled(id, fallback);
    const showCotas = enabled('showCotas','mapShowCotas');
    const showGlebaCotas = enabled('showGlebaCotas','mapShowGlebaCotas', false);
    const showVertices = enabled('showVertices','mapShowVertices');
    const showConfrontantes = enabled('showConfrontantes','mapShowConfrontantes');
    const showNorth = enabled('showNorth','mapShowNorth');
    const showGrid = enabled('showGrid','mapShowGrid');
    const showScale = enabled('showScale','mapShowScale');
    const liveElementScene = renderOptions.fastPreview === true && String(renderOptions.page || document.body?.dataset?.page || '') === 'pranchas.html';
    const renderCotas = liveElementScene || showCotas;
    const renderGlebaCotas = liveElementScene || showGlebaCotas;
    const renderVertices = liveElementScene || showVertices;
    const renderConfrontantes = liveElementScene || showConfrontantes;
    const renderNorth = liveElementScene || showNorth;
    const renderGrid = liveElementScene || showGrid;
    const renderScale = liveElementScene || showScale;
    const autoLayout = automaticCartographicLayoutProfile(coords, project, 'technical-sheet');
    const confrontanteColors = buildConfrontanteColorMaps(feature, coords);
    const reservedLabelRects = [];
    const segmentLabelsRaw = renderConfrontantes ? smartConfrontanteLabels(feature, coords, project, mapBox, {
      // V44 — confrontantes precisam permanecer legíveis mesmo quando a prancha
      // inteira está reduzida dentro do editor. O tamanho é técnico e também
      // vale para o PDF/SVG final; não é um zoom artificial só da edição.
      fontSize: Math.max(14.5, autoLayout.confrontanteFontSize * 2.5),
      offset: Math.max(48, autoLayout.confrontanteOffset + 24),
      maxOffset: Math.max(132, autoLayout.confrontanteMaxOffset + 54),
      maxChars: 28,
      occupiedRects: reservedLabelRects,
      colorMaps: confrontanteColors,
      manualOffsets: readConfrontanteVisualOffsets(p),
      segmentOverrides: readConfrontanteSegmentOverrides(p),
      edgePadding: 10
    }) : '';
    const segmentLabels = liveElementScene ? tagLiveElementNodes(segmentLabelsRaw,'confrontantes',showConfrontantes,['<g class="sv-confrontante-callout']) : segmentLabelsRaw;
    const dimensionOccupiedLabels = [
      ...reservedLabelRects,
      ...projectedVertexProtectionRects(coords, project, autoLayout.count >= 30 ? 1.45 : 1.8)
    ];
    const dimensionMarksRaw = renderCotas ? cadDimensionLabels(coords, project, mapBox, {
      fontSize: autoLayout.dimensionFontSize,
      minFontSize: autoLayout.dimensionMinFontSize,
      offset: autoLayout.dimensionOffset,
      placement: 'outside',
      containerCoords: coords,
      occupiedLabels: dimensionOccupiedLabels,
      lockNormalOffset: true,
      compactResolver: (_a, _b, _index, projectedLength) => projectedLength < autoLayout.shortDimensionThreshold,
      outsideExtraOffset: autoLayout.dimensionExtraOffset,
      visualSettings
    }) : '';
    const dimensionMarks = liveElementScene ? tagLiveElementNodes(dimensionMarksRaw,'cotas',showCotas,['<g class="sv-cad-dimension-group']) : dimensionMarksRaw;
    const glebaMarksRaw = renderGlebaCotas ? glebaDimensionLabels(p, feature, project, mapBox, {
      fontSize: Math.max(1.60, autoLayout.dimensionFontSize - 0.32),
      minFontSize: Math.max(1.05, autoLayout.dimensionMinFontSize - 0.16),
      offset: Math.max(3.5, autoLayout.dimensionOffset - 2.6),
      placement: 'inside',
      occupiedLabels: dimensionOccupiedLabels,
      visualSettings
    }) : '';
    const glebaMarks = liveElementScene ? tagLiveElementNodes(glebaMarksRaw,'glebaCotas',showGlebaCotas,['<g class="sv-cad-dimension-group']) : glebaMarksRaw;
    const vertexMarksRaw = renderVertices ? croquiVertexMarks(coords, project, mapBox, {
      fontSize: autoLayout.vertexFontSize * documentVisualSettings(p).vertexScale,
      hiddenVertexIndexes: hiddenVertexIndexesForFeature(feature, coords),
      offset: autoLayout.vertexOffset,
      maxDistance: autoLayout.vertexMaxDistance,
      emergencyDistance: autoLayout.vertexEmergencyDistance,
      leaderThreshold: Math.max(3.0, autoLayout.vertexOffset + 1.0),
      pointRadius: autoLayout.critical ? 0.68 : 0.82,
      pointFill: '#111827',
      showAnchorDots: false,
      guideColor: '#ffffff',
      guideHalo: '#475569',
      clearGap: autoLayout.clearGap,
      edgePadding: 3.2,
      paddingX: 0.22,
      paddingY: 0.04,
      reservedRects: dimensionOccupiedLabels.filter((item) => item?.kind !== 'vertex-anchor'),
      vertexColorMap: {},
      clusterDistance: autoLayout.vertexClusterDistance,
      labelOffsets: documentVisualSettings(p).vertexLabelOffsets,
      labels: vertexLabelsForFeature(feature, Math.max(0, coords.length - 1)),
      strictPlacement: true
    }) : '';
    const vertexMarks = liveElementScene ? tagLiveElementNodes(vertexMarksRaw,'vertices',showVertices,['<circle class="sv-vertex-anchor','<text class="sv-inline-label sv-vertex-label']) : vertexMarksRaw;
    const mapWidthMeters = hav([bounds.minX, bounds.minY], [bounds.maxX, bounds.minY]);
    const mini = { x: panel.x + 34, y: panel.y + 614, w: 330, h: 210 };
    const miniMercatorBounds = centeredMiniMapMercatorBounds(boundsFromFeatures([feature]) || featureBounds, mini.w, mini.h);
    const miniProject = projectorMercator(miniMercatorBounds, mini);
    const miniPerimeter = svgForFeatureGeoref(feature, miniProject);
    const publicShort = publicUrl || custom.websiteUrl || '';
    const companyName = custom.companyName || 'Surveyor';
    const companySmall = custom.footerText || custom.address || '';
    const titleText = (title || 'PLANTA DO IMÓVEL GEORREFERENCIADO').replace(/RURAL$/i, 'GEORREFERENCIADO');
    return `<svg class="georef-sheet-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI', Arial, Helvetica, sans-serif">
      <rect width="${W}" height="${H}" fill="#f8fafc"/>
      <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="#fff" stroke="#111827" stroke-width="3"/>
      <path d="M${fold.x},${fold.y + 62} L${fold.x + 64},${fold.y + 6} L${fold.x + 64},${fold.y + frame.h - 6} L${fold.x},${fold.y + frame.h - 62}" fill="#fff" stroke="#111827" stroke-width="1.5"/>
      <line x1="${fold.x}" y1="${fold.y + frame.h / 2}" x2="${fold.x + 64}" y2="${fold.y + frame.h / 2}" stroke="#111827"/>

      <rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="#f8fafc" stroke="#111827" stroke-width="1.4"/>
      ${renderGrid ? (liveElementScene ? liveElementLayer('grid',showGrid,georefGrid(bounds,mapBox,'principal')) : georefGrid(bounds,mapBox,'principal')) : ''}
      <defs><clipPath id="mapClipGeo"><rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}"/></clipPath></defs>
      <g clip-path="url(#mapClipGeo)">
        ${art}
        ${areaNameLabel}
        ${dimensionMarks}
        ${glebaMarks}
        ${segmentLabels}
        ${vertexMarks}
        ${technicalCoordinateTableSvg(coords, mapBox, {...visualSettings,vertexLabels:vertexLabelsForFeature(feature,Math.max(0,coords.length-1))})}
      </g>
      ${renderNorth ? (liveElementScene ? liveElementLayer('north',showNorth,northArrow(mapBox.x + 72,mapBox.y + 110)) : northArrow(mapBox.x + 72,mapBox.y + 110)) : ''}
      ${renderScale ? `${liveElementScene ? `<text class="sv-live-element-scale" ${liveElementAttrs('scale',showScale)} data-live-field="mapScaleGraphic" x="${mapBox.x + mapBox.w / 2}" y="${mapBox.y + mapBox.h + 31}" text-anchor="middle" font-size="13">Escala Gráfica ${escape(scaleText)}</text>${liveElementLayer('scale',showScale,scaleBarSvg(mapBox.x + 90, mapBox.y + mapBox.h + 50, 560, mapWidthMeters * 0.55))}` : `<text data-live-field="mapScaleGraphic" x="${mapBox.x + mapBox.w / 2}" y="${mapBox.y + mapBox.h + 31}" text-anchor="middle" font-size="13">Escala Gráfica ${escape(scaleText)}</text>${scaleBarSvg(mapBox.x + 90, mapBox.y + mapBox.h + 50, 560, mapWidthMeters * 0.55)}`}` : ''}

      <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" fill="#fff" stroke="#111827" stroke-width="2"/>
      <rect x="${panel.x + 34}" y="${panel.y + 12}" width="410" height="76" rx="3" fill="#fff" stroke="#111827" stroke-width="1.2" opacity=".98"/>
      ${svgWrappedText(companyName, panel.x + 239, panel.y + 44, { maxChars: 30, maxLines: 2, size: 18, lineHeight: 20, anchor: 'middle', weight: '900' })}
      ${companySmall ? svgWrappedText(companySmall, panel.x + 239, panel.y + 78, { maxChars: 42, maxLines: 1, size: 10, lineHeight: 12, anchor: 'middle', weight: '700' }) : ''}
      ${logoData ? `<image data-live-asset="logo" href="${logoData}" x="${panel.x + 482}" y="${panel.y + 12}" width="86" height="76" preserveAspectRatio="xMidYMid meet"/>` : `<image data-live-asset="logo" x="${panel.x + 482}" y="${panel.y + 12}" width="86" height="76" preserveAspectRatio="xMidYMid meet" display="none"/>`}

      <rect x="${panel.x + 16}" y="${panel.y + 106}" width="430" height="84" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
      <text data-live-field="mapTitle" x="${panel.x + 231}" y="${panel.y + 158}" text-anchor="middle" font-size="20">${escape(titleText)}</text>
      <rect x="${panel.x + 462}" y="${panel.y + 106}" width="142" height="84" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
      <text x="${panel.x + 533}" y="${panel.y + 136}" text-anchor="middle" font-size="16">Folha:</text>
      <text data-live-field="mapSheetNumber" x="${panel.x + 533}" y="${panel.y + 166}" text-anchor="middle" font-size="17" font-weight="800">${escape(sheetNumber)}</text>

      <rect x="${panel.x + 16}" y="${panel.y + 206}" width="588" height="214" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
      <g font-size="14" fill="#111827">
        ${technicalIdentityRowsSvg([
          {label:'IMÓVEL:',value:property},
          {label:'PROPRIETÁRIO:',value:owner,lines:ownerSecondary?[ownerPrimary,ownerSecondary]:[ownerPrimary || owner]},
          {label:'MUNICÍPIO/UF:',value:cityUf},
          {label:'COMARCA:',value:comarca,field:'mapDistrict'},
          {label:'CARTÓRIO:',value:registryOffice,field:'mapRegistryOffice'},
          {label:'DOCUMENTO:',value:registration,field:'mapRegistration'},
          {label:'CÓDIGO INCRA:',value:incra,field:'mapIncra'},
          {label:'Número CIB:',value:cnib,field:'mapCnib'}
        ],panel.x+34,panel.y+232,{lineHeight:21,labelWidth:145,maxChars:39,size:13.5})}
        <line x1="${panel.x + 28}" y1="${panel.y + 384}" x2="${panel.x + 592}" y2="${panel.y + 384}" stroke="#111827" stroke-opacity=".45"/>
        <text x="${panel.x + 34}" y="${panel.y + 402}" font-weight="800">ÁREA:</text><text x="${panel.x + 94}" y="${panel.y + 402}">${num(areaHa,4)} ha</text>
        <text x="${panel.x + 290}" y="${panel.y + 402}" font-weight="800">PERÍMETRO:</text><text x="${panel.x + 405}" y="${panel.y + 402}">${num(totalPerimeter,2)} m</text>
        <text x="${panel.x + 34}" y="${panel.y + 416}" font-size="13" font-weight="800">DATA:</text><text x="${panel.x + 92}" y="${panel.y + 416}" font-size="13">${date}</text>
        <text x="${panel.x + 290}" y="${panel.y + 416}" font-size="13" font-weight="800">ESCALA:</text><text data-live-field="mapScale" x="${panel.x + 366}" y="${panel.y + 416}" font-size="13">${escape(scaleText)}</text>
      </g>

      <rect x="${panel.x + 16}" y="${panel.y + 438}" width="588" height="112" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
      <text x="${panel.x + 32}" y="${panel.y + 462}" font-size="13">Quadro de Assinaturas Proprietário(s):</text>
      ${ownerSecondary ? `<line x1="${panel.x + 44}" y1="${panel.y + 506}" x2="${panel.x + 288}" y2="${panel.y + 506}" stroke="#111827"/>
      <line x1="${panel.x + 330}" y1="${panel.y + 506}" x2="${panel.x + 574}" y2="${panel.y + 506}" stroke="#111827"/>
      ${svgWrappedText(ownerPrimary, panel.x + 166, panel.y + 522, { maxChars: 30, maxLines: 2, size: 10, lineHeight: 12, anchor: 'middle' })}
      ${svgWrappedText(ownerSecondary, panel.x + 452, panel.y + 522, { maxChars: 30, maxLines: 2, size: 10, lineHeight: 12, anchor: 'middle' })}` : `<line x1="${panel.x + 142}" y1="${panel.y + 506}" x2="${panel.x + 478}" y2="${panel.y + 506}" stroke="#111827"/>
      ${svgWrappedText(owner, panel.x + 310, panel.y + 522, { maxChars: 44, maxLines: 2, size: 11, lineHeight: 13, anchor: 'middle' })}`}

      <g data-live-asset-layer="miniMap">
        <rect x="${panel.x + 16}" y="${panel.y + 570}" width="366" height="270" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
        <text x="${panel.x + 199}" y="${panel.y + 594}" text-anchor="middle" font-size="15" font-weight="800">PLANTA DE SITUAÇÃO</text>
        <rect x="${mini.x}" y="${mini.y}" width="${mini.w}" height="${mini.h}" fill="#f1f5f9" stroke="#111827" stroke-width="1.5"/>
        <image data-live-asset-value="miniMap" ${miniMapData ? `href="${escape(miniMapData)}"` : 'display="none"'} x="${mini.x}" y="${mini.y}" width="${mini.w}" height="${mini.h}" preserveAspectRatio="none" opacity="${Math.max(.2,Math.min(1,Number(visualSettings.miniMapOpacity ?? .88)||.88))}"/>
        <g data-mini-map-perimeter${visualSettings.miniMapPerimeterVisible===false?' style="display:none"':''}>${miniPerimeter}</g>
        <text x="${mini.x + 8}" y="${mini.y + mini.h - 9}" font-size="9" fill="#334155">Referência cartográfica</text>
      </g>

      <rect x="${panel.x + 396}" y="${panel.y + 570}" width="208" height="270" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
      <text x="${panel.x + 500}" y="${panel.y + 590}" text-anchor="middle" font-size="11" font-weight="800">Quadro de Áreas</text>
      <text x="${panel.x + 500}" y="${panel.y + 604}" text-anchor="middle" font-size="11" font-weight="800">e Perímetros</text>
      <text x="${panel.x + 422}" y="${panel.y + 630}" font-size="12">Área(ha)</text><text x="${panel.x + 512}" y="${panel.y + 630}" font-size="12">Perímetro(m)</text>
      <text x="${panel.x + 414}" y="${panel.y + 654}" font-size="12">Total:</text><text x="${panel.x + 460}" y="${panel.y + 654}" font-size="12">${num(areaHa,4)}</text><text x="${panel.x + 536}" y="${panel.y + 654}" font-size="12">${num(totalPerimeter,2)}</text>
      <text x="${panel.x + 414}" y="${panel.y + 724}" font-size="10.5">Resp. Técnico:</text>
      ${documentSignatureMarkup({ p, custom, width:W, height:H, defaultX:panel.x + 502, defaultY:panel.y + 764 })}
      <line x1="${panel.x + 430}" y1="${panel.y + 766}" x2="${panel.x + 574}" y2="${panel.y + 766}" stroke="#111827"/>
      <rect x="${panel.x + 424}" y="${panel.y + 786}" width="156" height="38" fill="#fff" stroke="#111827" stroke-width="0" opacity="1"/>
      ${svgWrappedText(cleanDocumentValue(technician),panel.x + 502,panel.y + 810,{maxChars:20,maxLines:1,size:11,lineHeight:12,anchor:'middle',weight:'800',liveField:'mapTechnician'})}

      <rect x="${panel.x + 16}" y="${panel.y + 856}" width="588" height="86" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
      <text x="${panel.x + 36}" y="${panel.y + 880}" font-size="12" font-weight="700">Local do Imóvel:</text>
      ${qrData ? `<image href="${qrData}" x="${panel.x + 36}" y="${panel.y + 890}" width="44" height="44"/>` : ''}
      <text x="${panel.x + 96}" y="${panel.y + 900}" font-size="8.5" font-weight="800">Link público:</text>
      ${svgWrappedText(publicShort || 'Link público indisponível', panel.x + 96, panel.y + 912, { maxChars: 70, maxLines: 3, size: 7.4, lineHeight: 9 })}
    </svg>`;
  }

  function technicalFooter({ p, feature, coords, areaHa, totalPerimeter, publicUrl, qrData, logoData, mapBox, footerBox, mapTitle, registration, technician, zoom, custom = {}, showCotas = false, showGlebaCotas = false, showVertices = false }) {
    const owner = cleanDocumentValue(window.GeoRuralProjects?.ownerNames?.(p) || p.owner || p.ownerName || p.metadata?.owner || '');
    const cityUf = [p.city || p.municipality, p.uf || p.stateCode].filter(Boolean).join('/');
    const property = p.propertyName || p.title || p.name || 'Imóvel rural';
    const date = new Date().toLocaleDateString('pt-BR');
    const visualSettings=documentVisualSettings(p);
    const legendEntries=documentLegendEntries(p,feature,visualSettings,{showCotas,showGlebaCotas,showVertices,max:5});
    const leftW = 390;
    const midW = 435;
    const rightX = footerBox.x + leftW + midW;
    const rightW = footerBox.w - leftW - midW;
    const legend = legendEntries.map((entry, index) => legendEntryMarkup(entry, footerBox.x + 158, footerBox.y + 130 + index * 20, { size:12, swatchWidth:16 })).join('');
    const publicShort = publicUrl || '';
    return `
      <g class="sv-technical-footer" fill="#0f172a">
      <rect x="${footerBox.x}" y="${footerBox.y}" width="${footerBox.w}" height="${footerBox.h}" fill="#fff" stroke="#111827" stroke-width="2"/>
      <line x1="${footerBox.x + leftW}" y1="${footerBox.y}" x2="${footerBox.x + leftW}" y2="${footerBox.y + footerBox.h}" stroke="#111827" stroke-width="1.4"/>
      <line x1="${rightX}" y1="${footerBox.y}" x2="${rightX}" y2="${footerBox.y + footerBox.h}" stroke="#111827" stroke-width="1.4"/>
      <line x1="${footerBox.x}" y1="${footerBox.y + 88}" x2="${footerBox.x + leftW}" y2="${footerBox.y + 88}" stroke="#111827" stroke-width="1"/>
      <line x1="${footerBox.x + leftW}" y1="${footerBox.y + 151}" x2="${rightX}" y2="${footerBox.y + 151}" stroke="#111827" stroke-width="1"/>

      <text x="${footerBox.x + 195}" y="${footerBox.y + 21}" text-anchor="middle" font-size="12" font-weight="700">SISTEMA DE COORDENADAS</text>
      <text x="${footerBox.x + 195}" y="${footerBox.y + 38}" text-anchor="middle" font-size="12" font-weight="700">GEOGRÁFICAS</text>
      <text x="${footerBox.x + 148}" y="${footerBox.y + 60}" font-size="10.5" font-weight="650">Datum:</text>
      <text x="${footerBox.x + 190}" y="${footerBox.y + 60}" font-size="10.5">SIRGAS 2000</text>
      <text x="${footerBox.x + 148}" y="${footerBox.y + 77}" font-size="10.5" font-weight="650">Tipo:</text>
      <text x="${footerBox.x + 181}" y="${footerBox.y + 77}" font-size="10.5">DD (graus decimais)</text>
      <text x="${footerBox.x + 318}" y="${footerBox.y + 60}" text-anchor="end" font-size="9.5" fill="#475569">Zoom ${zoom}</text>
      ${qrData ? `<image href="${qrData}" x="${footerBox.x + 24}" y="${footerBox.y + 110}" width="100" height="100"/><text x="${footerBox.x + 74}" y="${footerBox.y + 226}" text-anchor="middle" font-size="10">Mapa público</text>` : `<rect x="${footerBox.x + 24}" y="${footerBox.y + 110}" width="100" height="100" fill="#f8fafc" stroke="#cbd5e1"/><text x="${footerBox.x + 74}" y="${footerBox.y + 164}" text-anchor="middle" font-size="10" fill="#64748b">QR indisponível</text>`}
      <text x="${footerBox.x + 158}" y="${footerBox.y + 113}" font-size="14" font-weight="700">LEGENDAS</text>
      ${legend}

      <text x="${footerBox.x + leftW + midW / 2}" y="${footerBox.y + 27}" text-anchor="middle" font-size="16" font-weight="700">DADOS DO IMÓVEL</text>
      <text x="${footerBox.x + 410}" y="${footerBox.y + 57}" font-size="13" font-weight="600">Imóvel:</text>
      ${svgWrappedText(property, footerBox.x + 470, footerBox.y + 57, { maxChars: 38, maxLines: 2, size: 12, lineHeight: 15 })}
      ${cleanDocumentValue(registration)?`<text x="${footerBox.x + 410}" y="${footerBox.y + 85}" font-size="13"><tspan font-weight="600">Matrícula:</tspan> ${escape(registration)}</text>`:''}
      ${cleanDocumentValue(cityUf)?`<text x="${footerBox.x + 410}" y="${footerBox.y + 111}" font-size="13"><tspan font-weight="600">Município/UF:</tspan> ${escape(cityUf)}</text>`:''}
      <text x="${footerBox.x + 410}" y="${footerBox.y + 136}" font-size="13"><tspan font-weight="600">Área:</tspan> ${num(areaHa, 4)} ha</text>
      <text x="${footerBox.x + 615}" y="${footerBox.y + 136}" font-size="13"><tspan font-weight="600">Perímetro:</tspan> ${num(totalPerimeter, 2)} m</text>
      ${owner?`<text x="${footerBox.x + 410}" y="${footerBox.y + 178}" font-size="13" font-weight="600">Proprietário(a):</text>${svgWrappedText(owner,footerBox.x+410,footerBox.y+190,{maxChars:38,maxLines:3,size:10,lineHeight:12})}`:''}
      ${cleanDocumentValue(technician)?`<text x="${footerBox.x + 610}" y="${footerBox.y + 178}" font-size="13" font-weight="600">Responsável técnico(a):</text>${svgWrappedText(technician,footerBox.x+610,footerBox.y+196,{maxChars:30,maxLines:2,size:11.5,lineHeight:14})}`:''}
      <text x="${footerBox.x + 410}" y="${footerBox.y + 232}" font-size="12"><tspan font-weight="600">Data:</tspan> ${date}</text>

      <defs><clipPath id="footerBrandClip"><rect x="${rightX + 8}" y="${footerBox.y + 8}" width="${rightW - 16}" height="${footerBox.h - 16}"/></clipPath></defs>
      <g clip-path="url(#footerBrandClip)">
        ${logoData ? `<image href="${logoData}" x="${rightX + (rightW - 116) / 2}" y="${footerBox.y + 28}" width="116" height="56" preserveAspectRatio="xMidYMid meet"/>` : ''}
        ${svgWrappedText(custom.companyName || 'GeoRural Pro', rightX + rightW / 2, footerBox.y + 112, { maxChars: 24, maxLines: 2, size: 12, lineHeight: 14, weight: '700', anchor: 'middle' })}
        <text x="${rightX + rightW / 2}" y="${footerBox.y + 150}" text-anchor="middle" font-size="10.5">Prancha técnica gerada digitalmente</text>
        <text x="${rightX + 18}" y="${footerBox.y + 176}" font-size="9" font-weight="600" fill="#0f172a">Link do mapa:</text>
        ${svgWrappedText(publicShort || custom.websiteUrl || '', rightX + 18, footerBox.y + 190, { maxChars: 26, maxLines: 4, size: 9.5, lineHeight: 11.5, anchor: 'start' })}
      </g>
      </g>`;
  }


  function sirgasUtm(lng, lat) {
    const longitude = Number(lng);
    const latitude = Number(lat);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    const zone = Math.max(1, Math.min(60, Math.floor((longitude + 180) / 6) + 1));
    const a = 6378137.0;
    const invF = 298.257222101;
    const f = 1 / invF;
    const e2 = f * (2 - f);
    const ep2 = e2 / (1 - e2);
    const k0 = 0.9996;
    const rad = Math.PI / 180;
    const phi = latitude * rad;
    const lambda = longitude * rad;
    const lambda0 = ((zone - 1) * 6 - 180 + 3) * rad;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const tanPhi = Math.tan(phi);
    const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
    const T = tanPhi * tanPhi;
    const C = ep2 * cosPhi * cosPhi;
    const A = cosPhi * (lambda - lambda0);
    const e4 = e2 * e2;
    const e6 = e4 * e2;
    const M = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
      - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
      + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
      - (35 * e6 / 3072) * Math.sin(6 * phi));
    const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let northing = k0 * (M + N * tanPhi * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (latitude < 0) northing += 10000000;
    return { zone, hemisphere: latitude < 0 ? 'S' : 'N', easting, northing };
  }

  function ruralReferenceSheet({ p, feature, coords, features, featureBounds, areaHa, totalPerimeter, title, registration, custom, technician, publicUrl, qrData, logoData, backgroundData, miniMapData, backgroundKind = 'sat', zoom, showCotas, showGlebaCotas, showVertices, showConfrontantes, showNorth, showScale, confrontanteColors, liveElementScene = false }) {
    const W = 1600;
    const H = 1180;
    const frame = { x: 6, y: 6, w: 1588, h: 1168 };
    const mapBox = { x: 24, y: 116, w: 1180, h: 748 };
    const side = { x: 1218, y: 116, w: 356, h: 748 };
    const footer = { x: 24, y: 884, w: 1550, h: 248 };
    const mapBounds = ruralReferenceMapBounds(featureBounds, zoom, mapBox.w, mapBox.h);
    const mapProject = projector(mapBounds, mapBox);
    const rootVisualSettings=documentVisualSettings(p),rootPolygonStyle=documentPolygonStyle(feature,rootVisualSettings,{color:'#f2c313',opacity:.15}); const rootFill = svgStyledPerimeter(feature, coords, mapProject, confrontanteColors, { polygonKey:rootPolygonStyle.key, polygonName:rootPolygonStyle.name, polygonCategory:rootPolygonStyle.category, fillColor: rootPolygonStyle.fillColor, fillOpacity: rootVisualSettings.polygonFill && rootPolygonStyle.fill ? rootPolygonStyle.opacity : 0, defaultStroke: rootPolygonStyle.strokeColor, strokeWidth: 1.75 * rootPolygonStyle.strokeWidth });
    const innerArt = features.filter((f) => f !== feature && !['Point','MultiPoint'].includes(f?.geometry?.type)).map((f) => svgForFeature(f, mapProject, documentVisualSettings(p))).join('');
    const rootOutline = '';
    const areaNameLabel = svgDocumentVisualOverlay(feature, mapProject, mapBox, rootVisualSettings);
    const autoLayout = automaticCartographicLayoutProfile(coords, mapProject, 'rural-reference');
    const reservedLabelRects = [];
    const renderConfrontantes = liveElementScene || showConfrontantes;
    const segmentLabelsRaw = renderConfrontantes ? smartConfrontanteLabels(feature, coords, mapProject, mapBox, {
      fontSize: Math.max(12.5, autoLayout.confrontanteFontSize * 1.75),
      offset: Math.max(30, autoLayout.confrontanteOffset + 8),
      maxOffset: Math.max(96, autoLayout.confrontanteMaxOffset + 24),
      maxChars: 28,
      occupiedRects: reservedLabelRects,
      colorMaps: confrontanteColors,
      manualOffsets: readConfrontanteVisualOffsets(p),
      segmentOverrides: readConfrontanteSegmentOverrides(p)
    }) : '';
    const segmentLabels = liveElementScene ? tagLiveElementNodes(segmentLabelsRaw,'confrontantes',showConfrontantes,['<g class="sv-confrontante-callout']) : segmentLabelsRaw;
    const dimensionOccupiedLabels = [
      ...reservedLabelRects,
      ...projectedVertexProtectionRects(coords, mapProject, autoLayout.count >= 30 ? 1.55 : 1.95)
    ];
    const renderCotas = liveElementScene || showCotas;
    const dimensionMarksRaw = renderCotas ? cadDimensionLabels(coords, mapProject, mapBox, {
      fontSize: autoLayout.dimensionFontSize,
      minFontSize: autoLayout.dimensionMinFontSize,
      offset: Math.max(6.4, autoLayout.dimensionOffset),
      placement: 'outside',
      containerCoords: coords,
      occupiedLabels: dimensionOccupiedLabels,
      lockNormalOffset: true,
      compactResolver: (_a, _b, _index, projectedLength) => projectedLength < autoLayout.shortDimensionThreshold,
      outsideExtraOffset: autoLayout.dimensionExtraOffset,
      visualSettings: rootVisualSettings
    }) : '';
    const dimensionMarks = liveElementScene ? tagLiveElementNodes(dimensionMarksRaw,'cotas',showCotas,['<g class="sv-cad-dimension-group']) : dimensionMarksRaw;
    const renderGlebaCotas = liveElementScene || showGlebaCotas;
    const glebaMarksRaw = renderGlebaCotas ? glebaDimensionLabels(p, feature, mapProject, mapBox, {
      fontSize: Math.max(1.65, autoLayout.dimensionFontSize - 0.42),
      minFontSize: Math.max(1.18, autoLayout.dimensionMinFontSize - 0.18),
      offset: Math.max(3.7, autoLayout.dimensionOffset - 2.4),
      placement: 'inside',
      occupiedLabels: dimensionOccupiedLabels,
      visualSettings: rootVisualSettings
    }) : '';
    const glebaMarks = liveElementScene ? tagLiveElementNodes(glebaMarksRaw,'glebaCotas',showGlebaCotas,['<g class="sv-cad-dimension-group']) : glebaMarksRaw;
    const vertexReservedRects = dimensionOccupiedLabels.filter((item) => item?.kind !== 'vertex-anchor');
    const renderVertices = liveElementScene || showVertices;
    const vertexMarksRaw = renderVertices ? croquiVertexMarks(coords, mapProject, mapBox, {
      fontSize: autoLayout.vertexFontSize * documentVisualSettings(p).vertexScale,
      hiddenVertexIndexes: hiddenVertexIndexesForFeature(feature, coords),
      offset: autoLayout.vertexOffset,
      maxDistance: autoLayout.vertexMaxDistance,
      emergencyDistance: autoLayout.vertexEmergencyDistance,
      leaderThreshold: Math.max(3.0, autoLayout.vertexOffset + 1.0),
      pointRadius: autoLayout.count >= 40 ? 0.72 : 0.92,
      pointFill: '#111827',
      showAnchorDots: false,
      guideColor: '#ffffff',
      guideHalo: '#475569',
      clearGap: autoLayout.clearGap,
      edgePadding: 3.2,
      paddingX: 0.24,
      paddingY: 0.05,
      reservedRects: vertexReservedRects,
      vertexColorMap: {},
      clusterDistance: autoLayout.vertexClusterDistance,
      labelOffsets: documentVisualSettings(p).vertexLabelOffsets,
      labels: vertexLabelsForFeature(feature, Math.max(0, coords.length - 1)),
      strictPlacement: true
    }) : '';
    const vertexMarks = liveElementScene ? tagLiveElementNodes(vertexMarksRaw,'vertices',showVertices,['<circle class="sv-vertex-anchor','<text class="sv-inline-label sv-vertex-label']) : vertexMarksRaw;

    const usedGlebas = resolveLeafGlebaFeatures(p, feature);
    const property = p.propertyName || p.title || p.name || 'Imóvel rural';
    const owner = cleanDocumentValue(window.GeoRuralProjects?.ownerNames?.(p) || p.owner || p.ownerName || p.metadata?.owner || '');
    const cityUf = cleanDocumentValue([p.city || p.municipality, p.uf || p.stateCode].filter(Boolean).join('/'));
    const date = new Date().toLocaleDateString('pt-BR');
    const company = custom.companyName || 'Surveyor Agrimensura';
    const contactPhone = custom.whatsappNumber || custom.phoneNumber || '';
    const contactEmail = custom.emailAddress || '';
    const address = custom.addressText || '';
    const mapWidthMeters = hav([mapBounds.minX, mapBounds.minY], [mapBounds.maxX, mapBounds.minY]);

    const sourceVertexLabels = vertexLabelsForFeature(feature, Math.max(0, coords.length - 1));
    const vertexRows = coords.slice(0, -1).map((coord, index) => {
      const lng = Number(coord?.[0]);
      const lat = Number(coord?.[1]);
      const utm = (Math.abs(lng) <= 180 && Math.abs(lat) <= 90) ? sirgasUtm(lng, lat) : null;
      return {
        id: sourceVertexLabels[index] || `V-${String(index + 1).padStart(2, '0')}`,
        e: utm?.easting ?? (Number.isFinite(lng) ? lng : null),
        n: utm?.northing ?? (Number.isFinite(lat) ? lat : null),
        zone: utm ? `${utm.zone}${utm.hemisphere}` : ''
      };
    });
    const maxVisibleVertexRows = 10;
    const tableRows = vertexRows.length <= maxVisibleVertexRows
      ? vertexRows
      : [...vertexRows.slice(0, maxVisibleVertexRows - 2), { ellipsis: true }, vertexRows[vertexRows.length - 1]];
    const tableStartY = side.y + 264;
    const rowH = 20;
    const tableBody = tableRows.map((row, index) => {
      const y = tableStartY + 32 + index * rowH;
      if (row.ellipsis) return `<text x="${side.x + side.w/2}" y="${y + 14}" text-anchor="middle" font-size="9.2" fill="#64748b">…</text>`;
      return `<line x1="${side.x + 12}" y1="${y}" x2="${side.x + side.w - 12}" y2="${y}" stroke="#e2e8f0"/><text x="${side.x + 28}" y="${y + 14}" font-size="9.2" font-weight="700">${row.id}</text><text x="${side.x + 126}" y="${y + 14}" font-size="8.8">${Number.isFinite(row.e) ? num(row.e,2) : '—'}</text><text x="${side.x + 240}" y="${y + 14}" font-size="8.8">${Number.isFinite(row.n) ? num(row.n,2) : '—'}</text>`;
    }).join('');
    const zoneLabel = vertexRows.find((row) => row.zone)?.zone || '—';

    const mini = { x: side.x + 14, y: side.y + 590, w: side.w - 28, h: 144 };
    const miniBounds = boundsWithAspect(paddedBounds(featureBounds, 1.65), mini.w, mini.h);
    const miniProject = projector(miniBounds, mini);
    const miniRing = coords.map((coord) => miniProject(coord).join(',')).join(' ');

    const dataBoxW = 455;
    const ownerBoxW = 455;
    const brandBoxX = footer.x + dataBoxW + ownerBoxW + 18;
    const brandBoxW = footer.w - dataBoxW - ownerBoxW - 18;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI', Arial, Helvetica, sans-serif">
      <rect width="${W}" height="${H}" fill="#ffffff"/>
      <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="#fff" stroke="#0f4358" stroke-width="2.5"/>

      ${logoData ? `<image href="${logoData}" x="38" y="28" width="290" height="66" preserveAspectRatio="xMinYMid meet"/>` : `<text x="42" y="70" font-size="34" font-weight="900" fill="#0f4358">${escape(company)}</text>`}
      <text x="800" y="58" text-anchor="middle" font-size="36" font-weight="900" fill="#08283b">${escape(title || 'PLANTA DO IMÓVEL RURAL')}</text>
      <text x="800" y="88" text-anchor="middle" font-size="18" fill="#173a4e">${backgroundSourceLabel(backgroundKind)} • SIRGAS 2000 • ZOOM ${zoom}</text>
      <rect x="1205" y="24" width="365" height="74" rx="9" fill="#eef3f6"/>
      <text x="1388" y="48" text-anchor="middle" font-size="14" font-weight="800">SISTEMA DE COORDENADAS UTM</text>
      <text x="1388" y="69" text-anchor="middle" font-size="13">Datum: SIRGAS 2000</text>
      <text x="1388" y="88" text-anchor="middle" font-size="12">Tipo: UTM • Zona ${zoneLabel} • Escala visual: zoom ${zoom}</text>

      <defs><clipPath id="ruralMapClip"><rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" rx="3"/></clipPath></defs>
      <rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="#eef2f6" stroke="#0f4358" stroke-width="1.6" rx="3"/>
      <g clip-path="url(#ruralMapClip)">
        ${backgroundData ? `<image href="${escape(backgroundData)}" x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" preserveAspectRatio="none"/>` : ''}
        ${rootFill}${innerArt}${rootOutline}${areaNameLabel}${dimensionMarks}${glebaMarks}${segmentLabels}${vertexMarks}
      </g>
      ${(liveElementScene || showNorth) ? (liveElementScene ? liveElementLayer('north',showNorth,northArrow(mapBox.x + 94, mapBox.y + 92)) : northArrow(mapBox.x + 94, mapBox.y + 92)) : ''}
      ${(liveElementScene || showScale) ? (liveElementScene ? liveElementLayer('scale',showScale,scaleBarSvg(mapBox.x + 22, mapBox.y + mapBox.h - 58, 260, mapWidthMeters * 0.28)) : scaleBarSvg(mapBox.x + 22, mapBox.y + mapBox.h - 58, 260, mapWidthMeters * 0.28)) : ''}
      ${technicalCoordinateTableSvg(coords, mapBox, {...rootVisualSettings,vertexLabels:vertexLabelsForFeature(feature,Math.max(0,coords.length-1))})}

      <rect x="${side.x}" y="${side.y}" width="${side.w}" height="142" fill="#fff" stroke="#0f4358" stroke-width="1.6" rx="7"/>
      <text x="${side.x + 18}" y="${side.y + 28}" font-size="14" font-weight="900">LEGENDA</text>
      ${documentLegendEntries(p,feature,rootVisualSettings,{showCotas,showGlebaCotas,showVertices,max:4}).map((entry,index)=>legendEntryMarkup(entry,side.x+22,side.y+56+index*25,{size:11.2,swatchWidth:34})).join('')}

      <rect x="${side.x}" y="${side.y + 156}" width="${side.w}" height="370" fill="#fff" stroke="#0f4358" stroke-width="1.6" rx="7"/>
      <text x="${side.x + 18}" y="${side.y + 184}" font-size="14" font-weight="900">VÉRTICES DO PERÍMETRO</text>
      <text x="${side.x + 18}" y="${side.y + 203}" font-size="8.8" fill="#64748b">Coordenadas UTM reais • SIRGAS 2000 • Zona ${zoneLabel}</text>
      <rect x="${side.x + 12}" y="${tableStartY}" width="${side.w - 24}" height="32" fill="#f1f5f9" stroke="#d7dee8"/>
      <text x="${side.x + 28}" y="${tableStartY + 21}" font-size="9.2" font-weight="800">ID</text><text x="${side.x + 126}" y="${tableStartY + 21}" font-size="9.2" font-weight="800">ESTE (E)</text><text x="${side.x + 240}" y="${tableStartY + 21}" font-size="9.2" font-weight="800">NORTE (N)</text>
      ${tableBody}

      <rect x="${side.x}" y="${side.y + 542}" width="${side.w}" height="206" fill="#fff" stroke="#0f4358" stroke-width="1.6" rx="7"/>
      <text x="${side.x + 18}" y="${side.y + 568}" font-size="14" font-weight="900">MAPA DE LOCALIZAÇÃO</text>
      <rect x="${mini.x}" y="${mini.y}" width="${mini.w}" height="${mini.h}" fill="#dce4e8" stroke="#cbd5e1" stroke-width="1"/>
      ${miniMapData ? `<image href="${escape(miniMapData)}" x="${mini.x}" y="${mini.y}" width="${mini.w}" height="${mini.h}" preserveAspectRatio="none"/>` : ''}
      <polygon points="${miniRing}" fill="#f3c410" fill-opacity=".38" stroke="#f3c410" stroke-width="2.2"/>
      <rect x="${mini.x + mini.w - 116}" y="${mini.y + 8}" width="106" height="24" rx="5" fill="#0f172a" fill-opacity=".70"/>
      <text x="${mini.x + mini.w - 16}" y="${mini.y + 25}" text-anchor="end" font-size="10.5" font-weight="800" fill="#fff">${escape(cityUf)}</text>

      <rect x="${footer.x}" y="${footer.y}" width="${dataBoxW}" height="${footer.h}" fill="#fff" stroke="#0f4358" stroke-width="1.6" rx="7"/>
      <text x="${footer.x + 22}" y="${footer.y + 31}" font-size="17" font-weight="900">DADOS DO IMÓVEL</text>
      <text x="${footer.x + 22}" y="${footer.y + 68}" font-size="14" font-weight="800">Imóvel:</text>${svgWrappedText(property, footer.x + 120, footer.y + 68, {maxChars:34,maxLines:1,size:14,lineHeight:15})}
      ${cleanDocumentValue(registration)?`<text x="${footer.x + 22}" y="${footer.y + 100}" font-size="14" font-weight="800">Matrícula:</text><text x="${footer.x + 120}" y="${footer.y + 100}" font-size="14">${escape(registration)}</text>`:''}
      <text x="${footer.x + 22}" y="${footer.y + 132}" font-size="14" font-weight="800">Município/UF:</text><text x="${footer.x + 120}" y="${footer.y + 132}" font-size="14">${escape(cityUf)}</text>
      <text x="${footer.x + 22}" y="${footer.y + 164}" font-size="14" font-weight="800">Área:</text><text x="${footer.x + 120}" y="${footer.y + 164}" font-size="14">${num(areaHa,4)} ha</text>
      <text x="${footer.x + 22}" y="${footer.y + 196}" font-size="14" font-weight="800">Perímetro:</text><text x="${footer.x + 120}" y="${footer.y + 196}" font-size="14">${num(totalPerimeter,2)} m</text>

      <rect x="${footer.x + dataBoxW + 10}" y="${footer.y}" width="${ownerBoxW}" height="${footer.h}" fill="#fff" stroke="#0f4358" stroke-width="1.6" rx="7"/>
      <text x="${footer.x + dataBoxW + 32}" y="${footer.y + 31}" font-size="17" font-weight="900">PROPRIETÁRIO(A)</text>
      ${svgWrappedText(owner, footer.x + dataBoxW + 32, footer.y + 53, {maxChars:44,maxLines:3,size:12,lineHeight:14})}
      <line x1="${footer.x + dataBoxW + 32}" y1="${footer.y + 100}" x2="${footer.x + dataBoxW + ownerBoxW - 12}" y2="${footer.y + 100}" stroke="#8aa1ad"/>
      <text x="${footer.x + dataBoxW + 32}" y="${footer.y + 132}" font-size="17" font-weight="900">RESPONSÁVEL TÉCNICO(A)</text>
      ${cleanDocumentValue(technician)?svgWrappedText(technician,footer.x + dataBoxW + 32,footer.y + 165,{maxChars:38,maxLines:2,size:14,lineHeight:17}):''}
      <text x="${footer.x + dataBoxW + 32}" y="${footer.y + 214}" font-size="13"><tspan font-weight="800">Data:</tspan> ${date}</text>

      <rect x="${brandBoxX}" y="${footer.y}" width="${brandBoxW}" height="${footer.h}" fill="#fff" stroke="#0f4358" stroke-width="1.6" rx="7"/>
      ${logoData ? `<image href="${logoData}" x="${brandBoxX + 34}" y="${footer.y + 25}" width="240" height="70" preserveAspectRatio="xMinYMid meet"/>` : `<text x="${brandBoxX + 34}" y="${footer.y + 70}" font-size="26" font-weight="900">${escape(company)}</text>`}
      <text x="${brandBoxX + 34}" y="${footer.y + 122}" font-size="13">Prancha técnica gerada digitalmente</text>
      ${qrData ? `<image href="${qrData}" x="${brandBoxX + brandBoxW - 132}" y="${footer.y + 32}" width="92" height="92"/><text x="${brandBoxX + brandBoxW - 86}" y="${footer.y + 144}" text-anchor="middle" font-size="11">Mapa público</text>` : ''}
      <text x="${brandBoxX + 34}" y="${footer.y + 158}" font-size="12" font-weight="800">Contato:</text>
      ${svgWrappedText([contactPhone,contactEmail].filter(Boolean).join(' • ') || custom.websiteUrl || '', brandBoxX + 34, footer.y + 177, {maxChars:58,maxLines:2,size:11,lineHeight:14})}
      ${svgWrappedText(address, brandBoxX + 34, footer.y + 214, {maxChars:58,maxLines:2,size:10.5,lineHeight:13})}

      <text x="${footer.x + 10}" y="${H - 18}" font-size="10.5" fill="#334155">Elaboração: ${escape(company)}</text>
      <text x="${W/2}" y="${H - 18}" text-anchor="middle" font-size="10.5" fill="#334155">Uso exclusivo para fins técnicos</text>
      <text x="${W - 30}" y="${H - 18}" text-anchor="end" font-size="10.5" fill="#334155">${publicUrl ? 'Mapa público vinculado ao projeto' : 'Documento técnico Surveyor'}</text>
      ${documentSignatureMarkup({ p, custom, width:W, height:H, defaultX:footer.x + dataBoxW + 240, defaultY:footer.y + 224, baseWidth:118, baseHeight:34 })}
    </svg>`;
  }

  async function generateCroqui(p, renderOptions = {}) {
    const feature = perimeter(p);
    let coords = ring(p);
    if (!feature || coords.length < 3) throw new Error('O projeto não possui um perímetro válido com feição geométrica.');
    if (coords.length >= 3 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
      coords = coords.concat([coords[0]]);
    }
    if (coords.length < 4) throw new Error('O perímetro do projeto precisa ter no mínimo 3 vértices distintos.');

    const features = (p.geojson?.features || []).filter((f) => f?.geometry);
    const featureBounds = boundsFromFeatures(features) || boundsFromFeatures([feature]);
    if (!featureBounds) throw new Error('Não foi possível calcular os limites do projeto.');

    const W = 1200;
    const H = 970;
    const frame = { x: 24, y: 18, w: 1152, h: 934 };
    const mapBox = { x: 44, y: 74, w: 1112, h: 590 };
    const footerBox = { x: 44, y: 680, w: 1112, h: 250 };
    const zoom = Math.max(1, Math.min(22, Number(renderOptions.zoom ?? $('mapZoom')?.value ?? 15)));
    const renderPage = String(renderOptions.page || document.body?.dataset?.page || 'mapas.html');
    const fastPreview = renderOptions.fastPreview === true;
    const liveElementScene = fastPreview && ['mapas.html','pranchas.html'].includes(renderPage);
    const mapBounds = effectiveMapBounds(featureBounds, zoom, mapBox.w, mapBox.h);
    const project = projector(mapBounds, mapBox);

    const sorted = features.slice().sort((a, b) => (a.properties?.category === 'perimetro' ? 1 : 0) - (b.properties?.category === 'perimetro' ? 1 : 0));
    const enabled = (key, id, fallback = true) => Object.prototype.hasOwnProperty.call(renderOptions, key) ? Boolean(renderOptions[key]) : optionEnabled(id, fallback);
    const showCotas = enabled('showCotas','mapShowCotas');
    const showGlebaCotas = enabled('showGlebaCotas','mapShowGlebaCotas', false);
    const showVertices = enabled('showVertices','mapShowVertices');
    const showConfrontantes = enabled('showConfrontantes','mapShowConfrontantes');
    const showNorth = enabled('showNorth','mapShowNorth');
    const showGrid = enabled('showGrid','mapShowGrid');
    const showScale = enabled('showScale','mapShowScale');
    const confrontanteColors = buildConfrontanteColorMaps(feature, coords);
    const visualSettings = documentVisualSettings(p);
    const perimeterStyle = documentPolygonStyle(feature, visualSettings, { color:'#f2c313', opacity:.14 });
    const perimeterMeta = { polygonKey:perimeterStyle.key, polygonName:perimeterStyle.name, polygonCategory:perimeterStyle.category };
    const perimeterBaseArt = svgStyledPerimeter(feature, coords, project, confrontanteColors, { ...perimeterMeta, fillColor: perimeterStyle.fillColor, fillOpacity: visualSettings.polygonFill && perimeterStyle.fill ? perimeterStyle.opacity : 0, defaultStroke: perimeterStyle.strokeColor, strokeWidth: 1.55 * perimeterStyle.strokeWidth });
    const internalArt = sorted.filter((f) => f !== feature && !['Point','MultiPoint'].includes(f?.geometry?.type)).map((f) => svgForFeature(f, project, visualSettings)).join('');
    const perimeterOutlineArt = '';
    const art = perimeterBaseArt + internalArt + perimeterOutlineArt;
    const areaNameLabel = svgDocumentVisualOverlay(feature, project, mapBox, visualSettings);
    // Motor automático de composição: confrontantes > cotas > vértices.
    // Todos compartilham o mesmo mapa de ocupação para impedir texto sobre texto.
    const autoLayout = automaticCartographicLayoutProfile(coords, project, 'classic');
    const reservedLabelRects = [];
    const renderConfrontantes = liveElementScene || showConfrontantes;
    const segmentLabelsRaw = renderConfrontantes ? smartConfrontanteLabels(feature, coords, project, mapBox, {
      fontSize: Math.max(12.5, autoLayout.confrontanteFontSize * 1.75),
      offset: Math.max(32, autoLayout.confrontanteOffset + 10),
      maxOffset: Math.max(98, autoLayout.confrontanteMaxOffset + 28),
      maxChars: 30,
      occupiedRects: reservedLabelRects,
      colorMaps: confrontanteColors,
      manualOffsets: readConfrontanteVisualOffsets(p),
      segmentOverrides: readConfrontanteSegmentOverrides(p)
    }) : '';
    const segmentLabels = liveElementScene ? tagLiveElementNodes(segmentLabelsRaw,'confrontantes',showConfrontantes,['<g class="sv-confrontante-callout']) : segmentLabelsRaw;
    const dimensionOccupiedLabels = [
      ...reservedLabelRects,
      ...projectedVertexProtectionRects(coords, project, autoLayout.count >= 30 ? 1.75 : 2.15)
    ];
    const renderCotas = liveElementScene || showCotas;
    const dimensionMarksRaw = renderCotas ? cadDimensionLabels(coords, project, mapBox, {
      fontSize: autoLayout.dimensionFontSize,
      minFontSize: autoLayout.dimensionMinFontSize,
      offset: autoLayout.dimensionOffset,
      placement: 'outside',
      containerCoords: coords,
      occupiedLabels: dimensionOccupiedLabels,
      lockNormalOffset: true,
      compactResolver: (_a, _b, _index, projectedLength) => projectedLength < autoLayout.shortDimensionThreshold,
      outsideExtraOffset: autoLayout.dimensionExtraOffset,
      visualSettings
    }) : '';
    const dimensionMarks = liveElementScene ? tagLiveElementNodes(dimensionMarksRaw,'cotas',showCotas,['<g class="sv-cad-dimension-group']) : dimensionMarksRaw;
    const renderGlebaCotas = liveElementScene || showGlebaCotas;
    const glebaMarksRaw = renderGlebaCotas ? glebaDimensionLabels(p, feature, project, mapBox, {
      fontSize: Math.max(1.70, autoLayout.dimensionFontSize - 0.35),
      minFontSize: Math.max(1.20, autoLayout.dimensionMinFontSize - 0.18),
      offset: Math.max(3.8, autoLayout.dimensionOffset - 2.3),
      placement: 'inside',
      occupiedLabels: dimensionOccupiedLabels,
      visualSettings
    }) : '';
    const glebaMarks = liveElementScene ? tagLiveElementNodes(glebaMarksRaw,'glebaCotas',showGlebaCotas,['<g class="sv-cad-dimension-group']) : glebaMarksRaw;
    const vertexReservedRects = dimensionOccupiedLabels.filter((item) => item?.kind !== 'vertex-anchor');
    const renderVertices = liveElementScene || showVertices;
    const vertexMarksRaw = renderVertices ? croquiVertexMarks(coords, project, mapBox, {
      fontSize: autoLayout.vertexFontSize * documentVisualSettings(p).vertexScale,
      hiddenVertexIndexes: hiddenVertexIndexesForFeature(feature, coords),
      offset: autoLayout.vertexOffset,
      maxDistance: autoLayout.vertexMaxDistance,
      emergencyDistance: autoLayout.vertexEmergencyDistance,
      leaderThreshold: Math.max(3.2, autoLayout.vertexOffset + 1.1),
      pointRadius: autoLayout.count >= 40 ? 0.82 : 0.98,
      pointFill: '#dc2626',
      showAnchorDots: false,
      clearGap: autoLayout.clearGap,
      edgePadding: 3.5,
      paddingX: 0.28,
      paddingY: 0.06,
      reservedRects: vertexReservedRects,
      vertexColorMap: {},
      clusterDistance: autoLayout.vertexClusterDistance,
      labelOffsets: documentVisualSettings(p).vertexLabelOffsets,
      labels: vertexLabelsForFeature(feature, Math.max(0, coords.length - 1)),
      strictPlacement: true
    }) : '';
    const vertexMarks = liveElementScene ? tagLiveElementNodes(vertexMarksRaw,'vertices',showVertices,['<circle class="sv-vertex-anchor','<text class="sv-inline-label sv-vertex-label']) : vertexMarksRaw;

    const totalPerimeter = coords.slice(1).reduce((sum, point, i) => sum + hav(coords[i], point), 0);
    const areaHa = area(feature) / 10000;
    const title = String(renderOptions.title ?? $('mapTitle')?.value ?? '').trim() || 'PLANTA DO IMÓVEL RURAL';
    const registration = cleanDocumentValue(String(renderOptions.registration ?? $('mapRegistration')?.value ?? '').trim());
    const documentAssets = window.SurveyorDocumentAssets;
    const custom = fastPreview
      ? (window.GeoRuralDocumentTheme?.get?.() || {})
      : (documentAssets?.loadCustomization
        ? await documentAssets.loadCustomization({ forceRefresh: true })
        : (window.GeoRuralDocumentTheme?.get?.() || {}));
    const croquiTemplateId = String(renderOptions.templateId || custom?.options?.mapas?.croquiTemplateId || 'classic');
    const technician = cleanDocumentValue(String(renderOptions.technician ?? $('mapTechnician')?.value ?? custom.responsibleTechnician ?? '').trim());
    const access = await resolveDocumentPublicAccess(p);
    let publicUrl = window.SurveyorBatchDocumentContext?.active ? '' : String(access?.url || p?.publicUrl || p?.shareUrl || '').trim();
    let qrData = String(access?.qr || '');
    if (!window.SurveyorBatchDocumentContext?.active) {
      if (!publicUrl) publicUrl = String(p?.publicUrl || p?.shareUrl || '').trim() || await shareUrl(p.id);
    }
    if (publicUrl && !qrData) {
      const qrLib = window.GeoRuralQR || window.QRCode;
      qrData = qrLib?.toDataURL ? await qrLib.toDataURL(publicUrl, { width: 300, margin: 1, errorCorrectionLevel: 'M' }).catch(() => '') : '';
    }
    const configuredLogo = String(custom?.logoDataUrl || '').trim();
    const logoData = fastPreview
      ? (configuredLogo.startsWith('data:') ? configuredLogo : await dataUrl('/assets/logo.png', 1800))
      : (documentAssets?.resolveLogo
        ? await documentAssets.resolveLogo(custom, { timeoutMs: 6000 })
        : await dataUrl(configuredLogo || '/assets/logo.png', 6000));

    if (renderPage === 'pranchas.html') {
      const sheetLayout = $('mapSheetLayout')?.value || 'georreferenciada';
      if (sheetLayout === 'georreferenciada') {
        const miniVisualSettings = documentVisualSettings(p);
        const miniKind = ['sat','road','terrain','relief'].includes(String(miniVisualSettings.miniMapKind || '')) ? String(miniVisualSettings.miniMapKind) : 'road';
        const miniMercatorBounds = centeredMiniMapMercatorBounds(boundsFromFeatures([feature]) || featureBounds, 330, 210);
        const miniUrl = miniKind === 'sat' ? '' : backgroundUrl(miniKind, miniMercatorBounds, 330, 210, { spatialRef: 102100 });
        const cachedMiniMap = embeddedAssetCache.get(miniUrl) || '';
        const miniMapData = miniKind === 'sat'
          ? await resolveBackgroundImage('sat', boundsFromWebMercator(miniMercatorBounds), 330, 210, zoom, { pixelRatio: 1, timeoutMs: fastPreview ? 2000 : 4500 })
          : (fastPreview ? (cachedMiniMap || miniUrl) : ((await dataUrl(miniUrl, 7000)) || miniUrl));
        return georefSheet({ p, feature, coords, features, featureBounds, sorted, areaHa, totalPerimeter, title, registration, custom, technician, publicUrl, qrData, logoData, miniMapData, zoom, renderOptions });
      }
      const Wp = 900;
      const Hp = 1240;
      const frameP = { x: 28, y: 24, w: 844, h: 1188 };
      const side = { x: 46, y: 56, w: 128, h: 1128 };
      const planBox = { x: 192, y: 56, w: 648, h: 880 };
      const infoBox = { x: 192, y: 956, w: 648, h: 228 };
      const planBounds = effectiveMapBounds(featureBounds, Math.max(10, Math.min(22, zoom)), planBox.w, planBox.h);
      const planProject = projector(planBounds, planBox);
      const planArt = svgForFeature(feature, planProject, documentVisualSettings(p)) + sorted.filter((f) => f !== feature && !['Point','MultiPoint'].includes(f?.geometry?.type)).map((f) => svgForFeature(f, planProject, documentVisualSettings(p))).join('');
      const planDimensionOccupiedLabels = [];
      const planGlebaSeg = showGlebaCotas ? glebaDimensionLabels(p, feature, planProject, planBox, { fontSize: 2.45, minFontSize: 1.82, offset: 4.9, placement: 'inside', occupiedLabels: planDimensionOccupiedLabels, visualSettings }) : '';
      const planVertexLabels = vertexLabelsForFeature(feature, Math.max(0, coords.length - 1));
      const planVertices = showVertices ? coords.slice(0, -1).map((coord, index) => {
        const [x, y] = planProject(coord);
        const label = planVertexLabels[index] || `V-${String(index + 1).padStart(2, '0')}`;
        return `<text x="${x + 5.2}" y="${y - 5.2}" font-size="11.4" font-weight="700" fill="#111827">${escape(label)}</text>`;
      }).join('') : '';
      const planSeg = showCotas ? cadDimensionLabels(coords, planProject, planBox, { fontSize: 2.95, minFontSize: 2.10, offset: 7.4, placement: 'outside', containerCoords: coords, occupiedLabels: planDimensionOccupiedLabels, lockNormalOffset: true, visualSettings }) : '';
      const linkText = publicUrl ? `Link público: ${publicUrl}` : 'Link público indisponível';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wp} ${Hp}" font-family="'Segoe UI', Arial, Helvetica, sans-serif">
        <rect width="${Wp}" height="${Hp}" fill="#f8fafc"/>
        <rect x="${frameP.x}" y="${frameP.y}" width="${frameP.w}" height="${frameP.h}" fill="#fff" stroke="#111827" stroke-width="3"/>
        <rect x="${side.x}" y="${side.y}" width="${side.w}" height="${side.h}" fill="#fff" stroke="#111827" stroke-width="1.6"/>
        <g transform="translate(${side.x + 22},${side.y + 1068}) rotate(-90)">
          <text x="0" y="0" font-size="18" font-weight="800">${escape(title)}</text>
          <text x="0" y="25" font-size="12">Área: ${num(areaHa,4)} ha • Perímetro: ${num(totalPerimeter,2)} m</text>
        </g>
        <rect x="${side.x + 16}" y="${side.y + 20}" width="${side.w - 32}" height="120" fill="#f8fafc" stroke="#cbd5e1"/>
        ${logoData ? `<image href="${logoData}" x="${side.x + 30}" y="${side.y + 42}" width="68" height="52" preserveAspectRatio="xMidYMid meet"/>` : ''}
        <text x="${side.x + side.w/2}" y="${side.y + 116}" text-anchor="middle" font-size="10" font-weight="800">GeoRural Pro</text>
        <rect x="${side.x + 16}" y="${side.y + 170}" width="${side.w - 32}" height="250" fill="#fff" stroke="#cbd5e1"/>
        <text x="${side.x + side.w/2}" y="${side.y + 195}" text-anchor="middle" font-size="12" font-weight="800">LEGENDA</text>
        ${documentLegendEntries(p,feature,visualSettings,{showCotas,showGlebaCotas,showVertices,max:6}).map((entry,index)=>legendEntryMarkup(entry,side.x+26,side.y+230+index*28,{size:9.5,swatchWidth:22})).join('')}
        ${qrData ? `<image href="${qrData}" x="${side.x + 25}" y="${side.y + 454}" width="78" height="78"/><text x="${side.x + side.w/2}" y="${side.y + 548}" text-anchor="middle" font-size="9">Mapa público</text>` : `<rect x="${side.x + 25}" y="${side.y + 454}" width="78" height="78" fill="#f8fafc" stroke="#cbd5e1"/><text x="${side.x + side.w/2}" y="${side.y + 496}" text-anchor="middle" font-size="8" fill="#64748b">QR indisponível</text>`}
        ${showNorth ? northArrow(planBox.x + planBox.w - 55, planBox.y + 62) : ''}
        <rect x="${planBox.x}" y="${planBox.y}" width="${planBox.w}" height="${planBox.h}" fill="#f3f4f6" stroke="#111827" stroke-width="1.6"/>
        <defs><pattern id="gridP" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#e5e7eb" stroke-width="1"/></pattern></defs>
        ${showGrid ? `<rect x="${planBox.x}" y="${planBox.y}" width="${planBox.w}" height="${planBox.h}" fill="url(#gridP)"/>` : ''}
        <g opacity=".95">${planArt}${planSeg}${planGlebaSeg}${planVertices}</g>
        <rect x="${infoBox.x}" y="${infoBox.y}" width="${infoBox.w}" height="${infoBox.h}" fill="#fff" stroke="#111827" stroke-width="1.6"/>
        <line x1="${infoBox.x}" y1="${infoBox.y + 76}" x2="${infoBox.x + infoBox.w}" y2="${infoBox.y + 76}" stroke="#111827"/>
        <line x1="${infoBox.x + 260}" y1="${infoBox.y}" x2="${infoBox.x + 260}" y2="${infoBox.y + infoBox.h}" stroke="#111827"/>
        <line x1="${infoBox.x + 455}" y1="${infoBox.y}" x2="${infoBox.x + 455}" y2="${infoBox.y + infoBox.h}" stroke="#111827"/>
        <text x="${infoBox.x + 16}" y="${infoBox.y + 28}" font-size="13" font-weight="800">DADOS DA PRANCHA</text>
        ${cleanDocumentValue(registration)?`<text x="${infoBox.x + 16}" y="${infoBox.y + 54}" font-size="11">Matrícula: ${escape(registration)}</text>`:''}
        ${svgWrappedText(p.propertyName || p.title || p.name || 'Imóvel rural', infoBox.x + 16, infoBox.y + 102, { maxChars: 32, maxLines: 2, size: 11, lineHeight: 13 })}
        ${cleanDocumentValue(technician)?`<text x="${infoBox.x + 16}" y="${infoBox.y + 156}" font-size="11">Responsável: ${escape(technician)}</text>`:''}
        <text x="${infoBox.x + 276}" y="${infoBox.y + 28}" font-size="13" font-weight="800">QUADRO DE ÁREAS</text>
        <text x="${infoBox.x + 276}" y="${infoBox.y + 56}" font-size="12">Área total: ${num(areaHa,4)} ha</text>
        <text x="${infoBox.x + 276}" y="${infoBox.y + 84}" font-size="12">Perímetro: ${num(totalPerimeter,2)} m</text>
        <text x="${infoBox.x + 276}" y="${infoBox.y + 112}" font-size="12">Escala visual: zoom ${zoom}</text>
        <text x="${infoBox.x + 276}" y="${infoBox.y + 140}" font-size="12">Coordenadas: DD • SIRGAS 2000</text>
        <text x="${infoBox.x + 471}" y="${infoBox.y + 28}" font-size="13" font-weight="800">LINK</text>
        ${svgWrappedText(linkText, infoBox.x + 471, infoBox.y + 54, { maxChars: 25, maxLines: 7, size: 8.5, lineHeight: 11 })}
        ${documentSignatureMarkup({ p, custom, width:Wp, height:Hp, defaultX:infoBox.x + 360, defaultY:infoBox.y + 214, baseWidth:105, baseHeight:30 })}
      </svg>`;
    }

    const backgroundKind = String(renderOptions.backgroundKind ?? $('mapBackground')?.value ?? 'sat');
    const isRuralReference = renderPage === 'mapas.html' && croquiTemplateId === 'rural-reference';
    const ruralBackgroundBox = { w: 1180, h: 748 };
    const backgroundBounds = isRuralReference
      ? ruralReferenceMapBounds(featureBounds, zoom, ruralBackgroundBox.w, ruralBackgroundBox.h)
      : mapBounds;
    const backgroundWidth = isRuralReference ? ruralBackgroundBox.w : mapBox.w;
    const backgroundHeight = isRuralReference ? ruralBackgroundBox.h : mapBox.h;
    const miniKind = 'sat';
    const miniBounds = boundsWithAspect(paddedBounds(featureBounds, 1.65), 330, 210);
    const livePreview = renderOptions.livePreview === true || renderOptions.fastPreview === true;
    const [backgroundHref, miniMapData] = await Promise.all([
      resolveBackgroundImage(backgroundKind, backgroundBounds, backgroundWidth, backgroundHeight, zoom, { tileFirst:!livePreview, preferDirectUrl:livePreview, pixelRatio:2, timeoutMs:livePreview ? 2500 : 6000 }),
      croquiTemplateId === 'rural-reference'
        ? resolveBackgroundImage(miniKind, miniBounds, 330, 210, Math.max(14, Number(zoom) || 15), { pixelRatio:1, timeoutMs:livePreview ? 2500 : 6000 })
        : Promise.resolve('')
    ]);
    const miniMapHref = String(miniMapData || '');
    if (renderPage === 'mapas.html' && croquiTemplateId === 'rural-reference') {
      return ruralReferenceSheet({ p, feature, coords, features, featureBounds, areaHa, totalPerimeter, title, registration, custom, technician, publicUrl, qrData, logoData, backgroundData:backgroundHref, miniMapData:miniMapHref, backgroundKind, zoom, showCotas, showGlebaCotas, showVertices, showConfrontantes, showNorth, showScale, confrontanteColors, liveElementScene });
    }
    const bgHref = escape(backgroundHref || '');
    const backgroundStatus = backgroundKind === 'none'
      ? 'SEM FUNDO CARTOGRÁFICO'
      : (backgroundHref ? backgroundSourceLabel(backgroundKind) : 'FUNDO CARTOGRÁFICO INDISPONÍVEL');
    const coordinateReference = `${backgroundStatus} • COORDENADAS DD • SIRGAS 2000 • ZOOM ${zoom}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI', Arial, Helvetica, sans-serif">
      <rect width="${W}" height="${H}" fill="#eef2f6"/>
      <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="#fff" stroke="#111827" stroke-width="3"/>
      <text x="${W / 2}" y="50" text-anchor="middle" font-size="22" font-weight="700">${escape(title)}</text>
      <rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="#fff"/>
      ${bgHref ? `<image href="${bgHref}" x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" preserveAspectRatio="none"/>` : ''}
      ${art}${areaNameLabel}${dimensionMarks}${glebaMarks}${segmentLabels}${vertexMarks}
      ${(liveElementScene || showNorth) ? (liveElementScene ? liveElementLayer('north',showNorth,northArrow(mapBox.x + 58, mapBox.y + 64)) : northArrow(mapBox.x + 58, mapBox.y + 64)) : ''}
      <g class="sv-map-coordinate-reference">
        <rect x="${mapBox.x + 12}" y="${mapBox.y + mapBox.h - 33}" width="430" height="24" rx="4" fill="#fff" fill-opacity=".92" stroke="#cbd5e1" stroke-width=".8"/>
        <text x="${mapBox.x + 22}" y="${mapBox.y + mapBox.h - 16}" font-size="10.5" font-weight="700" fill="#0f172a">${escape(coordinateReference)}</text>
              </g>
      ${technicalFooter({ p, feature, coords, areaHa, totalPerimeter, publicUrl, qrData, logoData, mapBox, footerBox, mapTitle: title, registration, technician, zoom, custom, showCotas, showGlebaCotas, showVertices })}
      ${documentSignatureMarkup({ p, custom, width:W, height:H, defaultX:footerBox.x + 700, defaultY:footerBox.y + 226, baseWidth:110, baseHeight:32 })}
    </svg>`;
  }


  // Fonte única do desenho técnico de Mapas/Croquis. Outros documentos, como o Memorial,
  // consomem este mesmo renderer em vez de manter uma segunda implementação divergente.
  window.SurveyorCroquiRenderer = Object.freeze({
    generate: (project, options = {}) => generateCroqui(project, options)
  });
  if (window.SurveyorBatchDocumentContext?.active) {
    window.SurveyorOfficialBatchCartography = Object.freeze({
      async pdf() {
        const id = String(window.SurveyorBatchDocumentContext.projectId);
        const p = await window.GeoRuralProjects.get(id);
        if (!p?.geojson?.features?.length) throw new Error('O lote isolado não possui geometria.');
        const page = document.body?.dataset?.page || 'mapas.html';
        const select = $('projectSelect');
        if (select) {
          if (![...select.options].some(option => option.value === id)) select.add(new Option('Lote selecionado', id));
          select.value = id;
        }
        // Mesma cadeia de preparação usada no botão oficial (inclui o documento
        // nativo, preferências e ajustes do editor), sem duplicar seu renderer.
        const prepared = await generateSelected({ silent:true, inlineOnly:true, fastPreview:false });
        if (!prepared) throw new Error('O módulo oficial não conseguiu preparar a geometria e a personalização.');
        const rawSvg = page === 'pranchas.html' ? String(window.SurveyorPranchaExportSource?.() || lastSvg) : String(lastSvg);
        const svg = printableDocumentSvg(rawSvg);
        if (!svg || !svg.includes('<svg')) throw new Error('O gerador oficial não produziu SVG técnico.');
        const preview = $('mapPreview');
        if (!preview || !window.SurveyorPdfPreview?.renderHtml) throw new Error('Conversor PDF oficial não disponível.');
        await window.SurveyorPdfPreview.renderHtml(preview, svg, {
          orientation: 'landscape', fitOnePage: true,
          pageFormat: $('printFormat')?.value || 'a4',
          title: page === 'pranchas.html' ? 'Prancha técnica — Surveyor' : 'Mapa e Croqui — Surveyor'
        });
        const blob = window.SurveyorPdfPreview.getState(preview)?.blob;
        if (!blob || blob.size === 0) throw new Error('A exportação oficial não produziu PDF.');
        return blob;
      }
    });
  }


  function withTimeout(promise, timeoutMs, message) {
    let timer = null;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message || 'Tempo limite excedido.')), timeoutMs);
      })
    ]).finally(() => { if (timer) clearTimeout(timer); });
  }

  function fitMapPreviewSvgToHost(previewHost = $('mapPreview')) {
    if (!previewHost || document.body?.dataset?.page !== 'mapas.html') return false;
    const svg = previewHost.querySelector(':scope > svg');
    if (!svg) return false;
    const viewBox = svg.viewBox?.baseVal;
    const vbWidth = Number(viewBox?.width || 0);
    const vbHeight = Number(viewBox?.height || 0);
    const hostWidth = Math.max(0, Number(previewHost.clientWidth || 0));
    const hostHeight = Math.max(0, Number(previewHost.clientHeight || 0));
    if (!(vbWidth > 0 && vbHeight > 0 && hostWidth > 32 && hostHeight > 32)) return false;
    const style = getComputedStyle(previewHost);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availableWidth = Math.max(1, hostWidth - padX);
    const availableHeight = Math.max(1, hostHeight - padY);
    const scale = Math.min(availableWidth / vbWidth, availableHeight / vbHeight);
    const width = Math.max(1, Math.floor(vbWidth * scale));
    const height = Math.max(1, Math.floor(vbHeight * scale));
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';
    return true;
  }

  function ensureMapPreviewFitObserver(previewHost = $('mapPreview')) {
    if (!previewHost || document.body?.dataset?.page !== 'mapas.html') return;
    if (mapPreviewFitHost === previewHost && mapPreviewResizeObserver) return;
    mapPreviewResizeObserver?.disconnect?.();
    mapPreviewFitHost = previewHost;
    if (typeof ResizeObserver !== 'function') return;
    mapPreviewResizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(mapPreviewFitRaf);
      mapPreviewFitRaf = requestAnimationFrame(() => fitMapPreviewSvgToHost(previewHost));
    });
    mapPreviewResizeObserver.observe(previewHost);
  }

  // Pré-visualização vetorial estável: o tamanho da folha é calculado uma vez a
  // partir do viewBox real e da área disponível. Isso evita o ciclo em que uma
  // barra de rolagem reduz a largura, a folha encolhe, a barra some e a folha
  // volta a crescer continuamente.
  async function renderMapPreviewSvg(svg) {
    const previewHost = $('mapPreview');
    if (!previewHost) return;
    // Um render externo não pode montar uma segunda prancha atrás do editor.
    if (mapasEditorOwnsPreview()) { mapasProjectPreviewDeferred = true; return; }
    const markup = String(svg || '').trim();
    if (!markup) return;
    previewHost.hidden = false;
    // A troca de etapa não deve destruir e recriar milhares de nós SVG
    // quando a mesma cena já está montada na etapa Projeto.
    const alreadyMounted = window.SurveyorMapasLivePreviewSvg === markup
      && Boolean(previewHost.querySelector(':scope > svg'));
    window.SurveyorMapasLivePreviewSvg = markup;
    if (!alreadyMounted) previewHost.innerHTML = markup;
    previewHost.classList.add('document-preview-visible','is-live-svg-preview');
    previewHost.classList.remove('is-pdf-preview');
    mapasPreviewAwaitingRefresh = false;
    fitMapPreviewSvgToHost(previewHost);
    ensureMapPreviewFitObserver(previewHost);
  }

  function suspendMapPreviewFitObserver() {
    mapPreviewResizeObserver?.disconnect?.();
    mapPreviewResizeObserver = null;
    mapPreviewFitHost = null;
    cancelAnimationFrame(mapPreviewFitRaf);
    mapPreviewFitRaf = 0;
  }

  // A bancada de personalização tem seu próprio SVG editável. Enquanto
  // ela é exibida, o SVG completo do Projeto não deve permanecer no DOM
  // nem ser reconstruído por um observer do preview antigo.
  function mapasEditorOwnsPreview() {
    if (document.body?.dataset?.page !== 'mapas.html') return false;
    const workspace = document.querySelector('.sv-doc-workspace');
    return workspace?.dataset?.betaPersonalizationSelected === '1'
      && Boolean(technicalDocumentEditor?.isActive?.())
      && technicalDocumentEditor?.presentationMode?.() === 'inline';
  }

  function installMapasNativeProjectPreviewGuard() {
    if (document.body?.dataset?.page !== 'mapas.html') return;
    const previewHost = $('mapPreview');
    if (!previewHost || previewHost.dataset.nativeProjectPreviewGuard === '1') return;
    previewHost.dataset.nativeProjectPreviewGuard = '1';
    let repairing = false;
    const repair = () => {
      if (mapasEditorOwnsPreview() || mapasPreviewAwaitingRefresh) return;
      if (repairing || !select?.value || !lastSvg) return;
      const legacyViewer = previewHost.querySelector('iframe,embed,object,.surveyor-pdf-preview-shell,.surveyor-pdf-native-wrap,.pdfViewer');
      const nativeSvg = previewHost.querySelector(':scope > svg, svg');
      if (!legacyViewer && nativeSvg) return;
      repairing = true;
      Promise.resolve(renderMapPreviewSvg(lastSvg)).finally(() => { repairing = false; });
    };
    // Apenas filhos diretos: mutações internas no SVG não justificam
    // percorrer/reconstruir a prancha inteira em cada edição.
    const observer = new MutationObserver(() => queueMicrotask(repair));
    observer.observe(previewHost,{childList:true});
    window.addEventListener('surveyor:document-step-change',(event)=>{
      if (event?.detail?.page === 'mapas.html' && Number(event.detail.index) === 0) requestAnimationFrame(repair);
    });
    window.addEventListener('surveyor:document-generation-finished',(event)=>{
      if (!event?.detail?.page || event.detail.page === 'mapas.html') requestAnimationFrame(repair);
    });
    repair();
  }

  function technicalDocumentEditorOptions() {
    return {
      getSvg: () => lastSvgProjectId === String(select?.value || '') ? lastSvg : '',
      getLoadedProject: () => projects.find((item) => item.id === String(select?.value || '')) || null,
      getNativeDocument: () => lastNativeDocumentProjectId === String(select?.value || '') ? lastNativeDocument : null,
      onNativeSvgChange: (svgText, nativeSnapshot = null) => {
        const currentProjectId=String(select?.value || '');
        if (!editorSessionProjectId || editorSessionProjectId !== currentProjectId) return;
        if (typeof svgText === 'string' && svgText.trim()) { lastSvg = svgText; lastSvgProjectId = currentProjectId; }
        if (nativeSnapshot && window.SurveyorNativeTechnicalDocument?.valid?.(nativeSnapshot)) { lastNativeDocument = nativeSnapshot; lastNativeDocumentProjectId = currentProjectId; }
        const project = projects.find((item)=>item.id===currentProjectId) || null;
        if (project && lastSvg) writePranchaSvgCache(project,lastSvg);
      },
      projectId: () => editorSessionProjectId || select?.value || 'sem-projeto',
      page: () => document.body?.dataset?.page || 'mapas.html',
      layoutId: () => `${$('mapSheetLayout')?.value || 'padrao'}-${$('printFormat')?.value || 'a4'}`,
      anchor: () => $('generateMapV19'),
      standaloneControls: false,
      regenerate: () => ['pranchas.html','mapas.html'].includes(document.body?.dataset?.page || '') ? generateSelected({ silent:true, inlineOnly:true, fastPreview:true, preferCache:false }) : generateSelected(),
      getCoordinateRows: () => {
        const selectedProject = projects.find((item) => item.id === (editorSessionProjectId || select?.value));
        const coords = selectedProject ? ring(selectedProject) : [];
        const clean = coords.length > 1 && Number(coords[0]?.[0]) === Number(coords[coords.length - 1]?.[0]) && Number(coords[0]?.[1]) === Number(coords[coords.length - 1]?.[1]) ? coords.slice(0,-1) : coords;
        const labels = vertexLabelsForFeature(perimeter(selectedProject), clean.length);
        return clean.map((coord,index) => ({ label:labels[index] || `V-${String(index + 1).padStart(2,'0')}`, lng:Number(coord?.[0]), lat:Number(coord?.[1]) })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
      },
      getSignatureData: async () => {
        if (window.SurveyorDocumentAssets?.resolveSignatureDataUrl) {
          return window.SurveyorDocumentAssets.resolveSignatureDataUrl({ forceRefresh: true });
        }
        try {
          const custom = await (window.GeoRuralAuth || window.SurveyorAuth)?.getDocumentCustomization?.({ forceRefresh: true, noCache: true });
          return String(custom?.planDocumentSignatureDataUrl || window.GeoRuralDocumentTheme?.getSignature?.() || '');
        } catch (_error) {
          return String(window.GeoRuralDocumentTheme?.getSignature?.() || '');
        }
      },
      onMiniMapChange: (settings = {}) => updatePranchaMiniMapLive(settings),
      toast
    };
  }

  function ensureTechnicalDocumentEditorInstance() {
    if (technicalDocumentEditor) return technicalDocumentEditor;
    const factory = window.SurveyorTechnicalDocumentEditor?.create;
    if (typeof factory !== 'function') return null;
    technicalDocumentEditor = factory(technicalDocumentEditorOptions()) || null;
    return technicalDocumentEditor;
  }

  async function loadTechnicalDocumentEditorInstance() {
    const ready = ensureTechnicalDocumentEditorInstance();
    if (ready) return ready;
    const existing = document.querySelector('script[data-surveyor-technical-editor-loader]');
    if (existing) {
      await new Promise((resolve) => {
        if (window.SurveyorTechnicalDocumentEditor?.create) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 4000);
      });
      return ensureTechnicalDocumentEditorInstance();
    }
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.dataset.surveyorTechnicalEditorLoader = '1';
      script.src = '/assets/js/core/technical-document-editor.js?editor=1';
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
      setTimeout(resolve, 4000);
    });
    return ensureTechnicalDocumentEditorInstance();
  }

  function hideLegacyDocumentEditorControls() {
    if (!['pranchas.html','mapas.html'].includes(document.body?.dataset?.page || '')) return;
    ['editConfrontanteLabelsBtn','resetConfrontanteLabelsBtn'].forEach((id) => {
      const control = document.getElementById(id);
      if (!control) return;
      control.hidden = true;
      control.setAttribute('aria-hidden','true');
      control.dataset.legacyEditorHidden = '1';
    });
  }

  function ensureConfrontanteEditorControls() {
    const editor = ensureTechnicalDocumentEditorInstance();
    editor?.ensureControls?.();
    hideLegacyDocumentEditorControls();
  }

  function updateConfrontanteEditorControls() {
    const editor = ensureTechnicalDocumentEditorInstance();
    editor?.updateControls?.();
    hideLegacyDocumentEditorControls();
  }

  function closeConfrontanteEditor() {
    const editor = ensureTechnicalDocumentEditorInstance();
    const result = editor?.close?.();
    editorSessionProjectId = '';
    if (editor) return result;
    document.getElementById('confrontanteEditorModal')?.remove();
    document.body.classList.remove('sv-confrontante-editor-open');
    updateConfrontanteEditorControls();
  }

  async function startConfrontanteLabelEdit() {
    if (!lastSvg) return;
    const editor = await loadTechnicalDocumentEditorInstance();
    if (!editor?.start) {
      console.error('[Surveyor] Editor técnico formal indisponível.');
      toast('Não foi possível carregar o editor técnico. Recarregue a página e tente novamente.', 'error');
      return;
    }
    // Existe uma única implementação de editor. Nunca voltar ao modal legado,
    // pois ele não possui vértices, linhas, múltiplos nomes nem painel lateral.
    editorSessionProjectId=String(select?.value || '');
    return editor.start();
  }

  const pranchaSvgCache = new Map();
  const PRANCHA_SVG_CACHE_PREFIX = 'surveyor:prancha-live-svg:v3:';

  function pranchaStructuralSignature(project = null) {
    const visualStamp = String(project?.updatedAt || project?.modifiedAt || project?.geojson?.features?.find?.((item)=>item?.properties?.category==='perimetro')?.properties?.confrontanteVisualLayout?.updatedAt || '');
    const miniSettings = documentVisualSettings(project || {});
    const values = [
      project?.id || select?.value || '', visualStamp,
      $('mapSheetLayout')?.value || 'georreferenciada', $('mapBackground')?.value || 'none', $('mapZoom')?.value || '15', $('printFormat')?.value || 'a4',
      miniSettings.miniMapKind || 'road', Number(miniSettings.miniMapOpacity ?? .88).toFixed(2), miniSettings.miniMapPerimeterVisible === false ? '0' : '1'
    ];
    // updatedAt não cobre mudanças locais ainda não sincronizadas.
    // Assinar conteúdo evita restaurar cena técnica com cotas/nomes antigos.
    const sceneSource=JSON.stringify({
      features:project?.geojson?.features || [],
      properties:project?.properties || {}, metadata:project?.metadata || {},
      customization:project?.documentCustomization || project?.customization || {},
      documentVisualSettings:project?.documentVisualSettings || null
    });
    let fingerprint=2166136261;
    for(let i=0;i<sceneSource.length;i+=1) fingerprint=Math.imul(fingerprint^sceneSource.charCodeAt(i),16777619);
    values.push((fingerprint>>>0).toString(36), String(sceneSource.length));
    return values.join('|');
  }

  function pranchaCacheKey(project = null) {
    const raw = pranchaStructuralSignature(project);
    let hash = 2166136261;
    for (let i=0;i<raw.length;i+=1) { hash ^= raw.charCodeAt(i); hash = Math.imul(hash,16777619); }
    return `${PRANCHA_SVG_CACHE_PREFIX}${project?.id || select?.value || 'sem-projeto'}:${(hash>>>0).toString(36)}`;
  }

  function readPranchaSvgCache(project = null) {
    const key = pranchaCacheKey(project);
    if (pranchaSvgCache.has(key)) return pranchaSvgCache.get(key) || '';
    try {
      const cached = sessionStorage.getItem(key) || '';
      if (cached) pranchaSvgCache.set(key,cached);
      return cached;
    } catch (_error) { return ''; }
  }

  function writePranchaSvgCache(project = null, svg = '') {
    if (!svg) return;
    const key = pranchaCacheKey(project);
    pranchaSvgCache.set(key,svg);
    try { if (svg.length < 900000) sessionStorage.setItem(key,svg); } catch (_error) {}
  }

  function currentPranchaLiveFieldValues(project = null) {
    const p = project || projects.find((item)=>item.id===select?.value) || null;
    const theme = window.GeoRuralDocumentTheme?.get?.() || {};
    const titleRaw = String($('mapTitle')?.value || 'PLANTA DO IMÓVEL GEORREFERENCIADO').trim() || 'PLANTA DO IMÓVEL GEORREFERENCIADO';
    return {
      mapTitle: titleRaw.replace(/RURAL$/i,'GEORREFERENCIADO'),
      mapRegistration: cleanDocumentValue($('mapRegistration')?.value || ''),
      mapDistrict: cleanDocumentValue($('mapDistrict')?.value || p?.comarca || p?.city || p?.municipality || ''),
      mapRegistryOffice: cleanDocumentValue($('mapRegistryOffice')?.value || p?.cartorio || ''),
      mapIncra: cleanDocumentValue($('mapIncra')?.value || p?.incra || p?.metadata?.incra || ''),
      mapCnib: cleanDocumentValue($('mapCnib')?.value || p?.cnib || p?.metadata?.cnib || ''),
      mapTechnician: cleanDocumentValue($('mapTechnician')?.value || theme?.responsibleTechnician || ''),
      mapScale: String($('mapScale')?.value || '1:3.500').trim() || '1:3.500',
      mapScaleGraphic: `Escala Gráfica ${String($('mapScale')?.value || '1:3.500').trim() || '1:3.500'}`,
      mapSheetNumber: String($('mapSheetNumber')?.value || 'ÚNICA').trim() || 'ÚNICA'
    };
  }

  const ELEMENT_VISIBILITY_CONTROLS = Object.freeze({
    cotas:'mapShowCotas',glebaCotas:'mapShowGlebaCotas',vertices:'mapShowVertices',
    confrontantes:'mapShowConfrontantes',north:'mapShowNorth',grid:'mapShowGrid',scale:'mapShowScale'
  });
  const ELEMENT_VISIBILITY_DEFAULTS = Object.freeze({
    cotas:true,glebaCotas:false,vertices:true,confrontantes:true,north:true,grid:true,scale:true
  });
  let visibleElementProjectId = '';
  function restoreProjectElementVisibility(project) {
    const id=String(project?.id||'');
    if(!id || id===visibleElementProjectId) return;
    const stored=documentVisualSettings(project)?.elementVisibility || {};
    Object.entries(ELEMENT_VISIBILITY_CONTROLS).forEach(([key, controlId])=>{
      const source=$(controlId);
      if(!source)return;
      source.checked=typeof stored[key]==='boolean'?stored[key]:ELEMENT_VISIBILITY_DEFAULTS[key];
      document.querySelectorAll(`[data-beta-proxy-for="${controlId}"]`).forEach((proxy)=>{proxy.checked=source.checked;});
    });
    visibleElementProjectId=id;
  }

  function currentPranchaLiveElementValues() {
    return {
      cotas: $('mapShowCotas')?.checked !== false,
      glebaCotas: $('mapShowGlebaCotas')?.checked === true,
      vertices: $('mapShowVertices')?.checked !== false,
      confrontantes: $('mapShowConfrontantes')?.checked !== false,
      north: $('mapShowNorth')?.checked !== false,
      grid: $('mapShowGrid')?.checked !== false,
      scale: $('mapShowScale')?.checked !== false
    };
  }


  function createNativePranchaDocument(project = null) {
    if (document.body?.dataset?.page !== 'pranchas.html' || !project) return null;
    const nativeApi = window.SurveyorNativeTechnicalDocument;
    if (!nativeApi?.create) return null;
    const settings = documentVisualSettings(project);
    return nativeApi.create({
      project,
      page: 'pranchas.html',
      layoutId: `${$('mapSheetLayout')?.value || 'georreferenciada'}-${$('printFormat')?.value || 'a4'}`,
      fields: currentPranchaLiveFieldValues(project),
      elements: currentPranchaLiveElementValues(),
      settings,
      sheet: {
        layout: $('mapSheetLayout')?.value || 'georreferenciada',
        format: $('printFormat')?.value || 'a4',
        background: $('mapBackground')?.value || 'none',
        zoom: Number($('mapZoom')?.value || 15)
      }
    });
  }

  function refreshNativePranchaDocument(project = null) {
    const sourceProject = project || projects.find((item)=>item.id===select?.value) || null;
    const next = createNativePranchaDocument(sourceProject);
    if (next) {
      lastNativeDocument = next;
      lastNativeDocumentProjectId = String(sourceProject?.id || select?.value || '');
    }
    return lastNativeDocument;
  }

  function patchNativePranchaFields(values = {}) {
    const api = window.SurveyorNativeTechnicalDocument;
    if (!api?.patchField || !lastNativeDocument || lastNativeDocumentProjectId !== String(select?.value || '')) return false;
    Object.entries(values || {}).forEach(([field,value]) => api.patchField(lastNativeDocument,field,value));
    return true;
  }

  function patchNativePranchaElements(values = {}) {
    const api = window.SurveyorNativeTechnicalDocument;
    if (!api?.patchElement || !lastNativeDocument || lastNativeDocumentProjectId !== String(select?.value || '')) return false;
    Object.entries(values || {}).forEach(([key,value]) => api.patchElement(lastNativeDocument,key,value));
    return true;
  }

  function liveElementSelectors(element) {
    switch (String(element || '')) {
      case 'cotas': return ['[data-live-element="cotas"]','.sv-cad-dimension-group[data-owner="perimeter"]','.sv-live-element-cotas'];
      case 'glebaCotas': return ['[data-live-element="glebaCotas"]','.sv-cad-dimension-group:not([data-owner="perimeter"])','.sv-live-element-glebaCotas'];
      case 'vertices': return ['[data-live-element="vertices"]','.sv-vertex-anchor','.sv-vertex-label','.sv-live-element-vertices'];
      case 'confrontantes': return ['[data-live-element="confrontantes"]','.sv-confrontante-callout','.sv-live-element-confrontantes'];
      case 'north': return ['[data-live-element="north"]','.sv-live-element-north'];
      case 'grid': return ['[data-live-element="grid"]','.sv-live-element-grid'];
      case 'scale': return ['[data-live-element="scale"]','.sv-live-element-scale'];
      default: return [`[data-live-element="${String(element || '').replace(/"/g,'\"')}"]`];
    }
  }

  function patchSvgLiveElements(svgText, values = {}) {
    if (!svgText || !values || typeof values !== 'object') return svgText || '';
    try {
      const doc = new DOMParser().parseFromString(svgText,'image/svg+xml');
      if (doc.querySelector('parsererror')) return svgText;
      Object.entries(values).forEach(([key, enabled]) => {
        const visible = Boolean(enabled);
        const nodes = new Set();
        liveElementSelectors(key).forEach((selector) => {
          try { doc.querySelectorAll(selector).forEach((node) => nodes.add(node)); } catch (_error) {}
        });
        nodes.forEach((node) => {
          node.setAttribute('data-live-element',key);
          if (visible) {
            node.style.removeProperty('display');
            if (!String(node.getAttribute('style') || '').trim()) node.removeAttribute('style');
            node.removeAttribute('display');
            node.setAttribute('aria-hidden','false');
          } else {
            node.style.setProperty('display','none','important');
            node.setAttribute('display','none');
            node.setAttribute('aria-hidden','true');
          }
        });
      });
      return new XMLSerializer().serializeToString(doc.documentElement);
    } catch (_error) { return svgText; }
  }

  function patchDocumentLiveElements() {
    const page = String(document.body?.dataset?.page || '');
    if (!['pranchas.html','mapas.html'].includes(page)) return false;
    const values = currentPranchaLiveElementValues();
    if (page === 'pranchas.html') patchNativePranchaElements(values);
    const editor = ensureTechnicalDocumentEditorInstance();
    const editorChanged = Boolean(editor?.patchLiveElements?.(values,{persist:true}));
    if (lastSvg) {
      lastSvg = patchSvgLiveElements(lastSvg, values);
      if (page === 'pranchas.html') {
        const project = projects.find((item)=>item.id===select?.value) || null;
        if (project) writePranchaSvgCache(project,lastSvg);
      }
    }
    return editorChanged;
  }

  function patchSvgLiveFields(svgText, values = {}) {
    if (!svgText || !values || typeof values !== 'object') return svgText || '';
    try {
      const doc = new DOMParser().parseFromString(svgText,'image/svg+xml');
      if (doc.querySelector('parsererror')) return svgText;
      doc.querySelectorAll('[data-live-field]').forEach((node)=>{
        const field=String(node.getAttribute('data-live-field')||'');
        if (!Object.prototype.hasOwnProperty.call(values,field)) return;
        node.textContent=String(values[field]??'').trim();
      });
      doc.querySelectorAll('[data-live-field-row]').forEach((row)=>{
        const field=String(row.getAttribute('data-live-field-row')||'');
        if (!Object.prototype.hasOwnProperty.call(values,field)) return;
        const value=String(values[field]??'').trim();
        const valueNode=row.querySelector('[data-live-field-value]');
        if(valueNode)valueNode.textContent=value;
        if (value) row.removeAttribute('style'); else row.setAttribute('style','display:none');
      });
      return new XMLSerializer().serializeToString(doc.documentElement);
    } catch (_error) { return svgText; }
  }

  function patchSvgLiveAssets(svgText, values = {}) {
    if (!svgText || !values || typeof values !== 'object') return svgText || '';
    try {
      const doc = new DOMParser().parseFromString(svgText,'image/svg+xml');
      if (doc.querySelector('parsererror')) return svgText;
      doc.querySelectorAll('[data-live-asset],[data-live-asset-value]').forEach((node)=>{
        const asset=String(node.getAttribute('data-live-asset')||node.getAttribute('data-live-asset-value')||'');
        if (!Object.prototype.hasOwnProperty.call(values,asset)) return;
        const value=String(values[asset]??'').trim();
        if(value){node.setAttribute('href',value);node.removeAttribute('display');}
        else{node.removeAttribute('href');node.setAttribute('display','none');}
      });
      return new XMLSerializer().serializeToString(doc.documentElement);
    } catch (_error) { return svgText; }
  }

  function patchPranchaLiveFields() {
    if (document.body?.dataset?.page !== 'pranchas.html' || !select?.value || !lastSvg) return false;
    const project = projects.find((item)=>item.id===select.value) || null;
    const values = currentPranchaLiveFieldValues(project);
    patchNativePranchaFields(values);
    lastSvg = patchSvgLiveFields(lastSvg,values);
    const editor = ensureTechnicalDocumentEditorInstance();
    editor?.patchLiveFields?.(values);
    return true;
  }

  let pranchaAssetHydrationToken = 0;
  async function hydratePranchaLiveAssets(project = null, overrides = {}) {
    if (document.body?.dataset?.page !== 'pranchas.html' || !project?.id || project.id !== select?.value) return;
    const token=++pranchaAssetHydrationToken;
    try {
      const feature=perimeter(project), features=(project.geojson?.features||[]).filter((item)=>item?.geometry);
      const featureBounds=boundsFromFeatures(features)||boundsFromFeatures(feature?[feature]:[]);
      if(!featureBounds)return;
      // A fotografia e o polígono do minimapa devem usar exatamente o mesmo
      // recorte Mercator, inclusive quando a imagem chega depois da prévia.
      const miniMercatorBounds=centeredMiniMapMercatorBounds(boundsFromFeatures(feature?[feature]:[])||featureBounds,330,210);
      const liveSettings=documentVisualSettings(project);
      const requestedKind=String(overrides?.miniMapKind || liveSettings.miniMapKind || 'road');
      const miniKind=['sat','road','terrain','relief'].includes(requestedKind)?requestedKind:'road';
      const miniUrl=miniKind==='sat' ? '' : backgroundUrl(miniKind,miniMercatorBounds,330,210,{spatialRef:102100});
      const documentAssets=window.SurveyorDocumentAssets;
      const custom=documentAssets?.loadCustomization ? await documentAssets.loadCustomization({forceRefresh:false}) : (window.GeoRuralDocumentTheme?.get?.()||{});
      const [miniMap,logo]=await Promise.all([
        miniKind==='sat'
          ? resolveBackgroundImage('sat',boundsFromWebMercator(miniMercatorBounds),330,210,15,{pixelRatio:1,timeoutMs:4500})
          : dataUrl(miniUrl,7000),
        documentAssets?.resolveLogo ? documentAssets.resolveLogo(custom,{timeoutMs:5000}).catch(()=> '') : Promise.resolve(String(custom?.logoDataUrl||''))
      ]);
      if(token!==pranchaAssetHydrationToken || project.id!==select?.value)return;
      const assets={miniMap,logo};
      lastSvg=patchSvgLiveAssets(lastSvg,assets);
      const editor=ensureTechnicalDocumentEditorInstance();
      editor?.patchLiveAssets?.(assets);
      writePranchaSvgCache(project,lastSvg);
    } catch(error){console.warn('[Surveyor] Recursos visuais da prévia serão mantidos em modo rápido:',error);}
  }

  async function updatePranchaMiniMapLive(settings = {}) {
    if (document.body?.dataset?.page !== 'pranchas.html') return false;
    const project=projects.find((item)=>item.id===select?.value) || null;
    if(!project)return false;
    // Ao trocar de fonte (ex.: satélite para vetorial), a imagem anterior
    // não pode continuar visível enquanto a nova é solicitada.
    const empty={miniMap:''};
    if(lastSvg)lastSvg=patchSvgLiveAssets(lastSvg,empty);
    ensureTechnicalDocumentEditorInstance()?.patchLiveAssets?.(empty);
    await hydratePranchaLiveAssets(project,{miniMapKind:settings?.miniMapKind});
    return true;
  }

  function schedulePranchaCacheWarmup(list = []) {
    if (document.body?.dataset?.page !== 'pranchas.html' || !Array.isArray(list) || !list.length) return;
    const warm = async () => {
      for (const project of list.slice(0,6)) {
        if (!project?.id || readPranchaSvgCache(project)) continue;
        try {
          const theme=window.GeoRuralDocumentTheme?.get?.()||{};
          const svg=await generateCroqui(project,{
            fastPreview:true,page:'pranchas.html',title:'PLANTA DO IMÓVEL GEORREFERENCIADO',registration:'',
            technician:theme?.responsibleTechnician||'',district:project?.comarca||project?.city||project?.municipality||'',
            registryOffice:project?.cartorio||'',incra:project?.incra||project?.metadata?.incra||'',cnib:project?.cnib||project?.metadata?.cnib||'',
            scaleText:'1:3.500',sheetNumber:'ÚNICA'
          });
          if(svg)writePranchaSvgCache(project,svg);
        } catch (_error) {}
        await new Promise((resolve)=>setTimeout(resolve,0));
      }
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(()=>warm(),{timeout:1800});
    else window.setTimeout(()=>warm(),300);
  }

  function betaPersonalizationStatus(message = '', type = '') {
    const node = document.querySelector('[data-beta-personalization-status]');
    if (!node) return;
    node.textContent = message;
    node.dataset.status = type || '';
  }

  function syncBetaProxyFromSource(source, proxy) {
    if (!source || !proxy) return;
    const type = String(source.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') proxy.checked = Boolean(source.checked);
    else proxy.value = source.value ?? '';
    proxy.disabled = Boolean(source.disabled);
  }

  function bindBetaProxyControl(proxy, source) {
    if (!proxy || !source) return;
    const sourceId = String(source.id || '').trim();
    if (!sourceId) return;
    proxy.removeAttribute('id');
    proxy.dataset.betaProxyFor = sourceId;
    syncBetaProxyFromSource(source, proxy);
    const pushToSource = (event) => {
      const type = String(source.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') source.checked = Boolean(proxy.checked);
      else source.value = proxy.value;
      // O campo original já possui o listener que atualiza os elementos da
      // prancha. Disparar patchDocumentLiveElements aqui produzia duas passagens
      // pesadas pelo SVG para uma única alteração.
      source.dispatchEvent(new Event(event.type === 'input' ? 'input' : 'change', { bubbles:true }));
    };
    // Checkboxes e selects nativos disparam input+change numa mesma ação.
    // Ouvir só change nesses controles evita dois eventos, dois patches e
    // duas sincronizações de estado. Campos textuais usam input em tempo real.
    const proxyEvent = (proxy.type === 'checkbox' || proxy.type === 'radio' || proxy.tagName === 'SELECT') ? 'change' : 'input';
    proxy.addEventListener(proxyEvent, pushToSource);
    if (source.dataset.betaProxyMirrorBound !== '1') {
      source.dataset.betaProxyMirrorBound = '1';
      const pull = () => document.querySelectorAll(`[data-beta-proxy-for="${globalThis.CSS?.escape ? globalThis.CSS.escape(sourceId) : sourceId}"]`).forEach((node) => syncBetaProxyFromSource(source,node));
      source.addEventListener('input', pull);
      source.addEventListener('change', pull);
    }
  }

  const COMPACT_ELEMENT_META = Object.freeze({
    mapShowCotas:{key:'cotas',title:'Cotas',color:'#111827'},
    mapShowGlebaCotas:{key:'glebaCotas',title:'Cotas da gleba',color:'#64748b'},
    mapShowVertices:{key:'vertices',title:'Vértices',color:'#111827'},
    mapShowConfrontantes:{key:'confrontantes',title:'Confrontantes',color:'#111827'},
    mapShowNorth:{key:'north',title:'Norte',color:'#111827'},
    mapShowGrid:{key:'grid',title:'Grade técnica',color:'#94a3b8'},
    mapShowScale:{key:'scale',title:'Escala gráfica',color:'#111827'}
  });
  function compactElementScaleOptions(value = 1) {
    const current=Math.round((Number(value)||1)*100);
    const values=[50,75,100,125,150,175,200,250,300];
    if(!values.includes(current)) values.push(current);
    return values.sort((a,b)=>a-b).map((item)=>`<option value="${(item/100).toFixed(2)}"${item===current?' selected':''}>${item}%</option>`).join('');
  }
  function compactElementSettings() {
    const editor=ensureTechnicalDocumentEditorInstance();
    return editor?.currentDocumentSettings?.() || editor?.readDocumentSettings?.() || {};
  }
  function mountCompactElementCards(modal) {
    const panel=modal?.querySelector?.('[data-tool-panel="elements"]');
    const grid=panel?.querySelector?.('.sv-doc-options-grid');
    if(!grid || grid.dataset.compactElements==='1')return;
    const settings=compactElementSettings();
    const visuals=settings?.elementVisuals || {};
    grid.dataset.compactElements='1';
    grid.classList.remove('sv-doc-options-grid');
    grid.classList.add('sv-editor-elements-grid');
    Array.from(grid.querySelectorAll(':scope > label')).forEach((legacy)=>{
      const checkbox=legacy.querySelector('input[type="checkbox"]');
      const sourceId=String(checkbox?.dataset?.betaProxyFor || checkbox?.id || '').trim();
      const meta=COMPACT_ELEMENT_META[sourceId];
      if(!checkbox || !meta)return;
      const visual=visuals?.[meta.key] || {scale:meta.key==='cotas'?Number(settings.dimensionScale||1):meta.key==='vertices'?Number(settings.vertexScale||1):1,color:meta.color};
      const card=document.createElement('div');card.className='sv-editor-element-card';card.dataset.elementKey=meta.key;
      checkbox.classList.add('sv-editor-element-toggle-input');
      const head=document.createElement('button');head.type='button';head.className='sv-editor-element-toggle';head.textContent=meta.title;head.setAttribute('aria-pressed',checkbox.checked?'true':'false');
      const controls=document.createElement('div');controls.className='sv-editor-element-controls';
      controls.innerHTML=`<label><span>Tamanho</span><select data-element-visual-key="${meta.key}" data-element-visual-scale aria-label="Tamanho de ${meta.title}">${compactElementScaleOptions(visual.scale)}</select></label><label class="sv-editor-element-color"><span>Cor</span><span class="sv-editor-element-color-control"><input type="color" data-element-visual-key="${meta.key}" data-element-visual-color value="${String(visual.color||meta.color)}" aria-label="Cor de ${meta.title}"><i aria-hidden="true"></i></span></label>`;
      const sync=()=>{card.classList.toggle('is-active',checkbox.checked);head.setAttribute('aria-pressed',checkbox.checked?'true':'false');controls.querySelectorAll('select,input').forEach((control)=>{control.disabled=!checkbox.checked;});};
      head.addEventListener('click',(event)=>{event.preventDefault();checkbox.checked=!checkbox.checked;checkbox.dispatchEvent(new Event('change',{bubbles:true}));sync();});
      checkbox.addEventListener('change',sync);
      card.append(checkbox,head,controls);legacy.replaceWith(card);sync();
    });
  }
  function mergeConfrontantesIntoVertices(modal) {
    const drawer=modal?.querySelector?.('[data-tool-drawer]');
    const verticesPanel=drawer?.querySelector?.('[data-tool-panel="vertices"]');
    const confrontantesPanel=drawer?.querySelector?.('[data-tool-panel="confrontantes"]');
    if(!verticesPanel || !confrontantesPanel)return;
    const target=verticesPanel.querySelector('.sv-editor-tool-section') || verticesPanel;
    verticesPanel.querySelector('[data-vertex-guide-list]')?.closest('.sv-editor-tool-section')?.remove();
    const segmentPanel=confrontantesPanel.querySelector('.sv-confrontante-segment-panel');
    if(segmentPanel){
      segmentPanel.querySelector('.sv-confrontante-segment-panel-head')?.remove();
      segmentPanel.classList.add('sv-confrontante-compact-panel');
      target.appendChild(segmentPanel);
    }
    confrontantesPanel.remove();
    modal.querySelector('[data-editor-tool="confrontantes"]')?.remove();
  }
  function removeLegacyDimensionPanel(modal) {
    modal?.querySelector?.('[data-tool-panel="dimensions"]')?.remove();
    modal?.querySelector?.('[data-editor-tool="dimensions"]')?.remove();
  }

  function mountCompactAppearancePanel(modal) {
    const panel=modal?.querySelector?.('[data-tool-panel="appearance"]');
    const section=panel?.querySelector?.('.sv-editor-tool-section');
    if(!section || section.dataset.compactAppearance==='1')return;
    const polygonFill=section.querySelector('[data-document-setting="polygonFill"]');
    const coordinateTable=section.querySelector('[data-document-setting="coordinateTableEnabled"]');
    const polygonSection=section.querySelector('.sv-editor-polygon-style-section');
    if(!polygonFill || !coordinateTable || !polygonSection)return;

    section.dataset.compactAppearance='1';
    section.querySelector(':scope > .sv-editor-tool-label')?.remove();
    const polygonFillLabel=polygonFill.closest('label');
    const coordinateTableLabel=coordinateTable.closest('label');
    const tableDependents=Array.from(section.querySelectorAll('[data-coordinate-table-dependent]'));
    const globalNameColor=section.querySelector('[data-area-name-dependent]');

    const stack=document.createElement('div');
    stack.className='sv-editor-appearance-stack';

    const makeToggleCard=(input,title,key)=>{
      const card=document.createElement('section');
      card.className='sv-editor-appearance-card';
      card.dataset.appearanceCard=key;
      input.classList.add('sv-editor-appearance-toggle-input');
      const button=document.createElement('button');
      button.type='button';button.className='sv-editor-appearance-toggle';button.textContent=title;
      button.setAttribute('aria-pressed',input.checked?'true':'false');
      const sync=()=>{card.classList.toggle('is-active',Boolean(input.checked));button.setAttribute('aria-pressed',input.checked?'true':'false');};
      button.addEventListener('click',(event)=>{event.preventDefault();input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}));sync();});
      input.addEventListener('change',sync);
      card.append(input,button);sync();
      return card;
    };

    const polygonList=polygonSection.querySelector('[data-polygon-style-list]');

    const tableCard=makeToggleCard(coordinateTable,'Tabela técnica de coordenadas','coordinateTable');
    const tableControls=document.createElement('div');tableControls.className='sv-editor-appearance-table-controls';
    tableDependents.forEach((node)=>tableControls.appendChild(node));
    const editorSettings=compactElementSettings();
    const positionControls=document.createElement('div');positionControls.className='sv-editor-table-position-controls';
    const makePositionSlider=(axis,label,value)=>{const row=document.createElement('label');row.className='sv-editor-slider-row';const normalized=Math.round(Math.max(0,Math.min(1,Number.isFinite(Number(value))?Number(value):.5))*100);row.innerHTML=`${label} <input type="range" min="0" max="100" step="1" value="${normalized}" data-coordinate-table-position="${axis}"><output>${normalized}%</output>`;const input=row.querySelector('input'),out=row.querySelector('output');input.addEventListener('input',()=>{const percent=Math.max(0,Math.min(100,Number(input.value)||0));out.textContent=`${Math.round(percent)}%`;const editor=ensureTechnicalDocumentEditorInstance();editor?.patchDocumentSettings?.({[axis==='x'?'coordinateTableX':'coordinateTableY']:percent/100});});return row;};
    positionControls.append(makePositionSlider('x','Horizontal',editorSettings.coordinateTableX),makePositionSlider('y','Vertical',editorSettings.coordinateTableY));
    tableControls.appendChild(positionControls);
    tableCard.appendChild(tableControls);

    polygonFillLabel?.remove();coordinateTableLabel?.remove();
    stack.append(tableCard);
    if(globalNameColor)stack.appendChild(globalNameColor);
    const polygonCards=Array.from(polygonList?.querySelectorAll?.('[data-polygon-style-card]')||[]);
    polygonSection.hidden=polygonCards.length<=1;
    stack.appendChild(polygonSection);
    const presetSection=section.querySelector('.sv-editor-preset-section');
    if(presetSection) stack.prepend(presetSection);
    section.replaceChildren(stack);
  }

  function mountPranchaBetaSourceTool(modal, tool, title) {
    const sourceHost = document.querySelector(`[data-beta-source="${tool}"]`);
    if (!modal || !sourceHost) return;
    const rail = modal.querySelector('.sv-editor-tool-rail');
    const drawer = modal.querySelector('[data-tool-drawer]');
    if (!rail || !drawer) return;
    let button = modal.querySelector(`[data-editor-tool="${tool}"]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'sv-editor-tool-button sv-beta-source-tool-button';
      button.dataset.editorTool = tool;
      button.title = title;
      button.setAttribute('aria-label', title);
      const caption = document.createElement('span');
      caption.className = 'sv-editor-tool-caption';
      caption.textContent = title;
      button.appendChild(caption);
      const zoomButton = rail.querySelector('[data-editor-tool="zoom"]');
      if (tool === 'sheet' && zoomButton) zoomButton.insertAdjacentElement('afterend',button);
      else {
        const sheetButton = rail.querySelector('[data-editor-tool="sheet"]');
        if (tool === 'elements' && sheetButton) sheetButton.insertAdjacentElement('afterend',button);
        else rail.appendChild(button);
      }
    } else {
      button.title = title;
      button.setAttribute('aria-label', title);
      let caption = button.querySelector('.sv-editor-tool-caption');
      if (!caption) {
        caption = document.createElement('span');
        caption.className = 'sv-editor-tool-caption';
        button.appendChild(caption);
      }
      caption.textContent = title;
    }
    let panel = drawer.querySelector(`[data-tool-panel="${tool}"]`);
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'sv-editor-tool-panel sv-beta-source-tool-panel';
      panel.dataset.toolPanel = tool;
      panel.hidden = true;
      const section = document.createElement('div');
      section.className = 'sv-editor-tool-section';
      section.innerHTML = `<span class="sv-editor-tool-label">${title}</span>`;
      const proxyHost = document.createElement('div');
      proxyHost.className = 'sv-beta-source-proxy';
      const clone = sourceHost.cloneNode(true);
      clone.classList.remove('sv-beta-source-controls');
      clone.removeAttribute('data-beta-source');
      clone.removeAttribute('data-beta-source-title');
      clone.querySelectorAll('[for]').forEach((label) => label.removeAttribute('for'));
      const sourceControls = Array.from(sourceHost.querySelectorAll('input,select,textarea'));
      const proxyControls = Array.from(clone.querySelectorAll('input,select,textarea'));
      proxyControls.forEach((proxy,index) => bindBetaProxyControl(proxy, sourceControls[index]));
      while (clone.firstChild) proxyHost.appendChild(clone.firstChild);
      section.appendChild(proxyHost);
      panel.appendChild(section);
      const zoomPanel = drawer.querySelector('[data-tool-panel="zoom"]');
      if (tool === 'sheet' && zoomPanel) zoomPanel.insertAdjacentElement('afterend',panel);
      else {
        const sheetPanel = drawer.querySelector('[data-tool-panel="sheet"]');
        if (tool === 'elements' && sheetPanel) sheetPanel.insertAdjacentElement('afterend',panel);
        else drawer.appendChild(panel);
      }
    }
  }

  const PRANCHA_MAP_TOOL_ORDER = ['elements','miniMap','vertices','lines','servitudes'];
  const CROQUI_MAP_TOOL_ORDER = ['elements','vertices','lines','servitudes'];
  function documentMapToolOrder() {
    return document.body?.dataset?.page === 'pranchas.html' ? PRANCHA_MAP_TOOL_ORDER : CROQUI_MAP_TOOL_ORDER;
  }

  function mountPranchaMapToolGroup(modal) {
    if (!modal) return;
    const rail = modal.querySelector('.sv-editor-tool-rail');
    const drawer = modal.querySelector('[data-tool-drawer]');
    if (!rail || !drawer) return;

    rail.querySelector('[data-editor-tool="zoom"]')?.remove();
    drawer.querySelector('[data-tool-panel="zoom"]')?.remove();
    rail.querySelector('[data-editor-tool="history"]')?.remove();
    drawer.querySelector('[data-tool-panel="history"]')?.remove();

    let mapButton = rail.querySelector('[data-editor-tool="map"]');
    if (!mapButton) {
      mapButton = document.createElement('button');
      mapButton.type = 'button';
      mapButton.className = 'sv-editor-tool-button sv-editor-map-group-button';
      mapButton.dataset.editorTool = 'map';
      mapButton.title = 'Mapa';
      mapButton.textContent = 'Mapa';
      mapButton.setAttribute('aria-label','Mapa');
      const sheetButton = rail.querySelector('[data-editor-tool="sheet"]');
      if (sheetButton) sheetButton.insertAdjacentElement('afterend',mapButton);
      else rail.insertBefore(mapButton,rail.firstChild);
    }

    let mapPanel = drawer.querySelector('[data-tool-panel="map"]');
    const alreadyConsolidated = mapPanel?.dataset?.mapConsolidated === '1';
    if (!mapPanel) {
      mapPanel = document.createElement('div');
      mapPanel.className = 'sv-editor-tool-panel sv-editor-map-panel';
      mapPanel.dataset.toolPanel = 'map';
      mapPanel.hidden = true;
      drawer.appendChild(mapPanel);
    } else {
      mapPanel.classList.add('sv-editor-map-panel');
    }

    mountCompactElementCards(modal);
    mountCompactAppearancePanel(modal);
    mergeConfrontantesIntoVertices(modal);
    removeLegacyDimensionPanel(modal);
    const activeChild = documentMapToolOrder().find((tool) => modal.querySelector(`[data-editor-tool="${tool}"]`)?.classList.contains('active'));
    if (!alreadyConsolidated) {
      const sectionTitles = {
        elements:'Elementos',
        miniMap:'Minimapa',
        vertices:'Vértices',
        lines:'Linhas técnicas',
        servitudes:'Servidões'
      };

      mapPanel.replaceChildren();
      documentMapToolOrder().forEach((tool) => {
        const panel = drawer.querySelector(`[data-tool-panel="${tool}"]`);
        if (!panel || panel === mapPanel) return;
        const section = document.createElement('section');
        section.className = 'sv-editor-map-section';
        section.dataset.mapSection = tool;
        const head = document.createElement('div');
        head.className = 'sv-editor-map-section-head';
        head.innerHTML = `<strong>${sectionTitles[tool] || 'Ferramenta'}</strong>`;
        const body = document.createElement('div');
        body.className = 'sv-editor-map-section-body';
        while (panel.firstChild) body.appendChild(panel.firstChild);
        const normalizedSectionTitle = String(sectionTitles[tool] || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
        body.querySelectorAll('.sv-editor-tool-label').forEach((node) => node.remove());
        body.querySelectorAll('.sv-confrontante-segment-panel-head strong,h2,h3,h4').forEach((node) => {
          const normalizedNodeText = String(node.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
          if (normalizedNodeText && normalizedNodeText === normalizedSectionTitle) node.remove();
        });
        section.append(head, body);
        mapPanel.appendChild(section);
        panel.remove();
      });
      mapPanel.dataset.mapConsolidated = '1';
    }

    // Mapas/Croquis apresenta somente Mapa, Aparência e Assinatura.
    // A antiga aba Croqui é incorporada antes de Elementos, para que o
    // usuário encontre o painel completo na mesma aba e os controles
    // originais (fontes dos proxies) continuem vinculados ao projeto.
    if (document.body?.dataset?.page === 'mapas.html') {
      const sheetPanel = drawer.querySelector('[data-tool-panel="sheet"]');
      if (sheetPanel && !mapPanel.querySelector('[data-map-section="sheet"]')) {
        const section = document.createElement('section');
        section.className = 'sv-editor-map-section';
        section.dataset.mapSection = 'sheet';
        const head = document.createElement('div');
        head.className = 'sv-editor-map-section-head';
        head.innerHTML = '<strong>Croqui</strong>';
        const body = document.createElement('div');
        body.className = 'sv-editor-map-section-body';
        while (sheetPanel.firstChild) body.appendChild(sheetPanel.firstChild);
        body.querySelectorAll('.sv-editor-tool-label').forEach((node) => node.remove());
        section.append(head, body);
        mapPanel.insertBefore(section, mapPanel.firstChild);
        sheetPanel.remove();
      }
      rail.querySelector('[data-editor-tool="sheet"]')?.remove();
      const visibleTools = ['map','appearance','signature'];
      const activeRailTools = [...visibleTools, 'ai'];
      activeRailTools.forEach((tool) => {
        const button = rail.querySelector(`[data-editor-tool="${tool}"]`);
        if (button) rail.appendChild(button);
      });
    }

    // As ferramentas cartográficas existem exclusivamente dentro de Mapa.
    // Remover os botões antigos evita que "Editar cotas" volte a aparecer como
    // uma aba superior concorrente com Aparência/Assinatura.
    documentMapToolOrder().forEach((tool) => rail.querySelector(`[data-editor-tool="${tool}"]`)?.remove());
    ['confrontantes','dimensions'].forEach((tool)=>rail.querySelector(`[data-editor-tool="${tool}"]`)?.remove());

    if (activeChild) modal.dataset.lastMapTool = activeChild;
    mapButton.classList.toggle('active', Boolean(activeChild) || mapPanel.classList.contains('active'));
  }

  function activatePranchaInlineTool(modal, tool) {
    if (!modal || !tool) return false;
    const editor = ensureTechnicalDocumentEditorInstance();
    if (editor?.activateTool) {
      editor.activateTool(tool);
      return true;
    }
    return false;
  }

  function bindPranchaInlineNavigation(modal) {
    const rail = modal?.querySelector?.('.sv-editor-tool-rail');
    if (!rail) return;
    rail.querySelectorAll(':scope > [data-editor-tool]:not([hidden])').forEach((button) => {
      if (button.dataset.pranchaNavBound === '1') return;
      button.dataset.pranchaNavBound = '1';
      button.addEventListener('click',(event)=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        activatePranchaInlineTool(modal, button.dataset.editorTool);
      });
    });
  }

  function setPranchaProjectChrome(modal, projectMode) {
    if (!modal) return;
    const rail = modal.querySelector('.sv-editor-tool-rail');
    const drawer = modal.querySelector('[data-tool-drawer]');
    [rail, drawer].forEach((node) => {
      if (!node) return;
      if (projectMode) {
        node.hidden = true;
        node.style.display = 'none';
        node.setAttribute('aria-hidden','true');
      } else {
        node.hidden = false;
        node.style.removeProperty('display');
        node.removeAttribute('aria-hidden');
      }
    });
  }

  function clearPranchaProjectLivePanel(modal) {
    if (!modal) return;
    modal.classList.remove('is-project-live');
    modal.querySelector('.sv-project-live-panel')?.remove();
    setPranchaProjectChrome(modal, false);
  }

  function mountPranchaProjectLivePanel(modal) {
    if (!modal) return;
    const sourceStep = document.querySelector('.sv-doc-config-card .sv-doc-step[data-step-index="0"]');
    const shell = modal.querySelector('[data-tool-shell]');
    if (!sourceStep || !shell) return;
    clearPranchaProjectLivePanel(modal);

    const panel = document.createElement('div');
    panel.className = 'sv-project-live-panel';
    const clone = sourceStep.cloneNode(true);
    clone.hidden = false;
    clone.className = 'sv-project-live-source';
    clone.removeAttribute('data-step-index');
    clone.querySelectorAll('.sv-doc-step-nav').forEach((node) => node.remove());

    const sourceControls = Array.from(sourceStep.querySelectorAll('input,select,textarea'));
    const proxyControls = Array.from(clone.querySelectorAll('input,select,textarea'));
    proxyControls.forEach((proxy,index) => bindBetaProxyControl(proxy, sourceControls[index]));
    panel.appendChild(clone);
    shell.insertBefore(panel, shell.firstChild);
    modal.classList.add('is-project-live');
    setPranchaProjectChrome(modal, true);
  }

  function enhancePranchaInlinePresentation(workspace) {
    if (document.body?.dataset?.page !== 'pranchas.html' || !workspace) return;
    const modal = workspace.querySelector('.sv-confrontante-editor-modal.is-inline-beta');
    if (!modal) return;
    const mode = workspace.dataset.pranchaInlineMode || 'personalization';
    if (mode === 'project') {
      mountPranchaProjectLivePanel(modal);
      bindPranchaInlineNavigation(modal);
    } else {
      clearPranchaProjectLivePanel(modal);
      mountPranchaBetaSourceTool(modal,'sheet','Prancha');
      if (!modal.querySelector('[data-tool-panel="map"]')) mountPranchaBetaSourceTool(modal,'elements','Elementos');
      mountPranchaMapToolGroup(modal);
      bindPranchaInlineNavigation(modal);
      const activeTool = modal.querySelector('[data-editor-tool].active')?.dataset?.editorTool || '';
      if (!activeTool || activeTool === 'zoom' || activeTool === 'history') activatePranchaInlineTool(modal,'sheet');
    }
    try { window.dispatchEvent(new CustomEvent('surveyor:beta-personalization-mounted',{detail:{workspace,modal,mode}})); } catch (_error) {}
  }


  function enhanceMapasInlinePresentation(workspace) {
    if (document.body?.dataset?.page !== 'mapas.html' || !workspace) return;
    const modal = workspace.querySelector('.sv-confrontante-editor-modal.is-inline-beta');
    if (!modal) return;
    clearPranchaProjectLivePanel(modal);
    if (!modal.querySelector('[data-tool-panel="map"]')) {
      mountPranchaBetaSourceTool(modal,'sheet','Croqui');
      mountPranchaBetaSourceTool(modal,'elements','Elementos');
    }
    mountPranchaMapToolGroup(modal);
    bindPranchaInlineNavigation(modal);
    // Não ativar a aba Croqui que foi incorporada: ela deixava o painel
    // Elementos oculto atrás da nova aba Mapa.
    const activeTool = modal.querySelector('[data-editor-tool].active')?.dataset?.editorTool || '';
    if (!['map','appearance','signature','ai'].includes(activeTool)) activatePranchaInlineTool(modal,'map');
    // Só mostrar a bancada depois que as abas e os controles definitivos
    // estiverem montados. Evita o flash dos botões legados na transição.
    modal.dataset.inlineMapReady = '1';
    try { window.dispatchEvent(new CustomEvent('surveyor:beta-personalization-mounted',{detail:{workspace,modal,mode:'personalization'}})); } catch (_error) {}
  }

  let mapasPersonalizationStart = null;
  async function startMapasPersonalization(workspace) {
    if (mapasPersonalizationStart) return mapasPersonalizationStart;
    const operation = startMapasPersonalizationOnce(workspace);
    mapasPersonalizationStart = operation;
    operation.finally(() => { if (mapasPersonalizationStart === operation) mapasPersonalizationStart = null; }).catch(() => {});
    return operation;
  }
  async function startMapasPersonalizationOnce(workspace) {
    if (document.body?.dataset?.page !== 'mapas.html' || !(workspace instanceof Element)) return false;
    const selectedProjectId = String(select?.value || '');
    if (!selectedProjectId) {
      betaPersonalizationStatus('Selecione um projeto na etapa Projeto para iniciar a personalização.', 'warning');
      return false;
    }
    // A prévia do Projeto é a mesma geometria usada pela Personalização.
    // Regerá-la por ausência de uma marca opcional cria uma segunda inicialização.
    const hasPreparedScene = Boolean(lastSvg && lastSvgProjectId === selectedProjectId);
    // Não manter um timer de rebuild da etapa Projeto concorrendo com a entrada.
    if (mapasLiveTimer) {
      clearTimeout(mapasLiveTimer);
      mapasLiveTimer = 0;
      mapasProjectPreviewDeferred = true;
      mapasProjectPreviewStructuralPending = true;
    }
    if (!hasPreparedScene) {
      mountPranchaPreparingShell(workspace,{ noun:'croqui', message:'Preparando croqui para edição…' });
      betaPersonalizationStatus('Preparando o croqui para edição…', 'loading');
    }
    try {
      if (!hasPreparedScene) await generateSelected({ silent:true, inlineOnly:true, fastPreview:true, preferCache:false });
      if (!lastSvg || lastSvgProjectId !== selectedProjectId) {
        betaPersonalizationStatus('Não foi possível preparar o croqui. Selecione novamente o projeto e tente outra vez.', 'error');
        clearPranchaPreparingShell(workspace);
        workspace.classList.remove('sv-beta-personalization-active');
        return false;
      }
      const editor = await loadTechnicalDocumentEditorInstance();
      if (!editor?.start) {
        betaPersonalizationStatus('Editor técnico indisponível. Recarregue a página e tente novamente.', 'error');
        clearPranchaPreparingShell(workspace);
        workspace.classList.remove('sv-beta-personalization-active');
        return false;
      }
      hideLegacyDocumentEditorControls();
      workspace.dataset.betaPersonalizationSelected = '1';
      if (editor.isActive?.() && editor.presentationMode?.() === 'inline' && editorSessionProjectId===selectedProjectId) editor.setVisible?.(true);
      else { if(editor.isActive?.()) editor.close?.(); editorSessionProjectId=selectedProjectId; await editor.start({ mode:'inline', mount:workspace }); }
      clearPranchaPreparingShell(workspace);
      if (!editor.isActive?.()) throw new Error('A bancada de edição não foi iniciada. Tente novamente.');
      // Não manter duas cópias completas da mesma prancha (incluindo o fundo
      // satélite) ao mesmo tempo. A string original continua em lastSvg para
      // exportação e para reconstruir a prévia quando voltar à etapa Projeto.
      const previewHost = $('mapPreview');
      if (previewHost) {
        suspendMapPreviewFitObserver();
        previewHost.replaceChildren();
        previewHost.hidden = true;
      }
      enhanceMapasInlinePresentation(workspace);
      requestAnimationFrame(() => requestAnimationFrame(() => editor.fitToViewport?.()));
      betaPersonalizationStatus('Personalização ativa. O croqui responde às alterações do editor.', 'ready');
      return true;
    } catch (error) {
      clearPranchaPreparingShell(workspace);
      workspace.classList.remove('sv-beta-personalization-active');
      throw error;
    }
  }

  function suspendMapasPersonalization(workspace) {
    if (document.body?.dataset?.page !== 'mapas.html') return;
    const editor = ensureTechnicalDocumentEditorInstance();
    if (editor?.isActive?.() && editor.presentationMode?.() === 'inline') editor.setVisible?.(false);
    if (workspace) workspace.dataset.betaPersonalizationSelected = '0';
    // Atualiza a prévia pesada somente depois de sair da bancada; enquanto
    // o SVG editável está aberto os campos de texto são alterados in-place.
    if (mapasProjectPreviewDeferred && select?.value && mapasProjectPreviewStructuralPending) {
      mapasProjectPreviewDeferred = false;
      mapasProjectPreviewStructuralPending = false;
      mapasPreviewAwaitingRefresh = true;
      // Somente alterações estruturais exigem reprocessar fundo/escala do mapa.
      setPreviewMessage('Atualizando croqui…');
      scheduleMapasLivePreview();
    } else if (lastSvg && lastSvgProjectId === String(select?.value || '')) {
      // Texto, rótulos e ajustes de aparência já estão na cena publicada pelo
      // editor. Reconstruir com dados antigos apagava nomes e causava travadas.
      const project = projects.find((item) => item.id === String(select.value || '')) || null;
      if (mapasProjectPreviewDeferred) lastSvg = patchSvgLiveFields(lastSvg,currentPranchaLiveFieldValues(project));
      mapasProjectPreviewDeferred = false;
      mapasProjectPreviewStructuralPending = false;
      renderMapPreviewSvg(lastSvg).catch((error)=>console.warn('[Surveyor] Falha ao restaurar prévia do Projeto:',error));
    }
  }

  let pranchaLiveTimer = 0;
  let pranchaLiveBusy = false;
  let pranchaLiveQueued = false;
  let pranchaLiveQueuedProjectSwitch = false;
  let pranchaLiveQueuedProjectId = '';
  let mapasLiveTimer = 0;
  let mapasLiveBusy = false;
  let mapasLiveQueued = false;
  let mapasProjectPreviewDeferred = false;

  function mapasInlineEditorActive() {
    return document.body?.dataset?.page === 'mapas.html'
      && Boolean(technicalDocumentEditor?.isActive?.())
      && technicalDocumentEditor?.presentationMode?.() === 'inline'
      && String(editorSessionProjectId || '') === String(select?.value || '')
      && document.querySelector('.sv-doc-workspace')?.dataset?.betaPersonalizationSelected === '1';
  }

  // Dados textuais não exigem recriar o SVG com dezenas de vértices e a imagem
  // de satélite. Aplicá-los na cena ativa é suficiente durante a edição.
  function patchMapasEditorLiveFields() {
    if (!mapasInlineEditorActive()) return false;
    const project = projects.find((item) => item.id === String(select?.value || '')) || null;
    technicalDocumentEditor?.patchLiveFields?.(currentPranchaLiveFieldValues(project));
    mapasProjectPreviewDeferred = true;
    return true;
  }

  async function refreshMapasLivePreview(){
    if(document.body?.dataset?.page!=='mapas.html' || !select?.value) return false;
    // Um timer antigo pode disparar depois de o editor ter aberto.
    // Nesse caso apenas registrar a prévia do Projeto como desatualizada.
    if (mapasInlineEditorActive()) { mapasProjectPreviewDeferred = true; return false; }
    if(mapasLiveBusy){mapasLiveQueued=true;return false;}
    mapasLiveBusy=true;
    try{
      return await generateSelected({silent:true,livePreview:true,fastPreview:true,preferCache:false});
    }finally{
      mapasLiveBusy=false;
      // Falha de geração não pode deixar a proteção da prévia bloqueada.
      mapasPreviewAwaitingRefresh = false;
      if(mapasLiveQueued){
        mapasLiveQueued=false;
        window.setTimeout(()=>refreshMapasLivePreview().catch((error)=>console.error('[Surveyor] Falha ao atualizar croqui ao vivo:',error)),0);
      }
    }
  }

  function scheduleMapasLivePreview(delay=180){
    if(document.body?.dataset?.page!=='mapas.html' || !select?.value)return;
    // Mudanças estruturais dentro do editor ficam para quando Projeto voltar.
    if (mapasInlineEditorActive()) {
      mapasProjectPreviewDeferred = true;
      mapasProjectPreviewStructuralPending = true;
      return;
    }
    // O SVG com satélite, rótulos, vértices e confrontantes é caro de reconstruir.
    // Evitar uma regeneração a cada tecla/etapa de um slider. A edição direta
    // no SVG continua imediata; só a renderização estrutural é agrupada.
    clearTimeout(mapasLiveTimer);
    mapasLiveTimer=window.setTimeout(()=>refreshMapasLivePreview().catch((error)=>console.error('[Surveyor] Falha ao atualizar croqui ao vivo:',error)),Math.max(180,Number(delay)||0));
  }

  async function refreshPranchaLivePreview(options = {}) {
    if (document.body?.dataset?.page !== 'pranchas.html' || !select?.value) return false;
    const requestProjectId=String(options.projectId || select.value || '');
    if (!requestProjectId || requestProjectId !== String(select.value || '')) return false;
    if (pranchaLiveBusy) {
      pranchaLiveQueued = true;
      pranchaLiveQueuedProjectSwitch = pranchaLiveQueuedProjectSwitch || options.projectSwitch === true;
      pranchaLiveQueuedProjectId = requestProjectId;
      return false;
    }
    pranchaLiveBusy = true;
    const workspace = document.querySelector('.sv-doc-workspace');
    const editor = ensureTechnicalDocumentEditorInstance();
    const desiredInlineMode = workspace?.dataset?.pranchaInlineMode || '';
    const inlineActive = Boolean(editor?.isActive?.() && editor.presentationMode?.() === 'inline' && editorSessionProjectId === requestProjectId && workspace?.dataset?.betaPersonalizationSelected === '1');
    try {
      if (inlineActive && options.projectSwitch !== true) {
        try { editor.commitPreviewState?.(); } catch (error) { console.warn('[Surveyor] Não foi possível consolidar a prévia local antes da atualização:', error); }
      }
      const generated = await generateSelected({ silent:true, inlineOnly:true, fastPreview:true, preferCache:true });
      if (!generated || requestProjectId !== String(select.value || '') || lastSvgProjectId !== requestProjectId) return false;
      if ((desiredInlineMode === 'project' || desiredInlineMode === 'personalization') && workspace?.isConnected) {
        if (editor?.isActive?.()) editor.close?.();
        editorSessionProjectId = requestProjectId;
        workspace.dataset.betaPersonalizationSelected = '1';
        workspace.dataset.pranchaInlineMode = desiredInlineMode;
        await editor.start({ mode:'inline', mount:workspace });
        if (requestProjectId !== String(select.value || '')) { editor.close?.(); editorSessionProjectId=''; return false; }
        enhancePranchaInlinePresentation(workspace);
        editor.patchLiveElements?.(currentPranchaLiveElementValues());
        requestAnimationFrame(() => requestAnimationFrame(() => editor.fitToViewport?.()));
      }
      const liveProject=projects.find((item)=>item.id===requestProjectId) || null;
      window.setTimeout(()=>{ if(requestProjectId===String(select.value||'')) patchPranchaLiveFields(); },0);
      if(liveProject && requestProjectId===String(select.value||'')) hydratePranchaLiveAssets(liveProject);
      return true;
    } finally {
      pranchaLiveBusy = false;
      if (pranchaLiveQueued) {
        const queuedProjectId=pranchaLiveQueuedProjectId;
        const queuedProjectSwitch=pranchaLiveQueuedProjectSwitch;
        pranchaLiveQueued = false;
        pranchaLiveQueuedProjectSwitch = false;
        pranchaLiveQueuedProjectId = '';
        if (queuedProjectId && queuedProjectId === String(select?.value || '')) {
          window.setTimeout(() => refreshPranchaLivePreview({projectSwitch:queuedProjectSwitch,projectId:queuedProjectId}).catch((error)=>console.error('[Surveyor] Falha ao atualizar prévia ao vivo:',error)), 0);
        }
      }
    }
  }

  function schedulePranchaLivePreview(delay = 260) {
    if (document.body?.dataset?.page !== 'pranchas.html' || !select?.value) return;
    clearTimeout(pranchaLiveTimer);
    pranchaLiveTimer = window.setTimeout(() => refreshPranchaLivePreview().catch((error)=>console.error('[Surveyor] Falha ao atualizar prévia ao vivo:',error)), delay);
  }

  function clearPranchaPreparingShell(workspace) {
    workspace?.querySelector?.('.sv-prancha-inline-preparing')?.remove();
    workspace?.classList?.remove?.('sv-prancha-project-shell');
  }

  function mountPranchaPreparingShell(workspace) {
    const options = arguments[1] || {};
    if (!(workspace instanceof Element)) return null;
    clearPranchaPreparingShell(workspace);
    const pageId = document.body?.dataset?.page || 'pranchas.html';
    const sourceStep = document.querySelector('.sv-doc-config-card .sv-doc-step[data-step-index="0"]');
    const shell = document.createElement('section');
    shell.className = 'sv-prancha-inline-preparing';
    const left = document.createElement('div');
    left.className = 'sv-prancha-inline-preparing-left';
    if (sourceStep) {
      const clone = sourceStep.cloneNode(true);
      clone.hidden = false;
      clone.className = 'sv-project-live-source';
      clone.removeAttribute('data-step-index');
      clone.querySelectorAll('.sv-doc-step-nav').forEach((node) => node.remove());
      const sourceControls = Array.from(sourceStep.querySelectorAll('input,select,textarea'));
      const proxyControls = Array.from(clone.querySelectorAll('input,select,textarea'));
      proxyControls.forEach((proxy,index) => bindBetaProxyControl(proxy, sourceControls[index]));
      left.appendChild(clone);
    }
    const noun = options.noun || (pageId === 'mapas.html' ? 'croqui' : 'prancha');
    const defaultMessage = select?.value ? `Preparando ${noun} para edição…` : `Selecione um projeto para visualizar o ${noun}.`;
    const right = document.createElement('div');
    right.className = 'sv-prancha-inline-preparing-preview';
    right.setAttribute('aria-label', pageId === 'mapas.html' ? 'Pré-visualização do croqui' : 'Pré-visualização da prancha');
    right.innerHTML = `<div class="sv-prancha-inline-empty-sheet" aria-hidden="true"></div><p class="sv-prancha-inline-empty-message">${options.message || defaultMessage}</p>`;
    shell.append(left,right);
    workspace.dataset.betaPersonalizationSelected = '1';
    workspace.classList.add('sv-beta-personalization-active','sv-prancha-project-shell');
    workspace.appendChild(shell);
    syncProjectSelectProxies();
    return shell;
  }

  async function startPranchaProjectLive(workspace) {
    if (document.body?.dataset?.page !== 'pranchas.html' || !(workspace instanceof Element)) return false;
    workspace.dataset.pranchaInlineMode = 'project';
    const currentEditor = ensureTechnicalDocumentEditorInstance();
    if (!select?.value) {
      if (currentEditor?.isActive?.() && currentEditor.presentationMode?.() === 'inline') currentEditor.close?.();
      hideLegacyDocumentEditorControls();
      mountPranchaPreparingShell(workspace);
      return true;
    }
    const needsPreparingShell = !lastSvg && !(currentEditor?.isActive?.() && currentEditor.presentationMode?.() === 'inline');
    if (needsPreparingShell) mountPranchaPreparingShell(workspace);
    let started = false;
    try {
      if (!lastSvg) await withTimeout(generateSelected({ silent:true, inlineOnly:true, fastPreview:true, preferCache:true }), 30000, 'Tempo esgotado ao preparar a prancha.');
      if (!lastSvg || workspace.dataset.pranchaInlineMode !== 'project') return false;
      const editor = await withTimeout(loadTechnicalDocumentEditorInstance(), 15000, 'O editor técnico excedeu o tempo limite.');
      if (!editor?.start) throw new Error('Editor técnico indisponível. Atualize a página e tente novamente.');
      hideLegacyDocumentEditorControls();
      workspace.dataset.betaPersonalizationSelected = '1';
      if (editor.isActive?.() && editor.presentationMode?.() === 'inline' && editorSessionProjectId===String(select?.value||'')) editor.setVisible?.(true);
      else { if(editor.isActive?.()) editor.close?.(); editorSessionProjectId=String(select?.value||''); await withTimeout(editor.start({ mode:'inline', mount:workspace }), 20000, 'O editor da prancha não respondeu em 20 segundos.'); }
      started = true;
      clearPranchaPreparingShell(workspace);
      enhancePranchaInlinePresentation(workspace);
      editor.patchLiveElements?.(currentPranchaLiveElementValues());
      requestAnimationFrame(() => requestAnimationFrame(() => editor.fitToViewport?.()));
      const liveProject=projects.find((item)=>item.id===select?.value) || null;
      if(liveProject) hydratePranchaLiveAssets(liveProject);
      return true;
    } catch (error) {
      console.error('[Surveyor] Falha ao abrir prancha no editor:', error);
      setPreviewMessage(error?.message || 'Não foi possível abrir a prancha.');
      toast(error?.message || 'Não foi possível abrir a prancha.', 'error');
      return false;
    } finally {
      if (!started) {
        clearPranchaPreparingShell(workspace);
        workspace.classList.remove('sv-beta-personalization-active');
      }
    }
  }

  async function startPranchaBetaPersonalization(workspace) {
    if (document.body?.dataset?.page !== 'pranchas.html' || !(workspace instanceof Element)) return false;
    workspace.dataset.pranchaInlineMode = 'personalization';
    clearPranchaPreparingShell(workspace);
    if (!select?.value) {
      betaPersonalizationStatus('Selecione um projeto na etapa Projeto para iniciar a personalização.', 'warning');
      return false;
    }
    betaPersonalizationStatus('Preparando a prancha para edição…', 'loading');
    if (!lastSvg) await generateSelected({ silent:true, inlineOnly:true, fastPreview:true, preferCache:true });
    if (!lastSvg || workspace.dataset.pranchaInlineMode !== 'personalization') {
      if (!lastSvg) betaPersonalizationStatus('Não foi possível preparar a prévia do projeto. Selecione novamente o projeto e tente outra vez.', 'error');
      return false;
    }
    const editor = await loadTechnicalDocumentEditorInstance();
    if (!editor?.start) {
      betaPersonalizationStatus('Editor técnico indisponível. Recarregue a página e tente novamente.', 'error');
      return false;
    }
    hideLegacyDocumentEditorControls();
    workspace.dataset.betaPersonalizationSelected = '1';
    if (editor.isActive?.() && editor.presentationMode?.() === 'inline' && editorSessionProjectId===String(select?.value||'')) editor.setVisible?.(true);
    else { if(editor.isActive?.()) editor.close?.(); editorSessionProjectId=String(select?.value||''); await editor.start({ mode:'inline', mount:workspace }); }
    enhancePranchaInlinePresentation(workspace);
    editor.patchLiveElements?.(currentPranchaLiveElementValues());
    requestAnimationFrame(() => requestAnimationFrame(() => editor.fitToViewport?.()));
    const liveProject=projects.find((item)=>item.id===select?.value) || null;
    if(liveProject) hydratePranchaLiveAssets(liveProject);
    betaPersonalizationStatus('Personalização beta ativa. A prévia responde em tempo real.', 'ready');
    return true;
  }

  function suspendPranchaBetaPersonalization(workspace) {
    if (document.body?.dataset?.page !== 'pranchas.html') return;
    const editor = ensureTechnicalDocumentEditorInstance();
    if (editor?.isActive?.() && editor.presentationMode?.() === 'inline') editor.setVisible?.(false);
    if (workspace) {
      clearPranchaPreparingShell(workspace);
      workspace.dataset.betaPersonalizationSelected = '0';
      workspace.dataset.pranchaInlineMode = '';
      workspace.classList?.remove?.('sv-beta-personalization-active');
    }
  }

  window.addEventListener('surveyor:document-step-change', (event) => {
    if (event.detail?.page === 'mapas.html') {
      const workspace = event.detail?.workspace || document.querySelector('.sv-doc-workspace');
      if (event.detail?.betaPersonalization) {
        startMapasPersonalization(workspace).catch((error) => {
          console.error('[Surveyor] Falha ao iniciar Personalização de Mapas/Croquis:', error);
          betaPersonalizationStatus(error?.message || 'Falha ao iniciar a personalização.', 'error');
        });
      } else suspendMapasPersonalization(workspace);
      return;
    }
    if (event.detail?.page !== 'pranchas.html') return;
    const workspace = event.detail?.workspace || document.querySelector('.sv-doc-workspace');
    const stepTitle = String(event.detail?.title || '').trim().toLowerCase();
    if (stepTitle === 'projeto') {
      if (workspace) workspace.dataset.pranchaInlineMode = 'project';
      startPranchaProjectLive(workspace).catch((error) => console.error('[Surveyor] Falha ao iniciar prévia ao vivo do Projeto:', error));
      return;
    }
    if (event.detail?.betaPersonalization) {
      if (workspace) workspace.dataset.pranchaInlineMode = 'personalization';
      startPranchaBetaPersonalization(workspace).catch((error) => {
        console.error('[Surveyor] Falha ao iniciar Personalização beta:', error);
        betaPersonalizationStatus(error?.message || 'Falha ao iniciar a personalização.', 'error');
      });
      return;
    }
    suspendPranchaBetaPersonalization(workspace);
  });
  window.addEventListener('surveyor:open-beta-personalization', (event) => {
    if (event.detail?.page === 'mapas.html') {
      const workspace = event.detail?.workspace || document.querySelector('.sv-doc-workspace');
      if (workspace) workspace.dataset.betaPersonalizationSelected = '1';
      startMapasPersonalization(workspace).catch((error) => {
        console.error('[Surveyor] Falha ao abrir Personalização de Mapas/Croquis:', error);
        betaPersonalizationStatus(error?.message || 'Falha ao abrir a personalização.', 'error');
      });
      return;
    }
    if (event.detail?.page !== 'pranchas.html') return;
    const workspace = event.detail?.workspace || document.querySelector('.sv-doc-workspace');
    if (workspace) workspace.dataset.betaPersonalizationSelected = '1';
    startPranchaBetaPersonalization(workspace).catch((error) => {
      console.error('[Surveyor] Falha ao reabrir Personalização beta:', error);
      betaPersonalizationStatus(error?.message || 'Falha ao abrir a personalização.', 'error');
    });
  });

  window.addEventListener('surveyor:technical-editor-opened',(event)=>{
    if (event.detail?.mode !== 'inline') return;
    const workspace = event.detail?.mount || document.querySelector('.sv-doc-workspace');
    if (document.body?.dataset?.page === 'pranchas.html') enhancePranchaInlinePresentation(workspace);
    else if (document.body?.dataset?.page === 'mapas.html') enhanceMapasInlinePresentation(workspace);
  });

  async function generateSelected(options = {}) {
    const silent = options?.silent === true;
    const inlineOnly = options?.inlineOnly === true;
    const fastPreview = options?.fastPreview === true;
    updateConfrontanteEditorControls();
    const token = ++generationToken;
    const selectedId = select.value;
    if (!selectedId) { if (!silent) setPreviewMessage(document.body?.dataset?.page === 'mapas.html' ? 'Selecione um projeto salvo para visualizar o croqui.' : 'Selecione um projeto salvo para visualizar a prancha.'); return false; }
    const previewHost = $('mapPreview');
    if (previewHost) { previewHost.hidden = false; previewHost.classList?.add?.('document-preview-visible'); }
    if (!silent) setPreviewMessage(document.body?.dataset?.page === 'mapas.html' ? 'Preparando croqui para edição...' : 'Preparando prancha técnica...');
    try {
      const p = await resolveProject(selectedId,{cachedOnly:fastPreview || options?.cachedOnly === true});
      if (token !== generationToken) return false;
      if (!p) { if (!silent) setPreviewMessage('Projeto não encontrado ou indisponível.'); return false; }
      restoreProjectElementVisibility(p);
      if (document.body?.dataset?.page === 'pranchas.html') refreshNativePranchaDocument(p);
      let svg = '';
      if (fastPreview && options?.preferCache !== false) svg = readPranchaSvgCache(p);
      if (svg) { svg = patchSvgLiveFields(svg,currentPranchaLiveFieldValues(p)); svg = patchSvgLiveElements(svg,currentPranchaLiveElementValues()); }
      else {
        svg = await generateCroqui(p,{fastPreview,livePreview:options?.livePreview===true});
        if (fastPreview && svg) { svg = patchSvgLiveElements(svg,currentPranchaLiveElementValues()); writePranchaSvgCache(p,svg); }
      }
      if (token !== generationToken) return false;
      lastSvg = svg;
      lastSvgProjectId = selectedId;
      const previewHost = $('mapPreview');
      if (!previewHost) throw new Error('Área de pré-visualização indisponível.');
      if (!inlineOnly) {
        previewHost.hidden = false;
        if (document.body?.dataset?.page === 'mapas.html') {
          await renderMapPreviewSvg(svg);
          if (token !== generationToken) return false;
        } else if (window.SurveyorPdfPreview?.renderHtml) {
          try {
            await withTimeout(window.SurveyorPdfPreview.renderHtml(previewHost, svg, { orientation: 'landscape', title: 'Prancha técnica', fitOnePage: true, pageFormat: $('printFormat')?.value || 'a4' }), 18000, 'A pré-visualização da prancha excedeu o tempo limite.');
            if (token !== generationToken) return false;
          } catch (previewError) {
            console.warn('Preview PDF falhou; exibindo SVG diretamente:', previewError);
            previewHost.innerHTML = svg;
          }
        } else {
          previewHost.innerHTML = svg;
        }
        previewHost.classList?.add?.('document-preview-visible');
      }
      updateConfrontanteEditorControls();
      try { window.dispatchEvent(new CustomEvent('surveyor:document-generation-finished',{detail:{page:document.body?.dataset?.page || 'mapas.html'}})); } catch (_error) {}
      return true;
    } catch (error) {
      console.error('Erro ao gerar croqui:', error);
      if (token === generationToken) {
        if (silent) toast(error.message || 'Não foi possível atualizar a prancha.', 'error');
        else setPreviewMessage(error.message || 'Não foi possível gerar o croqui.');
      }
      return false;
    }
  }

  if ($('generateMapV19')) {
    technicalDocumentEditor = ensureTechnicalDocumentEditorInstance();
    installMapasNativeProjectPreviewGuard();
    ensureConfrontanteEditorControls();
    updateConfrontanteEditorControls();
    $('generateMapV19').addEventListener('click', generateSelected);
    select.addEventListener('change', async () => {
      const loadingToken=++projectSwitchLoadingToken;
      select.dataset.projectChoiceExplicit = '1';
      generationToken += 1;
      pranchaAssetHydrationToken += 1;
      window.SurveyorPdfPreview?.reset?.('mapPreview');
      if (select.value) setProjectSwitchLoading(true);
      try {
        if (!select.value) {
          lastSvg = '';
          lastSvgProjectId = '';
          lastNativeDocument = null;
          lastNativeDocumentProjectId = '';
          closeConfrontanteEditor();
          if (document.body?.dataset?.page === 'pranchas.html') {
            const workspace = document.querySelector('.sv-doc-workspace');
            if (workspace) {
              workspace.dataset.pranchaInlineMode = 'project';
              await startPranchaProjectLive(workspace);
              return;
            }
          }
          setPreviewMessage(document.body?.dataset?.page === 'mapas.html' ? 'Selecione um projeto salvo para visualizar o croqui.' : 'Selecione um projeto salvo para visualizar a prancha.');
          return;
        }
        const selectedProjectId=String(select.value || '');
        closeConfrontanteEditor();
        lastSvg=''; lastSvgProjectId=''; lastNativeDocument=null; lastNativeDocumentProjectId='';
        if (document.body?.dataset?.page === 'pranchas.html') {
          const workspace = document.querySelector('.sv-doc-workspace');
          if (workspace) mountPranchaPreparingShell(workspace,{message:'Carregando projeto…'});
          const ready = await withTimeout(
            refreshPranchaLivePreview({projectSwitch:true,projectId:selectedProjectId}),
            30000, 'O carregamento da prancha excedeu 30 segundos. Selecione novamente o projeto.'
          );
          if (!ready && selectedProjectId === String(select.value || '')) {
            const currentShell = document.querySelector('.sv-doc-workspace');
            clearPranchaPreparingShell(currentShell);
            setPreviewMessage('Não foi possível preparar a prancha. Confira se o projeto contém um perímetro válido e tente novamente.');
          }
        } else {
          await generateSelected({ silent:true, livePreview:true, fastPreview:true, preferCache:false });
        }
      } catch (error) {
        console.error('[Surveyor] Falha ao trocar projeto na bancada:',error);
        clearPranchaPreparingShell(document.querySelector('.sv-doc-workspace'));
        setPreviewMessage(error?.message || 'Falha ao carregar projeto. Tente novamente.');
        toast(error?.message || 'Falha ao carregar projeto.', 'error');
      } finally {
        if (loadingToken===projectSwitchLoadingToken) setProjectSwitchLoading(false);
      }
    });

    const liveTextFields = ['mapScale','mapSheetNumber','mapTitle','mapRegistration','mapDistrict','mapRegistryOffice','mapIncra','mapCnib','mapTechnician'];
    liveTextFields.forEach((id) => {
      const control=$(id); if(!control)return;
      const patch=()=>{
        if(document.body?.dataset?.page==='pranchas.html' && select.value && lastSvg) patchPranchaLiveFields();
        else if(document.body?.dataset?.page==='mapas.html' && select.value) {
          if (!patchMapasEditorLiveFields()) scheduleMapasLivePreview(25);
        }
      };
      control.addEventListener('input',patch);
      control.addEventListener('change',patch);
    });

    // Os checkboxes da cartografia são injetados por core/documents.js durante
    // DOMContentLoaded. Este módulo carrega ANTES da criação desses controles:
    // associar listeners diretamente a $(id) aqui deixa o botão visual mudar
    // de cor, sem remover as cotas do SVG. A delegação funciona também com as
    // cópias dos controles abertas nas bancadas Projeto/Personalização.
    const liveElementPranchaControls = new Set(Object.values(ELEMENT_VISIBILITY_CONTROLS));
    document.addEventListener('change',(event)=>{
      const target=event.target;
      if(!target || !liveElementPranchaControls.has(String(target.id||'')))return;
      if(!select?.value)return;
      const page=String(document.body?.dataset?.page||'');
      if(page==='pranchas.html' || page==='mapas.html') patchDocumentLiveElements();
    });

    const structuralPranchaControls = ['mapSheetLayout','mapBackground','mapZoom','printFormat'];
    structuralPranchaControls.forEach((id) => {
      const control=$(id); if(!control)return;
      const schedule=()=>{
        if(document.body?.dataset?.page==='pranchas.html') { refreshNativePranchaDocument(); schedulePranchaLivePreview(90); }
        else if(document.body?.dataset?.page==='mapas.html' && select.value) scheduleMapasLivePreview(15);
      };
      // Os quatro controles estruturais são selects. input + change no
      // mesmo seletor disparavam duas renderizações de SVG por escolha.
      if (control.tagName === 'SELECT') control.addEventListener('change',schedule);
      else { control.addEventListener('input',schedule); control.addEventListener('change',schedule); }
    });

    // Remover somente indicadores auxiliares da cena exportada; preservar
    // rótulos V/P/M, cotas, geometria, propriedades e estado de edição.
    const currentPranchaExportSvg = () => {
      if (document.body?.dataset?.page === 'pranchas.html') {
        try { technicalDocumentEditor?.commitPreviewState?.(); } catch (error) { console.warn('[Surveyor] Falha ao consolidar a cena antes do download:', error); }
      }
      // A prévia de Projeto fica propositalmente adiada durante a edição.
      // Ao exportar SVG, aplicar os campos atuais uma única vez para não
      // entregar título/identificação anteriores à última alteração.
      if (document.body?.dataset?.page === 'mapas.html' && mapasProjectPreviewDeferred && lastSvg) {
        const project = projects.find((item)=>item.id===String(select?.value||'')) || null;
        return printableDocumentSvg(patchSvgLiveElements(patchSvgLiveFields(lastSvg,currentPranchaLiveFieldValues(project)) || lastSvg,currentPranchaLiveElementValues()));
      }
      // Segurança da exportação: os controles são a fonte da visibilidade,
      // inclusive quando a prévia veio de cache ou chegou em outra ordem.
      return printableDocumentSvg(patchSvgLiveElements(lastSvg,currentPranchaLiveElementValues()));
    };
    function expectedConfrontanteNames(project) {
      if (!project || currentPranchaLiveElementValues().confrontantes === false) return [];
      const props=perimeter(project)?.properties || {};
      // A lista visual, quando existe, representa a edição efetivamente escolhida.
      const visual=props.confrontanteVisualLayout?.segments;
      const ranges=props.confrontanteTrechos;
      const list=Array.isArray(visual) && visual.length ? visual : (Array.isArray(ranges) && ranges.length ? ranges : (props.confrontantes || []));
      if (!Array.isArray(list)) return [];
      return [...new Set(list.map((item)=>String(item?.nome || item?.name || item?.confrontante || item?.label || '').trim()).filter(Boolean))];
    }
    function projectNeedsConfrontantesInExport(project) {
      return expectedConfrontanteNames(project).length>0;
    }
    function hasPrintableConfrontante(svgText, project) {
      const raw=String(svgText || '');
      if (!raw.includes('sv-confrontante-callout')) return false;
      try {
        const xml=new DOMParser().parseFromString(raw,'image/svg+xml');
        if (xml.querySelector('parsererror')) return false;
        const names=[...xml.querySelectorAll('.sv-confrontante-callout[data-confrontante-name]')]
          .filter((node)=>node.querySelector('.sv-confrontante-name-text'))
          .map((node)=>String(node.getAttribute('data-confrontante-name')||'').trim().toLocaleLowerCase('pt-BR'));
        if (!names.length) return false;
        const expected=expectedConfrontanteNames(project).map((name)=>name.toLocaleLowerCase('pt-BR'));
        return expected.every((name)=>names.includes(name));
      } catch (_error) { return false; }
    }
    async function readyPranchaExportSvg() {
      let svg = currentPranchaExportSvg();
      const selectedId = String(select?.value || '');
      const assertSameProject = () => {
        if (selectedId !== String(select?.value || '')) throw new Error('O projeto mudou durante a exportação. Inicie novamente o download.');
      };
      let project = projects.find((item) => item.id === selectedId) || null;
      if (!projectNeedsConfrontantesInExport(project) || hasPrintableConfrontante(svg,project)) return svg;
      // Recuperação excepcional: um snapshot anterior à gravação pode não
      // carregar os rótulos. Tentar reconstruir da geometria e do cadastro,
      // mas nunca entregar silenciosamente um PDF sem os confrontantes.
      let refreshed = null;
      try { refreshed = await window.GeoRuralProjects?.get?.(selectedId, true) || null; }
      catch (error) { console.warn('[Surveyor] Não foi possível recarregar confrontantes para exportação:',error); }
      assertSameProject();
      if (refreshed && projectHasRenderablePerimeter(refreshed)) {
        project = refreshed;
        const index = projects.findIndex((item) => item.id === selectedId);
        if (index >= 0) projects[index] = refreshed;
        const rebuilt = await generateCroqui(refreshed,{fastPreview:true,page:document.body?.dataset?.page || 'pranchas.html'});
        assertSameProject();
        if (hasPrintableConfrontante(rebuilt,refreshed)) {
          lastSvg = patchSvgLiveElements(rebuilt,currentPranchaLiveElementValues());
          lastSvgProjectId = selectedId;
          writePranchaSvgCache(refreshed,lastSvg);
          svg = currentPranchaExportSvg();
        }
      }
      if (projectNeedsConfrontantesInExport(project) && !hasPrintableConfrontante(svg,project)) {
        throw new Error('Os confrontantes cadastrados não apareceram na prancha. O download foi interrompido para evitar um PDF incompleto. Reabra o projeto e tente novamente.');
      }
      return svg;
    }
    // Uma única preparação oficial alimenta SVG, PDF e Word, nos dois módulos.
    if (['pranchas.html','mapas.html'].includes(String(document.body?.dataset?.page||''))) {
      window.SurveyorPranchaExportSource = () => currentPranchaExportSvg();
      window.SurveyorPranchaExportSourceReady = readyPranchaExportSvg;
    }

    $('downloadSvgV19').addEventListener('click', async () => {
      let exportSvg = '';
      try { exportSvg = await readyPranchaExportSvg(); }
      catch (error) { toast(error.message || 'Não foi possível preparar o SVG completo.', 'error'); return; }
      if (!exportSvg) return setPreviewMessage(document.body?.dataset?.page === 'pranchas.html' ? 'Selecione um projeto para disponibilizar o download.' : 'Gere o croqui primeiro.');
      const p = projects.find((item) => item.id === select.value);
      const filename = `${slug(p?.propertyName || p?.title || p?.name || 'croqui')}-croqui-tecnico.svg`;
      try {
        if (typeof window.SurveyorDocumentDownloads?.saveSvg !== 'function') throw new Error('Serviço de downloads indisponível. Atualize a página e tente novamente.');
        // O mesmo SVG real da edição atual alimenta PDF, Word e SVG.
        // O helper mantém a URL Blob válida e permite novo clique sem regenerar a cena.
        window.SurveyorDocumentDownloads.saveSvg(filename, exportSvg);
      } catch (error) {
        console.error('[Surveyor] Não foi possível salvar o SVG vetorial:',error);
        toast(error?.message || 'Não foi possível iniciar o download SVG.', 'error');
      }
    });

    window.addEventListener('surveyor:projects-ready',(event)=>{
      const incoming=Array.isArray(event.detail?.projects)?event.detail.projects:[];
      if(!incoming.length)return;
      const byId=new Map(projects.map((project)=>[project.id,project]));
      incoming.forEach((project)=>{if(project?.id)byId.set(project.id,{...(byId.get(project.id)||{}),...project});});
      projects=Array.from(byId.values());
      projects.forEach(appendProjectOption);
      syncProjectSelectProxies();
    });
    loadProjects().catch((error) => setPreviewMessage(error.message || 'Não foi possível carregar os projetos da nuvem.'));
  }
})();
