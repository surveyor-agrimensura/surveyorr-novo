(() => {
  'use strict';

  if (window.SurveyorPaperFormat?.installed) return;

  const ELIGIBLE_PAGES = new Set([
    'mapas.html',
    'pranchas.html',
    'planialtimetria.html',
    'perimetros.html',
    'confrontacao.html',
    'ods.html',
    'car.html',
    'loteamentos-reurb.html'
  ]);
  const EXCLUDED_PAGES = new Set(['memorial.html', 'ambiental.html']);
  const PREVIEW_IDS = ['mapPreview', 'elevationPreview', 'azimuthPreview', 'letterOutput'];

  function normalize(value) {
    return String(value || '').toLowerCase() === 'a3' ? 'a3' : 'a4';
  }

  function page() {
    return String(document.body?.dataset?.page || '').trim();
  }

  function eligible() {
    const current = page();
    return ELIGIBLE_PAGES.has(current) && !EXCLUDED_PAGES.has(current);
  }

  function get() {
    return normalize(document.getElementById('printFormat')?.value || document.body?.dataset?.paperFormat || 'a4');
  }

  function labelText(format = get()) {
    return normalize(format) === 'a3' ? 'A3 (297 × 420 mm)' : 'A4 (210 × 297 mm)';
  }

  function ensureStyle() {
    if (document.getElementById('surveyor-paper-format-style')) return;
    const style = document.createElement('style');
    style.id = 'surveyor-paper-format-style';
    style.textContent = `
      .surveyor-paper-format-control{display:grid!important;gap:6px!important;min-width:178px!important;color:#475569!important;font-size:12px!important;font-weight:750!important;line-height:1.2!important}
      .surveyor-paper-format-control select{min-height:42px!important;padding:0 36px 0 12px!important;border:1px solid #cbd5e1!important;border-radius:10px!important;background:#fff!important;color:#0f172a!important;font:750 13px/1.2 Inter,system-ui,-apple-system,"Segoe UI",Arial,sans-serif!important;cursor:pointer!important}
      .surveyor-paper-format-control select:focus{outline:3px solid rgba(37,99,235,.13)!important;border-color:#60a5fa!important}
      .surveyor-paper-format-note{display:block;color:#64748b;font-size:10px;font-weight:600;line-height:1.25}
      @media(max-width:700px){.surveyor-paper-format-control{width:100%!important;min-width:0!important}.surveyor-paper-format-control select{width:100%!important}}
    `;
    document.head.appendChild(style);
  }

  function createControl() {
    const label = document.createElement('label');
    label.className = 'surveyor-paper-format-control';
    label.dataset.surveyorPaperFormat = '1';
    label.innerHTML = `Formato do documento
      <select id="printFormat" aria-label="Formato do documento">
        <option value="a4" selected>A4 — 210 × 297 mm</option>
        <option value="a3">A3 — 297 × 420 mm</option>
      </select>
      <small class="surveyor-paper-format-note">O PDF será montado no tamanho selecionado.</small>`;
    return label;
  }

  function findAnchor() {
    const current = page();
    if (current === 'ods.html') return document.querySelector('.sheet-download-row');
    if (current === 'car.html') return document.getElementById('generateCarReport')?.closest('.button-row') || document.querySelector('.button-row');
    if (current === 'loteamentos-reurb.html') return document.getElementById('downloadLotReportPdf')?.closest('.button-row') || document.querySelector('.button-row');
    if (current === 'confrontacao.html') return document.getElementById('generateLetter')?.closest('.button-row') || document.querySelector('.button-row');
    if (current === 'perimetros.html') return document.getElementById('generateAzimuth')?.closest('.button-row') || document.querySelector('.button-row');
    return document.querySelector('.button-row,.form-grid');
  }

  function ensureControl() {
    if (!eligible()) return null;
    ensureStyle();
    let select = document.getElementById('printFormat');
    if (!select) {
      const anchor = findAnchor();
      if (!anchor) return null;
      const control = createControl();
      if (anchor.classList.contains('button-row') || anchor.classList.contains('sheet-download-row')) anchor.prepend(control);
      else anchor.append(control);
      select = control.querySelector('#printFormat');
    } else {
      const parent = select.closest('label');
      if (parent && !parent.classList.contains('surveyor-paper-format-control')) parent.classList.add('surveyor-paper-format-control');
      if (select.querySelector('option[value="a3"]')) {
        const a3 = select.querySelector('option[value="a3"]');
        if (a3) a3.textContent = 'A3 — 297 × 420 mm';
      }
      const a4 = select.querySelector('option[value="a4"]');
      if (a4) a4.textContent = 'A4 — 210 × 297 mm';
    }
    document.body.dataset.paperFormat = normalize(select.value);
    return select;
  }

  function updateCurrentPrintPageRule(format = get()) {
    let style = document.getElementById('surveyor-paper-format-print-rule');
    if (!style) {
      style = document.createElement('style');
      style.id = 'surveyor-paper-format-print-rule';
      document.head.appendChild(style);
    }
    const token = normalize(format).toUpperCase();
    style.textContent = `@media print{@page{size:${token}}}`;
  }

  async function refreshPdfPreviews(format = get()) {
    const api = window.SurveyorPdfPreview;
    if (!api?.getState || !api?.renderHtml) return;
    for (const id of PREVIEW_IDS) {
      const host = document.getElementById(id);
      if (!host) continue;
      const state = api.getState(host);
      if (!state?.sourceHtml) continue;
      try {
        await api.renderHtml(host, state.sourceHtml, { ...(state.config || {}), pageFormat: normalize(format) });
      } catch (error) {
        console.warn('[Surveyor] Não foi possível atualizar a prévia para o formato selecionado:', error?.message || error);
      }
    }
  }

  function applyToCss(css, format = get()) {
    const normalized = normalize(format);
    if (normalized !== 'a3') return String(css || '');
    let out = String(css || '').replace(/size\s*:\s*A4\b/gi, 'size:A3');
    out += `\n@media print{.letter-pdf-sheet,.az-report-sheet,.sheet-pdf-document,.car-report-document,.lot-report-sheet{max-width:none!important;width:auto!important}}`;
    return out;
  }

  function applyToHtml(html, format = get()) {
    const normalized = normalize(format);
    if (normalized !== 'a3') return String(html || '');
    let out = String(html || '').replace(/size\s*:\s*A4\b/gi, 'size:A3');
    const extra = '<style data-surveyor-a3="1">@media print{@page{size:A3}.letter-pdf-sheet,.az-report-sheet,.sheet-pdf-document,.car-report-document,.lot-report-sheet{max-width:none!important;width:auto!important}}</style>';
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${extra}</head>`);
    else out = `${extra}${out}`;
    return out;
  }

  function bind() {
    const select = ensureControl();
    if (!select) return;
    const onChange = async () => {
      const format = normalize(select.value);
      document.body.dataset.paperFormat = format;
      updateCurrentPrintPageRule(format);
      window.dispatchEvent(new CustomEvent('surveyor:paper-format-change', { detail: { format, label: labelText(format) } }));
      await refreshPdfPreviews(format);
    };
    if (select.dataset.surveyorPaperBound !== '1') {
      select.dataset.surveyorPaperBound = '1';
      select.addEventListener('change', onChange);
    }
    updateCurrentPrintPageRule(select.value);
  }

  window.SurveyorPaperFormat = {
    installed: true,
    normalize,
    get,
    eligible,
    labelText,
    applyToCss,
    applyToHtml,
    refreshPdfPreviews
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bind, 0), { once: true });
  else setTimeout(bind, 0);
})();
