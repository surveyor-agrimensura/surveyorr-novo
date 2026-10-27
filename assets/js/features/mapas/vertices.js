(() => {
  'use strict';

  function create(deps = {}) {
    const { escape } = deps;
    if (typeof escape !== 'function') throw new Error('Dependências do módulo de vértices não foram fornecidas.');

    function smartVertexMarks(coords, project, mapBox, options = {}) {
      const vertices = (coords || []).slice(0, -1).map((coord, index) => {
        const [x, y] = project(coord);
        return { x, y, index };
      });
      if (!vertices.length) return '';
      const cx = vertices.reduce((sum, point) => sum + point.x, 0) / vertices.length;
      const cy = vertices.reduce((sum, point) => sum + point.y, 0) / vertices.length;
      const fontSize = Number(options.fontSize || 5.2);
      const baseOffset = Number(options.offset || 9.5);
      const pointRadius = Number(options.pointRadius || 2.35);
      const pointFill = options.pointFill || '#dc2626';
      // Rótulos técnicos continuam disponíveis, mas pontos de apoio não são impressos.
      // O círculo transparente mantém a âncora semântica para edição do SVG.
      const anchorFill = options.showAnchorDots === false ? 'transparent' : null;
      const labels = Array.isArray(options.labels) ? options.labels : [];
      const occupied = [];
      const parts = [];
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const overlaps = (a, b, gap = 1.4) => !(a.x2 + gap < b.x1 || a.x1 - gap > b.x2 || a.y2 + gap < b.y1 || a.y1 - gap > b.y2);

      vertices.forEach((point, index) => {
        const prev = vertices[(index - 1 + vertices.length) % vertices.length];
        const next = vertices[(index + 1) % vertices.length];
        const label = String(labels[point.index] || `V-${String(point.index + 1).padStart(2, '0')}`);

        // Usa a normal local ao perímetro, e não apenas um vetor radial a partir
        // do centro. Isso deixa os rótulos acompanhando o desenho real da gleba.
        let tx = next.x - prev.x;
        let ty = next.y - prev.y;
        const tangentLength = Math.hypot(tx, ty) || 1;
        tx /= tangentLength;
        ty /= tangentLength;
        let nx = -ty;
        let ny = tx;
        const probeA = { x: point.x + nx * 8, y: point.y + ny * 8 };
        const probeB = { x: point.x - nx * 8, y: point.y - ny * 8 };
        const distA = Math.hypot(probeA.x - cx, probeA.y - cy);
        const distB = Math.hypot(probeB.x - cx, probeB.y - cy);
        if (distB > distA) { nx *= -1; ny *= -1; }

        const textWidth = Math.max(fontSize * 4.1, label.length * fontSize * 0.58);
        const rectW = textWidth + 3.4;
        const rectH = fontSize + 2.6;
        const tangentCandidates = [0, 5, -5, 10, -10, 15, -15];
        const radialCandidates = [baseOffset, baseOffset + 5, baseOffset + 10, baseOffset + 15];
        let chosen = null;

        for (const radial of radialCandidates) {
          for (const tangentShift of tangentCandidates) {
            const lx = clamp(point.x + nx * radial + tx * tangentShift, mapBox.x + rectW / 2 + 3, mapBox.x + mapBox.w - rectW / 2 - 3);
            const ly = clamp(point.y + ny * radial + ty * tangentShift, mapBox.y + rectH / 2 + 3, mapBox.y + mapBox.h - rectH / 2 - 3);
            const rect = { x1: lx - rectW / 2, y1: ly - rectH / 2, x2: lx + rectW / 2, y2: ly + rectH / 2 };
            if (!occupied.some((used) => overlaps(rect, used))) {
              chosen = { x: lx, y: ly, rect };
              break;
            }
          }
          if (chosen) break;
        }

        if (!chosen) {
          const stagger = ((index % 5) - 2) * 5;
          const radial = baseOffset + 16 + (index % 3) * 4;
          const lx = clamp(point.x + nx * radial + tx * stagger, mapBox.x + rectW / 2 + 3, mapBox.x + mapBox.w - rectW / 2 - 3);
          const ly = clamp(point.y + ny * radial + ty * stagger, mapBox.y + rectH / 2 + 3, mapBox.y + mapBox.h - rectH / 2 - 3);
          chosen = { x: lx, y: ly, rect: { x1: lx - rectW / 2, y1: ly - rectH / 2, x2: lx + rectW / 2, y2: ly + rectH / 2 } };
        }
        occupied.push(chosen.rect);

        const distance = Math.hypot(chosen.x - point.x, chosen.y - point.y);
        parts.push(`<circle cx="${point.x}" cy="${point.y}" r="${pointRadius}" fill="${pointFill}" stroke="#fff" stroke-width="0.75"/>`);
        if (distance > baseOffset + 8) {
          const lineEndX = point.x + (chosen.x - point.x) * 0.72;
          const lineEndY = point.y + (chosen.y - point.y) * 0.72;
          parts.push(`<line x1="${point.x}" y1="${point.y}" x2="${lineEndX.toFixed(2)}" y2="${lineEndY.toFixed(2)}" stroke="#64748b" stroke-width="0.45" stroke-linecap="round" opacity="0.58"/>`);
        }
        const paddingX = Number(options.paddingX ?? 1.05);
        const paddingY = Number(options.paddingY ?? 0.42);
        parts.push(svgLabelWithBackground(chosen.x, chosen.y, label, {
          fontSize,
          paddingX,
          paddingY,
          bgFill: '#ffffff',
          bgOpacity: 0.9,
          textColor: '#111827',
          fontWeight: 600,
          anchor: 'middle',
          radius: 1.35
        }));
      });

      return parts.join('');
    }

    function automaticCartographicLayoutProfile(coords, project, variant = 'classic') {
      const points = (coords || []).slice(0, -1).map((coord) => {
        const [x, y] = project(coord);
        return { x, y };
      });
      const count = points.length;
      const lengths = [];
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (a && b) lengths.push(Math.hypot(b.x - a.x, b.y - a.y));
      }
      lengths.sort((a, b) => a - b);
      const medianEdge = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 999;
      const dense = count >= 22 || medianEdge < 22;
      const ultraDense = count >= 40 || medianEdge < 13;
      const rural = variant === 'rural-reference' || variant === 'technical-sheet';
      const shortEdges = lengths.filter((value) => value < 16).length;
      const crowdingRatio = lengths.length ? shortEdges / lengths.length : 0;
      const critical = ultraDense || crowdingRatio >= 0.34;
      return {
        count, medianEdge, dense, ultraDense, critical, crowdingRatio,
        vertexFontSize: critical ? (rural ? 0.92 : 0.98) : dense ? (rural ? 1.08 : 1.16) : (rural ? 1.22 : 1.30),
        vertexOffset: critical ? 1.45 : dense ? 1.75 : 2.05,
        vertexMaxDistance: critical ? 23 : dense ? 18 : 13,
        vertexEmergencyDistance: critical ? 40 : dense ? 32 : 24,
        vertexClusterDistance: critical ? 15 : dense ? 18 : 22,
        dimensionFontSize: critical ? 1.78 : dense ? 2.15 : 2.62,
        dimensionMinFontSize: critical ? 1.05 : dense ? 1.28 : 1.62,
        dimensionOffset: critical ? 8.8 : dense ? 8.0 : 7.6,
        dimensionExtraOffset: critical ? 4.8 : dense ? 3.5 : 2.2,
        shortDimensionThreshold: critical ? 38 : dense ? 30 : 22,
        confrontanteFontSize: critical ? 4.1 : dense ? 4.6 : 5.1,
        confrontanteOffset: critical ? 24 : dense ? 22 : 20,
        confrontanteMaxOffset: critical ? 72 : dense ? 62 : 54,
        clearGap: critical ? 1.25 : dense ? 0.92 : 0.66
      };
    }

    function projectedVertexProtectionRects(coords, project, radius = 2.2) {
      return (coords || []).slice(0, -1).map((coord) => {
        const [x, y] = project(coord);
        return { x1: x - radius, y1: y - radius, x2: x + radius, y2: y + radius, kind: 'vertex-anchor' };
      });
    }

    function croquiVertexMarks(coords, project, mapBox, options = {}) {
      const vertices = (coords || []).slice(0, -1).map((coord, index) => {
        const [x, y] = project(coord);
        return { x, y, index };
      });
      if (!vertices.length) return '';

      const hiddenVertexIndexes = new Set((Array.isArray(options.hiddenVertexIndexes) ? options.hiddenVertexIndexes : [])
        .map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index < vertices.length));

      const cx = vertices.reduce((sum, point) => sum + point.x, 0) / vertices.length;
      const cy = vertices.reduce((sum, point) => sum + point.y, 0) / vertices.length;
      const fontSize = Number(options.fontSize || 5.1) * 2.15;
      const baseOffset = Number(options.offset || 10.8);
      const pointRadius = Number(options.pointRadius || 2.45);
      const pointFill = options.pointFill || '#dc2626';
      // Rótulos técnicos continuam disponíveis, mas pontos de apoio não são impressos.
      // O círculo transparente mantém a âncora semântica para edição do SVG.
      const anchorFill = options.showAnchorDots === false ? 'transparent' : null;
      const guideColor = options.guideColor || '#f8fafc';
      const guideHalo = options.guideHalo || '#334155';
      const edgePadding = Number(options.edgePadding || 5);
      const clearGap = Number(options.clearGap || 1.8);
      const paddingX = Number(options.paddingX || 1.55);
      const paddingY = Number(options.paddingY || 0.68);
      const maxDistance = Math.max(baseOffset + 8, Number(options.maxDistance || 30));
      const emergencyDistance = Math.max(maxDistance + 14, Number(options.emergencyDistance || 54));
      const leaderThreshold = Number(options.leaderThreshold || (baseOffset + 7));
      const vertexColorMap = options.vertexColorMap || {};
      const reservedRects = Array.isArray(options.reservedRects) ? options.reservedRects.filter(Boolean) : [];
      const labelOffsets = options.labelOffsets && typeof options.labelOffsets === 'object' ? options.labelOffsets : {};
      const labels = Array.isArray(options.labels) ? options.labels : [];
      const occupied = reservedRects.map((rect) => ({ x1: Number(rect.x1), y1: Number(rect.y1), x2: Number(rect.x2), y2: Number(rect.y2), reserved: true }));
      const leaderSegments = [];
      const placements = new Map();
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const overlaps = (a, b, gap = clearGap) => !(a.x2 + gap < b.x1 || a.x1 - gap > b.x2 || a.y2 + gap < b.y1 || a.y1 - gap > b.y2);
      const rotate = (x, y, deg) => {
        const rad = deg * Math.PI / 180;
        return { x: x * Math.cos(rad) - y * Math.sin(rad), y: x * Math.sin(rad) + y * Math.cos(rad) };
      };
      const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const segmentsCross = (a, b, c, d) => {
        const o1 = orient(a, b, c); const o2 = orient(a, b, d);
        const o3 = orient(c, d, a); const o4 = orient(c, d, b);
        return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
      };
      const anchorOnRect = (rect, point) => {
        const rcx = (rect.x1 + rect.x2) / 2;
        const rcy = (rect.y1 + rect.y2) / 2;
        const halfW = Math.max(0.1, (rect.x2 - rect.x1) / 2);
        const halfH = Math.max(0.1, (rect.y2 - rect.y1) / 2);
        const nx = (point.x - rcx) / halfW;
        const ny = (point.y - rcy) / halfH;
        if (Math.abs(nx) > Math.abs(ny)) return { x: nx < 0 ? rect.x1 : rect.x2, y: clamp(point.y, rect.y1 + 1, rect.y2 - 1) };
        return { x: clamp(point.x, rect.x1 + 1, rect.x2 - 1), y: ny < 0 ? rect.y1 : rect.y2 };
      };
      const insideMap = (rect) => rect.x1 >= mapBox.x + edgePadding && rect.x2 <= mapBox.x + mapBox.w - edgePadding
        && rect.y1 >= mapBox.y + edgePadding && rect.y2 <= mapBox.y + mapBox.h - edgePadding;
      const otherVertexHits = (rect, ownIndex) => vertices.reduce((sum, v) => {
        if (v.index === ownIndex) return sum;
        return sum + (v.x >= rect.x1 - 1.2 && v.x <= rect.x2 + 1.2 && v.y >= rect.y1 - 1.2 && v.y <= rect.y2 + 1.2 ? 1 : 0);
      }, 0);
      const densityScore = (point) => {
        let nearby = 0;
        let nearest = Infinity;
        for (const other of vertices) {
          if (other.index === point.index) continue;
          const d = Math.hypot(other.x - point.x, other.y - point.y);
          if (d < nearest) nearest = d;
          if (d < 34) nearby += 1;
        }
        return { nearby, nearest: Number.isFinite(nearest) ? nearest : 9999 };
      };

      // Modo técnico literal: cada rótulo permanece ligado ao seu próprio
      // vértice. Não existe redistribuição, fila, cluster nem anti-colisão.
      // Se dois vértices forem próximos, os seus textos podem ficar próximos
      // também; a prioridade é fidelidade geométrica ao desenho original.
      if (options.strictPlacement !== false) {
        const parts = [];
        const estimateTextWidth = (label) => Math.max(fontSize + String(label).length * fontSize * 0.62, fontSize * 1.75);
        vertices.forEach((point) => {
          if (hiddenVertexIndexes.has(point.index)) return;
          const prev = vertices[(point.index - 1 + vertices.length) % vertices.length];
          const next = vertices[(point.index + 1) % vertices.length];
          let tx = next.x - prev.x;
          let ty = next.y - prev.y;
          const tangentLength = Math.hypot(tx, ty) || 1;
          tx /= tangentLength; ty /= tangentLength;
          let nx = -ty; let ny = tx;
          const aDist = Math.hypot((point.x + nx * 10) - cx, (point.y + ny * 10) - cy);
          const bDist = Math.hypot((point.x - nx * 10) - cx, (point.y - ny * 10) - cy);
          if (bDist > aDist) { nx *= -1; ny *= -1; }
          const label = String(labels[point.index] || `V-${String(point.index + 1).padStart(2, '0')}`);
          const estimatedWidth = estimateTextWidth(label);
          void estimatedWidth;
          const literalOffset = Math.max(1.1, Math.min(4.2, baseOffset));
          const baseTextX = point.x + nx * literalOffset;
          const baseTextY = point.y + ny * literalOffset + fontSize * 0.30;
          const manual = labelOffsets[label] || { dx:0, dy:0 };
          const dx = Number(manual?.dx || 0) || 0;
          const dy = Number(manual?.dy || 0) || 0;
          const textX = baseTextX + dx;
          const textY = baseTextY + dy;
          const vertexColor = vertexColorMap[point.index] || pointFill;
          parts.push(`<circle class="sv-vertex-anchor" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${pointRadius}" fill="${anchorFill || vertexColor}" stroke="none"/>`);
          parts.push(`<text class="sv-inline-label sv-vertex-label" data-label-style="technical" data-vertex="${label}" data-base-x="${baseTextX.toFixed(2)}" data-base-y="${baseTextY.toFixed(2)}" data-offset-dx="${dx.toFixed(2)}" data-offset-dy="${dy.toFixed(2)}" data-individual-scale="1" x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" text-anchor="middle" font-size="${fontSize.toFixed(3)}" font-weight="500" fill="#1f2937">${escape(label)}</text>`);
        });
        return parts.join('');
      }

      // Os pontos mais apertados são resolvidos primeiro. Isso evita que vértices
      // isolados ocupem justamente o espaço necessário para um grupo denso.
      const work = vertices.filter((point) => !hiddenVertexIndexes.has(point.index))
        .map((point) => ({ ...point, density: densityScore(point) }))
        .sort((a, b) => b.density.nearby - a.density.nearby || a.density.nearest - b.density.nearest || a.index - b.index);

      const makeGeometry = (point) => {
        const prev = vertices[(point.index - 1 + vertices.length) % vertices.length];
        const next = vertices[(point.index + 1) % vertices.length];
        let tx = next.x - prev.x;
        let ty = next.y - prev.y;
        const tangentLength = Math.hypot(tx, ty) || 1;
        tx /= tangentLength; ty /= tangentLength;
        let nx = -ty; let ny = tx;
        const aDist = Math.hypot((point.x + nx * 10) - cx, (point.y + ny * 10) - cy);
        const bDist = Math.hypot((point.x - nx * 10) - cx, (point.y - ny * 10) - cy);
        if (bDist > aDist) { nx *= -1; ny *= -1; }
        return { tx, ty, nx, ny };
      };

      const buildCandidate = (point, rectW, rectH, centerX, centerY, rawX = centerX, rawY = centerY) => {
        const lx = clamp(centerX, mapBox.x + rectW / 2 + edgePadding, mapBox.x + mapBox.w - rectW / 2 - edgePadding);
        const ly = clamp(centerY, mapBox.y + rectH / 2 + edgePadding, mapBox.y + mapBox.h - rectH / 2 - edgePadding);
        const rect = { x1: lx - rectW / 2, y1: ly - rectH / 2, x2: lx + rectW / 2, y2: ly + rectH / 2 };
        const anchor = anchorOnRect(rect, point);
        const segment = { a: { x: point.x, y: point.y }, b: anchor };
        const collisions = occupied.reduce((sum, used) => sum + (overlaps(rect, used) ? 1 : 0), 0);
        const vertexHits = otherVertexHits(rect, point.index);
        const crossings = leaderSegments.reduce((sum, used) => sum + (segmentsCross(segment.a, segment.b, used.a, used.b) ? 1 : 0), 0);
        const clampPenalty = Math.hypot(lx - rawX, ly - rawY);
        return { x: lx, y: ly, rect, anchor, segment, collisions, vertexHits, crossings, clampPenalty, inside: insideMap(rect) };
      };



      // Agrupa sequências de vértices muito próximos e as organiza como na
      // Prancha Técnica: uma única "fileira" acompanhando a divisa. Isso evita
      // que V-02, V-03, V-04... se espalhem para lados aleatórios do desenho.
      const clusterDistance = Number(options.clusterDistance || 38);
      const denseGroups = [];
      for (let start = 0; start < vertices.length - 1;) {
        if (hiddenVertexIndexes.has(start) || hiddenVertexIndexes.has(start + 1)
          || Math.hypot(vertices[start + 1].x - vertices[start].x, vertices[start + 1].y - vertices[start].y) >= clusterDistance) {
          start += 1;
          continue;
        }
        const group = [vertices[start]];
        let end = start;
        while (end < vertices.length - 1 && !hiddenVertexIndexes.has(end + 1)
          && Math.hypot(vertices[end + 1].x - vertices[end].x, vertices[end + 1].y - vertices[end].y) < clusterDistance) {
          end += 1;
          group.push(vertices[end]);
        }
        if (group.length >= 3) denseGroups.push(group);
        start = Math.max(end + 1, start + 1);
      }

      const labelMetrics = (point) => {
        const label = String(labels[point.index] || `V-${String(point.index + 1).padStart(2, '0')}`);
        const estimatedWidth = Math.max(fontSize + label.length * fontSize * 0.62, fontSize * 1.75);
        return { label, rectW: estimatedWidth + paddingX * 2, rectH: fontSize + paddingY * 2.1 };
      };

      const tryDenseGroup = (group) => {
        const first = group[0];
        const last = group[group.length - 1];
        let tx = last.x - first.x;
        let ty = last.y - first.y;
        let tangentLength = Math.hypot(tx, ty);
        if (tangentLength < 0.5) {
          const geom = makeGeometry(group[Math.floor(group.length / 2)]);
          tx = geom.tx; ty = geom.ty; tangentLength = 1;
        }
        tx /= tangentLength; ty /= tangentLength;
        let nx = -ty; let ny = tx;
        const mid = group.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        mid.x /= group.length; mid.y /= group.length;
        if (Math.hypot(mid.x - nx * 10 - cx, mid.y - ny * 10 - cy) > Math.hypot(mid.x + nx * 10 - cx, mid.y + ny * 10 - cy)) {
          nx *= -1; ny *= -1;
        }

        const ordered = group.map((point) => ({ point, metric: labelMetrics(point), t: point.x * tx + point.y * ty }))
          .sort((a, b) => a.t - b.t);
        const adjustedT = ordered.map((item) => item.t);
        for (let i = 1; i < ordered.length; i += 1) {
          const prev = ordered[i - 1].metric;
          const cur = ordered[i].metric;
          const prevSpan = Math.abs(tx) * prev.rectW + Math.abs(ty) * prev.rectH;
          const curSpan = Math.abs(tx) * cur.rectW + Math.abs(ty) * cur.rectH;
          const minGap = (prevSpan + curSpan) / 2 + clearGap + 0.7;
          adjustedT[i] = Math.max(adjustedT[i], adjustedT[i - 1] + minGap);
        }
        const meanShift = adjustedT.reduce((sum, value, i) => sum + (value - ordered[i].t), 0) / adjustedT.length;
        for (let i = 0; i < adjustedT.length; i += 1) adjustedT[i] -= meanShift;

        const radialCandidates = [];
        for (let radial = baseOffset; radial <= Math.min(maxDistance, baseOffset + 34); radial += 4) radialCandidates.push(radial);
        const groupShifts = [0, 2, -2, 4, -4, 6, -6, 9, -9, 13, -13, 18, -18];
        // Exterior primeiro; se estiver bloqueado por um confrontante ou pela borda,
        // tenta o lado oposto mantendo a mesma fileira organizada.
        for (const sideSign of [1, -1]) {
          for (const radial of radialCandidates) {
            for (const groupShift of groupShifts) {
              const proposed = [];
              let valid = true;
              for (let i = 0; i < ordered.length; i += 1) {
                const { point, metric } = ordered[i];
                const tangentShift = adjustedT[i] - ordered[i].t + groupShift;
                const rawX = point.x + nx * radial * sideSign + tx * tangentShift;
                const rawY = point.y + ny * radial * sideSign + ty * tangentShift;
                const candidate = buildCandidate(point, metric.rectW, metric.rectH, rawX, rawY, rawX, rawY);
                candidate.label = metric.label;
                candidate.rectW = metric.rectW;
                candidate.rectH = metric.rectH;
                candidate.radial = radial;
                candidate.angle = sideSign === 1 ? 0 : 180;
                candidate.tangentShift = tangentShift;
                if (!candidate.inside || candidate.collisions || candidate.vertexHits) { valid = false; break; }
                if (proposed.some((other) => overlaps(candidate.rect, other.rect))) { valid = false; break; }
                proposed.push(candidate);
              }
              if (!valid || proposed.length !== ordered.length) continue;
              proposed.forEach((candidate, i) => {
                const point = ordered[i].point;
                occupied.push(candidate.rect);
                leaderSegments.push(candidate.segment);
                placements.set(point.index, candidate);
              });
              return true;
            }
          }
        }
        return false;
      };

      // Reserva primeiro os agrupamentos densos; os demais vértices usam o
      // posicionador geral abaixo. Assim a sequência visual permanece limpa.
      denseGroups.sort((a, b) => b.length - a.length).forEach((group) => tryDenseGroup(group));


      work.forEach((point) => {
        if (placements.has(point.index)) return;
        const label = String(labels[point.index] || `V-${String(point.index + 1).padStart(2, '0')}`);
        const estimatedWidth = Math.max(fontSize + label.length * fontSize * 0.62, fontSize * 1.75);
        const rectW = estimatedWidth + paddingX * 2;
        const rectH = fontSize + paddingY * 2.1;
        const { tx, ty, nx, ny } = makeGeometry(point);
        // Mesmo padrão visual da Prancha Técnica: primeiro mantém o rótulo
        // bem próximo do vértice, para fora do perímetro, e distribui grupos
        // apertados ao longo da tangente (efeito de fila/escadinha).
        const angleCandidates = [0, 7, -7, 14, -14, 22, -22, 32, -32];
        const tangentShifts = [0, 2, -2, 4, -4, 6, -6, 8.5, -8.5, 11, -11, 14, -14, 18, -18, 23, -23];
        let bestFree = null;
        let bestAny = null;

        const consider = (candidate, radial, angle, tangentShift, emergency = false) => {
          const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
          const outwardDot = ((candidate.x - point.x) * nx + (candidate.y - point.y) * ny);
          const score = candidate.collisions * 1000000 + candidate.vertexHits * 180000 + candidate.crossings * 1700
            + candidate.clampPenalty * 80 + distance * 0.72 + Math.abs(angle) * 0.82 + Math.abs(tangentShift) * 0.08
            + (outwardDot < 0 ? 320 : 0) + (emergency ? 34 : 0) + radial * 0.08;
          const enriched = { ...candidate, score, label, rectW, rectH, radial, angle, tangentShift };
          if (!bestAny || score < bestAny.score) bestAny = enriched;
          if (candidate.collisions === 0 && candidate.vertexHits === 0 && candidate.inside) {
            if (!bestFree || score < bestFree.score) bestFree = enriched;
          }
        };

        // Primeira rodada: posições naturais, próximas ao vértice e voltadas para fora.
        for (let radial = baseOffset; radial <= maxDistance; radial += 4) {
          for (const angle of angleCandidates) {
            const dir = rotate(nx, ny, angle);
            for (const tangentShift of tangentShifts) {
              const rawX = point.x + dir.x * radial + tx * tangentShift;
              const rawY = point.y + dir.y * radial + ty * tangentShift;
              consider(buildCandidate(point, rectW, rectH, rawX, rawY, rawX, rawY), radial, angle, tangentShift, false);
            }
          }
          if (bestFree && bestFree.radial <= baseOffset + 12 && bestFree.crossings === 0 && bestFree.clampPenalty < 0.2) break;
        }

        // Segunda rodada: espiral maior, usada principalmente em grupos como V-02...V-06.
        if (!bestFree) {
          for (let radial = maxDistance + 4; radial <= emergencyDistance; radial += 6) {
            for (let angle = -180; angle <= 180; angle += 15) {
              const dir = rotate(nx, ny, angle);
              const rawX = point.x + dir.x * radial;
              const rawY = point.y + dir.y * radial;
              consider(buildCandidate(point, rectW, rectH, rawX, rawY, rawX, rawY), radial, angle, 0, true);
            }
            if (bestFree) break;
          }
        }

        // Último recurso determinístico: procura uma célula realmente livre no mapa.
        // Em vez de aceitar sobreposição, varre o quadro e escolhe a vaga livre mais próxima.
        if (!bestFree) {
          const stepX = Math.max(10, rectW + clearGap + 2);
          const stepY = Math.max(8, rectH + clearGap + 2);
          let scanBest = null;
          for (let ly = mapBox.y + edgePadding + rectH / 2; ly <= mapBox.y + mapBox.h - edgePadding - rectH / 2; ly += stepY) {
            for (let lx = mapBox.x + edgePadding + rectW / 2; lx <= mapBox.x + mapBox.w - edgePadding - rectW / 2; lx += stepX) {
              const candidate = buildCandidate(point, rectW, rectH, lx, ly, lx, ly);
              if (candidate.collisions || candidate.vertexHits || !candidate.inside) continue;
              const distance = Math.hypot(lx - point.x, ly - point.y);
              const outwardDot = ((lx - point.x) * nx + (ly - point.y) * ny);
              const score = distance + candidate.crossings * 1500 + (outwardDot < 0 ? 180 : 0);
              if (!scanBest || score < scanBest.score) scanBest = { ...candidate, score, label, rectW, rectH, radial: distance, angle: 0, tangentShift: 0 };
            }
          }
          if (scanBest) bestFree = scanBest;
        }

        const best = bestFree || bestAny;
        if (!best) return;
        occupied.push(best.rect);
        leaderSegments.push(best.segment);
        placements.set(point.index, best);
      });

      const parts = [];
      vertices.forEach((point) => {
        // Remoção virtual é somente documental/visual: a coordenada continua
        // compondo o contorno, mas nem o ponto nem o rótulo V-xx são desenhados.
        if (hiddenVertexIndexes.has(point.index)) return;
        const vertexColor = vertexColorMap[point.index] || pointFill;
        parts.push(`<circle class="sv-vertex-anchor" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${pointRadius}" fill="${anchorFill || vertexColor}" stroke="none"/>`);
        const best = placements.get(point.index);
        if (!best) return;
        const boxY = best.rect.y1;
        const baseTextX = (best.rect.x1 + best.rect.x2) / 2;
        const baseTextY = boxY + best.rectH / 2 + fontSize * 0.34;
        const manual = labelOffsets[best.label] || { dx:0, dy:0 };
        const dx=Number(manual?.dx||0)||0, dy=Number(manual?.dy||0)||0;
        const textX=baseTextX+dx, textY=baseTextY+dy;
        const renderedFontSize=fontSize;
        // O tamanho dos vértices é uniforme: o controle geral é a única fonte
        // de escala. Ajustes individuais antigos não podem deformar V-01/V-02/….
        parts.push(`<text class="sv-inline-label sv-vertex-label" data-label-style="technical" data-vertex="${best.label}" data-base-x="${baseTextX.toFixed(2)}" data-base-y="${baseTextY.toFixed(2)}" data-offset-dx="${dx.toFixed(2)}" data-offset-dy="${dy.toFixed(2)}" data-individual-scale="1" x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" text-anchor="middle" font-size="${renderedFontSize.toFixed(3)}" font-weight="500" fill="#1f2937">${escape(best.label)}</text>`);
      });

      return parts.join('');
    }

    return Object.freeze({ smartVertexMarks, automaticCartographicLayoutProfile, projectedVertexProtectionRects, croquiVertexMarks });
  }

  window.SurveyorDocumentVertices = Object.freeze({ create });
})();
