(() => {
  'use strict';

  const PROFILE = 'surveyor-vector-pdf-v2';
  const safe = (value) => String(value ?? '').trim();

  function inheritedValue(node, attribute, styleKey = '', fallback = '') {
    let current = node;
    while (current && current.nodeType === 1) {
      const inline = styleKey ? safe(current.style?.[styleKey]) : '';
      const attr = safe(current.getAttribute?.(attribute));
      const value = inline || attr;
      if (value && !/^(inherit|unset|initial)$/i.test(value)) return value;
      current = current.parentElement;
    }
    return fallback;
  }

  function normalizedWeight(value) {
    const raw = safe(value);
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) return numeric >= 600 ? '700' : '400';
    if (/bold|bolder/i.test(raw)) return '700';
    return '400';
  }

  function effectiveWeight(node) {
    return normalizedWeight(inheritedValue(node, 'font-weight', 'fontWeight', '400'));
  }

  function effectiveFill(node) {
    const value = inheritedValue(node, 'fill', 'fill', '#111827');
    return value || '#111827';
  }

  function preservesHalo(node, options = {}) {
    if (!node) return false;
    if (node.matches?.('.sv-confrontante-name-text,.sv-confrontante-cpf-text')) return options.preserveConfrontanteHalo !== false;
    if (node.matches?.('.sv-area-name-text')) return options.preserveAreaNameHalo !== false;
    if (node.closest?.('.sv-document-servitude-road-label')) return true;
    return node.getAttribute?.('data-preserve-text-halo') === '1';
  }

  function textSignature(node) {
    const text = safe(node?.textContent).replace(/\s+/g, ' ');
    const x = safe(node?.getAttribute?.('x'));
    const y = safe(node?.getAttribute?.('y'));
    const transform = safe(node?.getAttribute?.('transform'));
    const anchor = safe(node?.getAttribute?.('text-anchor'));
    const size = safe(node?.getAttribute?.('font-size'));
    return [text, x, y, transform, anchor, size].join('|');
  }

  function audit(svg, options = {}) {
    if (!svg) return { totalTexts:0, duplicateCount:0, duplicateSignatures:[], strokedTexts:0, paintOrderedTexts:0, implicitFillTexts:0, weights:{}, minFontSize:null, maxFontSize:null };
    const signatures = new Map();
    const weights = {};
    let strokedTexts = 0;
    let paintOrderedTexts = 0;
    let implicitFillTexts = 0;
    let minFontSize = Infinity;
    let maxFontSize = 0;
    const texts = Array.from(svg.querySelectorAll('text'));
    texts.forEach((node) => {
      const signature = textSignature(node);
      signatures.set(signature, (signatures.get(signature) || 0) + 1);
      const computed = options.computed === true && node.isConnected && typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
      const stroke = safe(computed?.stroke || node.getAttribute('stroke') || node.style?.stroke);
      const strokeWidth = safe(computed?.strokeWidth || node.getAttribute('stroke-width') || node.style?.strokeWidth);
      const paintOrder = safe(computed?.paintOrder || node.getAttribute('paint-order') || node.style?.paintOrder);
      if (stroke && stroke !== 'none' && stroke !== 'rgba(0, 0, 0, 0)' && Number.parseFloat(strokeWidth || '0') > 0) strokedTexts += 1;
      if (paintOrder && paintOrder !== 'normal') paintOrderedTexts += 1;
      if (!safe(node.getAttribute('fill')) && !safe(node.style?.fill)) implicitFillTexts += 1;
      const weight = normalizedWeight(computed?.fontWeight || effectiveWeight(node));
      weights[weight] = (weights[weight] || 0) + 1;
      const size = Number.parseFloat(computed?.fontSize || node.getAttribute('font-size') || node.style?.fontSize || '');
      if (Number.isFinite(size) && size > 0) {
        minFontSize = Math.min(minFontSize, size);
        maxFontSize = Math.max(maxFontSize, size);
      }
    });
    const duplicateSignatures = Array.from(signatures.entries()).filter(([, count]) => count > 1).map(([signature, count]) => ({ signature, count }));
    return {
      totalTexts: texts.length,
      duplicateCount: duplicateSignatures.reduce((sum, item) => sum + item.count - 1, 0),
      duplicateSignatures,
      strokedTexts,
      paintOrderedTexts,
      implicitFillTexts,
      weights,
      minFontSize: Number.isFinite(minFontSize) ? minFontSize : null,
      maxFontSize: maxFontSize || null
    };
  }

  function normalize(svg, options = {}) {
    if (!svg) return svg;
    svg.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
    svg.setAttribute('font-weight', '400');
    svg.setAttribute('fill', inheritedValue(svg, 'fill', 'fill', '#111827') || '#111827');
    svg.setAttribute('text-rendering', 'geometricPrecision');
    svg.style.fontSynthesis = 'none';
    svg.style.fontSynthesisWeight = 'none';

    svg.querySelectorAll('text,tspan').forEach((node) => {
      const halo = preservesHalo(node, options);
      const fill = effectiveFill(node);
      const weight = effectiveWeight(node);

      // Nenhum texto técnico pode depender do fill implícito do navegador/CSS da interface.
      // Isso evita o desaparecimento de títulos, carimbo e escala ao montar a cena inline.
      if (!safe(node.getAttribute('fill')) && !safe(node.style?.fill)) node.setAttribute('fill', fill || '#111827');
      node.setAttribute('font-weight', weight);
      node.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
      node.setAttribute('letter-spacing', '0');
      node.setAttribute('text-rendering', 'geometricPrecision');
      node.style.fontSynthesis = 'none';
      node.style.fontSynthesisWeight = 'none';
      node.style.removeProperty('letter-spacing');

      // Halos semânticos dos nomes continuam sendo parte da representação.
      // Nos demais textos, stroke/paint-order não participam da tipografia normal.
      if (!halo) {
        // Remover o atributo não basta: SVG permite herdar stroke/paint-order de
        // grupos ancestrais. Gravamos explicitamente o estado neutro para que o
        // texto nunca ganhe contorno e aparência de negrito por herança.
        node.setAttribute('stroke', 'none');
        node.setAttribute('stroke-width', '0');
        node.setAttribute('paint-order', 'normal');
        node.style.removeProperty('stroke');
        node.style.removeProperty('stroke-width');
        node.style.removeProperty('paint-order');
      }
    });
    svg.dataset.technicalTypographyProfile = PROFILE;
    return svg;
  }

  window.SurveyorTechnicalSvgTypography = Object.freeze({
    PROFILE,
    normalizedWeight,
    effectiveWeight,
    effectiveFill,
    normalize,
    audit
  });
})();
