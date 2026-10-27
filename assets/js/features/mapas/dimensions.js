(() => {
  'use strict';

  function create(deps = {}) {
    const { area, ringOfFeature, hav, num, escape, dimensionScaleForKey } = deps;
    if (![area, ringOfFeature, hav, num, escape, dimensionScaleForKey].every((fn) => typeof fn === 'function')) throw new Error('Dependências do módulo de cotas não foram fornecidas.');

    function resolveGlebaFeatures(projectData, rootFeature = null) {
      const helperEntries = globalThis.SurveyorProjectGeometry?.listGlebas?.(projectData) || [];
      const helperFeatures = helperEntries.map((entry) => entry?.feature).filter(Boolean);
      const fallbackFeatures = (projectData?.geojson?.features || []).filter((feature) => {
        if (!/Polygon/i.test(String(feature?.geometry?.type || ''))) return false;
        const props = feature?.properties || {};
        const category = String(props.category || '').trim().toLowerCase();
        return category === 'gleba' || props.generatedBy === 'map-glebas';
      });
      const seen = new Set();
      const merged = [...helperFeatures, ...fallbackFeatures].filter((feature) => {
        const geometryKey = feature?.geometry ? JSON.stringify(feature.geometry) : '';
        const idKey = String(feature?.properties?.id || feature?.id || '').trim();
        const key = geometryKey || idKey;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const rootArea = area(rootFeature);
      return merged.filter((feature) => {
        const featureArea = area(feature);
        if (!featureArea) return false;
        if (!rootArea) return true;
        return featureArea < (rootArea * 0.985);
      });
    }

    function glebaFeatureId(feature) {
      const props = feature?.properties || {};
      return String(props.id || feature?.id || props.uuid || props.layerId || '').trim();
    }

    function glebaFeatureParentId(feature) {
      const props = feature?.properties || {};
      return String(props.parentLayerId || props.sourceLayerId || props.sourceId || '').trim();
    }

    function isNestedGleba(parentFeature, childFeature) {
      if (!parentFeature?.geometry || !childFeature?.geometry || parentFeature === childFeature) return false;
      const parentArea = area(parentFeature);
      const childArea = area(childFeature);
      if (!(parentArea > 0 && childArea > 0 && childArea < parentArea * 0.999)) return false;
      const turfApi = globalThis.turf;
      if (typeof turfApi?.booleanWithin === 'function') {
        try { if (turfApi.booleanWithin(childFeature, parentFeature)) return true; } catch {}
      }
      if (typeof turfApi?.booleanContains === 'function') {
        try { if (turfApi.booleanContains(parentFeature, childFeature)) return true; } catch {}
      }
      if (typeof turfApi?.centroid === 'function' && typeof turfApi?.booleanPointInPolygon === 'function') {
        try {
          const center = turfApi.centroid(childFeature);
          if (center?.geometry && turfApi.booleanPointInPolygon(center, parentFeature)) return true;
        } catch {}
      }
      return false;
    }

    function resolveLeafGlebaFeatures(projectData, rootFeature = null) {
      const features = resolveGlebaFeatures(projectData, rootFeature);
      if (features.length <= 1) return features;

      // Quando uma gleba é novamente dividida, ela vira um agrupador hierárquico.
      // Suas medidas não devem ser desenhadas junto das glebas-filhas, pois isso
      // sobrepõe cotas de níveis diferentes (ex.: gleba-mãe + lotes internos).
      // Priorizamos o vínculo parentLayerId/sourceLayerId gravado pelo divisor.
      const parentIds = new Set(features.map(glebaFeatureParentId).filter(Boolean));
      const directLeaves = features.filter((feature) => {
        const id = glebaFeatureId(feature);
        return !id || !parentIds.has(id);
      });

      // Em projetos antigos/importados o vínculo hierárquico pode não existir.
      // Nesse caso, removemos geometricamente polígonos que contêm outra gleba
      // menor, mantendo apenas as glebas terminais (folhas) para cotagem.
      const candidates = directLeaves.length ? directLeaves : features;
      return candidates.filter((feature) => !candidates.some((other) => isNestedGleba(feature, other)));
    }

    function canonicalDimensionSegmentKey(a, b, precision = 1e6) {
      const pointKey = (coord) => {
        const lng = Math.round(Number(coord?.[0] || 0) * precision);
        const lat = Math.round(Number(coord?.[1] || 0) * precision);
        return `${lng}:${lat}`;
      };
      const ka = pointKey(a);
      const kb = pointKey(b);
      return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    }

    function glebaHierarchyDepth(feature, features) {
      const byId = new Map(features.map((item) => [glebaFeatureId(item), item]).filter(([id]) => id));
      let depth = 0;
      let current = feature;
      const visited = new Set();
      while (current) {
        const parentId = glebaFeatureParentId(current);
        if (!parentId || visited.has(parentId)) break;
        const parent = byId.get(parentId);
        if (!parent) break;
        visited.add(parentId);
        depth += 1;
        current = parent;
      }
      return depth;
    }

    function resolveDimensionGlebaFeatures(projectData, rootFeature = null) {
      const features = resolveGlebaFeatures(projectData, rootFeature);
      return features.slice().sort((a, b) => {
        const depthDiff = glebaHierarchyDepth(b, features) - glebaHierarchyDepth(a, features);
        if (depthDiff) return depthDiff;
        return area(a) - area(b);
      });
    }

    function projectedDimensionSegment(a, b, project) {
      const [x1, y1] = project(a);
      const [x2, y2] = project(b);
      const dx = x2 - x1;
      const dy = y2 - y1;
      return { a, b, x1, y1, x2, y2, dx, dy, len: Math.hypot(dx, dy) || 0 };
    }

    function projectedPointLineDistance(x, y, segment) {
      if (!segment?.len) return Infinity;
      return Math.abs(((x - segment.x1) * segment.dy) - ((y - segment.y1) * segment.dx)) / segment.len;
    }

    function projectedSegmentOverlapInfo(first, second, tolerance = 1.35) {
      if (!first?.len || !second?.len) return { shared: false, same: false, overlap: 0, smallerRatio: 0 };
      const parallelError = Math.abs((first.dx * second.dy) - (first.dy * second.dx)) / (first.len * second.len);
      if (parallelError > 0.075) return { shared: false, same: false, overlap: 0, smallerRatio: 0 };
      const lineDistance = Math.max(
        projectedPointLineDistance(second.x1, second.y1, first),
        projectedPointLineDistance(second.x2, second.y2, first),
        projectedPointLineDistance(first.x1, first.y1, second),
        projectedPointLineDistance(first.x2, first.y2, second)
      );
      if (lineDistance > tolerance) return { shared: false, same: false, overlap: 0, smallerRatio: 0 };

      const ux = first.dx / first.len;
      const uy = first.dy / first.len;
      const secondA = ((second.x1 - first.x1) * ux) + ((second.y1 - first.y1) * uy);
      const secondB = ((second.x2 - first.x1) * ux) + ((second.y2 - first.y1) * uy);
      const overlapStart = Math.max(0, Math.min(secondA, secondB));
      const overlapEnd = Math.min(first.len, Math.max(secondA, secondB));
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const smaller = Math.max(0.0001, Math.min(first.len, second.len));
      const smallerRatio = overlap / smaller;
      const shared = overlap >= Math.max(2.2, smaller * 0.72) && smallerRatio >= 0.72;
      const same = shared
        && smallerRatio >= 0.965
        && Math.abs(first.len - second.len) <= Math.max(2.2, smaller * 0.045);
      return { shared, same, overlap, smallerRatio, lineDistance };
    }

    function dimensionSegmentsForRing(coords, project) {
      const closed = ensureClosedRing(coords);
      const segments = [];
      for (let index = 0; index < Math.max(0, closed.length - 1); index += 1) {
        segments.push(projectedDimensionSegment(closed[index], closed[index + 1], project));
      }
      return segments;
    }

    function isDescendantGleba(ancestorFeature, descendantFeature, features) {
      if (!ancestorFeature || !descendantFeature || ancestorFeature === descendantFeature) return false;
      const ancestorId = glebaFeatureId(ancestorFeature);
      if (ancestorId) {
        const byId = new Map(features.map((item) => [glebaFeatureId(item), item]).filter(([id]) => id));
        let current = descendantFeature;
        const visited = new Set();
        while (current) {
          const parentId = glebaFeatureParentId(current);
          if (!parentId || visited.has(parentId)) break;
          if (parentId === ancestorId) return true;
          visited.add(parentId);
          current = byId.get(parentId);
        }
      }
      return isNestedGleba(ancestorFeature, descendantFeature);
    }

    function glebaDimensionLabels(projectData, rootFeature, project, mapBox, options = {}) {
      const features = resolveDimensionGlebaFeatures(projectData, rootFeature);
      if (!features.length) return '';

      // R12: cotas hierárquicas têm lado definido pelo dono do segmento.
      // - A cota do imóvel principal continua do lado de fora do perímetro.
      // - A cota da gleba/filha fica colada por dentro da própria gleba.
      // - Quando uma gleba-mãe compartilha um trecho com uma filha, a cota da mãe
      //   vai para o lado oposto. Assim pai e filha nunca ficam empilhados.
      // - Se uma gleba repete exatamente um segmento do perímetro principal, a
      //   duplicata interna é suprimida (ex.: dois "204,6 m" na mesma linha).
      const seenSegments = new Set();
      const renderedSegments = [];
      const occupiedLabels = Array.isArray(options.occupiedLabels) ? options.occupiedLabels : [];
      const rootSegments = dimensionSegmentsForRing(ringOfFeature(rootFeature), project);
      const segmentCache = new Map(features.map((feature) => [feature, dimensionSegmentsForRing(ringOfFeature(feature), project)]));
      const descendantsCache = new Map(features.map((feature) => [
        feature,
        features.filter((other) => isDescendantGleba(feature, other, features))
      ]));

      return features.map((feature) => {
        const closed = ensureClosedRing(ringOfFeature(feature));
        if (closed.length < 4) return '';
        const descendantSegments = (descendantsCache.get(feature) || []).flatMap((child) => segmentCache.get(child) || []);
        return cadDimensionLabels(closed, project, mapBox, {
          ...options,
          placement: 'inside',
          containerCoords: closed,
          occupiedLabels,
          ownerId: glebaFeatureId(feature),
          compact: true,
          placementResolver: (a, b) => {
            const current = projectedDimensionSegment(a, b, project);
            const sharedWithChild = descendantSegments.some((childSegment) => projectedSegmentOverlapInfo(current, childSegment).shared);
            return sharedWithChild ? 'outside' : 'inside';
          },
          segmentFilter: (a, b) => {
            const key = canonicalDimensionSegmentKey(a, b);
            const current = projectedDimensionSegment(a, b, project);
            if (seenSegments.has(key)) return false;
            if (rootSegments.some((rootSegment) => projectedSegmentOverlapInfo(current, rootSegment).same)) return false;
            if (renderedSegments.some((rendered) => projectedSegmentOverlapInfo(current, rendered).same)) return false;
            seenSegments.add(key);
            renderedSegments.push(current);
            return true;
          }
        });
      }).join('');
    }

    function ensureClosedRing(coords) {
      const ringCoords = Array.isArray(coords) ? coords.slice() : [];
      if (!ringCoords.length) return [];
      const first = ringCoords[0];
      const last = ringCoords[ringCoords.length - 1];
      if (!last || first[0] !== last[0] || first[1] !== last[1]) ringCoords.push(first);
      return ringCoords;
    }

    function projectRingPoints(coords, project) {
      return ensureClosedRing(coords).slice(0, -1).map((coord) => {
        const [x, y] = project(coord);
        return { x, y };
      });
    }

    function pointOnProjectedSegment(point, a, b, tolerance = 0.45) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 <= 1e-12) return Math.hypot(point.x - a.x, point.y - a.y) <= tolerance;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
      const px = a.x + t * dx;
      const py = a.y + t * dy;
      return Math.hypot(point.x - px, point.y - py) <= tolerance;
    }

    function pointInProjectedRing(point, ringPoints) {
      if (!Array.isArray(ringPoints) || ringPoints.length < 3) return false;
      for (let i = 0, j = ringPoints.length - 1; i < ringPoints.length; j = i, i += 1) {
        if (pointOnProjectedSegment(point, ringPoints[j], ringPoints[i])) return true;
      }
      let inside = false;
      for (let i = 0, j = ringPoints.length - 1; i < ringPoints.length; j = i, i += 1) {
        const xi = ringPoints[i].x;
        const yi = ringPoints[i].y;
        const xj = ringPoints[j].x;
        const yj = ringPoints[j].y;
        const intersects = ((yi > point.y) !== (yj > point.y))
          && (point.x < (((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-12)) + xi);
        if (intersects) inside = !inside;
      }
      return inside;
    }

    function resolveDimensionAnchor(midX, midY, nx, ny, offset, placement, containerProjected) {
      const targetInside = placement === 'inside';
      const factors = [1, 0.82, 0.65, 0.5, 0.36, 0.24, 0.16];
      for (const factor of factors) {
        const distance = Math.max(1.15, offset * factor);
        const plus = { x: midX + nx * distance, y: midY + ny * distance };
        const minus = { x: midX - nx * distance, y: midY - ny * distance };
        const plusInside = pointInProjectedRing(plus, containerProjected);
        const minusInside = pointInProjectedRing(minus, containerProjected);
        if (targetInside) {
          if (plusInside && !minusInside) return plus;
          if (minusInside && !plusInside) return minus;
          if (plusInside) return plus;
          if (minusInside) return minus;
        } else {
          if (!plusInside && minusInside) return plus;
          if (!minusInside && plusInside) return minus;
          if (!plusInside) return plus;
          if (!minusInside) return minus;
        }
      }
      return targetInside
        ? { x: midX - nx * Math.max(1.15, offset * 0.16), y: midY - ny * Math.max(1.15, offset * 0.16) }
        : { x: midX + nx * offset, y: midY + ny * offset };
    }

    function dimensionLabelRect(anchor, angle, label, fontSize) {
      const rawW = Math.max(fontSize * 3.05, String(label || '').length * fontSize * 0.60);
      const rawH = Math.max(fontSize * 1.42, 3.65);
      const radians = Math.abs(Number(angle || 0)) * Math.PI / 180;
      const width = Math.abs(rawW * Math.cos(radians)) + Math.abs(rawH * Math.sin(radians));
      const height = Math.abs(rawW * Math.sin(radians)) + Math.abs(rawH * Math.cos(radians));
      return { x1: anchor.x - width / 2 - 0.72, y1: anchor.y - height / 2 - 0.72, x2: anchor.x + width / 2 + 0.72, y2: anchor.y + height / 2 + 0.72 };
    }

    function rectsOverlap(a, b) {
      return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
    }

    function chooseCollisionFreeDimensionAnchor({ midX, midY, dx, dy, len, nx, ny, offset, placement, containerProjected, angle, label, fontSize, occupiedLabels, mapBox, lockNormalOffset = false }) {
      const tangentX = dx / len;
      const tangentY = dy / len;
      const base = resolveDimensionAnchor(midX, midY, nx, ny, offset, placement, containerProjected);
      const signX = base.x - midX;
      const signY = base.y - midY;
      const normalLen = Math.hypot(signX, signY) || 1;
      const ux = signX / normalLen;
      const uy = signY / normalLen;
      const tangentRoom = Math.max(0, (len / 2) - Math.max(2.2, fontSize * 1.7));
      const t1 = Math.min(tangentRoom, fontSize * 1.45);
      const t2 = Math.min(tangentRoom, fontSize * 2.7);
      const t3 = Math.min(tangentRoom, fontSize * 4.0);
      const n1 = Math.min(fontSize * 0.46, Math.max(0.45, offset * 0.42));
      const n2 = Math.max(fontSize * 0.82, offset * 0.72);
      const n3 = Math.max(fontSize * 1.20, offset * 1.06);
      const n4 = Math.max(fontSize * 1.65, offset * 1.46);
      // R26.3.61: cotas externas do perímetro não podem "pular" entre faixas.
      // Em sequências quase colineares isso fazia a cadeia de medidas parecer
      // quebrada. Quando lockNormalOffset está ativo, o anti-colisão só desloca
      // o texto no sentido tangencial da própria aresta; a distância normal ao
      // perímetro permanece constante.
      const attempts = lockNormalOffset
        ? [[0, 0], [t1, 0], [-t1, 0], [t2, 0], [-t2, 0], [t3, 0], [-t3, 0]]
        : [
            [0, 0], [t1, 0], [-t1, 0], [t2, 0], [-t2, 0],
            [0, n1], [t1, n1], [-t1, n1], [t3, n1], [-t3, n1],
            [0, n2], [t2, n2], [-t2, n2], [t3, n2], [-t3, n2],
            [0, n3], [t1, n3], [-t1, n3], [t2, n3], [-t2, n3],
            [0, n4], [t1, n4], [-t1, n4]
          ];
      let best = null;
      for (const [tangentShift, normalShift] of attempts) {
        const candidate = {
          x: base.x + ux * normalShift + tangentX * tangentShift,
          y: base.y + uy * normalShift + tangentY * tangentShift
        };
        const isInside = pointInProjectedRing(candidate, containerProjected);
        if ((placement === 'inside' && !isInside) || (placement === 'outside' && isInside)) continue;
        const rect = dimensionLabelRect(candidate, angle, label, fontSize);
        const mapPadding = Math.max(1.8, fontSize * 0.72);
        const insideMapBox = !mapBox || (
          rect.x1 >= mapBox.x + mapPadding && rect.x2 <= mapBox.x + mapBox.w - mapPadding
          && rect.y1 >= mapBox.y + mapPadding && rect.y2 <= mapBox.y + mapBox.h - mapPadding
        );
        if (!insideMapBox) continue;
        const collisions = (occupiedLabels || []).reduce((count, other) => count + (rectsOverlap(rect, other) ? 1 : 0), 0);
        const score = (collisions * 1000) + (Math.abs(normalShift) * 5) + Math.abs(tangentShift);
        if (!best || score < best.score) best = { candidate, rect, score };
        if (!collisions) {
          occupiedLabels?.push(rect);
          return candidate;
        }
      }
      const fallback = best || { candidate: base, rect: dimensionLabelRect(base, angle, label, fontSize) };
      occupiedLabels?.push(fallback.rect);
      return fallback.candidate;
    }

    function fittedDimensionFontSize(label, projectedLength, requestedSize, minimumSize) {
      const requested = Math.max(1.6, Number(requestedSize || 3));
      const minimum = Math.min(requested, Math.max(1.55, Number(minimumSize || requested * 0.72)));
      const estimatedWidth = Math.max(requested * 3.05, String(label || '').length * requested * 0.60);
      const available = Math.max(4.2, Number(projectedLength || 0) * 0.82);
      if (estimatedWidth <= available) return requested;
      return Math.max(minimum, requested * (available / estimatedWidth));
    }

    function cadDimensionLabels(coords, project, mapBox, options = {}) {
      const ringCoords = ensureClosedRing(coords);
      const count = Math.max(0, ringCoords.length - 1);
      if (!count) return '';
      const requestedFontSize = Number(options.fontSize || 4.2) * 1.10;
      const minimumFontSize = Number(options.minFontSize || Math.max(1.9, requestedFontSize * 0.74));
      const baseOffset = Number(options.offset || Math.max(6.2, requestedFontSize * 2.05));
      const defaultPlacement = String(options.placement || 'outside').toLowerCase() === 'inside' ? 'inside' : 'outside';
      const containerCoords = ensureClosedRing(options.containerCoords?.length ? options.containerCoords : ringCoords);
      const containerProjected = projectRingPoints(containerCoords, project);
      const occupiedLabels = Array.isArray(options.occupiedLabels) ? options.occupiedLabels : [];
      const visualSettings = options.visualSettings && typeof options.visualSettings === 'object' ? options.visualSettings : {};
      const ownerRaw = String(options.ownerId || 'perimeter').trim() || 'perimeter';
      const elementVisuals = visualSettings.elementVisuals && typeof visualSettings.elementVisuals === 'object' ? visualSettings.elementVisuals : {};
      const dimensionVisual = ownerRaw === 'perimeter' ? elementVisuals.cotas : elementVisuals.glebaCotas;
      const lineColor = String(options.lineColor || dimensionVisual?.color || visualSettings.dimensionColor || '#111827');
      const haloColor = String(options.haloColor || '#ffffff');
      const ownerId = escape(ownerRaw);
      const labelOffsets = visualSettings.dimensionLabelOffsets && typeof visualSettings.dimensionLabelOffsets === 'object' ? visualSettings.dimensionLabelOffsets : {};
      const parts = [];
      const outsideExtraOffsetBase = Number(Object.prototype.hasOwnProperty.call(options, 'outsideExtraOffset') ? options.outsideExtraOffset : 1.45);

      // Cadeia externa contínua para 100% do perímetro. Cada aresta usa a sua
      // própria paralela deslocada, mas o encontro entre arestas vizinhas é um
      // único ponto compartilhado. Em geometrias densas, a antiga estratégia de
      // desligar a cadeia acima de 24 vértices deixava lacunas visíveis entre as
      // cotas. A união agora usa interseção local com limite de miter e fallback
      // bevel (ponto médio), portanto permanece contínua sem gerar espículas.
      const useContinuousOutsideChain = options.lockNormalOffset === true && defaultPlacement === 'outside';
      let continuousOutsideJoints = null;
      if (useContinuousOutsideChain && count >= 2) {
        const projected = ringCoords.slice(0, -1).map((coord) => {
          const [x, y] = project(coord);
          return { x, y };
        });
        const offsetSegments = [];
        for (let i = 0; i < count; i += 1) {
          const p1 = projected[i];
          const p2 = projected[(i + 1) % count];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const requestedOffset = typeof options.offsetResolver === 'function'
            ? options.offsetResolver(ringCoords[i], ringCoords[i + 1], i, baseOffset, 'outside')
            : baseOffset;
          const offset = Math.max(3.8, Number(requestedOffset || baseOffset) + outsideExtraOffsetBase);
          const base = resolveDimensionAnchor(midX, midY, nx, ny, offset, 'outside', containerProjected);
          let normalDistance = ((base.x - midX) * nx) + ((base.y - midY) * ny);
          if (Math.abs(normalDistance) < 3.8) normalDistance = offset;
          offsetSegments.push({
            a: { x: p1.x + nx * normalDistance, y: p1.y + ny * normalDistance },
            b: { x: p2.x + nx * normalDistance, y: p2.y + ny * normalDistance },
            offset: Math.abs(normalDistance)
          });
        }

        const cross = (ax, ay, bx, by) => (ax * by) - (ay * bx);
        continuousOutsideJoints = projected.map((vertex, i) => {
          const prev = offsetSegments[(i - 1 + count) % count];
          const cur = offsetSegments[i];
          const bevel = { x:(prev.b.x + cur.a.x) / 2, y:(prev.b.y + cur.a.y) / 2 };
          const r = { x:prev.b.x - prev.a.x, y:prev.b.y - prev.a.y };
          const s = { x:cur.b.x - cur.a.x, y:cur.b.y - cur.a.y };
          const denominator = cross(r.x, r.y, s.x, s.y);
          const scale = Math.max(1, Math.hypot(r.x, r.y) * Math.hypot(s.x, s.y));
          if (Math.abs(denominator) <= scale * 1e-7) return bevel;

          const qmp = { x:cur.a.x - prev.a.x, y:cur.a.y - prev.a.y };
          const t = cross(qmp.x, qmp.y, s.x, s.y) / denominator;
          const intersection = { x:prev.a.x + r.x * t, y:prev.a.y + r.y * t };
          if (!Number.isFinite(intersection.x) || !Number.isFinite(intersection.y)) return bevel;

          const joinDistance = Math.hypot(intersection.x - vertex.x, intersection.y - vertex.y);
          const maxOffset = Math.max(3.8, Number(prev.offset || 0), Number(cur.offset || 0));
          const miterLimit = (maxOffset * 2.45) + 2.4;
          return joinDistance <= miterLimit ? intersection : bevel;
        });
      }

      for (let index = 0; index < count; index += 1) {
        const a = ringCoords[index];
        const b = ringCoords[index + 1];
        if (typeof options.segmentFilter === 'function' && !options.segmentFilter(a, b, index)) continue;
        const [x1, y1] = project(a);
        const [x2, y2] = project(b);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const nx = -dy / len;
        const ny = dx / len;
        const tx = dx / len;
        const ty = dy / len;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;
        const dist = hav(a, b);
        const label = `${num(dist, 1)} m`;
        const dimensionKey = `${ownerRaw}:${index + 1}`;
        const legacyKey = ownerRaw === 'perimeter' ? String(index + 1) : '';
        const effectiveScale = dimensionScaleForKey(visualSettings, dimensionKey, legacyKey);
        const baseFontSize = fittedDimensionFontSize(label, len, requestedFontSize, minimumFontSize);
        const fontSize = baseFontSize * effectiveScale;
        const storedOffset = labelOffsets[dimensionKey] || (legacyKey ? labelOffsets[legacyKey] : null) || {};
        const manualDx = Number.isFinite(Number(storedOffset.dx)) ? Number(storedOffset.dx) : 0;
        const manualDy = Number.isFinite(Number(storedOffset.dy)) ? Number(storedOffset.dy) : 0;
        const textHalo = effectiveScale > 0 ? Number(options.strokeWidth || Math.max(0.40, Math.min(0.68, baseFontSize * 0.16))) : 0;
        const placementValue = typeof options.placementResolver === 'function'
          ? options.placementResolver(a, b, index, defaultPlacement)
          : defaultPlacement;
        const placement = String(placementValue || defaultPlacement).toLowerCase() === 'inside' ? 'inside' : 'outside';
        const offsetValue = typeof options.offsetResolver === 'function'
          ? options.offsetResolver(a, b, index, baseOffset, placement)
          : baseOffset;
        const effectiveOffset = placement === 'outside'
          ? Number(offsetValue || baseOffset) + outsideExtraOffsetBase
          : Number(offsetValue || baseOffset);
        const offset = Math.max(3.8, effectiveOffset);
        const anchor = chooseCollisionFreeDimensionAnchor({
          midX, midY, dx, dy, len, nx, ny, offset, placement,
          containerProjected, angle, label, fontSize: baseFontSize,
          occupiedLabels,
          mapBox,
          lockNormalOffset: options.lockNormalOffset === true && placement === 'outside'
        });

        // Cota técnica: em vez de texto solto sobre a aresta, desenha a medida
        // completa entre os dois vértices, com linhas auxiliares nas extremidades.
        // O texto pode deslocar-se levemente para evitar colisões, mas a linha de
        // dimensão permanece paralela ao segmento real.
        let normalDistance = ((anchor.x - midX) * nx) + ((anchor.y - midY) * ny);
        if (Math.abs(normalDistance) < 3.8) {
          const side = placement === 'inside' ? -1 : 1;
          normalDistance = side * offset;
        }
        const sideSign = normalDistance < 0 ? -1 : 1;
        const dim1 = continuousOutsideJoints && placement === 'outside'
          ? continuousOutsideJoints[index]
          : { x: x1 + nx * normalDistance, y: y1 + ny * normalDistance };
        const dim2 = continuousOutsideJoints && placement === 'outside'
          ? continuousOutsideJoints[(index + 1) % count]
          : { x: x2 + nx * normalDistance, y: y2 + ny * normalDistance };
        const witnessGap = Math.max(0.9, baseFontSize * 0.26);
        const witnessOver = Math.max(1.15, baseFontSize * 0.38);
        const w1a = { x: x1 + nx * witnessGap * sideSign, y: y1 + ny * witnessGap * sideSign };
        const w2a = { x: x2 + nx * witnessGap * sideSign, y: y2 + ny * witnessGap * sideSign };
        const w1b = { x: dim1.x + nx * witnessOver * sideSign, y: dim1.y + ny * witnessOver * sideSign };
        const w2b = { x: dim2.x + nx * witnessOver * sideSign, y: dim2.y + ny * witnessOver * sideSign };
        const lineWidth = Math.max(0.18, Math.min(0.32, baseFontSize * 0.085));
        const haloWidth = lineWidth + 0.18;
        const tick = Math.max(0.78, Math.min(1.28, baseFontSize * 0.31));
        const tick1a = { x: dim1.x - tx * tick, y: dim1.y - ty * tick };
        const tick1b = { x: dim1.x + tx * tick, y: dim1.y + ty * tick };
        const tick2a = { x: dim2.x - tx * tick, y: dim2.y - ty * tick };
        const tick2b = { x: dim2.x + tx * tick, y: dim2.y + ty * tick };
        const compact = !(options.lockNormalOffset === true && placement === 'outside')
          && (options.compact === true || (typeof options.compactResolver === 'function'
            && Boolean(options.compactResolver(a, b, index, len, baseFontSize))));
        const compactHalf = Math.min(len * 0.34, Math.max(6.5, baseFontSize * 4.2));
        const compactA = { x: anchor.x - tx * compactHalf, y: anchor.y - ty * compactHalf };
        const compactB = { x: anchor.x + tx * compactHalf, y: anchor.y + ty * compactHalf };

        const line = (a1, b1, cls, width, color, opacity = 1) => `<line class="${cls}" data-owner="${ownerId}" x1="${a1.x.toFixed(2)}" y1="${a1.y.toFixed(2)}" x2="${b1.x.toFixed(2)}" y2="${b1.y.toFixed(2)}" stroke="${color}" stroke-width="${width.toFixed(2)}" stroke-linecap="round" opacity="${opacity}"/>`;
        parts.push(`<g class="sv-cad-dimension-group sv-cad-dimension-${placement}${compact ? ' sv-cad-dimension-compact' : ''}" data-segment="${index + 1}" data-owner="${ownerId}">`);
        // O perímetro principal mantém a cota completa entre vértices. Nas glebas,
        // usamos uma cota compacta centrada no trecho para impedir linhas longas
        // atravessando toda a planta quando há geometrias internas complexas.
        if (compact) {
          parts.push(line(compactA, compactB, 'sv-cad-dimension-line', lineWidth, lineColor, 0.82));
        } else {
          // R26.3.66 — cotas externas mais limpas: eliminamos as linhas auxiliares
          // duplicadas nas extremidades, que criavam o efeito de "estrela" em
          // vértices compartilhados. Permanecem apenas a linha de cota fina e os
          // pequenos ticks de término.
          parts.push(line(dim1, dim2, 'sv-cad-dimension-line', lineWidth, lineColor, 0.82));
          parts.push(line(tick1a, tick1b, 'sv-cad-dimension-tick', lineWidth, lineColor, 0.82));
          parts.push(line(tick2a, tick2b, 'sv-cad-dimension-tick', lineWidth, lineColor, 0.82));
        }
        const textAnchor = { x: anchor.x + manualDx, y: anchor.y + manualDy };
        parts.push(`<text class="sv-cad-dimension sv-cad-dimension-${placement}" data-owner="${ownerId}" data-dimension-key="${escape(dimensionKey)}" data-dimension-color="${escape(lineColor)}" data-dimension-base-font-size="${baseFontSize.toFixed(3)}" data-dimension-scale="${effectiveScale.toFixed(3)}" data-offset-dx="${manualDx.toFixed(3)}" data-offset-dy="${manualDy.toFixed(3)}" data-base-x="${anchor.x.toFixed(3)}" data-base-y="${anchor.y.toFixed(3)}" data-base-rotation="${angle.toFixed(3)}" data-role="value" x="${textAnchor.x.toFixed(2)}" y="${textAnchor.y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize.toFixed(2)}" font-weight="700" fill="${lineColor}" stroke="#ffffff" stroke-width="${textHalo.toFixed(2)}" stroke-linejoin="round" paint-order="stroke fill" transform="rotate(${angle.toFixed(2)},${textAnchor.x.toFixed(2)},${textAnchor.y.toFixed(2)})">${escape(label)}</text>`);
        parts.push('</g>');
      }
      return parts.join('');
    }

    return Object.freeze({ resolveGlebaFeatures, glebaFeatureId, glebaFeatureParentId, isNestedGleba, resolveLeafGlebaFeatures, canonicalDimensionSegmentKey, glebaHierarchyDepth, resolveDimensionGlebaFeatures, projectedDimensionSegment, projectedPointLineDistance, projectedSegmentOverlapInfo, dimensionSegmentsForRing, isDescendantGleba, glebaDimensionLabels, ensureClosedRing, projectRingPoints, pointOnProjectedSegment, pointInProjectedRing, resolveDimensionAnchor, dimensionLabelRect, rectsOverlap, chooseCollisionFreeDimensionAnchor, fittedDimensionFontSize, cadDimensionLabels });
  }

  window.SurveyorDocumentDimensions = Object.freeze({ create });
})();
