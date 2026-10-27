(() => {
  'use strict';

  const STORAGE_PREFIX = 'surveyor:confrontante-label-layout:v4';
  const SEGMENT_SUFFIX = ':segments-v4';
  const PROJECT_LAYOUT_PREFIX = 'surveyor:confrontante-project-layout:v6';
  const DOCUMENT_SETTINGS_PREFIX = 'surveyor:document-visual-settings:v1';
  const IMPORTED_SIGNATURE_PREFIX = 'surveyor:document-imported-signature:v1';
  const IMPORTED_SIGNATURE_DB = 'surveyor-document-assets-v1';
  const IMPORTED_SIGNATURE_STORE = 'imported-signatures';
  let importedSignatureDbPromise = null;
  const LEGACY_CONTEXT_PREFIXES = Object.freeze([STORAGE_PREFIX, 'surveyor:confrontante-label-layout:v1']);
  // Compatibilidade de regressão: seleção definida no mapa continua sendo a fonte do trecho; o texto explicativo não é mais exibido na interface.

  function safeText(value) { return String(value ?? ''); }
  function escapeHtml(value) { return safeText(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  const CONFRONTANTE_LIMITE_OPTIONS = Object.freeze(['Cerca','Muro','Estrada','Rodovia','Rio','Córrego','Nascente','Linha seca','Divisa natural','Servidão','Propriedade vizinha','Outro']);
  const CONFRONTANTE_ORIENTACAO_OPTIONS = Object.freeze(['Norte','Nordeste','Leste','Sudeste','Sul','Sudoeste','Oeste','Noroeste']);
  function selectOptions(values = [], selected = '') {
    const current = safeText(selected).trim();
    const source = current && !values.includes(current) ? [...values, current] : values;
    return `<option value="">Selecione</option>${source.map((value)=>`<option value="${escapeHtml(value)}"${value===current?' selected':''}>${escapeHtml(value)}</option>`).join('')}`;
  }
  function optionValue(options = {}, key, fallback = '') {
    const raw = options?.[key];
    try {
      return typeof raw === 'function' ? raw() : (raw ?? fallback);
    } catch (error) {
      console.warn(`[Surveyor] Falha ao resolver opção ${key} do editor técnico:`, error);
      return fallback;
    }
  }
  function contextKey(options = {}) {
    const page = safeText(optionValue(options, 'page', document.body?.dataset?.page || 'documento'));
    const projectId = safeText(optionValue(options, 'projectId', 'sem-projeto'));
    const layout = safeText(optionValue(options, 'layoutId', 'padrao'));
    return `${STORAGE_PREFIX}:${page}:${projectId}:${layout}`;
  }
  function segmentKey(options = {}) { return `${contextKey(options)}${SEGMENT_SUFFIX}`; }
  function projectLayoutKey(options = {}) { return `${PROJECT_LAYOUT_PREFIX}:${safeText(optionValue(options, 'projectId', 'sem-projeto'))}`; }
  function documentSettingsKey(options = {}) { return `${DOCUMENT_SETTINGS_PREFIX}:${safeText(optionValue(options, 'projectId', 'sem-projeto'))}`; }
  function importedSignatureKey(options = {}) { return `${IMPORTED_SIGNATURE_PREFIX}:${safeText(optionValue(options, 'projectId', 'sem-projeto'))}`; }
  function clearProjectContextCaches(options = {}) {
    const projectId = safeText(optionValue(options, 'projectId', '')).trim();
    if (!projectId || projectId === 'sem-projeto' || projectId === 'manual') return;
    const projectNeedle = `:${projectId}:`;
    try {
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !projectNeedle || !key.includes(projectNeedle)) continue;
        if (LEGACY_CONTEXT_PREFIXES.some((prefix) => key.startsWith(`${prefix}:`))) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch (_error) {}
  }
  function normalizeVertexLabelOffsets(value = {}) {
    const out = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
    Object.entries(value).forEach(([key, item]) => {
      const label = safeText(key).trim().toUpperCase();
      const dx = Number(item?.dx || 0), dy = Number(item?.dy || 0);
      if (!label || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      out[label] = { dx, dy };
    });
    return out;
  }
  function normalizeHexColor(value, fallback = '#f3c410') {
    const shared = window.SurveyorTechnicalMapBridge?.normalizeHexColor;
    if (typeof shared === 'function') return shared(value, fallback);
    const text = safeText(value).trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
  }
  function contrastHaloColor(value) {
    const color=normalizeHexColor(value,'#111827');
    const hex=color.slice(1);
    const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
    const luminance=((0.299*r)+(0.587*g)+(0.114*b))/255;
    return luminance>=0.62?'#111827':'#ffffff';
  }
  function confrontanteLabelColor(value) { return normalizeHexColor(value, '#111827'); }
  function confrontanteLabelHalo(value) {
    const color = confrontanteLabelColor(value).slice(1);
    const r = parseInt(color.slice(0,2),16), g = parseInt(color.slice(2,4),16), b = parseInt(color.slice(4,6),16);
    const luminance = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    return luminance >= .62 ? '#111827' : '#ffffff';
  }
  function segmentFontColor(segment, baseColor = '#111827') {
    const individual = confrontanteLabelColor(segment?.labelColor);
    // Em layouts antigos, branco podia ser gravado sem ação do usuário.
    // Preservar branco somente quando o seletor individual foi utilizado.
    if (individual === '#ffffff' && segment?.labelColorCustomized !== true) return '#111827';
    const personalized = segment?.labelColorCustomized === true || (segment?.labelColorCustomized !== false && individual !== '#111827');
    return personalized ? individual : confrontanteLabelColor(baseColor);
  }
  function applyConfrontanteLabelColor(group, value) {
    if (!group) return confrontanteLabelColor(value);
    const color = confrontanteLabelColor(value);
    const halo = confrontanteLabelHalo(color);
    group.dataset.labelColor = color;
    group.querySelectorAll('.sv-confrontante-name-text,.sv-confrontante-cpf-text').forEach((text) => {
      text.setAttribute('fill', color);
      text.setAttribute('stroke', halo);
    });
    return color;
  }
  function normalizePolygonStyles(value = {}) {
    const source = value?.polygonStyles && typeof value.polygonStyles === 'object' && !Array.isArray(value.polygonStyles)
      ? value.polygonStyles : {};
    const out = {};
    Object.entries(source).forEach(([key, item]) => {
      const id = safeText(key).trim();
      if (!id || !item || typeof item !== 'object') return;
      const opacity = Number(item.opacity);
      const strokeWidth = Number(item.strokeWidth);
      const legacyColor = normalizeHexColor(item.color, '#f3c410');
      out[id] = {
        color: normalizeHexColor(item.fillColor, legacyColor),
        fillColor: normalizeHexColor(item.fillColor, legacyColor),
        strokeColor: normalizeHexColor(item.strokeColor, legacyColor),
        strokeWidth: Number.isFinite(strokeWidth) ? Math.max(.25, Math.min(4, strokeWidth)) : 1,
        fill: item.fill !== false,
        opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : .22
      };
    });
    return out;
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
    const source=value?.elementVisuals && typeof value.elementVisuals==='object' && !Array.isArray(value.elementVisuals) ? value.elementVisuals : {};
    const out={};
    Object.entries(ELEMENT_VISUAL_DEFAULTS).forEach(([key,defaults])=>{
      const item=source?.[key] && typeof source[key]==='object' ? source[key] : {};
      const fallbackScale=key==='cotas' ? Number(value?.dimensionScale ?? defaults.scale) : key==='vertices' ? Number(value?.vertexScale ?? defaults.scale) : defaults.scale;
      const rawScale=Number(item.scale ?? fallbackScale);
      const fallbackColor=key==='cotas' ? value?.dimensionColor : defaults.color;
      out[key]={
        scale:Number.isFinite(rawScale)?Math.max(.25,Math.min(3,rawScale)):defaults.scale,
        color:normalizeHexColor(item.color || fallbackColor,defaults.color)
      };
    });
    return out;
  }

  function normalizeDocumentSettings(value = {}) {
    const bridge = window.SurveyorTechnicalMapBridge;
    const areaNames=bridge?.normalizeAreaNames?.(value) || [], primary=areaNames[0] || null;
    const manualServitudes = bridge?.normalizeManualServitudes?.(value)
      || (Array.isArray(value?.manualServitudes) ? value.manualServitudes.map((item)=>({ ...item })) : []);
    const technicalLines = bridge?.normalizeTechnicalLines?.(value)
      || (Array.isArray(value?.technicalLines) ? value.technicalLines.map((item)=>({ ...item })) : []);
    const dimensionVisual = bridge?.normalizeDimensionVisualSettings?.(value)
      || { dimensionScale:1, dimensionColor:'#111827', dimensionLabelOffsets:{}, dimensionLabelScales:{} };
    const tableRows=Math.round(Number(value?.coordinateTableRows||8)||8), tableX=Number(value?.coordinateTableX), tableY=Number(value?.coordinateTableY), signatureX=Number(value?.signatureX), signatureY=Number(value?.signatureY), importedSignatureX=Number(value?.importedSignatureX), importedSignatureY=Number(value?.importedSignatureY);
    const importedSignatureEnabled=value?.importedSignatureEnabled===true;
    return {
      vertexScale:Math.max(.55,Math.min(2.5,Number(value?.vertexScale||1)||1)),
      elementVisuals:normalizeElementVisuals(value),
      elementVisibility:normalizeElementVisibility(value),
      ...dimensionVisual,
      polygonFill:value?.polygonFill!==false,
      polygonStyles:normalizePolygonStyles(value),
      vertexLabelOffsets:normalizeVertexLabelOffsets(value?.vertexLabelOffsets||{}),
      vertexLabelScales:{},
      areaNames, manualServitudes, technicalLines,
      areaName:primary?.text||'', areaNameX:primary?.x??null, areaNameY:primary?.y??null, areaNameScale:primary?.scale??1, areaNameRotation:primary?.rotation??0,
      signatureEnabled:value?.signatureEnabled===true,
      signatureScale:Math.max(.55,Math.min(8,Number(value?.signatureScale||1)||1)),
      signatureX:Number.isFinite(signatureX)?Math.max(0,Math.min(1,signatureX)):null,
      signatureY:Number.isFinite(signatureY)?Math.max(0,Math.min(1,signatureY)):null,
      importedSignatureEnabled,
      importedSignatureScale:Math.max(.55,Math.min(8,Number(value?.importedSignatureScale||1)||1)),
      importedSignatureX:Number.isFinite(importedSignatureX)?Math.max(0,Math.min(1,importedSignatureX)):null,
      importedSignatureY:Number.isFinite(importedSignatureY)?Math.max(0,Math.min(1,importedSignatureY)):null,
      coordinateTableEnabled:value?.coordinateTableEnabled===true,
      coordinateTableRows:Math.max(1,Math.min(999,tableRows||8)),
      coordinateTableScale:Math.max(.7,Math.min(1.8,Number(value?.coordinateTableScale||1)||1)),
      coordinateTableX:Number.isFinite(tableX)?Math.max(0,Math.min(1,tableX)):null,
      coordinateTableY:Number.isFinite(tableY)?Math.max(0,Math.min(1,tableY)):null,
      miniMapKind:['sat','road','terrain','relief'].includes(safeText(value?.miniMapKind).trim())?safeText(value?.miniMapKind).trim():'road',
      miniMapOpacity:Math.max(.2,Math.min(1,Number(value?.miniMapOpacity ?? .88)||.88)),
      miniMapPerimeterVisible:value?.miniMapPerimeterVisible!==false,
      areaNameColor:normalizeHexColor(value?.areaNameColor, '#111827'),
      technicalLineColor:normalizeHexColor(value?.technicalLineColor, '#111827'),
      dimensionColor:normalizeHexColor(value?.dimensionColor, '#111827'),
      regulatoryPreset:['cartorio_incra','seia_cefir','comercial','reurb'].includes(safeText(value?.regulatoryPreset).trim())?safeText(value?.regulatoryPreset).trim():'custom'
    };
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : fallback;
      return parsed ?? fallback;
    } catch (_error) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) {}
  }
  function normalizeImportedSignatureAsset(value) {
    if(!value || typeof value!=='object' || !safeText(value.dataUrl).startsWith('data:image/')) return null;
    return { name:safeText(value.name||'Assinatura importada'), dataUrl:safeText(value.dataUrl), width:Math.max(1,Number(value.width)||1), height:Math.max(1,Number(value.height)||1), updatedAt:safeText(value.updatedAt||'') };
  }
  function openImportedSignatureDb() {
    if(importedSignatureDbPromise) return importedSignatureDbPromise;
    if(!globalThis.indexedDB) return Promise.resolve(null);
    importedSignatureDbPromise=new Promise((resolve)=>{
      let request;
      try{request=indexedDB.open(IMPORTED_SIGNATURE_DB,1);}catch(_error){resolve(null);return;}
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(IMPORTED_SIGNATURE_STORE))db.createObjectStore(IMPORTED_SIGNATURE_STORE);};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>resolve(null);
      request.onblocked=()=>resolve(null);
    });
    return importedSignatureDbPromise;
  }
  async function readImportedSignatureAsset(options = {}) {
    const key=importedSignatureKey(options);
    const db=await openImportedSignatureDb();
    if(db){
      try{
        const value=await new Promise((resolve,reject)=>{const tx=db.transaction(IMPORTED_SIGNATURE_STORE,'readonly');const request=tx.objectStore(IMPORTED_SIGNATURE_STORE).get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});
        const normalized=normalizeImportedSignatureAsset(value);
        if(normalized)return normalized;
      }catch(error){console.warn('[Surveyor] IndexedDB indisponível para leitura da assinatura importada:',error);}
    }
    const legacy=normalizeImportedSignatureAsset(readJson(key,null));
    if(legacy){
      const migrated=await writeImportedSignatureAsset(options,legacy);
      if(migrated){try{localStorage.removeItem(key);}catch(_error){}}
    }
    return legacy;
  }
  async function writeImportedSignatureAsset(options = {}, value = null) {
    const key=importedSignatureKey(options);
    const normalized=value?normalizeImportedSignatureAsset(value):null;
    const db=await openImportedSignatureDb();
    if(db){
      try{
        await new Promise((resolve,reject)=>{const tx=db.transaction(IMPORTED_SIGNATURE_STORE,'readwrite');const store=tx.objectStore(IMPORTED_SIGNATURE_STORE);if(normalized)store.put(normalized,key);else store.delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
        try{localStorage.removeItem(key);}catch(_error){}
        return true;
      }catch(error){console.warn('[Surveyor] IndexedDB indisponível para persistir a assinatura importada:',error);}
    }
    try{
      if(!normalized)localStorage.removeItem(key);
      else localStorage.setItem(key,JSON.stringify(normalized));
      return true;
    }catch(error){
      console.warn('[Surveyor] A assinatura importada ficará disponível somente nesta sessão:',error);
      return false;
    }
  }
  function readDocumentSettings(options = {}) { return normalizeDocumentSettings(readJson(documentSettingsKey(options), {})); }
  function writeDocumentSettings(options = {}, value = {}) { writeJson(documentSettingsKey(options), normalizeDocumentSettings(value)); }
  function clearDocumentSettings(options = {}) { try { localStorage.removeItem(documentSettingsKey(options)); } catch (_error) {} }
  function readOffsets(options = {}) {
    const parsed = readJson(contextKey(options), {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }
  function writeOffsets(options = {}, offsets = {}) { writeJson(contextKey(options), offsets || {}); }
  function clearOffsets(options = {}) { try { localStorage.removeItem(contextKey(options)); } catch (_error) {} }
  function readSegments(options = {}) {
    const parsed = readJson(segmentKey(options), []);
    return Array.isArray(parsed) ? parsed : [];
  }
  function writeSegments(options = {}, segments = []) { writeJson(segmentKey(options), Array.isArray(segments) ? segments : []); }
  function clearSegments(options = {}) { try { localStorage.removeItem(segmentKey(options)); } catch (_error) {} }
  function readProjectLayout(options = {}) {
    const parsed = readJson(projectLayoutKey(options), { version: 9, segments: [], documentSettings: null, updatedAt: '' });
    return parsed && typeof parsed === 'object' && Array.isArray(parsed.segments)
      ? { ...parsed, syncStatus:parsed.syncStatus === 'pending' ? 'pending' : 'confirmed', documentSettings: parsed.documentSettings ? normalizeDocumentSettings(parsed.documentSettings) : null }
      : { version: 9, segments: [], documentSettings: null, updatedAt: '', syncStatus:'confirmed' };
  }
  function readProjectSegments(options = {}) { return readProjectLayout(options).segments || []; }
  function readProjectDocumentSettings(options = {}) { return readProjectLayout(options).documentSettings || null; }
  function writeProjectLayout(options = {}, layout = {}) {
    writeJson(projectLayoutKey(options), {
      version: 9,
      updatedAt: safeText(layout.updatedAt || new Date().toISOString()),
      syncStatus: layout.syncStatus === 'confirmed' ? 'confirmed' : 'pending',
      segments: Array.isArray(layout.segments) ? layout.segments : [],
      documentSettings: layout.documentSettings ? normalizeDocumentSettings(layout.documentSettings) : null
    });
  }
  function clearProjectLayoutCache(options = {}) { try { localStorage.removeItem(projectLayoutKey(options)); } catch (_error) {} clearProjectContextCaches(options); }
  function projectIdFor(options = {}) { return safeText(optionValue(options, 'projectId', '')).trim(); }
  function projectPerimeterFeature(project) {
    const features = Array.isArray(project?.geojson?.features) ? project.geojson.features : [];
    return features.find((feature) => feature?.geometry?.type === 'Polygon' && feature?.properties?.category === 'perimetro')
      || features.find((feature) => feature?.geometry?.type === 'Polygon')
      || null;
  }

  function fallbackSegmentsFromFeature(feature) {
    const visual = Array.isArray(feature?.properties?.confrontanteVisualLayout?.segments) ? feature.properties.confrontanteVisualLayout.segments : [];
    const semantic = Array.isArray(feature?.properties?.confrontanteTrechos) ? feature.properties.confrontanteTrechos : [];
    if (visual.length) {
      const semanticById = new Map(semantic.map((item) => [safeText(item?.id), item]));
      return visual.map((item) => {
        const registered = semanticById.get(safeText(item?.id)) || {};
        return {
          ...registered, ...item,
          nome:safeText(item?.nome || registered?.nome || 'Confrontante').trim() || 'Confrontante',
          propriedade:safeText(item?.propriedade || registered?.propriedade || ''),
          cpfCnpj:safeText(item?.cpfCnpj || registered?.cpfCnpj || ''),
          showPropertyInLabel:typeof item?.showPropertyInLabel==='boolean'?item.showPropertyInLabel:(typeof registered?.showPropertyInLabel==='boolean'?registered.showPropertyInLabel:Boolean(safeText(item?.propriedade || registered?.propriedade || '').trim())),
          showCpfCnpjInLabel:typeof item?.showCpfCnpjInLabel==='boolean'?item.showCpfCnpjInLabel:(typeof registered?.showCpfCnpjInLabel==='boolean'?registered.showCpfCnpjInLabel:false),
          tipoLimite:safeText(item?.tipoLimite || registered?.tipoLimite || ''),
          orientacao:safeText(item?.orientacao || registered?.orientacao || ''),
          observacao:safeText(item?.observacao || registered?.observacao || ''),
          extraLines:Array.isArray(item.extraLines) ? item.extraLines.map((line)=>({...line})) : []
        };
      });
    }
    return semantic.map((item,index) => ({
      ...item,
      id:safeText(item?.id || `trecho-${index+1}`),
      nome:safeText(item?.nome || 'Confrontante').trim() || 'Confrontante',
      propriedade:safeText(item?.propriedade || ''),
      cpfCnpj:safeText(item?.cpfCnpj || ''),
      showPropertyInLabel:typeof item?.showPropertyInLabel==='boolean'?item.showPropertyInLabel:Boolean(safeText(item?.propriedade || '').trim()),
      showCpfCnpjInLabel:item?.showCpfCnpjInLabel===true,
      startVertex:Math.max(1,Number(item?.startVertex)||1),
      endVertex:Math.max(1,Number(item?.endVertex)||2),
      vertices:Array.isArray(item?.vertices)?item.vertices.map(Number).filter(Number.isFinite):[],
      segmentIndexes:Array.isArray(item?.segmentIndexes)?item.segmentIndexes.map(Number).filter(Number.isFinite):[],
      labelDx:Number(item?.labelDx||0)||0,labelDy:Number(item?.labelDy||0)||0,
      labelScale:Math.max(.20,Math.min(4,Number(item?.labelScale||1)||1)),
      labelRotation:Number(item?.labelRotation||0)||0,
      extraLines:Array.isArray(item?.extraLines)?item.extraLines.map((line)=>({...line})):[]
    }));
  }
  function semanticTrechosFromLayout(feature, segments = []) {
    const existing = Array.isArray(feature?.properties?.confrontanteTrechos) ? feature.properties.confrontanteTrechos : [];
    const byId = new Map(existing.map((item) => [String(item?.id || ''), item]));
    return (Array.isArray(segments) ? segments : []).filter((item) => item && item.hidden !== true && item.id !== '__linhas-gerais__').map((item, index) => {
      const previous = byId.get(String(item.id || '')) || {};
      return {
        ...previous,
        id: String(item.id || `trecho-${index + 1}`),
        nome: safeText(item.nome || previous.nome || 'Confrontante').trim() || 'Confrontante',
        propriedade: safeText(item.propriedade ?? previous.propriedade ?? ''),
        cpfCnpj: safeText(item.cpfCnpj ?? previous.cpfCnpj ?? ''),
        showPropertyInLabel: typeof item.showPropertyInLabel === 'boolean' ? item.showPropertyInLabel : (typeof previous.showPropertyInLabel === 'boolean' ? previous.showPropertyInLabel : Boolean(safeText(item.propriedade ?? previous.propriedade ?? '').trim())),
        showCpfCnpjInLabel: typeof item.showCpfCnpjInLabel === 'boolean' ? item.showCpfCnpjInLabel : (previous.showCpfCnpjInLabel === true),
        tipoLimite: safeText(item.tipoLimite ?? previous.tipoLimite ?? ''),
        orientacao: safeText(item.orientacao ?? previous.orientacao ?? ''),
        observacao: safeText(item.observacao ?? previous.observacao ?? ''),
        startVertex: Math.max(1, Number(item.startVertex) || 1),
        endVertex: Math.max(1, Number(item.endVertex) || 2),
        vertices: Array.isArray(item.vertices) ? item.vertices.map(Number).filter(Number.isFinite) : (Array.isArray(previous.vertices) ? previous.vertices.map(Number).filter(Number.isFinite) : []),
        segmentIndexes: Array.isArray(item.segmentIndexes) ? item.segmentIndexes.map(Number).filter(Number.isFinite) : (Array.isArray(previous.segmentIndexes) ? previous.segmentIndexes.map(Number).filter(Number.isFinite) : [])
      };
    });
  }
  function perimeterVertexCount(feature) {
    const geometry = feature?.geometry;
    const ring = geometry?.type === 'Polygon' ? geometry.coordinates?.[0]
      : geometry?.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0] : null;
    if (!Array.isArray(ring)) return 0;
    const closed = ring.length > 1 && Number(ring[0]?.[0]) === Number(ring.at(-1)?.[0]) && Number(ring[0]?.[1]) === Number(ring.at(-1)?.[1]);
    return Math.max(0, ring.length - (closed ? 1 : 0));
  }
  function rangeSegmentIndexes(startVertex, endVertex, count) {
    const total = Math.max(0, Number(count) || 0);
    if (total < 2) return [];
    let start = Math.max(1, Math.min(total, Math.round(Number(startVertex) || 1)));
    let end = Math.max(1, Math.min(total, Math.round(Number(endVertex) || ((start % total) + 1))));
    if (start === end) end = (start % total) + 1;
    const forwardSteps = (end - start + total) % total;
    const backwardSteps = (start - end + total) % total;
    const useForward = forwardSteps <= backwardSteps;
    const indexes = [];
    let vertex = start;
    const steps = useForward ? forwardSteps : backwardSteps;
    for (let i = 0; i < steps; i += 1) {
      if (useForward) {
        indexes.push((vertex - 1 + total) % total);
        vertex = (vertex % total) + 1;
      } else {
        const previousVertex = ((vertex - 2 + total) % total) + 1;
        indexes.push(previousVertex - 1);
        vertex = previousVertex;
      }
    }
    return indexes;
  }
  function layoutItemSegmentIndexes(item, count) {
    const total = Math.max(0, Number(count) || 0);
    if (total < 1 || !item) return [];
    const explicit = Array.isArray(item.segmentIndexes)
      ? item.segmentIndexes.map(Number).filter((value, index, list) => Number.isInteger(value) && value >= 0 && value < total && list.indexOf(value) === index)
      : [];
    if (explicit.length) return explicit;
    const vertices = Array.isArray(item.vertices)
      ? item.vertices.map(Number).filter((value, index, list) => Number.isInteger(value) && value >= 1 && value <= total && list.indexOf(value) === index)
      : [];
    if (vertices.length === 1) return [vertices[0] - 1];
    if (vertices.length > 1) {
      const out = [];
      for (let i = 0; i < vertices.length - 1; i += 1) {
        const a = vertices[i], b = vertices[i + 1];
        if (b === (a % total) + 1) { if (!out.includes(a - 1)) out.push(a - 1); }
        else if (a === (b % total) + 1) { if (!out.includes(b - 1)) out.push(b - 1); }
        else rangeSegmentIndexes(a, b, total).forEach((idx) => { if (!out.includes(idx)) out.push(idx); });
      }
      if (out.length) return out;
    }
    return rangeSegmentIndexes(item.startVertex, item.endVertex, total);
  }

  function syncSegmentConfrontantes(feature, segments = []) {
    feature.properties ||= {};
    const count = perimeterVertexCount(feature);
    if (count < 2) return;
    const previous = Array.isArray(feature.properties.confrontantes) ? feature.properties.confrontantes : [];
    // Ocultar cotas, fotos ou outros elementos não é uma edição cadastral de
    // confrontantes. Um editor sem rótulos materializados nunca pode zerar a
    // lista por lado de um projeto já cadastrado.
    const validSegments = (Array.isArray(segments) ? segments : []).filter((item) =>
      item && item.hidden !== true && item.id !== '__linhas-gerais__' &&
      (String(item.nome || '').trim() || String(item.tipoLimite || '').trim()));
    if (!validSegments.length) return;
    const list = Array.from({ length: count }, (_, index) => {
      const old = previous.find((entry) => Number(entry?.segmentIndex) === index) || previous[index] || {};
      const clean = { ...old };
      ['nome','name','confrontante','propriedade','propertyName','imovel','cpfCnpj','cpf_cnpj','cpf','cnpj','documento','showPropertyInLabel','showCpfCnpjInLabel','tipoLimite','limite','orientacao','observacao','observacoes'].forEach((key) => delete clean[key]);
      return {
        ...clean,
        segmentIndex:index,
        from:`V-${String(index + 1).padStart(2,'0')}`,
        to:`V-${String(((index + 1) % count) + 1).padStart(2,'0')}`
      };
    });
    validSegments.forEach((item) => {
      const values = {
        nome:safeText(item.nome || '').trim(),
        propriedade:safeText(item.propriedade || '').trim(),
        cpfCnpj:safeText(item.cpfCnpj || ''),
        showPropertyInLabel:typeof item.showPropertyInLabel==='boolean'?item.showPropertyInLabel:Boolean(safeText(item.propriedade||'').trim()),
        showCpfCnpjInLabel:item.showCpfCnpjInLabel===true,
        tipoLimite:safeText(item.tipoLimite || ''),
        orientacao:safeText(item.orientacao || ''),
        observacao:safeText(item.observacao || '')
      };
      layoutItemSegmentIndexes(item, count).forEach((index) => Object.assign(list[index], values));
    });
    feature.properties.confrontantes = list;
  }
  async function saveProjectVisualLayout(options = {}, layout = {}) {
    const projectId = projectIdFor(options);
    if (!projectId || !window.GeoRuralProjects?.get || !window.GeoRuralProjects?.saveLegacy) {
      throw new Error('Salvamento na nuvem indisponível. As alterações continuam pendentes neste navegador.');
    }
    const project = await window.GeoRuralProjects.get(projectId, true);
    if (!project) throw new Error('Projeto não encontrado para salvar o layout dos confrontantes.');
    const feature = projectPerimeterFeature(project);
    if (!feature) throw new Error('Perímetro do projeto não encontrado para salvar os confrontantes.');
    feature.properties ||= {};
    const updatedAt = safeText(layout.updatedAt || new Date().toISOString());
    const incomingSegments = Array.isArray(layout.segments) ? layout.segments : [];
    const existingLayout = feature.properties.confrontanteVisualLayout || {};
    const hasRegisteredConfrontantes = [
      ...(Array.isArray(feature.properties.confrontantes) ? feature.properties.confrontantes : []),
      ...(Array.isArray(feature.properties.confrontanteTrechos) ? feature.properties.confrontanteTrechos : []),
      ...(Array.isArray(existingLayout.segments) ? existingLayout.segments : [])
    ].some((item) => String(item?.nome || item?.name || item?.confrontante || '').trim());
    // A montagem parcial do editor não autoriza sobrescrever o cadastro com
    // segmentos vazios após apenas desligar cotas ou remover imagens.
    const preserveRegistered = hasRegisteredConfrontantes && !incomingSegments.some((item) =>
      String(item?.nome || item?.name || '').trim() && item?.hidden !== true);
    const segmentsToSave = preserveRegistered
      ? (Array.isArray(existingLayout.segments) ? existingLayout.segments : [])
      : incomingSegments;
    if (!preserveRegistered) {
      feature.properties.confrontanteVisualLayout = {
        version: 8, updatedAt, segments: segmentsToSave
      };
    }
    feature.properties.documentVisualSettings = normalizeDocumentSettings(layout.documentSettings || feature.properties.documentVisualSettings || {});
    // Chamadas visuais antigas desenhadas no mapa não fazem mais parte do modelo.
    delete feature.properties.confrontanteChamadas;
    if (!preserveRegistered) {
      feature.properties.confrontanteTrechos = semanticTrechosFromLayout(feature, segmentsToSave);
      // Os dados cadastrais só podem ser regravados quando o editor recebeu
      // segmentos reais. Aparência e visibilidade não removem confrontantes.
      syncSegmentConfrontantes(feature, segmentsToSave);
    }
    const saved = await window.GeoRuralProjects.saveLegacy(project);
    if (!saved?.id || saved.id !== projectId) {
      throw new Error('A nuvem não confirmou a persistência do projeto. Tente salvar novamente.');
    }
    return saved;
  }
  async function clearProjectVisualLayout(options = {}) {
    clearProjectLayoutCache(options);
    const projectId = projectIdFor(options);
    if (!projectId || !window.GeoRuralProjects?.get || !window.GeoRuralProjects?.saveLegacy) return null;
    const project = await window.GeoRuralProjects.get(projectId, true);
    if (!project) return null;
    const feature = projectPerimeterFeature(project);
    if (!feature?.properties) return project;
    delete feature.properties.confrontanteVisualLayout;
    delete feature.properties.documentVisualSettings;
    delete feature.properties.confrontanteChamadas;
    if (Array.isArray(feature.properties.confrontanteTrechos)) {
      feature.properties.confrontanteTrechos = feature.properties.confrontanteTrechos.map((item) => {
        const clean = { ...item };
        ['startGuideLat','startGuideLng','endGuideLat','endGuideLng','startGuideDx','startGuideDy','endGuideDx','endGuideDy','guideMode','freeLine1X1','freeLine1Y1','freeLine1X2','freeLine1Y2','freeLine2X1','freeLine2Y1','freeLine2X2','freeLine2Y2','labelDx','labelDy','labelDxN','labelDyN','labelScale','labelRotation','extraLines'].forEach((key) => delete clean[key]);
        return clean;
      });
    }
    return window.GeoRuralProjects.saveLegacy(project);
  }

  function svgPoint(svg, event) {
    const ctm = svg?.getScreenCTM?.();
    if (!ctm) return null;
    try {
      const point = svg.createSVGPoint();
      point.x = event.clientX; point.y = event.clientY;
      return point.matrixTransform(ctm.inverse());
    } catch (_error) { return null; }
  }
  function svgViewBoxSize(svg) {
    const parts = safeText(svg?.getAttribute('viewBox')).trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) return { width: parts[2], height: parts[3] };
    return { width: Number(svg?.getAttribute('width')) || 1600, height: Number(svg?.getAttribute('height')) || 1000 };
  }
  const EDITABLE_OVERLAY_SELECTOR = '.sv-document-map-metadata,.sv-document-editable-polygon,.sv-document-polygon-outline,.sv-document-polygon-halo,.sv-document-perimeter-fill,.sv-vertex-anchor,.sv-vertex-label,.sv-cad-dimension-group,.sv-coordinate-table-overlay,.sv-confrontante-metadata,.sv-confrontante-editor-anchors,.sv-confrontante-callout,.sv-area-name-label,.sv-document-manual-servitude,.sv-document-technical-line,.sv-live-element-layer,[data-document-signature],[data-document-imported-signature],[data-live-field-row],[data-live-field],[data-live-asset-layer],[data-live-asset]';
  function editableOverlayRoots(source) {
    const candidates = Array.from(source?.querySelectorAll?.(EDITABLE_OVERLAY_SELECTOR) || []);
    const candidateSet = new Set(candidates);
    return candidates.filter((node) => {
      let parent = node.parentElement;
      while (parent && parent !== source) {
        if (candidateSet.has(parent)) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }
  function svgFontWeightFromNode(node) {
    let current = node;
    while (current && current.nodeType === 1) {
      const inline = safeText(current.style?.fontWeight).trim();
      const attribute = safeText(current.getAttribute?.('font-weight')).trim();
      const value = inline || attribute;
      if (value && value !== 'inherit' && value !== 'unset' && value !== 'initial') return value;
      current = current.parentElement;
    }
    return '400';
  }
  function freezeSvgTypography(svg) {
    if (!svg) return svg;
    svg.setAttribute('font-weight', svgFontWeightFromNode(svg));
    svg.style.fontSynthesis = 'none';
    svg.querySelectorAll('text').forEach((node) => {
      const weight = svgFontWeightFromNode(node);
      node.setAttribute('font-weight', weight || '400');
      node.style.fontSynthesis = 'none';
    });
    svg.querySelectorAll('tspan').forEach((node) => {
      const weight = svgFontWeightFromNode(node);
      node.setAttribute('font-weight', weight || '400');
      node.style.fontSynthesis = 'none';
    });
    return svg;
  }

  function parseSvg(sourceText) {
    const holder = document.createElement('div');
    holder.innerHTML = safeText(sourceText).trim();
    const source = holder.querySelector('svg');
    if (!source) throw new Error('Prancha SVG indisponível para edição.');
    freezeSvgTypography(source);
    const viewBox = source.getAttribute('viewBox') || `0 0 ${source.getAttribute('width') || 1600} ${source.getAttribute('height') || 1000}`;
    const editableRoots = editableOverlayRoots(source);
    const background = source.cloneNode(true);
    editableOverlayRoots(background).forEach((node) => node.remove());
    background.querySelectorAll('script').forEach((node) => node.remove());
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    overlay.setAttribute('viewBox', viewBox);
    overlay.setAttribute('class', 'sv-confrontante-editor-overlay');
    overlay.setAttribute('font-family', source.getAttribute('font-family') || 'Arial, Helvetica, sans-serif');
    // O SVG editável não deve herdar peso tipográfico da interface HTML.
    // Textos com peso próprio (ex.: rótulos técnicos) continuam preservando seus atributos.
    overlay.setAttribute('font-weight', '400');
    overlay.style.fontSynthesis = 'none';
    editableRoots.forEach((group) => overlay.appendChild(group.cloneNode(true)));
    overlay.querySelectorAll('.sv-vertex-label').forEach((node) => { const size=Number(node.getAttribute('font-size')); if(Number.isFinite(size) && size>0) node.dataset.baseFontSize=String(size); });
    return { background, overlay };
  }
  async function vectorBackground(svg) {
    const clean = svg.cloneNode(true);
    clean.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clean.removeAttribute('width');
    clean.removeAttribute('height');
    freezeSvgTypography(clean);
    clean.querySelectorAll('script').forEach((node) => node.remove());
    const dims = svgViewBoxSize(clean);
    const serialized = new XMLSerializer().serializeToString(clean);
    // Não converter o SVG/satélite inteiro em data:URL: FileReader e base64
    // duplicam várias vezes o maior recurso visual no heap, travando a abertura.
    // Uma blob:URL local mantém os pixels e atributos SVG sem cópias base64.
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const dataUrl = URL.createObjectURL(blob);
    return { dataUrl, objectUrl: dataUrl, width: dims.width, height: dims.height };
  }


  function nativeDocumentFromOptions(options = {}) {
    const value = optionValue(options, 'getNativeDocument', null);
    const api = window.SurveyorNativeTechnicalDocument;
    return api?.valid?.(value) ? value : null;
  }

  function mountNativeDocumentSvg(sourceText, documentModel = null) {
    const holder = document.createElement('div');
    holder.innerHTML = safeText(sourceText).trim();
    const source = holder.querySelector('svg');
    if (!source) throw new Error('Prancha vetorial nativa indisponível para edição.');
    source.querySelectorAll('script').forEach((node) => node.remove());
    source.classList.add('sv-confrontante-editor-overlay','sv-native-document-canvas');
    source.setAttribute('data-native-document-canvas','1');
    source.querySelectorAll('[data-live-field]').forEach((node) => node.setAttribute('data-native-object-id',`field:${safeText(node.dataset.liveField)}`));
    source.querySelectorAll('[data-live-field-row]').forEach((node) => node.setAttribute('data-native-object-id',`field:${safeText(node.dataset.liveFieldRow)}`));
    source.querySelectorAll('[data-live-element]').forEach((node) => node.setAttribute('data-native-object-id',`layer:${safeText(node.dataset.liveElement)}`));
    source.querySelectorAll('.sv-area-name-label[data-area-name-id]').forEach((node) => node.setAttribute('data-native-object-id',`area-name:${safeText(node.dataset.areaNameId)}`));
    source.querySelectorAll('.sv-vertex-label').forEach((node) => { const key=safeText(node.dataset.vertexKey||node.dataset.label||node.textContent).trim().toUpperCase(); if(key)node.setAttribute('data-native-object-id',`vertex-label:${key}`); });
    source.querySelectorAll('.sv-confrontante-callout').forEach((node,index) => { const id=safeText(node.dataset.segmentId||node.dataset.labelKey||`segment-${index+1}`); node.setAttribute('data-native-object-id',`confrontante:${id}`); });
    source.querySelectorAll('[data-document-signature]').forEach((node) => node.setAttribute('data-native-object-id','signature'));
    source.querySelectorAll('.sv-coordinate-table-overlay').forEach((node) => node.setAttribute('data-native-object-id','coordinate-table'));
    const typography = window.SurveyorTechnicalSvgTypography;
    const before = typography?.audit?.(source) || null;
    if (typeof typography?.normalize === 'function') typography.normalize(source);
    else freezeSvgTypography(source);
    const renderModel = window.SurveyorNativeTechnicalDocument?.captureRenderModel?.(documentModel, source) || null;
    const after = typography?.audit?.(source) || null;
    source.style.fontSynthesis = 'none';
    source.style.fontSynthesisWeight = 'none';
    const dims = svgViewBoxSize(source);
    return { overlay: source, width: dims.width, height: dims.height, typographyAudit:{ before, after }, renderModel };
  }

  async function rasterize(svg) {
    const clean = svg.cloneNode(true);
    clean.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clean.removeAttribute('style');
    clean.style.background = '#fff';
    clean.querySelectorAll('script').forEach((node) => node.remove());
    const dims = svgViewBoxSize(clean);
    const scale = 2;
    const serialized = new XMLSerializer().serializeToString(clean);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image(); img.decoding = 'async';
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Não foi possível preparar a prévia para edição.')); img.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(dims.width * scale)); canvas.height = Math.max(1, Math.round(dims.height * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL('image/png', 1), width: dims.width, height: dims.height };
    } finally { URL.revokeObjectURL(url); }
  }

  function clampOffset(group, dx, dy) {
    const rawDx = Number(dx) || 0, rawDy = Number(dy) || 0;
    const values = ['baseX1','baseY1','baseX2','baseY2','mapX','mapY','mapW','mapH'].map((name) => Number(group?.dataset?.[name]));
    if (!values.every(Number.isFinite) || values[6] <= 0 || values[7] <= 0 || values[2] < values[0] || values[3] < values[1]) {
      return { dx: rawDx, dy: rawDy };
    }
    const [x1,y1,x2,y2,mx,my,mw,mh] = values;
    const pad = 8;
    return {
      dx: Math.max(mx + pad - x1, Math.min(mx + mw - pad - x2, rawDx)),
      dy: Math.max(my + pad - y1, Math.min(my + mh - pad - y2, rawDy))
    };
  }
  function applyOffsetDirect(group, dx, dy) { if(!group)return{dx:0,dy:0};const next={dx:Number(dx)||0,dy:Number(dy)||0},label=group.querySelector('.sv-confrontante-label'),scale=Math.max(.20,Math.min(4,Number(group.dataset.labelScale||1)||1)),x1=Number(group.dataset.baseX1||0),y1=Number(group.dataset.baseY1||0),x2=Number(group.dataset.baseX2||x1),y2=Number(group.dataset.baseY2||y1),cx=(x1+x2)/2,cy=(y1+y2)/2;if(label){label.style.opacity='1';label.style.visibility='visible';label.removeAttribute('display');label.setAttribute('transform',`translate(${next.dx.toFixed(2)} ${next.dy.toFixed(2)}) translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${scale.toFixed(3)}) translate(${-cx.toFixed(2)} ${-cy.toFixed(2)})`);}group.style.opacity='1';group.style.visibility='visible';group.removeAttribute('display');group.dataset.dx=next.dx.toFixed(2);group.dataset.dy=next.dy.toFixed(2);return next; }
  function applyOffset(group, dx, dy) {
    if (!group) return { dx: 0, dy: 0 };
    const next = clampOffset(group, dx, dy);
    const label = group.querySelector('.sv-confrontante-label');
    const scale = Math.max(.20, Math.min(4, Number(group.dataset.labelScale || 1) || 1));
    const x1 = Number(group.dataset.baseX1 || 0), y1 = Number(group.dataset.baseY1 || 0), x2 = Number(group.dataset.baseX2 || x1), y2 = Number(group.dataset.baseY2 || y1);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    if (label) {
      label.style.opacity = '1';
      label.style.visibility = 'visible';
      label.setAttribute('transform', `translate(${next.dx.toFixed(2)} ${next.dy.toFixed(2)}) translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${scale.toFixed(3)}) translate(${-cx.toFixed(2)} ${-cy.toFixed(2)})`);
    }
    group.style.opacity = '1';
    group.style.visibility = 'visible';
    group.dataset.dx = next.dx.toFixed(2); group.dataset.dy = next.dy.toFixed(2); group.dataset.labelScale = scale.toFixed(3);
    return next;
  }
  function applyScale(group, scale) {
    if (!group) return 1;
    const next = Math.max(.20, Math.min(4, Number(scale) || 1));
    group.dataset.labelScale = next.toFixed(3);
    applyOffset(group, Number(group.dataset.dx || 0), Number(group.dataset.dy || 0));
    return next;
  }
  function applyRotation(group, rotation) {
    if (!group) return 0;
    let next = Number(rotation) || 0;
    while (next > 180) next -= 360;
    while (next < -180) next += 360;
    const x1 = Number(group.dataset.baseX1 || 0), y1 = Number(group.dataset.baseY1 || 0);
    const x2 = Number(group.dataset.baseX2 || x1), y2 = Number(group.dataset.baseY2 || y1);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const rotator = group.querySelector('.sv-confrontante-label-rotator');
    if (rotator) rotator.setAttribute('transform', `rotate(${next.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`);
    group.dataset.labelRotation = next.toFixed(2);
    return next;
  }
  function vertexLabelKey(node) { return safeText(node?.dataset?.vertex || node?.textContent || '').trim().toUpperCase(); }
  function vertexLabelBase(node) {
    const x = Number(node?.dataset?.baseX || node?.getAttribute?.('data-base-x'));
    const y = Number(node?.dataset?.baseY || node?.getAttribute?.('data-base-y'));
    const currentX = Number(node?.getAttribute?.('x') || 0), currentY = Number(node?.getAttribute?.('y') || 0);
    const dx = Number(node?.dataset?.offsetDx || 0), dy = Number(node?.dataset?.offsetDy || 0);
    return { x:Number.isFinite(x)?x:(currentX-dx), y:Number.isFinite(y)?y:(currentY-dy) };
  }
  function applyVertexOffset(node, dx = 0, dy = 0) {
    if (!node) return;
    const base = vertexLabelBase(node);
    const nextDx = Number(dx)||0, nextDy = Number(dy)||0;
    node.dataset.baseX = base.x.toFixed(2); node.dataset.baseY = base.y.toFixed(2);
    node.dataset.offsetDx = nextDx.toFixed(2); node.dataset.offsetDy = nextDy.toFixed(2);
    node.setAttribute('x',(base.x+nextDx).toFixed(2)); node.setAttribute('y',(base.y+nextDy).toFixed(2));
  }
  function dimensionLabelKey(node) {
    const explicit = safeText(node?.dataset?.dimensionKey || '').trim();
    if (explicit) return explicit;
    const group = node?.closest?.('.sv-cad-dimension-group');
    const owner = safeText(node?.dataset?.owner || group?.dataset?.owner || 'perimeter').trim() || 'perimeter';
    const segment = safeText(group?.dataset?.segment || '').trim();
    return segment ? `${owner}:${segment}` : safeText(node?.textContent || '').trim();
  }
  function dimensionLabelBase(node) {
    const x = Number(node?.dataset?.baseX || node?.getAttribute?.('data-base-x'));
    const y = Number(node?.dataset?.baseY || node?.getAttribute?.('data-base-y'));
    const currentX = Number(node?.getAttribute?.('x') || 0), currentY = Number(node?.getAttribute?.('y') || 0);
    const dx = Number(node?.dataset?.offsetDx || 0), dy = Number(node?.dataset?.offsetDy || 0);
    return { x:Number.isFinite(x)?x:(currentX-dx), y:Number.isFinite(y)?y:(currentY-dy) };
  }
  function dimensionLabelRotation(node) {
    const stored = Number(node?.dataset?.baseRotation);
    if (Number.isFinite(stored)) return stored;
    const match = safeText(node?.getAttribute?.('transform') || '').match(/rotate\(([-0-9.]+)/i);
    const rotation = match ? Number(match[1]) : 0;
    return Number.isFinite(rotation) ? rotation : 0;
  }
  function applyDimensionOffset(node, dx = 0, dy = 0) {
    if (!node) return;
    const base = dimensionLabelBase(node);
    const rotation = dimensionLabelRotation(node);
    const nextDx = Number(dx)||0, nextDy = Number(dy)||0;
    const x = base.x + nextDx, y = base.y + nextDy;
    node.dataset.baseX = base.x.toFixed(2); node.dataset.baseY = base.y.toFixed(2);
    node.dataset.baseRotation = String(rotation);
    node.dataset.offsetDx = nextDx.toFixed(2); node.dataset.offsetDy = nextDy.toFixed(2);
    node.setAttribute('x',x.toFixed(2)); node.setAttribute('y',y.toFixed(2));
    node.setAttribute('transform',`rotate(${rotation.toFixed(2)},${x.toFixed(2)},${y.toFixed(2)})`);
  }
  function segmentFromGroup(group, fallbackIndex = 0) {
    if (!group) return null;
    const count = Math.max(0, Number(group.dataset.vertexCount || 0));
    let startVertex = Math.max(1, Number(group.dataset.startVertex || 1));
    let endVertex = Math.max(1, Number(group.dataset.endVertex || ((startVertex % Math.max(count, 1)) + 1)));
    if (count) { startVertex = Math.min(count, startVertex); endVertex = Math.min(count, endVertex); }
    const extraLines = Array.from(group.querySelectorAll('.sv-confrontante-extra-line')).map((line, index) => ({
      id: safeText(line.dataset.extraId || `extra-${index + 1}`),
      x1: Number(line.getAttribute('x1')), y1: Number(line.getAttribute('y1')),
      x2: Number(line.getAttribute('x2')), y2: Number(line.getAttribute('y2'))
    })).filter((line) => [line.x1,line.y1,line.x2,line.y2].every(Number.isFinite));
    return {
      id: safeText(group.dataset.segmentId || group.dataset.labelKey || `segment-${fallbackIndex + 1}`),
      nome: safeText(group.dataset.confrontanteName || 'Confrontante').trim() || 'Confrontante',
      propriedade: safeText(group.dataset.confrontanteProperty || ''),
      cpfCnpj: safeText(group.dataset.cpfCnpj || ''),
      showPropertyInLabel: group.dataset.showPropertyInLabel === '1' || (group.dataset.showPropertyInLabel !== '0' && Boolean(safeText(group.dataset.confrontanteProperty || '').trim())),
      showCpfCnpjInLabel: group.dataset.showCpfCnpjInLabel === '1',
      tipoLimite: safeText(group.dataset.tipoLimite || ''),
      orientacao: safeText(group.dataset.orientacao || ''),
      observacao: safeText(group.dataset.observacao || ''),
      startVertex,
      endVertex,
      vertices: safeText(group.dataset.selectedVertices || '').split(',').map(Number).filter(Number.isFinite),
      segmentIndexes: safeText(group.dataset.segmentIndexes || '').split(',').map(Number).filter(Number.isFinite),
      freeLine1X1: Number.isFinite(Number(group.dataset.freeLine1X1)) ? Number(group.dataset.freeLine1X1) : null,
      freeLine1Y1: Number.isFinite(Number(group.dataset.freeLine1Y1)) ? Number(group.dataset.freeLine1Y1) : null,
      freeLine1X2: Number.isFinite(Number(group.dataset.freeLine1X2)) ? Number(group.dataset.freeLine1X2) : null,
      freeLine1Y2: Number.isFinite(Number(group.dataset.freeLine1Y2)) ? Number(group.dataset.freeLine1Y2) : null,
      freeLine2X1: Number.isFinite(Number(group.dataset.freeLine2X1)) ? Number(group.dataset.freeLine2X1) : null,
      freeLine2Y1: Number.isFinite(Number(group.dataset.freeLine2Y1)) ? Number(group.dataset.freeLine2Y1) : null,
      freeLine2X2: Number.isFinite(Number(group.dataset.freeLine2X2)) ? Number(group.dataset.freeLine2X2) : null,
      freeLine2Y2: Number.isFinite(Number(group.dataset.freeLine2Y2)) ? Number(group.dataset.freeLine2Y2) : null,
      labelDx: Number(group.dataset.dx || 0) || 0,
      labelDy: Number(group.dataset.dy || 0) || 0,
      labelScale: Math.max(.20, Math.min(4, Number(group.dataset.labelScale || 1) || 1)),
      labelRotation: Number(group.dataset.labelRotation || 0) || 0,
      labelColor: confrontanteLabelColor(group.dataset.labelColor),
      labelColorCustomized: group.dataset.labelColorCustomized === '1',
      extraLines,
      manualLinesOnly: group.dataset.manualLinesOnly === '1' || extraLines.length > 0,
      hidden: false
    };
  }

  function segmentsFromOverlay(overlay) {
    return Array.from(overlay?.querySelectorAll?.('.sv-confrontante-callout') || []).map(segmentFromGroup).filter(Boolean);
  }
  function finiteGuideValue(value) { return Number.isFinite(Number(value)); }
  function hydrateEditorSegments(preferred = [], rendered = []) {
    const renderedById = new Map((Array.isArray(rendered) ? rendered : []).map((item) => [safeText(item?.id), item]));
    const preferredById = new Map((Array.isArray(preferred) ? preferred : []).map((item) => [safeText(item?.id), item]));
    const ids = [...new Set([...renderedById.keys(), ...preferredById.keys()].filter(Boolean))];
    return ids.map((id) => {
      const visual = renderedById.get(id) || {};
      const saved = preferredById.get(id) || {};
      const out = { ...visual, ...saved, id };
      ['freeLine1X1','freeLine1Y1','freeLine1X2','freeLine1Y2','freeLine2X1','freeLine2Y1','freeLine2X2','freeLine2Y2','labelDx','labelDy','labelScale','labelRotation'].forEach((key) => {
        if (finiteGuideValue(visual[key])) out[key] = Number(visual[key]);
        else if (finiteGuideValue(saved[key])) out[key] = Number(saved[key]);
      });
      const visualExtras = Array.isArray(visual.extraLines) ? visual.extraLines.filter((line) => [line?.x1,line?.y1,line?.x2,line?.y2].every(finiteGuideValue)) : [];
      const savedExtras = Array.isArray(saved.extraLines) ? saved.extraLines.filter((line) => [line?.x1,line?.y1,line?.x2,line?.y2].every(finiteGuideValue)) : [];
      out.extraLines = (visualExtras.length ? visualExtras : savedExtras).map((line) => ({ ...line }));
      out.manualLinesOnly = Boolean(saved.manualLinesOnly ?? visual.manualLinesOnly ?? false);
      out.hidden = false;
      return out;
    });
  }
  function vertexCountFromOverlay(overlay) {
    const metadata = overlay?.querySelector?.('.sv-confrontante-metadata');
    const metaCount = Number(metadata?.dataset?.vertexCount || 0);
    if (metaCount > 0) return metaCount;
    return Math.max(0, ...Array.from(overlay?.querySelectorAll?.('.sv-confrontante-callout') || []).map((g) => Number(g.dataset.vertexCount || 0)));
  }

  function editorNoun(options = {}) {
    const explicit = safeText(optionValue(options, 'editorNoun', '')).trim();
    if (explicit) return explicit;
    const page = safeText(optionValue(options, 'page', document.body?.dataset?.page || ''));
    if (page === 'pranchas.html') return 'prancha técnica';
    if (page === 'mapas.html') return 'croqui';
    if (page === 'planialtimetria.html') return 'planialtimetria';
    if (page === 'perimetros.html') return 'perímetro';
    return 'documento técnico';
  }
  function editorTitle(options = {}) {
    const noun = editorNoun(options);
    return `Editar ${noun}`;
  }

  function create(options = {}) {
    const ZOOM_MIN = 0.50;
    const ZOOM_MAX = 3.00;
    let active = false, modal = null, overlay = null, zoom = 1, zoomBaseWidth = 0, draftSegments = [], segmentsDirty = false, hadStoredSegments = false, selectedSegmentId = '', guideState = null, documentSettings = readDocumentSettings(options);
    let presentationMode = 'modal', presentationMount = null, presentationVisible = true;
    let editorBackgroundObjectUrl = '';
    let nativeMode = false, nativeDocument = null, nativePublishFrame = 0, nativeTypographyAudit = null;
    let editorEngine = null, engineDisposers = [];
    let signatureHydrationAttempted = false, signatureHydrationPromise = null;
    let importedSignatureAssetState = null, selectedSignatureMode = 'none';
    let editLinesActive = false, selectedLineRef = null, selectedVertexKey = '', selectedDimensionKey = '', selectedAreaNameId = documentSettings.areaNames?.[0]?.id || '', selectedManualServitudeId = documentSettings.manualServitudes?.[0]?.id || '', servitudeDrawState = null, activeToolPanel = 'zoom';
    let hasUnsavedChanges = false;
    let liveElementState = {};
    const INLINE_MAP_TOOLS = new Set(['elements','names','vertices','lines','servitudes','confrontantes','dimensions']);
    const TECHNICAL_LINE_OWNER = 'technical';
    const history = []; const future = [];
    const toast = typeof options.toast === 'function' ? options.toast : (message, type = 'info') => window.GeoRuralUI?.toast?.(message, type);
    const getSvg = () => safeText(optionValue(options, 'getSvg', ''));
    const getNativeDocument = () => nativeDocumentFromOptions(options);
    const hasEditableLayer = () => { const svg=getSvg(); return svg.includes('sv-confrontante-callout') || svg.includes('sv-confrontante-metadata') || svg.includes('sv-document-perimeter-fill') || svg.includes('sv-vertex-label'); };
    function publishNativeCanvas() {
      if (!nativeMode || !overlay) return false;
      const api = window.SurveyorNativeTechnicalDocument;
      if (api?.patchSettings && nativeDocument) api.patchSettings(nativeDocument, documentSettings);
      // Publicar somente a planta técnica. Os círculos e caminhos abaixo são
      // ferramentas de seleção/arrasto e não pertencem ao documento exportado.
      // A cena editável permanece intacta para permitir editar a servidão depois.
      const documentSvg = overlay.cloneNode(true);
      documentSvg.querySelectorAll('.sv-editor-servitude-handle,.sv-editor-servitude-hitbox,.sv-editor-servitude-center,.sv-editor-servitude-temp').forEach((node)=>node.remove());
      documentSvg.querySelectorAll('.sv-document-manual-servitude.is-selected').forEach((node)=>node.classList.remove('is-selected'));
      const serialized = new XMLSerializer().serializeToString(documentSvg);
      try {
        if (typeof options.onNativeSvgChange === 'function') options.onNativeSvgChange(serialized, api?.snapshot?.(nativeDocument) || nativeDocument);
      } catch (error) { console.warn('[Surveyor] Falha ao publicar cena vetorial nativa:', error); }
      return true;
    }
    function scheduleNativePublish() {
      if (!nativeMode || !overlay || nativePublishFrame) return;
      nativePublishFrame = requestAnimationFrame(() => {
        nativePublishFrame = 0;
        try { syncVisualStateFromOverlay(); } catch (_error) {}
        publishNativeCanvas();
      });
    }

    function cloneSegments(value = draftSegments) { return (Array.isArray(value) ? value : []).map((item) => ({ ...item, extraLines:Array.isArray(item.extraLines)?item.extraLines.map((line)=>({...line})):[] })); }
    function snapshot() { syncVisualStateFromOverlay(); return { segments: cloneSegments(), settings: normalizeDocumentSettings(documentSettings) }; }
    function checkpoint() { history.push(snapshot()); if (history.length > 40) history.shift(); future.length = 0; markDirty(true); updateHistoryControls(); }
    function safeCheckpoint(label = 'edição') {
      try { checkpoint(); return true; }
      catch (error) { console.warn(`[Surveyor] Falha ao registrar histórico antes de ${label}; ação continuará sem perder funcionalidade.`, error); return false; }
    }
    function applySnapshot(state) {
      if (!state) return;
      draftSegments = cloneSegments(state.segments);
      documentSettings = normalizeDocumentSettings(state.settings);
      segmentsDirty = true;
      renderSegmentPanel();
      draftSegments.forEach((segment)=>{
        const group=groupForSegment(segment.id) || ensureManualSegmentCallout(segment);
        if(group){
          group.dataset.dx=String(Number(segment.labelDx||0)||0);
          group.dataset.dy=String(Number(segment.labelDy||0)||0);
          group.dataset.labelScale=String(Math.max(.20,Math.min(4,Number(segment.labelScale||1)||1)));
          group.dataset.labelRotation=String(Number(segment.labelRotation||0)||0);
          group.dataset.labelColorCustomized=segment.labelColorCustomized===true?'1':'0';
          applyScale(group,segment.labelScale); applyRotation(group,segment.labelRotation); applyOffset(group,segment.labelDx,segment.labelDy); applyConfrontanteLabelColor(group, segmentFontColor(segment,elementVisual('confrontantes').color));
          const node=ensureEngineConfrontanteNode(group); if(node){node.data.dx=Number(segment.labelDx||0)||0;node.data.dy=Number(segment.labelDy||0)||0;}
        }
        renderGuidePreview(segment);
      });
      renderTechnicalLinePreview();
      if(editLinesActive)renderAllGuidePreviews();
      // Quando o snapshot não contém offset, voltar à posição original (0,0),
      // sem herdar o dataset da edição que acabou de ser desfeita.
      overlay?.querySelectorAll?.('.sv-vertex-label').forEach((node) => {
        const saved = documentSettings.vertexLabelOffsets?.[vertexLabelKey(node)];
        applyVertexOffset(node, Number(saved?.dx)||0, Number(saved?.dy)||0);
      });
      overlay?.querySelectorAll?.('.sv-cad-dimension').forEach((node) => {
        const saved = documentSettings.dimensionLabelOffsets?.[dimensionLabelKey(node)];
        applyDimensionOffset(node, Number(saved?.dx)||0, Number(saved?.dy)||0);
      });
      // Restaurar também a cena do motor: seu render() é chamado após Undo/Redo.
      // Sem essa sincronização, rótulos voltariam às posições antigas ao redesenhar.
      if (editorEngine?.scene) {
        overlay?.querySelectorAll?.('.sv-vertex-label').forEach((node) => {
          const key = vertexLabelKey(node);
          const offset = documentSettings.vertexLabelOffsets?.[key] || { dx:0, dy:0 };
          const sceneNode = editorEngine.scene.get?.(`vertex-label:${key}`);
          if (sceneNode) { sceneNode.data.dx = Number(offset.dx)||0; sceneNode.data.dy = Number(offset.dy)||0; }
        });
        draftSegments.forEach((segment) => {
          const sceneNode = editorEngine.scene.get?.(`confrontante:${segment.id}`);
          if (sceneNode) { sceneNode.data.dx = Number(segment.labelDx)||0; sceneNode.data.dy = Number(segment.labelDy)||0; }
        });
      }
      syncSettingsControls(); updateHistoryControls(); scheduleNativePublish(); markDirty(true);
    }
    // Registra a automação no histórico ativo como UMA única alteração reversível.
    // O snapshot inclui configurações visuais e confrontantes, não só nós SVG.
    function recordDocumentAutomation(before, label) {
      const after = snapshot();
      if (JSON.stringify(before) === JSON.stringify(after)) return false;
      if (editorEngine?.history?.pushExecuted) {
        editorEngine.history.pushExecuted({
          label,
          do() { applySnapshot(after); },
          undo() { applySnapshot(before); }
        });
      } else {
        history.push(before);
        if (history.length > 40) history.shift();
        future.length = 0;
      }
      updateHistoryControls();
      return true;
    }
    function undoEdit() {
      if (editorEngine?.history?.canUndo) { editorEngine.undo(); syncVisualStateFromOverlay(); setGuideStatus('Alteração desfeita pelo motor de edição.'); return updateHistoryControls(); }
      if (!history.length) return;
      future.push(snapshot()); applySnapshot(history.pop()); setGuideStatus('Alteração desfeita.');
    }
    function redoEdit() {
      if (editorEngine?.history?.canRedo) { editorEngine.redo(); syncVisualStateFromOverlay(); setGuideStatus('Alteração refeita pelo motor de edição.'); return updateHistoryControls(); }
      if (!future.length) return;
      history.push(snapshot()); applySnapshot(future.pop()); setGuideStatus('Alteração refeita.');
    }
    function updateHistoryControls() {
      const canUndo=Boolean(history.length || editorEngine?.history?.canUndo);
      const canRedo=Boolean(future.length || editorEngine?.history?.canRedo);
      modal?.querySelectorAll('[data-editor-action="undo"]').forEach((button)=>{ button.disabled=!canUndo; });
      modal?.querySelectorAll('[data-editor-action="redo"]').forEach((button)=>{ button.disabled=!canRedo; });
    }
    function updatePrimaryActionState() {
      const saveButton = modal?.querySelector?.('[data-editor-action="save"]');
      const downloadSlot = modal?.querySelector?.('[data-editor-download-slot]');
      if (saveButton) { saveButton.hidden = !hasUnsavedChanges; saveButton.style.pointerEvents=hasUnsavedChanges?'auto':'none'; saveButton.style.zIndex=hasUnsavedChanges?'5':''; }
      if (downloadSlot) { downloadSlot.hidden = hasUnsavedChanges; downloadSlot.style.display=hasUnsavedChanges?'none':''; downloadSlot.style.pointerEvents=hasUnsavedChanges?'none':'auto'; if(hasUnsavedChanges)downloadSlot.querySelectorAll('details[open]').forEach((node)=>node.removeAttribute('open')); }
      if (modal) modal.dataset.editorDirty = hasUnsavedChanges ? '1' : '0';
    }
    function markDirty(value = true) {
      const next = value !== false;
      // Não repetir mudanças de estado, buscas de controles e eventos globais
      // em todo pointermove/entrada de slider depois da primeira alteração.
      if (hasUnsavedChanges === next) return;
      hasUnsavedChanges = next;
      updatePrimaryActionState();
      try {
        window.dispatchEvent(new CustomEvent('surveyor:document-dirty',{detail:{
          page:safeText(optionValue(options,'page',document.body?.dataset?.page||'')),
          projectId:safeText(optionValue(options,'projectId','')),
          dirty:hasUnsavedChanges,
          source:'technical-editor'
        }}));
      } catch (_error) {}
    }

    function polygonKeyOf(node) {
      return safeText(node?.dataset?.polygonKey || (node?.classList?.contains('sv-document-perimeter-fill') ? 'perimetro-principal' : '')).trim();
    }
    function editablePolygonInventory() {
      if (!overlay) return [];
      const byKey = new Map();
      Array.from(overlay.querySelectorAll('.sv-document-editable-polygon,.sv-document-perimeter-fill')).forEach((node, index) => {
        let key = polygonKeyOf(node) || `poligono-${index + 1}`;
        if (!node.dataset.polygonKey) node.dataset.polygonKey = key;
        const name = safeText(node.dataset.polygonName || (node.classList.contains('sv-document-perimeter-fill') ? 'Perímetro do imóvel' : `Polígono ${index + 1}`)).trim() || `Polígono ${index + 1}`;
        const category = safeText(node.dataset.polygonCategory || (node.classList.contains('sv-document-perimeter-fill') ? 'perimetro' : 'outros')).trim() || 'outros';
        if (!node.dataset.originalFill) node.dataset.originalFill = safeText(node.getAttribute('fill') || '#f3c410');
        if (!node.dataset.originalStroke) node.dataset.originalStroke = safeText(node.getAttribute('stroke') || node.dataset.polygonColor || node.dataset.originalFill || '#f3c410');
        if (!node.dataset.originalFillOpacity) node.dataset.originalFillOpacity = String(Number(node.getAttribute('fill-opacity') || 0.22));
        if (!byKey.has(key)) byKey.set(key, { key, name, category, node });
      });
      return Array.from(byKey.values());
    }
    function polygonStyleForNode(item) {
      const node = item?.node;
      const saved = documentSettings.polygonStyles?.[item?.key] || null;
      const fallbackFill = normalizeHexColor(node?.dataset?.originalFill || node?.dataset?.polygonColor || '#f3c410', '#f3c410');
      const fallbackStroke = normalizeHexColor(node?.dataset?.originalStroke || node?.dataset?.polygonColor || fallbackFill, fallbackFill);
      const legacyColor = saved ? normalizeHexColor(saved.color, fallbackFill) : fallbackFill;
      const originalOpacity = Number(node?.dataset?.originalFillOpacity || node?.getAttribute?.('fill-opacity') || .22);
      const strokeWidth = Number(saved?.strokeWidth);
      return {
        color: saved ? normalizeHexColor(saved.fillColor, legacyColor) : fallbackFill,
        fillColor: saved ? normalizeHexColor(saved.fillColor, legacyColor) : fallbackFill,
        strokeColor: saved ? normalizeHexColor(saved.strokeColor, normalizeHexColor(saved.color, fallbackStroke)) : fallbackStroke,
        strokeWidth: Number.isFinite(strokeWidth) ? Math.max(.25, Math.min(4, strokeWidth)) : 1,
        fill: saved ? saved.fill !== false : true,
        opacity: saved && Number.isFinite(Number(saved.opacity)) ? Math.max(0, Math.min(1, Number(saved.opacity))) : (Number.isFinite(originalOpacity) ? Math.max(0, Math.min(1, originalOpacity)) : .22)
      };
    }
    function applyPolygonStylesToOverlay() {
      if (!overlay) return;
      const inventory = editablePolygonInventory();
      inventory.forEach((item) => {
        const style = polygonStyleForNode(item);
        const nodes = Array.from(overlay.querySelectorAll('[data-polygon-key]')).filter((node) => node.dataset.polygonKey === item.key);
        nodes.forEach((node) => {
          if (!node.dataset.originalStrokeWidth) {
            const renderedWidth=Math.max(.1,Number(node.getAttribute('stroke-width')||1)||1);
            node.dataset.originalStrokeWidth=String(renderedWidth/Math.max(.25,Number(style.strokeWidth)||1));
          }
          const baseStrokeWidth=Math.max(.1,Number(node.dataset.originalStrokeWidth||1)||1);
          if (node.classList.contains('sv-document-polygon-outline')) {
            node.setAttribute('stroke', style.strokeColor);
            node.setAttribute('stroke-width', String((baseStrokeWidth*style.strokeWidth).toFixed(3)));
          }
          if (node.classList.contains('sv-document-editable-polygon') || node.classList.contains('sv-document-perimeter-fill')) {
            const originalStroke = safeText(node.dataset.originalStroke || node.getAttribute('stroke'));
            node.setAttribute('fill', style.fillColor);
            if (originalStroke && originalStroke !== 'none') {
              node.setAttribute('stroke', style.strokeColor);
              node.setAttribute('stroke-width', String((baseStrokeWidth*style.strokeWidth).toFixed(3)));
            }
            node.setAttribute('fill-opacity', documentSettings.polygonFill && style.fill ? String(style.opacity) : '0');
          }
        });
      });
    }

    function applyAreaNameColorsToOverlay() {
      if (!overlay) return;
      const labelColor = window.SurveyorTechnicalMapBridge?.readableLabelColor || ((value, fallback = '#111827') => normalizeHexColor(value, fallback));
      const globalColor = labelColor(documentSettings.areaNameColor, '#111827');
      overlay.querySelectorAll('.sv-area-name-label').forEach((group) => {
        const id = safeText(group.dataset.areaNameId || '').trim();
        const item = (documentSettings.areaNames || []).find((entry) => safeText(entry?.id || '').trim() === id);
        const color = normalizeHexColor(item?.color || globalColor, globalColor);
        group.dataset.areaNameColor = color;
        const text = group.querySelector('.sv-area-name-text');
        if (text) {
          text.setAttribute('fill', color);
          text.setAttribute('stroke', contrastHaloColor(color));
          text.setAttribute('paint-order','stroke fill');
        }
      });
    }
    function applyTechnicalLineColorsToOverlay() {
      if (!overlay) return;
      const globalColor = normalizeHexColor(documentSettings.technicalLineColor, '#111827');
      overlay.querySelectorAll('.sv-document-technical-line').forEach((node) => {
        const stroke = normalizeHexColor(node.dataset.lineColor || globalColor, globalColor);
        node.setAttribute('stroke', stroke);
      });
      overlay.querySelectorAll('.sv-document-manual-servitude-line').forEach((node) => {
        node.setAttribute('stroke', globalColor);
      });
    }
    function renderPolygonAppearanceList() {
      const host = modal?.querySelector('[data-polygon-style-list]');
      if (!host) return;
      const inventory = editablePolygonInventory();
      const polygonSection=host.closest('.sv-editor-polygon-style-section');
      if(polygonSection?.closest?.('[data-compact-appearance="1"]'))polygonSection.hidden=inventory.length<=1;
      if (!inventory.length) {
        host.innerHTML = '<p class="sv-editor-tool-hint">Nenhum polígono editável encontrado nesta prancha.</p>';
        return;
      }
      host.innerHTML = inventory.map((item) => {
        const style = polygonStyleForNode(item);
        const label = safeText(item.name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const category = safeText(item.category).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const key = safeText(item.key).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
        return `<article class="sv-editor-polygon-style-card${style.fill?' is-active':''}" data-polygon-style-card="${key}"><label class="sv-editor-polygon-style-toggle"><input type="checkbox" data-polygon-fill="${key}" ${style.fill?'checked':''}><span>${label}</span></label><small class="sv-editor-polygon-category">${category}</small><div class="sv-editor-polygon-style-controls"><label class="sv-editor-slider-row">Opacidade <input type="range" min="0" max="0.85" step="0.01" data-polygon-opacity="${key}" value="${style.opacity}"><output data-polygon-opacity-output="${key}">${Math.round(style.opacity*100)}%</output></label><label class="sv-editor-polygon-color-row"><span>Cor</span><input type="color" data-polygon-color="${key}" value="${style.fillColor}"></label></div></article>`;
      }).join('');
    }
    function updatePolygonStyle(key, patch = {}) {
      const id = safeText(key).trim();
      if (!id) return;
      const inventory = editablePolygonInventory();
      const item = inventory.find((entry) => entry.key === id);
      if (!item) return;
      documentSettings.polygonStyles ||= {};
      const current = polygonStyleForNode(item);
      const nextFillColor=normalizeHexColor(patch.fillColor ?? patch.color ?? current.fillColor, current.fillColor);
      const nextStrokeColor=normalizeHexColor(patch.strokeColor ?? current.strokeColor, current.strokeColor);
      const nextStrokeWidth=Number(patch.strokeWidth);
      documentSettings.polygonStyles[id] = {
        color: nextFillColor,
        fillColor: nextFillColor,
        strokeColor: nextStrokeColor,
        strokeWidth: Number.isFinite(nextStrokeWidth) ? Math.max(.25, Math.min(4, nextStrokeWidth)) : current.strokeWidth,
        fill: patch.fill ?? current.fill,
        opacity: Number.isFinite(Number(patch.opacity)) ? Math.max(0, Math.min(1, Number(patch.opacity))) : current.opacity
      };
      applyPolygonStylesToOverlay();
      const card = modal?.querySelector(`[data-polygon-style-card="${CSS.escape(id)}"]`);
      if (card) card.classList.toggle('is-active',documentSettings.polygonStyles[id].fill!==false);
      const output = card?.querySelector(`[data-polygon-opacity-output="${CSS.escape(id)}"]`);
      if (output) output.textContent = `${Math.round(documentSettings.polygonStyles[id].opacity*100)}%`;
    }
    function signatureNodeValue(node) {
      if (!node) return '';
      return safeText(node.getAttribute('href') || node.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') || '').trim();
    }
    async function hydrateSignatureFromAccount({ force = false } = {}) {
      const signatureNode = overlay?.querySelector?.('[data-document-signature]');
      const currentValue = signatureNodeValue(signatureNode);
      if (!signatureNode) return '';
      if (currentValue) return currentValue;
      if (typeof options.getSignatureData !== 'function') return '';
      if (signatureHydrationPromise) return signatureHydrationPromise;
      if (signatureHydrationAttempted && !force) return '';
      signatureHydrationAttempted = true;
      signatureHydrationPromise = Promise.resolve()
        .then(() => options.getSignatureData())
        .then((value) => {
          const dataUrl = safeText(value).trim();
          if (!dataUrl) return '';
          signatureNode.setAttribute('href', dataUrl);
          signatureNode.setAttributeNS?.('http://www.w3.org/1999/xlink', 'href', dataUrl);
          signatureNode.style.removeProperty('display');
          signatureNode.setAttribute('opacity', '1');
          return dataUrl;
        })
        .catch((error) => {
          console.warn('[Surveyor] Não foi possível carregar a assinatura da conta no editor técnico:', error);
          return '';
        })
        .finally(() => { signatureHydrationPromise = null; });
      return signatureHydrationPromise;
    }

    function importedSignatureNode() { return overlay?.querySelector?.('[data-document-imported-signature]') || null; }
    function ensureImportedSignatureNode() {
      if(!overlay) return null;
      const asset=importedSignatureAssetState;
      let node=importedSignatureNode();
      if(!asset?.dataUrl){node?.remove();return null;}
      if(!node){
        node=document.createElementNS('http://www.w3.org/2000/svg','image');
        node.setAttribute('data-document-imported-signature','1');
        node.setAttribute('data-native-object-id','imported-signature');
        node.setAttribute('preserveAspectRatio','xMidYMid meet');
        const account=overlay.querySelector('[data-document-signature]');
        if(account?.parentNode) account.parentNode.insertBefore(node,account.nextSibling); else overlay.appendChild(node);
      }
      const ratio=Math.max(.15,Math.min(8,asset.width/Math.max(1,asset.height)));
      const baseWidth=140,baseHeight=Math.max(22,Math.min(120,baseWidth/ratio));
      node.dataset.baseWidth=String(baseWidth);node.dataset.baseHeight=String(baseHeight);
      node.setAttribute('href',asset.dataUrl);node.setAttributeNS?.('http://www.w3.org/1999/xlink','href',asset.dataUrl);
      node.dataset.importedSignatureName=asset.name;
      return node;
    }
    function signatureModeAvailable(mode){
      if(mode==='imported')return documentSettings.importedSignatureEnabled && Boolean(importedSignatureAssetState?.dataUrl);
      if(mode==='account')return documentSettings.signatureEnabled && Boolean(signatureNodeValue(overlay?.querySelector?.('[data-document-signature]')));
      return false;
    }
    function activeSignatureMode(){return signatureModeAvailable(selectedSignatureMode)?selectedSignatureMode:'none';}
    function activeSignatureScale(){const mode=activeSignatureMode();return mode==='imported'?documentSettings.importedSignatureScale:mode==='account'?documentSettings.signatureScale:1;}
    function syncSignatureSelectionVisual(){
      const account=overlay?.querySelector?.('[data-document-signature]');
      const imported=importedSignatureNode();
      account?.classList?.toggle('is-selected-signature',activeSignatureMode()==='account');
      imported?.classList?.toggle('is-selected-signature',activeSignatureMode()==='imported');
    }
    function selectSignatureMode(mode){
      selectedSignatureMode=signatureModeAvailable(mode)?mode:'none';
      syncSignatureSelectionVisual();
      syncSettingsControls();
      return selectedSignatureMode;
    }
    function applySignatureNodeLayout(node,{visible=false,scale=1,x=null,y=null,xKey='',yKey=''}={}){
      if(!node)return;
      node.style.display=visible?'':'none';node.setAttribute('opacity',visible?'1':'0');
      const baseWidth=Number(node.dataset.baseWidth||node.getAttribute('width')||120)||120;
      const baseHeight=Number(node.dataset.baseHeight||node.getAttribute('height')||34)||34;
      if(!node.dataset.baseWidth)node.dataset.baseWidth=String(baseWidth);if(!node.dataset.baseHeight)node.dataset.baseHeight=String(baseHeight);
      const viewBox=overlay.viewBox?.baseVal;const vx=Number(viewBox?.x||0),vy=Number(viewBox?.y||0),vw=Math.max(1,Number(viewBox?.width||overlay.getAttribute('width')||1600)||1600),vh=Math.max(1,Number(viewBox?.height||overlay.getAttribute('height')||1000)||1000);
      const defaultCx=Number(node.dataset.anchorX||0),defaultCy=Number(node.dataset.anchorY||0),width=baseWidth*scale,height=baseHeight*scale;
      let cx=Number.isFinite(x)?vx+x*vw:defaultCx,cy=Number.isFinite(y)?vy+y*vh:defaultCy;
      if(!(Number.isFinite(cx)&&cx))cx=vx+vw/2;if(!(Number.isFinite(cy)&&cy))cy=vy+vh/2;
      cx=Math.max(vx+width/2,Math.min(vx+vw-width/2,cx));cy=Math.max(vy+height,Math.min(vy+vh,cy));
      if(xKey)documentSettings[xKey]=Math.max(0,Math.min(1,(cx-vx)/vw));if(yKey)documentSettings[yKey]=Math.max(0,Math.min(1,(cy-vy)/vh));
      node.setAttribute('x',String(cx-width/2));node.setAttribute('y',String(cy-height));node.setAttribute('width',String(width));node.setAttribute('height',String(height));
      node.dataset.currentAnchorX=String(cx);node.dataset.currentAnchorY=String(cy);node.style.cursor='';
    }
    function fileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(safeText(reader.result));reader.onerror=()=>reject(reader.error||new Error('Falha ao ler a imagem.'));reader.readAsDataURL(file);});}
    function imageDimensions(dataUrl){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:Math.max(1,image.naturalWidth||image.width||1),height:Math.max(1,image.naturalHeight||image.height||1)});image.onerror=()=>reject(new Error('A imagem de assinatura não pôde ser aberta.'));image.src=dataUrl;});}
    async function importExternalSignature(file){
      if(!file)return;
      if(!/^image\/(?:png|jpeg|webp)$/i.test(safeText(file.type)))throw new Error('Use uma assinatura em PNG, JPG ou WEBP.');
      if(Number(file.size)>5*1024*1024)throw new Error('A assinatura deve ter no máximo 5 MB.');
      const dataUrl=await fileAsDataUrl(file);const dims=await imageDimensions(dataUrl);checkpoint();
      importedSignatureAssetState={name:safeText(file.name||'Assinatura importada'),dataUrl,width:dims.width,height:dims.height,updatedAt:new Date().toISOString()};
      const persisted=await writeImportedSignatureAsset(options,importedSignatureAssetState);
      documentSettings.importedSignatureEnabled=true;documentSettings.importedSignatureScale=1;documentSettings.importedSignatureX=null;documentSettings.importedSignatureY=null;
      ensureImportedSignatureNode();applyDocumentSettingsToOverlay();selectedSignatureMode='imported';syncSignatureSelectionVisual();syncSettingsControls();scheduleNativePublish();markDirty(true);
      return persisted;
    }

    function coordinateTableSourceRows() {
      if (typeof options.getCoordinateRows !== 'function') return [];
      return Array.isArray(options.getCoordinateRows()) ? options.getCoordinateRows() : [];
    }

    function coordinateTableMaxRows() {
      return Math.max(1, coordinateTableSourceRows().length || 1);
    }

    function syncCoordinateTableOverlay() {
      if (!overlay) return;
      overlay.querySelectorAll('.sv-coordinate-table-overlay').forEach((node) => node.remove());
      if (!documentSettings.coordinateTableEnabled || typeof options.getCoordinateRows !== 'function') return;
      const sourceRows = coordinateTableSourceRows();
      const maxRows = Math.max(1, sourceRows.length || 1);
      documentSettings.coordinateTableRows = Math.max(1, Math.min(maxRows, Math.round(Number(documentSettings.coordinateTableRows || maxRows) || maxRows)));
      const rows = sourceRows.slice(0, documentSettings.coordinateTableRows);
      if (!rows.length) return;
      const ns='http://www.w3.org/2000/svg';
      const frame=mapFrameFromOverlay();
      const scale=Math.max(.7,Math.min(1.8,Number(documentSettings.coordinateTableScale||1)||1));
      const rowH=18*scale, headerH=22*scale, width=Math.min(340,Math.max(250,frame.w*.42))*scale;
      const height=headerH+rows.length*rowH+6*scale;
      const defaultX=frame.x+frame.w-width-10, defaultY=frame.y+frame.h-height-10;
      const rawX=Number.isFinite(documentSettings.coordinateTableX)?frame.x+documentSettings.coordinateTableX*frame.w:defaultX;
      const rawY=Number.isFinite(documentSettings.coordinateTableY)?frame.y+documentSettings.coordinateTableY*frame.h:defaultY;
      const minX=frame.x, maxX=frame.x+frame.w-width, minY=frame.y, maxY=frame.y+frame.h-height;
      const x=Math.max(minX,Math.min(maxX,rawX)), y=Math.max(minY,Math.min(maxY,rawY));
      documentSettings.coordinateTableX=(x-frame.x)/frame.w;
      documentSettings.coordinateTableY=(y-frame.y)/frame.h;
      const group=document.createElementNS(ns,'g');
      group.setAttribute('class','sv-coordinate-table-overlay');
      group.dataset.mapX=String(frame.x); group.dataset.mapY=String(frame.y); group.dataset.mapW=String(frame.w); group.dataset.mapH=String(frame.h);
      group.dataset.tableX=String(x); group.dataset.tableY=String(y); group.dataset.tableWidth=String(width); group.dataset.tableHeight=String(height); group.dataset.tableScale=String(scale);
      const rect=document.createElementNS(ns,'rect');
      rect.setAttribute('x',String(x));rect.setAttribute('y',String(y));rect.setAttribute('width',String(width));rect.setAttribute('height',String(height));rect.setAttribute('rx',String(Math.max(4,4*scale)));rect.setAttribute('fill','#fff');rect.setAttribute('fill-opacity','.96');rect.setAttribute('stroke','#1f2937');rect.setAttribute('stroke-width','1');group.appendChild(rect);
      const dragZone=document.createElementNS(ns,'rect');
      dragZone.setAttribute('class','sv-coordinate-table-drag-zone');
      dragZone.setAttribute('x',String(x));dragZone.setAttribute('y',String(y));dragZone.setAttribute('width',String(width));dragZone.setAttribute('height',String(headerH));dragZone.setAttribute('rx',String(Math.max(4,4*scale)));dragZone.setAttribute('fill','#ffffff');dragZone.setAttribute('fill-opacity','0');dragZone.style.cursor='move';group.appendChild(dragZone);
      const header=document.createElementNS(ns,'rect');
      header.setAttribute('x',String(x));header.setAttribute('y',String(y));header.setAttribute('width',String(width));header.setAttribute('height',String(headerH));header.setAttribute('rx',String(Math.max(4,4*scale)));header.setAttribute('fill','#dbeafe');group.appendChild(header);
      const cols=[{label:'Vértice',dx:8*scale},{label:'Latitude',dx:width*.24+4*scale},{label:'Longitude',dx:width*.62+4*scale}];
      cols.forEach((col)=>{const t=document.createElementNS(ns,'text');t.setAttribute('x',String(x+col.dx));t.setAttribute('y',String(y+15*scale));t.setAttribute('font-size',String(10*scale));t.setAttribute('font-weight','600');t.setAttribute('fill','#10243c');t.textContent=col.label;group.appendChild(t);});
      rows.forEach((row,index)=>{
        const ry=y+headerH+index*rowH;
        const rowLabel=safeText(row.label||`V-${String(index+1).padStart(2,'0')}`).trim().toUpperCase();
        const rowGroup=document.createElementNS(ns,'g');
        rowGroup.setAttribute('class','sv-coordinate-table-row');
        rowGroup.setAttribute('data-coordinate-vertex',rowLabel);
        rowGroup.setAttribute('data-vertex-index',String(index+1));
        rowGroup.style.cursor='pointer';
        const bg=document.createElementNS(ns,'rect');
        bg.setAttribute('class','sv-coordinate-table-row-bg');
        bg.setAttribute('x',String(x+1));bg.setAttribute('y',String(ry));bg.setAttribute('width',String(width-2));bg.setAttribute('height',String(rowH));
        bg.setAttribute('fill',index%2===1?'#f8fafc':'#ffffff');
        rowGroup.appendChild(bg);
        const values=[rowLabel,Number(row.lat).toFixed(7),Number(row.lng).toFixed(7)];
        [x+8*scale,x+width*.24+4*scale,x+width*.62+4*scale].forEach((tx,colIndex)=>{const t=document.createElementNS(ns,'text');t.setAttribute('x',String(tx));t.setAttribute('y',String(ry+13*scale));t.setAttribute('font-size',String(9*scale));t.setAttribute('fill','#334155');t.textContent=values[colIndex];rowGroup.appendChild(t);});
        const line=document.createElementNS(ns,'line');line.setAttribute('x1',String(x));line.setAttribute('x2',String(x+width));line.setAttribute('y1',String(ry+rowH));line.setAttribute('y2',String(ry+rowH));line.setAttribute('stroke','#dbe3ee');line.setAttribute('stroke-width','.6');rowGroup.appendChild(line);
        group.appendChild(rowGroup);
      });
      const handleSize=Math.max(12,12*scale), hx=x+width-handleSize, hy=y+height-handleSize;
      const handle=document.createElementNS(ns,'rect');
      handle.setAttribute('class','sv-coordinate-table-resize-handle');
      handle.setAttribute('x',String(hx));handle.setAttribute('y',String(hy));handle.setAttribute('width',String(handleSize));handle.setAttribute('height',String(handleSize));handle.setAttribute('rx',String(Math.max(2,2*scale)));handle.setAttribute('fill','#2563eb');handle.setAttribute('fill-opacity','.9');handle.setAttribute('stroke','#fff');handle.setAttribute('stroke-width','1');handle.style.cursor='nwse-resize';group.appendChild(handle);
      [[hx+handleSize*.35,hy+handleSize*.76,hx+handleSize*.76,hy+handleSize*.35],[hx+handleSize*.18,hy+handleSize*.76,hx+handleSize*.76,hy+handleSize*.18]].forEach((coords)=>{const l=document.createElementNS(ns,'line');l.setAttribute('x1',String(coords[0]));l.setAttribute('y1',String(coords[1]));l.setAttribute('x2',String(coords[2]));l.setAttribute('y2',String(coords[3]));l.setAttribute('stroke','#fff');l.setAttribute('stroke-width','1.1');group.appendChild(l);});
      overlay.appendChild(group);
    }

    function elementVisual(key) {
      const defaults=ELEMENT_VISUAL_DEFAULTS[key] || {scale:1,color:'#111827'};
      return documentSettings?.elementVisuals?.[key] || defaults;
    }
    function applyElementColor(root,color) {
      if(!root)return;
      const normalized=normalizeHexColor(color,'#111827');
      root.querySelectorAll?.('text').forEach((node)=>node.setAttribute('fill',normalized));
      root.querySelectorAll?.('[stroke]').forEach((node)=>{const current=safeText(node.getAttribute('stroke')).toLowerCase();if(current&&current!=='none'&&current!=='#ffffff'&&current!=='#fff')node.setAttribute('stroke',normalized);});
      root.querySelectorAll?.('[fill]').forEach((node)=>{const current=safeText(node.getAttribute('fill')).toLowerCase();if(current&&current!=='none'&&current!=='#ffffff'&&current!=='#fff'&&!current.startsWith('url('))node.setAttribute('fill',normalized);});
    }
    function applyElementTransform(root,scale=1) {
      if(!root)return;
      const normalized=Math.max(.25,Math.min(3,Number(scale)||1));
      root.style.transformBox='fill-box';
      root.style.transformOrigin='center';
      root.style.transform=normalized===1?'':`scale(${normalized.toFixed(3)})`;
    }
    function applyDimensionSettingsToOverlay() {
      if (!overlay) return;
      overlay.querySelectorAll('.sv-cad-dimension').forEach((node)=>{
        const key=dimensionLabelKey(node);
        const group=node.closest('.sv-cad-dimension-group');
        const visualKey=group?.dataset?.owner==='perimeter'?'cotas':'glebaCotas';
        const visual=elementVisual(visualKey);
        const legacyKey=key.startsWith('perimeter:')?key.slice('perimeter:'.length):'';
        const sharedScale=window.SurveyorTechnicalMapBridge?.dimensionScaleForKey;
        const effectiveScale=typeof sharedScale==='function'
          ? sharedScale(documentSettings,key,legacyKey)
          : Math.max(0,Math.min(5,Number(visual.scale||1)*Math.max(0,Math.min(5,Number(documentSettings.dimensionLabelScales?.[key] ?? (legacyKey?documentSettings.dimensionLabelScales?.[legacyKey]:undefined) ?? 1)||1))));
        let base=Number(node.dataset.dimensionBaseFontSize||0);
        if(!(base>0)){
          const current=Number(node.getAttribute('font-size')||0);
          const sourceScaleRaw=Number(node.dataset.dimensionScale ?? node.dataset.sourceDimensionScale ?? 1);
          const sourceScale=Number.isFinite(sourceScaleRaw)&&sourceScaleRaw>0?sourceScaleRaw:1;
          base=current>0?current/sourceScale:0;
          if(base>0)node.dataset.dimensionBaseFontSize=String(base);
        }
        if(base>0)node.setAttribute('font-size',String((base*effectiveScale).toFixed(3)));
        const color=normalizeHexColor(visual.color || documentSettings.dimensionColor || node.dataset.dimensionColor || '#111827','#111827');
        node.dataset.dimensionColor=color;
        node.setAttribute('fill',color);
        group?.querySelectorAll?.('.sv-cad-dimension-line, .sv-cad-dimension-tick').forEach((lineNode)=>lineNode.setAttribute('stroke',color));
        const offset=documentSettings.dimensionLabelOffsets?.[key] || {dx:Number(node.dataset.offsetDx||0)||0,dy:Number(node.dataset.offsetDy||0)||0};
        applyDimensionOffset(node,offset.dx,offset.dy);
        node.classList.toggle('is-selected',Boolean(selectedDimensionKey&&selectedDimensionKey===key));
      });
    }
    function applyElementVisualsToOverlay() {
      if(!overlay)return;
      const north=overlay.querySelector('[data-live-element="north"],.sv-live-element-north');
      const northVisual=elementVisual('north'); applyElementTransform(north,northVisual.scale); applyElementColor(north,northVisual.color);
      const grid=overlay.querySelector('[data-live-element="grid"],.sv-live-element-grid');
      const gridVisual=elementVisual('grid'); if(grid){grid.style.opacity=String(Math.max(.2,Math.min(1,.45+gridVisual.scale*.35)));applyElementColor(grid,gridVisual.color);}
      const scaleGroup=overlay.querySelector('[data-live-element="scale"],.sv-live-element-scale');
      const scaleVisual=elementVisual('scale'); applyElementTransform(scaleGroup,scaleVisual.scale); applyElementColor(scaleGroup,scaleVisual.color);
      const confrontanteVisual=elementVisual('confrontantes');
      overlay.querySelectorAll('.sv-confrontante-callout').forEach((group)=>{
        const segment=segmentById(group.dataset.segmentId||group.dataset.labelKey||'');
        const localScale=Math.max(.2,Math.min(4,Number(segment?.labelScale||1)||1));
        applyScale(group,localScale*Math.max(.25,Math.min(3,Number(confrontanteVisual.scale)||1)));
        applyConfrontanteLabelColor(group,segmentFontColor(segment,confrontanteVisual.color));
      });
    }

    function applyMiniMapSettingsToOverlay() {
      if (!overlay) return;
      const image = overlay.querySelector('[data-live-asset-value="miniMap"]');
      if (image) image.setAttribute('opacity', String(Math.max(.2, Math.min(1, Number(documentSettings.miniMapOpacity ?? .88) || .88))));
      const perimeter = overlay.querySelector('[data-mini-map-perimeter]');
      if (perimeter) perimeter.style.display = documentSettings.miniMapPerimeterVisible === false ? 'none' : '';
    }
    function notifyMiniMapChange() {
      try {
        if (typeof options?.onMiniMapChange === 'function') options.onMiniMapChange({
          miniMapKind:documentSettings.miniMapKind,
          miniMapOpacity:documentSettings.miniMapOpacity,
          miniMapPerimeterVisible:documentSettings.miniMapPerimeterVisible
        });
      } catch (error) { console.warn('[Surveyor] Não foi possível atualizar o minimapa ao vivo:', error); }
    }

    function applyDocumentSettingsToOverlay() {
      if (!overlay) return;
      applyMiniMapSettingsToOverlay();
      applyPolygonStylesToOverlay();
      applyDimensionSettingsToOverlay();
      applyElementVisualsToOverlay();
      syncCoordinateTableOverlay();
      const signatureNode = overlay.querySelector('[data-document-signature]');
      const importedNode=ensureImportedSignatureNode();
      if(signatureNode)applySignatureNodeLayout(signatureNode,{visible:documentSettings.signatureEnabled && Boolean(signatureNodeValue(signatureNode)),scale:documentSettings.signatureScale,x:documentSettings.signatureX,y:documentSettings.signatureY,xKey:'signatureX',yKey:'signatureY'});
      if(importedNode)applySignatureNodeLayout(importedNode,{visible:documentSettings.importedSignatureEnabled && Boolean(importedSignatureAssetState?.dataUrl),scale:documentSettings.importedSignatureScale,x:documentSettings.importedSignatureX,y:documentSettings.importedSignatureY,xKey:'importedSignatureX',yKey:'importedSignatureY'});
      syncSignatureSelectionVisual();
      overlay.querySelectorAll('.sv-vertex-label').forEach((node) => {
        let base = Number(node.dataset.vertexBaseFontSize || 0);
        if (!(base > 0)) {
          const current = Number(node.dataset.baseFontSize || node.getAttribute('font-size') || 0);
          const sourceGlobalScale=Math.max(.55, Number(node.dataset.sourceVertexScale || 1));
          const sourceIndividualScale=Math.max(.45,Math.min(4,Number(node.dataset.individualScale || 1) || 1));
          base = current / (sourceGlobalScale * sourceIndividualScale);
          node.dataset.vertexBaseFontSize = String(base);
        }
        const key=vertexLabelKey(node);
        const vertexVisual=elementVisual('vertices');
        if (base > 0) node.setAttribute('font-size', String((base * Math.max(.55,Math.min(2.5,Number(vertexVisual.scale)||1))).toFixed(3)));
        node.dataset.individualScale='1';
        node.setAttribute('font-weight','600'); node.setAttribute('fill',normalizeHexColor(vertexVisual.color,'#1f2937'));
        node.classList.toggle('is-selected', Boolean(selectedVertexKey && key === selectedVertexKey));
        const offset=documentSettings.vertexLabelOffsets?.[key] || {dx:Number(node.dataset.offsetDx||0)||0,dy:Number(node.dataset.offsetDy||0)||0};
        applyVertexOffset(node,offset.dx,offset.dy);
      });
      renderManualServitudesInOverlay();
      applyTechnicalLineColorsToOverlay();
      applyAreaNameColorsToOverlay();
    }
    function vertexIndexFromKey(key = '') {
      const match = safeText(key).trim().toUpperCase().match(/(\d+)/);
      return match ? Math.max(1, Number(match[1]) || 1) : 0;
    }
    function perimeterPointsFromOverlay() {
      const anchors = Array.from(overlay?.querySelectorAll?.('.sv-confrontante-editor-anchor[data-vertex]') || [])
        .map((anchor) => ({ vertex:Number(anchor.dataset.vertex || 0), x:Number(anchor.getAttribute('cx')), y:Number(anchor.getAttribute('cy')) }))
        .filter((item) => item.vertex > 0 && Number.isFinite(item.x) && Number.isFinite(item.y))
        .sort((a,b) => a.vertex - b.vertex);
      if (anchors.length >= 2) return anchors.map(({x,y}) => ({x,y}));
      const polygon = overlay?.querySelector?.('.sv-document-perimeter-fill,.sv-document-editable-polygon');
      const pointsText = safeText(polygon?.getAttribute?.('points') || '').trim();
      if (!pointsText) return [];
      const points = pointsText.split(/\s+/).map((pair) => pair.split(',').map(Number)).filter((pair) => pair.length === 2 && pair.every(Number.isFinite)).map(([x,y]) => ({ x, y }));
      if (points.length > 2 && Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < 0.001) points.pop();
      return points;
    }
    function polygonCentroid(points = []) {
      if (!Array.isArray(points) || !points.length) return { x:0, y:0 };
      const sum = points.reduce((acc, point) => ({ x:acc.x + Number(point.x || 0), y:acc.y + Number(point.y || 0) }), { x:0, y:0 });
      return { x:sum.x / points.length, y:sum.y / points.length };
    }
    function overlayTopLevelChild(node) {
      if (!overlay || !node) return null;
      let current = node;
      while (current?.parentNode && current.parentNode !== overlay) current = current.parentNode;
      return current?.parentNode === overlay ? current : null;
    }
    function insertOverlayLayer(node, beforeSelector = '') {
      if (!overlay || !node) return false;
      const candidate = beforeSelector ? overlay.querySelector(beforeSelector) : null;
      const before = overlayTopLevelChild(candidate);
      if (before) overlay.insertBefore(node, before);
      else overlay.appendChild(node);
      return true;
    }
    function selectedVertexEdge() {
      const index = vertexIndexFromKey(selectedVertexKey) - 1;
      const points = perimeterPointsFromOverlay();
      if (index < 0 || points.length < 2 || !points[index]) return null;
      const start = points[index], end = points[(index + 1) % points.length];
      const centroid = polygonCentroid(points);
      const mid = { x:(start.x + end.x) / 2, y:(start.y + end.y) / 2 };
      const outwardX = mid.x - centroid.x;
      const outwardY = mid.y - centroid.y;
      const outwardLength = Math.hypot(outwardX, outwardY) || 1;
      return {
        start, end, mid,
        normal:{ x:outwardX / outwardLength, y:outwardY / outwardLength },
        edgeLength:Math.hypot(end.x - start.x, end.y - start.y) || 1
      };
    }
    function highlightCoordinateVertex(vertexKey, isHighlighted) {
      if (!overlay) return;
      if (!vertexKey) {
        overlay.querySelectorAll('.is-table-highlighted').forEach((n) => n.classList.remove('is-table-highlighted'));
        overlay.querySelectorAll('.is-vertex-highlighted').forEach((n) => n.classList.remove('is-vertex-highlighted'));
        return;
      }
      const cleanKey = safeText(vertexKey).trim().toUpperCase();
      const numMatch = cleanKey.match(/(\d+)/);
      const cleanNum = numMatch ? Number(numMatch[1]) : 0;

      overlay.querySelectorAll('.sv-vertex-label').forEach((node) => {
        const k = vertexLabelKey(node);
        const match = k === cleanKey || (cleanNum > 0 && vertexIndexFromKey(k) === cleanNum);
        node.classList.toggle('is-table-highlighted', Boolean(isHighlighted && match));
      });
      overlay.querySelectorAll('.sv-confrontante-editor-anchor, .sv-vertex-anchor').forEach((dot) => {
        const v = Number(dot.dataset.vertex || 0);
        const match = (cleanNum > 0 && v === cleanNum);
        dot.classList.toggle('is-table-highlighted', Boolean(isHighlighted && match));
      });
      overlay.querySelectorAll('.sv-coordinate-table-row').forEach((row) => {
        const rKey = safeText(row.dataset.coordinateVertex).trim().toUpperCase();
        const rNum = Number(row.dataset.vertexIndex || 0);
        const match = rKey === cleanKey || (cleanNum > 0 && rNum === cleanNum);
        row.classList.toggle('is-vertex-highlighted', Boolean(isHighlighted && match));
      });
    }
    function autoOrganizeVertices() {
      if (!overlay) return;
      const perimeterPoints = perimeterPointsFromOverlay();
      const count = perimeterPoints.length;
      if (count < 3) return;
      const centroid = polygonCentroid(perimeterPoints);
      const vertexScale = Math.max(.55, Math.min(2.5, Number(documentSettings.vertexScale || 1)));
      const offsetDist = 14 * vertexScale;
      documentSettings.vertexLabelOffsets = documentSettings.vertexLabelOffsets || {};

      const labels = Array.from(overlay.querySelectorAll('.sv-vertex-label'));
      let moved = 0;
      labels.forEach((node, nodeIdx) => {
        const key = vertexLabelKey(node);
        if (!key) return;
        // Layouts antigos não registravam a origem de cada ajuste. Por segurança,
        // qualquer posição persistida é tratada como manual e não é sobrescrita.
        if (Object.hasOwn(documentSettings.vertexLabelOffsets, key)) return;
        if (editorEngine?.scene?.get?.(`vertex-label:${key}`)?.locked === true) return;
        const nodeDx = Number(node.dataset.offsetDx || 0), nodeDy = Number(node.dataset.offsetDy || 0);
        if (Math.abs(nodeDx) > .01 || Math.abs(nodeDy) > .01) return;
        const explicitIdx = vertexIndexFromKey(key);
        const idx = (explicitIdx > 0 ? explicitIdx - 1 : nodeIdx) % count;
        const P_curr = perimeterPoints[idx];
        const P_prev = perimeterPoints[(idx - 1 + count) % count];
        const P_next = perimeterPoints[(idx + 1) % count];

        const vIn = { x: P_curr.x - P_prev.x, y: P_curr.y - P_prev.y };
        const vOut = { x: P_next.x - P_curr.x, y: P_next.y - P_curr.y };
        const lenIn = Math.hypot(vIn.x, vIn.y) || 1;
        const lenOut = Math.hypot(vOut.x, vOut.y) || 1;
        const uIn = { x: vIn.x / lenIn, y: vIn.y / lenIn };
        const uOut = { x: vOut.x / lenOut, y: vOut.y / lenOut };

        const nIn = { x: -uIn.y, y: uIn.x };
        const nOut = { x: -uOut.y, y: uOut.x };

        let bisector = { x: nIn.x + nOut.x, y: nIn.y + nOut.y };
        let bLen = Math.hypot(bisector.x, bisector.y);
        if (bLen < 0.001) {
          bisector = { x: -uIn.y, y: uIn.x };
          bLen = Math.hypot(bisector.x, bisector.y) || 1;
        }
        bisector = { x: bisector.x / bLen, y: bisector.y / bLen };

        const dot = bisector.x * (P_curr.x - centroid.x) + bisector.y * (P_curr.y - centroid.y);
        if (dot < 0) {
          bisector = { x: -bisector.x, y: -bisector.y };
        }

        const targetX = P_curr.x + bisector.x * offsetDist;
        const targetY = P_curr.y + bisector.y * offsetDist;
        const base = vertexLabelBase(node);
        const dx = targetX - base.x;
        const dy = targetY - base.y;

        documentSettings.vertexLabelOffsets[key] = { dx, dy };
        applyVertexOffset(node, dx, dy);
        const sceneNode = editorEngine?.scene?.get?.(`vertex-label:${key}`);
        if (sceneNode) { sceneNode.data.dx = dx; sceneNode.data.dy = dy; }
        moved += 1;
      });
      return moved;
    }
    function autoOrganizeDimensions() {
      if (!overlay) return 0;
      // As cotas já possuem posição automática no SVG. A rotina anterior zerava
      // offsets manuais (inclusive após salvar/reabrir). Não zerar nem apagar o mapa.
      return 0;
    }
    function autoOrganizeLayout(recordHistory = true) {
      if (!overlay) return false;
      const before = recordHistory ? snapshot() : null;
      const movedVertices = autoOrganizeVertices() || 0;
      autoOrganizeDimensions();
      // Posições e rotações de confrontantes são intocáveis no modo seguro.
      // Uma futura otimização de colisões terá prévia e autorização própria.
      if (!movedVertices) {
        setGuideStatus('Nenhuma posição automática pendente. Seus ajustes de vértices, cotas e confrontantes foram preservados.');
        return false;
      }
      if (recordHistory) recordDocumentAutomation(before, 'Organizar elementos');
      scheduleNativePublish();
      markDirty(true);
      setGuideStatus(`${movedVertices} rótulo(s) de vértice organizado(s). Posições manuais, cotas e confrontantes preservados.`);
      return true;
    }
    function applyRegulatoryPreset(presetName = 'cartorio_incra') {
      if (presetName === 'custom') {
        documentSettings.regulatoryPreset = 'custom';
        syncSettingsControls();
        scheduleNativePublish();
        markDirty(true);
        setGuideStatus('Modo Personalizado (Manual) ativo. Suas preferências visuais foram mantidas.');
        return;
      }
      const targetPreset = ['cartorio_incra', 'seia_cefir', 'comercial', 'reurb'].includes(presetName) ? presetName : 'cartorio_incra';
      const before = snapshot();
      documentSettings.regulatoryPreset = targetPreset;

      if (targetPreset === 'cartorio_incra') {
        documentSettings.vertexScale = 1.0;
        documentSettings.dimensionScale = 1.0;
        documentSettings.dimensionColor = '#0f172a';
        documentSettings.polygonFill = false;
        documentSettings.coordinateTableEnabled = true;
        documentSettings.elementVisuals = {
          ...documentSettings.elementVisuals,
          vertices: { scale: 1.0, color: '#0f172a' },
          cotas: { scale: 1.0, color: '#0f172a' },
          confrontantes: { scale: 1.0, color: '#0f172a' },
          north: { scale: 1.0, color: '#0f172a' },
          grid: { scale: 1.0, color: '#475569' },
          scale: { scale: 1.0, color: '#0f172a' }
        };
        documentSettings.polygonStyles = {
          ...documentSettings.polygonStyles,
          perimeter: { stroke: '#0f172a', strokeWidth: 1.4, fill: '#ffffff', fillOpacity: 0.0 }
        };
      } else if (targetPreset === 'seia_cefir') {
        documentSettings.vertexScale = 1.05;
        documentSettings.dimensionScale = 0.95;
        documentSettings.dimensionColor = '#14532d';
        documentSettings.polygonFill = true;
        documentSettings.coordinateTableEnabled = true;
        documentSettings.elementVisuals = {
          ...documentSettings.elementVisuals,
          vertices: { scale: 1.05, color: '#15803d' },
          cotas: { scale: 0.95, color: '#166534' },
          confrontantes: { scale: 1.0, color: '#14532d' },
          north: { scale: 1.0, color: '#15803d' },
          grid: { scale: 0.85, color: '#166534' },
          scale: { scale: 1.0, color: '#15803d' }
        };
        documentSettings.polygonStyles = {
          ...documentSettings.polygonStyles,
          perimeter: { stroke: '#166534', strokeWidth: 1.5, fill: '#22c55e', fillOpacity: 0.12 }
        };
      } else if (targetPreset === 'comercial') {
        documentSettings.vertexScale = 1.15;
        documentSettings.dimensionScale = 1.05;
        documentSettings.dimensionColor = '#0369a1';
        documentSettings.polygonFill = true;
        documentSettings.elementVisuals = {
          ...documentSettings.elementVisuals,
          vertices: { scale: 1.15, color: '#0284c7' },
          cotas: { scale: 1.05, color: '#0369a1' },
          confrontantes: { scale: 1.1, color: '#0f172a' },
          north: { scale: 1.1, color: '#0284c7' },
          grid: { scale: 0.9, color: '#94a3b8' },
          scale: { scale: 1.05, color: '#0369a1' }
        };
        documentSettings.polygonStyles = {
          ...documentSettings.polygonStyles,
          perimeter: { stroke: '#0284c7', strokeWidth: 1.8, fill: '#38bdf8', fillOpacity: 0.20 }
        };
      } else if (targetPreset === 'reurb') {
        documentSettings.vertexScale = 1.0;
        documentSettings.dimensionScale = 1.0;
        documentSettings.dimensionColor = '#1d4ed8';
        documentSettings.polygonFill = true;
        documentSettings.coordinateTableEnabled = true;
        documentSettings.elementVisuals = {
          ...documentSettings.elementVisuals,
          vertices: { scale: 1.0, color: '#1e40af' },
          cotas: { scale: 1.0, color: '#1d4ed8' },
          confrontantes: { scale: 1.05, color: '#1e3a8a' },
          north: { scale: 1.0, color: '#1e40af' },
          grid: { scale: 0.8, color: '#64748b' },
          scale: { scale: 1.0, color: '#1e40af' }
        };
        documentSettings.polygonStyles = {
          ...documentSettings.polygonStyles,
          perimeter: { stroke: '#1d4ed8', strokeWidth: 1.4, fill: '#60a5fa', fillOpacity: 0.10 }
        };
      }

      // Perfil visual não é autorização para mover vértices, cotas ou confrontantes.
      syncSettingsControls();
      recordDocumentAutomation(before, `Aplicar perfil ${targetPreset}`);
      scheduleNativePublish();
      markDirty(true);
      const presetLabels = {
        cartorio_incra: 'INCRA / Cartório',
        seia_cefir: 'SEIA / CEFIR Bahia',
        comercial: 'Comercial / Executivo',
        reurb: 'REURB / Regularização Fundiária'
      };
      setGuideStatus(`Perfil "${presetLabels[targetPreset] || targetPreset}" aplicado sem mover os elementos da prancha.`);
    }
    function vertexAutoLineId(key = '') {
      const normalized=safeText(key).trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');
      return normalized ? `vertex-auto-line-${normalized.toLowerCase()}` : '';
    }
    function isVertexAutoLine(item) {
      return safeText(item?.id).startsWith('vertex-auto-line-');
    }
    function vertexAutoLineForKey(key = '') {
      const id=vertexAutoLineId(key);
      return id ? (documentSettings.technicalLines||[]).find((item)=>safeText(item?.id)===id) || null : null;
    }
    function vertexAutoLineGeometry(key = '') {
      const index=vertexIndexFromKey(key)-1;
      const points=perimeterPointsFromOverlay();
      if(index<0||points.length<2||!points[index])return null;
      const start=points[index],centroid=polygonCentroid(points);
      const dx=start.x-centroid.x,dy=start.y-centroid.y,length=Math.hypot(dx,dy)||1;
      const frame=geometryFrameFromOverlay();
      const extension=Math.max(34,Math.min(140,Math.min(frame.w,frame.h)*.16));
      return {x1:start.x,y1:start.y,x2:start.x+(dx/length)*extension,y2:start.y+(dy/length)*extension};
    }
    function toggleVertexAutoLine(key = '', enabled = true) {
      const id=vertexAutoLineId(key); if(!id)return false;
      const existing=vertexAutoLineForKey(key);
      if(!enabled){
        if(!existing)return false;
        safeCheckpoint('remover linha automática de vértice');
        documentSettings=normalizeDocumentSettings({...documentSettings,technicalLines:(documentSettings.technicalLines||[]).filter((item)=>safeText(item?.id)!==id)});
        clearSelectedLine(); renderTechnicalLinePreview(); scheduleNativePublish(); markDirty(true); return true;
      }
      if(existing)return false;
      const geometry=vertexAutoLineGeometry(key); if(!geometry)return false;
      safeCheckpoint('adicionar linha automática de vértice');
      const item={id,coordinateSpace:'geometry-v1'};
      setTechnicalLineAbsolute(item,geometry);
      documentSettings=normalizeDocumentSettings({...documentSettings,technicalLines:[...(documentSettings.technicalLines||[]),item]});
      renderTechnicalLinePreview(); scheduleNativePublish(); markDirty(true); return true;
    }
    function segmentForVertexKey(key = '') {
      const index = vertexIndexFromKey(key);
      if (!index) return null;
      return draftSegments.find((segment) => Number(segment?.startVertex || 0) == index)
        || draftSegments.find((segment) => Array.isArray(segment?.segmentIndexes) && segment.segmentIndexes.includes(index - 1))
        || draftSegments.find((segment) => Number(segment?.startVertex || 0) <= index && Number(segment?.endVertex || 0) >= index)
        || null;
    }
    function syncVertexGuideControls() {
      const list = modal?.querySelector?.('[data-vertex-guide-list]');
      const counter = modal?.querySelector?.('[data-vertex-count-label]');
      if (!list) return;
      const total = Math.max(0, vertexCountFromOverlay(overlay));
      if (counter) counter.textContent = `${total} vértice${total === 1 ? '' : 's'} detectado${total === 1 ? '' : 's'}`;
      list.innerHTML = '';
      Array.from({ length: total }, (_, index) => index + 1).forEach((vertexNumber) => {
        const key = `V-${String(vertexNumber).padStart(2,'0')}`;
        const row = document.createElement('label');
        row.className = 'sv-editor-vertex-guide-row';
        row.title = `Selecionar lado ${key} → V-${String((vertexNumber % Math.max(total,1)) + 1).padStart(2,'0')}`;
        row.innerHTML = `<strong>${key}</strong><input type="checkbox" data-vertex-guide-toggle="${vertexNumber}" ${vertexAutoLineForKey(key) ? 'checked' : ''}>`;
        list.appendChild(row);
      });
      list.querySelectorAll('[data-vertex-guide-toggle]').forEach((input) => {
        input.addEventListener('change', (event) => {
          const vertexNumber = Number(event.target.getAttribute('data-vertex-guide-toggle') || 0);
          const key = vertexNumber ? `V-${String(vertexNumber).padStart(2,'0')}` : '';
          const enabled=Boolean(event.target.checked);
          toggleVertexAutoLine(key,enabled);
          selectedVertexKey = enabled ? key : (selectedVertexKey===key ? '' : selectedVertexKey);
          const segment = selectedVertexKey ? segmentForVertexKey(selectedVertexKey) : null;
          if (segment) selectedSegmentId = segment.id;
          syncSelectedVertexControls();
        });
      });
    }
    function syncSelectedVertexControls() {
      syncVertexGuideControls();
    }
    function selectedDimensionNode() {
      if (!selectedDimensionKey || !overlay) return null;
      return Array.from(overlay.querySelectorAll('.sv-cad-dimension')).find((node)=>dimensionLabelKey(node)===selectedDimensionKey) || null;
    }
    function selectDimensionLabel(key = '') {
      selectedDimensionKey=safeText(key).trim();
      overlay?.querySelectorAll?.('.sv-cad-dimension').forEach((node)=>node.classList.toggle('is-selected',Boolean(selectedDimensionKey&&dimensionLabelKey(node)===selectedDimensionKey)));
      syncSelectedDimensionControls();
    }
    function syncSelectedDimensionControls() {
      const node=selectedDimensionNode();
      const wrap=modal?.querySelector('[data-selected-dimension-controls]');
      const range=modal?.querySelector('[data-selected-dimension-scale]');
      const out=modal?.querySelector('[data-selected-dimension-scale-output]');
      const label=modal?.querySelector('[data-selected-dimension-label]');
      const active=Boolean(node);
      const scale=active?Math.max(0,Math.min(5,Number(documentSettings.dimensionLabelScales?.[selectedDimensionKey] ?? 1) || 0)):1;
      if(wrap)wrap.hidden=!active;
      if(label) label.textContent=active?`Cota selecionada: ${safeText(node.textContent).trim()}`:'';
      if(range){range.disabled=!active;range.value=String(scale);}
      if(out)out.textContent=active?`${Math.round(scale*100)}%`:'—';
    }
    function selectedAreaName(){const list=Array.isArray(documentSettings.areaNames)?documentSettings.areaNames:[];const item=list.find((entry)=>entry.id===selectedAreaNameId)||list[0]||null;if(item)selectedAreaNameId=item.id;return item;}
    function areaNameContextMenu(){return modal?.querySelector?.('[data-area-name-context-menu]')||null;}
    function hideAreaNameContextMenu(){const menu=areaNameContextMenu();if(!menu)return;menu.hidden=true;menu.dataset.areaNameId='';}
    function syncAreaNameContextRotation(){const menu=areaNameContextMenu(),item=selectedAreaName();if(!menu)return;const range=menu.querySelector('[data-area-name-context-rotation]'),out=menu.querySelector('[data-area-name-context-rotation-output]');const value=Math.max(-180,Math.min(180,Number(item?.rotation||0)||0));if(range)range.value=String(value);if(out)out.textContent=`${Math.round(value)}°`;}
    function syncAreaNameContextScale(){const menu=areaNameContextMenu(),item=selectedAreaName();if(!menu)return;const range=menu.querySelector('[data-area-name-context-scale]'),out=menu.querySelector('[data-area-name-context-scale-output]');const value=Math.round(Math.max(.5,Math.min(3,Number(item?.scale||1)||1))*100);if(range)range.value=String(value);if(out)out.textContent=`${value}%`;}
    function showAreaNameContextMenu(clientX,clientY,areaId=''){const menu=areaNameContextMenu();if(!menu)return;if(areaId){selectedAreaNameId=safeText(areaId).trim();menu.dataset.areaNameId=selectedAreaNameId;syncAreaControls();}syncAreaNameContextRotation();syncAreaNameContextScale();menu.hidden=false;const margin=10;requestAnimationFrame(()=>{const rect=menu.getBoundingClientRect(),vw=window.innerWidth||0,vh=window.innerHeight||0;const left=Math.min(Math.max(margin,Number(clientX)||0),Math.max(margin,vw-rect.width-margin));const top=Math.min(Math.max(margin,Number(clientY)||0),Math.max(margin,vh-rect.height-margin));menu.style.left=`${left}px`;menu.style.top=`${top}px`;});}
    function confrontanteContextMenu(){return modal?.querySelector?.('[data-confrontante-context-menu]')||null;}
    function hideConfrontanteContextMenu(){const menu=confrontanteContextMenu();if(!menu)return;menu.hidden=true;menu.dataset.segmentId='';}
    function syncConfrontanteContextRotation(){const menu=confrontanteContextMenu();if(!menu)return;const segment=segmentById(menu.dataset.segmentId||selectedSegmentId),range=menu.querySelector('[data-confrontante-context-rotation]'),out=menu.querySelector('[data-confrontante-context-rotation-output]');const value=Math.max(-180,Math.min(180,Number(segment?.labelRotation||0)||0));if(range)range.value=String(value);if(out)out.textContent=`${Math.round(value)}°`;}
    function syncConfrontanteContextScale(){const menu=confrontanteContextMenu();if(!menu)return;const segment=segmentById(menu.dataset.segmentId||selectedSegmentId),range=menu.querySelector('[data-confrontante-context-scale]'),out=menu.querySelector('[data-confrontante-context-scale-output]');const value=Math.round(Math.max(.2,Math.min(4,Number(segment?.labelScale||1)||1))*100);if(range)range.value=String(value);if(out)out.textContent=`${value}%`;}
    function syncConfrontanteContextColor(){const menu=confrontanteContextMenu();if(!menu)return;const segment=segmentById(menu.dataset.segmentId||selectedSegmentId),input=menu.querySelector('[data-confrontante-context-color]');if(input)input.value=segmentFontColor(segment,elementVisual('confrontantes').color);}
    function showConfrontanteContextMenu(clientX,clientY,segmentId=''){const menu=confrontanteContextMenu();if(!menu)return;const id=safeText(segmentId).trim();const segment=segmentById(id);if(!segment)return;selectedSegmentId=id;menu.dataset.segmentId=id;selectSegmentRow(id);syncConfrontanteContextRotation();syncConfrontanteContextScale();syncConfrontanteContextColor();menu.hidden=false;const margin=10;requestAnimationFrame(()=>{const rect=menu.getBoundingClientRect(),vw=window.innerWidth||0,vh=window.innerHeight||0;const left=Math.min(Math.max(margin,Number(clientX)||0),Math.max(margin,vw-rect.width-margin));const top=Math.min(Math.max(margin,Number(clientY)||0),Math.max(margin,vh-rect.height-margin));menu.style.left=`${left}px`;menu.style.top=`${top}px`;});}
    function polygonNodeAtContextEvent(event){
      const direct=event?.target?.closest?.('.sv-document-editable-polygon,.sv-document-perimeter-fill,.sv-document-polygon-outline');
      if(direct)return direct;
      const point=svgPoint(overlay,event);
      if(!point)return null;
      const nodes=Array.from(overlay?.querySelectorAll?.('.sv-document-editable-polygon,.sv-document-perimeter-fill')||[]).reverse();
      const domPoint=typeof DOMPoint==='function'?new DOMPoint(point.x,point.y):null;
      for(const node of nodes){
        if(domPoint&&typeof node.isPointInFill==='function'){
          try{if(node.isPointInFill(domPoint))return node;}catch(_error){}
        }
        try{const box=node.getBBox?.();if(box&&point.x>=box.x&&point.x<=box.x+box.width&&point.y>=box.y&&point.y<=box.y+box.height)return node;}catch(_error){}
      }
      return null;
    }
    function polygonContextMenu(){return modal?.querySelector?.('[data-polygon-context-menu]')||null;}
    function hidePolygonContextMenu(){const menu=polygonContextMenu();if(!menu)return;menu.hidden=true;menu.dataset.polygonKey='';}
    function polygonContextItem(){const menu=polygonContextMenu(),key=safeText(menu?.dataset?.polygonKey||'').trim();return editablePolygonInventory().find((item)=>item.key===key)||null;}
    function syncPolygonContextMenu(){const menu=polygonContextMenu(),item=polygonContextItem();if(!menu||!item)return;const style=polygonStyleForNode(item);const strokeColor=menu.querySelector('[data-polygon-context-stroke-color]'),fillColor=menu.querySelector('[data-polygon-context-fill-color]'),width=menu.querySelector('[data-polygon-context-stroke-width]'),widthOut=menu.querySelector('[data-polygon-context-stroke-width-output]'),opacity=menu.querySelector('[data-polygon-context-opacity]'),opacityOut=menu.querySelector('[data-polygon-context-opacity-output]');if(strokeColor)strokeColor.value=style.strokeColor;if(fillColor)fillColor.value=style.fillColor;const widthValue=Math.round(style.strokeWidth*100);if(width)width.value=String(widthValue);if(widthOut)widthOut.textContent=`${widthValue}%`;const opacityValue=Math.round(style.opacity*100);if(opacity)opacity.value=String(opacityValue);if(opacityOut)opacityOut.textContent=`${opacityValue}%`;}
    function showPolygonContextMenu(clientX,clientY,key=''){const menu=polygonContextMenu();if(!menu)return;const id=safeText(key).trim();if(!editablePolygonInventory().some((item)=>item.key===id))return;menu.dataset.polygonKey=id;syncPolygonContextMenu();menu.hidden=false;const margin=10;requestAnimationFrame(()=>{const rect=menu.getBoundingClientRect(),vw=window.innerWidth||0,vh=window.innerHeight||0;const left=Math.min(Math.max(margin,Number(clientX)||0),Math.max(margin,vw-rect.width-margin));const top=Math.min(Math.max(margin,Number(clientY)||0),Math.max(margin,vh-rect.height-margin));menu.style.left=`${left}px`;menu.style.top=`${top}px`;});}
    function mapFrameFromOverlay() {
      const metadata = overlay?.querySelector?.('.sv-document-map-metadata');
      const fromData = metadata ? {
        x:Number(metadata.dataset.mapX),
        y:Number(metadata.dataset.mapY),
        w:Number(metadata.dataset.mapW),
        h:Number(metadata.dataset.mapH)
      } : null;
      if (fromData && [fromData.x,fromData.y,fromData.w,fromData.h].every(Number.isFinite) && fromData.w > 0 && fromData.h > 0) return fromData;
      const polygon = overlay?.querySelector?.('.sv-document-perimeter-fill');
      try {
        const box=polygon?.getBBox?.();
        if(box && box.width>0 && box.height>0) return {x:box.x,y:box.y,w:box.width,h:box.height};
      } catch (_error) {}
      const dims=svgViewBoxSize(overlay);
      return {x:0,y:0,w:Math.max(1,Number(dims.width)||1),h:Math.max(1,Number(dims.height)||1)};
    }
    function geometryFrameFromOverlay() {
      const metadata = overlay?.querySelector?.('.sv-document-map-metadata');
      const fromData = metadata ? {
        x:Number(metadata.dataset.geomX),
        y:Number(metadata.dataset.geomY),
        w:Number(metadata.dataset.geomW),
        h:Number(metadata.dataset.geomH)
      } : null;
      if (fromData && [fromData.x,fromData.y,fromData.w,fromData.h].every(Number.isFinite) && fromData.w > 0 && fromData.h > 0) return fromData;
      const polygon = overlay?.querySelector?.('.sv-document-perimeter-fill');
      try {
        const box=polygon?.getBBox?.();
        if(box && box.width>0 && box.height>0) return {x:box.x,y:box.y,w:box.width,h:box.height};
      } catch (_error) {}
      return mapFrameFromOverlay();
    }
    function selectedManualServitude(){
      const list=Array.isArray(documentSettings.manualServitudes)?documentSettings.manualServitudes:[];
      const item=list.find((entry)=>entry.id===selectedManualServitudeId)||list[0]||null;
      if(item)selectedManualServitudeId=item.id;
      return item;
    }
    function technicalLineById(id='') {
      return (Array.isArray(documentSettings.technicalLines)?documentSettings.technicalLines:[]).find((item)=>safeText(item?.id)===safeText(id)) || null;
    }
    function technicalLineAbsolute(item) {
      if(!item)return null;
      const geom=geometryFrameFromOverlay(),frame=mapFrameFromOverlay();
      const geometrySpace=item.coordinateSpace==='geometry-v1'&&[item.x1G,item.y1G,item.x2G,item.y2G].every((value)=>Number.isFinite(Number(value)));
      const mapSpace=[item.x1N,item.y1N,item.x2N,item.y2N].every((value)=>Number.isFinite(Number(value)));
      if(geometrySpace)return{x1:geom.x+Number(item.x1G)*geom.w,y1:geom.y+Number(item.y1G)*geom.h,x2:geom.x+Number(item.x2G)*geom.w,y2:geom.y+Number(item.y2G)*geom.h};
      if(mapSpace)return{x1:frame.x+Number(item.x1N)*frame.w,y1:frame.y+Number(item.y1N)*frame.h,x2:frame.x+Number(item.x2N)*frame.w,y2:frame.y+Number(item.y2N)*frame.h};
      return null;
    }
    function setTechnicalLineAbsolute(item,state) {
      if(!item||!state)return;
      const geom=geometryFrameFromOverlay(),frame=mapFrameFromOverlay();
      if(!(geom.w>0&&geom.h>0&&frame.w>0&&frame.h>0))return;
      item.coordinateSpace='geometry-v1';
      item.x1G=(Number(state.x1)-geom.x)/geom.w; item.y1G=(Number(state.y1)-geom.y)/geom.h;
      item.x2G=(Number(state.x2)-geom.x)/geom.w; item.y2G=(Number(state.y2)-geom.y)/geom.h;
      item.x1N=(Number(state.x1)-frame.x)/frame.w; item.y1N=(Number(state.y1)-frame.y)/frame.h;
      item.x2N=(Number(state.x2)-frame.x)/frame.w; item.y2N=(Number(state.y2)-frame.y)/frame.h;
    }
    function promoteTechnicalLinesToGeometrySpace() {
      (Array.isArray(documentSettings.technicalLines)?documentSettings.technicalLines:[]).forEach((item)=>{const absolute=technicalLineAbsolute(item);if(absolute)setTechnicalLineAbsolute(item,absolute);});
      documentSettings=normalizeDocumentSettings(documentSettings);
    }
    function migrateLegacyGeneralLines(segments=[]) {
      const legacy=(Array.isArray(segments)?segments:[]).find((item)=>safeText(item?.id)==='__linhas-gerais__');
      if(!legacy||!Array.isArray(legacy.extraLines)||!legacy.extraLines.length)return;
      const materialized=materializeProjectSegmentForOverlay(legacy);
      const current=Array.isArray(documentSettings.technicalLines)?documentSettings.technicalLines:[];
      const ids=new Set(current.map((item)=>safeText(item?.id)));
      const migrated=[];
      (Array.isArray(materialized?.extraLines)?materialized.extraLines:[]).forEach((line,index)=>{
        const id=safeText(line?.id||`linha-legada-${index+1}`); if(ids.has(id))return;
        const state={x1:Number(line?.x1),y1:Number(line?.y1),x2:Number(line?.x2),y2:Number(line?.y2)};
        if(!Object.values(state).every(Number.isFinite))return;
        const item={id,coordinateSpace:'geometry-v1'};setTechnicalLineAbsolute(item,state);migrated.push(item);ids.add(id);
      });
      if(migrated.length)documentSettings=normalizeDocumentSettings({...documentSettings,technicalLines:[...current,...migrated]});
    }

    function servitudeGeometry(item, geom = geometryFrameFromOverlay()) {
      if(!item || !geom)return null;
      return window.SurveyorTechnicalMapBridge?.manualServitudeGeometry?.(item,geom) || null;
    }
    function pointToGeometry(point, geom = geometryFrameFromOverlay()) {
      if(!point||!geom||!(geom.w>0&&geom.h>0))return null;
      return {xG:(Number(point.x)-geom.x)/geom.w,yG:(Number(point.y)-geom.y)/geom.h};
    }
    function servitudePath(points){
      if(!Array.isArray(points)||points.length<2)return '';
      return points.map((point,index)=>`${index?'L':'M'} ${Number(point.x).toFixed(2)} ${Number(point.y).toFixed(2)}`).join(' ');
    }
    function setManualServitudeStatus(text=''){
      const node=modal?.querySelector?.('[data-servitude-status]'); if(node)node.textContent=text;
    }
    function appendManualServitudePoint(point,{silentStatus=false}={}){
      if(!servitudeDrawState||!point)return false;
      const last=servitudeDrawState.points.at(-1);
      if(last&&Math.hypot(Number(point.x)-Number(last.x),Number(point.y)-Number(last.y))<2){
        if(!silentStatus)setManualServitudeStatus('Marque o próximo ponto um pouco mais distante.');
        return false;
      }
      if(servitudeDrawState.points.length>=80){
        if(!silentStatus){
          setManualServitudeStatus('Limite de 80 pontos atingido. Finalize o traçado atual.');
          syncManualServitudeControls();
        }
        return false;
      }
      servitudeDrawState.points.push({x:Number(point.x),y:Number(point.y)});
      renderManualServitudeTemp(servitudeDrawState.points,servitudeDrawState.widthG||.04);
      syncManualServitudeControls();
      if(!silentStatus){
        setManualServitudeStatus(servitudeDrawState.points.length===1?'Primeiro ponto marcado. Continue clicando ao longo do eixo da servidão.':`${servitudeDrawState.points.length} pontos marcados. Continue o traçado ou finalize com duplo clique.`);
      }
      return true;
    }
    function clearManualServitudeTemp(){ overlay?.querySelectorAll?.('.sv-editor-servitude-temp').forEach((node)=>node.remove()); }
    function renderManualServitudeTemp(points,widthG,hoverPoint=null){
      clearManualServitudeTemp(); if(!overlay||!Array.isArray(points)||!points.length)return;
      const geom=geometryFrameFromOverlay(), preview=[...points];
      if(hoverPoint){const last=preview[preview.length-1];if(!last||Math.hypot(Number(hoverPoint.x)-Number(last.x),Number(hoverPoint.y)-Number(last.y))>1)preview.push(hoverPoint);}
      if(preview.length<2)return;
      const pointsG=preview.map((point)=>pointToGeometry(point,geom)).filter(Boolean);if(pointsG.length<2)return;
      const g=servitudeGeometry({coordinateSpace:'geometry-v1',pointsG,widthG},geom); if(!g)return;
      const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g'); group.setAttribute('class','sv-editor-servitude-temp');
      [g.left,g.right].forEach((pointsLine)=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',servitudePath(pointsLine));path.setAttribute('fill','none');group.appendChild(path);});
      points.forEach((point)=>{const mark=document.createElementNS(ns,'circle');mark.setAttribute('class','sv-editor-servitude-temp-point');mark.setAttribute('cx',Number(point.x).toFixed(2));mark.setAttribute('cy',Number(point.y).toFixed(2));mark.setAttribute('r','3');group.appendChild(mark);});
      overlay.appendChild(group);
    }
    function renderManualServitudesInOverlay(){
      if(!overlay)return;
      overlay.querySelectorAll('.sv-document-manual-servitude').forEach((node)=>node.remove());
      const geom=geometryFrameFromOverlay(),ns='http://www.w3.org/2000/svg';
      const beforeSelector='.sv-confrontante-callout,.sv-area-name-label,.sv-vertex-label,[data-document-signature],[data-document-imported-signature]';
      (documentSettings.manualServitudes||[]).forEach((item)=>{
        const g=servitudeGeometry(item,geom); if(!g)return;
        const group=document.createElementNS(ns,'g'); group.setAttribute('class','sv-document-manual-servitude'); group.dataset.servitudeId=item.id; group.dataset.coordinateSpace='geometry-v1'; group.dataset.pointsG=JSON.stringify(item.pointsG||[]); group.dataset.widthG=String(g.widthG);
        group.dataset.geomX=String(geom.x);group.dataset.geomY=String(geom.y);group.dataset.geomW=String(geom.w);group.dataset.geomH=String(geom.h);
        const path=(className,points)=>{const node=document.createElementNS(ns,'path');node.setAttribute('class',className);node.setAttribute('d',servitudePath(points));node.setAttribute('fill','none');node.setAttribute('stroke','#f97316');node.setAttribute('stroke-width','1.55');node.setAttribute('stroke-linecap','butt');node.setAttribute('stroke-linejoin','round');node.setAttribute('vector-effect','non-scaling-stroke');group.appendChild(node);return node;};
        path('sv-document-manual-servitude-line',g.left);path('sv-document-manual-servitude-line',g.right);
        const hit=path('sv-editor-servitude-hitbox',g.centerline);hit.removeAttribute('stroke');hit.removeAttribute('stroke-width');
        const center=path('sv-editor-servitude-center',g.centerline);center.removeAttribute('stroke');center.removeAttribute('stroke-width');
        (g.controlPoints||[]).forEach((point,index)=>{const h=document.createElementNS(ns,'circle');h.setAttribute('class','sv-editor-servitude-handle');h.dataset.servitudePoint=String(index);h.setAttribute('cx',Number(point.x).toFixed(2));h.setAttribute('cy',Number(point.y).toFixed(2));h.setAttribute('r','4.5');group.appendChild(h);});
        group.classList.toggle('is-selected',item.id===selectedManualServitudeId);
        insertOverlayLayer(group,beforeSelector);
      });
    }
    function syncManualServitudeControls(){
      const list=documentSettings.manualServitudes||[];
      if(list.length && !list.some((entry)=>entry.id===selectedManualServitudeId)) selectedManualServitudeId=list[0].id;
      if(!list.length) selectedManualServitudeId='';
      const item=selectedManualServitude(),select=modal?.querySelector('[data-servitude-select]'),width=modal?.querySelector('[data-servitude-width]'),out=modal?.querySelector('[data-servitude-width-output]'),remove=modal?.querySelector('[data-editor-action="delete-servitude"]'),draw=modal?.querySelector('[data-editor-action="draw-servitude"]'),finish=modal?.querySelector('[data-editor-action="finish-servitude"]');
      if(select){select.innerHTML=list.length?list.map((entry,index)=>`<option value="${escapeHtml(entry.id)}">Servidão ${index+1} · ${Math.max(2,entry.pointsG?.length||2)} pontos</option>`).join(''):'<option value="">Nenhuma servidão</option>';select.value=item?.id||'';select.disabled=!item;}
      if(width){width.value=String(Math.round((item?.widthG||servitudeDrawState?.widthG||.04)*1000)/10);width.disabled=!item&&!servitudeDrawState;}
      if(out)out.textContent=`${((item?.widthG||servitudeDrawState?.widthG||.04)*100).toFixed(1)}%`;
      if(remove)remove.disabled=!item;
      if(draw){const drawing=Boolean(servitudeDrawState);draw.classList.toggle('primary',drawing);draw.setAttribute('title',drawing?'Cancelar desenho':'Desenhar servidão');draw.setAttribute('aria-label',drawing?'Cancelar desenho':'Desenhar servidão');draw.setAttribute('aria-pressed',drawing?'true':'false');}
      if(finish){finish.hidden=!servitudeDrawState;finish.disabled=!servitudeDrawState||servitudeDrawState.points.length<2;}
      overlay?.querySelectorAll?.('.sv-document-manual-servitude').forEach((node)=>node.classList.toggle('is-selected',node.dataset.servitudeId===item?.id));
    }
    function cancelManualServitudeDrawing(message='Desenho da servidão cancelado.'){
      servitudeDrawState=null;clearManualServitudeTemp();overlay?.classList?.remove('is-servitude-draw-mode');syncManualServitudeControls();if(message)setManualServitudeStatus(message);
    }
    function startManualServitudeDrawing(){
      if(servitudeDrawState)return cancelManualServitudeDrawing();
      servitudeDrawState={points:[],widthG:selectedManualServitude()?.widthG||.04};
      overlay?.classList?.add('is-servitude-draw-mode');syncManualServitudeControls();setManualServitudeStatus('Marque o eixo ponto a ponto. Use pelo menos 2 pontos; com 3 ou mais o traçado é suavizado automaticamente. Finalize com duplo clique ou pela ação do painel.');
    }
    function finishManualServitudeDrawing(){
      if(!servitudeDrawState)return;
      if(servitudeDrawState.points.length<2){setManualServitudeStatus('Marque pelo menos dois pontos antes de finalizar a servidão.');return;}
      const geom=geometryFrameFromOverlay(),pointsG=servitudeDrawState.points.map((point)=>pointToGeometry(point,geom)).filter(Boolean);
      if(pointsG.length<2)return;
      checkpoint();
      const id=`servidao-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
      const created={id,coordinateSpace:'geometry-v1',pointsG,widthG:servitudeDrawState.widthG||.04};
      documentSettings=normalizeDocumentSettings({...documentSettings,manualServitudes:[...(documentSettings.manualServitudes||[]),created]});
      selectedManualServitudeId=id;servitudeDrawState=null;clearManualServitudeTemp();overlay?.classList?.remove('is-servitude-draw-mode');renderManualServitudesInOverlay();syncManualServitudeControls();scheduleNativePublish();markDirty(true);setManualServitudeStatus(pointsG.length>2?'Servidão criada e suavizada automaticamente. Os pontos de controle continuam editáveis.':'Servidão reta criada. Adicione 3 ou mais pontos em um novo traçado para formar curvas automáticas.');
    }
    function deleteManualServitude(){
      const item=selectedManualServitude();if(!item)return;
      checkpoint();documentSettings.manualServitudes=(documentSettings.manualServitudes||[]).filter((entry)=>entry.id!==item.id);selectedManualServitudeId=documentSettings.manualServitudes?.[0]?.id||'';renderManualServitudesInOverlay();syncManualServitudeControls();scheduleNativePublish();markDirty(true);setManualServitudeStatus('Servidão removida. Use Desfazer para restaurar.');
    }
    function attachManualServitudeInteractions(svg){
      if(!svg)return()=>{};let drag=null;
      const down=(event)=>{
        if(servitudeDrawState){
          const point=svgPoint(svg,event);if(!point)return;event.preventDefault();event.stopImmediatePropagation();
          appendManualServitudePoint(point);return;
        }
        const group=event.target?.closest?.('.sv-document-manual-servitude');if(!group||!svg.contains(group))return;
        const item=(documentSettings.manualServitudes||[]).find((entry)=>entry.id===group.dataset.servitudeId);if(!item)return;
        selectedManualServitudeId=item.id;syncManualServitudeControls();
        const handle=event.target?.closest?.('.sv-editor-servitude-handle'),point=svgPoint(svg,event);if(!point)return;
        const isMovable=Boolean(handle||event.target?.closest?.('.sv-editor-servitude-hitbox,.sv-document-manual-servitude-line,.sv-editor-servitude-center'));if(!isMovable)return;
        checkpoint();event.preventDefault();event.stopImmediatePropagation();
        drag={pointerId:event.pointerId,id:item.id,pointIndex:handle?Number(handle.dataset.servitudePoint):-1,start:{x:point.x,y:point.y},originalPoints:(item.pointsG||[]).map((entry)=>({xG:Number(entry.xG),yG:Number(entry.yG)})),geom:geometryFrameFromOverlay()};
        try{svg.setPointerCapture?.(event.pointerId);}catch(_error){}
      };
      const move=(event)=>{
        if(servitudeDrawState?.points?.length){const point=svgPoint(svg,event);if(point)renderManualServitudeTemp(servitudeDrawState.points,servitudeDrawState.widthG||.04,point);return;}
        if(!drag||event.pointerId!==drag.pointerId)return;const point=svgPoint(svg,event);if(!point)return;event.preventDefault();
        const item=(documentSettings.manualServitudes||[]).find((entry)=>entry.id===drag.id);if(!item)return;const g=pointToGeometry(point,drag.geom);if(!g)return;
        if(drag.pointIndex>=0 && item.pointsG?.[drag.pointIndex]){item.pointsG[drag.pointIndex]={xG:g.xG,yG:g.yG};}else{const dx=(point.x-drag.start.x)/drag.geom.w,dy=(point.y-drag.start.y)/drag.geom.h;item.pointsG=drag.originalPoints.map((entry)=>({xG:entry.xG+dx,yG:entry.yG+dy}));}
        renderManualServitudesInOverlay();
      applyTechnicalLineColorsToOverlay();
      applyAreaNameColorsToOverlay();
      };
      const finish=(event)=>{if(!drag||(event.pointerId!=null&&event.pointerId!==drag.pointerId))return;try{svg.releasePointerCapture?.(event.pointerId);}catch(_error){}drag=null;renderManualServitudesInOverlay();syncManualServitudeControls();scheduleNativePublish();markDirty(true);setManualServitudeStatus('Traçado da servidão ajustado e suavizado.');};
      const dbl=(event)=>{
        if(!servitudeDrawState)return;
        const point=svgPoint(svg,event);if(!point)return;
        event.preventDefault();event.stopImmediatePropagation();
        appendManualServitudePoint(point,{silentStatus:true});
        if(servitudeDrawState?.points?.length>=2) finishManualServitudeDrawing();
        else setManualServitudeStatus('Marque pelo menos dois pontos antes de finalizar a servidão.');
      };
      svg.addEventListener('pointerdown',down,true);svg.addEventListener('pointermove',move,true);svg.addEventListener('pointerup',finish,true);svg.addEventListener('pointercancel',finish,true);svg.addEventListener('dblclick',dbl,true);
      return()=>{svg.removeEventListener('pointerdown',down,true);svg.removeEventListener('pointermove',move,true);svg.removeEventListener('pointerup',finish,true);svg.removeEventListener('pointercancel',finish,true);svg.removeEventListener('dblclick',dbl,true);};
    }
    function syncAreaControls(){const item=selectedAreaName(),select=modal?.querySelector('[data-area-name-select]'),input=modal?.querySelector('[data-area-name-input]'),scale=modal?.querySelector('[data-document-setting="areaNameScale"]'),scaleOut=modal?.querySelector('[data-area-name-scale-output]'),rotation=modal?.querySelector('[data-document-setting="areaNameRotation"]'),rotationOut=modal?.querySelector('[data-area-name-rotation-output]'),color=modal?.querySelector('[data-document-setting="areaNameColor"]'),remove=modal?.querySelector('[data-editor-action="remove-area-name"]');if(select){const list=documentSettings.areaNames||[];select.innerHTML=list.length?list.map((entry,index)=>`<option value="${safeText(entry.id).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${safeText(entry.text||`Nome ${index+1}`).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join(''):'<option value="">Nenhum nome adicionado</option>';select.value=item?.id||'';select.disabled=!item;}if(input){input.value=item?.text||'';input.disabled=false;input.placeholder=item?'Ex.: Gleba A':'Digite o nome para criar automaticamente';}if(scale){scale.value=String(item?.scale??1);scale.disabled=!item;}if(scaleOut)scaleOut.textContent=`${Math.round((item?.scale??1)*100)}%`;if(rotation){rotation.value=String(item?.rotation??0);rotation.disabled=!item;}if(rotationOut)rotationOut.textContent=`${Math.round(item?.rotation??0)}°`;if(color){color.value=normalizeHexColor(item?.color||documentSettings.areaNameColor,'#111827');color.disabled=!item;}if(remove)remove.disabled=!item;overlay?.querySelectorAll?.('.sv-area-name-label').forEach((node)=>node.classList.toggle('is-selected',node.dataset.areaNameId===item?.id));}
    function syncSettingsControls(){
      const range=modal?.querySelector('[data-document-setting="vertexScale"]'),out=modal?.querySelector('[data-vertex-scale-output]'),fill=modal?.querySelector('[data-document-setting="polygonFill"]'),areaNameColor=modal?.querySelector('[data-document-setting="globalAreaNameColor"]'),technicalLineColor=modal?.querySelector('[data-document-setting="technicalLineColor"]'),dimensionWrap=modal?.querySelector('[data-dimension-controls]'),dimensionScale=modal?.querySelector('[data-document-setting="dimensionScale"]'),dimensionScaleOutput=modal?.querySelector('[data-dimension-scale-output]'),dimensionColor=modal?.querySelector('[data-document-setting="dimensionColor"]'),dimensionButton=modal?.querySelector('[data-editor-tool="dimensions"]'),dimensionHint=modal?.querySelector('[data-dimension-unavailable]'),tableEnabled=modal?.querySelector('[data-document-setting="coordinateTableEnabled"]'),tableRows=modal?.querySelector('[data-document-setting="coordinateTableRows"]'),tableRowsOutput=modal?.querySelector('[data-coordinate-table-rows-output]'),tableScale=modal?.querySelector('[data-document-setting="coordinateTableScale"]'),tableScaleOutput=modal?.querySelector('[data-coordinate-table-scale-output]'),tableHint=modal?.querySelector('[data-coordinate-table-hint]'),signatureEnabled=modal?.querySelector('[data-document-setting="signatureEnabled"]'),importedSignatureEnabled=modal?.querySelector('[data-document-setting="importedSignatureEnabled"]'),signatureScale=modal?.querySelector('[data-document-setting="signatureScale"]'),signatureScaleOutput=modal?.querySelector('[data-signature-scale-output]'),signatureStatus=modal?.querySelector('[data-signature-status]'),importedSignatureName=modal?.querySelector('[data-imported-signature-name]'),removeImportedSignature=modal?.querySelector('[data-editor-action="remove-imported-signature"]'),miniMapKind=modal?.querySelector('[data-document-setting="miniMapKind"]'),miniMapOpacity=modal?.querySelector('[data-document-setting="miniMapOpacity"]'),miniMapOpacityOutput=modal?.querySelector('[data-mini-map-opacity-output]'),miniMapPerimeterVisible=modal?.querySelector('[data-document-setting="miniMapPerimeterVisible"]');
      const maxTableRows=coordinateTableMaxRows();
      modal?.querySelectorAll?.('[data-coordinate-table-dependent]').forEach((node)=>{node.hidden=documentSettings.coordinateTableEnabled!==true;});
      modal?.querySelectorAll?.('[data-area-name-dependent]').forEach((node)=>{node.hidden=!(documentSettings.areaNames||[]).length;});
      const dimensionsAvailable=Boolean(overlay?.querySelector?.('.sv-cad-dimension'));
      if(documentSettings.coordinateTableRows>maxTableRows) documentSettings.coordinateTableRows=maxTableRows;
      if(range)range.value=String(documentSettings.vertexScale);
      if(out)out.textContent=`${Math.round(documentSettings.vertexScale*100)}%`;
      if(fill)fill.checked=documentSettings.polygonFill;
      if(dimensionWrap)dimensionWrap.hidden=!dimensionsAvailable;
      if(dimensionScale){dimensionScale.value=String(Number(documentSettings.dimensionScale ?? 1));dimensionScale.disabled=!dimensionsAvailable;}
      if(dimensionScaleOutput)dimensionScaleOutput.textContent=`${Math.round(Number(documentSettings.dimensionScale ?? 1)*100)}%`;
      if(dimensionColor){dimensionColor.value=normalizeHexColor(documentSettings.dimensionColor,'#111827');dimensionColor.disabled=!dimensionsAvailable;}
      if(dimensionButton){dimensionButton.hidden=!dimensionsAvailable;dimensionButton.disabled=!dimensionsAvailable;dimensionButton.setAttribute('aria-hidden',dimensionsAvailable?'false':'true');}
      if(dimensionHint)dimensionHint.hidden=dimensionsAvailable;
      if(!dimensionsAvailable && activeToolPanel==='dimensions') setActiveToolPanel('appearance');
      if(tableEnabled)tableEnabled.checked=documentSettings.coordinateTableEnabled;
      if(tableRows){tableRows.min='1';tableRows.max=String(maxTableRows);tableRows.value=String(Math.max(1,Math.min(maxTableRows,documentSettings.coordinateTableRows)));tableRows.disabled=!documentSettings.coordinateTableEnabled||maxTableRows<=0;}
      if(tableRowsOutput)tableRowsOutput.textContent=`${Math.max(1,Math.min(maxTableRows,documentSettings.coordinateTableRows))}/${maxTableRows}`;
      if(tableScale)tableScale.value=String(documentSettings.coordinateTableScale||1);
      if(tableScale) tableScale.disabled=!documentSettings.coordinateTableEnabled;
      if(tableScaleOutput)tableScaleOutput.textContent=`${Math.round((documentSettings.coordinateTableScale||1)*100)}%`;
      if(tableHint)tableHint.textContent='Arraste a tabela direto na prancha para reposicionar e use o quadrinho azul no canto para redimensionar.';
      if(signatureEnabled)signatureEnabled.checked=documentSettings.signatureEnabled;
      if(importedSignatureEnabled)importedSignatureEnabled.checked=documentSettings.importedSignatureEnabled;
      const currentSignatureMode=activeSignatureMode();
      const currentSignatureScale=activeSignatureScale();
      if(signatureScale)signatureScale.value=String(currentSignatureScale);
      if(signatureScaleOutput)signatureScaleOutput.textContent=currentSignatureMode==='none'?'—':`${Math.round(currentSignatureScale*100)}%`;
      if(importedSignatureName)importedSignatureName.textContent=importedSignatureAssetState?.name||'Nenhuma assinatura importada';
      if(removeImportedSignature)removeImportedSignature.disabled=!importedSignatureAssetState?.dataUrl;
      if(areaNameColor)areaNameColor.value=normalizeHexColor(documentSettings.areaNameColor,'#111827');
      if(technicalLineColor)technicalLineColor.value=normalizeHexColor(documentSettings.technicalLineColor,'#111827');
      if(miniMapKind)miniMapKind.value=documentSettings.miniMapKind;
      if(miniMapOpacity)miniMapOpacity.value=String(documentSettings.miniMapOpacity);
      if(miniMapOpacityOutput)miniMapOpacityOutput.textContent=`${Math.round(documentSettings.miniMapOpacity*100)}%`;
      if(miniMapPerimeterVisible)miniMapPerimeterVisible.checked=documentSettings.miniMapPerimeterVisible!==false;
      const presetSelect=modal?.querySelector('[data-document-setting="regulatoryPreset"]');
      if(presetSelect) presetSelect.value=documentSettings.regulatoryPreset||'custom';
      modal?.querySelectorAll?.('[data-element-visual-key]').forEach((control)=>{
        const key=safeText(control.dataset.elementVisualKey).trim();const visual=elementVisual(key);
        if(control.dataset.elementVisualScale!=null)control.value=String(Number(visual.scale||1).toFixed(2));
        if(control.dataset.elementVisualColor!=null)control.value=normalizeHexColor(visual.color,ELEMENT_VISUAL_DEFAULTS[key]?.color||'#111827');
      });
      if(signatureStatus){const signatureNode=overlay?.querySelector?.('[data-document-signature]');const accountAvailable=Boolean(signatureNodeValue(signatureNode)),importedAvailable=Boolean(importedSignatureAssetState?.dataUrl),mode=activeSignatureMode();signatureStatus.textContent=mode==='imported'?'Assinatura importada selecionada. Arraste-a diretamente na prancha.':mode==='account'?'Assinatura da conta selecionada. Arraste-a diretamente na prancha.':(accountAvailable||importedAvailable?'Clique diretamente em uma assinatura na prancha para selecioná-la.':'Nenhuma assinatura disponível.');if(signatureEnabled)signatureEnabled.disabled=!accountAvailable;if(importedSignatureEnabled)importedSignatureEnabled.disabled=!importedAvailable;if(signatureScale)signatureScale.disabled=mode==='none';}
      applyDocumentSettingsToOverlay();syncAreaNameLabels();syncAreaControls();syncManualServitudeControls();syncSelectedVertexControls();syncSelectedDimensionControls();renderPolygonAppearanceList();applyLiveElementState();syncRangeProgress(modal);
    }
    function syncAreaNameLabels(){
      if(!overlay)return;
      const frame=mapFrameFromOverlay(),geom=geometryFrameFromOverlay(),polygon=overlay.querySelector('.sv-document-perimeter-fill');
      let defaultX=geom.x+geom.w/2,defaultY=geom.y+geom.h/2;
      try{const box=polygon?.getBBox?.();if(box&&box.width>0&&box.height>0){defaultX=box.x+box.width/2;defaultY=box.y+box.height/2;}}catch(_error){}
      const ns='http://www.w3.org/2000/svg',wanted=new Set();
      (documentSettings.areaNames||[]).forEach((item,index)=>{
        wanted.add(item.id);
        let group=Array.from(overlay.querySelectorAll('.sv-area-name-label')).find((node)=>node.dataset.areaNameId===item.id);
        if(!group){group=document.createElementNS(ns,'g');group.setAttribute('class','sv-area-name-label');group.dataset.areaNameId=item.id;overlay.appendChild(group);}
        const geometrySpace=item.coordinateSpace==='geometry-v1'&&Number.isFinite(Number(item.xG))&&Number.isFinite(Number(item.yG));
        const x=geometrySpace?geom.x+Number(item.xG)*geom.w:(Number.isFinite(item.x)?frame.x+item.x*frame.w:defaultX+index*18);
        const y=geometrySpace?geom.y+Number(item.yG)*geom.h:(Number.isFinite(item.y)?frame.y+item.y*frame.h:defaultY+index*18);
        Object.assign(group.dataset,{coordinateSpace:geometrySpace?'geometry-v1':'',mapX:String(frame.x),mapY:String(frame.y),mapW:String(frame.w),mapH:String(frame.h),geomX:String(geom.x),geomY:String(geom.y),geomW:String(geom.w),geomH:String(geom.h),x:String(x),y:String(y),areaNameId:item.id});
        group.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${item.rotation.toFixed(2)}) scale(${item.scale.toFixed(3)})`);
        group.replaceChildren();
        const hit=document.createElementNS(ns,'rect');hit.setAttribute('class','sv-area-name-hitbox');hit.setAttribute('x','-120');hit.setAttribute('y','-18');hit.setAttribute('width','240');hit.setAttribute('height','36');hit.setAttribute('rx','6');group.appendChild(hit);
        const color=normalizeHexColor(item?.color||documentSettings.areaNameColor,'#111827');group.dataset.areaNameColor=color;
        const text=document.createElementNS(ns,'text');text.setAttribute('class','sv-area-name-text');text.setAttribute('x','0');text.setAttribute('y','5');text.setAttribute('text-anchor','middle');text.setAttribute('font-size','19');text.setAttribute('font-weight','800');text.setAttribute('fill',color);text.setAttribute('paint-order','stroke fill');text.setAttribute('stroke',contrastHaloColor(color));text.setAttribute('stroke-width','3');text.textContent=item.text;group.appendChild(text);
      });
      overlay.querySelectorAll('.sv-area-name-label').forEach((node)=>{if(!wanted.has(node.dataset.areaNameId||''))node.remove();});
    }
    function promoteAreaNamesToGeometrySpace() {
      if (!overlay || !(documentSettings.areaNames || []).length) return;
      const frame=mapFrameFromOverlay(),geom=geometryFrameFromOverlay();
      documentSettings.areaNames=(documentSettings.areaNames||[]).map((item,index)=>{
        const group=Array.from(overlay.querySelectorAll('.sv-area-name-label')).find((node)=>node.dataset.areaNameId===item.id);
        const fallbackX=Number.isFinite(item.x)?frame.x+item.x*frame.w:geom.x+geom.w/2+index*18;
        const fallbackY=Number.isFinite(item.y)?frame.y+item.y*frame.h:geom.y+geom.h/2+index*18;
        const px=Number.isFinite(Number(group?.dataset?.x))?Number(group.dataset.x):fallbackX;
        const py=Number.isFinite(Number(group?.dataset?.y))?Number(group.dataset.y):fallbackY;
        return {...item,coordinateSpace:'geometry-v1',x:(px-frame.x)/frame.w,y:(py-frame.y)/frame.h,xG:(px-geom.x)/geom.w,yG:(py-geom.y)/geom.h};
      });
      documentSettings=normalizeDocumentSettings(documentSettings);
    }
    function inferAreaNamesFromOverlay() {
      if (!overlay || (documentSettings.areaNames || []).length) return;
      const frame = mapFrameFromOverlay();
      const geom = geometryFrameFromOverlay();
      const inferred = Array.from(overlay.querySelectorAll('.sv-area-name-label')).map((group, index) => {
        const text = safeText(group.querySelector('.sv-area-name-text')?.textContent || group.textContent || '').trim();
        if (!text) return null;
        const x = Number(group.dataset.x), y = Number(group.dataset.y);
        const id = safeText(group.dataset.areaNameId || `area-${index + 1}`).trim() || `area-${index + 1}`;
        const transform = safeText(group.getAttribute('transform'));
        const scaleMatch = transform.match(/scale\(([-+]?\d*\.?\d+)/i);
        const rotateMatch = transform.match(/rotate\(([-+]?\d*\.?\d+)/i);
        const xG = Number.isFinite(x) && geom.w > 0 ? (x - geom.x) / geom.w : null;
        const yG = Number.isFinite(y) && geom.h > 0 ? (y - geom.y) / geom.h : null;
        return {
          id, text,
          coordinateSpace:Number.isFinite(xG)&&Number.isFinite(yG)?'geometry-v1':'',
          x: Number.isFinite(x) && frame.w > 0 ? Math.max(0, Math.min(1, (x - frame.x) / frame.w)) : null,
          y: Number.isFinite(y) && frame.h > 0 ? Math.max(0, Math.min(1, (y - frame.y) / frame.h)) : null,
          xG, yG,
          scale: Math.max(.5, Math.min(3, Number(scaleMatch?.[1] || 1) || 1)),
          rotation: Math.max(-180, Math.min(180, Number(rotateMatch?.[1] || 0) || 0)),
          color: normalizeHexColor(group.dataset.areaNameColor || group.querySelector('.sv-area-name-text')?.getAttribute('fill') || documentSettings.areaNameColor, normalizeHexColor(documentSettings.areaNameColor,'#111827'))
        };
      }).filter(Boolean);
      if (!inferred.length) return;
      documentSettings = normalizeDocumentSettings({ ...documentSettings, areaNames: inferred });
      selectedAreaNameId = inferred[0].id;
    }

    function selectVertexLabel(key = '') {
      selectedVertexKey=safeText(key).trim().toUpperCase();
      overlay?.querySelectorAll?.('.sv-vertex-label').forEach((node)=>node.classList.toggle('is-selected',vertexLabelKey(node)===selectedVertexKey));
      syncSelectedVertexControls();
    }
    function syncConfrontanteFromEngineNode(sceneNode) {
      const id=safeText(sceneNode?.data?.segmentId || '').trim();
      if(!id)return;
      const segment=segmentById(id);
      if(!segment)return;
      segment.labelDx=Number(sceneNode.data.dx)||0;
      segment.labelDy=Number(sceneNode.data.dy)||0;
      segmentsDirty=true;
    }
    function ensureEngineConfrontanteNode(group) {
      if(!editorEngine||!group)return null;
      const id=safeText(group.dataset.segmentId||group.dataset.labelKey||'').trim();
      if(!id)return null;
      const nodeId=`confrontante:${id}`;
      let node=editorEngine.scene.get(nodeId);
      if(!node){
        node=editorEngine.addNode({id:nodeId,type:'confrontante-label',data:{segmentId:id,dx:Number(group.dataset.dx||0)||0,dy:Number(group.dataset.dy||0)||0}});
      }
      return node;
    }

    function setActiveToolPanel(name = '') {
      if (!modal) return;
      const requested=safeText(name).trim();
      if (servitudeDrawState && requested !== 'servitudes' && requested !== 'map') cancelManualServitudeDrawing('');
      if (guideState && requested !== 'lines' && requested !== 'map') cancelGuideMode('');
      if (editLinesActive && requested !== 'lines' && requested !== 'map') {
        editLinesActive = false;
        clearSelectedLine();
        renderAllGuidePreviews();
        updateLineEditControls();
      }
      const drawer=modal.querySelector('[data-tool-drawer]');
      const current=modal.querySelector(`[data-tool-panel="${requested}"]`);
      if(!requested || !current){
        activeToolPanel = '';
        if (servitudeDrawState) cancelManualServitudeDrawing('');
        if (guideState) cancelGuideMode('');
        if (editLinesActive) {
          editLinesActive = false;
          clearSelectedLine();
          renderAllGuidePreviews();
          updateLineEditControls();
        }
        drawer?.classList.remove('open');
        modal.querySelectorAll('[data-editor-tool]').forEach((button)=>button.classList.remove('active'));
        return;
      }
      activeToolPanel=requested;
      const mapTool=INLINE_MAP_TOOLS.has(requested);
      if(mapTool) modal.dataset.lastMapTool=requested;
      drawer?.classList.add('open');
      const titles={zoom:'Visualização',sheet:'Prancha',map:'Mapa',elements:'Elementos',names:'Nomes no mapa',vertices:'Vértices',lines:'Linhas',servitudes:'Servidões',confrontantes:'Confrontantes',appearance:'Aparência',dimensions:'Editar cotas',signature:'Assinatura',history:'Histórico'};
      const title=modal.querySelector('[data-tool-title]'); if(title)title.textContent=titles[requested]||'Ferramentas';
      modal.querySelectorAll('[data-tool-panel]').forEach((panel)=>{const active=panel.dataset.toolPanel===requested;panel.hidden=!active;panel.classList.toggle('active',active);});
      modal.querySelectorAll('[data-editor-tool]').forEach((button)=>{
        const tool=safeText(button.dataset.editorTool).trim();
        button.classList.toggle('active',tool===requested || (tool==='map' && mapTool));
      });
      const mapNav=modal.querySelector('[data-map-tool-nav]');
      if(mapNav) mapNav.hidden=!mapTool;
      const dimensionsEditable = requested === 'dimensions' || requested === 'map';
      overlay?.classList?.toggle('is-dimension-edit-mode',dimensionsEditable);
      overlay?.querySelectorAll?.('.sv-cad-dimension').forEach((node)=>{ node.style.cursor = dimensionsEditable ? 'move' : ''; });
      if(dimensionsEditable)syncSelectedDimensionControls();
      if(requested==='signature'){
        const status=modal.querySelector('[data-signature-status]');
        if(status && !signatureNodeValue(overlay?.querySelector?.('[data-document-signature]'))) status.textContent='Verificando assinatura cadastrada...';
        void hydrateSignatureFromAccount({force:true}).then(()=>{ if(modal && activeToolPanel==='signature') syncSettingsControls(); });
      }
      if(requested==='names' && !(documentSettings.areaNames||[]).length){
        const input=modal.querySelector('[data-area-name-input]');
        setTimeout(()=>input?.focus?.(),0);
      }
    }

    // O texto das abas do editor deve existir no DOM, não só no ::after CSS.
    // Os títulos de ferramentas adicionadas dinamicamente são incluídos aqui também.
    function mountInlineToolCaptions() {
      if (presentationMode !== 'inline' || !modal) return;
      modal.querySelectorAll('.sv-editor-tool-rail .sv-editor-tool-button').forEach((button) => {
        const label = safeText(button.getAttribute('aria-label') || button.title).trim();
        if (!label) return;
        let caption = button.querySelector('.sv-editor-tool-caption');
        if (!caption) {
          caption = document.createElement('span');
          caption.className = 'sv-editor-tool-caption';
          button.appendChild(caption);
        }
        caption.textContent = label;
      });
    }

    function mountStandardInlineNavigation() {
      if (presentationMode !== 'inline' || !modal) return;
      const page = safeText(document.body?.dataset?.page || '');
      if (!['planialtimetria.html','perimetros.html','loteamentos-reurb.html'].includes(page)) return;
      if (modal.dataset.standardInlineNavigation === '1') return;
      const rail = modal.querySelector('.sv-editor-tool-rail');
      const drawer = modal.querySelector('[data-tool-drawer]');
      if (!rail || !drawer) return;
      const makeButton = (tool,title) => {
        let button = rail.querySelector(`[data-editor-tool="${tool}"]`);
        if (!button) {
          button = document.createElement('button');
          button.type='button';
          button.className='sv-editor-tool-button';
          button.dataset.editorTool=tool;
          rail.appendChild(button);
        }
        button.title=title;
        button.setAttribute('aria-label',title);
        return button;
      };
      const zoomPanel=drawer.querySelector('[data-tool-panel="zoom"]');
      let sheetPanel=drawer.querySelector('[data-tool-panel="sheet"]');
      if (!sheetPanel) {
        sheetPanel=document.createElement('div');
        sheetPanel.className='sv-editor-tool-panel';
        sheetPanel.dataset.toolPanel='sheet';
        if (zoomPanel) while (zoomPanel.firstChild) sheetPanel.appendChild(zoomPanel.firstChild);
        drawer.appendChild(sheetPanel);
      }
      zoomPanel?.remove();
      rail.querySelector('[data-editor-tool="zoom"]')?.remove();
      const mapPanel=document.createElement('div');
      mapPanel.className='sv-editor-tool-panel sv-editor-map-panel';
      mapPanel.dataset.toolPanel='map';
      mapPanel.hidden=true;
      const titles={vertices:'Vértices',confrontantes:'Confrontantes',lines:'Linhas técnicas',servitudes:'Servidões',dimensions:'Cotas'};
      ['vertices','confrontantes','lines','servitudes','dimensions'].forEach((tool)=>{
        const source=drawer.querySelector(`[data-tool-panel="${tool}"]`);
        if(!source)return;
        const section=document.createElement('section');
        section.className='sv-editor-map-section';
        section.dataset.mapSection=tool;
        const head=document.createElement('div');
        head.className='sv-editor-map-section-head';
        head.innerHTML=`<strong>${titles[tool]}</strong>`;
        const body=document.createElement('div');
        body.className='sv-editor-map-section-body';
        while(source.firstChild)body.appendChild(source.firstChild);
        body.querySelectorAll('.sv-editor-tool-label').forEach((node)=>node.remove());
        section.append(head,body);mapPanel.appendChild(section);source.remove();
        rail.querySelector(`[data-editor-tool="${tool}"]`)?.remove();
      });
      drawer.appendChild(mapPanel);
      rail.querySelector('[data-editor-tool="history"]')?.remove();
      drawer.querySelector('[data-tool-panel="history"]')?.remove();
      const sheetButton=makeButton('sheet','Prancha');
      const mapButton=makeButton('map','Mapa');
      const appearanceButton=makeButton('appearance','Aparência');
      const signatureButton=makeButton('signature','Assinatura');
      rail.replaceChildren(sheetButton,mapButton,appearanceButton,signatureButton);
      modal.dataset.standardInlineNavigation='1';
      setActiveToolPanel('sheet');
    }

    function attachStableConfrontanteDrag(svg) {
      if (!svg) return () => {};
      let drag=null, pendingMove=null, moveFrame=0;
      const down=(event)=>{
        const group=event.target?.closest?.('.sv-confrontante-callout');
        if(!group || !svg.contains(group) || svg.classList.contains('is-guide-mode') || svg.classList.contains('is-line-edit-mode')) return;
        const segmentId=safeText(group.dataset.segmentId||group.dataset.labelKey||'').trim(); if(!segmentId)return;
        const point=svgPoint(svg,event); if(!point)return;
        const segment=segmentById(segmentId); if(!segment)return;
        event.preventDefault(); event.stopPropagation();
        selectSegmentRow(segmentId);
        group.classList.add('is-dragging','is-selected');
        const label=group.querySelector('.sv-confrontante-label'); if(label){label.style.opacity='1';label.style.visibility='visible';label.removeAttribute('display');}
        drag={pointerId:event.pointerId,segmentId,group,point,startDx:Number(group.dataset.dx||segment.labelDx||0)||0,startDy:Number(group.dataset.dy||segment.labelDy||0)||0,before:editorEngine?.scene?.snapshot?.()||null};
        try{svg.setPointerCapture?.(event.pointerId);}catch(_error){}
      };
      const applyMove=(position)=>{
        if (!drag || position.pointerId !== drag.pointerId) return;
        const point=svgPoint(svg,position); if(!point)return;
        const mw=Math.max(1,Number(drag.group.dataset.mapW||0)||1),mh=Math.max(1,Number(drag.group.dataset.mapH||0)||1);
        const dx=Math.max(-mw,Math.min(mw,drag.startDx+point.x-drag.point.x));
        const dy=Math.max(-mh,Math.min(mh,drag.startDy+point.y-drag.point.y));
        applyOffsetDirect(drag.group,dx,dy);
        const segment=segmentById(drag.segmentId); if(segment){segment.labelDx=dx;segment.labelDy=dy;segmentsDirty=true;}
      };
      const move=(event)=>{
        if(!drag || event.pointerId!==drag.pointerId)return;
        event.preventDefault();
        // O getScreenCTM e o recálculo do SVG são síncronos. Apenas a última
        // posição recebida em cada frame deve redesenhar o rótulo.
        pendingMove={clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId};
        if(!moveFrame) moveFrame=requestAnimationFrame(()=>{
          moveFrame=0;
          const position=pendingMove; pendingMove=null;
          if(position) applyMove(position);
        });
      };
      const finish=(event)=>{
        if(!drag || (event.pointerId!=null && event.pointerId!==drag.pointerId))return;
        if(moveFrame){cancelAnimationFrame(moveFrame);moveFrame=0;}
        if(event?.type==='pointerup') applyMove(event);
        else if(pendingMove) applyMove(pendingMove);
        pendingMove=null;
        const current=drag; drag=null; current.group.classList.remove('is-dragging');
        const dx=Number(current.group.dataset.dx||0)||0,dy=Number(current.group.dataset.dy||0)||0;
        const node=editorEngine?.scene?.get?.(`confrontante:${current.segmentId}`);
        if(node){node.data.dx=dx;node.data.dy=dy;const after=editorEngine.scene.snapshot?.();if(current.before&&after&&JSON.stringify(current.before)!==JSON.stringify(after))editorEngine.commitSnapshot(current.before,after,'Mover confrontante');}
        updateHistoryControls();
      };
      svg.addEventListener('pointerdown',down,true); svg.addEventListener('pointermove',move,true); svg.addEventListener('pointerup',finish,true); svg.addEventListener('pointercancel',finish,true);
      return ()=>{if(moveFrame)cancelAnimationFrame(moveFrame);pendingMove=null;drag=null;svg.removeEventListener('pointerdown',down,true); svg.removeEventListener('pointermove',move,true); svg.removeEventListener('pointerup',finish,true); svg.removeEventListener('pointercancel',finish,true);};
    }

    function attachStableAreaNameDrag(svg) {
      if (!svg) return () => {};
      let drag=null;
      const down=(event)=>{
        const group=event.target?.closest?.('.sv-area-name-label');
        if(!group || !svg.contains(group) || svg.classList.contains('is-guide-mode') || svg.classList.contains('is-line-edit-mode')) return;
        const id=safeText(group.dataset.areaNameId||'').trim();
        const item=(documentSettings.areaNames||[]).find((entry)=>entry.id===id);
        if(!item)return;
        const point=svgPoint(svg,event); if(!point)return;
        const frame=mapFrameFromOverlay(),geom=geometryFrameFromOverlay();
        const geometrySpace=item.coordinateSpace==='geometry-v1'&&Number.isFinite(Number(item.xG))&&Number.isFinite(Number(item.yG));
        const startX=geometrySpace?geom.x+Number(item.xG)*geom.w:(Number.isFinite(item.x)?frame.x+item.x*frame.w:Number(group.dataset.x||frame.x+frame.w/2));
        const startY=geometrySpace?geom.y+Number(item.yG)*geom.h:(Number.isFinite(item.y)?frame.y+item.y*frame.h:Number(group.dataset.y||frame.y+frame.h/2));
        event.preventDefault(); event.stopPropagation();
        selectedAreaNameId=id; syncAreaControls();
        group.classList.add('is-dragging','is-selected');
        drag={pointerId:event.pointerId,id,item,group,point,startX,startY,frame,geom,before:editorEngine?.scene?.snapshot?.()||null};
        try{svg.setPointerCapture?.(event.pointerId);}catch(_error){}
      };
      const move=(event)=>{
        if(!drag || event.pointerId!==drag.pointerId)return;
        const point=svgPoint(svg,event); if(!point)return;
        event.preventDefault();
        const x=Math.max(drag.frame.x,Math.min(drag.frame.x+drag.frame.w,drag.startX+point.x-drag.point.x));
        const y=Math.max(drag.frame.y,Math.min(drag.frame.y+drag.frame.h,drag.startY+point.y-drag.point.y));
        drag.item.coordinateSpace='geometry-v1';
        drag.item.x=(x-drag.frame.x)/drag.frame.w; drag.item.y=(y-drag.frame.y)/drag.frame.h;
        drag.item.xG=(x-drag.geom.x)/drag.geom.w; drag.item.yG=(y-drag.geom.y)/drag.geom.h;
        drag.group.dataset.coordinateSpace='geometry-v1'; drag.group.dataset.x=String(x); drag.group.dataset.y=String(y);
        drag.group.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${Number(drag.item.rotation||0).toFixed(2)}) scale(${Number(drag.item.scale||1).toFixed(3)})`);
        const node=editorEngine?.scene?.get?.(`document-area-name:${drag.id}`); if(node){node.data.x=x;node.data.y=y;}
      };
      const finish=(event)=>{
        if(!drag || (event.pointerId!=null && event.pointerId!==drag.pointerId))return;
        const current=drag; drag=null; current.group.classList.remove('is-dragging');
        const after=editorEngine?.scene?.snapshot?.();
        if(current.before&&after&&JSON.stringify(current.before)!==JSON.stringify(after))editorEngine.commitSnapshot(current.before,after,'Mover nome no mapa');
        updateHistoryControls(); syncAreaControls();
      };
      svg.addEventListener('pointerdown',down,true); svg.addEventListener('pointermove',move,true); svg.addEventListener('pointerup',finish,true); svg.addEventListener('pointercancel',finish,true);
      return ()=>{svg.removeEventListener('pointerdown',down,true);svg.removeEventListener('pointermove',move,true);svg.removeEventListener('pointerup',finish,true);svg.removeEventListener('pointercancel',finish,true);};
    }

    function attachStableVertexLabelDrag(svg) {
      if (!svg) return () => {};
      let drag=null;
      const down=(event)=>{
        const node=event.target?.closest?.('.sv-vertex-label');
        if(!node || !svg.contains(node) || svg.classList.contains('is-guide-mode') || svg.classList.contains('is-line-edit-mode'))return;
        const key=vertexLabelKey(node); if(!key)return;
        const point=svgPoint(svg,event); if(!point)return;
        const current=documentSettings.vertexLabelOffsets?.[key]||{dx:Number(node.dataset.offsetDx||0)||0,dy:Number(node.dataset.offsetDy||0)||0};
        event.preventDefault(); event.stopPropagation(); selectVertexLabel(key); node.classList.add('is-dragging');
        drag={pointerId:event.pointerId,key,node,point,startDx:Number(current.dx)||0,startDy:Number(current.dy)||0,before:editorEngine?.scene?.snapshot?.()||null};
        try{svg.setPointerCapture?.(event.pointerId);}catch(_error){}
      };
      const move=(event)=>{
        if(!drag || event.pointerId!==drag.pointerId)return;
        const point=svgPoint(svg,event); if(!point)return; event.preventDefault();
        const dx=drag.startDx+point.x-drag.point.x,dy=drag.startDy+point.y-drag.point.y;
        documentSettings.vertexLabelOffsets||={}; documentSettings.vertexLabelOffsets[drag.key]={dx,dy}; applyVertexOffset(drag.node,dx,dy);
        const sceneNode=editorEngine?.scene?.get?.(`vertex-label:${drag.key}`); if(sceneNode){sceneNode.data.dx=dx;sceneNode.data.dy=dy;}
      };
      const finish=(event)=>{
        if(!drag || (event.pointerId!=null && event.pointerId!==drag.pointerId))return;
        const current=drag; drag=null; current.node.classList.remove('is-dragging');
        const after=editorEngine?.scene?.snapshot?.();
        if(current.before&&after&&JSON.stringify(current.before)!==JSON.stringify(after))editorEngine.commitSnapshot(current.before,after,'Mover rótulo de vértice');
        updateHistoryControls(); syncSelectedVertexControls();
      };
      svg.addEventListener('pointerdown',down,true); svg.addEventListener('pointermove',move,true); svg.addEventListener('pointerup',finish,true); svg.addEventListener('pointercancel',finish,true);
      return ()=>{svg.removeEventListener('pointerdown',down,true);svg.removeEventListener('pointermove',move,true);svg.removeEventListener('pointerup',finish,true);svg.removeEventListener('pointercancel',finish,true);};
    }

    function attachStableDimensionDrag(svg) {
      if (!svg) return () => {};
      let drag = null;
      const down = (event) => {
        if (activeToolPanel !== 'dimensions' && activeToolPanel !== 'map') return;
        const node = event.target?.closest?.('.sv-cad-dimension');
        if (!node || !svg.contains(node) || svg.classList.contains('is-guide-mode') || svg.classList.contains('is-line-edit-mode')) return;
        const point = svgPoint(svg, event); if (!point) return;
        const key=dimensionLabelKey(node);if(!key)return;
        selectDimensionLabel(key);
        const viewBox = svg.viewBox?.baseVal;
        const vx = Number(viewBox?.x || 0), vy = Number(viewBox?.y || 0), vw = Math.max(1, Number(viewBox?.width || svg.getAttribute('width') || 1600) || 1600), vh = Math.max(1, Number(viewBox?.height || svg.getAttribute('height') || 1000) || 1000);
        const base = dimensionLabelBase(node);
        const current={dx:Number(node.dataset.offsetDx||0)||0,dy:Number(node.dataset.offsetDy||0)||0};
        safeCheckpoint('mover cota');
        node.classList.add('is-dragging');
        drag = { pointerId:event.pointerId, point, vx, vy, vw, vh, base, startDx:current.dx, startDy:current.dy, node, key };
        event.preventDefault(); event.stopPropagation();
        try { svg.setPointerCapture?.(event.pointerId); } catch (_error) {}
      };
      const move = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const point = svgPoint(svg, event); if (!point) return;
        const bbox = (()=>{ try { return drag.node.getBBox?.(); } catch (_error) { return null; } })();
        const width = Math.max(10, Number(bbox?.width || 10) || 10), height = Math.max(10, Number(bbox?.height || 10) || 10);
        const x = Math.max(drag.vx + width/2, Math.min(drag.vx + drag.vw - width/2, drag.base.x + drag.startDx + point.x - drag.point.x));
        const y = Math.max(drag.vy + height/2, Math.min(drag.vy + drag.vh - height/2, drag.base.y + drag.startDy + point.y - drag.point.y));
        const dx = x - drag.base.x, dy = y - drag.base.y;
        documentSettings.dimensionLabelOffsets ||= {};
        documentSettings.dimensionLabelOffsets[drag.key] = { dx, dy };
        applyDimensionOffset(drag.node, dx, dy);
        event.preventDefault();
      };
      const finish = (event) => {
        if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
        drag.node.classList.remove('is-dragging');
        drag = null;
        updateHistoryControls();
      };
      svg.addEventListener('pointerdown', down, true); svg.addEventListener('pointermove', move, true); svg.addEventListener('pointerup', finish, true); svg.addEventListener('pointercancel', finish, true);
      return () => { svg.removeEventListener('pointerdown', down, true); svg.removeEventListener('pointermove', move, true); svg.removeEventListener('pointerup', finish, true); svg.removeEventListener('pointercancel', finish, true); };
    }

    function attachStableSignatureDrag(svg) {
      if (!svg) return () => {};
      let drag = null;
      const down = (event) => {
        const node = event.target?.closest?.('[data-document-signature],[data-document-imported-signature]');
        const imported=Boolean(node?.hasAttribute?.('data-document-imported-signature'));
        const enabled=imported?documentSettings.importedSignatureEnabled:documentSettings.signatureEnabled;
        if (!node || !svg.contains(node) || !enabled || !signatureNodeValue(node) || svg.classList.contains('is-guide-mode') || svg.classList.contains('is-line-edit-mode')) return;
        selectedSignatureMode=imported?'imported':'account';syncSignatureSelectionVisual();syncSettingsControls();
        const point = svgPoint(svg, event); if (!point) return;
        const viewBox = svg.viewBox?.baseVal;
        const vx = Number(viewBox?.x || 0), vy = Number(viewBox?.y || 0), vw = Math.max(1, Number(viewBox?.width || svg.getAttribute('width') || 1600) || 1600), vh = Math.max(1, Number(viewBox?.height || svg.getAttribute('height') || 1000) || 1000);
        const startX = Number(node.dataset.currentAnchorX || node.dataset.anchorX || 0) || (vx + vw / 2);
        const startY = Number(node.dataset.currentAnchorY || node.dataset.anchorY || 0) || (vy + vh / 2);
        safeCheckpoint('mover assinatura');
        drag = { pointerId:event.pointerId, point, vx, vy, vw, vh, startX, startY, node, imported };
        node.classList.add('is-dragging');
        event.preventDefault(); event.stopPropagation();
        try { svg.setPointerCapture?.(event.pointerId); } catch (_error) {}
      };
      const move = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const point = svgPoint(svg, event); if (!point) return;
        const baseWidth = Number(drag.node.dataset.baseWidth || drag.node.getAttribute('width') || 120) || 120;
        const baseHeight = Number(drag.node.dataset.baseHeight || drag.node.getAttribute('height') || 34) || 34;
        const scale=drag.imported?documentSettings.importedSignatureScale:documentSettings.signatureScale;
        const width = baseWidth * scale, height = baseHeight * scale;
        const x = Math.max(drag.vx + width / 2, Math.min(drag.vx + drag.vw - width / 2, drag.startX + point.x - drag.point.x));
        const y = Math.max(drag.vy + height, Math.min(drag.vy + drag.vh, drag.startY + point.y - drag.point.y));
        if(drag.imported){documentSettings.importedSignatureX=(x-drag.vx)/drag.vw;documentSettings.importedSignatureY=(y-drag.vy)/drag.vh;}
        else{documentSettings.signatureX=(x-drag.vx)/drag.vw;documentSettings.signatureY=(y-drag.vy)/drag.vh;}
        applyDocumentSettingsToOverlay();
        event.preventDefault();
      };
      const finish = (event) => {
        if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
        drag.node.classList.remove('is-dragging');
        drag = null;
        updateHistoryControls();
      };
      svg.addEventListener('pointerdown', down, true); svg.addEventListener('pointermove', move, true); svg.addEventListener('pointerup', finish, true); svg.addEventListener('pointercancel', finish, true);
      return () => { svg.removeEventListener('pointerdown', down, true); svg.removeEventListener('pointermove', move, true); svg.removeEventListener('pointerup', finish, true); svg.removeEventListener('pointercancel', finish, true); };
    }

    function attachStableCoordinateTableInteraction(svg) {
      if (!svg) return () => {};
      let drag=null;
      const down=(event)=>{
        const handle=event.target?.closest?.('.sv-coordinate-table-resize-handle');
        const zone=event.target?.closest?.('.sv-coordinate-table-drag-zone');
        const group=event.target?.closest?.('.sv-coordinate-table-overlay');
        if(!group || !svg.contains(group) || (!handle && !zone) || svg.classList.contains('is-guide-mode') || svg.classList.contains('is-line-edit-mode')) return;
        const point=svgPoint(svg,event); if(!point)return;
        safeCheckpoint(handle?'redimensionar tabela de coordenadas':'mover tabela de coordenadas');
        const frame={x:Number(group.dataset.mapX||0)||0,y:Number(group.dataset.mapY||0)||0,w:Math.max(1,Number(group.dataset.mapW||1)||1),h:Math.max(1,Number(group.dataset.mapH||1)||1)};
        drag={pointerId:event.pointerId,mode:handle?'resize':'move',point,frame,startX:Number(group.dataset.tableX||0)||0,startY:Number(group.dataset.tableY||0)||0,startWidth:Number(group.dataset.tableWidth||0)||0,startHeight:Number(group.dataset.tableHeight||0)||0,startScale:Number(documentSettings.coordinateTableScale||1)||1};
        event.preventDefault(); event.stopPropagation();
        try{svg.setPointerCapture?.(event.pointerId);}catch(_error){}
      };
      const move=(event)=>{
        if(!drag || event.pointerId!==drag.pointerId)return;
        const point=svgPoint(svg,event); if(!point)return; event.preventDefault();
        if(drag.mode==='move'){
          const width=Math.min(340,Math.max(250,drag.frame.w*.42))*Math.max(.7,Math.min(1.8,Number(documentSettings.coordinateTableScale||1)||1));
          const rows=Math.max(1,Math.min(coordinateTableMaxRows(),Math.round(Number(documentSettings.coordinateTableRows||1)||1)));
          const height=22*Math.max(.7,Math.min(1.8,Number(documentSettings.coordinateTableScale||1)||1))+rows*(18*Math.max(.7,Math.min(1.8,Number(documentSettings.coordinateTableScale||1)||1)))+6*Math.max(.7,Math.min(1.8,Number(documentSettings.coordinateTableScale||1)||1));
          const x=Math.max(drag.frame.x,Math.min(drag.frame.x+drag.frame.w-width,drag.startX+point.x-drag.point.x));
          const y=Math.max(drag.frame.y,Math.min(drag.frame.y+drag.frame.h-height,drag.startY+point.y-drag.point.y));
          documentSettings.coordinateTableX=(x-drag.frame.x)/drag.frame.w;
          documentSettings.coordinateTableY=(y-drag.frame.y)/drag.frame.h;
        }else{
          const delta=Math.max(point.x-drag.point.x, point.y-drag.point.y);
          documentSettings.coordinateTableScale=Math.max(.7,Math.min(1.8,drag.startScale+(delta/220)));
        }
        syncSettingsControls();
      };
      const finish=(event)=>{ if(!drag || (event.pointerId!=null && event.pointerId!==drag.pointerId)) return; drag=null; updateHistoryControls(); };
      svg.addEventListener('pointerdown',down,true); svg.addEventListener('pointermove',move,true); svg.addEventListener('pointerup',finish,true); svg.addEventListener('pointercancel',finish,true);
      return ()=>{svg.removeEventListener('pointerdown',down,true);svg.removeEventListener('pointermove',move,true);svg.removeEventListener('pointerup',finish,true);svg.removeEventListener('pointercancel',finish,true);};
    }

    function renderSmartGuide(svg, guide) {
      if (!svg || !guide) return;
      const ns = 'http://www.w3.org/2000/svg';
      let line = svg.querySelector('.sv-smart-guide-line');
      if (!line) {
        line = document.createElementNS(ns, 'line');
        line.setAttribute('class', 'sv-smart-guide-line');
        line.setAttribute('stroke', '#0284c7');
        line.setAttribute('stroke-width', '0.75');
        line.setAttribute('stroke-dasharray', '4,3');
        line.setAttribute('pointer-events', 'none');
        svg.appendChild(line);
      }
      line.setAttribute('x1', String(guide.x1));
      line.setAttribute('y1', String(guide.y1));
      line.setAttribute('x2', String(guide.x2));
      line.setAttribute('y2', String(guide.y2));
    }
    function clearSmartGuides(svg) {
      if (!svg) return;
      svg.querySelectorAll('.sv-smart-guide-line').forEach((n) => n.remove());
    }
    function attachLiveFieldDirectEditing(svg) {
      if (!svg) return () => {};
      svg.querySelectorAll('[data-live-field], [data-live-field-row]').forEach((node) => {
        if (!node.getAttribute('title')) node.setAttribute('title', 'Duplo clique para editar este texto do carimbo');
        node.style.cursor = 'pointer';
      });
      const dblclick = (event) => {
        const target = event.target?.closest?.('[data-live-field], [data-live-field-row]');
        if (!target || !svg.contains(target)) return;
        event.preventDefault();
        event.stopPropagation();
        const field = safeText(target.dataset.liveField || target.dataset.liveFieldRow).trim();
        if (!field) return;
        const currentText = safeText(target.querySelector?.('[data-live-field-value]')?.textContent || target.textContent).trim();
        const fieldNameFriendly = field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase());
        const nextValue = window.prompt(`Editar campo do selo [${fieldNameFriendly}]:`, currentText);
        if (nextValue !== null && nextValue.trim() !== currentText) {
          checkpoint(`editar campo ${field}`);
          patchLiveFields({ [field]: nextValue.trim() });
          markDirty(true);
          setGuideStatus(`Campo "${fieldNameFriendly}" atualizado para "${nextValue.trim()}".`);
        }
      };
      svg.addEventListener('dblclick', dblclick);
      return () => svg.removeEventListener('dblclick', dblclick);
    }
    function attachCrossHighlightingInteractions(svg) {
      if (!svg) return () => {};
      const over = (event) => {
        const vertex = event.target?.closest?.('.sv-vertex-label, .sv-confrontante-editor-anchor, .sv-vertex-anchor');
        if (vertex && svg.contains(vertex)) {
          const key = vertexLabelKey(vertex) || vertex.dataset?.vertex || vertex.dataset?.vertexKey;
          if (key) highlightCoordinateVertex(key, true);
          return;
        }
        const tableRow = event.target?.closest?.('.sv-coordinate-table-row');
        if (tableRow && svg.contains(tableRow)) {
          const key = tableRow.dataset?.coordinateVertex;
          if (key) highlightCoordinateVertex(key, true);
          return;
        }
      };
      const out = (event) => {
        const vertex = event.target?.closest?.('.sv-vertex-label, .sv-confrontante-editor-anchor, .sv-vertex-anchor');
        const tableRow = event.target?.closest?.('.sv-coordinate-table-row');
        if (vertex || tableRow) {
          highlightCoordinateVertex(null, false);
        }
      };
      const click = (event) => {
        const tableRow = event.target?.closest?.('.sv-coordinate-table-row');
        if (tableRow && svg.contains(tableRow)) {
          const key = safeText(tableRow.dataset?.coordinateVertex).trim().toUpperCase();
          if (key) {
            selectVertexLabel(key);
            highlightCoordinateVertex(key, true);
          }
        }
      };
      svg.addEventListener('pointerover', over);
      svg.addEventListener('pointerout', out);
      svg.addEventListener('click', click);
      return () => {
        svg.removeEventListener('pointerover', over);
        svg.removeEventListener('pointerout', out);
        svg.removeEventListener('click', click);
      };
    }

    async function mountEditorEngine(svg) {
      engineDisposers.splice(0).forEach((dispose) => { try { dispose?.(); } catch (_error) {} });
      try { editorEngine?.destroy?.(); } catch (_error) {}
      editorEngine = null;
      if (!svg) return null;
      const { SurveyorEditorEngine } = await import('/assets/js/core/editor-engine/index.js');
      const engine = new SurveyorEditorEngine({ historyLimit: 120, snapTolerance: 8, renderContext: { svg } });
      editorEngine = engine;
      modal?.setAttribute('data-editor-engine','surveyor-editor-engine');
      modal?.setAttribute('data-editor-engine-version','1');
      engineDisposers.push(engine.events.on('history:change', updateHistoryControls));
      if (nativeMode && nativeDocument) {
        const api = window.SurveyorNativeTechnicalDocument;
        const nativeSnapshot = api?.snapshot?.(nativeDocument) || nativeDocument;
        engine.addNode({ id:'native-document', type:'native-document', locked:false, visible:true, data:{ document:nativeSnapshot } });
        (nativeSnapshot?.objects || []).forEach((objectNode) => {
          if (!objectNode?.id) return;
          const engineId = `native:${objectNode.id}`;
          if (engine.scene.has(engineId)) return;
          engine.addNode({ id:engineId, type:`native-${objectNode.type || 'object'}`, locked:Boolean(objectNode.locked), visible:objectNode.visible !== false, data:objectNode.data || {} });
        });
        (nativeSnapshot?.renderModel?.texts || []).forEach((textNode,index) => {
          const id = `native-render-text:${safeText(textNode?.id || index)}`;
          if (!engine.scene.has(id)) engine.addNode({ id, type:'native-render-text', locked:true, visible:true, data:textNode });
        });
        engine.registerRenderer('native-text',(sceneNode)=>{
          const field=safeText(sceneNode.data?.field); if(!field)return;
          const value=safeText(sceneNode.data?.text).trim();
          svg.querySelectorAll('[data-live-field]').forEach((node)=>{if(safeText(node.dataset.liveField)===field)node.textContent=value;});
          svg.querySelectorAll('[data-live-field-row]').forEach((row)=>{if(safeText(row.dataset.liveFieldRow)!==field)return;const valueNode=row.querySelector('[data-live-field-value]');if(valueNode)valueNode.textContent=value;row.style.display=value?'':'none';});
        });
        engine.registerRenderer('native-layer',(sceneNode)=>{
          const key=safeText(sceneNode.data?.key); if(!key)return;
          liveElementState[key]=sceneNode.visible!==false;
          applyLiveElementState(svg);
        });
        modal?.setAttribute('data-editor-document-model','native-v1');
      }

      const frame=mapFrameFromOverlay(),geomFrame=geometryFrameFromOverlay();syncAreaNameLabels();(documentSettings.areaNames||[]).forEach((item,index)=>{const group=Array.from(svg.querySelectorAll('.sv-area-name-label')).find((node)=>node.dataset.areaNameId===item.id),x=Number(group?.dataset.x),y=Number(group?.dataset.y);engine.addNode({id:`document-area-name:${item.id}`,type:'area-name',data:{id:item.id,x:Number.isFinite(x)?x:frame.x+frame.w/2+index*18,y:Number.isFinite(y)?y:frame.y+frame.h/2+index*18}});});engine.registerRenderer('area-name',(node)=>{const item=(documentSettings.areaNames||[]).find((entry)=>entry.id===node.data.id);if(!item)return;const px=Math.max(frame.x,Math.min(frame.x+frame.w,Number(node.data.x)||0)),py=Math.max(frame.y,Math.min(frame.y+frame.h,Number(node.data.y)||0));item.coordinateSpace='geometry-v1';item.x=(px-frame.x)/frame.w;item.y=(py-frame.y)/frame.h;item.xG=(px-geomFrame.x)/geomFrame.w;item.yG=(py-geomFrame.y)/geomFrame.h;syncAreaNameLabels();});engineDisposers.push(engine.events.on('interaction:dragstart',({id})=>{const value=String(id||'');if(value.startsWith('document-area-name:')){selectedAreaNameId=value.slice('document-area-name:'.length);syncAreaControls();}}));

      svg.querySelectorAll('.sv-vertex-label').forEach((node,index)=>{
        const key=vertexLabelKey(node); if(!key)return;
        const current=documentSettings.vertexLabelOffsets?.[key] || {dx:Number(node.dataset.offsetDx||0)||0,dy:Number(node.dataset.offsetDy||0)||0};
        engine.addNode({id:`vertex-label:${key}`,type:'vertex-label',data:{key,dx:Number(current.dx)||0,dy:Number(current.dy)||0,index}});
      });
      engine.registerRenderer('vertex-label',(sceneNode)=>{
        const key=safeText(sceneNode.data.key); const dom=Array.from(svg.querySelectorAll('.sv-vertex-label')).find((item)=>vertexLabelKey(item)===key); if(!dom)return;
        documentSettings.vertexLabelOffsets ||= {};
        documentSettings.vertexLabelOffsets[key]={dx:Number(sceneNode.data.dx)||0,dy:Number(sceneNode.data.dy)||0};
        applyVertexOffset(dom,sceneNode.data.dx,sceneNode.data.dy);
      });
      engineDisposers.push(engine.events.on('interaction:dragstart',({id})=>{
        const value=String(id||'');
        if(value.startsWith('vertex-label:')) selectVertexLabel(value.slice('vertex-label:'.length));
      }));

      svg.querySelectorAll('.sv-confrontante-callout').forEach((group,index)=>{
        const id=safeText(group.dataset.segmentId||group.dataset.labelKey||`segment-${index+1}`);
        engine.addNode({id:`confrontante:${id}`,type:'confrontante-label',data:{segmentId:id,dx:Number(group.dataset.dx||0)||0,dy:Number(group.dataset.dy||0)||0}});
      });
      engine.registerRenderer('confrontante-label',(sceneNode)=>{
        const group=Array.from(svg.querySelectorAll('.sv-confrontante-callout')).find((item)=>safeText(item.dataset.segmentId||item.dataset.labelKey)===safeText(sceneNode.data.segmentId));
        if(group){
          applyOffsetDirect(group,sceneNode.data.dx,sceneNode.data.dy);
          syncConfrontanteFromEngineNode(sceneNode);
        }
      });
      engineDisposers.push(attachStableAreaNameDrag(svg));
      engineDisposers.push(attachStableVertexLabelDrag(svg));
      engineDisposers.push(attachStableDimensionDrag(svg));
      engineDisposers.push(attachStableSignatureDrag(svg));
      engineDisposers.push(attachStableCoordinateTableInteraction(svg));
      engineDisposers.push(attachStableConfrontanteDrag(svg));
      engineDisposers.push(attachLiveFieldDirectEditing(svg));
      engineDisposers.push(attachCrossHighlightingInteractions(svg));

      window.SurveyorEditorEngineRuntime = Object.freeze({
        get active(){return editorEngine;},
        inspect(){return editorEngine ? {mode:nativeMode?'native':'legacy-svg',documentSchema:nativeDocument?.schemaVersion||'',typographyAudit:nativeTypographyAudit,nodes:editorEngine.scene.values().map((node)=>node.snapshot()),undo:editorEngine.history.undoDepth,redo:editorEngine.history.redoDepth} : null;}
      });
      updateHistoryControls();
      return engine;
    }

    function disposeEditorEngine(){
      engineDisposers.splice(0).forEach((dispose)=>{try{dispose?.();}catch(_error){}});
      try{editorEngine?.destroy?.();}catch(_error){}
      editorEngine=null;
    }

    function controls() { return { edit: document.getElementById(options.editButtonId || 'editConfrontanteLabelsBtn'), reset: document.getElementById(options.resetButtonId || 'resetConfrontanteLabelsBtn') }; }
    function updateControls() {
      const { edit, reset } = controls(); const available = hasEditableLayer();
      if (edit) { edit.disabled = !available || active; edit.textContent = active ? 'Editor aberto' : editorTitle(options); edit.classList.toggle('primary', active); }
      if (reset) reset.disabled = active || (!available && !Object.keys(readOffsets(options)).length && !readSegments(options).length);
    }
    function ensureControls() {
      if (optionValue(options, 'standaloneControls', true) === false) return updateControls();
      if (controls().edit) return updateControls();
      const anchor = optionValue(options, 'anchor', null) || document.querySelector(options.anchorSelector || '');
      const row = anchor?.closest?.('.button-row') || anchor?.parentElement;
      if (!anchor || !row) return;
      const edit = document.createElement('button'); edit.id = options.editButtonId || 'editConfrontanteLabelsBtn'; edit.className = 'btn'; edit.type = 'button'; edit.textContent = editorTitle(options); edit.disabled = true; edit.title = `Abra o editor técnico da ${editorNoun(options)} para ajustar confrontantes, linhas, vértices e preenchimento.`;
      const reset = document.createElement('button'); reset.id = options.resetButtonId || 'resetConfrontanteLabelsBtn'; reset.className = 'btn'; reset.type = 'button'; reset.textContent = 'Restaurar automático'; reset.disabled = true; reset.title = 'Restaura os trechos e posições automáticos.';
      anchor.insertAdjacentElement('afterend', edit); edit.insertAdjacentElement('afterend', reset);
      edit.addEventListener('click', start);
      reset.addEventListener('click', async () => { clearOffsets(options); clearSegments(options); try { await clearProjectVisualLayout(options); } catch (error) { console.warn('[Surveyor] Não foi possível limpar layout remoto dos confrontantes:', error); } await options.regenerate?.(); updateControls(); });
      updateControls();
    }
    function syncZoomSheetAlignment(viewport, sheet) {
      if (!viewport || !sheet) return;
      const width = Math.max(1, sheet.getBoundingClientRect().width || sheet.offsetWidth || 1);
      const height = Math.max(1, sheet.getBoundingClientRect().height || sheet.offsetHeight || 1);
      const fitsX = width <= Math.max(1, viewport.clientWidth - 2);
      const fitsY = height <= Math.max(1, viewport.clientHeight - 2);
      sheet.style.marginLeft = fitsX ? 'auto' : '0';
      sheet.style.marginRight = fitsX ? 'auto' : '0';
      sheet.style.marginTop = '0';
      sheet.style.marginBottom = fitsY ? 'auto' : '0';
      sheet.dataset.zoomFitsX = fitsX ? '1' : '0';
      sheet.dataset.zoomFitsY = fitsY ? '1' : '0';
    }
    function setZoom(next, { preserveFocus = true } = {}) {
      if (!modal) return false;
      const viewport = modal.querySelector('.sv-confrontante-editor-viewport');
      const sheet = modal.querySelector('.sv-confrontante-editor-sheet');
      if (!viewport || !sheet) return false;
      const viewportRect = viewport.getBoundingClientRect();
      const sheetRect = sheet.getBoundingClientRect();
      const oldWidth = Math.max(1, sheetRect.width || sheet.offsetWidth || 1);
      const oldHeight = Math.max(1, sheetRect.height || sheet.offsetHeight || 1);
      const centerClientX = viewportRect.left + viewport.clientWidth / 2;
      const centerClientY = viewportRect.top + viewport.clientHeight / 2;
      const focusX = Math.max(0, Math.min(1, (centerClientX - sheetRect.left) / oldWidth));
      const focusY = Math.max(0, Math.min(1, (centerClientY - sheetRect.top) / oldHeight));
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(next) || 1));
      if (!(zoomBaseWidth > 0)) zoomBaseWidth = Math.max(320, viewport.clientWidth - 12);
      sheet.style.width = `${Math.round(zoomBaseWidth * zoom)}px`;
      sheet.style.maxWidth = 'none';
      syncZoomSheetAlignment(viewport, sheet);
      modal.querySelectorAll('[data-editor-zoom-label]').forEach((label) => { label.textContent = `${Math.round(zoom * 100)}%`; });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!viewport.isConnected || !sheet.isConnected) return;
        syncZoomSheetAlignment(viewport, sheet);
        const updatedRect = sheet.getBoundingClientRect();
        const newWidth = Math.max(1, updatedRect.width || sheet.offsetWidth || 1);
        const newHeight = Math.max(1, updatedRect.height || sheet.offsetHeight || 1);
        const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        if (!preserveFocus) {
          const centeredLeft = newWidth > viewport.clientWidth
            ? Math.max(0, Math.min(maxLeft, (Number(sheet.offsetLeft || 0) + newWidth / 2) - viewport.clientWidth / 2))
            : 0;
          const centeredTop = newHeight > viewport.clientHeight
            ? Math.max(0, Math.min(maxTop, (Number(sheet.offsetTop || 0) + newHeight / 2) - viewport.clientHeight / 2))
            : 0;
          viewport.scrollTo?.({ left:centeredLeft, top:centeredTop, behavior:'auto' });
          return;
        }
        const targetX = Number(sheet.offsetLeft || 0) + focusX * newWidth;
        const targetY = Number(sheet.offsetTop || 0) + focusY * newHeight;
        const left = newWidth <= viewport.clientWidth
          ? 0
          : Math.max(0, Math.min(maxLeft, targetX - viewport.clientWidth / 2));
        const top = newHeight <= viewport.clientHeight
          ? 0
          : Math.max(0, Math.min(maxTop, targetY - viewport.clientHeight / 2));
        viewport.scrollTo?.({ left, top, behavior:'auto' });
      }));
      return true;
    }
    function fitZoomToViewport() {
      if (!modal) return false;
      const viewport = modal.querySelector('.sv-confrontante-editor-viewport');
      const sheet = modal.querySelector('.sv-confrontante-editor-sheet');
      if (!viewport || !sheet) return false;
      const availableWidth = Math.max(320, viewport.clientWidth - 12);
      const availableHeight = Math.max(1, viewport.clientHeight - 12);
      const aspectText = safeText(sheet.style.aspectRatio || getComputedStyle(sheet).aspectRatio || '1 / 1');
      const aspectParts = aspectText.split('/').map(Number);
      const aspect = (Number.isFinite(aspectParts[0]) && Number.isFinite(aspectParts[1]) && aspectParts[1] > 0) ? aspectParts[0] / aspectParts[1] : 1;
      // 100% passa a significar largura útil total da bancada. "Ajustar à tela"
      // calcula apenas o percentual necessário para a folha inteira caber. Assim,
      // aumentar o zoom amplia de fato a prancha, em vez de consumir apenas a
      // margem lateral vazia criada por uma base já reduzida pela altura.
      zoomBaseWidth = availableWidth;
      const fitScale = Math.min(1, availableHeight / Math.max(1, zoomBaseWidth / Math.max(.01, aspect)));
      setZoom(Math.max(ZOOM_MIN, Math.min(1, fitScale)), { preserveFocus:false });
      return true;
    }
    function updateRangeProgress(input){
      if(!input?.matches?.('input[type="range"]'))return;
      const min=Number(input.min||0),max=Number(input.max||100),value=Number(input.value||0);
      const progress=max>min?Math.max(0,Math.min(100,((value-min)/(max-min))*100)):0;
      input.style.setProperty('--sv-range-progress',`${progress.toFixed(3)}%`);
    }
    function syncRangeProgress(root=modal){
      root?.querySelectorAll?.('input[type="range"]').forEach(updateRangeProgress);
    }
    function showSaveLoading() {
      const node = document.createElement('div');
      node.className = 'sv-document-save-loading';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-label', 'Carregando');
      node.innerHTML = '<span class="sv-document-save-spinner" aria-hidden="true"></span>';
      document.body.appendChild(node);
      document.body.classList.add('sv-document-save-busy');
      return () => { node.remove(); document.body.classList.remove('sv-document-save-busy'); };
    }
    function close() {
      if(overlay) { draftSegments.forEach((item)=>clearGuidePreview(item.id)); clearTechnicalLinePreview(); clearManualServitudeTemp(); }
      if (nativePublishFrame) { cancelAnimationFrame(nativePublishFrame); nativePublishFrame = 0; }
      disposeEditorEngine();
      if (editorBackgroundObjectUrl) {
        URL.revokeObjectURL(editorBackgroundObjectUrl);
        editorBackgroundObjectUrl = '';
      }
      const closedMode = presentationMode;
      const closedMount = presentationMount;
      active = false; guideState = null; servitudeDrawState=null; selectedSegmentId = ''; selectedLineRef=null; selectedVertexKey=''; selectedDimensionKey=''; selectedManualServitudeId=''; selectedSignatureMode='none'; editLinesActive=false; hasUnsavedChanges=false; zoomBaseWidth=0; overlay = null;
      modal?.remove(); modal = null;
      document.body.classList.remove('sv-confrontante-editor-open');
      closedMount?.classList?.remove?.('sv-beta-personalization-active');
      try { window.dispatchEvent(new CustomEvent('surveyor:technical-editor-closed',{detail:{mode:closedMode,mount:closedMount,editor:api}})); } catch (_error) {}
      presentationMode='modal'; presentationMount=null; presentationVisible=true;
      updateControls();
    }
    function setVisible(visible = true) {
      presentationVisible = Boolean(visible);
      if (!modal) return false;
      modal.hidden = !presentationVisible;
      if (presentationMode === 'inline') presentationMount?.classList?.toggle?.('sv-beta-personalization-active', presentationVisible);
      return true;
    }
    function groupForSegment(id) {
      return Array.from(overlay?.querySelectorAll?.('.sv-confrontante-callout') || []).find((group) => (group.dataset.segmentId || group.dataset.labelKey) === id) || null;
    }
    function syncVisualStateFromOverlay() {
      if (!overlay) return;
      overlay.querySelectorAll('.sv-confrontante-callout[data-label-key]').forEach((group) => {
        group.classList.remove('is-selected', 'is-dragging');
        const segmentId = safeText(group.dataset.segmentId || group.dataset.labelKey || '').trim();
        const segment = segmentById(segmentId);
        if (!segment) return;
        segment.labelDx = Number(group.dataset.dx || 0) || 0;
        segment.labelDy = Number(group.dataset.dy || 0) || 0;
        segment.labelScale = Math.max(.20, Math.min(4, Number(group.dataset.labelScale || segment.labelScale || 1) || 1));
        segment.labelRotation = Number(group.dataset.labelRotation || segment.labelRotation || 0) || 0;
      });
      documentSettings.dimensionLabelOffsets = overlay.querySelectorAll('.sv-cad-dimension').length
        ? Array.from(overlay.querySelectorAll('.sv-cad-dimension')).reduce((acc,node)=>{
            const key=dimensionLabelKey(node);
            if(!key) return acc;
            acc[key]={dx:Number(node.dataset.offsetDx||0)||0,dy:Number(node.dataset.offsetDy||0)||0};
            return acc;
          }, {})
        : {};
    }
    function normalizedSegmentForProject(segment) {
      const group = groupForSegment(segment.id) || overlay?.querySelector?.('.sv-confrontante-callout');
      const mx = Number(group?.dataset?.mapX || 0), my = Number(group?.dataset?.mapY || 0);
      const mw = Math.max(1, Number(group?.dataset?.mapW || 1)), mh = Math.max(1, Number(group?.dataset?.mapH || 1));
      const gx = Number(group?.dataset?.geomX || mx), gy = Number(group?.dataset?.geomY || my);
      const gw = Math.max(1, Number(group?.dataset?.geomW || mw)), gh = Math.max(1, Number(group?.dataset?.geomH || mh));
      const nx = (x) => Number.isFinite(Number(x)) ? (Number(x) - mx) / mw : null;
      const ny = (y) => Number.isFinite(Number(y)) ? (Number(y) - my) / mh : null;
      const ngx = (x) => Number.isFinite(Number(x)) ? (Number(x) - gx) / gw : null;
      const ngy = (y) => Number.isFinite(Number(y)) ? (Number(y) - gy) / gh : null;
      const line = (prefix) => ({
        [`${prefix}X1N`]: nx(segment[`${prefix}X1`]),
        [`${prefix}Y1N`]: ny(segment[`${prefix}Y1`]),
        [`${prefix}X2N`]: nx(segment[`${prefix}X2`]),
        [`${prefix}Y2N`]: ny(segment[`${prefix}Y2`]),
        [`${prefix}X1G`]: ngx(segment[`${prefix}X1`]),
        [`${prefix}Y1G`]: ngy(segment[`${prefix}Y1`]),
        [`${prefix}X2G`]: ngx(segment[`${prefix}X2`]),
        [`${prefix}Y2G`]: ngy(segment[`${prefix}Y2`])
      });
      return {
        id:safeText(segment.id), nome:safeText(segment.nome).trim() || 'Confrontante',
        propriedade:safeText(segment.propriedade),
        cpfCnpj:safeText(segment.cpfCnpj),
        showPropertyInLabel:typeof segment.showPropertyInLabel==='boolean'?segment.showPropertyInLabel:Boolean(safeText(segment.propriedade||'').trim()),
        showCpfCnpjInLabel:segment.showCpfCnpjInLabel===true,
        tipoLimite:safeText(segment.tipoLimite),
        orientacao:safeText(segment.orientacao), observacao:safeText(segment.observacao),
        coordinateSpace:'geometry-v1',
        startVertex:Number(segment.startVertex)||1, endVertex:Number(segment.endVertex)||2,
        vertices:Array.isArray(segment.vertices)?segment.vertices.map(Number).filter(Number.isFinite):[],
        segmentIndexes:Array.isArray(segment.segmentIndexes)?segment.segmentIndexes.map(Number).filter(Number.isFinite):[],
        ...line('freeLine1'), ...line('freeLine2'),
        labelDxN:Number(segment.labelDx || 0) / mw,
        labelDyN:Number(segment.labelDy || 0) / mh,
        labelDxG:Number(segment.labelDx || 0) / gw,
        labelDyG:Number(segment.labelDy || 0) / gh,
        labelXG:(()=>{const x1=Number(group?.dataset?.baseX1),x2=Number(group?.dataset?.baseX2);if(!Number.isFinite(x1)||!Number.isFinite(x2))return Number.isFinite(Number(segment.labelXG))?Number(segment.labelXG):null;return (((x1+x2)/2)+(Number(segment.labelDx)||0)-gx)/gw;})(),
        labelYG:(()=>{const y1=Number(group?.dataset?.baseY1),y2=Number(group?.dataset?.baseY2);if(!Number.isFinite(y1)||!Number.isFinite(y2))return Number.isFinite(Number(segment.labelYG))?Number(segment.labelYG):null;return (((y1+y2)/2)+(Number(segment.labelDy)||0)-gy)/gh;})(),
        labelScale:Math.max(.20,Math.min(4,Number(segment.labelScale||1))),
        labelRotation:Number(segment.labelRotation||0)||0,
        labelColor:confrontanteLabelColor(segment.labelColor),
        labelColorCustomized:segment.labelColorCustomized===true,
        manualLinesOnly:Boolean(segment.manualLinesOnly && Array.isArray(segment.extraLines) && segment.extraLines.length),
        extraLines:(Array.isArray(segment.extraLines)?segment.extraLines:[]).map((item,index)=>({
          id:safeText(item.id || `extra-${index+1}`),
          x1N:nx(item.x1), y1N:ny(item.y1), x2N:nx(item.x2), y2N:ny(item.y2),
          x1G:ngx(item.x1), y1G:ngy(item.y1), x2G:ngx(item.x2), y2G:ngy(item.y2)
        })).filter((item)=>[item.x1G,item.y1G,item.x2G,item.y2G].every(Number.isFinite) || [item.x1N,item.y1N,item.x2N,item.y2N].every(Number.isFinite)),
        hidden:false
      };
    }
    function materializeProjectSegmentForOverlay(segment = {}) {
      const frame=mapFrameFromOverlay(),geom=geometryFrameFromOverlay();
      const absX=(g,n,absolute)=>Number.isFinite(Number(g))?geom.x+Number(g)*geom.w:(Number.isFinite(Number(n))?frame.x+Number(n)*frame.w:(Number.isFinite(Number(absolute))?Number(absolute):null));
      const absY=(g,n,absolute)=>Number.isFinite(Number(g))?geom.y+Number(g)*geom.h:(Number.isFinite(Number(n))?frame.y+Number(n)*frame.h:(Number.isFinite(Number(absolute))?Number(absolute):null));
      const out={...segment};
      ['freeLine1','freeLine2'].forEach((prefix)=>{
        out[`${prefix}X1`]=absX(segment[`${prefix}X1G`],segment[`${prefix}X1N`],segment[`${prefix}X1`]);
        out[`${prefix}Y1`]=absY(segment[`${prefix}Y1G`],segment[`${prefix}Y1N`],segment[`${prefix}Y1`]);
        out[`${prefix}X2`]=absX(segment[`${prefix}X2G`],segment[`${prefix}X2N`],segment[`${prefix}X2`]);
        out[`${prefix}Y2`]=absY(segment[`${prefix}Y2G`],segment[`${prefix}Y2N`],segment[`${prefix}Y2`]);
      });
      out.labelDx=Number.isFinite(Number(segment.labelDxG))?Number(segment.labelDxG)*geom.w:(Number.isFinite(Number(segment.labelDxN))?Number(segment.labelDxN)*frame.w:(Number(segment.labelDx)||0));
      out.labelDy=Number.isFinite(Number(segment.labelDyG))?Number(segment.labelDyG)*geom.h:(Number.isFinite(Number(segment.labelDyN))?Number(segment.labelDyN)*frame.h:(Number(segment.labelDy)||0));
      out.labelX=Number.isFinite(Number(segment.labelXG))?geom.x+Number(segment.labelXG)*geom.w:null;
      out.labelY=Number.isFinite(Number(segment.labelYG))?geom.y+Number(segment.labelYG)*geom.h:null;
      out.extraLines=(Array.isArray(segment.extraLines)?segment.extraLines:[]).map((line,index)=>({
        ...line,id:safeText(line?.id||`extra-${index+1}`),
        x1:absX(line?.x1G,line?.x1N,line?.x1),y1:absY(line?.y1G,line?.y1N,line?.y1),
        x2:absX(line?.x2G,line?.x2N,line?.x2),y2:absY(line?.y2G,line?.y2N,line?.y2)
      })).filter((line)=>[line.x1,line.y1,line.x2,line.y2].every(Number.isFinite));
      return out;
    }
    function materializeProjectSegmentsForOverlay(segments = []) {
      return (Array.isArray(segments)?segments:[]).map(materializeProjectSegmentForOverlay);
    }

    function persistOffsets() {
      if (!overlay) return;
      syncVisualStateFromOverlay();
      const offsets = {};
      overlay.querySelectorAll('.sv-confrontante-callout[data-label-key]').forEach((group) => {
        const key = group.dataset.labelKey; if (!key) return;
        const value = {
          dx: Number(group.dataset.dx || 0), dy: Number(group.dataset.dy || 0),
          scale: Math.max(.20, Math.min(4, Number(group.dataset.labelScale || 1) || 1)),
          rotation: Number(group.dataset.labelRotation || 0) || 0
        };
        offsets[key] = value;
        const segmentId = safeText(group.dataset.segmentId || '').trim();
        if (segmentId) offsets[`manual::${segmentId}`] = value;
      });
      writeOffsets(options, offsets);
    }

    function selectSegmentRow(id) {
      if (!modal || !id) return;
      modal.querySelectorAll('.sv-confrontante-segment-row.is-selected').forEach((row) => row.classList.remove('is-selected'));
      selectedSegmentId = id;
      const row = Array.from(modal.querySelectorAll('.sv-confrontante-segment-row')).find((item) => item.dataset.segmentId === id);
      row?.classList.add('is-selected'); row?.scrollIntoView?.({ block: 'nearest' });
    }
    function vertexOptions(count, selected) {
      return Array.from({ length: count }, (_, index) => `<option value="${index + 1}"${Number(selected) === index + 1 ? ' selected' : ''}>V-${String(index + 1).padStart(2, '0')}</option>`).join('');
    }

    function segmentById(id) {
      return draftSegments.find((segment) => segment.id === id) || null;
    }
    function anchorForVertex(vertexNumber) {
      return Array.from(overlay?.querySelectorAll?.('.sv-confrontante-editor-anchor') || []).find((anchor) => Number(anchor.dataset.vertex) === Number(vertexNumber)) || null;
    }
    function setGuideStatus(text = '') {
      const status = modal?.querySelector?.('[data-guide-status]');
      if (status) status.textContent = text;
    }
    function showEditorAnchors(show) {
      const group = overlay?.querySelector?.('.sv-confrontante-editor-anchors');
      if (group) group.style.display = show ? 'inline' : 'none';
      overlay?.classList?.toggle('is-guide-mode', Boolean(show));
    }
    function clearTemporaryGuide() {
      overlay?.querySelectorAll?.('.sv-confrontante-guide-temp').forEach((node) => node.remove());
    }
    function originalGuideLines(segmentId) {
      const original = groupForSegment(segmentId);
      return original ? Array.from(original.querySelectorAll('.sv-confrontante-guide-extension,.sv-confrontante-extra-line')) : [];
    }
    function setOriginalGuideVisibility(segmentId, hidden) {
      originalGuideLines(segmentId).forEach((line) => {
        if (!line.dataset.editorOriginalOpacity) line.dataset.editorOriginalOpacity = line.style.opacity || '__empty__';
        line.style.opacity = hidden ? '0' : (line.dataset.editorOriginalOpacity === '__empty__' ? '' : line.dataset.editorOriginalOpacity);
        line.style.visibility = hidden ? 'hidden' : '';
      });
    }
    function clearGuidePreview(segmentId) {
      setOriginalGuideVisibility(segmentId, false);
      overlay?.querySelectorAll?.(`.sv-editor-manual-guide[data-segment-id="${CSS.escape(segmentId)}"]`).forEach((node) => node.remove());
    }
    function materializeGuideGeometry(segment) {
      if (!segment) return;
      const original = groupForSegment(segment.id);
      if (!original) return;
      const sourceLines = Array.from(original.querySelectorAll('.sv-confrontante-guide-extension')).filter((line) => [line.getAttribute('x1'),line.getAttribute('y1'),line.getAttribute('x2'),line.getAttribute('y2')].every(finiteGuideValue));
      const read = (line) => line ? { x1:Number(line.getAttribute('x1')), y1:Number(line.getAttribute('y1')), x2:Number(line.getAttribute('x2')), y2:Number(line.getAttribute('y2')) } : null;
      const current1 = [segment.freeLine1X1,segment.freeLine1Y1,segment.freeLine1X2,segment.freeLine1Y2].every(finiteGuideValue);
      const current2 = [segment.freeLine2X1,segment.freeLine2Y1,segment.freeLine2X2,segment.freeLine2Y2].every(finiteGuideValue);
      if (!current1 && sourceLines[0]) {
        const line = read(sourceLines[0]); Object.assign(segment,{freeLine1X1:line.x1,freeLine1Y1:line.y1,freeLine1X2:line.x2,freeLine1Y2:line.y2});
      }
      if (!current2 && sourceLines[1]) {
        const line = read(sourceLines[1]); Object.assign(segment,{freeLine2X1:line.x1,freeLine2Y1:line.y1,freeLine2X2:line.x2,freeLine2Y2:line.y2});
      }
    }
    function appendGuidePreviewLine(group,id,state,{extra=false}={}) {
      if(!group||!id||!state)return;
      const {x1,y1,x2,y2}=state;
      if(![x1,y1,x2,y2].every((value)=>Number.isFinite(Number(value))))return;
      const ns='http://www.w3.org/2000/svg';
      const node=document.createElementNS(ns,'line');
      node.setAttribute('class',extra?'sv-editor-guide-extension sv-editor-extra-line':'sv-editor-guide-extension');
      node.dataset.guideLineId=id;
      node.setAttribute('x1',Number(x1).toFixed(2));node.setAttribute('y1',Number(y1).toFixed(2));
      node.setAttribute('x2',Number(x2).toFixed(2));node.setAttribute('y2',Number(y2).toFixed(2));
      group.appendChild(node);
      const hit=document.createElementNS(ns,'line');
      hit.setAttribute('class','sv-editor-guide-hitbox');hit.dataset.guideLineId=id;
      hit.setAttribute('x1',Number(x1).toFixed(2));hit.setAttribute('y1',Number(y1).toFixed(2));
      hit.setAttribute('x2',Number(x2).toFixed(2));hit.setAttribute('y2',Number(y2).toFixed(2));
      group.appendChild(hit);
      [['start',x1,y1],['end',x2,y2]].forEach(([which,x,y])=>{const circle=document.createElementNS(ns,'circle');circle.setAttribute('class','sv-editor-guide-handle');circle.dataset.guideHandle=`${id}:${which}`;circle.setAttribute('cx',Number(x).toFixed(2));circle.setAttribute('cy',Number(y).toFixed(2));circle.setAttribute('r','4.2');group.appendChild(circle);});
    }
    function clearTechnicalLinePreview() {
      overlay?.querySelectorAll?.('.sv-editor-manual-guide[data-line-owner="technical"]').forEach((node)=>node.remove());
      overlay?.querySelectorAll?.('.sv-document-technical-line').forEach((node)=>{node.style.visibility='';node.style.opacity='';});
    }
    function renderTechnicalLinePreview() {
      if(!overlay)return;
      clearTechnicalLinePreview();
      const lines=Array.isArray(documentSettings.technicalLines)?documentSettings.technicalLines:[];
      if(!lines.length)return;
      const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');
      group.setAttribute('class','sv-editor-manual-guide');group.dataset.lineOwner='technical';
      lines.forEach((item)=>{const state=technicalLineAbsolute(item);if(state)appendGuidePreviewLine(group,`technical:${safeText(item.id)}`,state,{extra:true});});
      if(!group.childNodes.length)return;
      overlay.querySelectorAll('.sv-document-technical-line').forEach((node)=>{node.style.opacity='0';node.style.visibility='hidden';});
      overlay.appendChild(group);
    }

    function renderGuidePreview(segment) {
      if (!overlay || !segment) return;
      clearGuidePreview(segment.id);
      materializeGuideGeometry(segment);
      const extras = Array.isArray(segment.extraLines) ? segment.extraLines : [];
      const customOnly = Boolean(segment.manualLinesOnly && extras.length);
      const freeValues = [segment.freeLine1X1,segment.freeLine1Y1,segment.freeLine1X2,segment.freeLine1Y2,segment.freeLine2X1,segment.freeLine2Y1,segment.freeLine2X2,segment.freeLine2Y2];
      const hasMainLines = freeValues.every((value) => Number.isFinite(Number(value)));
      if (!customOnly && !hasMainLines) return;
      const ns = 'http://www.w3.org/2000/svg';
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 'sv-editor-manual-guide'); group.dataset.segmentId = segment.id;
      if (!customOnly && hasMainLines) {
        appendGuidePreviewLine(group,'line1',{x1:segment.freeLine1X1,y1:segment.freeLine1Y1,x2:segment.freeLine1X2,y2:segment.freeLine1Y2});
        appendGuidePreviewLine(group,'line2',{x1:segment.freeLine2X1,y1:segment.freeLine2Y1,x2:segment.freeLine2X2,y2:segment.freeLine2Y2});
      }
      extras.forEach((line,index) => {
        appendGuidePreviewLine(group,`extra:${safeText(line.id || index)}`,line,{extra:true});
      });
      overlay.appendChild(group);
      setOriginalGuideVisibility(segment.id, true);
    }

    function hasManualTechnicalLines() {
      return (Array.isArray(documentSettings.technicalLines) ? documentSettings.technicalLines : []).some((item) => !isVertexAutoLine(item));
    }
    function updateLineEditControls() {
      const draw=modal?.querySelector('[data-editor-action="draw-line"]');
      const toggle=modal?.querySelector('[data-editor-action="edit-lines"]');
      const remove=modal?.querySelector('[data-editor-action="delete-selected-line"]');
      const removeLast=modal?.querySelector('[data-editor-action="remove-line"]');
      const drawing=Boolean(guideState && guideState.ownerId===TECHNICAL_LINE_OWNER);
      const hasManualLines=hasManualTechnicalLines();
      if(!hasManualLines){
        editLinesActive=false;
        selectedLineRef=null;
        overlay?.querySelectorAll?.('.sv-editor-guide-extension.is-selected-line,.sv-editor-guide-hitbox.is-selected-line').forEach((node)=>node.classList.remove('is-selected-line'));
      }
      if(draw){
        draw.classList.toggle('active',drawing);
        draw.setAttribute('aria-pressed',drawing?'true':'false');
        draw.setAttribute('title',drawing?'Cancelar desenho da linha':'Desenhar linha');
        draw.setAttribute('aria-label',drawing?'Cancelar desenho da linha':'Desenhar linha');
      }
      if(toggle){
        toggle.disabled=!hasManualLines;
        toggle.classList.toggle('active',hasManualLines && editLinesActive);
        toggle.setAttribute('title',hasManualLines ? (editLinesActive?'Concluir edição das linhas':'Editar linhas') : 'Desenhe uma linha para liberar a edição');
        toggle.setAttribute('aria-label',hasManualLines ? (editLinesActive?'Concluir edição das linhas':'Editar linhas') : 'Desenhe uma linha para liberar a edição');
        toggle.setAttribute('aria-pressed',hasManualLines && editLinesActive?'true':'false');
      }
      if(remove) remove.disabled=!hasManualLines || !selectedLineRef;
      if(removeLast){
        removeLast.disabled=!hasManualLines;
        removeLast.setAttribute('title',hasManualLines ? 'Remover última linha' : 'Desenhe uma linha para liberar esta ação');
        removeLast.setAttribute('aria-label',hasManualLines ? 'Remover última linha' : 'Desenhe uma linha para liberar esta ação');
      }
      overlay?.classList?.toggle('is-line-edit-mode',hasManualLines && editLinesActive);
      refreshConfrontanteAutoControls();
    }
    function namedConfrontantesForLines() {
      const count = vertexCountFromOverlay(overlay);
      return draftSegments.filter((segment) => {
        const name = safeText(segment?.nome).trim();
        return segment?.hidden !== true && segment?.id !== '__linhas-gerais__'
          && name && !/^(confrontante|novo confrontante|não informado)$/i.test(name)
          && Number(segment.startVertex) >= 1 && Number(segment.startVertex) <= count
          && Number(segment.endVertex) >= 1 && Number(segment.endVertex) <= count;
      });
    }
    function refreshConfrontanteAutoControls() {
      const host=modal?.querySelector('[data-confrontante-auto-tools]');
      const select=modal?.querySelector('[data-confrontante-auto-select]');
      if(!host||!select)return;
      const registered=namedConfrontantesForLines();
      host.hidden=!registered.length;
      const previous=select.value;
      select.replaceChildren();
      const placeholder=document.createElement('option'); placeholder.value=''; placeholder.textContent='Escolha um confrontante';select.appendChild(placeholder);
      registered.forEach((segment)=>{
        const option=document.createElement('option'); option.value=segment.id;
        option.textContent=`${safeText(segment.nome).trim()} (V-${segment.startVertex} a V-${segment.endVertex})`;
        select.appendChild(option);
      });
      select.value=registered.some((item)=>item.id===previous)?previous:'';
      if(!registered.length){const picker=modal?.querySelector('[data-confrontante-auto-picker]');if(picker)picker.hidden=true;}
    }
    function generateConfrontanteAutoLines() {
      const id=modal?.querySelector('[data-confrontante-auto-select]')?.value || '';
      const segment=namedConfrontantesForLines().find((item)=>item.id===id);
      if(!segment)return;
      // Uma linha independente nasce no vértice inicial e outra no final.
      // A geometria segue as mesmas regras de direção das linhas automáticas dos vértices.
      const names=[Number(segment.startVertex),Number(segment.endVertex)];
      const states=names.map((vertex)=>vertexAutoLineGeometry(`V-${String(vertex).padStart(2,'0')}`));
      if(states.some((state)=>!state))return toast('Não foram encontrados os vértices deste confrontante na prancha.', 'error');
      const prefix=`confrontante-auto-${safeText(segment.id)}-`;
      const existing=Array.isArray(documentSettings.technicalLines)?documentSettings.technicalLines:[];
      const created=states.map((state,index)=>{
        const item={id:`${prefix}${index===0?'inicio':'fim'}`,confrontanteId:segment.id,confrontanteName:safeText(segment.nome).trim(),coordinateSpace:'geometry-v1'};
        setTechnicalLineAbsolute(item,state);return item;
      });
      safeCheckpoint('gerar linhas automáticas por confrontante');
      documentSettings=normalizeDocumentSettings({...documentSettings,technicalLines:[...existing.filter((item)=>!created.some((line)=>line.id===item.id)),...created]});
      renderTechnicalLinePreview();updateLineEditControls();scheduleNativePublish();markDirty(true);
      setGuideStatus(`Duas linhas geradas para ${safeText(segment.nome).trim()}: início V-${names[0]} e final V-${names[1]}.`);
    }
    function clearSelectedLine() {
      selectedLineRef=null;
      overlay?.querySelectorAll?.('.sv-editor-guide-extension.is-selected-line,.sv-editor-guide-hitbox.is-selected-line').forEach((node)=>node.classList.remove('is-selected-line'));
      updateLineEditControls();
    }
    function previewOwnerId(preview) {
      return safeText(preview?.dataset?.lineOwner || preview?.dataset?.segmentId || '').trim();
    }
    function selectEditableLine(ownerId,id) {
      selectedLineRef=ownerId&&id?{ownerId,id}:null;
      overlay?.querySelectorAll?.('.sv-editor-guide-extension,.sv-editor-guide-hitbox').forEach((node)=>{
        const preview=node.closest('.sv-editor-manual-guide');
        const active=Boolean(selectedLineRef && previewOwnerId(preview)===selectedLineRef.ownerId && node.dataset.guideLineId===selectedLineRef.id);
        node.classList.toggle('is-selected-line',active);
      });
      if(selectedLineRef && selectedLineRef.ownerId!==TECHNICAL_LINE_OWNER) selectSegmentRow(selectedLineRef.ownerId);
      updateLineEditControls();
    }
    function renderAllGuidePreviews() {
      if(!overlay)return;
      draftSegments.forEach((segment)=>clearGuidePreview(segment.id));
      clearTechnicalLinePreview();
      draftSegments.forEach((segment)=>renderGuidePreview(segment));
      renderTechnicalLinePreview();
      if(selectedLineRef) selectEditableLine(selectedLineRef.ownerId,selectedLineRef.id);
    }
    function toggleLineEditMode() {
      if(!hasManualTechnicalLines()){
        editLinesActive=false;
        updateLineEditControls();
        setGuideStatus('Desenhe uma linha técnica para liberar a edição e a remoção.');
        return;
      }
      editLinesActive=!editLinesActive;
      if(editLinesActive){
        renderAllGuidePreviews();
        setGuideStatus('Edição de linhas ativa: arraste a linha inteira ou qualquer ponta. Selecione uma linha para excluí-la.');
      }else{
        clearSelectedLine();
        renderAllGuidePreviews();
        setGuideStatus('Edição de linhas concluída.');
      }
      updateLineEditControls();
    }
    function deleteSelectedLine() {
      if(!selectedLineRef)return;
      checkpoint();
      const {ownerId,id}=selectedLineRef;
      if(ownerId===TECHNICAL_LINE_OWNER && id.startsWith('technical:')){
        const technicalId=id.slice('technical:'.length);
        documentSettings.technicalLines=(Array.isArray(documentSettings.technicalLines)?documentSettings.technicalLines:[]).filter((line)=>safeText(line?.id)!==technicalId);
        clearSelectedLine();
        renderAllGuidePreviews();
        setGuideStatus('Linha técnica excluída. Use Desfazer para restaurar.');
        return;
      }
      const segment=segmentById(ownerId);
      if(!segment)return clearSelectedLine();
      if(id==='line1'){
        segment.freeLine1X1=segment.freeLine1Y1=segment.freeLine1X2=segment.freeLine1Y2=null;
      }else if(id==='line2'){
        segment.freeLine2X1=segment.freeLine2Y1=segment.freeLine2X2=segment.freeLine2Y2=null;
      }else if(id.startsWith('extra:')){
        const extraId=id.slice(6);
        segment.extraLines=(Array.isArray(segment.extraLines)?segment.extraLines:[]).filter((line)=>safeText(line.id)!==extraId);
      }
      const hasMain=[segment.freeLine1X1,segment.freeLine1Y1,segment.freeLine1X2,segment.freeLine1Y2,segment.freeLine2X1,segment.freeLine2Y1,segment.freeLine2X2,segment.freeLine2Y2].every((value)=>Number.isFinite(Number(value)));
      if(!hasMain && !(segment.extraLines||[]).length) segment.manualLinesOnly=false;
      segmentsDirty=true;
      clearSelectedLine();
      if(editLinesActive)renderAllGuidePreviews(); else renderGuidePreview(segment);
      renderSegmentPanel(); selectSegmentRow(segment.id);
      setGuideStatus('Linha excluída. Use Desfazer para restaurar.');
    }

    function setSegmentGuidePoint(segment, handleId, which, point) {
      if (!segment || !handleId || !point) return;
      const x = Number(point.x), y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (handleId === 'line1' || handleId === 'line2') {
        const prefix = handleId === 'line1' ? 'freeLine1' : 'freeLine2';
        if (which === 'start') { segment[`${prefix}X1`] = x; segment[`${prefix}Y1`] = y; }
        else { segment[`${prefix}X2`] = x; segment[`${prefix}Y2`] = y; }
        return;
      }
      if (handleId.startsWith('extra:')) {
        const id = handleId.slice(6);
        const line = (Array.isArray(segment.extraLines) ? segment.extraLines : []).find((item) => safeText(item.id) === id);
        if (!line) return;
        if (which === 'start') { line.x1 = x; line.y1 = y; }
        else { line.x2 = x; line.y2 = y; }
      }
    }
    function guideLineState(segment, id) {
      if (!segment || !id) return null;
      if (id === 'line1' || id === 'line2') {
        const p=id==='line1'?'freeLine1':'freeLine2'; const x1=Number(segment[p+'X1']),y1=Number(segment[p+'Y1']),x2=Number(segment[p+'X2']),y2=Number(segment[p+'Y2']);
        return [x1,y1,x2,y2].every(Number.isFinite)?{x1,y1,x2,y2}:null;
      }
      if (id.startsWith('extra:')) { const line=(segment.extraLines||[]).find((item)=>safeText(item.id)===id.slice(6)); if(!line)return null; const x1=Number(line.x1),y1=Number(line.y1),x2=Number(line.x2),y2=Number(line.y2); return [x1,y1,x2,y2].every(Number.isFinite)?{x1,y1,x2,y2}:null; }
      return null;
    }
    function setGuideLineState(segment,id,state){ if(!segment||!state)return; if(id==='line1'||id==='line2'){const p=id==='line1'?'freeLine1':'freeLine2';segment[p+'X1']=state.x1;segment[p+'Y1']=state.y1;segment[p+'X2']=state.x2;segment[p+'Y2']=state.y2;return;} if(id.startsWith('extra:')){const line=(segment.extraLines||[]).find((item)=>safeText(item.id)===id.slice(6));if(line)Object.assign(line,state);} }
    function ownerGuideLineState(ownerId,id) {
      if(ownerId===TECHNICAL_LINE_OWNER && id.startsWith('technical:')) return technicalLineAbsolute(technicalLineById(id.slice('technical:'.length)));
      return guideLineState(segmentById(ownerId),id);
    }
    function setOwnerGuideLineState(ownerId,id,state) {
      if(ownerId===TECHNICAL_LINE_OWNER && id.startsWith('technical:')) { const item=technicalLineById(id.slice('technical:'.length)); if(item)setTechnicalLineAbsolute(item,state); return; }
      const segment=segmentById(ownerId); if(segment)setGuideLineState(segment,id,state);
    }
    function updateGuideLineDom(preview,id,state){
      if(!preview||!id||!state)return;
      preview.querySelectorAll('[data-guide-line-id]').forEach((node)=>{
        if(node.dataset.guideLineId!==id)return;
        node.setAttribute('x1',Number(state.x1).toFixed(2));node.setAttribute('y1',Number(state.y1).toFixed(2));
        node.setAttribute('x2',Number(state.x2).toFixed(2));node.setAttribute('y2',Number(state.y2).toFixed(2));
      });
      preview.querySelectorAll('.sv-editor-guide-handle').forEach((handle)=>{
        const raw=safeText(handle.dataset.guideHandle||''); if(!raw.startsWith(`${id}:`))return;
        const which=raw.slice(id.length+1); const x=which==='start'?state.x1:state.x2; const y=which==='start'?state.y1:state.y2;
        handle.setAttribute('cx',Number(x).toFixed(2));handle.setAttribute('cy',Number(y).toFixed(2));
      });
    }
    function attachGuideHandleDrag(svg) {
      if (!svg) return;
      let drag = null;
      const finish = (event) => {
        if (!drag) return;
        try { svg.releasePointerCapture?.(event.pointerId); } catch (_error) {}
        const finished={...drag}; drag=null;
        if(finished.ownerId===TECHNICAL_LINE_OWNER){renderTechnicalLinePreview();selectEditableLine(TECHNICAL_LINE_OWNER,finished.handleId);}
        else {const segment=segmentById(finished.ownerId);if(segment){segmentsDirty=true;renderGuidePreview(segment);selectEditableLine(finished.ownerId,finished.handleId);}}
        setGuideStatus('Linha ajustada. Arraste qualquer ponta para alongar, encurtar ou reposicionar.');
      };
      svg.addEventListener('pointerdown', (event) => {
        const handle = event.target?.closest?.('.sv-editor-guide-handle');
        if (!handle || !editLinesActive) return;
        const preview = handle.closest('.sv-editor-manual-guide');
        const ownerId = previewOwnerId(preview);
        const raw = safeText(handle.dataset.guideHandle || '');
        const split = raw.lastIndexOf(':');
        if (!ownerId || split <= 0) return;
        checkpoint(); event.preventDefault(); event.stopImmediatePropagation();
        drag = { ownerId, handleId: raw.slice(0, split), which: raw.slice(split + 1), handle, preview };
        selectEditableLine(ownerId, drag.handleId);
        try { svg.setPointerCapture?.(event.pointerId); } catch (_error) {}
      }, true);
      svg.addEventListener('pointermove', (event) => {
        if (!drag) return;
        const point = svgPoint(svg,event); if (!point) return;
        event.preventDefault(); event.stopPropagation();
        const state=ownerGuideLineState(drag.ownerId,drag.handleId); if(!state)return;
        if(drag.which==='start'){state.x1=point.x;state.y1=point.y;} else {state.x2=point.x;state.y2=point.y;}
        setOwnerGuideLineState(drag.ownerId,drag.handleId,state);
        updateGuideLineDom(drag.preview,drag.handleId,state);
        drag.handle?.setAttribute('cx',point.x.toFixed(2)); drag.handle?.setAttribute('cy',point.y.toFixed(2));
      }, true);
      svg.addEventListener('pointerup', finish, true); svg.addEventListener('pointercancel', finish, true);
    }
    function attachGuideLineDrag(svg){
      if(!svg)return; let drag=null;
      const finish=(event)=>{if(!drag)return;try{svg.releasePointerCapture?.(event.pointerId);}catch(_error){} const finished=drag;drag=null;if(finished.ownerId===TECHNICAL_LINE_OWNER){renderTechnicalLinePreview();selectEditableLine(TECHNICAL_LINE_OWNER,finished.id);}else{const segment=segmentById(finished.ownerId);if(segment){segmentsDirty=true;renderGuidePreview(segment);selectEditableLine(finished.ownerId,finished.id);}} setGuideStatus('Linha reposicionada.');};
      svg.addEventListener('pointerdown',(event)=>{const hit=event.target?.closest?.('.sv-editor-guide-hitbox,.sv-editor-guide-extension');if(!hit||event.target?.closest?.('.sv-editor-guide-handle')||!editLinesActive)return;const preview=hit.closest('.sv-editor-manual-guide');const ownerId=previewOwnerId(preview);const id=safeText(hit.dataset.guideLineId||'');const initial=ownerGuideLineState(ownerId,id);const point=svgPoint(svg,event);if(!ownerId||!initial||!point)return;checkpoint();event.preventDefault();event.stopImmediatePropagation();drag={ownerId,id,initial,startX:point.x,startY:point.y,preview};selectEditableLine(ownerId,id);try{svg.setPointerCapture?.(event.pointerId);}catch(_error){}},true);
      svg.addEventListener('pointermove',(event)=>{if(!drag)return;const point=svgPoint(svg,event);if(!point)return;event.preventDefault();const dx=point.x-drag.startX,dy=point.y-drag.startY;const next={x1:drag.initial.x1+dx,y1:drag.initial.y1+dy,x2:drag.initial.x2+dx,y2:drag.initial.y2+dy};setOwnerGuideLineState(drag.ownerId,drag.id,next);updateGuideLineDom(drag.preview,drag.id,next);},true);
      svg.addEventListener('pointerup',finish,true);svg.addEventListener('pointercancel',finish,true);
    }

    function cancelGuideMode(message = '') {
      if (guideState?.pointerId != null && overlay) {
        try { overlay.releasePointerCapture?.(guideState.pointerId); } catch {}
      }
      guideState = null; clearTemporaryGuide(); showEditorAnchors(false); updateLineEditControls();
      if (message) setGuideStatus(message); else setGuideStatus('Use “Desenhar linha” para criar uma linha técnica independente.');
    }
    function startTechnicalLineMode() {
      if(guideState?.ownerId===TECHNICAL_LINE_OWNER) return cancelGuideMode('Desenho da linha cancelado.');
      guideState = { ownerId:TECHNICAL_LINE_OWNER, stage:'technical-line-drag', anchor:null, pointerId:null };
      showEditorAnchors(false); clearTemporaryGuide(); updateLineEditControls();
      setGuideStatus('Linha técnica ativa: pressione no mapa, arraste até o destino e solte.');
    }
    function technicalLineStartPoint(svg, event, point) {
      const rect=svg?.getBoundingClientRect?.();
      const viewBox=svg?.viewBox?.baseVal;
      const unitPerPixel=rect?.width>0 && Number(viewBox?.width)>0 ? Number(viewBox.width)/rect.width : 1;
      const snapRadius=Math.max(4,14*unitPerPixel);
      let nearest=null,best=Infinity;
      Array.from(overlay?.querySelectorAll?.('.sv-confrontante-editor-anchor')||[]).forEach((anchor)=>{
        const x=Number(anchor.getAttribute('cx')),y=Number(anchor.getAttribute('cy'));
        if(!Number.isFinite(x)||!Number.isFinite(y))return;
        const distance=Math.hypot(x-point.x,y-point.y);
        if(distance<best){best=distance;nearest={x,y};}
      });
      return nearest && best<=snapRadius ? nearest : point;
    }
    function attachGuideDrawing(svg) {
      if (!svg) return;
      const ns = 'http://www.w3.org/2000/svg';
      const tempLine = () => {
        let line = svg.querySelector('.sv-confrontante-guide-temp');
        if (!line) { line = document.createElementNS(ns,'line'); line.setAttribute('class','sv-confrontante-guide-temp'); svg.appendChild(line); }
        return line;
      };
      const cancelDrag=(event)=>{
        if(!guideState || guideState.ownerId!==TECHNICAL_LINE_OWNER || guideState.pointerId!==event?.pointerId)return;
        try{svg.releasePointerCapture?.(event.pointerId);}catch(_error){}
        guideState={ownerId:TECHNICAL_LINE_OWNER,stage:'technical-line-drag',anchor:null,pointerId:null};
        clearTemporaryGuide(); updateLineEditControls();
        setGuideStatus('Linha cancelada. Pressione sobre o polígono ou vértice, arraste e solte.');
      };
      svg.addEventListener('pointerdown', (event) => {
        if (!guideState || guideState.ownerId!==TECHNICAL_LINE_OWNER || guideState.stage!=='technical-line-drag') return;
        if(event.button!==0 && event.pointerType!=='touch')return;
        const raw = svgPoint(svg,event); if (!raw) return;
        const point=technicalLineStartPoint(svg,event,raw);
        event.preventDefault(); event.stopImmediatePropagation();
        guideState.anchor={x:point.x,y:point.y};
        guideState.pointerId=event.pointerId;
        guideState.last={x:point.x,y:point.y};
        const line=tempLine();
        line.setAttribute('x1',point.x.toFixed(2)); line.setAttribute('y1',point.y.toFixed(2));
        line.setAttribute('x2',point.x.toFixed(2)); line.setAttribute('y2',point.y.toFixed(2));
        try{svg.setPointerCapture?.(event.pointerId);}catch(_error){}
        setGuideStatus('Arraste até a ponta desejada e solte para criar a linha.');
      }, true);
      svg.addEventListener('pointermove', (event) => {
        if (!guideState?.anchor || guideState.ownerId!==TECHNICAL_LINE_OWNER || guideState.pointerId!==event.pointerId) return;
        const point = svgPoint(svg,event); if (!point) return;
        event.preventDefault(); event.stopImmediatePropagation();
        guideState.last={x:point.x,y:point.y};
        const line=tempLine(); line.setAttribute('x2',point.x.toFixed(2)); line.setAttribute('y2',point.y.toFixed(2));
      }, true);
      svg.addEventListener('pointerup', (event) => {
        if (!guideState?.anchor || guideState.ownerId!==TECHNICAL_LINE_OWNER || guideState.pointerId!==event.pointerId) return;
        const point=svgPoint(svg,event)||guideState.last; const a=guideState.anchor;
        event.preventDefault(); event.stopImmediatePropagation();
        try{svg.releasePointerCapture?.(event.pointerId);}catch(_error){}
        if(!point || Math.hypot(point.x-a.x,point.y-a.y)<2){
          guideState={ownerId:TECHNICAL_LINE_OWNER,stage:'technical-line-drag',anchor:null,pointerId:null};
          clearTemporaryGuide(); updateLineEditControls();
          setGuideStatus('Arraste a linha até uma distância maior antes de soltar.');
          return;
        }
        checkpoint();
        const id=`linha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
        const item={id,coordinateSpace:'geometry-v1'};
        setTechnicalLineAbsolute(item,{x1:a.x,y1:a.y,x2:point.x,y2:point.y});
        documentSettings=normalizeDocumentSettings({...documentSettings,technicalLines:[...(Array.isArray(documentSettings.technicalLines)?documentSettings.technicalLines:[]),item]});
        guideState=null; clearTemporaryGuide(); renderTechnicalLinePreview(); updateLineEditControls(); scheduleNativePublish(); markDirty(true);
        setGuideStatus('Linha adicionada e preservada na prancha. Clique em “Desenhar linha” para criar outra.');
      }, true);
      svg.addEventListener('pointercancel',cancelDrag,true);
    }
    function ensureManualSegmentCallout(segment) {
      if (!overlay || !segment || segment.id === '__linhas-gerais__') return null;
      let group = groupForSegment(segment.id);
      const count=vertexCountFromOverlay(overlay);
      const startAnchor=anchorForVertex(segment.startVertex), endAnchor=anchorForVertex(segment.endVertex);
      // Number(null) === 0 colocava nomes sem posição manual em (0,0),
      // fora do mapa e longe do trecho do confrontante.
      const finiteCoordinate=(value)=>value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
      const sx=finiteCoordinate(startAnchor?.getAttribute('cx')), sy=finiteCoordinate(startAnchor?.getAttribute('cy'));
      const ex=finiteCoordinate(endAnchor?.getAttribute('cx')), ey=finiteCoordinate(endAnchor?.getAttribute('cy'));
      const frame=mapFrameFromOverlay();
      const manualX=finiteCoordinate(segment.labelX),manualY=finiteCoordinate(segment.labelY);
      const cx=manualX !== null?manualX:(sx !== null && ex !== null?(sx+ex)/2:frame.x+frame.w/2);
      const cy=manualY !== null?manualY:(sy !== null && ey !== null?(sy+ey)/2:frame.y+frame.h/2);
      const ns='http://www.w3.org/2000/svg';
      if(!group){
        group=document.createElementNS(ns,'g'); group.setAttribute('class','sv-confrontante-callout sv-confrontante-range sv-confrontante-manual-guide'); overlay.appendChild(group);
        const label=document.createElementNS(ns,'g'); label.setAttribute('class','sv-confrontante-label'); group.appendChild(label);
        const rot=document.createElementNS(ns,'g'); rot.setAttribute('class','sv-confrontante-label-rotator'); label.appendChild(rot);
        const hit=document.createElementNS(ns,'rect'); hit.setAttribute('class','sv-confrontante-hitbox'); hit.setAttribute('rx','3'); hit.setAttribute('ry','3'); hit.setAttribute('fill','none'); hit.setAttribute('stroke','none'); hit.setAttribute('pointer-events','all'); rot.appendChild(hit);
        const text=document.createElementNS(ns,'text'); text.setAttribute('class','sv-confrontante-name-text'); text.setAttribute('text-anchor','middle'); text.setAttribute('font-size','15'); text.setAttribute('font-weight','750'); text.setAttribute('fill','#111827'); text.setAttribute('paint-order','stroke fill'); text.setAttribute('stroke','#ffffff'); text.setAttribute('stroke-width','2'); rot.appendChild(text);
      }
      // Um rótulo nomeado não pode continuar oculto pelo estilo de uma
      // representação anterior, mesmo que a edição reabra a mesma gleba.
      if (safeText(segment.nome || '').trim()) {
        group.style.removeProperty('display');
        group.removeAttribute('display');
      }
      const name=safeText(segment.nome||'').trim();
      const property=safeText(segment.propriedade||'').trim();
      const cpfDisplay=window.SurveyorTechnicalMapBridge?.cpfCnpjDisplay?.(segment.cpfCnpj)||{value:safeText(segment.cpfCnpj||'').trim(),label:''};
      const cpfCnpj=cpfDisplay.value;
      const showProperty=typeof segment.showPropertyInLabel==='boolean'?segment.showPropertyInLabel:Boolean(property);
      const showCpf=segment.showCpfCnpjInLabel===true && Boolean(cpfCnpj);
      const displayName=showProperty&&property?(name?`${name} — ${property}`:property):name;
      const cpfLine=showCpf?(cpfDisplay.label||`CPF/CNPJ: ${cpfCnpj}`):'';
      let label=group.querySelector('.sv-confrontante-label');
      let rot=group.querySelector('.sv-confrontante-label-rotator');
      if(label && !rot){rot=document.createElementNS(ns,'g');rot.setAttribute('class','sv-confrontante-label-rotator');while(label.firstChild)rot.appendChild(label.firstChild);label.appendChild(rot);}
      let hit=group.querySelector('.sv-confrontante-hitbox');
      let text=group.querySelector('.sv-confrontante-name-text');
      if(rot && !text){text=document.createElementNS(ns,'text');text.setAttribute('class','sv-confrontante-name-text');text.setAttribute('text-anchor','middle');text.setAttribute('font-size','15');text.setAttribute('font-weight','750');text.setAttribute('fill','#111827');text.setAttribute('paint-order','stroke fill');text.setAttribute('stroke','#ffffff');text.setAttribute('stroke-width','2');rot.appendChild(text);}
      let cpfText=group.querySelector('.sv-confrontante-cpf-text');
      if(rot && !cpfText){cpfText=document.createElementNS(ns,'text');cpfText.setAttribute('class','sv-confrontante-cpf-text');cpfText.setAttribute('text-anchor','middle');cpfText.setAttribute('font-size','10.5');cpfText.setAttribute('font-weight','700');cpfText.setAttribute('fill','#111827');cpfText.setAttribute('paint-order','stroke fill');cpfText.setAttribute('stroke','#ffffff');cpfText.setAttribute('stroke-width','1.5');rot.appendChild(cpfText);}
      const widestText=Math.max(displayName.length,cpfLine.length*.72);
      const width=Math.max(90,Math.min(380,widestText*8.4+26)), height=showCpf?38:28;
      const x1=cx-width/2,y1=cy-height/2,x2=cx+width/2,y2=cy+height/2;
      Object.assign(group.dataset,{labelKey:segment.id,segmentId:segment.id,confrontanteName:name,confrontanteProperty:property,cpfCnpj,showPropertyInLabel:showProperty?'1':'0',showCpfCnpjInLabel:segment.showCpfCnpjInLabel===true?'1':'0',tipoLimite:safeText(segment.tipoLimite||''),orientacao:safeText(segment.orientacao||''),observacao:safeText(segment.observacao||''),startVertex:String(segment.startVertex||1),endVertex:String(segment.endVertex||2),vertexCount:String(count),labelScale:String(segment.labelScale||1),labelRotation:String(segment.labelRotation||0),labelColor:confrontanteLabelColor(segment.labelColor),labelColorCustomized:segment.labelColorCustomized===true?'1':'0',dx:String(segment.labelDx||0),dy:String(segment.labelDy||0),baseX1:String(x1),baseY1:String(y1),baseX2:String(x2),baseY2:String(y2),mapX:String(frame.x),mapY:String(frame.y),mapW:String(frame.w),mapH:String(frame.h)});
      if(hit){hit.setAttribute('x',x1.toFixed(2));hit.setAttribute('y',y1.toFixed(2));hit.setAttribute('width',width.toFixed(2));hit.setAttribute('height',height.toFixed(2));}
      if(text){text.setAttribute('x',cx.toFixed(2));text.setAttribute('y',(showCpf?cy-1:cy+5).toFixed(2));text.textContent=displayName;}
      if(cpfText){cpfText.setAttribute('x',cx.toFixed(2));cpfText.setAttribute('y',(cy+12).toFixed(2));cpfText.textContent=cpfLine;cpfText.style.display=cpfLine?'':'none';}
      const confrontanteVisual=elementVisual('confrontantes');
      applyConfrontanteLabelColor(group, segmentFontColor(segment,confrontanteVisual.color));
      if(rot) rot.setAttribute('transform',`rotate(${Number(segment.labelRotation||0).toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`);
      if(label){label.style.display=(displayName||cpfLine)?'':'none';label.setAttribute('transform',`translate(${Number(segment.labelDx||0).toFixed(2)} ${Number(segment.labelDy||0).toFixed(2)}) translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${(Number(segment.labelScale||1)*Math.max(.25,Math.min(3,Number(confrontanteVisual.scale)||1))).toFixed(3)}) translate(${-cx.toFixed(2)} ${-cy.toFixed(2)})`);}
      ensureEngineConfrontanteNode(group);
      return group;
    }

    function closeSegmentActionMenus(except = null) {
      modal?.querySelectorAll?.('.sv-confrontante-segment-actions.open').forEach((menu) => {
        if (menu === except) return;
        menu.classList.remove('open');
        const button = menu.closest('.sv-confrontante-segment-row-head')?.querySelector?.('[data-segment-menu-toggle]');
        button?.setAttribute('aria-expanded','false');
      });
    }
    function removeSegment(segment) {
      if (!segment) return;
      if (!window.confirm(`Excluir o confrontante “${safeText(segment.nome || 'Confrontante').trim() || 'Confrontante'}” deste projeto?`)) return;
      checkpoint();
      const index=draftSegments.findIndex((item)=>item.id===segment.id); if(index>=0) draftSegments.splice(index,1);
      clearGuidePreview(segment.id); groupForSegment(segment.id)?.remove();
      selectedSegmentId=draftSegments[0]?.id || '';
      segmentsDirty=true; renderSegmentPanel(); if(selectedSegmentId) selectSegmentRow(selectedSegmentId);
    }
    function openConfrontanteRegistration(segment) {
      if (!segment || !modal) return;
      closeSegmentActionMenus();
      modal.querySelector('[data-confrontante-registration]')?.remove();
      const popup=document.createElement('div');
      popup.className='sv-confrontante-registration-backdrop';
      popup.dataset.confrontanteRegistration='1';
      popup.innerHTML=`<section class="sv-confrontante-registration-card" role="dialog" aria-modal="true" aria-label="Cadastro do confrontante"><header><div><strong>Cadastro do confrontante</strong><small>Estes dados ficam salvos no projeto e serão reutilizados nas próximas pranchas, croquis e memoriais.</small></div><button type="button" data-registration-close aria-label="Fechar">×</button></header><div class="sv-confrontante-registration-grid"><label class="full">Nome do confrontante<input type="text" data-registration-field="nome" value="${escapeHtml(segment.nome || '')}" placeholder="Ex.: João da Silva"></label><div class="sv-confrontante-registration-field full"><div class="sv-confrontante-registration-field-head"><span>Nome da propriedade</span><label class="sv-confrontante-registration-visibility" title="Exibir nome da propriedade na prancha"><input type="checkbox" aria-label="Exibir nome da propriedade na prancha" data-registration-toggle="showPropertyInLabel" ${(typeof segment.showPropertyInLabel==='boolean'?segment.showPropertyInLabel:Boolean(safeText(segment.propriedade||'').trim()))?'checked':''}></label></div><input type="text" data-registration-field="propriedade" value="${escapeHtml(segment.propriedade || '')}" placeholder="Ex.: Fazenda Jacuba (opcional)"></div><div class="sv-confrontante-registration-field"><div class="sv-confrontante-registration-field-head"><span>CPF/CNPJ</span><label class="sv-confrontante-registration-visibility" title="Exibir CPF/CNPJ na prancha"><input type="checkbox" aria-label="Exibir CPF/CNPJ na prancha" data-registration-toggle="showCpfCnpjInLabel" ${segment.showCpfCnpjInLabel===true?'checked':''}></label></div><input type="text" inputmode="numeric" autocomplete="off" maxlength="18" data-sv-mask-type="cpfcnpj" data-registration-field="cpfCnpj" value="${escapeHtml(segment.cpfCnpj || '')}" placeholder="Opcional"></div><label>Orientação da confrontação<select data-registration-field="orientacao">${selectOptions(CONFRONTANTE_ORIENTACAO_OPTIONS, segment.orientacao)}</select></label><label>Tipo de divisa<select data-registration-field="tipoLimite">${selectOptions(CONFRONTANTE_LIMITE_OPTIONS, segment.tipoLimite)}</select></label><label>Cor do nome<input type="color" data-registration-field="labelColor" value="${confrontanteLabelColor(segment.labelColor)}" aria-label="Cor do nome do confrontante"></label><label>De<select data-registration-field="startVertex">${vertexOptions(vertexCountFromOverlay(overlay),segment.startVertex)}</select></label><label>Até<select data-registration-field="endVertex">${vertexOptions(vertexCountFromOverlay(overlay),segment.endVertex)}</select></label><label class="full">Observações<textarea rows="3" data-registration-field="observacao" placeholder="Ex.: cerca de arame, estrada vicinal, margem do córrego...">${escapeHtml(segment.observacao || '')}</textarea></label></div><footer><button type="button" class="btn" data-registration-close>Cancelar</button><button type="button" class="btn primary" data-registration-save>Aplicar cadastro</button></footer></section>`;
      modal.appendChild(popup);
      const close=()=>popup.remove();
      popup.querySelectorAll('[data-registration-close]').forEach((button)=>button.addEventListener('click',close));
      popup.addEventListener('pointerdown',(event)=>{if(event.target===popup)close();});
      popup.addEventListener('keydown',(event)=>{if(event.key==='Escape'){event.preventDefault();close();}});
      popup.querySelector('[data-registration-save]')?.addEventListener('click',()=>{
        const read=(field)=>safeText(popup.querySelector(`[data-registration-field="${field}"]`)?.value).trim();
        const nome=read('nome');
        if(!nome){toast('Informe o nome ou a identificação do confrontante.','error');popup.querySelector('[data-registration-field="nome"]')?.focus();return;}
        const startVertex=Math.max(1,Number(read('startVertex'))||segment.startVertex||1);
        const endVertex=Math.max(1,Number(read('endVertex'))||segment.endVertex||2);
        const rangeIndexes=forwardConfrontanteRangeIndexes(startVertex,endVertex,vertexCountFromOverlay(overlay));
        if(!rangeIndexes.length){toast('Escolha vértices diferentes para definir o intervalo.','error');return;}
        // Checar conflitos antes de modificar o cadastro/salvar checkpoint.
        const conflicting=draftSegments.find((other)=>other!==segment && other.hidden!==true
          && occupiedConfrontanteIndexes(other,vertexCountFromOverlay(overlay)).some((index)=>rangeIndexes.includes(index))
          && (safeText(other.nome||'').trim().localeCompare(nome,'pt',{sensitivity:'base'})!==0
            || !occupiedConfrontanteIndexes(other,vertexCountFromOverlay(overlay)).every((index)=>rangeIndexes.includes(index))));
        if(conflicting){toast('O intervalo contém outra confrontação. Ajuste o cadastro existente antes de aplicar.','error');return;}
        checkpoint();
        const rangeResult=applyConfrontanteRange(segment,nome,startVertex,endVertex);
        if(!rangeResult.ok){toast(rangeResult.error,'error');return;}
        segment.nome=nome;
        segment.propriedade=read('propriedade');
        segment.cpfCnpj=window.SurveyorTechnicalMapBridge?.formatCpfCnpj?.(read('cpfCnpj'))||read('cpfCnpj');
        segment.showPropertyInLabel=Boolean(popup.querySelector('[data-registration-toggle="showPropertyInLabel"]')?.checked);
        segment.showCpfCnpjInLabel=Boolean(popup.querySelector('[data-registration-toggle="showCpfCnpjInLabel"]')?.checked);
        segment.orientacao=read('orientacao');
        segment.tipoLimite=read('tipoLimite');
        segment.labelColor=confrontanteLabelColor(read('labelColor'));
        segment.labelColorCustomized=true;
        segment.observacao=read('observacao');
        const group=ensureManualSegmentCallout(segment);
        if(group){
          group.dataset.tipoLimite=segment.tipoLimite;
          group.dataset.orientacao=segment.orientacao;
          group.dataset.observacao=segment.observacao;
          applyConfrontanteLabelColor(group, segment.labelColor);
        }
        segmentsDirty=true;
        close(); renderSegmentPanel(); selectSegmentRow(segment.id);
        toast('Cadastro atualizado na edição. Salve as alterações para gravá-lo no projeto.','success');
      });
      setTimeout(()=>popup.querySelector('[data-registration-field="nome"]')?.focus(),0);
    }
    function makeCompactSegment(startVertex,endVertex) {
      return {
        id:`manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
        nome:'',propriedade:'',cpfCnpj:'',showPropertyInLabel:false,showCpfCnpjInLabel:false,tipoLimite:'',orientacao:'',observacao:'',startVertex,endVertex,
        freeLine1X1:null,freeLine1Y1:null,freeLine1X2:null,freeLine1Y2:null,
        freeLine2X1:null,freeLine2Y1:null,freeLine2X2:null,freeLine2Y2:null,
        labelDx:0,labelDy:0,labelScale:1,labelRotation:0,labelColor:'#111827',extraLines:[],hidden:false
      };
    }
    function segmentVertexDisplayLabel(vertexNumber) {
      const index=Math.max(1,Number(vertexNumber)||1);
      const labels=Array.from(overlay?.querySelectorAll?.('.sv-vertex-label')||[]);
      const exact=labels.find((node)=>vertexIndexFromKey(vertexLabelKey(node))===index);
      return safeText(exact?.dataset?.vertex || exact?.textContent || '').trim() || String(index);
    }
    // Intervalos digitados na prancha seguem a sequência progressiva de
    // vértices: V-01 até V-13 cobre V01→V02 ... V12→V13.
    // Ao persistir os índices explícitos, não se usa o "arco mais curto"
    // usado por confrontações legadas do mapa.
    function forwardConfrontanteRangeIndexes(startVertex,endVertex,count) {
      const total=Math.max(0,Number(count)||0);
      if(total<2)return [];
      let current=Math.max(1,Math.min(total,Number(startVertex)||1));
      const last=Math.max(1,Math.min(total,Number(endVertex)||2));
      const indexes=[];
      while(current!==last && indexes.length<total){
        indexes.push(current-1);
        current=(current%total)+1;
      }
      return indexes;
    }
    function occupiedConfrontanteIndexes(segment,count) {
      return layoutItemSegmentIndexes(segment,count);
    }
    function applyConfrontanteRange(segment,nome,startVertex,endVertex) {
      const total=vertexCountFromOverlay(overlay);
      const indexes=forwardConfrontanteRangeIndexes(startVertex,endVertex,total);
      if(!indexes.length)return {ok:false,error:'Selecione vértices inicial e final diferentes.'};
      const desired=new Set(indexes);
      const obsolete=[];
      for(const other of draftSegments){
        if(other===segment || other.hidden===true)continue;
        const occupied=occupiedConfrontanteIndexes(other,total);
        if(!occupied.some((index)=>desired.has(index)))continue;
        const existingName=safeText(other.nome||'').trim();
        if(existingName && existingName.localeCompare(nome,'pt',{sensitivity:'base'})!==0){
          return {ok:false,error:`Já existe um confrontante diferente nesse intervalo: ${existingName}. Ajuste o intervalo antes de substituir.`};
        }
        if(!occupied.every((index)=>desired.has(index))){
          return {ok:false,error:'Há uma confrontação que atravessa parte desse intervalo. Ajuste-a antes de aplicar.'};
        }
        obsolete.push(other);
      }
      // Um único registro lógico representa o intervalo inteiro, logo só
      // haverá um grupo de rótulo SVG para todos os trechos preenchidos.
      for(const other of obsolete){
        const index=draftSegments.indexOf(other);
        if(index>=0)draftSegments.splice(index,1);
        clearGuidePreview(other.id);
        groupForSegment(other.id)?.remove();
      }
      segment.startVertex=startVertex;
      segment.endVertex=endVertex;
      segment.vertices=[];
      segment.segmentIndexes=indexes;
      return {ok:true};
    }
    function renderSegmentPanel() {
      const list=modal?.querySelector('[data-segment-list]'); if(!list)return;
      refreshConfrontanteAutoControls();
      const count=vertexCountFromOverlay(overlay);
      const ownerByEdge=new Map();
      const used=new Set();
      // Um confrontante que cobre 12 lados precisa aparecer nas 12 caixas,
      // sem ser cadastrado como 12 rótulos diferentes no desenho.
      draftSegments.filter((segment)=>segment && segment.hidden!==true).forEach((segment)=>{
        occupiedConfrontanteIndexes(segment,count).forEach((index)=>{
          if(!ownerByEdge.has(index))ownerByEdge.set(index,segment);
        });
      });
      const descriptors=[];
      for(let startVertex=1;startVertex<=count;startVertex+=1){
        const endVertex=startVertex===count?1:startVertex+1;
        const segment=ownerByEdge.get(startVertex-1)||null;
        if(segment)used.add(segment.id);
        descriptors.push({startVertex,endVertex,segment});
      }
      draftSegments.filter((segment)=>!used.has(segment.id)).forEach((segment)=>descriptors.push({startVertex:Number(segment.startVertex)||1,endVertex:Number(segment.endVertex)||2,segment}));
      list.replaceChildren();
      descriptors.forEach((descriptor)=>{
        let segment=descriptor.segment;
        const row=document.createElement('div');
        row.className='sv-confrontante-compact-row';
        if(segment)row.dataset.segmentId=segment.id;
        const label=document.createElement('strong');
        const startLabel=segmentVertexDisplayLabel(descriptor.startVertex),endLabel=segmentVertexDisplayLabel(descriptor.endVertex);
        label.textContent=`Do ${startLabel} ao ${endLabel}`;
        const input=document.createElement('input');
        input.type='text';input.className='sv-confrontante-compact-input';input.placeholder='Nome do confrontante';input.value=safeText(segment?.nome||'');input.setAttribute('aria-label',`Confrontante do vértice ${startLabel} ao ${endLabel}`);
        const actions=document.createElement('div');actions.className='sv-confrontante-segment-actions';
        const menuButton=document.createElement('button');menuButton.type='button';menuButton.dataset.segmentMenuToggle='1';menuButton.textContent='⋯';menuButton.title='Mais informações';menuButton.setAttribute('aria-label','Mais informações do confrontante');menuButton.setAttribute('aria-expanded','false');
        const menu=document.createElement('div');menu.className='sv-confrontante-segment-menu';menu.setAttribute('role','menu');menu.innerHTML='<button type="button" data-segment-register role="menuitem">Cadastro completo</button><button type="button" class="danger" data-segment-remove role="menuitem">Excluir confrontante</button>';
        actions.append(menuButton,menu);row.append(label,input,actions);list.appendChild(row);
        const ensureSegment=()=>{
          if(segment)return segment;
          checkpoint();
          segment=makeCompactSegment(descriptor.startVertex,descriptor.endVertex);
          draftSegments.push(segment);row.dataset.segmentId=segment.id;segmentsDirty=true;
          return segment;
        };
        const syncName=()=>{
          const typed=safeText(input.value);
          if(!segment && !typed.trim())return;
          const current=ensureSegment();
          current.nome=typed;
          // Durante a digitação, atualizar apenas o texto. Recalcular âncoras,
          // caixa de colisão e registrar objetos no editor SVG a cada tecla
          // sobrecarrega a bancada em imóveis com muitos vértices.
          const liveGroup=groupForSegment(current.id) || ensureManualSegmentCallout(current);
          if(liveGroup){
            liveGroup.dataset.confrontanteName=typed;
            const property=safeText(current.propriedade||'').trim();
            const showProperty=typeof current.showPropertyInLabel==='boolean' ? current.showPropertyInLabel : Boolean(property);
            const nameNode=liveGroup.querySelector('.sv-confrontante-name-text');
            if(nameNode)nameNode.textContent=showProperty&&property?(typed.trim()?`${typed.trim()} — ${property}`:property):typed.trim();
          }
          // Manter todos os campos do mesmo intervalo visualmente sincronizados.
          list.querySelectorAll('.sv-confrontante-compact-row').forEach((otherRow)=>{
            if(otherRow.dataset.segmentId===current.id){
              const otherInput=otherRow.querySelector('.sv-confrontante-compact-input');
              if(otherInput && otherInput!==input)otherInput.value=typed;
            }
          });
          selectedSegmentId=current.id;segmentsDirty=true;scheduleNativePublish();
          if(!hasUnsavedChanges)markDirty(true);
        };
        input.addEventListener('focus',()=>{if(segment)selectSegmentRow(segment.id);});
        input.addEventListener('input',syncName);
        input.addEventListener('change',()=>{
          if(!segment)return;
          // A atualização geométrica completa fica para a confirmação do campo.
          const current=segment;
          const liveGroup=ensureManualSegmentCallout(current);
          if(liveGroup)liveGroup.dataset.confrontanteName=safeText(current.nome);
          refreshConfrontanteAutoControls();
          checkpoint();scheduleNativePublish();markDirty(true);
        });
        menuButton.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();const host=event.currentTarget.closest('.sv-confrontante-segment-actions');const opening=!host.classList.contains('open');closeSegmentActionMenus(host);host.classList.toggle('open',opening);menuButton.setAttribute('aria-expanded',opening?'true':'false');});
        menu.querySelector('[data-segment-register]')?.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();const current=ensureSegment();closeSegmentActionMenus();openConfrontanteRegistration(current);});
        menu.querySelector('[data-segment-remove]')?.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();if(!segment){closeSegmentActionMenus();return;}closeSegmentActionMenus();removeSegment(segment);});
      });
    }

    function selectedSegment() { return segmentById(selectedSegmentId) || draftSegments[0] || null; }
    function drawGeneralLine() {
      if (guideState?.ownerId === TECHNICAL_LINE_OWNER) return cancelGuideMode('Desenho da linha cancelado.');
      checkpoint();
      startTechnicalLineMode();
    }
    function removeLastGeneralLine() { const lines=Array.isArray(documentSettings.technicalLines)?documentSettings.technicalLines:[]; const index=lines.map((item,i)=>({item,i})).filter(({item})=>!isVertexAutoLine(item)).at(-1)?.i; if(!Number.isInteger(index))return toast('Não há linha técnica manual para remover.', 'info'); checkpoint(); documentSettings=normalizeDocumentSettings({...documentSettings,technicalLines:lines.filter((_item,i)=>i!==index)}); clearSelectedLine(); renderTechnicalLinePreview(); scheduleNativePublish(); markDirty(true); setGuideStatus('Última linha técnica manual removida. Use Desfazer para restaurá-la.'); }

    function editorVertexCount() {
      const fromOverlay = vertexCountFromOverlay(overlay);
      const fromLabels = overlay?.querySelectorAll?.('.sv-vertex-label')?.length || 0;
      const fromSegments = Math.max(0, ...draftSegments.flatMap((item) => [Number(item?.startVertex || 0), Number(item?.endVertex || 0), ...(Array.isArray(item?.vertices) ? item.vertices.map(Number) : [])]).filter(Number.isFinite));
      return Math.max(fromOverlay, fromLabels, fromSegments);
    }
    function addAreaName(initialText = '', { focus = true } = {}) {
      safeCheckpoint('adicionar nome no mapa');
      const id=`area-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
      const index=(documentSettings.areaNames||[]).length;
      const textValue=safeText(initialText).trim() || `Nome ${index+1}`;
      const frame=mapFrameFromOverlay(),geom=geometryFrameFromOverlay();
      const startX=geom.x+geom.w/2,startY=geom.y+geom.h/2+index*Math.min(18,Math.max(6,geom.h*.04));
      const item={id,text:textValue,coordinateSpace:'geometry-v1',x:(startX-frame.x)/frame.w,y:(startY-frame.y)/frame.h,xG:(startX-geom.x)/geom.w,yG:(startY-geom.y)/geom.h,scale:1,rotation:0};
      documentSettings.areaNames=[...(documentSettings.areaNames||[]),item];
      selectedAreaNameId=id;
      syncAreaNameLabels();
      try { editorEngine?.addNode?.({id:`document-area-name:${id}`,type:'area-name',data:{id,x:startX,y:startY}}); editorEngine?.renderNode?.(`document-area-name:${id}`); } catch (error) { console.warn('[Surveyor] Nome criado sem sincronização imediata com engine:', error); }
      syncAreaControls(); syncSettingsControls();
      const input=modal?.querySelector('[data-area-name-input]');
      if(focus){input?.focus(); input?.select?.();}
      return item;
    }
    function removeAreaName() {
      const item=selectedAreaName(); if(!item)return;
      safeCheckpoint('excluir nome do mapa');
      documentSettings=normalizeDocumentSettings({
        ...documentSettings,
        areaNames:(documentSettings.areaNames||[]).filter((entry)=>entry.id!==item.id)
      });
      try { editorEngine?.removeNode?.(`document-area-name:${item.id}`); } catch (error) { console.warn('[Surveyor] Nome excluído localmente; engine será sincronizado depois:', error); }
      selectedAreaNameId=documentSettings.areaNames?.[0]?.id||'';
      syncAreaNameLabels(); syncAreaControls(); syncSettingsControls();
    }
    function addSegment() {
      const count = editorVertexCount(); if (count < 2) return toast('A geometria precisa ter pelo menos dois vértices.', 'error');
      const registeredSegments=draftSegments.filter((item)=>item?.id);
      const lastRegistered=registeredSegments.at(-1);
      const start = lastRegistered ? Math.max(1, Math.min(count, Number(lastRegistered.endVertex) || 1)) : 1;
      const end = (start % count) + 1;
      draftSegments.push({
        id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
        nome: 'Novo confrontante', propriedade:'', cpfCnpj: '', showPropertyInLabel:false, showCpfCnpjInLabel:false, tipoLimite: '', orientacao:'', observacao:'', startVertex: start, endVertex: end,
        freeLine1X1:null, freeLine1Y1:null, freeLine1X2:null, freeLine1Y2:null,
        freeLine2X1:null, freeLine2Y1:null, freeLine2X2:null, freeLine2Y2:null,
        labelDx:0,labelDy:0,labelScale:1,labelRotation:0,labelColor:'#111827',extraLines:[],hidden:false
      });
      const created = draftSegments[draftSegments.length - 1];
      try { ensureManualSegmentCallout(created); } catch (error) { console.warn('[Surveyor] Confrontante criado; chamada visual será reconstruída pela renderização:', error); }
      selectedSegmentId=created.id; segmentsDirty = true; renderSegmentPanel(); selectSegmentRow(created.id);
      const row=modal?.querySelector?.(`.sv-confrontante-segment-row[data-segment-id="${globalThis.CSS?.escape ? globalThis.CSS.escape(created.id) : created.id}"]`) || Array.from(modal?.querySelectorAll?.('.sv-confrontante-segment-row') || []).at(-1);
      row?.scrollIntoView?.({block:'nearest'}); row?.querySelector('input')?.focus();
      return created;
    }
    function bindCriticalPanelActions() {
      const bind=(selector,handler)=>{
        const button=modal?.querySelector(selector); if(!button || button.dataset.directBound==='1')return;
        button.dataset.directBound='1';
        button.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();handler(event);});
      };
      bind('[data-editor-action="add-area-name"]',()=>addAreaName());
      bind('[data-editor-action="remove-area-name"]',()=>removeAreaName());
      bind('[data-editor-action="add-confrontante"]',()=>{safeCheckpoint('adicionar confrontante');addSegment();});
      bind('[data-editor-action="draw-line"]',()=>drawGeneralLine());
      bind('[data-editor-action="toggle-auto-confrontantes"]',()=>{
        refreshConfrontanteAutoControls();
        const picker=modal?.querySelector('[data-confrontante-auto-picker]');
        const button=modal?.querySelector('[data-editor-action="toggle-auto-confrontantes"]');
        if(!picker)return;
        picker.hidden=!picker.hidden;
        button?.setAttribute('aria-expanded',picker.hidden?'false':'true');
        if(!picker.hidden)modal?.querySelector('[data-confrontante-auto-select]')?.focus();
      });
      const picker=modal?.querySelector('[data-confrontante-auto-select]');
      picker?.addEventListener('change',()=>{
        generateConfrontanteAutoLines();
        const panel=modal?.querySelector('[data-confrontante-auto-picker]');
        if(panel)panel.hidden=true;
        modal?.querySelector('[data-editor-action="toggle-auto-confrontantes"]')?.setAttribute('aria-expanded','false');
      });
      bind('[data-editor-action="edit-lines"]',()=>toggleLineEditMode());
      bind('[data-editor-action="delete-selected-line"]',()=>deleteSelectedLine());
      bind('[data-editor-action="remove-line"]',()=>removeLastGeneralLine());
      bind('[data-editor-action="draw-servitude"]',()=>startManualServitudeDrawing());
      bind('[data-editor-action="finish-servitude"]',()=>finishManualServitudeDrawing());
      bind('[data-editor-action="delete-servitude"]',()=>deleteManualServitude());
    }


    function commitPreviewState() {
      if (!active || !overlay) return false;
      syncVisualStateFromOverlay();
      promoteAreaNamesToGeometrySpace();
      promoteTechnicalLinesToGeometrySpace();
      writeDocumentSettings(options, documentSettings);
      const projectSegments = draftSegments.map(normalizedSegmentForProject);
      writeProjectLayout(options, { segments: projectSegments, documentSettings, updatedAt: new Date().toISOString() });
      publishNativeCanvas();
      return true;
    }


    function patchDocumentSettings(patch = {}, { checkpointBefore = false } = {}) {
      if (!patch || typeof patch !== 'object') return normalizeDocumentSettings(documentSettings);
      if (checkpointBefore) checkpoint();
      documentSettings = normalizeDocumentSettings({ ...documentSettings, ...patch });
      applyDocumentSettingsToOverlay();
      syncSettingsControls();
      syncRangeProgress(modal);
      scheduleNativePublish();
      markDirty(true);
      return normalizeDocumentSettings(documentSettings);
    }

    function patchLiveFields(values = {}) {
      if (!active || !overlay || !values || typeof values !== 'object') return false;
      let changed = false;
      Object.entries(values).forEach(([field, raw]) => {
        const value = safeText(raw).trim();
        overlay.querySelectorAll('[data-live-field]').forEach((node) => {
          if (safeText(node.dataset.liveField) !== field) return;
          node.textContent = value;
          changed = true;
        });
        overlay.querySelectorAll('[data-live-field-row]').forEach((row) => {
          if (safeText(row.dataset.liveFieldRow) !== field) return;
          const valueNode=row.querySelector('[data-live-field-value]');
          if(valueNode)valueNode.textContent=value;
          row.style.display = value ? '' : 'none';
          changed = true;
        });
      });
      if (changed && nativeMode && nativeDocument) {
        const api = window.SurveyorNativeTechnicalDocument;
        Object.entries(values).forEach(([field,value]) => {
          api?.patchField?.(nativeDocument,field,value);
          const node=editorEngine?.scene?.get?.(`native:field:${field}`); if(node){node.data={...(node.data||{}),field,text:safeText(value),fontWeight:Number(node.data?.fontWeight||400)||400};editorEngine.renderNode?.(node.id);}
        });
        publishNativeCanvas();
      }
      return changed;
    }

    function liveElementFallbackSelectors(element) {
      switch (safeText(element)) {
        case 'cotas': return ['.sv-cad-dimension-group[data-owner="perimeter"]','.sv-live-element-cotas'];
        case 'glebaCotas': return ['.sv-cad-dimension-group:not([data-owner="perimeter"])','.sv-live-element-glebaCotas'];
        case 'vertices': return ['.sv-vertex-anchor','.sv-vertex-label','.sv-live-element-vertices'];
        case 'confrontantes': return ['.sv-confrontante-callout','.sv-live-element-confrontantes'];
        case 'north': return ['.sv-live-element-north'];
        case 'grid': return ['.sv-live-element-grid'];
        case 'scale': return ['.sv-live-element-scale'];
        default: return [];
      }
    }
    function liveElementNodes(root, element) {
      if (!root) return [];
      const selectors = [`[data-live-element="${safeText(element).replace(/"/g,'\"')}"]`, ...liveElementFallbackSelectors(element)];
      const found = new Set();
      selectors.forEach((selector) => {
        try { root.querySelectorAll(selector).forEach((node) => found.add(node)); } catch (_error) {}
      });
      return Array.from(found);
    }
    function applyLiveElementState(root = overlay) {
      if (!root) return false;
      let changed = false;
      Object.entries(liveElementState).forEach(([element, enabled]) => {
        const visible = Boolean(enabled);
        liveElementNodes(root, element).forEach((node) => {
          node.dataset.liveElement = element;
          if (visible) {
            node.style.removeProperty('display');
            node.removeAttribute('display');
            node.setAttribute('aria-hidden','false');
          } else {
            node.style.setProperty('display','none','important');
            node.setAttribute('display','none');
            node.setAttribute('aria-hidden','true');
          }
          changed = true;
        });
      });
      return changed;
    }
    function patchLiveElements(values = {}, { persist = false } = {}) {
      if (!values || typeof values !== 'object') return false;
      liveElementState = { ...liveElementState, ...values };
      if (persist && active) {
        documentSettings.elementVisibility = normalizeElementVisibility({
          elementVisibility: { ...documentSettings.elementVisibility, ...values }
        });
        markDirty(true);
      }
      if (nativeMode && nativeDocument) {
        const api = window.SurveyorNativeTechnicalDocument;
        Object.entries(values).forEach(([key,value]) => {
          api?.patchElement?.(nativeDocument,key,value);
          const node=editorEngine?.scene?.get?.(`native:layer:${key}`); if(node){node.visible=Boolean(value);editorEngine.renderNode?.(node.id);}
        });
      }
      if (!active || !overlay) return false;
      const changed = applyLiveElementState(overlay);
      if (changed) publishNativeCanvas();
      return changed;
    }

    function patchLiveAssets(values = {}) {
      if (!active || !overlay || !values || typeof values !== 'object') return false;
      let changed = false;
      Object.entries(values).forEach(([asset, raw]) => {
        const value = safeText(raw).trim();
        overlay.querySelectorAll('[data-live-asset],[data-live-asset-value]').forEach((node) => {
          if (safeText(node.dataset.liveAsset || node.dataset.liveAssetValue) !== asset) return;
          if (value) {
            node.setAttribute('href', value);
            node.removeAttribute('display');
          } else {
            node.removeAttribute('href');
            node.setAttribute('display', 'none');
          }
          changed = true;
        });
      });
      return changed;
    }

    async function handleEditorClick(event) {
        const toolButton=event.target?.closest?.('[data-editor-tool]');
        if(toolButton){
          let next=toolButton.dataset.editorTool;
          if(next==='map') next=safeText(modal?.dataset?.lastMapTool || 'elements').trim() || 'elements';
          const collapse=activeToolPanel===next && modal.querySelector('[data-tool-drawer]')?.classList.contains('open');
          setActiveToolPanel(presentationMode==='inline' ? next : (collapse ? '' : next));
          return;
        }
        const action = event.target?.closest?.('[data-editor-action]')?.dataset?.editorAction; if (!action) return;
        if (action === 'close-tool-panel') { if(presentationMode!=='inline') setActiveToolPanel(''); return; }
        if (action === 'cancel') return close();
        if (action === 'undo') return undoEdit(); if (action === 'redo') return redoEdit();
        if (action === 'draw-line') return drawGeneralLine();
        if (action === 'draw-servitude') return startManualServitudeDrawing();
        if (action === 'finish-servitude') return finishManualServitudeDrawing();
        if (action === 'delete-servitude') return deleteManualServitude();
        if (action === 'edit-lines') return toggleLineEditMode();
        if (action === 'delete-selected-line') return deleteSelectedLine();
        if (action === 'remove-line') return removeLastGeneralLine();
        if (action === 'reset-signature-position') {
          const mode=activeSignatureMode();if(mode==='none')return;checkpoint();
          if(mode==='imported'){documentSettings.importedSignatureX=null;documentSettings.importedSignatureY=null;}else{documentSettings.signatureX=null;documentSettings.signatureY=null;}
          syncSettingsControls();scheduleNativePublish();return;
        }
        if(action==='import-signature'){modal?.querySelector?.('[data-import-signature-input]')?.click();return;}
        if(action==='remove-imported-signature'){
          if(!importedSignatureAssetState)return;checkpoint();importedSignatureAssetState=null;await writeImportedSignatureAsset(options,null);documentSettings.importedSignatureEnabled=false;if(selectedSignatureMode==='imported')selectedSignatureMode='none';importedSignatureNode()?.remove();syncSettingsControls();scheduleNativePublish();markDirty(true);return;
        }
        if(action==='add-area-name') return addAreaName();
        if(action==='remove-area-name') return removeAreaName();
        if (action === 'add-confrontante') { safeCheckpoint('adicionar confrontante'); return addSegment(); }
        if (action === 'auto-organize') return autoOrganizeLayout();
        if (action === 'auto-organize-vertices') return autoOrganizeLayout();
        if (action === 'auto-organize-dimensions') return setGuideStatus('As cotas já estão na posição automática. Posições ajustadas manualmente foram preservadas.');
        if (action === 'apply-regulatory-preset') return applyRegulatoryPreset(documentSettings.regulatoryPreset || 'cartorio_incra');
        if (action === 'zoom-out') return setZoom(zoom - 0.15); if (action === 'zoom-in') return setZoom(zoom + 0.15); if (action === 'fit') return fitZoomToViewport();
        if (action === 'reset') {
          const reopenInline = presentationMode === 'inline' && presentationMount?.isConnected && presentationMount?.dataset?.betaPersonalizationSelected === '1';
          const reopenMount = presentationMount;
          clearOffsets(options); clearSegments(options); clearDocumentSettings(options);
          if (options.persistProject !== false) { try { await clearProjectVisualLayout(options); } catch (error) { console.warn('[Surveyor] Falha ao restaurar layout automático:', error); } }
          try { await options.onReset?.(); } catch (error) { console.warn('[Surveyor] Falha no callback de restauração do editor:', error); }
          close(); await options.regenerate?.();
          if (reopenInline && reopenMount?.isConnected) await start({ mode:'inline', mount:reopenMount });
          return;
        }
        if (action === 'save') {
          const releaseLoading = showSaveLoading();
          const saveButton = modal?.querySelector('[data-editor-action="save"]');
          if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Salvando...'; }
          try {
            // O estado oficial de projetos persistidos é único por projeto. Os antigos
            // caches por página/layout ficam restritos a editores locais (persistProject=false)
            // para que Prancha Técnica e Mapas/Croquis nunca voltem a divergir.
            syncVisualStateFromOverlay();
            promoteAreaNamesToGeometrySpace();
            promoteTechnicalLinesToGeometrySpace();
            const localSegments = draftSegments.map((item) => ({
              ...item,
              id:safeText(item.id), nome:safeText(item.nome).trim() || 'Confrontante',
              labelScale:Math.max(.20,Math.min(4,Number(item.labelScale||1))),
              labelRotation:Number(item.labelRotation||0)||0,
              labelColor:confrontanteLabelColor(item.labelColor),
              extraLines:Array.isArray(item.extraLines) ? item.extraLines.map((line)=>({...line})) : [],
              hidden:false
            }));
            if (options.persistProject === false) {
              persistOffsets();
              writeSegments(options, localSegments);
            }
            writeDocumentSettings(options, documentSettings);
            const projectSegments = draftSegments.map(normalizedSegmentForProject);
            // A edição documental é uma transação única: confrontantes e configurações
            // visuais recebem o mesmo timestamp. A geração seguinte pode usar o estado
            // local confirmado imediatamente enquanto a cópia remota é recarregada.
            const layoutUpdatedAt = new Date().toISOString();
            writeProjectLayout(options, { segments: projectSegments, documentSettings, updatedAt: layoutUpdatedAt });
            if (options.persistProject !== false) clearProjectContextCaches(options);
            if (options.persistProject === false) {
              toast(`Edição da ${editorNoun(options)} salva neste projeto local.`, 'success');
            } else {
              try {
                await saveProjectVisualLayout(options, { segments: projectSegments, documentSettings, updatedAt: layoutUpdatedAt });
                writeProjectLayout(options, { segments: projectSegments, documentSettings, updatedAt: layoutUpdatedAt, syncStatus:'confirmed' });
                toast(`Edição da ${editorNoun(options)} salva no projeto.`, 'success');
              } catch (error) {
                console.error('[Surveyor] Falha ao salvar layout dos confrontantes no projeto:', error);
                // O layout provisório fica no navegador, mas NÃO é um salvamento oficial.
                // Não fechar o editor nem liberar o PDF enquanto a nuvem não confirmar.
                markDirty(true);
                const conflict = Number(error?.status || 0) === 409 || error?.code === 'EDIT_CONFLICT';
                const message = conflict
                  ? 'O projeto mudou em outra sessão. As alterações locais foram mantidas. Confira a versão mais recente antes de salvar novamente.'
                  : 'A edição ficou neste navegador, mas NÃO foi salva na nuvem. Verifique a conexão e tente salvar novamente.';
                toast(message, 'error');
                setGuideStatus(message);
                try { window.dispatchEvent(new CustomEvent('surveyor:document-save-failed', { detail: {
                  page:safeText(optionValue(options,'page',document.body?.dataset?.page||'')),
                  projectId:safeText(optionValue(options,'projectId','')),
                  status:conflict ? 'conflict' : 'pending', source:'technical-editor'
                }})); } catch (_error) {}
                return;
              }
            }
            try { await options.onSave?.({ segments: projectSegments, documentSettings: normalizeDocumentSettings(documentSettings), updatedAt: layoutUpdatedAt }); } catch (error) { console.warn('[Surveyor] Falha no callback de salvamento do editor:', error); }
            const wasNativeMode = nativeMode;
            if (wasNativeMode) publishNativeCanvas();
            hasUnsavedChanges = false;
            updatePrimaryActionState();
            try {
              window.dispatchEvent(new CustomEvent('surveyor:document-save-success',{detail:{
                page:safeText(optionValue(options,'page',document.body?.dataset?.page||'')),
                projectId:safeText(optionValue(options,'projectId','')),
                source:'technical-editor'
              }}));
            } catch (_error) {}
            setGuideStatus('Alterações salvas. O documento atual está pronto para baixar.');
            if (presentationMode !== 'inline') {
              close();
              if (!wasNativeMode) await options.regenerate?.();
            }
          } finally {
            const currentSaveButton = modal?.querySelector?.('[data-editor-action="save"]');
            if (currentSaveButton) { currentSaveButton.disabled = false; currentSaveButton.textContent = 'Salvar alterações'; }
            releaseLoading();
          }
        }
      
    }


    async function start(startOptions = {}) {
      const requestedMode = startOptions?.mode === 'inline' ? 'inline' : 'modal';
      const requestedMount = requestedMode === 'inline' ? startOptions?.mount : null;
      if (active) {
        if (requestedMode === 'inline' && modal && presentationMode === 'inline') {
          if (requestedMount && requestedMount !== presentationMount) { requestedMount.appendChild(modal); presentationMount?.classList?.remove?.('sv-beta-personalization-active'); presentationMount=requestedMount; }
          setVisible(true);
        }
        return;
      }
      const source = getSvg(); if (!source || !hasEditableLayer()) return;
      if (requestedMode === 'inline' && !(requestedMount instanceof Element)) return;
      presentationMode = requestedMode;
      presentationMount = requestedMount || null;
      presentationVisible = true;
      active = true; updateControls();
      let parts, raster;
      try {
        nativeDocument = requestedMode === 'inline' && safeText(optionValue(options, 'page', document.body?.dataset?.page || '')) === 'pranchas.html' ? getNativeDocument() : null;
        nativeMode = Boolean(nativeDocument);
        if (nativeMode) {
          const nativeParts = mountNativeDocumentSvg(source, nativeDocument);
          nativeTypographyAudit = nativeParts.typographyAudit || null;
          parts = { overlay: nativeParts.overlay, background: null };
          raster = { width: nativeParts.width, height: nativeParts.height, dataUrl: '' };
        } else {
          parts = parseSvg(source);
          if (requestedMode === 'inline') raster = await vectorBackground(parts.background);
          else raster = await rasterize(parts.background);
        }
      }
      catch (error) { active = false; updateControls(); console.error('[Surveyor] Falha ao preparar editor técnico:', error); toast(error?.message || `Não foi possível abrir o editor da ${editorNoun(options)}.`, 'error'); return; }
      overlay = parts.overlay;
      editorBackgroundObjectUrl = raster.objectUrl || '';
      signatureHydrationAttempted = false;
      await hydrateSignatureFromAccount();
      let project=null, feature=null;
      const localProjectLayout = readProjectLayout(options);
      const localLayoutTime = Date.parse(localProjectLayout.updatedAt || '') || 0;
      try {
        const projectId=projectIdFor(options);
        // A página já carregou o projeto geométrico para desenhar a prévia.
        // Não fazer um novo GET remoto forçado ao abrir a personalização.
        const readyProject = optionValue(options, 'getLoadedProject', null);
        project = projectId && projectPerimeterFeature(readyProject) ? readyProject : null;
        if (!project && projectId && window.GeoRuralProjects?.get) project = await window.GeoRuralProjects.get(projectId, false);
        feature=projectPerimeterFeature(project);
        const remoteLayoutTime = Date.parse(feature?.properties?.confrontanteVisualLayout?.updatedAt || '') || 0;
        const localSettings = localProjectLayout.documentSettings || readDocumentSettings(options);
        const remoteSettings = feature?.properties?.documentVisualSettings || null;
        documentSettings = normalizeDocumentSettings(localLayoutTime >= remoteLayoutTime && localSettings ? localSettings : (remoteSettings || localSettings || {}));
      } catch (_error) {
        documentSettings=normalizeDocumentSettings(localProjectLayout.documentSettings || readDocumentSettings(options));
      }
      importedSignatureAssetState=await readImportedSignatureAsset(options);
      if(documentSettings.importedSignatureEnabled && !importedSignatureAssetState)documentSettings.importedSignatureEnabled=false;
      selectedSignatureMode='none';
      ensureImportedSignatureNode();
      const stored=readSegments(options), fromDocument=segmentsFromOverlay(overlay), fromProject=fallbackSegmentsFromFeature(feature);
      const remoteLayoutTime = Date.parse(feature?.properties?.confrontanteVisualLayout?.updatedAt || '') || 0;
      const localSegments = Array.isArray(localProjectLayout.segments) ? localProjectLayout.segments : [];
      const preferredSegmentsRaw=(localLayoutTime >= remoteLayoutTime && localSegments.length)
        ? localSegments
        : (fromProject.length ? fromProject : (localSegments.length ? localSegments : stored));
      migrateLegacyGeneralLines(preferredSegmentsRaw);
      const preferredSegments=materializeProjectSegmentsForOverlay(preferredSegmentsRaw.filter((item)=>safeText(item?.id)!=='__linhas-gerais__'));
      // O SVG renderizado é a fonte das coordenadas absolutas da sessão atual.
      // O layout persistido usa coordenadas normalizadas para sobreviver a
      // mudanças de escala; portanto ele nunca pode substituir diretamente as
      // coordenadas de edição do SVG. Mesclamos metadados persistidos com a
      // geometria visual corrente para que todas as linhas continuem editáveis.
      const renderedSegments=fromDocument.filter((item)=>safeText(item?.id)!=='__linhas-gerais__');
      const baseSegments = renderedSegments.length
        ? hydrateEditorSegments(preferredSegments, renderedSegments)
        : preferredSegments;
      hadStoredSegments=stored.length>0||fromProject.length>0;
      draftSegments=baseSegments.map((item)=>({...item,extraLines:Array.isArray(item.extraLines)?item.extraLines.map((line)=>({...line})):[]}));
      segmentsDirty=false;history.length=0;future.length=0;

      modal = document.createElement('div'); modal.className = `sv-confrontante-editor-modal${presentationMode==='inline'?' is-inline-beta':''}`; modal.setAttribute('role', presentationMode==='inline'?'region':'dialog'); modal.setAttribute('aria-modal', presentationMode==='inline'?'false':'true');
      if (presentationMode === 'inline') modal.setAttribute('aria-label','Personalização beta da prancha');
      modal.innerHTML = `<section class="sv-confrontante-editor-window"><header class="sv-confrontante-editor-header"><div><strong>${editorTitle(options)}</strong></div><button type="button" class="sv-confrontante-editor-close" data-editor-action="cancel" aria-label="Fechar editor">×</button></header><div class="sv-confrontante-editor-main"><div class="sv-confrontante-editor-viewport"><div class="sv-confrontante-editor-sheet${nativeMode?' is-native-document':''}" style="aspect-ratio:${raster.width}/${raster.height}">${nativeMode?'':`<img class="sv-confrontante-editor-background" src="${raster.dataUrl}" alt="Prévia da prancha">`}${new XMLSerializer().serializeToString(parts.overlay)}</div></div><aside class="sv-editor-tool-shell" data-tool-shell><nav class="sv-editor-tool-rail" aria-label="Ferramentas da edição"><button type="button" class="sv-editor-tool-button active" data-editor-tool="zoom" title="Visualização" aria-label="Visualização"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path><path d="M8 11h6M11 8v6"></path></svg></button><button type="button" class="sv-editor-tool-button" data-editor-tool="vertices" title="Vértices" aria-label="Vértices"><svg viewBox="0 0 24 24"><circle cx="5" cy="17" r="2"></circle><circle cx="12" cy="6" r="2"></circle><circle cx="19" cy="16" r="2"></circle><path d="m6.5 15.5 4-7.5M13.8 7.4l3.5 7"></path></svg></button><button type="button" class="sv-editor-tool-button" data-editor-tool="lines" title="Linhas" aria-label="Linhas"><svg viewBox="0 0 24 24"><path d="M4 18 9 9l5 4 6-8"></path><circle cx="4" cy="18" r="1.5"></circle><circle cx="9" cy="9" r="1.5"></circle><circle cx="14" cy="13" r="1.5"></circle><circle cx="20" cy="5" r="1.5"></circle></svg></button><button type="button" class="sv-editor-tool-button" data-editor-tool="servitudes" title="Servidões" aria-label="Servidões"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 17h16"></path><path d="M7 4v6M17 14v6"></path></svg></button><button type="button" class="sv-editor-tool-button" data-editor-tool="confrontantes" title="Confrontantes" aria-label="Confrontantes"><svg viewBox="0 0 24 24"><path d="M4 19V5h16v14z"></path><path d="M8 9h8M8 13h8M8 17h5"></path></svg></button><button type="button" class="sv-editor-tool-button" data-editor-tool="appearance" title="Aparência" aria-label="Aparência"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h5a4 4 0 0 0 0-8z"></path><circle cx="7.5" cy="10" r="1"></circle><circle cx="9" cy="6.8" r="1"></circle><circle cx="14" cy="6.5" r="1"></circle></svg></button><button type="button" class="sv-editor-tool-button" data-editor-tool="dimensions" title="Editar cotas" aria-label="Editar cotas"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 17h14"></path><path d="M8 4v6M16 14v6"></path><path d="M10 12h4"></path></svg></button><button type="button" class="sv-editor-tool-button" data-editor-tool="signature" title="Assinatura" aria-label="Assinatura"><svg viewBox="0 0 24 24"><path d="M4 18c3-5 5-8 7-8 2 0 0 5 2 5 1.5 0 2.5-4 4-4 1 0 1 3 3 3"></path><path d="M4 20h16"></path></svg></button><button type="button" class="sv-editor-tool-button" data-editor-tool="history" title="Desfazer e refazer" aria-label="Desfazer e refazer"><svg viewBox="0 0 24 24"><path d="M9 7H4v-5"></path><path d="M4 7a8 8 0 1 1 2 9"></path></svg></button></nav><section class="sv-editor-tool-drawer open" data-tool-drawer><header class="sv-editor-tool-drawer-head"><strong data-tool-title>Visualização</strong><button type="button" data-editor-action="close-tool-panel" aria-label="Recolher painel">×</button></header><div class="sv-editor-tool-panel active" data-tool-panel="zoom"><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Zoom da prancha</span><div class="sv-editor-zoom-controls"><button type="button" class="btn" data-editor-action="zoom-out">−</button><strong class="sv-confrontante-editor-zoom" data-editor-zoom-label>100%</strong><button type="button" class="btn" data-editor-action="zoom-in">+</button></div><button type="button" class="btn sv-editor-full-button" data-editor-action="fit">Ajustar à tela</button></div></div><div class="sv-editor-tool-panel" data-tool-panel="vertices" hidden><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Vértices</span><button type="button" class="btn sv-editor-full-button" data-editor-action="auto-organize-vertices" style="margin-bottom:8px">Auto-alinhar vértices (Bissetriz)</button><label class="sv-editor-slider-row">Tamanho geral <input type="range" min="0.55" max="2.5" step="0.05" data-document-setting="vertexScale" value="${documentSettings.vertexScale}"><output data-vertex-scale-output>${Math.round(documentSettings.vertexScale*100)}%</output></label><div class="sv-editor-tool-section"><div class="sv-editor-map-section-head"><strong data-vertex-count-label>0 vértices detectados</strong></div><div class="sv-editor-vertex-list" data-vertex-guide-list></div></div></div></div><div class="sv-editor-tool-panel" data-tool-panel="lines" hidden><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Linhas técnicas</span><div class="sv-editor-line-actions"><button type="button" class="btn sv-editor-icon-action" data-editor-action="draw-line" title="Desenhar linha" aria-label="Desenhar linha"><svg viewBox="0 0 24 24"><path d="M4 18 10 12"></path><path d="m14 8 6-6"></path><path d="M12 10l2 2"></path><path d="m3 21 4.5-1.2L19 8.3l-3.1-3.1L4.5 16.6z"></path></svg></button><button type="button" class="btn sv-editor-icon-action" data-editor-action="edit-lines" aria-pressed="false" title="Editar linhas" aria-label="Editar linhas"><svg viewBox="0 0 24 24"><path d="M4 18 9 9l5 4 6-8"></path><circle cx="4" cy="18" r="1.5"></circle><circle cx="9" cy="9" r="1.5"></circle><circle cx="14" cy="13" r="1.5"></circle><circle cx="20" cy="5" r="1.5"></circle></svg></button><button type="button" class="btn sv-editor-icon-action" data-editor-action="delete-selected-line" title="Excluir linha selecionada" aria-label="Excluir linha selecionada" disabled><svg viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M8 10v7"></path><path d="M12 10v7"></path><path d="M16 10v7"></path><path d="M6 7l1 13h10l1-13"></path></svg></button><button type="button" class="btn sv-editor-icon-action" data-editor-action="remove-line" title="Remover última linha" aria-label="Remover última linha"><svg viewBox="0 0 24 24"><path d="M20 17H8"></path><path d="m12 21-4-4 4-4"></path><path d="M20 7 9 18"></path><circle cx="20" cy="7" r="1.5"></circle><circle cx="9" cy="18" r="1.5"></circle></svg></button></div><div class="sv-editor-confrontante-auto" data-confrontante-auto-tools hidden><button type="button" class="btn" data-editor-action="toggle-auto-confrontantes" aria-expanded="false">Auto</button><label data-confrontante-auto-picker hidden for="sv-auto-confrontante-select">Selecione o confrontante <select id="sv-auto-confrontante-select" data-confrontante-auto-select aria-label="Selecionar confrontante"></select></label></div><label class="sv-editor-polygon-color-row sv-editor-line-color-row"><span>Cor das linhas</span><input type="color" data-document-setting="technicalLineColor" value="${normalizeHexColor(documentSettings.technicalLineColor,'#111827')}"></label><small class="sv-editor-tool-hint" data-guide-status></small></div></div><div class="sv-editor-tool-panel" data-tool-panel="miniMap" hidden><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Minimapa</span><label class="sv-editor-compact-field"><span>Estilo</span><select data-document-setting="miniMapKind" aria-label="Estilo do minimapa"><option value="road">Vetorial</option><option value="sat">Satélite</option><option value="terrain">Topográfico</option><option value="relief">Relevo</option></select></label><label class="sv-editor-slider-row">Opacidade <input type="range" min="0.2" max="1" step="0.05" data-document-setting="miniMapOpacity" value="${documentSettings.miniMapOpacity}"><output data-mini-map-opacity-output>${Math.round(documentSettings.miniMapOpacity*100)}%</output></label><label class="sv-editor-check-row"><input type="checkbox" data-document-setting="miniMapPerimeterVisible" ${documentSettings.miniMapPerimeterVisible!==false?'checked':''}> Destacar perímetro</label></div></div><div class="sv-editor-tool-panel" data-tool-panel="servitudes" hidden><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Servidão documental</span><select data-servitude-select aria-label="Servidão selecionada"></select><div class="sv-editor-line-actions sv-editor-servitude-actions" aria-label="Ações da servidão"><button type="button" class="btn sv-editor-icon-action" data-editor-action="draw-servitude" title="Desenhar servidão" aria-label="Desenhar servidão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"></path><path d="M7 4v6M17 14v6"></path></svg></button><button type="button" class="btn sv-editor-icon-action primary" data-editor-action="finish-servitude" title="Finalizar traçado" aria-label="Finalizar traçado" hidden disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"></path></svg></button><button type="button" class="btn sv-editor-icon-action danger" data-editor-action="delete-servitude" title="Excluir servidão" aria-label="Excluir servidão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M8 10v7M12 10v7M16 10v7"></path><path d="M6 7l1 13h10l1-13"></path></svg></button></div><label class="sv-editor-slider-row">Largura visual <input type="range" min="0.5" max="30" step="0.5" data-servitude-width value="4"><output data-servitude-width-output>4.0%</output></label><small class="sv-editor-tool-hint" data-servitude-status></small></div></div><div class="sv-editor-tool-panel" data-tool-panel="confrontantes" hidden><div class="sv-confrontante-segment-panel"><div class="sv-confrontante-segment-panel-head"><div><strong>Confrontantes</strong></div><button type="button" class="btn sv-add-confrontante-btn" data-editor-action="add-confrontante" title="Adicionar confrontante" aria-label="Adicionar confrontante">+</button></div><div class="sv-confrontante-segment-list" data-segment-list></div></div></div><div class="sv-editor-tool-panel" data-tool-panel="appearance" hidden><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Aparência</span><label class="sv-editor-check-row"><input type="checkbox" data-document-setting="polygonFill" ${documentSettings.polygonFill?'checked':''}> Preenchimento dos polígonos</label><label class="sv-editor-check-row"><input type="checkbox" data-document-setting="coordinateTableEnabled" ${documentSettings.coordinateTableEnabled?'checked':''}> Tabela técnica de coordenadas</label><label class="sv-editor-slider-row" data-coordinate-table-dependent>Linhas da tabela <input type="range" min="1" max="12" step="1" data-document-setting="coordinateTableRows" value="${documentSettings.coordinateTableRows}"><output data-coordinate-table-rows-output>${documentSettings.coordinateTableRows}</output></label><label class="sv-editor-slider-row" data-coordinate-table-dependent>Tamanho da tabela <input type="range" min="0.7" max="1.8" step="0.05" data-document-setting="coordinateTableScale" value="${documentSettings.coordinateTableScale||1}"><output data-coordinate-table-scale-output>${Math.round((documentSettings.coordinateTableScale||1)*100)}%</output></label><label class="sv-editor-polygon-color-row" data-area-name-dependent><span>Cor padrão dos nomes</span><input type="color" data-document-setting="globalAreaNameColor" value="${normalizeHexColor(documentSettings.areaNameColor,'#111827')}"></label><small class="sv-editor-tool-hint" data-coordinate-table-hint data-coordinate-table-dependent>Arraste a tabela direto na prancha para reposicionar e use o quadrinho azul no canto para redimensionar.</small><div class="sv-editor-preset-section" style="margin-bottom:12px"><div class="sv-editor-polygon-style-title"><strong>Padrão Regulatório / Perfil</strong><small>Aplica estilo normativo e organiza a prancha em 1 clique.</small></div><label class="sv-editor-slider-row">Perfil <select data-document-setting="regulatoryPreset" class="sv-editor-select"><option value="custom">Personalizado (Manual)</option><option value="cartorio_incra">INCRA / Cartório (Georref.)</option><option value="seia_cefir">SEIA / CEFIR Bahia (Ambiental)</option><option value="comercial">Comercial / Executivo (Apresentação)</option><option value="reurb">REURB / Regularização Fundiária</option></select></label><button type="button" class="btn sv-editor-full-button sv-editor-preset-apply-btn" data-editor-action="apply-regulatory-preset">Aplicar perfil normativo</button></div><div class="sv-editor-polygon-style-section"><div class="sv-editor-polygon-style-title"><strong>Polígonos da prancha</strong><small>Defina uma cor para diferenciar cada área na impressão.</small></div><div class="sv-editor-polygon-style-list" data-polygon-style-list></div></div></div></div><div class="sv-editor-tool-panel" data-tool-panel="dimensions" hidden><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Editar cotas</span><div data-dimension-controls ${overlay?.querySelector?.('.sv-cad-dimension')?'':'hidden'}><button type="button" class="btn sv-editor-full-button" data-editor-action="auto-organize-dimensions" style="margin-bottom:8px">Auto-alinhar cotas (Exterior)</button><label class="sv-editor-slider-row">Tamanho geral das cotas <input type="range" min="0" max="5" step="0.05" data-document-setting="dimensionScale" value="${Number(documentSettings.dimensionScale ?? 1)}"><output data-dimension-scale-output>${Math.round(Number(documentSettings.dimensionScale ?? 1)*100)}%</output></label><label class="sv-editor-polygon-color-row"><span>Cor das cotas</span><input type="color" data-document-setting="dimensionColor" value="${normalizeHexColor(documentSettings.dimensionColor,'#111827')}"></label><div data-selected-dimension-controls hidden><strong data-selected-dimension-label></strong><label class="sv-editor-slider-row">Ajuste desta cota <input type="range" min="0" max="5" step="0.05" data-selected-dimension-scale value="1" disabled><output data-selected-dimension-scale-output>—</output></label></div></div><small class="sv-editor-tool-hint" data-dimension-unavailable ${overlay?.querySelector?.('.sv-cad-dimension')?'hidden':''}>Nenhuma cota está disponível nesta prancha.</small></div></div><div class="sv-editor-tool-panel" data-tool-panel="signature" hidden><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Assinatura</span><div class="sv-editor-signature-source-card sv-editor-signature-unified-card"><div class="sv-editor-signature-import-head"><strong>Assinatura externa</strong></div><input type="file" accept="image/png,image/jpeg,image/webp" data-import-signature-input hidden><div class="sv-editor-signature-toggle-row"><label class="sv-editor-check-row"><input type="checkbox" data-document-setting="importedSignatureEnabled" ${documentSettings.importedSignatureEnabled?'checked':''}> Usar assinatura importada</label><label class="sv-editor-check-row"><input type="checkbox" data-document-setting="signatureEnabled" ${documentSettings.signatureEnabled?'checked':''}> Assinatura da conta</label></div><div class="sv-editor-signature-import-meta"><span data-imported-signature-name>Nenhuma assinatura importada</span></div><div class="sv-editor-signature-import-actions"><button type="button" class="btn" data-editor-action="import-signature">Importar assinatura</button><button type="button" class="btn" data-editor-action="remove-imported-signature">Remover</button></div></div><label class="sv-editor-slider-row">Tamanho <input type="range" min="0.55" max="8" step="0.05" data-document-setting="signatureScale" value="${documentSettings.signatureScale}"><output data-signature-scale-output>—</output></label><button type="button" class="btn sv-editor-full-button" data-editor-action="reset-signature-position">Restaurar posição</button><small class="sv-editor-tool-hint">Clique diretamente em uma assinatura na prancha para selecioná-la; depois arraste-a diretamente sobre a prancha ou ajuste o tamanho. Apenas a selecionada é editada.</small><small class="sv-editor-tool-hint" data-signature-status></small></div></div><div class="sv-editor-tool-panel" data-tool-panel="history" hidden><div class="sv-editor-tool-section"><span class="sv-editor-tool-label">Histórico</span><div class="sv-editor-two-buttons"><button type="button" class="btn" data-editor-action="undo" disabled>Desfazer</button><button type="button" class="btn" data-editor-action="redo" disabled>Refazer</button></div></div></div></section></aside></div><footer class="sv-confrontante-editor-footer"><div class="sv-editor-footer-left" data-editor-footer-left><button type="button" class="btn primary" data-editor-action="auto-organize" title="Organiza vértices sem alterar posições manuais de cotas e confrontantes">✨ Organizar</button><button type="button" class="btn" data-editor-action="reset">Restaurar automático</button><button type="button" class="btn sv-editor-inline-history-btn" data-editor-action="undo" title="Desfazer" aria-label="Desfazer" disabled>↶</button><button type="button" class="btn sv-editor-inline-history-btn" data-editor-action="redo" title="Refazer" aria-label="Refazer" disabled>↷</button></div><div class="sv-editor-footer-center"><div class="sv-editor-inline-zoom" aria-label="Zoom da prancha"><button type="button" class="btn" data-editor-action="zoom-out" aria-label="Diminuir zoom">−</button><strong class="sv-confrontante-editor-zoom" data-editor-zoom-label>100%</strong><button type="button" class="btn" data-editor-action="zoom-in" aria-label="Aumentar zoom">+</button></div></div><div class="sv-editor-footer-right"><button type="button" class="btn" data-editor-action="cancel">Cancelar</button><div class="sv-editor-inline-download-slot" data-editor-download-slot></div><button type="button" class="btn primary" data-editor-action="save" hidden>Salvar alterações</button></div></footer><div class="sv-area-name-context-menu" data-area-name-context-menu hidden><label class="sv-area-name-context-rotation"><span>Tamanho <output data-area-name-context-scale-output>100%</output></span><input type="range" min="50" max="300" step="5" value="100" data-area-name-context-scale></label><label class="sv-area-name-context-rotation"><span>Rotacionar <output data-area-name-context-rotation-output>0°</output></span><input type="range" min="-180" max="180" step="5" value="0" data-area-name-context-rotation></label><button type="button" data-area-name-context-reset-rotation>Zerar rotação</button><button type="button" class="danger" data-area-name-context-delete>Excluir nome</button></div><div class="sv-area-name-context-menu" data-confrontante-context-menu hidden><label class="sv-polygon-context-color"><span>Cor da fonte</span><input type="color" value="#111827" data-confrontante-context-color aria-label="Cor da fonte do confrontante"></label><label class="sv-area-name-context-rotation"><span>Tamanho <output data-confrontante-context-scale-output>100%</output></span><input type="range" min="20" max="400" step="5" value="100" data-confrontante-context-scale></label><label class="sv-area-name-context-rotation"><span>Rotacionar <output data-confrontante-context-rotation-output>0°</output></span><input type="range" min="-180" max="180" step="5" value="0" data-confrontante-context-rotation></label><button type="button" data-confrontante-context-reset-rotation>Zerar rotação</button><button type="button" class="danger" data-confrontante-context-delete>Excluir confrontante</button></div><div class="sv-area-name-context-menu sv-polygon-context-menu" data-polygon-context-menu hidden><strong class="sv-polygon-context-title">Aparência do polígono</strong><label class="sv-polygon-context-color"><span>Cor da borda</span><input type="color" value="#f3c410" data-polygon-context-stroke-color></label><label class="sv-area-name-context-rotation"><span>Espessura da borda <output data-polygon-context-stroke-width-output>100%</output></span><input type="range" min="25" max="400" step="5" value="100" data-polygon-context-stroke-width></label><label class="sv-polygon-context-color"><span>Cor interna</span><input type="color" value="#f3c410" data-polygon-context-fill-color></label><label class="sv-area-name-context-rotation"><span>Opacidade <output data-polygon-context-opacity-output>100%</output></span><input type="range" min="0" max="100" step="1" value="100" data-polygon-context-opacity></label></div></section>`;
      if (presentationMode === 'inline') {
        presentationMount.appendChild(modal);
        presentationMount.classList.add('sv-beta-personalization-active');
      } else {
        document.body.appendChild(modal);
        document.body.classList.add('sv-confrontante-editor-open');
      }
      mountStandardInlineNavigation();
      mountInlineToolCaptions();
      // Tooltip e nome acessível permanecem mesmo quando o rótulo visual é oculto.
      if (['mapas.html','pranchas.html'].includes(document.body?.dataset?.page || '')) {
        const actionLabels = { reset:'Restaurar automático',undo:'Desfazer',redo:'Refazer',cancel:'Cancelar',save:'Salvar alterações', 'zoom-in':'Aumentar zoom','zoom-out':'Diminuir zoom' };
        modal.querySelectorAll('.sv-confrontante-editor-footer [data-editor-action]').forEach((button) => {
          const label = actionLabels[button.dataset.editorAction];
          if (!label) return;
          button.title = label;
          button.setAttribute('aria-label',label);
        });
      }
      modal.addEventListener('click', handleEditorClick);
      modal.addEventListener('input',(event)=>{
        if(event.target?.matches?.('input[type="range"]')) updateRangeProgress(event.target);
        if (event.target?.closest?.('[data-tool-panel],[data-map-section]')) markDirty(true);
      },true);
      modal.addEventListener('change',(event)=>{
        if (event.target?.closest?.('[data-tool-panel],[data-map-section]')) markDirty(true);
      },true);
      overlay = modal.querySelector('.sv-confrontante-editor-overlay');
      if (nativeMode && nativeTypographyAudit && window.SurveyorTechnicalSvgTypography?.audit) {
        nativeTypographyAudit.mounted = window.SurveyorTechnicalSvgTypography.audit(overlay,{computed:true});
      }
      if (nativeMode) {
        modal.dataset.nativeDocument = '1';
        modal.dataset.nativeDocumentSchema = safeText(nativeDocument?.schemaVersion || '');
        overlay?.setAttribute?.('data-native-document-id', safeText(nativeDocument?.documentId || ''));
      }
      inferAreaNamesFromOverlay();
      if (nativeMode) {
        modal.addEventListener('input', scheduleNativePublish, true);
        modal.addEventListener('change', scheduleNativePublish, true);
        overlay?.addEventListener?.('pointerup', scheduleNativePublish, true);
        overlay?.addEventListener?.('pointercancel', scheduleNativePublish, true);
      }
      bindCriticalPanelActions();
      overlay?.querySelectorAll?.('.sv-vertex-label').forEach((node) => { node.dataset.sourceVertexScale=String(documentSettings.vertexScale); });
      overlay?.querySelectorAll?.('.sv-cad-dimension').forEach((node) => {
        if(!node.dataset.dimensionBaseFontSize){const current=Number(node.getAttribute('font-size')||0),renderScale=Number(node.dataset.dimensionScale||documentSettings.dimensionScale||1)||1;if(current>0)node.dataset.dimensionBaseFontSize=String(current/Math.max(.0001,renderScale));}
      });
      overlay?.querySelectorAll?.('.sv-document-editable-polygon,.sv-document-perimeter-fill').forEach((node) => { if(!node.dataset.originalFill) node.dataset.originalFill=safeText(node.getAttribute('fill')||'#f3c410'); if(!node.dataset.originalStroke) node.dataset.originalStroke=safeText(node.getAttribute('stroke')||node.dataset.polygonColor||node.dataset.originalFill||'#f3c410'); if(!node.dataset.originalFillOpacity) node.dataset.originalFillOpacity=String(Number(node.getAttribute('fill-opacity') || 0.22)); });
      showEditorAnchors(false);
      try { attachGuideDrawing(overlay); attachGuideHandleDrag(overlay); attachGuideLineDrag(overlay); } catch (error) { console.error('[Surveyor] Falha ao preparar ferramentas de linha:', error); }
      try { await mountEditorEngine(overlay); } catch (error) {
        console.error('[Surveyor] Motor de edição indisponível; editor segue em modo local estável:', error);
        editorEngine=null;
        // As interações essenciais não podem depender do carregamento do engine.
        // Se o módulo falhar, nomes, vértices e confrontantes continuam arrastáveis.
        engineDisposers.push(attachStableAreaNameDrag(overlay));
        engineDisposers.push(attachStableVertexLabelDrag(overlay));
        engineDisposers.push(attachStableDimensionDrag(overlay));
        engineDisposers.push(attachStableSignatureDrag(overlay));
        engineDisposers.push(attachStableCoordinateTableInteraction(overlay));
        engineDisposers.push(attachStableConfrontanteDrag(overlay));
        engineDisposers.push(attachLiveFieldDirectEditing(overlay));
        engineDisposers.push(attachCrossHighlightingInteractions(overlay));
      }
      engineDisposers.push(attachManualServitudeInteractions(overlay));
      try { renderSegmentPanel(); if(draftSegments[0]?.id) selectSegmentRow(draftSegments[0].id); } catch (error) { console.error('[Surveyor] Falha ao montar confrontantes:', error); }
      setActiveToolPanel(activeToolPanel);
      try { syncSettingsControls(); syncRangeProgress(modal); updateHistoryControls(); updateLineEditControls(); updatePrimaryActionState(); if (presentationMode === 'inline') requestAnimationFrame(() => requestAnimationFrame(() => fitZoomToViewport())); else setZoom(1,{preserveFocus:false}); } catch (error) { console.error('[Surveyor] Falha ao sincronizar controles do editor:', error); }
      if (options.persistProject !== false && localProjectLayout.syncStatus === 'pending') {
        markDirty(true);
        setGuideStatus('Há alterações locais ainda não confirmadas na nuvem. Verifique o projeto e tente salvar novamente.');
      }
      const vertexScaleControl = modal.querySelector('[data-document-setting="vertexScale"]');
      let vertexScaleBeforeEdit = documentSettings.vertexScale;
      vertexScaleControl?.addEventListener('pointerdown', () => { vertexScaleBeforeEdit = documentSettings.vertexScale; });
      vertexScaleControl?.addEventListener('keydown', () => { vertexScaleBeforeEdit = documentSettings.vertexScale; });
      vertexScaleControl?.addEventListener('input', (event) => { const value=Math.max(.55,Math.min(2.5,Number(event.target.value)||1)); documentSettings.vertexScale=value; documentSettings.vertexLabelScales={}; documentSettings.elementVisuals={...normalizeElementVisuals(documentSettings),vertices:{...elementVisual('vertices'),scale:value}}; syncSettingsControls(); scheduleNativePublish(); markDirty(true); });
      vertexScaleControl?.addEventListener('change', () => {
        const previous = normalizeDocumentSettings({ ...documentSettings, vertexScale: vertexScaleBeforeEdit });
        if (Math.abs(previous.vertexScale - documentSettings.vertexScale) > 0.0001) { history.push({ segments: cloneSegments(), settings: previous }); if(history.length>40) history.shift(); future.length=0; updateHistoryControls(); }
        vertexScaleBeforeEdit = documentSettings.vertexScale;
      });
      modal.querySelector('[data-document-setting="polygonFill"]')?.addEventListener('change', (event) => { checkpoint(); documentSettings.polygonFill=Boolean(event.target.checked); syncSettingsControls(); });
      const dimensionScaleControl=modal.querySelector('[data-document-setting="dimensionScale"]');
      let dimensionScaleBeforeEdit=Number(documentSettings.dimensionScale ?? 1);
      dimensionScaleControl?.addEventListener('pointerdown',()=>{dimensionScaleBeforeEdit=Number(documentSettings.dimensionScale ?? 1);});
      dimensionScaleControl?.addEventListener('keydown',()=>{dimensionScaleBeforeEdit=Number(documentSettings.dimensionScale ?? 1);});
      dimensionScaleControl?.addEventListener('input',(event)=>{documentSettings.dimensionScale=Math.max(0,Math.min(5,Number(event.target.value)||0));applyDimensionSettingsToOverlay();syncSettingsControls();});
      dimensionScaleControl?.addEventListener('change',()=>{const previous=normalizeDocumentSettings({...documentSettings,dimensionScale:dimensionScaleBeforeEdit});const current=Math.max(0,Math.min(5,Number(documentSettings.dimensionScale ?? 1)||0));if(Math.abs(current-dimensionScaleBeforeEdit)>.0001){history.push({segments:cloneSegments(),settings:previous});if(history.length>40)history.shift();future.length=0;updateHistoryControls();}dimensionScaleBeforeEdit=current;});
      const dimensionColorControl=modal.querySelector('[data-document-setting="dimensionColor"]');
      dimensionColorControl?.addEventListener('input',(event)=>{checkpoint();documentSettings.dimensionColor=normalizeHexColor(event.target.value,'#111827');applyDimensionSettingsToOverlay();syncSettingsControls();});
      const selectedDimensionScaleControl=modal.querySelector('[data-selected-dimension-scale]');
      let selectedDimensionScaleBeforeEdit=1;
      selectedDimensionScaleControl?.addEventListener('pointerdown',()=>{selectedDimensionScaleBeforeEdit=Math.max(0,Math.min(5,Number(documentSettings.dimensionLabelScales?.[selectedDimensionKey] ?? 1) || 0));});
      selectedDimensionScaleControl?.addEventListener('keydown',()=>{selectedDimensionScaleBeforeEdit=Math.max(0,Math.min(5,Number(documentSettings.dimensionLabelScales?.[selectedDimensionKey] ?? 1) || 0));});
      selectedDimensionScaleControl?.addEventListener('input',(event)=>{if(!selectedDimensionKey)return;documentSettings.dimensionLabelScales||={};documentSettings.dimensionLabelScales[selectedDimensionKey]=Math.max(0,Math.min(5,Number(event.target.value)||0));applyDimensionSettingsToOverlay();syncSelectedDimensionControls();});
      selectedDimensionScaleControl?.addEventListener('change',()=>{if(!selectedDimensionKey)return;const previous=normalizeDocumentSettings({...documentSettings,dimensionLabelScales:{...(documentSettings.dimensionLabelScales||{}),[selectedDimensionKey]:selectedDimensionScaleBeforeEdit}});const current=Math.max(0,Math.min(5,Number(documentSettings.dimensionLabelScales?.[selectedDimensionKey] ?? 1)||0));if(Math.abs(current-selectedDimensionScaleBeforeEdit)>.0001){history.push({segments:cloneSegments(),settings:previous});if(history.length>40)history.shift();future.length=0;updateHistoryControls();}selectedDimensionScaleBeforeEdit=current;});
      modal.querySelector('[data-document-setting="coordinateTableEnabled"]')?.addEventListener('change', (event) => { checkpoint(); documentSettings.coordinateTableEnabled=Boolean(event.target.checked); syncSettingsControls(); });
      const coordinateTableRowsControl=modal.querySelector('[data-document-setting="coordinateTableRows"]');
      coordinateTableRowsControl?.addEventListener('pointerdown',()=>{coordinateTableRowsControl.dataset.before=String(documentSettings.coordinateTableRows||coordinateTableMaxRows());});
      coordinateTableRowsControl?.addEventListener('input', (event) => { const maxRows=coordinateTableMaxRows(); documentSettings.coordinateTableRows=Math.max(1,Math.min(maxRows,Math.round(Number(event.target.value)||maxRows))); syncSettingsControls(); });
      coordinateTableRowsControl?.addEventListener('change',()=>{const previous=Math.max(1,Math.min(coordinateTableMaxRows(),Math.round(Number(coordinateTableRowsControl?.dataset.before||documentSettings.coordinateTableRows)||documentSettings.coordinateTableRows))); if(previous!==documentSettings.coordinateTableRows){ history.push({segments:cloneSegments(),settings:normalizeDocumentSettings({...documentSettings,coordinateTableRows:previous})}); if(history.length>40)history.shift(); future.length=0; updateHistoryControls(); }});
      const coordinateTableScaleControl=modal.querySelector('[data-document-setting="coordinateTableScale"]');
      coordinateTableScaleControl?.addEventListener('pointerdown',()=>{coordinateTableScaleControl.dataset.before=String(documentSettings.coordinateTableScale||1);});
      coordinateTableScaleControl?.addEventListener('input',(event)=>{documentSettings.coordinateTableScale=Math.max(.7,Math.min(1.8,Number(event.target.value)||1)); syncSettingsControls();});
      coordinateTableScaleControl?.addEventListener('change',()=>{const previous=Math.max(.7,Math.min(1.8,Number(coordinateTableScaleControl?.dataset.before||1)||1)); if(Math.abs(previous-(documentSettings.coordinateTableScale||1))>.0001){ history.push({segments:cloneSegments(),settings:normalizeDocumentSettings({...documentSettings,coordinateTableScale:previous})}); if(history.length>40)history.shift(); future.length=0; updateHistoryControls(); }});
      modal.querySelector('[data-document-setting="signatureEnabled"]')?.addEventListener('change', (event) => { checkpoint(); documentSettings.signatureEnabled=Boolean(event.target.checked); if(!documentSettings.signatureEnabled && selectedSignatureMode==='account')selectedSignatureMode='none'; syncSettingsControls();scheduleNativePublish();markDirty(true); });
      modal.querySelector('[data-document-setting="importedSignatureEnabled"]')?.addEventListener('change',(event)=>{checkpoint();documentSettings.importedSignatureEnabled=Boolean(event.target.checked)&&Boolean(importedSignatureAssetState?.dataUrl);if(!documentSettings.importedSignatureEnabled && selectedSignatureMode==='imported')selectedSignatureMode='none';syncSettingsControls();scheduleNativePublish();markDirty(true);});
      const importedSignatureInput=modal.querySelector('[data-import-signature-input]');
      importedSignatureInput?.addEventListener('change',async(event)=>{const file=event.target?.files?.[0]||null;event.target.value='';if(!file)return;try{const persisted=await importExternalSignature(file);toast(persisted?'Assinatura importada e pronta para edição.':'Assinatura importada para esta sessão.','success');}catch(error){console.warn('[Surveyor] Falha ao importar assinatura externa:',error);toast(error?.message||'Não foi possível importar a assinatura.','error');}});
      const signatureScaleControl=modal.querySelector('[data-document-setting="signatureScale"]');
      let signatureScaleBeforeEdit=activeSignatureScale();
      signatureScaleControl?.addEventListener('pointerdown',()=>{signatureScaleBeforeEdit=activeSignatureScale();});
      signatureScaleControl?.addEventListener('input',(event)=>{const mode=activeSignatureMode();if(mode==='none')return;if(mode==='imported')documentSettings.importedSignatureScale=Math.max(.55,Math.min(8,Number(event.target.value)||1));else documentSettings.signatureScale=Math.max(.55,Math.min(8,Number(event.target.value)||1));syncSettingsControls();scheduleNativePublish();markDirty(true);});
      signatureScaleControl?.addEventListener('change',()=>{const mode=activeSignatureMode();if(mode==='none')return;const current=activeSignatureScale();if(Math.abs(signatureScaleBeforeEdit-current)>.0001){const previous=normalizeDocumentSettings(documentSettings);if(mode==='imported')previous.importedSignatureScale=signatureScaleBeforeEdit;else previous.signatureScale=signatureScaleBeforeEdit;history.push({segments:cloneSegments(),settings:previous});if(history.length>40)history.shift();future.length=0;updateHistoryControls();}signatureScaleBeforeEdit=current;});
      modal.querySelector('[data-document-setting="regulatoryPreset"]')?.addEventListener('change', (event) => {
        applyRegulatoryPreset(event.target.value);
      });
      const polygonStyleList = modal.querySelector('[data-polygon-style-list]');
      polygonStyleList?.addEventListener('pointerdown', (event) => {
        if (event.target?.matches?.('[data-polygon-color],[data-polygon-opacity]')) checkpoint();
      });
      polygonStyleList?.addEventListener('input', (event) => {
        const colorKey=event.target?.dataset?.polygonColor;
        const opacityKey=event.target?.dataset?.polygonOpacity;
        if(colorKey) updatePolygonStyle(colorKey,{color:event.target.value});
        if(opacityKey) updatePolygonStyle(opacityKey,{opacity:Number(event.target.value)});
      });
      polygonStyleList?.addEventListener('change', (event) => {
        const fillKey=event.target?.dataset?.polygonFill;
        if(fillKey){ checkpoint(); updatePolygonStyle(fillKey,{fill:Boolean(event.target.checked)}); }
      });
      const servitudeSelect=modal.querySelector('[data-servitude-select]');
      servitudeSelect?.addEventListener('change',(event)=>{selectedManualServitudeId=safeText(event.target.value);renderManualServitudesInOverlay();syncManualServitudeControls();});
      const servitudeWidthControl=modal.querySelector('[data-servitude-width]');
      servitudeWidthControl?.addEventListener('pointerdown',()=>{const item=selectedManualServitude();servitudeWidthControl.dataset.before=String(item?.widthG||servitudeDrawState?.widthG||.04); if(item&&!servitudeDrawState) checkpoint();});
      servitudeWidthControl?.addEventListener('input',(event)=>{const widthG=Math.max(.004,Math.min(.30,(Number(event.target.value)||4)/100));const item=selectedManualServitude();if(servitudeDrawState){servitudeDrawState.widthG=widthG;renderManualServitudeTemp(servitudeDrawState.points,servitudeDrawState.widthG);syncManualServitudeControls();return;}if(!item)return;item.widthG=widthG;renderManualServitudesInOverlay();syncManualServitudeControls();});
      servitudeWidthControl?.addEventListener('change',()=>{if(!selectedManualServitude()&&!servitudeDrawState)return;setManualServitudeStatus(servitudeDrawState?'Largura do traçado em criação ajustada.':'Largura visual da servidão ajustada.');});
      const areaNameSelect=modal.querySelector('[data-area-name-select]'),areaNameInput=modal.querySelector('[data-area-name-input]');areaNameSelect?.addEventListener('change',(event)=>{selectedAreaNameId=safeText(event.target.value);syncAreaControls();});areaNameInput?.addEventListener('focus',()=>{areaNameInput.dataset.before=selectedAreaName()?.text||'';});areaNameInput?.addEventListener('input',(event)=>{let item=selectedAreaName();const typed=safeText(event.target.value);if(!item){if(!typed.trim())return;item=addAreaName(typed,{focus:false});}item.text=typed;syncAreaNameLabels();scheduleNativePublish();});areaNameInput?.addEventListener('change',()=>syncAreaControls());const areaScaleControl=modal.querySelector('[data-document-setting="areaNameScale"]');areaScaleControl?.addEventListener('input',(event)=>{const item=selectedAreaName();if(!item)return;item.scale=Math.max(.5,Math.min(3,Number(event.target.value)||1));syncAreaNameLabels();syncAreaControls();scheduleNativePublish();});const areaRotationControl=modal.querySelector('[data-document-setting="areaNameRotation"]');areaRotationControl?.addEventListener('input',(event)=>{const item=selectedAreaName();if(!item)return;item.rotation=Math.max(-180,Math.min(180,Number(event.target.value)||0));syncAreaNameLabels();syncAreaControls();scheduleNativePublish();});const areaColorControl=modal.querySelector('[data-document-setting="areaNameColor"]');areaColorControl?.addEventListener('input',(event)=>{const item=selectedAreaName();if(!item)return;item.color=normalizeHexColor(event.target.value,documentSettings.areaNameColor||'#111827');applyAreaNameColorsToOverlay();scheduleNativePublish();});areaColorControl?.addEventListener('change',()=>syncAreaControls());overlay?.addEventListener('pointerdown',(event)=>{const area=event.target?.closest?.('.sv-area-name-label');hideAreaNameContextMenu();hideConfrontanteContextMenu();hidePolygonContextMenu();if(area?.dataset?.areaNameId){selectedAreaNameId=area.dataset.areaNameId;syncAreaControls();}});overlay?.addEventListener('contextmenu',(event)=>{const area=event.target?.closest?.('.sv-area-name-label'),confrontante=event.target?.closest?.('.sv-confrontante-callout'),polygon=polygonNodeAtContextEvent(event);if(area?.dataset?.areaNameId){event.preventDefault();event.stopPropagation();hideConfrontanteContextMenu();hidePolygonContextMenu();showAreaNameContextMenu(event.clientX,event.clientY,area.dataset.areaNameId);return;}const segmentId=safeText(confrontante?.dataset?.segmentId||confrontante?.dataset?.labelKey||'').trim();if(segmentId&&segmentById(segmentId)){event.preventDefault();event.stopPropagation();hideAreaNameContextMenu();hidePolygonContextMenu();showConfrontanteContextMenu(event.clientX,event.clientY,segmentId);return;}const polygonKey=safeText(polygon?.dataset?.polygonKey||'').trim();if(polygonKey){event.preventDefault();event.stopPropagation();hideAreaNameContextMenu();hideConfrontanteContextMenu();showPolygonContextMenu(event.clientX,event.clientY,polygonKey);return;}hideAreaNameContextMenu();hideConfrontanteContextMenu();hidePolygonContextMenu();});modal.addEventListener('pointerdown',(event)=>{if(!event.target?.closest?.('[data-area-name-context-menu]'))hideAreaNameContextMenu();if(!event.target?.closest?.('[data-confrontante-context-menu]'))hideConfrontanteContextMenu();if(!event.target?.closest?.('[data-polygon-context-menu]'))hidePolygonContextMenu();});const contextScale=modal.querySelector('[data-area-name-context-scale]');contextScale?.addEventListener('pointerdown',()=>checkpoint());contextScale?.addEventListener('input',(event)=>{const item=selectedAreaName();if(!item)return;item.scale=Math.max(.5,Math.min(3,(Number(event.target.value)||100)/100));syncAreaNameLabels();syncAreaControls();syncAreaNameContextScale();scheduleNativePublish();markDirty(true);});const contextRotation=modal.querySelector('[data-area-name-context-rotation]');contextRotation?.addEventListener('pointerdown',()=>checkpoint());contextRotation?.addEventListener('input',(event)=>{const item=selectedAreaName();if(!item)return;item.rotation=Math.max(-180,Math.min(180,Number(event.target.value)||0));syncAreaNameLabels();syncAreaControls();syncAreaNameContextRotation();scheduleNativePublish();markDirty(true);});modal.querySelector('[data-area-name-context-reset-rotation]')?.addEventListener('click',()=>{const item=selectedAreaName();if(!item)return;checkpoint();item.rotation=0;syncAreaNameLabels();syncAreaControls();syncAreaNameContextRotation();scheduleNativePublish();markDirty(true);});modal.querySelector('[data-area-name-context-delete]')?.addEventListener('click',()=>{const menu=areaNameContextMenu(),id=safeText(menu?.dataset?.areaNameId||selectedAreaNameId).trim();if(id){selectedAreaNameId=id;removeAreaName();scheduleNativePublish();markDirty(true);}hideAreaNameContextMenu();});const confrontanteColor=modal.querySelector('[data-confrontante-context-color]');confrontanteColor?.addEventListener('pointerdown',()=>checkpoint());confrontanteColor?.addEventListener('input',(event)=>{const menu=confrontanteContextMenu(),segment=segmentById(menu?.dataset?.segmentId||selectedSegmentId);if(!segment)return;segment.labelColor=confrontanteLabelColor(event.target.value);segment.labelColorCustomized=true;const group=groupForSegment(segment.id);if(group){group.dataset.labelColorCustomized='1';applyConfrontanteLabelColor(group,segment.labelColor);}segmentsDirty=true;scheduleNativePublish();markDirty(true);});const confrontanteScale=modal.querySelector('[data-confrontante-context-scale]');confrontanteScale?.addEventListener('pointerdown',()=>checkpoint());confrontanteScale?.addEventListener('input',(event)=>{const menu=confrontanteContextMenu(),segment=segmentById(menu?.dataset?.segmentId||selectedSegmentId);if(!segment)return;segment.labelScale=Math.max(.2,Math.min(4,(Number(event.target.value)||100)/100));const group=groupForSegment(segment.id);if(group){const visual=elementVisual('confrontantes');applyScale(group,segment.labelScale*Math.max(.25,Math.min(3,Number(visual.scale)||1)));}syncConfrontanteContextScale();scheduleNativePublish();markDirty(true);});const confrontanteRotation=modal.querySelector('[data-confrontante-context-rotation]');confrontanteRotation?.addEventListener('pointerdown',()=>checkpoint());confrontanteRotation?.addEventListener('input',(event)=>{const menu=confrontanteContextMenu(),segment=segmentById(menu?.dataset?.segmentId||selectedSegmentId);if(!segment)return;segment.labelRotation=Math.max(-180,Math.min(180,Number(event.target.value)||0));const group=groupForSegment(segment.id);if(group)applyRotation(group,segment.labelRotation);syncConfrontanteContextRotation();scheduleNativePublish();markDirty(true);});modal.querySelector('[data-confrontante-context-reset-rotation]')?.addEventListener('click',()=>{const menu=confrontanteContextMenu(),segment=segmentById(menu?.dataset?.segmentId||selectedSegmentId);if(!segment)return;checkpoint();segment.labelRotation=0;const group=groupForSegment(segment.id);if(group)applyRotation(group,0);syncConfrontanteContextRotation();scheduleNativePublish();markDirty(true);});modal.querySelector('[data-confrontante-context-delete]')?.addEventListener('click',()=>{const menu=confrontanteContextMenu(),segment=segmentById(menu?.dataset?.segmentId||selectedSegmentId);if(segment){removeSegment(segment);scheduleNativePublish();markDirty(true);}hideConfrontanteContextMenu();});const polygonStrokeColor=modal.querySelector('[data-polygon-context-stroke-color]'),polygonFillColor=modal.querySelector('[data-polygon-context-fill-color]'),polygonStrokeWidth=modal.querySelector('[data-polygon-context-stroke-width]'),polygonOpacity=modal.querySelector('[data-polygon-context-opacity]');[polygonStrokeColor,polygonFillColor,polygonStrokeWidth,polygonOpacity].forEach((control)=>control?.addEventListener('pointerdown',()=>checkpoint()));polygonStrokeColor?.addEventListener('input',(event)=>{const item=polygonContextItem();if(!item)return;updatePolygonStyle(item.key,{strokeColor:event.target.value});syncPolygonContextMenu();scheduleNativePublish();markDirty(true);});polygonFillColor?.addEventListener('input',(event)=>{const item=polygonContextItem();if(!item)return;documentSettings.polygonFill=true;updatePolygonStyle(item.key,{fill:true,fillColor:event.target.value});syncPolygonContextMenu();scheduleNativePublish();markDirty(true);});polygonStrokeWidth?.addEventListener('input',(event)=>{const item=polygonContextItem();if(!item)return;updatePolygonStyle(item.key,{strokeWidth:(Number(event.target.value)||100)/100});syncPolygonContextMenu();scheduleNativePublish();markDirty(true);});polygonOpacity?.addEventListener('input',(event)=>{const item=polygonContextItem();if(!item)return;const opacity=Math.max(0,Math.min(1,(Number(event.target.value)||0)/100));documentSettings.polygonFill=true;updatePolygonStyle(item.key,{fill:opacity>0,opacity});syncPolygonContextMenu();scheduleNativePublish();markDirty(true);});
      const globalAreaNameColorControl=modal.querySelector('[data-document-setting="globalAreaNameColor"]');globalAreaNameColorControl?.addEventListener('input',(event)=>{documentSettings.areaNameColor=normalizeHexColor(event.target.value,'#111827');documentSettings.areaNames=(documentSettings.areaNames||[]).map((item)=>({ ...item, color:documentSettings.areaNameColor }));applyAreaNameColorsToOverlay();scheduleNativePublish();});globalAreaNameColorControl?.addEventListener('change',()=>syncAreaControls());const technicalLineColorControl=modal.querySelector('[data-document-setting="technicalLineColor"]');technicalLineColorControl?.addEventListener('input',(event)=>{checkpoint();documentSettings.technicalLineColor=normalizeHexColor(event.target.value,'#111827');applyTechnicalLineColorsToOverlay();scheduleNativePublish();});
      const miniMapKindControl=modal.querySelector('[data-document-setting="miniMapKind"]');
      miniMapKindControl?.addEventListener('change',(event)=>{ checkpoint(); documentSettings.miniMapKind=['sat','road','terrain','relief'].includes(event.target.value)?event.target.value:'road'; syncSettingsControls(); notifyMiniMapChange(); scheduleNativePublish(); markDirty(true); });
      const miniMapOpacityControl=modal.querySelector('[data-document-setting="miniMapOpacity"]');
      miniMapOpacityControl?.addEventListener('input',(event)=>{ documentSettings.miniMapOpacity=Math.max(.2,Math.min(1,Number(event.target.value)||.88)); applyMiniMapSettingsToOverlay(); syncSettingsControls(); scheduleNativePublish(); markDirty(true); });
      miniMapOpacityControl?.addEventListener('change',()=>checkpoint());
      modal.querySelector('[data-document-setting="miniMapPerimeterVisible"]')?.addEventListener('change',(event)=>{ checkpoint(); documentSettings.miniMapPerimeterVisible=Boolean(event.target.checked); applyMiniMapSettingsToOverlay(); syncSettingsControls(); scheduleNativePublish(); markDirty(true); });
      overlay?.addEventListener('pointerdown',(event)=>{const vertex=event.target?.closest?.('.sv-vertex-label');if(vertex)selectVertexLabel(vertexLabelKey(vertex));});
      const updateCompactElementVisual=(event)=>{
        const key=safeText(event.target?.dataset?.elementVisualKey).trim(); if(!key||!ELEMENT_VISUAL_DEFAULTS[key])return false;
        const previous=normalizeDocumentSettings(documentSettings);
        const visuals=normalizeElementVisuals(documentSettings);
        if(event.target.dataset.elementVisualScale!=null){
          const value=Math.max(.25,Math.min(3,Number(event.target.value)||1));visuals[key]={...visuals[key],scale:value};
          if(key==='cotas')documentSettings.dimensionScale=value;
          if(key==='vertices')documentSettings.vertexScale=Math.max(.55,Math.min(2.5,value));
        }
        if(event.target.dataset.elementVisualColor!=null){
          const value=normalizeHexColor(event.target.value,ELEMENT_VISUAL_DEFAULTS[key].color);visuals[key]={...visuals[key],color:value};
          if(key==='cotas')documentSettings.dimensionColor=value;
        }
        documentSettings={...documentSettings,elementVisuals:visuals};
        syncSettingsControls();scheduleNativePublish();markDirty(true);
        if(event.type==='change'){history.push({segments:cloneSegments(),settings:previous});if(history.length>40)history.shift();future.length=0;updateHistoryControls();}
        return true;
      };
      modal.addEventListener('input',(event)=>{if(event.target?.matches?.('[data-element-visual-key]'))updateCompactElementVisual(event);});
      modal.addEventListener('change',(event)=>{if(event.target?.matches?.('[data-element-visual-key]'))updateCompactElementVisual(event);});
      // A delegação principal é registrada assim que o modal entra no DOM;
      // inicializações opcionais não podem deixar os botões inertes.
      modal.addEventListener('pointerdown', (event) => {
        if (!event.target?.closest?.('.sv-confrontante-segment-actions')) closeSegmentActionMenus();
        if (presentationMode !== 'inline' && event.target === modal) close();
      });
      modal.addEventListener('keydown', (event) => {
        const targetTag=safeText(event.target?.tagName).toUpperCase();
        const typing=targetTag==='INPUT'||targetTag==='TEXTAREA'||targetTag==='SELECT';
        if((event.ctrlKey||event.metaKey) && !typing && event.key.toLowerCase()==='z') { event.preventDefault(); return event.shiftKey ? redoEdit() : undoEdit(); }
        if((event.ctrlKey||event.metaKey) && !typing && event.key.toLowerCase()==='y') { event.preventDefault(); return redoEdit(); }
        if((event.key==='Delete'||event.key==='Backspace') && !typing && selectedLineRef) { event.preventDefault(); return deleteSelectedLine(); }
        if((event.key==='Delete'||event.key==='Backspace') && !typing && activeToolPanel==='servitudes' && selectedManualServitude()) { event.preventDefault(); return deleteManualServitude(); }
        if(event.key==='Enter' && !typing && servitudeDrawState){event.preventDefault();return finishManualServitudeDrawing();}
        if (event.key === 'Escape') {
          if (servitudeDrawState) return cancelManualServitudeDrawing();
          if (guideState) return cancelGuideMode('Traçado cancelado.');
          if (editLinesActive) return toggleLineEditMode();
          const menuOpen = modal.querySelector('[data-area-name-context-menu]:not([hidden]), [data-confrontante-context-menu]:not([hidden]), [data-polygon-context-menu]:not([hidden])');
          if (menuOpen) {
            hideAreaNameContextMenu();
            hideConfrontanteContextMenu();
            hidePolygonContextMenu();
            return;
          }
          if (presentationMode === 'inline') {
            clearSelectedLine();
            selectedSegmentId = '';
            selectedVertexKey = '';
            selectedDimensionKey = '';
            syncSelectedDimensionControls();
            return;
          }
          close();
        }
      });
      try { window.dispatchEvent(new CustomEvent('surveyor:technical-editor-opened',{detail:{mode:presentationMode,mount:presentationMount,editor:api}})); } catch (_error) {}
      setTimeout(() => modal?.querySelector('[data-editor-action="save"]')?.focus(), 0);
    }

    const api = Object.freeze({ ensureControls, updateControls, start, close, setVisible, fitToViewport:fitZoomToViewport, activateTool:setActiveToolPanel, markDirty, isDirty:()=>hasUnsavedChanges, commitPreviewState, patchLiveFields, patchLiveElements, patchLiveAssets, patchDocumentSettings, autoOrganizeLayout, applyRegulatoryPreset, autoOrganizeVertices, autoOrganizeDimensions, isActive:()=>active, presentationMode:()=>presentationMode, documentMode:()=>nativeMode?'native':'legacy-svg', nativeDocument:()=>window.SurveyorNativeTechnicalDocument?.snapshot?.(nativeDocument)||nativeDocument, readOffsets: () => readOffsets(options), clearOffsets: () => clearOffsets(options), readSegments: () => readSegments(options), clearSegments: () => clearSegments(options), readProjectLayout: () => readProjectLayout(options), readProjectSegments: () => readProjectSegments(options), readProjectDocumentSettings: () => readProjectDocumentSettings(options), readDocumentSettings: () => readDocumentSettings(options), currentDocumentSettings: () => normalizeDocumentSettings(documentSettings), clearDocumentSettings: () => clearDocumentSettings(options), clearProjectSegments: () => clearProjectLayoutCache(options), storageKey: () => contextKey(options), segmentStorageKey: () => segmentKey(options) });
    return api;
  }

  window.SurveyorTechnicalDocumentEditor = Object.freeze({ create, readOffsets, clearOffsets, readSegments, clearSegments, readProjectLayout, readProjectSegments, readProjectDocumentSettings, readDocumentSettings, storageKey: contextKey, segmentStorageKey: segmentKey });
})();
