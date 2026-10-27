(() => {
  'use strict';

  if (window.SurveyorDocumentAutoPreviewInstalled) return;
  window.SurveyorDocumentAutoPreviewInstalled = true;

  const style = document.createElement('style');
  style.id = 'surveyor-document-auto-preview-style';
  style.textContent = `
    [data-document-preview="1"][hidden]{display:none!important}
    [data-document-preview="1"].document-preview-visible{animation:surveyorPreviewIn .16s ease-out}
    @keyframes surveyorPreviewIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  `;
  document.head.appendChild(style);

  const previews = Array.from(document.querySelectorAll('[data-document-preview="1"]'));
  const placeholderPattern = /^(?:selecione|clique|preencha|aguardando|nenhum|escolha|importe|adicione)/i;

  function hasGeneratedContent(preview) {
    if (!preview) return false;
    if (preview.querySelector('iframe,embed,object,svg,canvas,img,.surveyor-pdf-preview-shell,.surveyor-pdf-preview-loading,.memorial-pdf-preview-shell,.memorial-profissional,.preview-sheet,.word-template-page,.azimuth-sheet,.planialt-document-preview,table,article')) return true;
    const text = String(preview.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    return !placeholderPattern.test(text);
  }

  function revealPreview(preview, { scroll = true } = {}) {
    if (!preview) return;
    const wasHidden = preview.hidden;
    preview.hidden = false;
    preview.classList.add('document-preview-visible');
    preview.dataset.documentPreviewGenerated = '1';
    if (scroll && wasHidden) {
      setTimeout(() => {
        const rect = preview.getBoundingClientRect();
        const outsideViewport = rect.top < 80 || rect.top > window.innerHeight - 120;
        if (outsideViewport) preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 90);
    }
  }

  function armPreview(preview) {
    if (!preview) return;
    preview.dataset.documentPreviewAwaiting = '1';
  }

  previews.forEach((preview) => {
    // Regra global: nenhuma caixa de pré-visualização aparece antes de uma ação de geração.
    preview.hidden = true;
    preview.classList.remove('document-preview-visible');
    delete preview.dataset.documentPreviewGenerated;

    const observer = new MutationObserver(() => {
      const autoMutation = preview.dataset.documentPreviewAuto === 'mutation';
      const awaiting = preview.dataset.documentPreviewAwaiting === '1';
      if ((awaiting || autoMutation) && hasGeneratedContent(preview)) {
        delete preview.dataset.documentPreviewAwaiting;
        revealPreview(preview);
      }
    });
    observer.observe(preview, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src'] });
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('button[id],a[id]');
    if (!trigger?.id) return;
    previews.forEach((preview) => {
      if (preview.dataset.documentPreviewGenerate === trigger.id) armPreview(preview);
    });
  }, true);
})();
