(() => {
  'use strict';

  function create(deps = {}) {
    const { escape } = deps;
    if (typeof escape !== 'function') throw new Error('Dependências do módulo de confrontantes não foram fornecidas.');
    const pointInProjectedRing = typeof deps.pointInProjectedRing === 'function'
      ? deps.pointInProjectedRing
      : ((point, ring = []) => {
          let inside = false;
          const x = Number(point?.x);
          const y = Number(point?.y);
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Array.isArray(ring) || ring.length < 3) return false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = Number(ring[i]?.x); const yi = Number(ring[i]?.y);
            const xj = Number(ring[j]?.x); const yj = Number(ring[j]?.y);
            if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
            const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
            if (intersect) inside = !inside;
          }
          return inside;
        });

    function normalizeConfrontanteKey(value) {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    }
    function normalizeLabelColor(value, fallback = '#111827') {
      const text = String(value || '').trim();
      return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
    }
    // Branco herdado de layouts anteriores não representa uma escolha individual.
    // Somente um branco explicitamente personalizado deve persistir; outras cores
    // legadas continuam preservadas para evitar alterar rótulos já configurados.
    function resolvedLabelColor(value, customized) {
      const color = normalizeLabelColor(value);
      return color === '#ffffff' && customized !== true ? '#111827' : color;
    }
    function labelHaloColor(value) {
      const color = normalizeLabelColor(value).slice(1);
      const r = parseInt(color.slice(0,2),16), g = parseInt(color.slice(2,4),16), b = parseInt(color.slice(4,6),16);
      const luminance = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
      return luminance >= .62 ? '#111827' : '#ffffff';
    }

    function confrontanteItem(feature, index) {
      const list = Array.isArray(feature?.properties?.confrontantes) ? feature.properties.confrontantes : [];
      return list.find((entry) => Number(entry?.segmentIndex) === Number(index)) || list[index] || {};
    }

    function rangeIndexes(startVertex, endVertex, count) {
      const total = Math.max(0, Number(count) || 0);
      if (total < 2) return [];
      let start = Math.max(1, Math.min(total, Math.round(Number(startVertex) || 1)));
      let end = Math.max(1, Math.min(total, Math.round(Number(endVertex) || ((start % total) + 1))));
      if (start === end) end = (start % total) + 1;
      const forwardSteps = (end - start + total) % total;
      const backwardSteps = (start - end + total) % total;
      const useForward = forwardSteps <= backwardSteps;
      const out = [];
      let vertex = start;
      const steps = useForward ? forwardSteps : backwardSteps;
      for (let i = 0; i < steps; i += 1) {
        if (useForward) {
          out.push((vertex - 1 + total) % total);
          vertex = (vertex % total) + 1;
        } else {
          const previousVertex = ((vertex - 2 + total) % total) + 1;
          out.push(previousVertex - 1);
          vertex = previousVertex;
        }
      }
      return out;
    }

    function normalizeOverrideGroup(entry, count, order, includeVisual = true) {
      if (!entry || entry.hidden === true || String(entry.id || '').trim() === '__linhas-gerais__') return null;
      const label = String(entry.nome || entry.label || entry.tipoLimite || '').trim();
      if (!label) return null;
      const explicitVertices = Array.isArray(entry.vertices)
        ? entry.vertices.map((value) => Math.round(Number(value))).filter((value, index, list) => value >= 1 && value <= count && list.indexOf(value) === index)
        : [];
      const explicitIndexes = Array.isArray(entry.segmentIndexes)
        ? entry.segmentIndexes.map((value) => Math.round(Number(value))).filter((value, index, list) => value >= 0 && value < count && list.indexOf(value) === index)
        : [];
      const startVertex = explicitVertices[0] || Math.max(1, Math.min(count, Math.round(Number(entry.startVertex ?? entry.vertexStart ?? entry.inicio ?? 1) || 1)));
      let endVertex = explicitVertices[explicitVertices.length - 1] || Math.max(1, Math.min(count, Math.round(Number(entry.endVertex ?? entry.vertexEnd ?? entry.fim ?? ((startVertex % count) + 1)) || ((startVertex % count) + 1))));
      let indexes = explicitIndexes.slice();
      if (!indexes.length && explicitVertices.length === 1) indexes = [explicitVertices[0] - 1];
      if (!indexes.length) {
        if (endVertex === startVertex) endVertex = (startVertex % count) + 1;
        indexes = rangeIndexes(startVertex, endVertex, count);
      }
      if (!indexes.length) return null;
      const finiteOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
      const extraLines = includeVisual && Array.isArray(entry.extraLines)
        ? entry.extraLines.map((line, lineOrder) => ({
            id: String(line?.id || `extra-${order + 1}-${lineOrder + 1}`),
            x1: finiteOrNull(line?.x1), y1: finiteOrNull(line?.y1), x2: finiteOrNull(line?.x2), y2: finiteOrNull(line?.y2),
            x1N: finiteOrNull(line?.x1N), y1N: finiteOrNull(line?.y1N), x2N: finiteOrNull(line?.x2N), y2N: finiteOrNull(line?.y2N),
            x1G: finiteOrNull(line?.x1G), y1G: finiteOrNull(line?.y1G), x2G: finiteOrNull(line?.x2G), y2G: finiteOrNull(line?.y2G)
          })).filter((line) => [line.x1,line.y1,line.x2,line.y2].every(Number.isFinite) || [line.x1N,line.y1N,line.x2N,line.y2N].every(Number.isFinite) || [line.x1G,line.y1G,line.x2G,line.y2G].every(Number.isFinite))
        : [];
      return {
        id: String(entry.id || `manual-${order + 1}-${startVertex}-${endVertex}`),
        key: normalizeConfrontanteKey(label),
        coordinateSpace: String(entry.coordinateSpace || '').trim(),
        label,
        propriedade: String(entry.propriedade || entry.propertyName || entry.imovel || '').trim(),
        cpfCnpj: String(entry.cpfCnpj || entry.cpf || entry.cnpj || entry.documento || '').trim(),
        showPropertyInLabel: typeof entry.showPropertyInLabel === 'boolean' ? entry.showPropertyInLabel : Boolean(String(entry.propriedade || entry.propertyName || entry.imovel || '').trim()),
        showCpfCnpjInLabel: entry.showCpfCnpjInLabel === true,
        tipoLimite: String(entry.tipoLimite || entry.limite || '').trim(),
        orientacao: String(entry.orientacao || '').trim(),
        observacao: String(entry.observacao || entry.observacoes || '').trim(),
        indexes,
        start: indexes[0],
        end: indexes[indexes.length - 1],
        startVertex,
        endVertex,
        vertices: explicitVertices,
        segmentIndexes: indexes.slice(),
        freeLine1X1: includeVisual ? finiteOrNull(entry.freeLine1X1) : null,
        freeLine1Y1: includeVisual ? finiteOrNull(entry.freeLine1Y1) : null,
        freeLine1X2: includeVisual ? finiteOrNull(entry.freeLine1X2) : null,
        freeLine1Y2: includeVisual ? finiteOrNull(entry.freeLine1Y2) : null,
        freeLine2X1: includeVisual ? finiteOrNull(entry.freeLine2X1) : null,
        freeLine2Y1: includeVisual ? finiteOrNull(entry.freeLine2Y1) : null,
        freeLine2X2: includeVisual ? finiteOrNull(entry.freeLine2X2) : null,
        freeLine2Y2: includeVisual ? finiteOrNull(entry.freeLine2Y2) : null,
        freeLine1X1N: includeVisual ? finiteOrNull(entry.freeLine1X1N) : null,
        freeLine1Y1N: includeVisual ? finiteOrNull(entry.freeLine1Y1N) : null,
        freeLine1X2N: includeVisual ? finiteOrNull(entry.freeLine1X2N) : null,
        freeLine1Y2N: includeVisual ? finiteOrNull(entry.freeLine1Y2N) : null,
        freeLine2X1N: includeVisual ? finiteOrNull(entry.freeLine2X1N) : null,
        freeLine2Y1N: includeVisual ? finiteOrNull(entry.freeLine2Y1N) : null,
        freeLine2X2N: includeVisual ? finiteOrNull(entry.freeLine2X2N) : null,
        freeLine2Y2N: includeVisual ? finiteOrNull(entry.freeLine2Y2N) : null,
        freeLine1X1G: includeVisual ? finiteOrNull(entry.freeLine1X1G) : null,
        freeLine1Y1G: includeVisual ? finiteOrNull(entry.freeLine1Y1G) : null,
        freeLine1X2G: includeVisual ? finiteOrNull(entry.freeLine1X2G) : null,
        freeLine1Y2G: includeVisual ? finiteOrNull(entry.freeLine1Y2G) : null,
        freeLine2X1G: includeVisual ? finiteOrNull(entry.freeLine2X1G) : null,
        freeLine2Y1G: includeVisual ? finiteOrNull(entry.freeLine2Y1G) : null,
        freeLine2X2G: includeVisual ? finiteOrNull(entry.freeLine2X2G) : null,
        freeLine2Y2G: includeVisual ? finiteOrNull(entry.freeLine2Y2G) : null,
        labelScale: includeVisual && Number.isFinite(Number(entry.labelScale)) ? Math.max(.20, Math.min(4, Number(entry.labelScale))) : 1,
        labelDx: includeVisual ? finiteOrNull(entry.labelDx) : null,
        labelDy: includeVisual ? finiteOrNull(entry.labelDy) : null,
        labelDxN: includeVisual ? finiteOrNull(entry.labelDxN) : null,
        labelDyN: includeVisual ? finiteOrNull(entry.labelDyN) : null,
        labelDxG: includeVisual ? finiteOrNull(entry.labelDxG) : null,
        labelDyG: includeVisual ? finiteOrNull(entry.labelDyG) : null,
        labelXG: includeVisual ? finiteOrNull(entry.labelXG) : null,
        labelYG: includeVisual ? finiteOrNull(entry.labelYG) : null,
        labelRotation: includeVisual && Number.isFinite(Number(entry.labelRotation)) ? Number(entry.labelRotation) : null,
        labelColor: resolvedLabelColor(entry.labelColor, entry.labelColorCustomized),
        labelColorCustomized: entry.labelColorCustomized === true,
        manualLinesOnly: Boolean(entry.manualLinesOnly || extraLines.length),
        extraLines,
        visual: includeVisual,
        manual: true
      };
    }

    function buildConfrontanteGroups(feature, coords, overrides = []) {
      const count = Math.max(0, (coords || []).length - 1);
      if (!count) return [];
      const visualLayout = feature?.properties?.confrontanteVisualLayout || null;
      // V55 WYSIWYG: overrides vindos do editor já estão normalizados em relação
      // ao quadro do mapa. Eles são a fonte imediata após Salvar alterações e
      // evitam qualquer retorno para coordenadas absolutas temporárias.
      if (Array.isArray(overrides) && overrides.length) {
        return overrides.map((entry, order) => normalizeOverrideGroup(entry, count, order, true)).filter(Boolean);
      }
      const visualSegments = Number(visualLayout?.version || 0) >= 3 && Array.isArray(visualLayout?.segments)
        ? visualLayout.segments : [];
      if (visualSegments.length) {
        const savedVisual = visualSegments.map((entry, order) => normalizeOverrideGroup(entry, count, order, true)).filter(Boolean);
        if (savedVisual.length) return savedVisual;
      }
      const projectTrechos = Array.isArray(feature?.properties?.confrontanteTrechos) ? feature.properties.confrontanteTrechos : [];
      if (projectTrechos.length) {
        const savedGroups = projectTrechos.map((entry, order) => normalizeOverrideGroup(entry, count, order, false)).filter(Boolean);
        if (savedGroups.length) return savedGroups;
      }
      const groups = [];
      let current = null;
      for (let index = 0; index < count; index += 1) {
        const item = confrontanteItem(feature, index);
        const label = String(item?.nome || item?.tipoLimite || '').trim();
        const key = normalizeConfrontanteKey(label);
        if (!key) { current = null; continue; }
        if (current && current.key === key && current.indexes[current.indexes.length - 1] === index - 1) {
          current.indexes.push(index);
          current.end = index;
          current.endVertex = ((index + 1) % count) + 1;
        } else {
          current = {
            id: `auto-${groups.length + 1}-${index + 1}`,
            key,
            label,
            propriedade: String(item?.propriedade || item?.propertyName || item?.imovel || '').trim(),
            cpfCnpj: String(item?.cpfCnpj || item?.cpf || item?.cnpj || item?.documento || '').trim(),
            showPropertyInLabel: typeof item?.showPropertyInLabel === 'boolean' ? item.showPropertyInLabel : Boolean(String(item?.propriedade || item?.propertyName || item?.imovel || '').trim()),
            showCpfCnpjInLabel: item?.showCpfCnpjInLabel === true,
            tipoLimite: String(item?.tipoLimite || item?.limite || '').trim(),
            orientacao: String(item?.orientacao || '').trim(),
            observacao: String(item?.observacao || item?.observacoes || '').trim(),
            indexes: [index],
            start: index,
            end: index,
            startVertex: index + 1,
            endVertex: ((index + 1) % count) + 1,
            labelScale: 1,
            labelColor: resolvedLabelColor(item?.labelColor, item?.labelColorCustomized),
            labelColorCustomized: item?.labelColorCustomized === true,
            extraLines: [],
            manual: false
          };
          groups.push(current);
        }
      }
      if (groups.length > 1) {
        const first = groups[0];
        const last = groups[groups.length - 1];
        if (first.key && first.key === last.key && first.indexes[0] === 0 && last.indexes[last.indexes.length - 1] === count - 1) {
          first.indexes = [...last.indexes, ...first.indexes];
          first.start = last.start;
          first.startVertex = last.startVertex;
          first.end = first.indexes[first.indexes.length - 1];
          first.endVertex = ((first.end + 1) % count) + 1;
          first.id = `auto-wrap-${first.startVertex}-${first.endVertex}-${first.key}`;
          if (!first.propriedade) first.propriedade = last.propriedade;
          if (!first.cpfCnpj) first.cpfCnpj = last.cpfCnpj;
          if (typeof first.showPropertyInLabel !== 'boolean') first.showPropertyInLabel = last.showPropertyInLabel;
          if (first.showCpfCnpjInLabel !== true) first.showCpfCnpjInLabel = last.showCpfCnpjInLabel === true;
          if (!first.tipoLimite) first.tipoLimite = last.tipoLimite;
          if (!first.orientacao) first.orientacao = last.orientacao;
          if (!first.observacao) first.observacao = last.observacao;
          groups.pop();
        }
      }
      return groups;
    }

    function buildConfrontanteColorMaps(feature, coords) {
      const count = Math.max(0, (coords || []).length - 1);
      const groups = buildConfrontanteGroups(feature, coords);
      const groupKeyToColor = {};
      const segmentIndexToColor = {};
      const vertexIndexToColor = {};
      // R58: o perímetro passa a ter cor técnica única. O mapa continua preservando
      // a associação confrontante/trecho internamente, mas não pinta cada trecho
      // de uma cor diferente.
      const technicalColor = '#f2c313';
      groups.forEach((group) => {
        groupKeyToColor[group.key] = technicalColor;
        const indexes = Array.isArray(group.indexes) && group.indexes.length
          ? group.indexes
          : (() => {
              const out = [];
              if (group.start <= group.end) for (let i = group.start; i <= group.end; i += 1) out.push(i);
              else {
                for (let i = group.start; i < count; i += 1) out.push(i);
                for (let i = 0; i <= group.end; i += 1) out.push(i);
              }
              return out;
            })();
        indexes.forEach((i) => {
          segmentIndexToColor[i] = technicalColor;
          if (!Object.prototype.hasOwnProperty.call(vertexIndexToColor, i)) vertexIndexToColor[i] = '#111827';
          const next = (i + 1) % count;
          if (!Object.prototype.hasOwnProperty.call(vertexIndexToColor, next)) vertexIndexToColor[next] = '#111827';
        });
      });
      return { groups, groupKeyToColor, segmentIndexToColor, vertexIndexToColor };
    }

    function svgStyledPerimeter(feature, coords, project, colorMaps = {}, options = {}) {
      const ringCoords = (coords || []).slice();
      if (!ringCoords.length) return '';
      const polygonPoints = ringCoords.map((coord) => { const [x, y] = project(coord); return `${x},${y}`; }).join(' ');
      const fillColor = options.fillColor || '#f3c410';
      const fillOpacity = Number(options.fillOpacity ?? 0.16);
      const defaultStroke = options.defaultStroke || '#f2c313';
      const strokeWidth = Number(options.strokeWidth || 1.55);
      const haloWidth = Math.max(strokeWidth + 0.32, strokeWidth * 1.16);
      // R26.3.64 — perímetro contínuo: a borda passa a ser desenhada como um
      // único contorno técnico, com junções arredondadas. Isso elimina o aspecto
      // de "linha quebrada" que surgia quando cada segmento era renderizado de
      // forma separada e ainda recebia um halo branco individual.
      const polygonKey = String(options.polygonKey || 'perimetro-principal');
      const polygonName = String(options.polygonName || 'Perímetro do imóvel');
      const polygonCategory = String(options.polygonCategory || 'perimetro');
      const data = `data-polygon-key="${escape(polygonKey)}" data-polygon-name="${escape(polygonName)}" data-polygon-category="${escape(polygonCategory)}" data-polygon-color="${escape(defaultStroke)}"`;
      return [
        `<polygon class="sv-document-perimeter-fill sv-document-editable-polygon" ${data} points="${polygonPoints}" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="none"/>`,
        `<polygon class="sv-document-polygon-halo" data-polygon-key="${escape(polygonKey)}" points="${polygonPoints}" fill="none" stroke="#1f2937" stroke-width="${haloWidth.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.18"/>`,
        `<polygon class="sv-document-polygon-outline" data-polygon-key="${escape(polygonKey)}" points="${polygonPoints}" fill="none" stroke="${defaultStroke}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`
      ].join('');
    }

    function svgLabelWithBackground(x, y, text, opts = {}) {
      const label = String(text || '');
      const fontSize = Number(opts.fontSize || 6);
      const paddingX = Number(opts.paddingX || 2.6);
      const paddingY = Number(opts.paddingY || 1.3);
      const textColor = opts.textColor || '#111827';
      const bgFill = opts.bgFill || '#ffffff';
      const bgOpacity = Number(opts.bgOpacity ?? 0.95);
      const radius = Number(opts.radius || 2.2);
      const weight = Number(opts.fontWeight || 650);
      const anchor = opts.anchor === 'middle' ? 'middle' : 'start';
      const estimatedWidth = Math.max(fontSize + (label.length * fontSize * 0.62), fontSize * 1.75);
      const rectX = anchor === 'middle' ? (x - (estimatedWidth / 2) - paddingX) : (x - paddingX);
      const rectY = y - fontSize + 0.8 - paddingY;
      const rectW = estimatedWidth + paddingX * 2;
      const rectH = fontSize + paddingY * 2.1;
      const textX = anchor === 'middle' ? x : x;
      return `<g class="sv-inline-label"><rect x="${rectX.toFixed(2)}" y="${rectY.toFixed(2)}" width="${rectW.toFixed(2)}" height="${rectH.toFixed(2)}" rx="${radius}" ry="${radius}" fill="${bgFill}" fill-opacity="${bgOpacity}"/><text x="${textX}" y="${y}" ${anchor === 'middle' ? 'text-anchor="middle" ' : ''}font-size="${fontSize}" font-weight="${weight}" fill="${textColor}">${escape(displayLabel)}</text></g>`;
    }

    function freeConfrontanteLabels(feature, project, mapBox, options = {}) {
      const list = Array.isArray(feature?.properties?.confrontanteChamadas) ? feature.properties.confrontanteChamadas : [];
      if (!list.length || typeof project !== 'function') return { html:'', keys:new Set() };
      const baseFont = Number(options.fontSize || 7.2);
      const manualOffsets = options.manualOffsets && typeof options.manualOffsets === 'object' ? options.manualOffsets : {};
      const parts = [];
      const keys = new Set();
      const finite = (...values) => values.every((value) => Number.isFinite(Number(value)));
      list.forEach((entry, order) => {
        const label = String(entry?.nome || entry?.name || 'Confrontante').trim() || 'Confrontante';
        if (!finite(entry?.line1StartLat, entry?.line1StartLng, entry?.line1EndLat, entry?.line1EndLng,
          entry?.line2StartLat, entry?.line2StartLng, entry?.line2EndLat, entry?.line2EndLng)) return;
        const p1 = project([Number(entry.line1StartLng), Number(entry.line1StartLat)]);
        const p2 = project([Number(entry.line1EndLng), Number(entry.line1EndLat)]);
        const p3 = project([Number(entry.line2StartLng), Number(entry.line2StartLat)]);
        const p4 = project([Number(entry.line2EndLng), Number(entry.line2EndLat)]);
        if (![p1,p2,p3,p4].every((p) => Array.isArray(p) && finite(p[0],p[1]))) return;
        let labelPoint = finite(entry?.labelLat, entry?.labelLng)
          ? project([Number(entry.labelLng), Number(entry.labelLat)])
          : [ (Number(p2[0])+Number(p4[0]))/2, (Number(p2[1])+Number(p4[1]))/2 ];
        if (!Array.isArray(labelPoint) || !finite(labelPoint[0],labelPoint[1])) labelPoint = [ (Number(p2[0])+Number(p4[0]))/2, (Number(p2[1])+Number(p4[1]))/2 ];
        const guidePoints = [p1,p2,p3,p4];
        const geomMinX = Math.min(...guidePoints.map((point) => Number(point[0])));
        const geomMaxX = Math.max(...guidePoints.map((point) => Number(point[0])));
        const geomMinY = Math.min(...guidePoints.map((point) => Number(point[1])));
        const geomMaxY = Math.max(...guidePoints.map((point) => Number(point[1])));
        const geomW = Math.max(1, geomMaxX - geomMinX);
        const geomH = Math.max(1, geomMaxY - geomMinY);
        const id = String(entry?.id || `free-callout-${order + 1}`);
        const key = `free::${id}`;
        const saved = manualOffsets[key] || {};
        const scale = Math.max(.20, Math.min(4, Number(saved.scale ?? entry?.labelScale ?? 1) || 1));
        const dx = Number.isFinite(Number(saved.dx)) ? Number(saved.dx) : 0;
        const dy = Number.isFinite(Number(saved.dy)) ? Number(saved.dy) : 0;
        const fontSize = baseFont * scale;
        const labelColor = normalizeLabelColor(entry?.labelColor);
        const labelHalo = labelHaloColor(labelColor);
        const estimatedW = Math.max(46, Math.min(300, label.length * fontSize * .58 + 16));
        const estimatedH = Math.max(18, fontSize * 1.8);
        const lx = Number(labelPoint[0]), ly = Number(labelPoint[1]);
        const x1 = lx - estimatedW/2, y1 = ly - estimatedH/2, x2 = lx + estimatedW/2, y2 = ly + estimatedH/2;
        keys.add(normalizeConfrontanteKey(label));
        parts.push(`<g class="sv-confrontante-callout sv-confrontante-free-guide" data-free-guide="1" data-label-key="${escape(key)}" data-segment-id="${escape(id)}" data-confrontante-name="${escape(label)}" data-label-color="${escape(labelColor)}" data-label-color-customized="${entry?.labelColorCustomized === true ? '1' : '0'}" data-label-scale="${scale.toFixed(3)}" data-dx="${effectiveDx.toFixed(2)}" data-dy="${effectiveDy.toFixed(2)}" data-base-x1="${x1.toFixed(2)}" data-base-y1="${y1.toFixed(2)}" data-base-x2="${x2.toFixed(2)}" data-base-y2="${y2.toFixed(2)}" data-map-x="${mapBox.x}" data-map-y="${mapBox.y}" data-map-w="${mapBox.w}" data-map-h="${mapBox.h}" data-geom-x="${geomMinX.toFixed(2)}" data-geom-y="${geomMinY.toFixed(2)}" data-geom-w="${geomW.toFixed(2)}" data-geom-h="${geomH.toFixed(2)}" data-free-line1-x1="${Number(p1[0]).toFixed(2)}" data-free-line1-y1="${Number(p1[1]).toFixed(2)}" data-free-line1-x2="${Number(p2[0]).toFixed(2)}" data-free-line1-y2="${Number(p2[1]).toFixed(2)}" data-free-line2-x1="${Number(p3[0]).toFixed(2)}" data-free-line2-y1="${Number(p3[1]).toFixed(2)}" data-free-line2-x2="${Number(p4[0]).toFixed(2)}" data-free-line2-y2="${Number(p4[1]).toFixed(2)}">`);
        parts.push(`<line class="sv-confrontante-guide-extension" x1="${Number(p1[0]).toFixed(2)}" y1="${Number(p1[1]).toFixed(2)}" x2="${Number(p2[0]).toFixed(2)}" y2="${Number(p2[1]).toFixed(2)}" stroke="#111827" stroke-width="1.35" stroke-linecap="round" stroke-dasharray="6 4"/>`);
        parts.push(`<line class="sv-confrontante-guide-extension" x1="${Number(p3[0]).toFixed(2)}" y1="${Number(p3[1]).toFixed(2)}" x2="${Number(p4[0]).toFixed(2)}" y2="${Number(p4[1]).toFixed(2)}" stroke="#111827" stroke-width="1.35" stroke-linecap="round" stroke-dasharray="6 4"/>`);
        parts.push(`<g class="sv-confrontante-label" transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})"><rect class="sv-confrontante-hitbox" x="${x1.toFixed(2)}" y="${y1.toFixed(2)}" width="${estimatedW.toFixed(2)}" height="${estimatedH.toFixed(2)}" rx="3" ry="3" fill="none" stroke="none" pointer-events="all"/><text class="sv-confrontante-name-text" x="${lx.toFixed(2)}" y="${(ly + fontSize*.34).toFixed(2)}" text-anchor="middle" font-size="${fontSize.toFixed(2)}" font-weight="750" fill="${labelColor}" paint-order="stroke fill" stroke="${labelHalo}" stroke-width="${Math.max(.9,fontSize*.16).toFixed(2)}" stroke-linejoin="round">${escape(label)}</text></g></g>`);
      });
      return { html:parts.join(''), keys };
    }

    function boundaryConfrontanteLabels(groups, projected, mapBox, project, options = {}) {
      const count = projected.length;
      if (!count) return '';
      const fontSize = Number(options.fontSize || 7.2);
      const manualOffsets = options.manualOffsets && typeof options.manualOffsets === 'object' ? options.manualOffsets : {};
      const cx = projected.reduce((sum, point) => sum + point.x, 0) / count;
      const cy = projected.reduce((sum, point) => sum + point.y, 0) / count;
      const parts = [];
      const mapPad = Number(options.edgePadding || 7);
      const mapMinX = mapBox.x + mapPad;
      const mapMaxX = mapBox.x + mapBox.w - mapPad;
      const mapMinY = mapBox.y + mapPad;
      const mapMaxY = mapBox.y + mapBox.h - mapPad;
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const finite = (...values) => values.every((value) => Number.isFinite(Number(value)));
      const normPoint = (xN, yN) => ({ x: mapBox.x + Number(xN) * mapBox.w, y: mapBox.y + Number(yN) * mapBox.h });
      const geomMinX = Math.min(...projected.map((point) => Number(point.x)));
      const geomMaxX = Math.max(...projected.map((point) => Number(point.x)));
      const geomMinY = Math.min(...projected.map((point) => Number(point.y)));
      const geomMaxY = Math.max(...projected.map((point) => Number(point.y)));
      const geomW = Math.max(1, geomMaxX - geomMinX);
      const geomH = Math.max(1, geomMaxY - geomMinY);
      const geomPoint = (xG, yG) => ({ x: geomMinX + Number(xG) * geomW, y: geomMinY + Number(yG) * geomH });
      const normalizeAngle = (angle) => {
        let next = Number(angle) || 0;
        while (next > 180) next -= 360;
        while (next < -180) next += 360;
        return next;
      };
      const outwardNormal = (a, b) => {
        if (!a || !b) return { x: 0, y: -1 };
        const dx = Number(b.x) - Number(a.x);
        const dy = Number(b.y) - Number(a.y);
        const len = Math.max(1, Math.hypot(dx, dy));
        const n1 = { x: -dy / len, y: dx / len };
        const n2 = { x: dy / len, y: -dx / len };
        const mid = { x: (Number(a.x) + Number(b.x)) / 2, y: (Number(a.y) + Number(b.y)) / 2 };
        const score = (n) => Math.hypot(mid.x + n.x * 16 - cx, mid.y + n.y * 16 - cy);
        return score(n1) >= score(n2) ? n1 : n2;
      };
      const clampPoint = (point) => ({
        x: clamp(Number(point.x), mapMinX + 2, mapMaxX - 2),
        y: clamp(Number(point.y), mapMinY + 2, mapMaxY - 2)
      });

      groups.forEach((group, groupOrder) => {
        const indexes = Array.isArray(group.indexes) && group.indexes.length ? group.indexes : [group.start];
        if (!indexes.length) return;
        const selectedVertices = Array.isArray(group.vertices) ? group.vertices.map(Number).filter(Number.isFinite) : [];
        const startPoint = selectedVertices.length ? projected[(selectedVertices[0] - 1 + count) % count] : projected[indexes[0]];
        const endPoint = selectedVertices.length ? projected[(selectedVertices[selectedVertices.length - 1] - 1 + count) % count] : projected[(indexes[indexes.length - 1] + 1) % count];
        if (!startPoint || !endPoint) return;
        const label = String(group.label || group.tipoLimite || 'Confrontante').trim();
        const propertyName = String(group.propriedade || '').trim();
        const cpfDisplay = window.SurveyorTechnicalMapBridge?.cpfCnpjDisplay?.(group.cpfCnpj) || { value:String(group.cpfCnpj || '').trim(), label:'' };
        const cpfCnpj = cpfDisplay.value;
        const showProperty = typeof group.showPropertyInLabel === 'boolean' ? group.showPropertyInLabel : Boolean(propertyName);
        const showCpf = group.showCpfCnpjInLabel === true && Boolean(cpfCnpj);
        const displayLabel = showProperty && propertyName ? `${label} — ${propertyName}` : label;
        const cpfLine = showCpf ? (cpfDisplay.label || `CPF/CNPJ: ${cpfCnpj}`) : '';
        const labelColor = normalizeLabelColor(group.labelColor);
        const labelHalo = labelHaloColor(labelColor);
        const startVertex = Number(group.startVertex || (indexes[0] + 1));
        const endVertex = Number(group.endVertex || (((indexes[indexes.length - 1] + 1) % count) + 1));
        const segmentId = String(group.id || `segment-${groupOrder + 1}-${startVertex}-${endVertex}`);
        const labelKey = group.manual ? `manual::${segmentId}` : `${group.key || 'confrontante'}::${group.start}-${group.end}::${groupOrder}`;
        const saved = manualOffsets[labelKey] || {};
        const labelScale = Math.max(.20, Math.min(4, Number(saved.scale ?? group.labelScale ?? 1) || 1));
        const geometrySpace = group.coordinateSpace === 'geometry-v1';
        const visualDx = geometrySpace && Number.isFinite(Number(group.labelDxG)) ? Number(group.labelDxG) * geomW : (Number.isFinite(Number(group.labelDxN)) ? Number(group.labelDxN) * mapBox.w : (Number.isFinite(Number(group.labelDxG)) ? Number(group.labelDxG) * geomW : Number(group.labelDx)));
        const visualDy = geometrySpace && Number.isFinite(Number(group.labelDyG)) ? Number(group.labelDyG) * geomH : (Number.isFinite(Number(group.labelDyN)) ? Number(group.labelDyN) * mapBox.h : (Number.isFinite(Number(group.labelDyG)) ? Number(group.labelDyG) * geomH : Number(group.labelDy)));
        const dx = Number.isFinite(Number(saved.dx)) ? Number(saved.dx) : (Number.isFinite(visualDx) ? visualDx : 0);
        const dy = Number.isFinite(Number(saved.dy)) ? Number(saved.dy) : (Number.isFinite(visualDy) ? visualDy : 0);
        const rotation = normalizeAngle(Number.isFinite(Number(saved.rotation)) ? Number(saved.rotation) : (Number.isFinite(Number(group.labelRotation)) ? Number(group.labelRotation) : 0));

        const firstEdgeEnd = projected[(indexes[0] + 1) % count] || endPoint;
        const lastEdgeStart = selectedVertices.length === 1
          ? (projected[(indexes[0] - 1 + count) % count] || startPoint)
          : (projected[indexes[indexes.length - 1]] || startPoint);
        const startNormal = outwardNormal(startPoint, firstEdgeEnd);
        const endNormal = selectedVertices.length === 1
          ? outwardNormal(lastEdgeStart, endPoint)
          : outwardNormal(lastEdgeStart, endPoint);
        const autoLength = Math.max(26, Math.min(76, 28 + fontSize * labelScale * 1.8 + Math.min(18, label.length * .24)));
        const autoStartTip = clampPoint({ x:startPoint.x + startNormal.x * autoLength, y:startPoint.y + startNormal.y * autoLength });
        const autoEndTip = clampPoint({ x:endPoint.x + endNormal.x * autoLength, y:endPoint.y + endNormal.y * autoLength });

        const hasLine1Geom = finite(group.freeLine1X1G,group.freeLine1Y1G,group.freeLine1X2G,group.freeLine1Y2G);
        const hasLine1Norm = finite(group.freeLine1X1N,group.freeLine1Y1N,group.freeLine1X2N,group.freeLine1Y2N);
        const hasLine1Abs = finite(group.freeLine1X1,group.freeLine1Y1,group.freeLine1X2,group.freeLine1Y2);
        const hasLine2Geom = finite(group.freeLine2X1G,group.freeLine2Y1G,group.freeLine2X2G,group.freeLine2Y2G);
        const hasLine2Norm = finite(group.freeLine2X1N,group.freeLine2Y1N,group.freeLine2X2N,group.freeLine2Y2N);
        const hasLine2Abs = finite(group.freeLine2X1,group.freeLine2Y1,group.freeLine2X2,group.freeLine2Y2);
        const line1Manual = hasLine1Geom || hasLine1Norm || hasLine1Abs;
        const line2Manual = hasLine2Geom || hasLine2Norm || hasLine2Abs;
        const line1 = geometrySpace && hasLine1Geom
          ? { a:geomPoint(group.freeLine1X1G,group.freeLine1Y1G), b:geomPoint(group.freeLine1X2G,group.freeLine1Y2G) }
          : hasLine1Norm
            ? { a:normPoint(group.freeLine1X1N,group.freeLine1Y1N), b:normPoint(group.freeLine1X2N,group.freeLine1Y2N) }
            : hasLine1Geom
              ? { a:geomPoint(group.freeLine1X1G,group.freeLine1Y1G), b:geomPoint(group.freeLine1X2G,group.freeLine1Y2G) }
              : hasLine1Abs
                ? { a:{x:Number(group.freeLine1X1),y:Number(group.freeLine1Y1)}, b:{x:Number(group.freeLine1X2),y:Number(group.freeLine1Y2)} }
                : { a:{x:startPoint.x,y:startPoint.y}, b:autoStartTip };
        const line2 = geometrySpace && hasLine2Geom
          ? { a:geomPoint(group.freeLine2X1G,group.freeLine2Y1G), b:geomPoint(group.freeLine2X2G,group.freeLine2Y2G) }
          : hasLine2Norm
            ? { a:normPoint(group.freeLine2X1N,group.freeLine2Y1N), b:normPoint(group.freeLine2X2N,group.freeLine2Y2N) }
            : hasLine2Geom
              ? { a:geomPoint(group.freeLine2X1G,group.freeLine2Y1G), b:geomPoint(group.freeLine2X2G,group.freeLine2Y2G) }
              : hasLine2Abs
                ? { a:{x:Number(group.freeLine2X1),y:Number(group.freeLine2Y1)}, b:{x:Number(group.freeLine2X2),y:Number(group.freeLine2Y2)} }
                : { a:{x:endPoint.x,y:endPoint.y}, b:autoEndTip };

        const labelTips = [line1?.b, line2?.b].filter((point, index) => point && (index === 0 ? line1Manual || !line2Manual : line2Manual || !line1Manual));
        const automaticLabelCenter = labelTips.length
          ? { x:labelTips.reduce((sum, point) => sum + Number(point.x || 0), 0) / labelTips.length, y:labelTips.reduce((sum, point) => sum + Number(point.y || 0), 0) / labelTips.length }
          : { x:(line1.b.x + line2.b.x) / 2, y:(line1.b.y + line2.b.y) / 2 };
        const persistedLabelCenter = geometrySpace && group.labelXG != null && group.labelYG != null && Number.isFinite(Number(group.labelXG)) && Number.isFinite(Number(group.labelYG))
          ? geomPoint(group.labelXG,group.labelYG) : null;
        const labelCenter = persistedLabelCenter || automaticLabelCenter;
        const effectiveDx = persistedLabelCenter ? 0 : dx;
        const effectiveDy = persistedLabelCenter ? 0 : dy;
        const estimatedW = Math.max(46, Math.min(390, Math.max(displayLabel.length, cpfLine.length * .82) * fontSize * .58 + 18));
        const estimatedH = Math.max(18, showCpf ? fontSize * 3.15 : fontSize * 1.9);
        const boxX1 = labelCenter.x - estimatedW / 2;
        const boxY1 = labelCenter.y - estimatedH / 2;
        const boxX2 = labelCenter.x + estimatedW / 2;
        const boxY2 = labelCenter.y + estimatedH / 2;
        const hasExtraLines = Array.isArray(group.extraLines) && group.extraLines.length > 0;
        const customLinesOnly = Boolean(group.manualLinesOnly && hasExtraLines);
        const modeClass = (line1Manual || line2Manual || hasExtraLines || group.visual) ? 'sv-confrontante-manual-guide' : 'sv-confrontante-auto-guide';
        parts.push(`<g class="sv-confrontante-callout sv-confrontante-range ${modeClass}" data-label-key="${escape(labelKey)}" data-segment-id="${escape(segmentId)}" data-confrontante-name="${escape(label)}" data-confrontante-property="${escape(propertyName)}" data-show-property-in-label="${showProperty ? '1' : '0'}" data-label-color="${escape(labelColor)}" data-label-color-customized="${group?.labelColorCustomized === true ? '1' : '0'}" data-cpf-cnpj="${escape(cpfCnpj)}" data-show-cpf-cnpj-in-label="${group.showCpfCnpjInLabel === true ? '1' : '0'}" data-tipo-limite="${escape(group.tipoLimite || '')}" data-orientacao="${escape(group.orientacao || '')}" data-observacao="${escape(group.observacao || '')}" data-start-vertex="${startVertex}" data-end-vertex="${endVertex}" data-selected-vertices="${escape((Array.isArray(group.vertices)?group.vertices:[]).join(','))}" data-segment-indexes="${escape((Array.isArray(group.segmentIndexes)?group.segmentIndexes:indexes).join(','))}" data-vertex-count="${count}" data-label-scale="${labelScale.toFixed(3)}" data-label-rotation="${rotation.toFixed(2)}" data-dx="${effectiveDx.toFixed(2)}" data-dy="${effectiveDy.toFixed(2)}" data-base-x1="${boxX1.toFixed(2)}" data-base-y1="${boxY1.toFixed(2)}" data-base-x2="${boxX2.toFixed(2)}" data-base-y2="${boxY2.toFixed(2)}" data-map-x="${mapBox.x}" data-map-y="${mapBox.y}" data-map-w="${mapBox.w}" data-map-h="${mapBox.h}" data-geom-x="${geomMinX.toFixed(2)}" data-geom-y="${geomMinY.toFixed(2)}" data-geom-w="${geomW.toFixed(2)}" data-geom-h="${geomH.toFixed(2)}" data-free-line1-x1="${line1.a.x.toFixed(2)}" data-free-line1-y1="${line1.a.y.toFixed(2)}" data-free-line1-x2="${line1.b.x.toFixed(2)}" data-free-line1-y2="${line1.b.y.toFixed(2)}" data-free-line2-x1="${line2.a.x.toFixed(2)}" data-free-line2-y1="${line2.a.y.toFixed(2)}" data-free-line2-x2="${line2.b.x.toFixed(2)}" data-free-line2-y2="${line2.b.y.toFixed(2)}" data-manual-lines-only="${customLinesOnly ? '1' : '0'}">`);
        if (!customLinesOnly && (line1Manual || !line2Manual)) parts.push(`<line class="sv-confrontante-guide-extension" data-guide-line="1" x1="${line1.a.x.toFixed(2)}" y1="${line1.a.y.toFixed(2)}" x2="${line1.b.x.toFixed(2)}" y2="${line1.b.y.toFixed(2)}" stroke="#111827" stroke-width="1.35" stroke-linecap="round" stroke-dasharray="6 4"/>`);
        if (!customLinesOnly && (line2Manual || !line1Manual)) parts.push(`<line class="sv-confrontante-guide-extension" data-guide-line="2" x1="${line2.a.x.toFixed(2)}" y1="${line2.a.y.toFixed(2)}" x2="${line2.b.x.toFixed(2)}" y2="${line2.b.y.toFixed(2)}" stroke="#111827" stroke-width="1.35" stroke-linecap="round" stroke-dasharray="6 4"/>`);
        (Array.isArray(group.extraLines) ? group.extraLines : []).forEach((extra, extraOrder) => {
          const hasGeom = finite(extra.x1G,extra.y1G,extra.x2G,extra.y2G);
          const hasNorm = finite(extra.x1N,extra.y1N,extra.x2N,extra.y2N);
          const hasAbs = finite(extra.x1,extra.y1,extra.x2,extra.y2);
          if (!hasGeom && !hasNorm && !hasAbs) return;
          const a = geometrySpace && hasGeom ? geomPoint(extra.x1G,extra.y1G) : (hasNorm ? normPoint(extra.x1N,extra.y1N) : (hasGeom ? geomPoint(extra.x1G,extra.y1G) : {x:Number(extra.x1),y:Number(extra.y1)}));
          const b = geometrySpace && hasGeom ? geomPoint(extra.x2G,extra.y2G) : (hasNorm ? normPoint(extra.x2N,extra.y2N) : (hasGeom ? geomPoint(extra.x2G,extra.y2G) : {x:Number(extra.x2),y:Number(extra.y2)}));
          const extraId = String(extra.id || `extra-${extraOrder + 1}`);
          parts.push(`<line class="sv-confrontante-extra-line" data-extra-id="${escape(extraId)}" x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="#111827" stroke-width="1.35" stroke-linecap="round" stroke-dasharray="6 4"/>`);
        });
        parts.push(`<g class="sv-confrontante-label" transform="translate(${effectiveDx.toFixed(2)} ${effectiveDy.toFixed(2)}) translate(${labelCenter.x.toFixed(2)} ${labelCenter.y.toFixed(2)}) scale(${labelScale.toFixed(3)}) translate(${(-labelCenter.x).toFixed(2)} ${(-labelCenter.y).toFixed(2)})">`);
        parts.push(`<g class="sv-confrontante-label-rotator" transform="rotate(${rotation.toFixed(2)} ${labelCenter.x.toFixed(2)} ${labelCenter.y.toFixed(2)})">`);
        parts.push(`<rect class="sv-confrontante-hitbox" x="${boxX1.toFixed(2)}" y="${boxY1.toFixed(2)}" width="${estimatedW.toFixed(2)}" height="${estimatedH.toFixed(2)}" rx="3" ry="3" fill="none" stroke="none" pointer-events="all"/>`);
        parts.push(`<text class="sv-confrontante-name-text" x="${labelCenter.x.toFixed(2)}" y="${(labelCenter.y + (showCpf ? -fontSize*.08 : fontSize*.34)).toFixed(2)}" text-anchor="middle" font-size="${fontSize.toFixed(2)}" font-weight="750" fill="${labelColor}" paint-order="stroke fill" stroke="${labelHalo}" stroke-width="${Math.max(.9, fontSize * .16).toFixed(2)}" stroke-linejoin="round">${escape(displayLabel)}</text>`);
        if (cpfLine) parts.push(`<text class="sv-confrontante-cpf-text" x="${labelCenter.x.toFixed(2)}" y="${(labelCenter.y + fontSize * 1.18).toFixed(2)}" text-anchor="middle" font-size="${Math.max(4.8,fontSize*.72).toFixed(2)}" font-weight="700" fill="${labelColor}" paint-order="stroke fill" stroke="${labelHalo}" stroke-width="${Math.max(.7,fontSize*.11).toFixed(2)}" stroke-linejoin="round">${escape(cpfLine)}</text>`);
        parts.push(`</g></g></g>`);
      });
      return parts.join('');
    }

    function smartConfrontanteLabels(feature, coords, project, mapBox, options = {}) {
      const count = Math.max(0, (coords || []).length - 1);
      if (!count) return '';
      const segmentOverrides = Array.isArray(options.segmentOverrides) ? options.segmentOverrides : [];
      const projected = coords.slice(0, -1).map((coord) => {
        const [x, y] = project(coord);
        return { x, y };
      });
      if (!projected.length) return '';
      // Chamadas visuais antigas desenhadas no mapa (confrontanteChamadas) não
      // participam mais das gerações. O mapa guarda somente o trecho lógico;
      // o layout visual é controlado por confrontanteVisualLayout.
      const groups = buildConfrontanteGroups(feature, coords, segmentOverrides);
      const metadata = `<g class="sv-confrontante-metadata" data-vertex-count="${count}" data-segment-count="${groups.length}" style="display:none"></g>`;
      const editorAnchors = `<g class="sv-confrontante-editor-anchors" style="display:none">${projected.map((point, index) => `<circle class="sv-confrontante-editor-anchor" data-vertex="${index + 1}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.2"/>`).join('')}</g>`;
      if (!groups.length) return metadata + editorAnchors;
      const placement = String(options.placement || 'boundary').toLowerCase();
      if (placement === 'boundary') {
        const autoHtml = boundaryConfrontanteLabels(groups, projected, mapBox, project, options);
        return metadata + editorAnchors + autoHtml;
      }

      const xs = projected.map((p) => p.x);
      const ys = projected.map((p) => p.y);
      const polyBox = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
      const cx = projected.reduce((sum, p) => sum + p.x, 0) / projected.length;
      const cy = projected.reduce((sum, p) => sum + p.y, 0) / projected.length;
      const halfW = Math.max(1, (polyBox.maxX - polyBox.minX) / 2);
      const halfH = Math.max(1, (polyBox.maxY - polyBox.minY) / 2);
      const fontSize = Number(options.fontSize || 5.2);
      const baseOffset = Number(options.offset || 20);
      const maxOffset = Number(options.maxOffset || Math.max(baseOffset + 20, 52));
      const clearGap = Number(options.clearGap || 3.2);
      const edgePadding = Number(options.edgePadding || 7);
      const maxChars = Number(options.maxChars || 28);
      const manualOffsets = options.manualOffsets && typeof options.manualOffsets === 'object' ? options.manualOffsets : {};
      const externalOccupied = Array.isArray(options.occupiedRects) ? options.occupiedRects : null;
      const occupied = [];
      const parts = [];
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const overlaps = (a, b, gap = clearGap) => !(a.x2 + gap < b.x1 || a.x1 - gap > b.x2 || a.y2 + gap < b.y1 || a.y1 - gap > b.y2);
      const ellipsis = (value, max) => {
        const text = String(value || '').trim();
        return text.length > max ? `${text.slice(0, Math.max(4, max - 1))}…` : text;
      };

      const groupSource = (group) => {
        const indexes = Array.isArray(group.indexes) && group.indexes.length ? group.indexes : [group.start];
        let sx = 0, sy = 0, total = 0;
        indexes.forEach((index) => {
          const a = projected[index];
          const b = projected[(index + 1) % projected.length];
          if (!a || !b) return;
          const length = Math.max(0.1, Math.hypot(b.x - a.x, b.y - a.y));
          sx += ((a.x + b.x) / 2) * length;
          sy += ((a.y + b.y) / 2) * length;
          total += length;
        });
        return total ? { x: sx / total, y: sy / total } : { x: cx, y: cy };
      };

      const preferredSide = (source) => {
        const nx = (source.x - cx) / halfW;
        const ny = (source.y - cy) / halfH;
        if (Math.abs(nx) >= Math.abs(ny)) return nx >= 0 ? 'right' : 'left';
        return ny >= 0 ? 'bottom' : 'top';
      };

      const labelGeometry = (group) => {
        const propertyName = String(group.propriedade || '').trim();
        const showProperty = typeof group.showPropertyInLabel === 'boolean' ? group.showPropertyInLabel : Boolean(propertyName);
        const rawName = String(group.label || '').trim();
        const name = ellipsis(showProperty && propertyName ? `${rawName} — ${propertyName}` : rawName, maxChars);
        const docDisplay = window.SurveyorTechnicalMapBridge?.cpfCnpjDisplay?.(group.cpfCnpj) || { value:String(group.cpfCnpj || '').trim(), label:'' };
        const doc = group.showCpfCnpjInLabel === true ? ellipsis(docDisplay.value, Math.max(18, maxChars)) : '';
        const type = !group.label && group.tipoLimite ? ellipsis(group.tipoLimite, maxChars) : '';
        const lines = ['Confrontante:', name || type || 'Não informado'];
        if (doc) lines.push(docDisplay.label || `CPF/CNPJ: ${doc}`);
        const lineHeight = fontSize * 1.22;
        const widest = Math.max(...lines.map((line) => line.length), 12);
        const width = Math.max(86, Math.min(220, widest * fontSize * 0.56 + 16));
        const height = Math.max(26, lines.length * lineHeight + 12);
        return { lines, width, height, lineHeight };
      };

      const makeRect = (side, source, distance, shift, geom) => {
        const { width, height } = geom;
        if (side === 'right') return { x1: source.x + distance, y1: source.y - height / 2 + shift, x2: source.x + distance + width, y2: source.y + height / 2 + shift };
        if (side === 'left') return { x1: source.x - distance - width, y1: source.y - height / 2 + shift, x2: source.x - distance, y2: source.y + height / 2 + shift };
        if (side === 'top') return { x1: source.x - width / 2 + shift, y1: source.y - distance - height, x2: source.x + width / 2 + shift, y2: source.y - distance };
        return { x1: source.x - width / 2 + shift, y1: source.y + distance, x2: source.x + width / 2 + shift, y2: source.y + distance + height };
      };

      const clampRect = (rect) => {
        const minX = mapBox.x + edgePadding, maxX = mapBox.x + mapBox.w - edgePadding;
        const minY = mapBox.y + edgePadding, maxY = mapBox.y + mapBox.h - edgePadding;
        let dx = 0, dy = 0;
        if (rect.x1 < minX) dx += minX - rect.x1;
        if (rect.x2 + dx > maxX) dx += maxX - (rect.x2 + dx);
        if (rect.y1 < minY) dy += minY - rect.y1;
        if (rect.y2 + dy > maxY) dy += maxY - (rect.y2 + dy);
        return { x1: rect.x1 + dx, y1: rect.y1 + dy, x2: rect.x2 + dx, y2: rect.y2 + dy, dx, dy };
      };

      groups.forEach((group, groupOrder) => {
        const source = groupSource(group);
        const geom = labelGeometry(group);
        const labelColor = normalizeLabelColor(group.labelColor);
        const primary = preferredSide(source);
        const sideOrder = primary === 'right' ? ['right','top','bottom','left']
          : primary === 'left' ? ['left','top','bottom','right']
          : primary === 'top' ? ['top','right','left','bottom']
          : ['bottom','right','left','top'];
        const distances = [baseOffset, baseOffset + 8, baseOffset + 16, Math.min(maxOffset, baseOffset + 26), maxOffset];
        const shifts = [0, 10, -10, 20, -20, 32, -32, 46, -46, 62, -62];
        let best = null;
        for (const side of sideOrder) {
          for (const distance of distances) {
            for (const shift of shifts) {
              const raw = makeRect(side, source, distance, shift, geom);
              const rect = clampRect(raw);
              const collisions = occupied.reduce((sum, other) => sum + (overlaps(rect, other) ? 1 : 0), 0);
              const insidePolyPenalty = pointInProjectedRing({ x: (rect.x1 + rect.x2) / 2, y: (rect.y1 + rect.y2) / 2 }, projected) ? 15000 : 0;
              const sidePenalty = side === primary ? 0 : 260;
              const clampPenalty = Math.hypot(rect.dx, rect.dy) * 25;
              const score = collisions * 20000 + insidePolyPenalty + sidePenalty + clampPenalty + distance * 0.9 + Math.abs(shift) * 0.45;
              if (!best || score < best.score) best = { side, rect, score, collisions };
              if (!collisions && !insidePolyPenalty && side === primary && Math.abs(shift) <= 20) break;
            }
            if (best && !best.collisions && best.side === primary) break;
          }
          if (best && !best.collisions && best.side === primary) break;
        }
        if (!best) return;

        // V39 — rótulos de confrontantes viram callouts legíveis e editáveis.
        // A posição automática continua sendo calculada pelo motor de colisões,
        // mas um deslocamento manual salvo pelo usuário pode reposicionar cada
        // rótulo sem alterar a geometria do imóvel.
        const labelKey = `${group.key || 'confrontante'}::${group.start}-${group.end}::${groupOrder}`;
        const saved = manualOffsets[labelKey] || {};
        const dx = Number.isFinite(Number(saved.dx)) ? Number(saved.dx) : 0;
        const dy = Number.isFinite(Number(saved.dy)) ? Number(saved.dy) : 0;
        const labelScale = Math.max(.20, Math.min(4, Number(saved.scale || 1) || 1));
        const movedRect = {
          x1: best.rect.x1 + dx, y1: best.rect.y1 + dy,
          x2: best.rect.x2 + dx, y2: best.rect.y2 + dy
        };
        occupied.push(movedRect);
        if (externalOccupied) externalOccupied.push({ ...movedRect, kind: 'confrontante' });

        const tx = best.rect.x1 + 2;
        const startY = best.rect.y1 + fontSize + 1.8;
        const calloutAttr = escape(labelKey);
        parts.push(`<g class="sv-confrontante-callout" data-label-key="${calloutAttr}" data-label-color="${escape(labelColor)}" data-label-color-customized="${group?.labelColorCustomized === true ? '1' : '0'}" data-label-scale="${labelScale.toFixed(3)}" data-dx="${dx.toFixed(2)}" data-dy="${dy.toFixed(2)}" data-base-x1="${best.rect.x1.toFixed(2)}" data-base-y1="${best.rect.y1.toFixed(2)}" data-base-x2="${best.rect.x2.toFixed(2)}" data-base-y2="${best.rect.y2.toFixed(2)}" data-map-x="${mapBox.x}" data-map-y="${mapBox.y}" data-map-w="${mapBox.w}" data-map-h="${mapBox.h}">`);
        parts.push(`<g class="sv-confrontante-label" transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) translate(${((best.rect.x1+best.rect.x2)/2).toFixed(2)} ${((best.rect.y1+best.rect.y2)/2).toFixed(2)}) scale(${labelScale.toFixed(3)}) translate(${(-((best.rect.x1+best.rect.x2)/2)).toFixed(2)} ${(-((best.rect.y1+best.rect.y2)/2)).toFixed(2)})">`);
        // V40 — sem caixa branca e sem linha de chamada no documento final.
        // O retângulo transparente existe apenas como área de clique/arraste do editor.
        parts.push(`<rect class="sv-confrontante-hitbox" x="${best.rect.x1.toFixed(2)}" y="${best.rect.y1.toFixed(2)}" width="${(best.rect.x2 - best.rect.x1).toFixed(2)}" height="${(best.rect.y2 - best.rect.y1).toFixed(2)}" rx="3" ry="3" fill="none" stroke="none" pointer-events="all"/>`);
        geom.lines.forEach((line, idx) => {
          parts.push(`<text x="${tx.toFixed(2)}" y="${(startY + idx * geom.lineHeight).toFixed(2)}" font-size="${(idx === 0 ? fontSize * 0.90 : fontSize).toFixed(2)}" font-weight="${idx === 0 ? 800 : 650}" fill="${labelColor}">${escape(line)}</text>`);
        });
        parts.push('</g></g>');
      });

      return metadata + editorAnchors + parts.join('');
    }

    function confrontanteLabel(feature, index) {
      const item = confrontanteItem(feature, index);
      return item.nome || item.tipoLimite || '';
    }

    return Object.freeze({ normalizeConfrontanteKey, confrontanteItem, rangeIndexes, buildConfrontanteGroups, buildConfrontanteColorMaps, svgStyledPerimeter, svgLabelWithBackground, smartConfrontanteLabels, confrontanteLabel });
  }

  window.SurveyorDocumentConfrontantes = Object.freeze({ create });
})();
