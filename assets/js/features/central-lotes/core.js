(() => {
  'use strict';
  // Motor independente da interface: seleção de lotes, validação e isolamento dos arquivos.
  const safeName = (text, fallback = 'lote') => String(text || fallback).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 65) || fallback;
  const polygon = (feature) => feature?.geometry?.type === 'Polygon';
  const samePoint = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length >= 2 && b.length >= 2 && Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;
  const props = (feature) => feature?.properties || {};
  function validate(feature, geo = globalThis.turf) {
    if (!geo?.area || !geo?.kinks) return 'Biblioteca cartográfica indisponível; atualize a página.';
    if (!polygon(feature)) return 'Somente polígonos simples podem gerar peças neste teste.';
    const rings = feature.geometry.coordinates;
    if (!Array.isArray(rings) || !rings.length) return 'Polígono sem coordenadas.';
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 4) return 'Anel com menos de três vértices.';
      if (!ring.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) return 'Coordenadas geográficas inválidas.';
      if (!samePoint(ring[0], ring[ring.length - 1])) return 'Anel não fechado.';
      if (new Set(ring.slice(0, -1).map((p) => `${p[0]},${p[1]}`)).size < 3) return 'Menos de três vértices distintos.';
    }
    try { if (geo?.kinks?.(feature)?.features?.length) return 'Auto-interseção detectada; corrija no mapa.'; } catch { return 'Não foi possível validar a topologia.'; }
    const area = Number(geo?.area?.(feature));
    if (!Number.isFinite(area) || area <= 0) return 'Área inválida ou geometria degenerada.';
    return '';
  }
  function lots(project) {
    const features = project?.geojson?.features || [];
    if (!Array.isArray(features)) return [];
    const polygonItems = features.map((feature, index) => ({ feature, index })).filter(({ feature }) => polygon(feature));
    const hasSubdivisions = polygonItems.some(({feature}) => ['gleba','lote'].includes(String(props(feature).category || '').toLowerCase()) || props(feature).generatedBy === 'map-glebas');
    return polygonItems.map(({ feature, index }, order) => {
      const p = props(feature);
      const category = String(p.category || 'poligono').toLowerCase();
      const label = String(p.name || p.label || p.lotName || `${category === 'perimetro' ? 'Imóvel' : 'Lote'} ${String(order + 1).padStart(2, '0')}`);
      return { index, feature, label, category, isSubdivision: ['gleba','lote'].includes(category) || p.generatedBy === 'map-glebas', selectedByDefault: !hasSubdivisions || ['gleba','lote'].includes(category) || p.generatedBy === 'map-glebas' };
    });
  }
  function isolate(project, lot) {
    if (!project?.geojson || !lot?.feature || !polygon(lot.feature)) throw new Error('Lote ou projeto inválido.');
    const clone = JSON.parse(JSON.stringify(lot.feature));
    clone.properties = { ...clone.properties, name: lot.label };
    return { project: { id: project.id, name: lot.label, propertyName: lot.label, ownerName: project.ownerName || project.owner || '', municipality: project.city || project.municipality || '', stateCode: project.uf || project.stateCode || '', registrationNumber: project.registrationNumber || '', metadata: { ...(project.metadata || {}) } }, featureCollection: { type: 'FeatureCollection', features: [clone] }, referenceLayers: project.referenceLayers || [] };
  }
  function officialProject(project, lot) {
    const source = project?.geojson?.features?.[lot?.index];
    if (!source?.geometry || source !== lot.feature) throw new Error('O lote selecionado não pertence ao projeto carregado.');
    const safe = JSON.parse(JSON.stringify(project));
    const feature = JSON.parse(JSON.stringify(source));
    const properties = feature.properties || {};
    feature.properties = { ...properties, category: 'perimetro', name: lot.label, documentScope:'gleba', scopeLabel:lot.label };
    safe.geojson = { type:'FeatureCollection', features:[feature] };
    const originalName = String(project.propertyName || project.title || project.name || 'Imóvel');
    safe.propertyName = `${originalName} — ${lot.label}`;
    safe.title = safe.propertyName;
    safe.name = safe.propertyName;
    const localOwner = String(properties.owner || properties.heir || '').trim();
    if (localOwner) {
      safe.owner = localOwner; safe.ownerName = localOwner;
      safe.metadata = { ...(safe.metadata || {}), documentProfile: { ...(safe.metadata?.documentProfile || {}), ownerName: localOwner } };
    }
    safe.documentScope = { type:'gleba', label:lot.label, sourceProjectId:project.id };
    return safe;
  }
  function lotFolder(lot, position) { return `${String(position + 1).padStart(2, '0')}-${safeName(lot.label)}`; }
  globalThis.SurveyorLotCenterCore = Object.freeze({ safeName, validate, lots, isolate, officialProject, lotFolder });
})();
