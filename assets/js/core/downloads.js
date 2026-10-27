(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const slug = (value) => String(value || 'documento').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

  function selectedPaperFormat() {
    const value = window.SurveyorPaperFormat?.get?.() || $('printFormat')?.value || 'a4';
    return String(value).toLowerCase() === 'a3' ? 'a3' : 'a4';
  }

  function applySelectedPaperCss(css) {
    const raw = String(css || '');
    if (window.SurveyorPaperFormat?.applyToCss) return window.SurveyorPaperFormat.applyToCss(raw, selectedPaperFormat());
    return selectedPaperFormat() === 'a3' ? raw.replace(/size\s*:\s*A4\b/gi, 'size:A3') : raw;
  }

  function applySelectedPaperHtml(html) {
    const raw = String(html || '');
    if (window.SurveyorPaperFormat?.applyToHtml) return window.SurveyorPaperFormat.applyToHtml(raw, selectedPaperFormat());
    return selectedPaperFormat() === 'a3' ? raw.replace(/size\s*:\s*A4\b/gi, 'size:A3') : raw;
  }

  // O link deve estar no DOM ao ser acionado. Nunca revogar o blob em 1 segundo:
  // no Chromium/Brave, downloads maiores podem continuar lendo a URL após o clique.
  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    if (!blob.size) throw new Error('O arquivo preparado para download está vazio.');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    } finally {
      // Retirar o elemento não invalida a URL entregue ao gerenciador de downloads.
      setTimeout(() => anchor.remove(), 2000);
    }
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_error) {} }, 180000);
    return blob;
  }

  // Salvar o SVG original da cena, sem alterar cadastros, coordenadas ou layout.
  // Reaproveitar o mesmo download robusto usado pelo PDF.
  let latestMapSvg = null;
  function offerMapSvgRetry(filename, blob, sourceSvg) {
    latestMapSvg = { filename, blob, sourceSvg, projectId: String($('projectSelect')?.value || '') };
    document.querySelectorAll('.export-menu .export-menu-list, .sv-prancha-footer-download-menu').forEach((list) => {
      let button = list.querySelector('[data-sv-svg-retry]');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-sv-svg-retry', '1');
        if (list.classList.contains('sv-prancha-footer-download-menu')) {
          button.className = 'sv-prancha-footer-download-item';
          button.innerHTML = '<span>SVG</span><strong>Salvar novamente</strong>';
        } else {
          button.textContent = 'SVG pronto: salvar novamente';
        }
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const current = latestMapSvg;
          const currentSource = String(window.SurveyorPranchaExportSource?.() || '').trim();
          if (!current || !currentSource || current.projectId !== String($('projectSelect')?.value || '') || current.sourceSvg !== currentSource) {
            alert('A prancha ou o projeto mudou. Abra o Download SVG novamente para preparar o arquivo atualizado.');
            return;
          }
          try { download(current.filename, current.blob, 'image/svg+xml;charset=utf-8'); }
          catch (error) { alert(`Não foi possível iniciar o download SVG: ${error?.message || error}`); }
        });
        list.appendChild(button);
      }
      button.hidden = false;
    });
  }

  function saveSvg(filename, sourceSvg) {
    const svg = String(sourceSvg || '').trim();
    if (!/<svg(?:\s|>)/i.test(svg)) throw new Error('SVG inválido ou vazio. Reabra o projeto e tente novamente.');
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    offerMapSvgRetry(filename, blob, svg);
    return download(filename, blob, 'image/svg+xml;charset=utf-8');
  }
  window.SurveyorDocumentDownloads = Object.freeze({ saveSvg });

  function pageTitle() {
    return document.querySelector('h1')?.textContent?.trim() || document.title || 'GeoRural Pro';
  }

  function previewPdfState(id) {
    try { return window.SurveyorPdfPreview?.getState?.(id) || null; } catch { return null; }
  }

  function openBlobPdf(blob, title = 'Documento') {
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug(title)}.pdf`;
      a.click();
    }
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60000);
    return true;
  }


  function hasLocalExportMenu() {
    return Boolean(document.querySelector('.export-menu'));
  }

  function wrapDocument(title, bodyHtml) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#172033;background:#fff;margin:0}h1,h2,h3{color:#102b60}.gr-doc{max-width:1060px;margin:auto;padding:24px}.preview,.croqui-preview{background:#fff!important;text-align:center}.preview svg,.croqui-preview svg{max-width:100%;height:auto!important}.table-wrap{overflow:visible!important}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cbd5e1;padding:6px}.btn,.link-btn,.top,.side,.toast,.gr-export-row{display:none!important}
    </style></head><body><main class="gr-doc">${bodyHtml}</main></body></html>`;
  }


  function openPrintDocument(title, bodyHtml, css = '') {
    const printWindow = window.open('', '_blank', 'width=1100,height=780');
    if (!printWindow) {
      alert('O navegador bloqueou a janela de PDF. Libere pop-ups para baixar/imprimir este documento.');
      return;
    }
    printWindow.addEventListener('load', () => setTimeout(() => printWindow.print(), 350), { once: true });
    printWindow.document.open();
    const finalCss = applySelectedPaperCss(css);
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${finalCss}</style></head><body>${bodyHtml}</body></html>`);
    printWindow.document.close();
  }

  function openPrintHtmlDocument(html, title = 'Documento') {
    const printWindow = window.open('', '_blank', 'width=1100,height=780');
    if (!printWindow) {
      alert('O navegador bloqueou a janela de PDF. Libere pop-ups para baixar/imprimir este documento.');
      return;
    }
    const source = String(html || '');
    const baseHtml = /<html[\s>]/i.test(source)
      ? source
      : `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>${source}</body></html>`;
    const finalHtml = applySelectedPaperHtml(baseHtml);
    printWindow.addEventListener('load', () => setTimeout(() => printWindow.print(), 350), { once: true });
    printWindow.document.open();
    printWindow.document.write(finalHtml);
    printWindow.document.close();
  }

  // Se a tentativa automática for bloqueada/interrompida, um clique humano no
  // menu reutiliza o Blob pronto, sem renderizar outra vez o mapa e o PDF.
  let latestMapPdf = null;
  function offerMapPdfRetry(filename, blob) {
    latestMapPdf = { filename, blob, projectId: String($('projectSelect')?.value || '') };
    const lists = document.querySelectorAll('.export-menu .export-menu-list, .sv-prancha-footer-download-menu');
    lists.forEach((list) => {
      let button = list.querySelector('[data-sv-pdf-retry]');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-sv-pdf-retry', '1');
        if (list.classList.contains('sv-prancha-footer-download-menu')) {
          button.className = 'sv-prancha-footer-download-item';
          button.innerHTML = '<span>PDF</span><strong>Salvar novamente</strong>';
        } else {
          button.textContent = 'PDF pronto: salvar novamente';
        }
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const ready = latestMapPdf;
          const current = previewPdfState('mapPreview');
          if (!ready || ready.projectId !== String($('projectSelect')?.value || '') || current?.blob !== ready.blob) {
            alert('O documento mudou. Gere novamente o PDF antes de salvar.');
            return;
          }
          try { download(ready.filename, ready.blob, 'application/pdf'); }
          catch (error) { alert(`Não foi possível iniciar o download: ${error?.message || error}`); }
        });
        list.appendChild(button);
      }
      button.hidden = false;
    });
  }

  async function preparedMapDocumentSvg(preview) {
    const prepare=window.SurveyorPranchaExportSourceReady;
    if (typeof prepare === 'function') return String(await prepare() || '').trim();
    const state=previewPdfState('mapPreview');
    return String(state?.sourceHtml || preview?.querySelector?.('svg')?.outerHTML || '').trim();
  }

  async function isolatedMapPdf() {
    const page = document.body?.dataset?.page || '';
    const title = page === 'pranchas.html' ? 'Prancha técnica' : 'Mapa e croqui';
    const preview = $('mapPreview');
    if (!preview) return alert('Área de pré-visualização indisponível.');

    try {
      const sourceHtml=await preparedMapDocumentSvg(preview);
      if (!/<svg[\s>]/i.test(sourceHtml)) return alert(page === 'pranchas.html' ? 'Selecione um projeto para disponibilizar o PDF.' : 'Gere o croqui primeiro.');
      let state=previewPdfState('mapPreview');
      const requestedFormat=selectedPaperFormat();
      // A prévia nativa pode guardar um Blob antigo. Só reutilizá-lo quando
      // o SVG preparado e o formato correspondem exatamente à fonte atual.
      if (!state?.blob || state.sourceHtml !== sourceHtml || state.pageFormat !== requestedFormat) {
        if (!window.SurveyorPdfPreview?.renderHtml) throw new Error('O gerador de PDF não está disponível.');
        await window.SurveyorPdfPreview.renderHtml(preview, sourceHtml, {
          orientation: 'landscape', title, fitOnePage: true, pageFormat:requestedFormat
        });
        state=previewPdfState('mapPreview');
      }
      if (state?.sourceHtml !== sourceHtml || state?.pageFormat !== requestedFormat) {
        throw new Error('A prévia não corresponde à versão atual do documento. Gere novamente antes de baixar.');
      }

      if (!(state?.blob instanceof Blob) || !state.blob.size) {
        return alert('O PDF não foi preparado corretamente. Confira a prévia e tente novamente.');
      }
      const projectName = $('projectSelect')?.selectedOptions?.[0]?.textContent?.trim() || $('mapTitle')?.value?.trim() || title;
      const suffix = page === 'pranchas.html' ? 'prancha-tecnica' : 'mapa-croqui';
      const filename = `${slug(projectName)}-${suffix}.pdf`;
      // Exibir a alternativa primeiro: alguns navegadores bloqueiam downloads
      // iniciados depois de uma geração assíncrona, sem gesto direto do usuário.
      offerMapPdfRetry(filename, state.blob);
      download(filename, state.blob, 'application/pdf');
    } catch (error) {
      console.error('[SURVEYOR] Falha ao baixar PDF da planta:', error);
      alert(`Falha ao preparar ou iniciar o download do PDF: ${error?.message || error}`);
    }
  }

  function isolatedLetterPdf() {
    const output = $('letterOutput');
    const html = output?.innerHTML?.trim() || '';
    if (!html || /Preencha os dados e gere a carta/i.test(output?.textContent || '')) return alert('Gere a carta primeiro.');
    const body = `<main class="letter-pdf-sheet">${printableHtml(output)}</main>`;
    const css = `
      @page{size:A4 portrait;margin:18mm 18mm 16mm}
      *{box-sizing:border-box}
      body{margin:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.55}
      .letter-pdf-sheet{max-width:${selectedPaperFormat()==='a3'?'267mm':'180mm'};margin:0 auto;background:#fff;color:#111827}
      h1{font-size:18pt;text-align:center;margin:0 0 18px;color:#111827}
      h2,h3{color:#111827;margin:16px 0 8px}
      p{margin:0 0 12px;text-align:justify}
      table{width:100%;border-collapse:collapse}
      td,th{border:1px solid #cbd5e1;padding:6px;vertical-align:top}
      img,svg{max-width:100%;height:auto}
      .btn,.link-btn,button,input,select,textarea{display:none!important}
      @media print{body{background:#fff}.letter-pdf-sheet{max-width:none}}
    `;
    openPrintDocument('Carta de confrontação', body, css);
  }

  function replaceButtonAction(id, handler) {
    const oldButton = $(id);
    if (!oldButton || oldButton.dataset.cleanPdfHandler === 'true') return;
    const button = oldButton.cloneNode(true);
    button.dataset.cleanPdfHandler = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler(event);
    });
    oldButton.replaceWith(button);
  }

  function installCleanPdfHandlers() {
    const page = document.body?.dataset?.page || '';
    if (page === 'mapas.html' || page === 'pranchas.html') replaceButtonAction('printPreviewV19', isolatedMapPdf);
    if (page === 'confrontacao.html') replaceButtonAction('printOutput', isolatedLetterPdf);
  }

  function printableHtml(target) {
    const clone = target.cloneNode(true);
    clone.querySelectorAll('button,.btn,.link-btn,input,select,textarea').forEach((node) => {
      if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
        const span = document.createElement('span');
        span.textContent = node.value || node.placeholder || '';
        node.replaceWith(span);
      } else if (node.tagName === 'SELECT') {
        const span = document.createElement('span');
        span.textContent = node.selectedOptions?.[0]?.textContent || node.value || '';
        node.replaceWith(span);
      } else {
        node.remove();
      }
    });
    return clone.innerHTML;
  }

  function findOutput() {
    const preferred = [
      'memorialOutput', 'mapPreview', 'azimuthPreview', 'environmentOutput', 'elevationPreview',
      'letterOutput', 'carReportPreview', 'lotPreview', 'odsStatus'
    ];
    for (const id of preferred) {
      const el = $(id);
      if (el && el.textContent.trim()) return el;
    }
    return document.querySelector('.preview,.output,.table-wrap,main');
  }

  function hasRealContent(target) {
    const text = target?.textContent?.trim() || '';
    const html = target?.innerHTML || '';
    return /<svg|<table|<article|<h1|<p|<div|<section/i.test(html) && text.length > 12;
  }

  function ensureExportRow(anchorTarget) {
    const page = document.body?.dataset?.page || '';
    if (page === 'planialtimetria.html') {
      const finalSection = document.querySelector('.sv-doc-config-card .sv-step-section-final, .sv-doc-config-card .sv-doc-final-step');
      const preferredHost = finalSection?.querySelector('.sv-planialt-utility-host') || finalSection?.querySelector('.sv-doc-final-extras') || finalSection;
      if (preferredHost) {
        let row = preferredHost.querySelector(':scope > .gr-export-row') || document.querySelector('.gr-export-row');
        if (!row) {
          row = document.createElement('div');
          row.className = 'gr-export-row';
        }
        if (row.parentElement !== preferredHost) preferredHost.appendChild(row);
        return row;
      }
    }
    const panel = anchorTarget?.closest?.('.panel') || document.querySelector('main') || document.body;
    let row = panel.querySelector(':scope > .gr-export-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'gr-export-row';
      const firstPreview = panel.querySelector('.preview,.output,.table-wrap') || anchorTarget;
      firstPreview?.before(row);
    }
    return row;
  }

  function installGenericExport() {
    if (document.body?.dataset?.page === 'memorial.html') return;
    if (document.body?.dataset?.page === 'ods.html') return;
    if (hasLocalExportMenu()) return;
    const target = findOutput();
    if (!target || $('grDownloadGlobalMenu')) return;
    const row = ensureExportRow(target);
    const menu = document.createElement('div');
    menu.className = 'gr-download-menu';
    menu.id = 'grDownloadGlobalMenu';
    menu.innerHTML = `<button class="btn" type="button">Download ▾</button><div class="gr-download-menu-list"><button type="button" data-format="word">Word editável</button><button type="button" data-format="pdf">PDF / imprimir</button></div>`;
    menu.querySelector('[data-format="word"]').onclick = () => {
      const output = findOutput();
      if (!hasRealContent(output)) return alert('Gere o conteúdo primeiro.');
      const title = pageTitle();
      download(`${slug(title)}.doc`, wrapDocument(title, printableHtml(output)), 'application/msword;charset=utf-8');
    };
    menu.querySelector('[data-format="pdf"]').onclick = () => window.print();
    row.append(menu);
  }

  function installPreviewZoom() {
    if (document.body?.dataset?.page === 'memorial.html') return;
    if (hasLocalExportMenu()) return;
    const target = findOutput();
    if (!target || $('grOutputZoom')) return;
    const row = ensureExportRow(target);
    const label = document.createElement('label');
    label.className = 'gr-output-zoom';
    label.innerHTML = 'Zoom visual <select id="grOutputZoom"><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15" selected>15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option><option value="20">20</option></select>';
    row.append(label);
    const apply = () => {
      const output = findOutput();
      if (!output) return;
      output.classList.add('gr-export-scaled');
      output.className = output.className.replace(/\bgr-preview-zoom-\d+\b/g, '').trim();
      output.classList.add(`gr-preview-zoom-${$('grOutputZoom').value}`);
    };
    $('grOutputZoom').addEventListener('change', apply);
    apply();
  }



  function azimuthReportContent(options = {}) {
    const official = window.SurveyorAzimuthDocument?.getHtml?.();
    if (official && String(official).trim()) return String(official).replace(/^\s*<style>[\s\S]*?<\/style>\s*/i, '');
    const preview = $('azimuthPreview');
    const state = previewPdfState('azimuthPreview');
    const sourceHtml = String(state?.sourceHtml || '');
    const previewSvg = preview?.querySelector?.('svg');
    const extractedSvg = sourceHtml.match(/<svg[\s\S]*?<\/svg>/i)?.[0] || '';
    const svgText = (previewSvg?.outerHTML || extractedSvg || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    if (!svgText) return null;
    const table = $('azimuthTable')?.closest('table');
    const title = $('azProjectName')?.value?.trim() || 'Perímetro por azimute';
    const selectedProject = $('projectSelect')?.selectedOptions?.[0]?.textContent?.trim() || '';
    const area = $('azArea')?.textContent?.trim() || '—';
    const perimeter = $('azDistance')?.textContent?.trim() || '—';
    const vertices = $('azVertices')?.textContent?.trim() || '—';
    const closure = $('azClosure')?.textContent?.trim() || '—';
    const header = window.GeoRuralDocumentTheme?.headerHtml?.('Surveyor') || '';
    const footer = window.GeoRuralDocumentTheme?.footerHtml?.() || '';
    const drawing = options.inlineSvg
      ? `<div class="az-report-drawing-svg">${svgText}</div>`
      : `<img class="az-report-drawing-img" alt="Desenho técnico do perímetro" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}">`;
    const tableHtml = table ? table.outerHTML : '<table><tbody></tbody></table>';
    return `
      <main class="az-report-sheet">
        ${header}
        <h1>RELATÓRIO DE PERÍMETRO POR AZIMUTE</h1>
        <section class="az-report-meta">
          <div><strong>IMÓVEL:</strong> ${esc(title)}</div>
          <div><strong>PROJETO:</strong> ${esc(selectedProject || title)}</div>
          <div><strong>ÁREA:</strong> ${esc(area)}</div>
          <div><strong>PERÍMETRO:</strong> ${esc(perimeter)}</div>
          <div><strong>VÉRTICES:</strong> ${esc(vertices)}</div>
          <div><strong>FECHAMENTO:</strong> ${esc(closure)}</div>
        </section>
        <section class="az-report-drawing-block">
          <h2>Desenho técnico do perímetro</h2>
          ${drawing}
        </section>
        <section class="az-report-table-block">
          <h2>Planilha de azimutes e distâncias</h2>
          ${tableHtml}
        </section>
        ${footer}
      </main>`;
  }

  function azimuthReportCss() {
    return `
      @page{size:A4 portrait;margin:11mm 12mm 12mm}
      *{box-sizing:border-box}
      body{margin:0;background:#fff;color:#061735;font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.35}
      .az-report-sheet{max-width:${selectedPaperFormat()==='a3'?'270mm':'186mm'};margin:0 auto;background:#fff;color:#061735}
      .georural-custom-header{margin-bottom:14px!important;padding-bottom:12px!important}
      .az-report-sheet h1{text-align:center;font-size:17pt;letter-spacing:1.2px;margin:12px 0 16px;color:#061735}
      .az-report-sheet h2{font-size:12.5pt;margin:0 0 8px;color:#061735}
      .az-report-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:0 0 12px;font-size:10.5pt}
      .az-report-meta strong{font-weight:850}
      .az-report-drawing-block{margin:8px 0 12px;break-inside:avoid;page-break-inside:avoid}
      .az-report-drawing-img{display:block;width:100%;max-height:${selectedPaperFormat()==='a3'?'205mm':'132mm'};object-fit:contain;border:1px solid #cbd5e1;background:#f8fafc}
      .az-report-drawing-svg svg{display:block;width:100%;max-height:${selectedPaperFormat()==='a3'?'205mm':'132mm'};height:auto;border:1px solid #cbd5e1;background:#f8fafc}
      .az-report-table-block{margin-top:10px}
      table{width:100%;border-collapse:collapse;font-size:9pt;background:#fff}
      th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:left;vertical-align:top}
      th{background:#0f63e9;color:#fff;font-weight:850}tbody tr:nth-child(even){background:#eef5ff}
      .az-report-note{margin-top:10px;padding:9px 11px;border-left:4px solid #0f5bdc;border-radius:8px;background:#eff6ff;color:#0f254c;font-size:9.5pt}
      .georural-custom-footer{margin-top:14px!important}
      @media print{body{background:#fff}.az-report-sheet{max-width:none}.az-report-drawing-block,.az-report-table-block{break-inside:avoid;page-break-inside:avoid}}
    `;
  }

  function isolatedAzimuthPdf() {
    const state = previewPdfState('azimuthPreview');
    if (state?.blob) {
      openBlobPdf(state.blob, 'Relatório de perímetro por azimute');
      return;
    }
    const body = azimuthReportContent({ inlineSvg: false });
    if (!body) return alert('Calcule o perímetro primeiro.');
    openPrintDocument('Relatório de perímetro por azimute', body, azimuthReportCss());
  }

  function downloadAzimuthWord() {
    const official = window.SurveyorAzimuthDocument?.getHtml?.();
    const body = official || azimuthReportContent({ inlineSvg: true });
    if (!body) return alert('Calcule o perímetro primeiro.');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de perímetro por azimute</title>${official ? '' : `<style>${azimuthReportCss()}</style>`}</head><body>${body}</body></html>`;
    download(`${slug($('azProjectName')?.value || 'perimetro-azimute')}.doc`, html, 'application/msword;charset=utf-8');
  }

  function patchKnownButtons() {
    const mapSvg = $('downloadSvgV19');
    if (mapSvg && !$('downloadMapWordV197')) {
      const btn = document.createElement('button');
      btn.className = 'btn gr-export-source-hidden'; btn.id = 'downloadMapWordV197'; btn.type = 'button'; btn.textContent = 'Baixar Word';
      btn.onclick = async () => {
        const page=document.body?.dataset?.page || '';
        try {
          const html=await preparedMapDocumentSvg($('mapPreview'));
          if (!/<svg[\s>]/i.test(html)) throw new Error(page === 'pranchas.html' ? 'Selecione um projeto para disponibilizar o Word.' : 'Gere o croqui primeiro.');
          download(`${slug($('mapTitle')?.value || (page === 'pranchas.html' ? 'prancha-tecnica' : 'croqui'))}.doc`, wrapDocument(page === 'pranchas.html' ? 'Prancha técnica' : 'Croqui técnico', html), 'application/msword;charset=utf-8');
        } catch (error) { alert(`Falha ao preparar o Word: ${error?.message || error}`); }
      };
      mapSvg.after(btn);
    }
    const az = $('downloadAzimuthGeojson');
    if (az && !$('downloadAzimuthWordV197')) {
      const word = document.createElement('button');
      word.className = 'btn gr-export-source-hidden'; word.id = 'downloadAzimuthWordV197'; word.type = 'button'; word.textContent = 'Baixar Word';
      word.onclick = downloadAzimuthWord;
      const pdf = document.createElement('button');
      pdf.className = 'btn gr-export-source-hidden'; pdf.id = 'printAzimuthV197'; pdf.type = 'button'; pdf.textContent = 'Baixar PDF';
      pdf.onclick = isolatedAzimuthPdf;
      az.after(word, pdf);
    }
    const car = $('downloadCarReport');
    if (car && !$('downloadCarWordV197')) {
      const word = document.createElement('button');
      word.className = 'btn gr-export-source-hidden'; word.id = 'downloadCarWordV197'; word.type = 'button'; word.textContent = 'Baixar Word';
      word.onclick = () => {
        const full = window.__SurveyorCarReportHtml || '';
        const html = full || $('carReportPreview')?.innerHTML || '';
        if (!html.trim() || /Gere o relatório/i.test(html)) return alert('Gere o relatório primeiro.');
        download('relatorio-car.doc', full || wrapDocument('Relatório CAR', html), 'application/msword;charset=utf-8');
      };
      const pdf = document.createElement('button');
      pdf.className = 'btn gr-export-source-hidden'; pdf.id = 'downloadCarPdfV197'; pdf.type = 'button'; pdf.textContent = 'Baixar PDF';
      pdf.onclick = () => {
        const full = window.__SurveyorCarReportHtml || '';
        const html = full || $('carReportPreview')?.innerHTML || '';
        if (!html.trim() || /Gere o relatório/i.test(html)) return alert('Gere o relatório primeiro.');
        openPrintHtmlDocument(full || wrapDocument('Relatório CAR', html), 'Relatório CAR');
      };
      car.after(word, pdf);
    }
  }


  function sheetReportContent() {
    const table = document.querySelector('#sheet-vertices .georef-table');
    const selectedProject = $('sheetProjectSelect')?.selectedOptions?.[0]?.textContent?.trim() || '';
    if (!table || !selectedProject || !table.querySelector('tbody tr')) return null;
    const cleanTable = table.cloneNode(true);
    cleanTable.removeAttribute('id');
    cleanTable.querySelectorAll('[id]').forEach((node)=>node.removeAttribute('id'));
    const themeHeader = window.GeoRuralDocumentTheme?.headerHtml?.('Surveyor') || '';
    const themeFooter = window.GeoRuralDocumentTheme?.footerHtml?.() || '';
    return `<main class="sheet-pdf-document">
      ${themeHeader}
      <header class="sheet-pdf-title">
        <h1>PLANILHA DE COORDENADAS DO PROJETO</h1>
        <div class="sheet-pdf-meta">
          <div class="sheet-pdf-project"><span>PROJETO</span><strong>${esc(selectedProject)}</strong></div>
          <div><span>ÁREA</span><strong>${esc($('sheetArea')?.textContent || '0,0000')} ha</strong></div>
          <div><span>PERÍMETRO</span><strong>${esc($('sheetPerimeter')?.textContent || '0,00')} m</strong></div>
          <div><span>FORMATO</span><strong>${esc($('coordinateFormat')?.selectedOptions?.[0]?.textContent || 'SIGEF')}</strong></div>
        </div>
      </header>
      <section class="sheet-pdf-table-wrap">${cleanTable.outerHTML}</section>
      <p class="sheet-pdf-note">Documento técnico gerado pelo Surveyor a partir do perímetro cadastrado no projeto.</p>
      ${themeFooter}
    </main>`;
  }

  function sheetReportCss() {
    return `
      @page{size:A4 landscape;margin:8mm 8mm 9mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif}
      body{font-size:8pt;line-height:1.25}
      .sheet-pdf-document{width:100%;margin:0 auto;background:#fff}
      .georural-custom-header{margin:0 0 4mm!important;padding:0 0 3mm!important;break-inside:avoid;page-break-inside:avoid}
      .georural-custom-header img{max-height:17mm!important;width:auto!important}
      .sheet-pdf-title{break-inside:avoid;page-break-inside:avoid;margin-bottom:4mm}
      .sheet-pdf-title h1{margin:0 0 3mm;text-align:center;font-size:15pt;letter-spacing:.6pt;color:#102b60}
      .sheet-pdf-meta{display:grid;grid-template-columns:minmax(0,2.6fr) repeat(3,minmax(0,1fr));gap:2.5mm}
      .sheet-pdf-meta>div{border:1px solid #cbd5e1;border-radius:2mm;padding:2.2mm 2.6mm;min-height:13mm;background:#f8fafc}
      .sheet-pdf-meta span{display:block;font-size:6.5pt;font-weight:800;letter-spacing:.35pt;color:#64748b;margin-bottom:.8mm}
      .sheet-pdf-meta strong{display:block;font-size:8.5pt;line-height:1.2;color:#0f172a;overflow-wrap:anywhere}
      .sheet-pdf-table-wrap{width:100%;overflow:visible}
      .sheet-pdf-table-wrap table{width:100%!important;min-width:0!important;border-collapse:collapse;table-layout:fixed;background:#fff;font-size:6.7pt}
      .sheet-pdf-table-wrap thead{display:table-header-group}
      .sheet-pdf-table-wrap tr{break-inside:avoid;page-break-inside:avoid}
      .sheet-pdf-table-wrap th,.sheet-pdf-table-wrap td{border:1px solid #94a3b8;padding:1.55mm 1.2mm;text-align:left;vertical-align:middle;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      .sheet-pdf-table-wrap th{background:#0f63e9;color:#fff;font-size:6.5pt;font-weight:850;line-height:1.1}
      .sheet-pdf-table-wrap tbody tr:nth-child(even) td{background:#f8fafc}
      .sheet-pdf-table-wrap th:nth-child(1),.sheet-pdf-table-wrap td:nth-child(1){width:8%}
      .sheet-pdf-table-wrap th:nth-child(2),.sheet-pdf-table-wrap td:nth-child(2){width:11%}
      .sheet-pdf-table-wrap th:nth-child(3),.sheet-pdf-table-wrap td:nth-child(3){width:11%}
      .sheet-pdf-table-wrap th:nth-child(4),.sheet-pdf-table-wrap td:nth-child(4){width:11%}
      .sheet-pdf-table-wrap th:nth-child(5),.sheet-pdf-table-wrap td:nth-child(5){width:12%}
      .sheet-pdf-table-wrap th:nth-child(6),.sheet-pdf-table-wrap td:nth-child(6){width:7%}
      .sheet-pdf-table-wrap th:nth-child(7),.sheet-pdf-table-wrap td:nth-child(7){width:8%}
      .sheet-pdf-table-wrap th:nth-child(8),.sheet-pdf-table-wrap td:nth-child(8){width:9%}
      .sheet-pdf-table-wrap th:nth-child(9),.sheet-pdf-table-wrap td:nth-child(9){width:12%}
      .sheet-pdf-table-wrap th:nth-child(10),.sheet-pdf-table-wrap td:nth-child(10){width:11%}
      .sheet-pdf-note{margin:3mm 0 0;text-align:right;color:#64748b;font-size:6.5pt}
      .georural-custom-footer{margin:4mm 0 0!important;padding-top:2.5mm!important;font-size:6.5pt!important;break-inside:avoid;page-break-inside:avoid}
      button,.btn,.link-btn,input,select,textarea,.table-wrap::-webkit-scrollbar{display:none!important}
      @media print{.sheet-pdf-document{width:auto}.sheet-pdf-table-wrap table{page-break-inside:auto}}
    `;
  }

  function isolatedSheetPdf() {
    const body = sheetReportContent();
    if (!body) return alert('Selecione um projeto com vértices antes de gerar o PDF.');
    openPrintDocument('Planilha de coordenadas do projeto', body, sheetReportCss());
  }

  function installSheetDownloadMenu() {
    if (document.body?.dataset?.page !== 'ods.html') return;
    const trigger = (id) => {
      const el = $(id);
      if (!el) return alert('Formato indisponível nesta tela.');
      el.click();
    };
    $('sheetDownloadXlsx')?.addEventListener('click', () => trigger('downloadXlsx'));
    $('sheetDownloadOds')?.addEventListener('click', () => trigger('generateOds'));
    $('sheetDownloadKml')?.addEventListener('click', () => trigger('downloadKmlSheet'));
    $('sheetDownloadWord')?.addEventListener('click', () => {
      const body=sheetReportContent();
      if (!body) return alert('Selecione um projeto com vértices primeiro.');
      const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Planilha de coordenadas do projeto</title><style>${sheetReportCss()}</style></head><body>${body}</body></html>`;
      download(`${slug($('sheetProjectSelect')?.selectedOptions?.[0]?.textContent || 'planilha-do-projeto')}.doc`, html, 'application/msword;charset=utf-8');
    });
    $('sheetDownloadPdf')?.addEventListener('click', isolatedSheetPdf);
  }

  function install() {
    installCleanPdfHandlers();
    patchKnownButtons();
    if (hasLocalExportMenu()) {
      document.querySelectorAll('.gr-export-row').forEach((row) => row.remove());
    }
    installGenericExport();
    installPreviewZoom();
    installSheetDownloadMenu();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 250));
  else setTimeout(install, 250);
})();
