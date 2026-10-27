(() => {
  'use strict';
  let customization = {};
  let ready = Promise.resolve({});

  function escape(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function safeUrl(value, fallback = '#') {
    try {
      const url = new URL(String(value || ''), location.href);
      return ['http:', 'https:'].includes(url.protocol) ? escape(url.href) : fallback;
    } catch { return fallback; }
  }

  function load(options = {}) {
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (!auth?.currentUser?.()) return Promise.resolve(customization);
    ready = auth.getDocumentCustomization({ forceRefresh: Boolean(options.forceRefresh || options.noCache), noCache: Boolean(options.forceRefresh || options.noCache) })
      .then((value) => { customization = value || {}; return customization; })
      .catch((error) => { console.warn('Personalização indisponível', error); return customization; });
    return ready;
  }

  function logoHtml() {
    if (!customization.logoDataUrl) return '';
    const image = `<img src="${customization.logoDataUrl}" alt="Logotipo" style="max-width:180px;max-height:76px;object-fit:contain">`;
    return customization.websiteUrl
      ? `<a href="${safeUrl(customization.websiteUrl)}" target="_blank" rel="noopener noreferrer">${image}</a>`
      : image;
  }

  function headerHtml(title = '') {
    return `<header class="georural-custom-header" style="display:flex;justify-content:space-between;align-items:center;gap:24px;padding:0 0 18px;border-bottom:2px solid #233b68;margin-bottom:24px">${logoHtml()}<div style="text-align:right"><strong style="display:block;font-size:20px">${escape(customization.companyName || title || 'Surveyor')}</strong>${customization.addressText ? `<span style="display:block;font-size:12px;color:#52627a">${escape(customization.addressText)}</span>` : ''}</div></header>`;
  }

  function footerHtml() {
    const tech = [customization.responsibleTechnician, customization.professionalRegistry].filter(Boolean).join(' — ');
    return `<footer class="georural-custom-footer" style="margin-top:28px;padding-top:12px;border-top:1px solid #9aa8ba;font-size:11px;color:#52627a">${tech ? `<div><b>Responsável técnico:</b> ${escape(tech)}</div>` : ''}${customization.footerText ? `<div>${escape(customization.footerText)}</div>` : ''}</footer>`;
  }

  function decodeTemplateDataUrl() {
    const source = String(customization.baseTemplateContent || '');
    if (!/^data:(text\/html|text\/plain)/i.test(source)) return '';
    const comma = source.indexOf(',');
    if (comma < 0) return '';
    try {
      const meta = source.slice(0, comma);
      const data = source.slice(comma + 1);
      const decoded = /;base64/i.test(meta)
        ? decodeURIComponent(Array.from(atob(data), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))
        : decodeURIComponent(data);
      return decoded;
    } catch (error) {
      console.warn('Modelo-base inválido', error);
      return '';
    }
  }

  function sanitizeTemplate(html) {
    return String(html || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<(iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  }

  function applyBaseTemplate(content, title) {
    const raw = decodeTemplateDataUrl();
    if (!raw) return '';
    const values = {
      LOGOTIPO: logoHtml(),
      EMPRESA: escape(customization.companyName || 'Surveyor'),
      ENDERECO: escape(customization.addressText || ''),
      TITULO_DOCUMENTO: escape(title),
      CONTEUDO: content,
      RESPONSAVEL_TECNICO: escape(customization.responsibleTechnician || ''),
      REGISTRO_PROFISSIONAL: escape(customization.professionalRegistry || ''),
      RODAPE: escape(customization.footerText || '')
    };
    let template = sanitizeTemplate(raw);
    Object.entries(values).forEach(([key, value]) => {
      template = template.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'gi'), value);
    });
    if (!/{{\s*CONTEUDO\s*}}/i.test(raw) && !template.includes(content)) {
      template = template.replace(/<\/body>/i, `${content}</body>`);
      if (!/<\/body>/i.test(template)) template += content;
    }
    return template;
  }

  function defaultDocument(content, title) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:32px auto;padding:0 28px;color:#172033;line-height:1.5}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #cbd5e1}@media print{body{margin:0;max-width:none}.no-print{display:none}}</style></head><body>${headerHtml(title)}${content}${footerHtml()}</body></html>`;
  }

  function wrapHtml(content, title = 'Documento Surveyor') {
    return applyBaseTemplate(content, title) || defaultDocument(content, title);
  }

  window.GeoRuralDocumentTheme = { load, ready: () => ready, get: () => ({ ...customization }), getSignature: () => String(customization.planDocumentSignatureDataUrl || ''), headerHtml, footerHtml, wrapHtml, escape };
  document.addEventListener('DOMContentLoaded', load);
})();
