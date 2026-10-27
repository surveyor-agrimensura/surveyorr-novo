(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {};

  let originalPdfBytes = null;
  let currentPdfBytes = null;
  let originalPdfName = '';
  let signedBlob = null;
  let signedFileName = '';
  let pageCount = 0;
  let signatureDataUrl = '';
  let signatureAspectRatio = 2.9;
  let previewDoc = null;
  let renderToken = 0;
  let stampPointerId = null;
  let stampPosition = { x: 0.5, y: 0.86 };
  let signatureApplyCount = 0;

  function toast(message, type = 'info') {
    const fn = window.SurveyorToast || window.GeoRuralSuite?.toast;
    if (typeof fn === 'function') return fn(message, type);
    const host = $('suiteToast');
    if (!host) return;
    host.textContent = message;
    host.className = `toast show ${type}`;
    clearTimeout(host._timer);
    host._timer = setTimeout(() => { host.className = 'toast'; }, 3200);
  }

  function humanSize(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 2)} MB`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setDocumentStatus(text, state = 'idle') {
    els.documentStatus.textContent = text;
    els.documentStatus.dataset.state = state;
  }

  function setReviewState(text) {
    els.reviewState.textContent = text;
  }

  function setViewerState(state) {
    els.viewerShell.dataset.state = state;
    const ready = state === 'ready';
    els.viewerEmpty.hidden = ready;
    els.canvasStage.hidden = !ready;
    els.reviewFooter.hidden = !ready;
  }

  function resetSignedState() {
    signedBlob = null;
    signedFileName = '';
    signatureApplyCount = 0;
    els.download.disabled = true;
    els.applyMore.disabled = true;
    setReviewState('Documento pronto para revisão.');
  }

  async function sha256(bytes) {
    try {
      const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const digest = await crypto.subtle.digest('SHA-256', source);
      return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    } catch (_error) {
      return '';
    }
  }

  function populatePages(count) {
    els.pageSelect.innerHTML = '';
    for (let index = 1; index <= count; index += 1) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `Página ${index}`;
      els.pageSelect.appendChild(option);
    }
    els.pageSelect.value = count ? '1' : '';
    els.pageSelect.disabled = !count;
  }

  function defaultPlacementFor(position) {
    const presets = {
      'bottom-left': { x: 0.18, y: 0.86 },
      'bottom-center': { x: 0.5, y: 0.86 },
      'bottom-right': { x: 0.82, y: 0.86 }
    };
    return presets[position] || presets['bottom-center'];
  }

  function enableControls() {
    const hasPdf = Boolean(currentPdfBytes && pageCount);
    const hasSignature = Boolean(signatureDataUrl);
    els.position.disabled = !hasPdf;
    els.size.disabled = !hasPdf;
    els.pageSelect.disabled = !hasPdf;
    els.apply.disabled = !(hasPdf && hasSignature);
    els.applyMore.disabled = !(hasPdf && hasSignature && signatureApplyCount > 0);
    els.fullscreen.disabled = !hasPdf;
    if (hasPdf && !hasSignature) {
      els.apply.title = 'Cadastre uma assinatura em Personalização para continuar.';
    } else {
      els.apply.title = '';
    }
  }

  function ensurePdfJs() {
    if (!window.pdfjsLib) throw new Error('Biblioteca de pré-visualização indisponível.');
    if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  function getStampPixels() {
    const canvasRect = els.mainCanvas.getBoundingClientRect();
    const width = els.mainCanvas.clientWidth || canvasRect.width || els.mainCanvas.width || 0;
    const height = els.mainCanvas.clientHeight || canvasRect.height || els.mainCanvas.height || 0;
    const percent = clamp(Number(els.size.value) || 24, 12, 38);
    const stampWidth = Math.max(72, width * (percent / 100));
    const stampHeight = stampWidth / Math.max(0.25, signatureAspectRatio);
    return { width, height, stampWidth, stampHeight };
  }

  function renderStampOverlay() {
    if (!signatureDataUrl || els.canvasStage.hidden || els.mainCanvas.hidden) {
      els.mainStamp.hidden = true;
      return;
    }
    const canvasRect = els.mainCanvas.getBoundingClientRect();
    const stageRect = els.canvasStage.getBoundingClientRect();
    const { width, height, stampWidth, stampHeight } = getStampPixels();
    if (!width || !height) {
      els.mainStamp.hidden = true;
      return;
    }
    const stageLeft = canvasRect.left - stageRect.left;
    const stageTop = canvasRect.top - stageRect.top;
    els.mainStamp.style.width = `${stampWidth}px`;
    els.mainStamp.style.height = `${stampHeight}px`;
    els.mainStamp.style.left = `${stageLeft + (stampPosition.x * width)}px`;
    els.mainStamp.style.top = `${stageTop + (stampPosition.y * height)}px`;
    els.mainStamp.hidden = false;
  }

  function setStampPosition(xRatio, yRatio) {
    stampPosition.x = clamp(Number.isFinite(xRatio) ? xRatio : 0.5, 0.02, 0.98);
    stampPosition.y = clamp(Number.isFinite(yRatio) ? yRatio : 0.5, 0.02, 0.98);
    renderStampOverlay();
  }

  function updateStampFromPointer(clientX, clientY) {
    if (els.canvasStage.hidden || els.mainCanvas.hidden) return;
    const canvasRect = els.mainCanvas.getBoundingClientRect();
    const relX = clamp((clientX - canvasRect.left) / Math.max(1, canvasRect.width), 0, 1);
    const relY = clamp((clientY - canvasRect.top) / Math.max(1, canvasRect.height), 0, 1);
    setStampPosition(relX, relY);
  }

  async function getPreviewDoc() {
    if (!currentPdfBytes) return null;
    ensurePdfJs();
    if (!previewDoc) {
      previewDoc = await window.pdfjsLib.getDocument({ data: currentPdfBytes.slice(0) }).promise;
    }
    return previewDoc;
  }

  async function renderCurrentPage() {
    const token = ++renderToken;
    if (!currentPdfBytes || !pageCount) {
      setViewerState('empty');
      els.mainCanvas.hidden = true;
      els.mainStamp.hidden = true;
      return;
    }
    try {
      const doc = await getPreviewDoc();
      const pageNumber = clamp(Number(els.pageSelect.value) || 1, 1, pageCount);
      const page = await doc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const maxWidth = Math.max(320, els.viewerShell.clientWidth - 44);
      const maxHeight = Math.max(540, els.viewerShell.clientHeight - 44);
      const scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
      const viewport = page.getViewport({ scale });
      if (token !== renderToken) return;
      els.mainCanvas.width = Math.ceil(viewport.width);
      els.mainCanvas.height = Math.ceil(viewport.height);
      const context = els.mainCanvas.getContext('2d', { alpha: false });
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, els.mainCanvas.width, els.mainCanvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      if (token !== renderToken) return;
      setViewerState('ready');
      els.mainCanvas.hidden = false;
      renderStampOverlay();
    } catch (error) {
      console.error('[Assinatura digital] Falha ao renderizar página:', error);
      setViewerState('empty');
      els.mainCanvas.hidden = true;
      els.mainStamp.hidden = true;
      toast('Não foi possível renderizar o PDF.', 'error');
    }
  }

  async function loadThemeIdentity() {
    try {
      await window.GeoRuralDocumentTheme?.load?.({ forceRefresh: true });
    } catch (_error) {}
    const theme = window.GeoRuralDocumentTheme?.get?.() || {};
    signatureDataUrl = String(window.GeoRuralDocumentTheme?.getSignature?.() || theme.planDocumentSignatureDataUrl || '');
    const technician = String(theme.responsibleTechnician || '').trim();
    const registry = String(theme.professionalRegistry || '').trim();
    const title = String(theme.professionalTitle || '').trim();
    els.techName.textContent = technician || 'Responsável técnico';
    els.techRegistry.textContent = [title, registry].filter(Boolean).join(' • ') || 'Dados da Personalização';

    if (signatureDataUrl) {
      els.savedImage.src = signatureDataUrl;
      els.savedImage.hidden = false;
      els.missingMark.hidden = true;
      els.identityHelp.textContent = 'Assinatura cadastrada e pronta para ser aplicada ao documento.';
      els.mainStamp.src = signatureDataUrl;
      const tempImg = new Image();
      tempImg.onload = () => {
        signatureAspectRatio = (tempImg.naturalWidth || 290) / Math.max(1, tempImg.naturalHeight || 100);
        renderStampOverlay();
      };
      tempImg.src = signatureDataUrl;
    } else {
      els.savedImage.removeAttribute('src');
      els.savedImage.hidden = true;
      els.missingMark.hidden = false;
      els.identityHelp.textContent = 'Nenhuma assinatura foi encontrada. Cadastre a imagem da assinatura em Personalização.';
      els.mainStamp.removeAttribute('src');
      els.mainStamp.hidden = true;
    }

    enableControls();
  }

  async function loadPdfFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name || '') && file.type !== 'application/pdf') {
      setDocumentStatus('Selecione um arquivo PDF válido.', 'error');
      toast('Selecione um arquivo PDF.', 'error');
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setDocumentStatus('O PDF excede o limite de 40 MB.', 'error');
      toast('O PDF é maior que 40 MB.', 'error');
      return;
    }

    try {
      setDocumentStatus('Carregando documento…', 'idle');
      if (!window.PDFLib?.PDFDocument) throw new Error('Biblioteca de PDF indisponível.');
      const buffer = await file.arrayBuffer();
      const pdfDoc = await window.PDFLib.PDFDocument.load(buffer, { ignoreEncryption: false });
      originalPdfBytes = new Uint8Array(buffer);
      currentPdfBytes = new Uint8Array(buffer);
      originalPdfName = file.name || 'documento.pdf';
      pageCount = pdfDoc.getPageCount();
      previewDoc = null;
      populatePages(pageCount);
      const preset = defaultPlacementFor(els.position.value);
      stampPosition = { ...preset };
      resetSignedState();
      els.fileName.textContent = originalPdfName;
      els.fileMeta.textContent = `${humanSize(file.size)} • ${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}`;
      setDocumentStatus('Documento carregado com sucesso.', 'success');
      enableControls();
      await renderCurrentPage();
      const hash = await sha256(currentPdfBytes);
      els.hash.textContent = hash ? `SHA-256 ${hash.slice(0, 16)}…` : '';
      toast('PDF carregado para revisão.', 'success');
    } catch (error) {
      console.error('[Assinatura digital] Falha ao carregar PDF:', error);
      originalPdfBytes = null;
      currentPdfBytes = null;
      pageCount = 0;
      previewDoc = null;
      populatePages(0);
      setViewerState('empty');
      setDocumentStatus(error?.message?.includes('encrypted') ? 'PDF protegido por senha não é suportado.' : 'Não foi possível abrir este PDF.', 'error');
      enableControls();
      toast('Não foi possível abrir o PDF.', 'error');
    }
  }

  function fileFromDrop(event) {
    const files = [...(event.dataTransfer?.files || [])];
    return files.find((file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) || null;
  }

  async function ensurePngDataUrl(dataUrl) {
    const source = String(dataUrl || '');
    if (/^data:image\/png;base64,/i.test(source)) return source;
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const width = Math.max(1, image.naturalWidth || image.width || 1);
          const height = Math.max(1, image.naturalHeight || image.height || 1);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.clearRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error('Não foi possível preparar a imagem da assinatura.'));
      image.src = source;
    });
  }

  function dataUrlBytes(dataUrl) {
    const value = String(dataUrl || '');
    const comma = value.indexOf(',');
    if (comma < 0) throw new Error('Assinatura inválida.');
    const meta = value.slice(0, comma);
    const payload = value.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return new TextEncoder().encode(decodeURIComponent(payload));
  }

  function manualSignaturePosition(pageWidth, pageHeight, imageWidth, imageHeight) {
    const centerX = clamp(stampPosition.x, 0, 1) * pageWidth;
    const centerY = (1 - clamp(stampPosition.y, 0, 1)) * pageHeight;
    return {
      x: clamp(centerX - (imageWidth / 2), 0, Math.max(0, pageWidth - imageWidth)),
      y: clamp(centerY - (imageHeight / 2), 0, Math.max(0, pageHeight - imageHeight))
    };
  }

  async function commitSignature() {
    if (!currentPdfBytes) return toast('Selecione um PDF primeiro.', 'error');
    if (!signatureDataUrl) return toast('Cadastre a assinatura em Personalização primeiro.', 'error');
    const trigger = document.activeElement === els.applyMore ? els.applyMore : els.apply;
    const originalText = trigger.textContent;
    trigger.disabled = true;
    trigger.textContent = 'Aplicando…';

    try {
      const pdfDoc = await window.PDFLib.PDFDocument.load(currentPdfBytes);
      const pages = pdfDoc.getPages();
      const pageNumber = clamp(Number(els.pageSelect.value) || 1, 1, pages.length);
      const page = pages[pageNumber - 1];
      const pngDataUrl = await ensurePngDataUrl(signatureDataUrl);
      const imageBytes = dataUrlBytes(pngDataUrl);
      const image = await pdfDoc.embedPng(imageBytes);
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const ratio = image.height / Math.max(1, image.width);
      const percent = clamp(Number(els.size.value) || 24, 12, 38);
      let drawWidth = pageWidth * (percent / 100);
      let drawHeight = drawWidth * ratio;
      const maxHeight = pageHeight * 0.18;
      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = drawHeight / ratio;
      }
      const position = manualSignaturePosition(pageWidth, pageHeight, drawWidth, drawHeight);
      page.drawImage(image, { x: position.x, y: position.y, width: drawWidth, height: drawHeight, opacity: 1 });
      const bytes = await pdfDoc.save({ useObjectStreams: true });
      currentPdfBytes = new Uint8Array(bytes);
      signedBlob = new Blob([currentPdfBytes], { type: 'application/pdf' });
      signedFileName = originalPdfName.replace(/\.pdf$/i, '') + '-assinado.pdf';
      signatureApplyCount += 1;
      previewDoc = null;
      els.download.disabled = false;
      els.applyMore.disabled = false;
      setDocumentStatus('PDF assinado e pronto para download.', 'success');
      setReviewState(`Assinatura ${signatureApplyCount} aplicada na página ${pageNumber}. Você pode mover a assinatura e aplicar mais uma, se necessário.`);
      await renderCurrentPage();
      const hash = await sha256(currentPdfBytes);
      els.hash.textContent = hash ? `SHA-256 ${hash.slice(0, 16)}…` : '';
      toast(signatureApplyCount === 1 ? 'Assinatura aplicada ao PDF.' : 'Nova assinatura aplicada ao PDF.', 'success');
    } catch (error) {
      console.error('[Assinatura digital] Falha ao aplicar assinatura:', error);
      setDocumentStatus('Falha ao aplicar a assinatura.', 'error');
      toast('Não foi possível aplicar a assinatura.', 'error');
    } finally {
      trigger.textContent = originalText;
      enableControls();
    }
  }

  function downloadSignedPdf() {
    if (!signedBlob) return toast('Aplique a assinatura antes de baixar.', 'error');
    const url = URL.createObjectURL(signedBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = signedFileName || 'documento-assinado.pdf';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function bind() {
    els.fileInput = $('signaturePdfFile');
    els.chooseFile = $('signatureChooseFile');
    els.chooseFileEmpty = $('signatureChooseFileEmpty');
    els.dropZone = $('signatureDropZone');
    els.fileName = $('signatureFileName');
    els.fileMeta = $('signatureFileMeta');
    els.documentStatus = $('signatureDocumentStatus');
    els.savedImage = $('signatureSavedImage');
    els.missingMark = $('signatureMissingMark');
    els.techName = $('signatureTechName');
    els.techRegistry = $('signatureTechRegistry');
    els.identityHelp = $('signatureIdentityHelp');
    els.pageSelect = $('signaturePageSelect');
    els.position = $('signaturePosition');
    els.size = $('signatureSize');
    els.sizeOutput = $('signatureSizeOutput');
    els.apply = $('signatureApply');
    els.applyMore = $('signatureApplyMore');
    els.download = $('signatureDownload');
    els.viewerShell = $('signatureViewerShell');
    els.viewerEmpty = $('signatureViewerEmpty');
    els.canvasStage = $('signatureCanvasStage');
    els.mainCanvas = $('signatureMainCanvas');
    els.mainStamp = $('signatureMainStamp');
    els.fullscreen = $('signatureFullscreen');
    els.reviewFooter = $('signatureReviewFooter');
    els.reviewState = $('signatureReviewState');
    els.hash = $('signatureHash');
    els.howWorks = $('signatureHowWorks');
    els.howDialog = $('signatureHowDialog');

    const openPicker = () => els.fileInput.click();
    els.chooseFile.addEventListener('click', openPicker);
    els.chooseFileEmpty.addEventListener('click', openPicker);
    els.dropZone.addEventListener('click', openPicker);
    els.dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPicker();
      }
    });
    els.fileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      await loadPdfFile(file);
    });
    ['dragenter', 'dragover'].forEach((type) => els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach((type) => els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove('dragover');
    }));
    els.dropZone.addEventListener('drop', async (event) => loadPdfFile(fileFromDrop(event)));

    els.size.addEventListener('input', () => {
      els.sizeOutput.textContent = `${els.size.value}%`;
      renderStampOverlay();
    });
    els.position.addEventListener('change', () => {
      const preset = defaultPlacementFor(els.position.value);
      setStampPosition(preset.x, preset.y);
    });
    els.pageSelect.addEventListener('change', async () => {
      await renderCurrentPage();
      setReviewState(signatureApplyCount ? 'Página alterada. Você pode posicionar a assinatura novamente e aplicar mais uma.' : 'Documento pronto para revisão.');
    });
    els.apply.addEventListener('click', commitSignature);
    els.applyMore.addEventListener('click', commitSignature);
    els.download.addEventListener('click', downloadSignedPdf);
    els.fullscreen.addEventListener('click', () => {
      if (!els.viewerShell.requestFullscreen) return;
      els.viewerShell.requestFullscreen().catch(() => {});
    });
    els.howWorks.addEventListener('click', () => {
      if (typeof els.howDialog.showModal === 'function') els.howDialog.showModal();
    });

    els.canvasStage.addEventListener('click', (event) => {
      if (!currentPdfBytes || !signatureDataUrl) return;
      updateStampFromPointer(event.clientX, event.clientY);
    });
    els.mainStamp.addEventListener('pointerdown', (event) => {
      if (!currentPdfBytes || !signatureDataUrl) return;
      stampPointerId = event.pointerId;
      els.mainStamp.classList.add('dragging');
      try { els.mainStamp.setPointerCapture(event.pointerId); } catch (_error) {}
      updateStampFromPointer(event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
    });
    els.mainStamp.addEventListener('pointermove', (event) => {
      if (stampPointerId !== event.pointerId) return;
      updateStampFromPointer(event.clientX, event.clientY);
      event.preventDefault();
    });
    const releaseStamp = (event) => {
      if (stampPointerId !== event.pointerId) return;
      stampPointerId = null;
      els.mainStamp.classList.remove('dragging');
      try { els.mainStamp.releasePointerCapture(event.pointerId); } catch (_error) {}
      event.preventDefault();
    };
    els.mainStamp.addEventListener('pointerup', releaseStamp);
    els.mainStamp.addEventListener('pointercancel', releaseStamp);

    window.addEventListener('resize', () => {
      clearTimeout(bind._resizeTimer);
      bind._resizeTimer = setTimeout(() => renderCurrentPage(), 120);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bind();
    setViewerState('empty');
    enableControls();
    await loadThemeIdentity();
  }, { once: true });
})();
