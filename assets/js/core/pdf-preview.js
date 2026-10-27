(() => {
  'use strict';

  if (window.SurveyorLivePdfPreviewInstalled) return;
  window.SurveyorLivePdfPreviewInstalled = true;

  const PAGE_CONFIG = {
    'mapas.html': { targets: [{ id: 'mapPreview', orientation: 'landscape', title: 'Mapas e croquis', fitOnePage: true, vectorSvg: true }] },
    'pranchas.html': { targets: [{ id: 'mapPreview', orientation: 'landscape', title: 'Pranchas técnicas — Surveyor', fitOnePage: true, vectorSvg: true }] },
    'planialtimetria.html': { targets: [{ id: 'elevationPreview', orientation: 'portrait', title: 'Planialtimetria / MDT — Surveyor', fitOnePage: true, vectorSvg: true }] },
    'confrontacao.html': { targets: [{ id: 'letterOutput', orientation: 'portrait', title: 'Carta de confrontação — Surveyor' }] },
    'perimetros.html': { targets: [{ id: 'azimuthPreview', orientation: 'landscape', title: 'Perímetro por azimute — Surveyor', fitOnePage: true, vectorSvg: true }] },
    'ambiental.html': { targets: [{ id: 'environmentOutput', orientation: 'portrait', title: 'Relatório ambiental — Surveyor', fitOnePage: true, fitOnePageAlign: 'top' }] },
    'car.html': { targets: [{ id: 'carReportPreview', orientation: 'portrait', title: 'Relatório CAR — Surveyor', fitOnePage: false }] },
    'glebas.html': { targets: [{ id: 'glebaPreview', orientation: 'landscape', title: 'Divisão de glebas — Surveyor', fitOnePage: true, vectorSvg: true }] },
    'loteamentos-reurb.html': { targets: [{ id: 'lotPreview', orientation: 'portrait', title: 'Loteamentos / REURB — Surveyor', fitOnePage: false }] }
  };

  const style = document.createElement('style');
  style.id = 'surveyor-live-pdf-preview-style';
  style.textContent = `
    .surveyor-pdf-preview-host{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;outline:0!important;background:transparent!important;min-height:0!important;overflow:hidden!important;overscroll-behavior:contain!important}
    .surveyor-pdf-native-wrap{width:100%;height:clamp(540px,68vh,920px);min-height:540px;border:0;border-radius:0;overflow:hidden;background:#303030;overscroll-behavior:contain;contain:layout paint}
    .surveyor-pdf-native-viewer{display:block;width:100%;height:100%;min-height:540px;border:0;background:#303030;overscroll-behavior:contain}
    .surveyor-pdf-native-wrap-official,.surveyor-pdf-native-viewer-official{border-radius:0!important;box-shadow:none!important}
    @media(max-width:900px){.surveyor-pdf-native-wrap{height:72vh;min-height:460px}.surveyor-pdf-native-viewer{height:100%;min-height:460px}}
    .surveyor-pdf-preview-loading,.surveyor-pdf-preview-error{display:grid;place-items:center;min-height:280px;border:1px dashed #cbd5e1;border-radius:16px;background:#f8fafc;color:#475569;text-align:center;padding:24px}
    .surveyor-pdf-preview-error{background:#fff7f7;color:#7f1d1d;border-color:#fecaca}
    .surveyor-pdf-source{display:none!important}
  `;
  document.head.appendChild(style);

  function hashString(value) {
    const input = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return String(hash >>> 0);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  const externalScriptPromises = new Map();

  function loadScriptOnce(urls, check) {
    const candidates = Array.isArray(urls) ? urls.filter(Boolean) : [urls].filter(Boolean);
    const key = candidates.join('|');
    if (!key) return Promise.reject(new Error('Nenhuma URL de script foi informada.'));
    if (typeof check === 'function' && check()) return Promise.resolve();
    if (externalScriptPromises.has(key)) return externalScriptPromises.get(key);
    const promise = (async () => {
      let lastError = null;
      for (const url of candidates) {
        if (typeof check === 'function' && check()) return;
        try {
          await new Promise((resolve, reject) => {
            const existing = Array.from(document.scripts).find((script) => script.src === url);
            if (existing) {
              if (typeof check === 'function' && check()) { resolve(); return; }
              existing.addEventListener('load', resolve, { once: true });
              existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${url}`)), { once: true });
              return;
            }
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Falha ao carregar ${url}`));
            document.head.appendChild(script);
          });
          if (!check || check()) return;
          lastError = new Error(`Script carregado, mas a biblioteca esperada não foi inicializada: ${url}`);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('Não foi possível carregar o script externo necessário.');
    })();
    externalScriptPromises.set(key, promise);
    return promise;
  }

  async function ensureSvgToPdfSupport() {
    if (typeof window.jspdf?.jsPDF?.API?.svg === 'function') return;
    await loadScriptOnce([
      'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.7.0/dist/svg2pdf.umd.min.js',
      'https://unpkg.com/svg2pdf.js@2.7.0/dist/svg2pdf.umd.min.js'
    ], () => typeof window.jspdf?.jsPDF?.API?.svg === 'function');
  }

  function getPageConfig() {
    return PAGE_CONFIG[document.body?.dataset?.page || ''] || null;
  }

  function normalizePageFormat(value) {
    return String(value || 'a4').toLowerCase() === 'a3' ? 'a3' : 'a4';
  }

  function pageSizeMm(format, orientation) {
    const normalized = normalizePageFormat(format);
    const landscape = orientation === 'landscape';
    const base = normalized === 'a3' ? { w: 297, h: 420 } : { w: 210, h: 297 };
    return landscape ? { width: base.h, height: base.w } : { width: base.w, height: base.h };
  }


  function nativeViewerHash() {
    // O conteúdo do iframe é entregue ao visualizador PDF nativo do navegador.
    // Chrome/Edge usam o visualizador Chromium instalado no computador do usuário.
    return '#page=1&zoom=page-width&toolbar=1&navpanes=1&scrollbar=1';
  }

  function mountNativeViewer(previewEl, blob, options = {}) {
    if (!previewEl || !(blob instanceof Blob)) throw new Error('PDF inválido para pré-visualização.');
    const previousUrl = previewEl._surveyorPdfBlobUrl;
    const url = URL.createObjectURL(blob);
    previewEl._surveyorPdfBlobUrl = url;
    if (previousUrl) {
      setTimeout(() => { try { URL.revokeObjectURL(previousUrl); } catch (_error) {} }, 1000);
    }
    previewEl.classList.add('surveyor-pdf-preview-host');
    previewEl.hidden = false;
    previewEl.innerHTML = `<div class="surveyor-pdf-native-wrap surveyor-pdf-native-wrap-official"><iframe class="surveyor-pdf-native-viewer surveyor-pdf-native-viewer-official" src="${url}${nativeViewerHash()}" title="${escapeHtml(options.title || 'Documento PDF')}" loading="eager" scrolling="yes" allow="fullscreen"></iframe></div>`;
    return url;
  }

  function hasRenderableContent(el) {
    if (!el) return false;
    if (el.querySelector('.surveyor-pdf-native-viewer-official')) return false;
    if (el.querySelector('.sv-doc-canonical-empty-preview,.sv-prancha-inline-empty-sheet,.sv-doc-preview-placeholder')) return false;
    if (el.matches?.('.empty') || (el.children?.length === 1 && el.firstElementChild?.matches?.('.empty'))) return false;
    const html = el.innerHTML || '';
    const text = (el.textContent || '').trim();
    if (!html.trim()) return false;
    if (/Selecione um projeto|Clique em|Preencha os dados|Aguardando|Gerando/i.test(text)) return false;
    return /<svg|<table|<article|<section|<h1|<h2|<div|<p/i.test(html) && text.length > 8;
  }

  function buildCombinedSourceHtml(config, previewEl) {
    const blocks = [previewEl.innerHTML];
    (config.extraSelectors || []).forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (node === previewEl) return;
        blocks.push(node.outerHTML);
      });
    });
    return blocks.join('');
  }

  function stripNonPrintableSvgUi(svg) {
    if (!svg) return svg;
    // Não rasterizar controles de arrasto da servidão mesmo quando o SVG
    // veio de uma prévia antiga. As bordas definitivas permanecem intactas.
    svg.querySelectorAll('.sv-confrontante-hitbox,.sv-area-name-hitbox,.sv-editor-guide-hitbox,.sv-editor-guide-handle,.sv-confrontante-editor-anchors,.sv-vertex-anchor,.sv-editor-servitude-handle,.sv-editor-servitude-hitbox,.sv-editor-servitude-center,.sv-editor-servitude-temp').forEach((node) => node.remove());
    svg.querySelectorAll('.sv-document-manual-servitude.is-selected').forEach((node)=>node.classList.remove('is-selected'));
    return svg;
  }

  // svg2pdf não garante paint-order="stroke fill". Na RC185.59 o halo
  // desenhava uma SEGUNDA FONTE preenchida de preto atrás do nome: o stroke
  // espesso fundia os caracteres em uma tarja preta. No PDF, desenhar apenas
  // um contorno fino sem preenchimento; a cor original fica no texto da frente.
  function addPrintableConfrontanteOutlines(svg) {
    if (!svg) return svg;
    svg.querySelectorAll('.sv-confrontante-name-text,.sv-confrontante-cpf-text').forEach((node) => {
      if (node.getAttribute('data-pdf-outlined') === '1') return;
      const color = String(node.getAttribute('fill') || node.style?.fill || '#111827').trim();
      const isHex = /^#[0-9a-f]{6}$/i.test(color);
      const rgb = isHex ? [1,3,5].map((i) => parseInt(color.slice(i,i + 2),16)) : [17,24,39];
      const luminance = (rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722) / 255;
      const halo = luminance >= .62 ? '#111827' : '#ffffff';
      const fontSize = Number.parseFloat(node.getAttribute('font-size') || '8') || 8;
      // Independente do stroke grande de edição: no PDF o contorno deve ser
      // fino o suficiente para não juntar letras e simular fundo sólido.
      const strokeWidth = Math.max(.45, Math.min(1, fontSize * .07));
      const underlay = node.cloneNode(true);
      underlay.setAttribute('class', 'sv-pdf-confrontante-halo');
      underlay.removeAttribute('id');
      underlay.setAttribute('aria-hidden', 'true');
      underlay.setAttribute('pointer-events', 'none');
      underlay.setAttribute('fill', 'none');
      underlay.setAttribute('stroke', halo);
      underlay.setAttribute('stroke-width', strokeWidth.toFixed(2));
      underlay.setAttribute('stroke-linejoin', 'round');
      underlay.setAttribute('paint-order', 'normal');
      underlay.style?.removeProperty('fill');
      underlay.style?.removeProperty('stroke');
      underlay.style?.removeProperty('stroke-width');
      underlay.style?.removeProperty('paint-order');
      node.parentNode?.insertBefore(underlay, node);
      // A frente mantém a cor individual. O halo é só a borda dos glifos,
      // sem retângulo, fundo escuro ou preenchimento adicional.
      node.setAttribute('fill', color);
      node.setAttribute('stroke', 'none');
      node.setAttribute('stroke-width', '0');
      node.setAttribute('paint-order', 'normal');
      node.setAttribute('data-pdf-outlined', '1');
      node.style?.removeProperty('stroke');
      node.style?.removeProperty('stroke-width');
      node.style?.removeProperty('paint-order');
    });
    return svg;
  }

  function normalizeVectorSvgTypography(svg) {
    if (!svg) return svg;
    const shared = window.SurveyorTechnicalSvgTypography?.normalize;
    if (typeof shared === 'function') shared(svg, { preserveConfrontanteHalo:true, preserveAreaNameHalo:false, context:'pdf-export' });
    else {
      svg.querySelectorAll('text,tspan').forEach((node) => {
        const isConfrontante = node.matches?.('.sv-confrontante-name-text,.sv-confrontante-cpf-text');
        if (!isConfrontante) {
          node.setAttribute('stroke','none');
          node.setAttribute('stroke-width','0');
          node.setAttribute('paint-order','normal');
          node.style?.removeProperty('stroke');
          node.style?.removeProperty('stroke-width');
          node.style?.removeProperty('paint-order');
        }
        const rawWeight = String(node.getAttribute('font-weight') || node.style?.fontWeight || '').trim();
        const numericWeight = Number(rawWeight);
        if (Number.isFinite(numericWeight) && numericWeight > 0) node.setAttribute('font-weight', numericWeight >= 600 ? '700' : '400');
        else if (/bold|bolder/i.test(rawWeight)) node.setAttribute('font-weight', '700');
        node.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
      });
    }
    // Usa uma camada vetorial própria para o halo dos confrontantes, pois a
    // ordem de pintura de stroke/fill não é consistente no conversor PDF.
    return addPrintableConfrontanteOutlines(svg);
  }

  function svgFromHtml(html) {
    const holder = document.createElement('div');
    holder.innerHTML = String(html || '').trim();
    const source = holder.querySelector('svg');
    if (!source) return null;
    const svg = source.cloneNode(true);
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.removeAttribute('style');
    svg.style.background = '#fff';
    svg.querySelectorAll('script').forEach((node) => node.remove());
    stripNonPrintableSvgUi(svg);
    normalizeVectorSvgTypography(svg);
    return svg;
  }

  function svgDimensions(svg) {
    const viewBox = String(svg?.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
      return { width: viewBox[2], height: viewBox[3] };
    }
    const width = parseFloat(svg?.getAttribute('width')) || 1000;
    const height = parseFloat(svg?.getAttribute('height')) || 700;
    return { width, height };
  }

  async function renderVectorSvgPdf({ html, orientation = 'landscape', pageFormat = 'a4', title = 'Documento PDF' }) {
    const JsPdf = window.jspdf?.jsPDF;
    if (!JsPdf) throw new Error('jsPDF não carregado.');
    if (typeof JsPdf.API?.svg !== 'function') await ensureSvgToPdfSupport();
    if (typeof window.jspdf?.jsPDF?.API?.svg !== 'function') throw new Error('Conversor vetorial SVG→PDF não carregado.');
    const svg = svgFromHtml(html);
    if (!svg) throw new Error('Nenhum SVG técnico encontrado para a pré-visualização.');

    const format = normalizePageFormat(pageFormat);
    const size = pageSizeMm(format, orientation);
    const pageWidth = size.width;
    const pageHeight = size.height;
    const margin = 4;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const dims = svgDimensions(svg);
    const scale = Math.min(usableWidth / dims.width, usableHeight / dims.height);
    const drawWidth = dims.width * scale;
    const drawHeight = dims.height * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;

    const doc = new JsPdf({ orientation, unit: 'mm', format, compress: true, putOnlyUsedFonts: true });
    try { doc.setProperties({ title: String(title || 'Documento PDF'), subject: 'Surveyor', creator: 'Surveyor', author: 'Surveyor' }); } catch (_error) {}
    await doc.svg(svg, {
      x,
      y,
      width: drawWidth,
      height: drawHeight
    });
    // Documentos vetoriais marcados como fitOnePage devem ter exatamente uma folha.
    try {
      while (doc.getNumberOfPages() > 1) doc.deletePage(doc.getNumberOfPages());
    } catch (_error) {}
    return { blob: doc.output('blob'), pageImages: [], pageCount: 1, vector: true };
  }

  async function renderPdfDocument(options) {
    if (options?.vectorSvg) return renderVectorSvgPdf(options);
    return renderPdfPages(options);
  }

  async function renderPdfPages({ html, orientation = 'portrait', fitOnePage = false, fitOnePageAlign = 'center', pageFormat = 'a4', title = 'Documento PDF' }) {
    if (!(window.jspdf && window.jspdf.jsPDF && window.html2canvas)) {
      throw new Error('As bibliotecas de PDF não foram carregadas.');
    }

    const landscape = orientation === 'landscape';
    const format = normalizePageFormat(pageFormat);
    const stageWidth = format === 'a3' ? (landscape ? 1584 : 1120) : (landscape ? 1120 : 794);
    const stage = document.createElement('div');
    stage.className = 'surveyor-pdf-render-stage';
    stage.style.cssText = [
      'position:fixed',
      'left:-20000px',
      'top:0',
      `width:${stageWidth}px`,
      'padding:0',
      'margin:0',
      'background:#ffffff',
      'color:#0f172a',
      'z-index:-1',
      'opacity:1',
      'pointer-events:none',
      'box-sizing:border-box'
    ].join(';');
    stage.innerHTML = `<style>
      .surveyor-pdf-render-document{width:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;background:#fff!important;color:#0f172a!important;box-sizing:border-box!important;font-family:Arial,Helvetica,sans-serif!important;font-synthesis:none!important}
      .surveyor-pdf-render-document .preview,
      .surveyor-pdf-render-document .croqui-preview,
      .surveyor-pdf-render-document .planialt-document-preview,
      .surveyor-pdf-render-document .planialt-sheet-svg,
      .surveyor-pdf-render-document .azimuth-sheet,
      .surveyor-pdf-render-document .azimuth-preview,
      .surveyor-pdf-render-document .table-wrap{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important;overflow:visible!important;max-width:none!important}
      .surveyor-pdf-render-document svg{display:block!important;width:100%!important;height:auto!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important;text-rendering:geometricPrecision!important}
      .surveyor-pdf-render-document img{max-width:100%!important;height:auto!important;border:0!important;box-shadow:none!important}
      .surveyor-pdf-render-document table{width:100%!important;border-collapse:collapse!important;margin:0!important;background:#fff!important}
      .surveyor-pdf-render-document button,.surveyor-pdf-render-document .btn,.surveyor-pdf-render-document .link-btn,.surveyor-pdf-render-document .export-menu,.surveyor-pdf-render-document .export-hidden{display:none!important}
    </style><div class="surveyor-pdf-render-document">${html}</div>`;
    document.body.appendChild(stage);
    const renderRoot = stage.querySelector('.surveyor-pdf-render-document');
    if (renderRoot) {
      ['margin','padding','border','border-radius','box-shadow','max-width','min-height'].forEach((prop) => renderRoot.style.setProperty(prop, prop === 'max-width' ? 'none' : (prop === 'min-height' ? '0' : '0'), 'important'));
      renderRoot.style.setProperty('background', '#fff', 'important');
      renderRoot.style.setProperty('overflow', 'visible', 'important');
      renderRoot.querySelectorAll('.preview,.croqui-preview,.planialt-document-preview,.table-wrap').forEach((node) => {
        node.style.setProperty('margin', '0', 'important');
        node.style.setProperty('padding', '0', 'important');
        node.style.setProperty('border', '0', 'important');
        node.style.setProperty('border-radius', '0', 'important');
        node.style.setProperty('box-shadow', 'none', 'important');
        node.style.setProperty('background', '#fff', 'important');
        node.style.setProperty('overflow', 'visible', 'important');
        node.style.setProperty('max-width', 'none', 'important');
        node.style.setProperty('min-height', '0', 'important');
      });
      renderRoot.querySelectorAll('svg').forEach((svg) => {
        svg.style.setProperty('display', 'block', 'important');
        svg.style.setProperty('width', '100%', 'important');
        svg.style.setProperty('height', 'auto', 'important');
        svg.style.setProperty('max-width', 'none', 'important');
        svg.style.setProperty('margin', '0', 'important');
        svg.style.setProperty('padding', '0', 'important');
        svg.style.setProperty('border', '0', 'important');
        svg.style.setProperty('border-radius', '0', 'important');
        svg.style.setProperty('box-shadow', 'none', 'important');
        svg.style.setProperty('background', '#fff', 'important');
      });
    }

    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const canvas = await window.html2canvas(stage, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 12000,
        foreignObjectRendering: false,
        removeContainer: true
      });

      const JsPdf = window.jspdf.jsPDF;
      const doc = new JsPdf({ orientation, unit: 'mm', format, compress: true });
      try { doc.setProperties({ title: String(title || 'Documento PDF'), subject: 'Surveyor', creator: 'Surveyor', author: 'Surveyor' }); } catch (_error) {}
      const size = pageSizeMm(format, orientation);
      const pageWidthMm = size.width;
      const pageHeightMm = size.height;
      const marginMm = fitOnePage ? 4 : 8;
      const printableWidthMm = pageWidthMm - (marginMm * 2);
      const printableHeightMm = pageHeightMm - (marginMm * 2);

      const printableRatio = printableHeightMm / printableWidthMm;
      const pageSliceHeightPx = Math.max(1, Math.floor(canvas.width * printableRatio));
      const pageCount = fitOnePage ? 1 : Math.max(1, Math.ceil(Math.max(1, canvas.height - 2) / pageSliceHeightPx));
      const pageImages = [];
      const renderedPages = [];
      const hasInk = (pageCanvas) => {
        try {
          const ctx = pageCanvas.getContext('2d', { willReadFrequently: true });
          const data = ctx.getImageData(0, 0, pageCanvas.width, pageCanvas.height).data;
          const stride = Math.max(4, Math.floor(Math.min(pageCanvas.width, pageCanvas.height) / 90)) * 4;
          for (let i = 0; i < data.length; i += stride) {
            if (data[i] < 246 || data[i + 1] < 246 || data[i + 2] < 246) return true;
          }
        } catch (_error) { return true; }
        return false;
      };

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageSliceHeightPx;
        const ctx = pageCanvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        if (fitOnePage) {
          const scale = Math.min(pageCanvas.width / canvas.width, pageCanvas.height / canvas.height);
          const drawWidth = Math.max(1, Math.round(canvas.width * scale));
          const drawHeight = Math.max(1, Math.round(canvas.height * scale));
          const dx = Math.round((pageCanvas.width - drawWidth) / 2);
          const dy = fitOnePageAlign === 'top'
            ? 0
            : fitOnePageAlign === 'bottom'
              ? Math.max(0, pageCanvas.height - drawHeight)
              : Math.round((pageCanvas.height - drawHeight) / 2);
          ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, dx, dy, drawWidth, drawHeight);
        } else {
          const sourceY = pageIndex * pageSliceHeightPx;
          const sourceHeight = Math.min(pageSliceHeightPx, canvas.height - sourceY);
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, pageCanvas.width, sourceHeight);
        }

        // Evita a folha branca extra que alguns layouts com page-break adicionavam no final.
        if (pageIndex > 0 && !hasInk(pageCanvas)) continue;
        const pageDataUrl = pageCanvas.toDataURL('image/png');
        pageImages.push(pageDataUrl);
        renderedPages.push(pageDataUrl);
      }

      renderedPages.forEach((pageDataUrl, index) => {
        if (index > 0) doc.addPage(format, orientation);
        doc.addImage(pageDataUrl, 'PNG', marginMm, marginMm, printableWidthMm, printableHeightMm, undefined, 'FAST');
      });

      return { blob: doc.output('blob'), pageImages, pageCount: Math.max(1, renderedPages.length) };
    } finally {
      stage.remove();
    }
  }

  async function applyPdfPreview(previewEl, config, sourceHtmlOverride = '') {
    if (!previewEl) return;
    const requestId = Number(previewEl._surveyorPdfRequestId || 0) + 1;
    previewEl._surveyorPdfRequestId = requestId;
    const sourceHtml = String(sourceHtmlOverride || buildCombinedSourceHtml(config, previewEl) || '');
    const pageFormat = normalizePageFormat(config.pageFormat || document.getElementById('printFormat')?.value || 'a4');
    const signature = hashString(sourceHtml + '|' + config.orientation + '|' + pageFormat + '|' + config.title);
    if (previewEl.dataset.surveyorPdfSignature === signature && previewEl.querySelector('.surveyor-pdf-native-viewer-official')) return;
    previewEl.dataset.surveyorPdfBusy = '1';
    previewEl.classList.add('surveyor-pdf-preview-host');
    if (requestId === previewEl._surveyorPdfRequestId) previewEl.innerHTML = `<div class="surveyor-pdf-preview-loading"><div><strong>Gerando a pré-visualização real do PDF…</strong><br><small>Aguarde enquanto o documento é renderizado.</small></div></div>`;
    try {
      const rendered = await renderPdfDocument({ html: sourceHtml, orientation: config.orientation, fitOnePage: Boolean(config.fitOnePage), fitOnePageAlign: config.fitOnePageAlign || 'center', vectorSvg: Boolean(config.vectorSvg), pageFormat, title: config.title || 'Documento PDF' });
      if (requestId !== previewEl._surveyorPdfRequestId) return { superseded: true };
      const url = mountNativeViewer(previewEl, rendered.blob, { title: config.title || 'Documento PDF' });
      previewEl._surveyorPdfState = { blob: rendered.blob, url, sourceHtml, config: { ...config, pageFormat }, signature, pageCount: rendered.pageCount, vector: Boolean(rendered.vector), pageFormat };
      previewEl.dataset.surveyorPdfSignature = signature;
    } catch (error) {
      console.error('Falha ao gerar pré-visualização real do PDF:', error);
      if (requestId === previewEl._surveyorPdfRequestId) {
        previewEl.innerHTML = `<div class="surveyor-pdf-preview-error"><div><strong>Não foi possível renderizar a pré-visualização real do PDF.</strong><br><small>${escapeHtml(error?.message || 'Erro desconhecido')}</small></div></div><div class="surveyor-pdf-source" hidden aria-hidden="true">${sourceHtml}</div>`;
      }
    } finally {
      if (requestId === previewEl._surveyorPdfRequestId) delete previewEl.dataset.surveyorPdfBusy;
    }
  }

  window.SurveyorPdfPreview = {
    nativeViewerHash,
    normalizeVectorSvg(svg) {
      return normalizeVectorSvgTypography(svg);
    },
    showBlob(target, blob, overrides = {}) {
      const previewEl = typeof target === 'string' ? document.getElementById(target) : target;
      if (!previewEl) return Promise.reject(new Error('Área de pré-visualização não encontrada.'));
      const url = mountNativeViewer(previewEl, blob, overrides);
      previewEl._surveyorPdfState = { ...(previewEl._surveyorPdfState || {}), blob, url, config: { ...(previewEl._surveyorPdfState?.config || {}), ...overrides } };
      return Promise.resolve(previewEl._surveyorPdfState);
    },
    getState(target) {
      const previewEl = typeof target === 'string' ? document.getElementById(target) : target;
      return previewEl?._surveyorPdfState || null;
    },
    reset(target) {
      const previewEl = typeof target === 'string' ? document.getElementById(target) : target;
      if (!previewEl) return;
      previewEl._surveyorPdfRequestId = Number(previewEl._surveyorPdfRequestId || 0) + 1;
      const oldUrl = previewEl._surveyorPdfBlobUrl;
      if (oldUrl) { try { URL.revokeObjectURL(oldUrl); } catch (_error) {} }
      delete previewEl._surveyorPdfBlobUrl;
      delete previewEl._surveyorPdfState;
      delete previewEl.dataset.surveyorPdfSignature;
      delete previewEl.dataset.surveyorPdfBusy;
    },
    renderHtml(target, sourceHtml, overrides = {}) {
      const previewEl = typeof target === 'string' ? document.getElementById(target) : target;
      if (!previewEl) return Promise.reject(new Error('Área de pré-visualização não encontrada.'));
      const pageConfig = getPageConfig();
      const base = pageConfig?.targets?.find?.((item) => item.id === previewEl.id) || {};
      const config = { ...base, ...overrides, id: previewEl.id };
      return applyPdfPreview(previewEl, config, String(sourceHtml || ''));
    },
    renderTarget(id, sourceHtml, overrides = {}) {
      return this.renderHtml(id, sourceHtml, overrides);
    }
  };

  function installForTarget(config) {
    const previewEl = document.getElementById(config.id);
    if (!previewEl) return;
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (previewEl.dataset.surveyorPdfBusy === '1') return;
        if (hasRenderableContent(previewEl)) applyPdfPreview(previewEl, config);
      }, 160);
    });
    observer.observe(previewEl, { childList: true, subtree: true, characterData: true });
    if (hasRenderableContent(previewEl)) applyPdfPreview(previewEl, config);
  }

  function boot() {
    const pageConfig = getPageConfig();
    if (!pageConfig || !Array.isArray(pageConfig.targets)) return;
    pageConfig.targets.forEach(installForTarget);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
