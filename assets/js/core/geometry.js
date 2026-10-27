(() => {
  'use strict';

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  };

  const featuresOf = (input) => {
    if (Array.isArray(input)) return input.filter(Boolean);
    if (input?.type === 'FeatureCollection') return Array.isArray(input.features) ? input.features.filter(Boolean) : [];
    if (input?.geojson?.type === 'FeatureCollection') return Array.isArray(input.geojson.features) ? input.geojson.features.filter(Boolean) : [];
    if (Array.isArray(input?.geojson?.features)) return input.geojson.features.filter(Boolean);
    return [];
  };

  const isPolygon = (feature) => /Polygon/i.test(String(feature?.geometry?.type || ''));
  const props = (feature) => feature?.properties || {};
  const categoryOf = (feature) => String(props(feature).category || '').trim().toLowerCase();
  const isGleba = (feature) => isPolygon(feature) && (categoryOf(feature) === 'gleba' || props(feature).generatedBy === 'map-glebas');
  const isPerimeter = (feature) => isPolygon(feature) && categoryOf(feature) === 'perimetro';

  const turfArea = (feature) => {
    try {
      const value = globalThis.turf?.area?.(feature);
      return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    } catch { return 0; }
  };

  const largestByArea = (items) => {
    const list = (items || []).filter(isPolygon);
    if (!list.length) return null;
    return list.slice().sort((a, b) => turfArea(b) - turfArea(a))[0] || list[0];
  };

  const rootSourceFeature = (features, glebas) => {
    const ids = new Set();
    glebas.forEach((feature) => {
      const p = props(feature);
      [p.rootSourceLayerId, p.rootLayerId, p.originalSourceLayerId].forEach((value) => {
        const id = String(value || '').trim();
        if (id) ids.add(id);
      });
    });
    if (!ids.size) return null;
    return largestByArea(features.filter((feature) => isPolygon(feature) && ids.has(String(props(feature).id || '').trim())));
  };

  const normalizeUnionFeature = (feature, source = 'glebas') => {
    if (!feature?.geometry || !isPolygon(feature)) return null;
    const out = clone(feature);
    out.type = 'Feature';
    out.properties = {
      ...(out.properties || {}),
      category: 'perimetro',
      name: out.properties?.name || 'Perímetro total do imóvel',
      derivedPerimeter: true,
      derivedFrom: source
    };
    return out;
  };

  const unionPolygons = (items) => {
    const polygons = (items || []).filter(isPolygon).map((feature) => clone(feature));
    if (!polygons.length) return null;
    if (polygons.length === 1) return normalizeUnionFeature(polygons[0], 'single-gleba');
    const turf = globalThis.turf;
    if (!turf) return null;

    // Turf 7: union recebe FeatureCollection. Mantém fallback para Turf 6.
    if (typeof turf.union === 'function') {
      try {
        const fc = typeof turf.featureCollection === 'function'
          ? turf.featureCollection(polygons)
          : { type: 'FeatureCollection', features: polygons };
        const merged = turf.union(fc);
        if (merged?.geometry) return normalizeUnionFeature(merged, 'gleba-union');
      } catch {}
      try {
        let merged = polygons[0];
        for (let i = 1; i < polygons.length; i += 1) {
          merged = turf.union(merged, polygons[i]);
          if (!merged?.geometry) return null;
        }
        return normalizeUnionFeature(merged, 'gleba-union');
      } catch {}
    }

    if (typeof turf.dissolve === 'function') {
      try {
        const fc = typeof turf.featureCollection === 'function'
          ? turf.featureCollection(polygons)
          : { type: 'FeatureCollection', features: polygons };
        const dissolved = turf.dissolve(fc);
        const candidate = dissolved?.type === 'FeatureCollection' ? largestByArea(dissolved.features) : dissolved;
        if (candidate?.geometry) return normalizeUnionFeature(candidate, 'gleba-dissolve');
      } catch {}
    }
    return null;
  };



  function glebaScopeId(feature, index = 0) {
    const p = props(feature);
    const explicit = String(p.id || feature?.id || p.uuid || p.layerId || '').trim();
    return explicit || `gleba-index-${Math.max(0, Number(index) || 0)}`;
  }

  function glebaScopeLabel(feature, index = 0) {
    const p = props(feature);
    return String(p.name || p.label || p.heir || p.owner || `Gleba ${String(index + 1).padStart(2, '0')}`).trim();
  }

  function listGlebas(input) {
    return featuresOf(input).filter(isGleba).map((feature, index) => ({
      id: glebaScopeId(feature, index),
      label: glebaScopeLabel(feature, index),
      feature,
      index
    }));
  }

  function findGleba(input, scopeId) {
    const wanted = String(scopeId || '').trim();
    if (!wanted || wanted === 'property') return null;
    return listGlebas(input).find((item) => item.id === wanted)?.feature || null;
  }

  function normalizeScopedGleba(feature, label = '') {
    if (!feature?.geometry || !isGleba(feature)) return null;
    const out = clone(feature);
    const original = { ...(out.properties || {}) };
    out.type = 'Feature';
    out.properties = {
      ...original,
      category: 'perimetro',
      originalCategory: original.category || 'gleba',
      documentScope: 'gleba',
      scopeLabel: label || original.name || 'Gleba selecionada',
      scopeSourceFeatureId: original.id || out.id || ''
    };
    return out;
  }

  function resolvePerimeter(input) {
    const features = featuresOf(input);
    const polygons = features.filter(isPolygon);
    if (!polygons.length) return null;

    const glebas = polygons.filter(isGleba);
    const explicit = polygons.filter(isPerimeter);
    const root = rootSourceFeature(polygons, glebas);
    const union = glebas.length >= 2 ? unionPolygons(glebas) : null;

    // 1. Quando as glebas guardam o ID da geometria-fonte, essa é a fonte mais fiel.
    if (root) {
      const rootArea = turfArea(root);
      const unionArea = turfArea(union);
      if (!union || !rootArea || !unionArea || rootArea >= unionArea * 0.985) return root;
    }

    // 2. Um perímetro explicitamente classificado continua prioritário, desde que
    // represente o imóvel inteiro. Se ele tiver área de uma única gleba, usa a união.
    const explicitBest = largestByArea(explicit);
    if (explicitBest) {
      const explicitArea = turfArea(explicitBest);
      const unionArea = turfArea(union);
      if (!union || !explicitArea || !unionArea || explicitArea >= unionArea * 0.985) return explicitBest;
    }

    // 3. Sem perímetro-fonte utilizável, reconstrói o imóvel pela união das glebas.
    if (union) return union;

    // 4. Compatibilidade com projetos antigos: nunca usa simplesmente "o primeiro".
    return largestByArea(polygons);
  }

  function perimeterRing(input) {
    const feature = resolvePerimeter(input);
    const geometry = feature?.geometry;
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return geometry.coordinates?.[0] || [];
    if (geometry.type === 'MultiPolygon') {
      const polygons = geometry.coordinates || [];
      if (!polygons.length) return [];
      const candidates = polygons.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } }));
      return largestByArea(candidates)?.geometry?.coordinates?.[0] || [];
    }
    return [];
  }

  function projectAreaSquareMeters(input) {
    return turfArea(resolvePerimeter(input));
  }

  globalThis.SurveyorProjectGeometry = Object.freeze({
    featuresOf,
    isPolygon,
    isGleba,
    resolvePerimeter,
    perimeterRing,
    projectAreaSquareMeters,
    unionPolygons,
    listGlebas,
    findGleba,
    glebaScopeId,
    glebaScopeLabel,
    normalizeScopedGleba
  });
})();
