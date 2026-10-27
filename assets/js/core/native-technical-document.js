(() => {
  'use strict';

  const SCHEMA_VERSION = 'surveyor-native-technical-document-v1';
  const clone = (value) => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value ?? null));
  const safe = (value) => String(value ?? '');
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function perimeterFeature(project) {
    const features = Array.isArray(project?.geojson?.features) ? project.geojson.features : [];
    return features.find((feature) => feature?.properties?.category === 'perimetro')
      || features.find((feature) => /Polygon/.test(feature?.geometry?.type || ''))
      || null;
  }

  function ring(project) {
    const geometry = perimeterFeature(project)?.geometry;
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return clone(geometry.coordinates?.[0] || []);
    if (geometry.type === 'MultiPolygon') return clone(geometry.coordinates?.[0]?.[0] || []);
    return [];
  }

  function vertexLabels(project, count = 0) {
    const feature=perimeterFeature(project);
    const shared=window.SurveyorTechnicalMapBridge?.vertexLabelsForFeature;
    if(typeof shared==='function')return shared(feature,count);
    return Array.from({length:Math.max(0,Number(count)||0)},(_item,index)=>`V-${String(index+1).padStart(2,'0')}`);
  }

  function cleanRing(input = []) {
    const points = Array.isArray(input) ? input.filter((coord) => Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1]))) : [];
    if (points.length > 1) {
      const first = points[0], last = points[points.length - 1];
      if (Number(first[0]) === Number(last[0]) && Number(first[1]) === Number(last[1])) return points.slice(0, -1);
    }
    return points;
  }

  function normalizeFields(fields = {}, project = {}) {
    return {
      mapTitle: safe(fields.mapTitle || 'PLANTA DO IMÓVEL GEORREFERENCIADO'),
      mapRegistration: safe(fields.mapRegistration || ''),
      mapDistrict: safe(fields.mapDistrict || project.district || project.comarca || ''),
      mapRegistryOffice: safe(fields.mapRegistryOffice || project.registryOffice || ''),
      mapIncra: safe(fields.mapIncra || project.incra || ''),
      mapCnib: safe(fields.mapCnib || project.cnib || project.cib || ''),
      mapTechnician: safe(fields.mapTechnician || ''),
      mapScale: safe(fields.mapScale || '1:3.500'),
      mapSheetNumber: safe(fields.mapSheetNumber || 'ÚNICA')
    };
  }

  function normalizeElements(elements = {}) {
    return {
      cotas: elements.cotas !== false,
      glebaCotas: elements.glebaCotas === true,
      vertices: elements.vertices !== false,
      confrontantes: elements.confrontantes !== false,
      north: elements.north !== false,
      grid: elements.grid !== false,
      scale: elements.scale !== false
    };
  }

  function normalizeSettings(settings = {}) {
    const source = settings && typeof settings === 'object' ? settings : {};
    return clone(source);
  }

  function nativeObjects(project, fields, elements, settings) {
    const objects = [];
    Object.entries(fields).forEach(([field, value]) => {
      objects.push({ id:`field:${field}`, type:'text', locked:false, visible:true, data:{ field, text:safe(value), fontWeight:400 } });
    });
    Object.entries(elements).forEach(([key, visible]) => {
      objects.push({ id:`layer:${key}`, type:'layer', locked:false, visible:Boolean(visible), data:{ key } });
    });
    const vertices=cleanRing(ring(project));
    const labels=vertexLabels(project,vertices.length);
    vertices.forEach((coord, index) => {
      const label = labels[index] || `V-${String(index + 1).padStart(2,'0')}`;
      const offset = settings?.vertexLabelOffsets?.[label] || { dx:0, dy:0 };
      const scale = finite(settings?.vertexLabelScales?.[label], 1);
      objects.push({ id:`vertex:${label}`, type:'vertex', locked:true, visible:elements.vertices, data:{ label, lng:Number(coord[0]), lat:Number(coord[1]) } });
      objects.push({ id:`vertex-label:${label}`, type:'vertex-label', locked:false, visible:elements.vertices, data:{ label, dx:finite(offset.dx), dy:finite(offset.dy), scale } });
    });
    (Array.isArray(settings?.areaNames) ? settings.areaNames : []).forEach((item, index) => {
      const id = safe(item?.id || `area-${index + 1}`);
      objects.push({ id:`area-name:${id}`, type:'area-name', locked:false, visible:true, data:clone(item) });
    });
    (Array.isArray(settings?.technicalLines) ? settings.technicalLines : []).forEach((item, index) => {
      const id = safe(item?.id || `line-${index + 1}`);
      objects.push({ id:`technical-line:${id}`, type:'technical-line', locked:false, visible:true, data:clone(item) });
    });
    (Array.isArray(settings?.manualServitudes) ? settings.manualServitudes : []).forEach((item, index) => {
      const id = safe(item?.id || `servitude-${index + 1}`);
      objects.push({ id:`servitude:${id}`, type:'servitude', locked:false, visible:true, data:clone(item) });
    });
    const feature = perimeterFeature(project);
    const layout = feature?.properties?.confrontanteVisualLayout;
    const segments = Array.isArray(layout?.segments) ? layout.segments : [];
    segments.forEach((item, index) => {
      const id = safe(item?.id || `segment-${index + 1}`);
      objects.push({ id:`confrontante:${id}`, type:'confrontante-label', locked:false, visible:elements.confrontantes, data:clone(item) });
    });
    objects.push({ id:'signature', type:'signature', locked:false, visible:settings?.signatureEnabled === true, data:{ enabled:settings?.signatureEnabled === true, scale:finite(settings?.signatureScale,1), x:settings?.signatureX ?? null, y:settings?.signatureY ?? null } });
    objects.push({ id:'imported-signature', type:'signature', locked:false, visible:settings?.importedSignatureEnabled === true, data:{ enabled:settings?.importedSignatureEnabled === true, source:'imported', scale:finite(settings?.importedSignatureScale,1), x:settings?.importedSignatureX ?? null, y:settings?.importedSignatureY ?? null } });
    objects.push({ id:'coordinate-table', type:'coordinate-table', locked:false, visible:settings?.coordinateTableEnabled === true, data:{ enabled:settings?.coordinateTableEnabled === true, rows:finite(settings?.coordinateTableRows,8), scale:finite(settings?.coordinateTableScale,1), x:settings?.coordinateTableX ?? null, y:settings?.coordinateTableY ?? null } });
    return objects;
  }

  function create({ project = {}, page = 'pranchas.html', layoutId = 'georreferenciada-a4', fields = {}, elements = {}, settings = {}, sheet = {} } = {}) {
    const normalizedFields = normalizeFields(fields, project);
    const normalizedElements = normalizeElements(elements);
    const normalizedSettings = normalizeSettings(settings);
    const projectId = safe(project?.id || project?.projectId || 'sem-projeto');
    return {
      schemaVersion: SCHEMA_VERSION,
      documentId: `${projectId}:${safe(layoutId || 'padrao')}`,
      projectId,
      page: safe(page || 'pranchas.html'),
      layoutId: safe(layoutId || 'padrao'),
      sheet: clone(sheet || {}),
      geometry: clone(project?.geojson || null),
      project: {
        id: projectId,
        propertyName: safe(project?.propertyName || project?.title || project?.name || ''),
        owner: safe(project?.owner || project?.ownerName || project?.metadata?.owner || ''),
        city: safe(project?.city || project?.municipality || ''),
        uf: safe(project?.uf || project?.stateCode || '')
      },
      fields: normalizedFields,
      elements: normalizedElements,
      settings: normalizedSettings,
      objects: nativeObjects(project, normalizedFields, normalizedElements, normalizedSettings),
      updatedAt: new Date().toISOString()
    };
  }

  function valid(documentModel) {
    return Boolean(documentModel && documentModel.schemaVersion === SCHEMA_VERSION && documentModel.projectId);
  }

  function snapshot(documentModel) { return valid(documentModel) ? clone(documentModel) : null; }

  function patchField(documentModel, field, value) {
    if (!valid(documentModel) || !field) return false;
    documentModel.fields ||= {};
    documentModel.fields[field] = safe(value);
    const node = documentModel.objects?.find?.((item) => item.id === `field:${field}`);
    if (node) node.data = { ...(node.data || {}), field, text:safe(value), fontWeight:finite(node.data?.fontWeight,400) };
    documentModel.updatedAt = new Date().toISOString();
    return true;
  }

  function patchElement(documentModel, key, visible) {
    if (!valid(documentModel) || !key) return false;
    documentModel.elements ||= {};
    documentModel.elements[key] = Boolean(visible);
    const node = documentModel.objects?.find?.((item) => item.id === `layer:${key}`);
    if (node) node.visible = Boolean(visible);
    if (key === 'vertices') (documentModel.objects || []).filter((item) => item.type === 'vertex' || item.type === 'vertex-label').forEach((item) => { item.visible = Boolean(visible); });
    if (key === 'confrontantes') (documentModel.objects || []).filter((item) => item.type === 'confrontante-label').forEach((item) => { item.visible = Boolean(visible); });
    documentModel.updatedAt = new Date().toISOString();
    return true;
  }

  function patchSettings(documentModel, settings = {}) {
    if (!valid(documentModel) || !settings || typeof settings !== 'object') return false;
    documentModel.settings = clone(settings);
    const keep = (documentModel.objects || []).filter((item) => !['area-name','technical-line','servitude','signature','coordinate-table'].includes(item.type));
    keep.filter((item) => item.type === 'vertex-label').forEach((item) => {
      const label = safe(item?.data?.label || '').toUpperCase();
      const offset = settings?.vertexLabelOffsets?.[label] || {};
      item.data = { ...(item.data || {}), dx:finite(offset.dx,item.data?.dx || 0), dy:finite(offset.dy,item.data?.dy || 0), scale:finite(settings?.vertexLabelScales?.[label], item.data?.scale || 1) };
    });
    (Array.isArray(settings?.areaNames) ? settings.areaNames : []).forEach((item, index) => {
      const id = safe(item?.id || `area-${index + 1}`);
      keep.push({ id:`area-name:${id}`, type:'area-name', locked:false, visible:true, data:clone(item) });
    });
    (Array.isArray(settings?.technicalLines) ? settings.technicalLines : []).forEach((item, index) => {
      const id = safe(item?.id || `line-${index + 1}`);
      keep.push({ id:`technical-line:${id}`, type:'technical-line', locked:false, visible:true, data:clone(item) });
    });
    (Array.isArray(settings?.manualServitudes) ? settings.manualServitudes : []).forEach((item, index) => {
      const id = safe(item?.id || `servitude-${index + 1}`);
      keep.push({ id:`servitude:${id}`, type:'servitude', locked:false, visible:true, data:clone(item) });
    });
    keep.push({ id:'signature', type:'signature', locked:false, visible:settings?.signatureEnabled === true, data:{ enabled:settings?.signatureEnabled === true, scale:finite(settings?.signatureScale,1), x:settings?.signatureX ?? null, y:settings?.signatureY ?? null } });
    keep.push({ id:'imported-signature', type:'signature', locked:false, visible:settings?.importedSignatureEnabled === true, data:{ enabled:settings?.importedSignatureEnabled === true, source:'imported', scale:finite(settings?.importedSignatureScale,1), x:settings?.importedSignatureX ?? null, y:settings?.importedSignatureY ?? null } });
    keep.push({ id:'coordinate-table', type:'coordinate-table', locked:false, visible:settings?.coordinateTableEnabled === true, data:{ enabled:settings?.coordinateTableEnabled === true, rows:finite(settings?.coordinateTableRows,8), scale:finite(settings?.coordinateTableScale,1), x:settings?.coordinateTableX ?? null, y:settings?.coordinateTableY ?? null } });
    documentModel.objects = keep;
    documentModel.updatedAt = new Date().toISOString();
    return true;
  }


  function captureRenderModel(documentModel, svg) {
    if (!valid(documentModel) || !svg?.querySelectorAll) return null;
    const textNodes = Array.from(svg.querySelectorAll('text'));
    const texts = textNodes.map((node, index) => {
      const nativeObjectId = safe(node.getAttribute('data-native-object-id') || '');
      const liveField = safe(node.getAttribute('data-live-field') || node.closest?.('[data-live-field-row]')?.getAttribute?.('data-live-field-row') || '');
      const fontSize = finite(node.getAttribute('font-size'), 0);
      const fontWeight = safe(node.getAttribute('font-weight') || '400') || '400';
      const id = `render-text:${String(index + 1).padStart(4,'0')}`;
      node.setAttribute('data-native-render-id', id);
      return {
        id,
        type:'text',
        semanticObjectId:nativeObjectId || null,
        liveField:liveField || null,
        text:safe(node.textContent),
        x:safe(node.getAttribute('x')),
        y:safe(node.getAttribute('y')),
        transform:safe(node.getAttribute('transform')),
        textAnchor:safe(node.getAttribute('text-anchor')),
        fontFamily:safe(node.getAttribute('font-family') || 'Arial, Helvetica, sans-serif'),
        fontSize,
        fontWeight,
        fill:safe(node.getAttribute('fill') || '#111827'),
        stroke:safe(node.getAttribute('stroke') || 'none'),
        strokeWidth:safe(node.getAttribute('stroke-width') || '0'),
        paintOrder:safe(node.getAttribute('paint-order') || 'normal')
      };
    });
    documentModel.renderModel = {
      version:1,
      renderer:'native-svg',
      typographyProfile:safe(globalThis?.SurveyorTechnicalSvgTypography?.PROFILE || globalThis?.window?.SurveyorTechnicalSvgTypography?.PROFILE || 'surveyor-vector-pdf-v1'),
      texts
    };
    documentModel.updatedAt = new Date().toISOString();
    return clone(documentModel.renderModel);
  }

  function object(documentModel, id) {
    if (!valid(documentModel)) return null;
    return (documentModel.objects || []).find((item) => item.id === String(id)) || null;
  }

  window.SurveyorNativeTechnicalDocument = Object.freeze({
    SCHEMA_VERSION,
    create,
    valid,
    snapshot,
    patchField,
    patchElement,
    patchSettings,
    captureRenderModel,
    object
  });
})();
