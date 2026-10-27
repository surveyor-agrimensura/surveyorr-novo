(() => {
  'use strict';

  const auth = window.SurveyorAuth || window.GeoRuralAuth;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'surveyor_admin_plan_document_settings_v2';
  const SIGNATURE_KEY = 'surveyor_admin_signature_image_v2';
  const SIGNATURE_POSITION_KEY = 'surveyor_admin_signature_position_v1';
  const OFFICIAL_SIGNATURE_URL = '/assets/signatures/kaua-lucas-santos-franca.png?v=1.0.0-rc.185.74';

  const dependencyPromises = new Map();
  function loadExternalScriptOnce(src, globalCheck) {
    if (typeof globalCheck === 'function' && globalCheck()) return Promise.resolve();
    if (dependencyPromises.has(src)) return dependencyPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-surveyor-dependency="${src}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Falha ao carregar dependência: ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.surveyorDependency = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Falha ao carregar dependência: ${src}`));
      document.head.appendChild(script);
    }).finally(() => {
      if (typeof globalCheck === 'function' && !globalCheck()) dependencyPromises.delete(src);
    });
    dependencyPromises.set(src, promise);
    return promise;
  }

  async function ensureWordLibrary() {
    await loadExternalScriptOnce('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', () => Boolean(window.JSZip));
  }

  async function ensurePdfLibrary() {
    await loadExternalScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => Boolean(window.jspdf?.jsPDF));
  }

  const OFFICIAL_PLANS = {
    basic_monthly: {
      name: 'Surveyor Básico Mensal', priceCents: 3990, durationDays: 30, tier: 'basic', billing: 'Mensal',
      summary: 'Plano essencial para cadastro, desenho básico, documentos técnicos e organização dos próprios projetos.',
      features: [
        'Mapa e cadastro de imóveis e projetos.',
        'Criação, visualização e edição dos próprios projetos.',
        'Desenho básico de pontos, linhas e polígonos, com medições básicas.',
        'Importação e exportação básica dos dados do projeto, conforme formatos disponíveis.',
        'Acervos e camadas oficiais básicas.',
        'Memorial Descritivo, Planilha ODS, Carta de Confrontação, Mapas e Croquis e Pranchas Técnicas em modalidade básica.',
        'Minha Nuvem para arquivos e projetos da própria conta.',
        'Geração de documentos sem limite comercial de quantidade.',
        'Suporte padrão pelos canais oficiais.'
      ],
      limits: ['1 usuário', 'Projetos ilimitados pelo armazenamento', '200 MB incluídos · expansível até 2 GB', '5 downloads e 5 exportações por dia']
    },
    plus_monthly: {
      name: 'Surveyor Plus Mensal', priceCents: 6990, durationDays: 30, tier: 'plus', billing: 'Mensal',
      summary: 'Plano profissional com CAR, camadas WMS/WFS, edição geométrica, SIG, terreno e compartilhamento seguro.',
      features: [
        'Todos os recursos do Plano Básico.',
        'Módulo CAR.',
        'Catálogo completo de camadas e serviços WMS/WFS.',
        'Edição de vértices, offset, rotação, escala e espelhamento.',
        'Operações SIG básicas e recursos de terreno.',
        'Relatório Ambiental e Loteamentos/REURB em modalidade básica.',
        'Perímetros por azimute e Planialtimetria/MDT em modalidade básica.',
        'Compartilhamento somente leitura, com senha e validade.',
        'Geração de documentos sem limite comercial de quantidade.',
        'Equipe compartilhada com 2 acessos totais: titular + 1 subusuário.',
        'Todos os membros utilizam a mesma franquia compartilhada do titular, sem limite individual separado.',
        'Usuário adicional disponível conforme proposta comercial anual.',
        'Suporte com prioridade leve pelos canais oficiais.'
      ],
      limits: ['Até 2 usuários', 'Projetos ilimitados pelo armazenamento', '500 MB incluídos · expansível até 5 GB', '20 downloads e 20 exportações por dia']
    },
    pro_monthly: {
      name: 'Surveyor Pro Mensal', priceCents: 11990, durationDays: 30, tier: 'pro', billing: 'Mensal',
      summary: 'Plano completo para escritórios e equipes, com projetos ilimitados, 4 usuários e 100 GB.',
      features: [
        'Todos os recursos do Plano Plus.',
        'Projetos ilimitados, até 4 usuários e 1 GB incluído, expansível até 10 GB.',
        'Equipe compartilhada com 4 acessos totais: titular + 3 subusuários.',
        'Todos os membros utilizam a mesma franquia compartilhada do titular, sem limite individual separado.',
        'Usuário adicional disponível conforme proposta comercial anual.',
        'Capacidade adicional de armazenamento disponível na loja oficial: https://loja.surveyorr.com.br.',
        'Histórico completo de versões, modelos, lixeira, travamento e exportação ZIP de projetos.',
        'Geometria, SIG, terreno, Planialtimetria/MDT, Relatório Ambiental e Loteamentos/REURB em modalidade completa.',
        'Compartilhamento completo, com revogação e limite de acesso.',
        'Recursos administrativos, auditoria, segurança, sessões, avisos, backup lógico e configurações da organização quando provisionados.',
        'White label não incluído: implantação separada entre R$ 390,00 e R$ 590,00.',
        'Geração de documentos sem limite comercial de quantidade.',
        'Suporte prioritário pelos canais oficiais.'
      ],
      limits: ['Até 4 usuários', 'Projetos ilimitados', '1 GB incluído · expansível até 10 GB', 'Downloads e exportações ilimitados']
    },
    basic_annual: {
      name: 'Surveyor Básico Anual', priceCents: 39900, durationDays: 365, tier: 'basic', billing: 'Anual',
      summary: 'Plano essencial anual para cadastro, desenho básico e documentos técnicos.',
      features: null, limits: ['1 usuário', 'Projetos ilimitados pelo armazenamento', '200 MB incluídos · expansível até 2 GB', '5 downloads e 5 exportações por dia']
    },
    plus_annual: {
      name: 'Surveyor Plus Anual', priceCents: 69900, durationDays: 365, tier: 'plus', billing: 'Anual',
      summary: 'Plano profissional anual, CAR, WMS/WFS, SIG e compartilhamento seguro.',
      features: null, limits: ['Até 2 usuários', 'Projetos ilimitados pelo armazenamento', '500 MB incluídos · expansível até 5 GB', '20 downloads e 20 exportações por dia']
    },
    pro_annual: {
      name: 'Surveyor Pro Anual', priceCents: 119900, durationDays: 365, tier: 'pro', billing: 'Anual',
      summary: 'Plano completo anual, projetos ilimitados, 4 usuários e 100 GB.',
      features: null, limits: ['Até 4 usuários', 'Projetos ilimitados', '1 GB incluído · expansível até 10 GB', 'Downloads e exportações ilimitados']
    }
  };
  OFFICIAL_PLANS.basic_annual.features = OFFICIAL_PLANS.basic_monthly.features;
  OFFICIAL_PLANS.plus_annual.features = OFFICIAL_PLANS.plus_monthly.features;
  OFFICIAL_PLANS.pro_annual.features = OFFICIAL_PLANS.pro_monthly.features;

  const state = { users: [], plans: [], signatureBytes: null, signatureDataUrl: '', logoBytes: null, initialized: false, signaturePosition: { x: 50, y: 44, scale: 100 }, customization: null, dragging: false, lastPdf: null };

  function strictAdmin(user) {
    const role = String(user?.role || '').trim().toLowerCase();
    return role === 'admin' || role === 'administrator' || user?.isAdmin === true;
  }

  function notify(message, type = 'info') {
    if (typeof window.showSuiteToast === 'function') return window.showSuiteToast(message, type);
    const toast = $('suiteToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function xmlEscape(value = '') {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function htmlEscape(value = '') {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function formatCurrency(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
  }

  function parseCurrencyToCents(value) {
    const normalized = String(value || '').replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  }

  function isoToday() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function addDays(dateValue, days) {
    const date = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
    date.setDate(date.getDate() + Number(days || 0));
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function formatDate(value) {
    if (!value) return 'Não informada';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  function slugify(value = '') {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  }

  function documentCode(type) {
    const date = new Date();
    const stamp = date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `SVR-${type === 'receipt' ? 'COMP' : 'TERMO'}-${stamp}-${random}`;
  }

  function readSettings() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; }
  }

  function saveSettings() {
    const data = {
      responsibleName: $('planDocResponsibleName')?.value || '',
      responsibleRole: $('planDocResponsibleRole')?.value || '',
      city: $('planDocCity')?.value || '',
      supportEmail: $('planDocSupportEmail')?.value || '',
      signaturePosition: state.signaturePosition
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function arrayBufferToDataUrl(buffer, type = 'image/png') {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return `data:${type};base64,${btoa(binary)}`;
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = String(dataUrl || '').split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function imageFileToPngBytes(file) {
    if (!file) return null;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    const maxWidth = 900;
    const maxHeight = 320;
    const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function loadLogoBytes() {
    if (state.logoBytes) return state.logoBytes;
    try {
      const response = await fetch('/assets/logo.png', { cache: 'force-cache' });
      if (response.ok) state.logoBytes = new Uint8Array(await response.arrayBuffer());
    } catch {}
    return state.logoBytes;
  }

  function getPlan(slug) {
    const fallback = OFFICIAL_PLANS[slug] || OFFICIAL_PLANS.basic_annual;
    const live = state.plans.find((plan) => String(plan.slug || plan.id) === slug);
    if (!live) return { slug, ...fallback };
    return {
      slug,
      ...fallback,
      name: live.name || fallback.name,
      priceCents: Number(live.priceCents ?? Math.round(Number(live.price || 0) * 100)) || fallback.priceCents,
      durationDays: /anual/i.test(String(live.billingCycle || live.billing || fallback.billing)) ? 365 : 30
    };
  }

  function populatePlanOptions() {
    const select = $('planDocPlan');
    if (!select) return;
    const selected = select.value;
    const annualSlugs = ['basic_annual', 'plus_annual', 'pro_annual'];
    select.innerHTML = annualSlugs.map((slug) => {
      const plan = getPlan(slug);
      return `<option value="${slug}">${htmlEscape(plan.name)} — ${htmlEscape(formatCurrency(plan.priceCents))}</option>`;
    }).join('');
    if (selected && OFFICIAL_PLANS[selected]) select.value = selected;
  }

  function userPlanSlug(user = {}) {
    const raw = String(user.planSlug || user.plan || '').trim().toLowerCase();
    const aliases = { basic: 'basic_annual', basic_monthly: 'basic_annual', plus: 'plus_annual', plus_monthly: 'plus_annual', pro: 'pro_annual', pro_monthly: 'pro_annual', 'pro-max': 'pro_annual', promax: 'pro_annual' };
    const resolved = aliases[raw] || raw;
    return ['basic_annual', 'plus_annual', 'pro_annual'].includes(resolved) ? resolved : 'basic_annual';
  }

  function populateUserOptions() {
    const select = $('planDocUser');
    if (!select) return;
    const selected = select.value;
    select.innerHTML = '<option value="">Preencher manualmente</option>' + state.users
      .filter((user) => String(user.role || '').toLowerCase() !== 'admin')
      .sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email), 'pt-BR'))
      .map((user) => `<option value="${htmlEscape(user.id || user.$id || '')}">${htmlEscape(user.name || user.email || 'Usuário')} — ${htmlEscape(user.email || '')}</option>`)
      .join('');
    if (selected) select.value = selected;
  }

  function selectedUser() {
    const id = $('planDocUser')?.value;
    return state.users.find((user) => String(user.id || user.$id) === String(id));
  }

  function syncUserFields() {
    const user = selectedUser();
    if (!user) return;
    $('planDocClientName').value = user.name || '';
    $('planDocClientEmail').value = user.email || '';
    $('planDocClientPhone').value = user.whatsappDisplay || user.phoneDisplay || user.whatsapp || user.phone || '';
    $('planDocAccessEmail').value = user.email || '';
    $('planDocPlan').value = userPlanSlug(user);
    if (user.expiresAt || user.expiry || user.validUntil) $('planDocEndDate').value = String(user.expiresAt || user.expiry || user.validUntil).slice(0, 10);
    syncPlanFields({ preserveEndDate: Boolean(user.expiresAt || user.expiry || user.validUntil) });
  }

  function syncPlanFields({ preserveEndDate = false } = {}) {
    const plan = getPlan($('planDocPlan')?.value || 'basic_annual');
    $('planDocAmount').value = (plan.priceCents / 100).toFixed(2).replace('.', ',');
    if (!preserveEndDate || !$('planDocEndDate').value) $('planDocEndDate').value = addDays($('planDocStartDate').value || isoToday(), plan.durationDays);
    $('planDocPlanSummary').innerHTML = `
      <b>${htmlEscape(plan.name)}</b>
      <span>${htmlEscape(formatCurrency(plan.priceCents))} • ${plan.durationDays === 365 ? '365 dias' : '30 dias'}</span>
      <small>${htmlEscape(plan.summary)}</small>
    `;
    renderPreview();
  }

  function toggleDocumentFields() {
    const isReceipt = $('planDocType')?.value === 'receipt';
    document.querySelectorAll('[data-plan-doc-receipt-only]').forEach((item) => item.classList.toggle('hidden', !isReceipt));
    $('planDocGenerate').textContent = isReceipt ? 'Gerar comprovante em Word' : 'Gerar termo em Word';
    if ($('planDocGeneratePdf')) $('planDocGeneratePdf').textContent = isReceipt ? 'Gerar comprovante em PDF' : 'Gerar termo em PDF';
    state.lastPdf = null;
    renderPreview();
  }

  function collectData() {
    const slug = $('planDocPlan').value;
    const plan = getPlan(slug);
    const type = $('planDocType').value;
    return {
      type,
      code: documentCode(type),
      plan,
      clientName: $('planDocClientName').value.trim(),
      clientDocument: $('planDocClientDocument').value.trim(),
      clientEmail: $('planDocClientEmail').value.trim(),
      clientPhone: $('planDocClientPhone').value.trim(),
      paymentMethod: $('planDocPaymentMethod').value.trim(),
      paymentDate: $('planDocPaymentDate').value,
      startDate: $('planDocStartDate').value,
      endDate: $('planDocEndDate').value,
      amountCents: parseCurrencyToCents($('planDocAmount').value),
      accessEmail: $('planDocAccessEmail').value.trim(),
      firstAccess: $('planDocFirstAccess')?.value || 'Link seguro enviado ao e-mail do cliente',
      responsibleName: $('planDocResponsibleName').value.trim(),
      responsibleRole: $('planDocResponsibleRole').value.trim(),
      city: $('planDocCity').value.trim(),
      supportEmail: $('planDocSupportEmail').value.trim(),
      signaturePosition: { ...state.signaturePosition },
      generatedAt: new Date()
    };
  }

  function validateData(data) {
    const missing = [];
    if (!data.clientName) missing.push('nome do cliente');
    if (!data.clientEmail) missing.push('e-mail do cliente');
    if (!data.startDate) missing.push('data de início');
    if (!data.endDate) missing.push('data de vencimento');
    if (!data.amountCents) missing.push('valor pago');
    if (!data.responsibleName) missing.push('responsável pelo Surveyor');
    if (missing.length) throw new Error(`Preencha: ${missing.join(', ')}.`);
  }

  function renderPreview() {
    const box = $('planDocPreview');
    if (!box) return;
    const data = collectData();
    const typeLabel = data.type === 'receipt' ? 'Comprovante formal de contratação e ativação' : 'Instrumento particular de adesão e ciência';
    box.innerHTML = `
      <span class="eyebrow">PRÉ-VISUALIZAÇÃO ESTRUTURAL</span>
      <div class="formal-preview-sheet">
        <div class="formal-doc-code">DOCUMENTO ${htmlEscape(data.code)}</div>
        <h3>${htmlEscape(typeLabel)}</h3>
        <div class="formal-plan">${htmlEscape(data.plan.name.toUpperCase())}</div>
        <dl>
          <div><dt>Contratante</dt><dd>${htmlEscape(data.clientName || 'Não preenchido')}</dd></div>
          <div><dt>Plano</dt><dd>${htmlEscape(data.plan.name)}</dd></div>
          <div><dt>Valor</dt><dd>${htmlEscape(formatCurrency(data.amountCents || data.plan.priceCents))}</dd></div>
          <div><dt>Vigência</dt><dd>${htmlEscape(formatDate(data.startDate))} a ${htmlEscape(formatDate(data.endDate))}</dd></div>
        </dl>
        <p>Documento administrativo formal, com condições do plano, vigência, responsabilidades e registro da contratação. Não contém assinatura do cliente ou testemunhas.</p>
        <p>A assinatura administrativa será inserida na posição configurada ao lado e vinculada à identificação do responsável.</p>
      </div>`;
  }

  function wRun(text, options = {}) {
    const props = [
      options.bold ? '<w:b/>' : '',
      options.italic ? '<w:i/>' : '',
      options.color ? `<w:color w:val="${options.color}"/>` : '',
      options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : ''
    ].join('');
    const preserve = /^\s|\s$|\s{2}/.test(String(text)) ? ' xml:space="preserve"' : '';
    return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t${preserve}>${xmlEscape(text)}</w:t></w:r>`;
  }

  function wParagraph(text = '', options = {}) {
    const pProps = [
      options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
      options.align ? `<w:jc w:val="${options.align}"/>` : '',
      options.before != null || options.after != null ? `<w:spacing w:before="${options.before || 0}" w:after="${options.after || 0}"/>` : '',
      options.keepNext ? '<w:keepNext/>' : '',
      options.pageBreakBefore ? '<w:pageBreakBefore/>' : '',
      options.borderBottom ? `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="${options.borderBottom}"/></w:pBdr>` : ''
    ].join('');
    const runs = Array.isArray(text) ? text.map((part) => wRun(part.text, part)).join('') : wRun(text, options.run || {});
    return `<w:p>${pProps ? `<w:pPr>${pProps}</w:pPr>` : ''}${runs}</w:p>`;
  }

  function wBullet(text) {
    return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60"/></w:pPr>${wRun(text)}</w:p>`;
  }

  function wCell(content, options = {}) {
    const width = options.width ? `<w:tcW w:w="${options.width}" w:type="dxa"/>` : '';
    const fill = options.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.fill}"/>` : '';
    const margins = '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>';
    const paragraphs = Array.isArray(content)
      ? content.map((item) => typeof item === 'string' ? wParagraph(item) : item).join('')
      : wParagraph(content, { run: { bold: options.bold, color: options.color, size: options.size } });
    return `<w:tc><w:tcPr>${width}${fill}${margins}</w:tcPr>${paragraphs}</w:tc>`;
  }

  function wTable(rows, options = {}) {
    const grid = options.widths ? `<w:tblGrid>${options.widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>` : '';
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D6DEE8"/><w:left w:val="single" w:sz="4" w:color="D6DEE8"/><w:bottom w:val="single" w:sz="4" w:color="D6DEE8"/><w:right w:val="single" w:sz="4" w:color="D6DEE8"/><w:insideH w:val="single" w:sz="4" w:color="D6DEE8"/><w:insideV w:val="single" w:sz="4" w:color="D6DEE8"/></w:tblBorders>${options.layoutFixed ? '<w:tblLayout w:type="fixed"/>' : ''}</w:tblPr>${grid}${rows.map((cells) => `<w:tr>${cells.join('')}</w:tr>`).join('')}</w:tbl>`;
  }

  function wImage(relId, name, widthEmu, heightEmu, docPrId) {
    return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${xmlEscape(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${xmlEscape(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }

  function wAnchoredSignature(relId, name, position = {}, docPrId = 2) {
    const scale = Math.max(70, Math.min(150, Number(position.scale || 100))) / 100;
    const width = Math.round(2300000 * scale);
    const height = Math.round(780000 * scale);
    const availableX = Math.max(0, 6280000 - width);
    const x = Math.round((Math.max(0, Math.min(100, Number(position.x ?? 50))) / 100) * availableX);
    const y = Math.round((Math.max(0, Math.min(100, Number(position.y ?? 44))) / 100) * 900000);
    return `<w:p><w:pPr><w:spacing w:after="1250"/></w:pPr><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>${x}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${y}</wp:posOffset></wp:positionV><wp:extent cx="${width}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${docPrId}" name="${xmlEscape(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${xmlEscape(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
  }

  function formalSignatureBlock(data, media) {
    return [
      wParagraph('ASSINATURA ADMINISTRATIVA', { style: 'Heading1', align: 'center', keepNext: true }),
      media.signature ? wImage('rIdSignature', 'Assinatura administrativa do Surveyor', 2100000, 720000, 2) : wParagraph('', { after: 180 }),
      wParagraph('____________________________________________', { align: 'center', after: 40 }),
      wParagraph(data.responsibleName, { align: 'center', run: { bold: true }, after: 20 }),
      wParagraph(data.responsibleRole || 'Responsável administrativo pelo Surveyor', { align: 'center', run: { italic: true }, after: 30 })
    ].join('');
  }

  function termBody(data, media) {
    const rows = [
      [wCell('Contratante', { bold: true, fill: 'F1F3F5', width: 2200 }), wCell(data.clientName, { width: 7200 })],
      [wCell('CPF/CNPJ', { bold: true, fill: 'F1F3F5' }), wCell(data.clientDocument || 'Não informado')],
      [wCell('E-mail', { bold: true, fill: 'F1F3F5' }), wCell(data.clientEmail)],
      [wCell('Telefone', { bold: true, fill: 'F1F3F5' }), wCell(data.clientPhone || 'Não informado')]
    ];
    const planRows = [
      [wCell('Plano contratado', { bold: true, fill: 'F1F3F5', width: 2600 }), wCell(data.plan.name, { width: 6800 })],
      [wCell('Valor pago', { bold: true, fill: 'F1F3F5' }), wCell(formatCurrency(data.amountCents))],
      [wCell('Forma de pagamento', { bold: true, fill: 'F1F3F5' }), wCell(data.paymentMethod || 'Não informada')],
      [wCell('Data do pagamento', { bold: true, fill: 'F1F3F5' }), wCell(formatDate(data.paymentDate))],
      [wCell('Início do plano', { bold: true, fill: 'F1F3F5' }), wCell(formatDate(data.startDate))],
      [wCell('Vencimento do plano', { bold: true, fill: 'F1F3F5' }), wCell(formatDate(data.endDate))]
    ];
    const clauses = [
      ['1. Objeto', `Este Termo registra a contratação de licença temporária, pessoal, não exclusiva e intransferível de uso do software Surveyor no plano ${data.plan.name}, durante o período indicado. A contratação não transfere propriedade do software, código-fonte, marca, estrutura, integrações ou demais direitos do Surveyor.`],
      ['2. Recursos e permissões', 'O cliente terá acesso somente aos módulos, ferramentas e ações liberados para o plano contratado. Recursos não incluídos podem não aparecer na interface e o acesso direto pode ser recusado. Todos os planos possuem geração de documentos sem limite comercial de quantidade.'],
      ['3. Responsabilidade pelo uso', 'O Surveyor é uma ferramenta de apoio a atividades de georreferenciamento, agrimensura, cadastro, organização de projetos e geração de documentos. Cabe ao cliente conferir coordenadas, geometrias, áreas, perímetros, memoriais, planilhas, relatórios e mapas antes de utilizá-los profissionalmente.'],
      ['4. Pagamento, ativação e vigência', `O acesso será considerado ativo após a confirmação do pagamento. A vigência inicia em ${formatDate(data.startDate)} e termina em ${formatDate(data.endDate)}. A renovação não é automática e deverá ser solicitada pelos canais oficiais de suporte.`],
      ['5. Vencimento e bloqueio', 'Após o vencimento sem renovação, a conta poderá ser bloqueada automaticamente. A regularização ocorrerá após contato com o suporte, confirmação do pagamento e reativação pelo administrador.'],
      ['6. Dados, segurança e serviços externos', 'O cliente é responsável pela licitude dos dados inseridos e pela proteção de suas credenciais. Mapas, imagens, camadas oficiais, WMS/WFS, autenticação, armazenamento, e-mail e outras integrações podem depender de serviços de terceiros e sofrer indisponibilidades fora do controle do Surveyor.'],
      ['7. Suporte', `O suporte será prestado pelos canais oficiais, incluindo ${data.supportEmail || 'o formulário de suporte do sistema'}. O atendimento abrange orientação de uso, erros e acesso; não inclui execução do trabalho técnico do cliente ou desenvolvimento sob medida, salvo contratação específica.`],
      ['8. Ciência e aceite', 'O cliente declara ter recebido informações sobre o plano, valor, duração, recursos e condições de uso. O pagamento confirmado, o recebimento deste documento e o uso da conta constituem ciência e aceite administrativo das condições registradas, sem necessidade de assinatura manuscrita do cliente neste comprovante.']
    ];
    return [
      media.logo ? wImage('rIdLogo', 'Logo Surveyor', 720000, 720000, 1) : '',
      wParagraph('INSTRUMENTO PARTICULAR DE ADESÃO E CIÊNCIA', { style: 'Title', align: 'center', after: 80 }),
      wParagraph(data.plan.name.toUpperCase(), { style: 'Subtitle', align: 'center', after: 220 }),
      wParagraph(`Documento: ${data.code}`, { style: 'Small', align: 'right', after: 160 }),
      wParagraph('IDENTIFICAÇÃO DO CLIENTE', { style: 'Heading1', keepNext: true }),
      wTable(rows, { widths: [2200, 7200], layoutFixed: true }),
      wParagraph('', { after: 80 }),
      wParagraph('DADOS DA CONTRATAÇÃO', { style: 'Heading1', keepNext: true }),
      wTable(planRows, { widths: [2600, 6800], layoutFixed: true }),
      wParagraph('', { after: 80 }),
      wParagraph('RECURSOS DO PLANO', { style: 'Heading1', keepNext: true }),
      wParagraph(data.plan.summary, { after: 90 }),
      ...data.plan.features.map(wBullet),
      wParagraph('LIMITES COMERCIAIS', { style: 'Heading2', keepNext: true }),
      ...data.plan.limits.map(wBullet),
      ...clauses.flatMap(([title, text]) => [wParagraph(title, { style: 'Heading1', keepNext: true }), wParagraph(text, { after: 120 })]),
      wParagraph(`${data.city || 'Local não informado'}, ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(data.generatedAt)}.`, { align: 'right', before: 120, after: 160 }),
      formalSignatureBlock(data, media),
      wParagraph(`Documento gerado administrativamente pelo Surveyor • ${data.code}`, { style: 'Small', align: 'center' })
    ].join('');
  }

  function receiptBody(data, media) {
    const rows = [
      [wCell('Documento', { bold: true, fill: 'F1F3F5', width: 2600 }), wCell(data.code, { width: 6800 })],
      [wCell('Contratante', { bold: true, fill: 'F1F3F5' }), wCell(data.clientName)],
      [wCell('CPF/CNPJ', { bold: true, fill: 'F1F3F5' }), wCell(data.clientDocument || 'Não informado')],
      [wCell('E-mail', { bold: true, fill: 'F1F3F5' }), wCell(data.clientEmail)],
      [wCell('Plano contratado', { bold: true, fill: 'F1F3F5' }), wCell(data.plan.name)],
      [wCell('Valor pago', { bold: true, fill: 'F1F3F5' }), wCell(formatCurrency(data.amountCents))],
      [wCell('Forma de pagamento', { bold: true, fill: 'F1F3F5' }), wCell(data.paymentMethod || 'Não informada')],
      [wCell('Data do pagamento', { bold: true, fill: 'F1F3F5' }), wCell(formatDate(data.paymentDate))],
      [wCell('Início do acesso', { bold: true, fill: 'F1F3F5' }), wCell(formatDate(data.startDate))],
      [wCell('Vencimento do acesso', { bold: true, fill: 'F1F3F5' }), wCell(formatDate(data.endDate))],
      [wCell('Situação contratual', { bold: true, fill: 'F1F3F5' }), wCell('PAGAMENTO CONFIRMADO E ACESSO ATIVADO', { bold: true, color: '1F2937' })]
    ];
    const credentials = [
      [wCell('E-mail de acesso', { bold: true, fill: 'F1F3F5', width: 2600 }), wCell(data.accessEmail || data.clientEmail, { width: 6800 })],
      [wCell('Primeiro acesso', { bold: true, fill: 'F1F3F5' }), wCell(data.firstAccess || 'Link seguro enviado ao e-mail do cliente')]
    ];
    return [
      media.logo ? wImage('rIdLogo', 'Logo Surveyor', 720000, 720000, 1) : '',
      wParagraph('COMPROVANTE FORMAL DE CONTRATAÇÃO E ATIVAÇÃO', { style: 'Title', align: 'center', after: 80 }),
      wParagraph(data.plan.name.toUpperCase(), { style: 'Subtitle', align: 'center', after: 220 }),
      wParagraph('REGISTRO ADMINISTRATIVO DE PAGAMENTO E VIGÊNCIA', { align: 'center', run: { bold: true, color: '334155', size: 21 }, before: 80, after: 180 }),
      wTable(rows, { widths: [2600, 6800], layoutFixed: true }),
      wParagraph('', { after: 80 }),
      wParagraph('DADOS DE ACESSO', { style: 'Heading1', keepNext: true }),
      wTable(credentials, { widths: [2600, 6800], layoutFixed: true }),
      wParagraph('O cliente cria a própria senha pelo link seguro de primeiro acesso. O Surveyor não inclui senhas em documentos comerciais.', { style: 'Small', after: 150 }),
      wParagraph('RESUMO DO PLANO', { style: 'Heading1', keepNext: true }),
      wParagraph(data.plan.summary, { after: 90 }),
      ...data.plan.features.map(wBullet),
      wParagraph('CONDIÇÕES REGISTRADAS', { style: 'Heading1', keepNext: true }),
      wParagraph(`Este comprovante confirma o recebimento de ${formatCurrency(data.amountCents)} e a ativação do plano ${data.plan.name} no período de ${formatDate(data.startDate)} a ${formatDate(data.endDate)}. A renovação não é automática. Após o vencimento sem renovação, a conta poderá ser bloqueada até a regularização pelo suporte e a reativação administrativa.`, { after: 120 }),
      wParagraph('O cliente deve conferir seus dados e comunicar qualquer divergência ao suporte. Os recursos disponíveis seguem as permissões do plano contratado. Todos os planos possuem geração de documentos sem limite comercial de quantidade; o Plano Pro não possui quota comercial fixa de usuários, projetos ou armazenamento.', { after: 120 }),
      wParagraph(`${data.city || 'Local não informado'}, ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(data.generatedAt)}.`, { align: 'right', before: 120, after: 160 }),
      formalSignatureBlock(data, media),
      wParagraph(`Comprovante gerado administrativamente pelo Surveyor • ${data.code}`, { style: 'Small', align: 'center' })
    ].join('');
  }

  function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:color w:val="172033"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="334155"/><w:sz w:val="25"/><w:szCs w:val="25"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="180" w:after="80"/><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="172033"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="60"/><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="334155"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Small"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="64748B"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style></w:styles>`;
  }

  function numberingXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  }

  async function buildDocx(data) {
    await ensureWordLibrary();
    if (!window.JSZip) throw new Error('Não foi possível carregar o gerador Word. Verifique a conexão e tente novamente.');
    const logo = await loadLogoBytes();
    const signature = state.signatureBytes || (state.signatureDataUrl ? dataUrlToBytes(state.signatureDataUrl) : null) || (() => {
      try {
        const stored = sessionStorage.getItem(SIGNATURE_KEY);
        return stored ? dataUrlToBytes(stored) : null;
      } catch { return null; }
    })();
    const media = { logo: Boolean(logo), signature: Boolean(signature) };
    const body = data.type === 'receipt' ? receiptBody(data, media) : termBody(data, media);
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="400" w:footer="400" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;

    const imageRels = [];
    if (logo) imageRels.push('<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>');
    if (signature) imageRels.push('<Relationship Id="rIdSignature" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/>');
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.folder('docProps').file('core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(data.type === 'receipt' ? 'Comprovante de contratação Surveyor' : 'Termo de adesão Surveyor')}</dc:title><dc:subject>${xmlEscape(data.plan.name)}</dc:subject><dc:creator>Surveyor</dc:creator><cp:lastModifiedBy>Surveyor</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${data.generatedAt.toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${data.generatedAt.toISOString()}</dcterms:modified></cp:coreProperties>`);
    zip.folder('docProps').file('app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Surveyor</Application><Company>Surveyor</Company><AppVersion>21.9.380</AppVersion></Properties>');
    const word = zip.folder('word');
    word.file('document.xml', documentXml);
    word.file('styles.xml', stylesXml());
    word.file('numbering.xml', numberingXml());
    word.file('settings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>');
    word.folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${imageRels.join('')}</Relationships>`);
    if (logo) word.folder('media').file('logo.png', logo);
    if (signature) word.folder('media').file('signature.png', signature);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  async function generateWordDocument() {
    const button = $('planDocGenerate');
    const original = button.textContent;
    try {
      const data = collectData();
      validateData(data);
      saveSettings();
      button.disabled = true;
      button.textContent = 'Gerando Word...';
      const blob = await buildDocx(data);
      const typeName = data.type === 'receipt' ? 'Comprovante_Contratacao_Ativacao_Ciencia' : 'Termo_Adesao_Ciencia';
      const filename = `${typeName}_${slugify(data.plan.name)}_${slugify(data.clientName)}.docx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      notify('Documento Word gerado com sucesso.', 'success');
    } catch (error) {
      console.error('[documentos dos planos]', error);
      notify(error?.message || 'Não foi possível gerar o documento.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }


  function pdfFileName(data) {
    const typeName = data.type === 'receipt' ? 'Comprovante_Contratacao_Ativacao_Ciencia' : 'Termo_Adesao_Ciencia';
    return `${typeName}_${slugify(data.plan.name)}_${slugify(data.clientName)}.pdf`;
  }

  function pdfFingerprint(data) {
    return JSON.stringify({
      type: data.type, plan: data.plan.name, clientName: data.clientName, clientDocument: data.clientDocument,
      clientEmail: data.clientEmail, clientPhone: data.clientPhone, paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate, startDate: data.startDate, endDate: data.endDate,
      amountCents: data.amountCents, accessEmail: data.accessEmail, responsibleName: data.responsibleName,
      responsibleRole: data.responsibleRole, city: data.city, supportEmail: data.supportEmail,
      signature: Boolean(state.signatureDataUrl || state.signatureBytes)
    });
  }

  function pdfDataUrlForSignature(data = {}) {
    if (data.signatureDataUrl) return String(data.signatureDataUrl);
    if (state.signatureDataUrl) return state.signatureDataUrl;
    if (state.signatureBytes) return arrayBufferToDataUrl(state.signatureBytes.buffer, 'image/png');
    try { return sessionStorage.getItem(SIGNATURE_KEY) || ''; } catch { return ''; }
  }

  async function buildPdf(data) {
    await ensurePdfLibrary();
    const JsPdf = window.jspdf?.jsPDF;
    if (!JsPdf) throw new Error('Não foi possível carregar o gerador de PDF. Verifique a conexão e tente novamente.');
    const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = 210, pageH = 297, margin = 17, usable = pageW - margin * 2;
    let y = 16;

    const pageFooter = () => {
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i += 1) {
        doc.setPage(i);
        doc.setDrawColor(210, 218, 229);
        doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
        doc.text(`Surveyor • ${data.code}`, margin, pageH - 7);
        doc.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 7, { align: 'right' });
      }
    };
    const newPage = () => { doc.addPage(); y = 17; };
    const ensure = (height = 12) => { if (y + height > pageH - 18) newPage(); };
    const wrapped = (text, width = usable) => doc.splitTextToSize(String(text || ''), width);
    const paragraph = (text, opts = {}) => {
      const size = opts.size || 9.4; const lineH = opts.lineH || 4.6; const lines = wrapped(text, opts.width || usable);
      ensure(lines.length * lineH + (opts.after || 2));
      doc.setFont('helvetica', opts.bold ? 'bold' : (opts.italic ? 'italic' : 'normal'));
      doc.setFontSize(size); doc.setTextColor(...(opts.color || [31, 41, 55]));
      doc.text(lines, opts.x || margin, y, { align: opts.align || 'left', maxWidth: opts.width || usable });
      y += lines.length * lineH + (opts.after || 2);
    };
    const heading = (text) => {
      ensure(10); y += 1;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(23, 32, 51);
      doc.text(text, margin, y); y += 3;
      doc.setDrawColor(51, 65, 85); doc.line(margin, y, pageW - margin, y); y += 5;
    };
    const table = (rows, labelW = 48) => {
      const valueW = usable - labelW;
      rows.forEach(([label, value]) => {
        const left = wrapped(label, labelW - 5); const right = wrapped(value, valueW - 5);
        const h = Math.max(left.length, right.length) * 4.2 + 5;
        ensure(h);
        doc.setFillColor(244, 246, 248); doc.rect(margin, y, labelW, h, 'F');
        doc.setDrawColor(215, 222, 232); doc.rect(margin, y, usable, h);
        doc.line(margin + labelW, y, margin + labelW, y + h);
        doc.setFontSize(8.5); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
        doc.text(left, margin + 2.5, y + 4.3);
        doc.setFont('helvetica', 'normal'); doc.text(right, margin + labelW + 2.5, y + 4.3);
        y += h;
      });
      y += 4;
    };
    const bullets = (items) => items.forEach((item) => {
      const lines = wrapped(item, usable - 7); const h = lines.length * 4.3 + 1;
      ensure(h); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(31, 41, 55);
      doc.text('•', margin + 1, y); doc.text(lines, margin + 6, y); y += h;
    });

    const logo = await loadLogoBytes().catch(() => null);
    if (logo) {
      try { doc.addImage(arrayBufferToDataUrl(logo.buffer, 'image/png'), 'PNG', pageW / 2 - 8, y, 16, 16); y += 20; } catch { y += 2; }
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(23, 32, 51);
    doc.text(data.type === 'receipt' ? 'COMPROVANTE DE CONTRATAÇÃO, ATIVAÇÃO E CIÊNCIA' : 'INSTRUMENTO PARTICULAR DE ADESÃO E CIÊNCIA', pageW / 2, y, { align: 'center', maxWidth: usable });
    y += 9;
    doc.setFontSize(12); doc.setTextColor(51, 65, 85); doc.text(data.plan.name.toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(100, 116, 139); doc.text(`Documento: ${data.code}`, pageW - margin, y, { align: 'right' }); y += 7;

    if (data.type === 'receipt') {
      heading('REGISTRO DA CONTRATAÇÃO');
      table([
        ['Documento', data.code], ['Contratante', data.clientName], ['CPF/CNPJ', data.clientDocument || 'Não informado'],
        ['E-mail', data.clientEmail], ['Plano contratado', data.plan.name], ['Valor pago', formatCurrency(data.amountCents)],
        ['Forma de pagamento', data.paymentMethod || 'Não informada'], ['Data do pagamento', formatDate(data.paymentDate)],
        ['Início do acesso', formatDate(data.startDate)], ['Vencimento do acesso', formatDate(data.endDate)],
        ['Situação contratual', 'PAGAMENTO CONFIRMADO E ACESSO ATIVADO']
      ]);
      heading('DADOS DE ACESSO');
      table([['E-mail de acesso', data.accessEmail || data.clientEmail], ['Primeiro acesso', data.firstAccess || 'Link seguro enviado ao e-mail do cliente']]);
      paragraph('O cliente cria a própria senha pelo link seguro de primeiro acesso. O Surveyor não inclui senhas em documentos comerciais.', { size: 8, color: [100,116,139] });
      heading('RESUMO DO PLANO'); paragraph(data.plan.summary); bullets(data.plan.features);
      heading('CONDIÇÕES E CIÊNCIA DO TERMO DE ADESÃO');
      paragraph('Ao receber este comprovante e utilizar a conta, o cliente declara ciência das condições do plano, dos limites comerciais, da vigência, das responsabilidades de uso e das regras de renovação e bloqueio descritas neste documento.');
      paragraph(`Este comprovante confirma o recebimento de ${formatCurrency(data.amountCents)} e a ativação do plano ${data.plan.name} no período de ${formatDate(data.startDate)} a ${formatDate(data.endDate)}. A renovação não é automática. Após o vencimento sem renovação, a conta poderá ser bloqueada até a regularização pelo suporte e a reativação administrativa.`);
      paragraph('O cliente deve conferir seus dados e comunicar qualquer divergência ao suporte. Os recursos disponíveis seguem as permissões do plano contratado. Todos os planos possuem geração de documentos sem limite comercial de quantidade.');
    } else {
      heading('IDENTIFICAÇÃO DO CLIENTE');
      table([['Contratante', data.clientName], ['CPF/CNPJ', data.clientDocument || 'Não informado'], ['E-mail', data.clientEmail], ['Telefone', data.clientPhone || 'Não informado']]);
      heading('DADOS DA CONTRATAÇÃO');
      table([['Plano contratado', data.plan.name], ['Valor pago', formatCurrency(data.amountCents)], ['Forma de pagamento', data.paymentMethod || 'Não informada'], ['Data do pagamento', formatDate(data.paymentDate)], ['Início do plano', formatDate(data.startDate)], ['Vencimento do plano', formatDate(data.endDate)]]);
      heading('RECURSOS DO PLANO'); paragraph(data.plan.summary); bullets(data.plan.features);
      heading('LIMITES COMERCIAIS'); bullets(data.plan.limits);
      const clauses = [
        ['1. Objeto', `Este Termo registra a contratação de licença temporária, pessoal, não exclusiva e intransferível de uso do software Surveyor no plano ${data.plan.name}, durante o período indicado. A contratação não transfere propriedade do software, código-fonte, marca, estrutura, integrações ou demais direitos do Surveyor.`],
        ['2. Recursos e permissões', 'O cliente terá acesso somente aos módulos, ferramentas e ações liberados para o plano contratado. Recursos não incluídos podem não aparecer na interface e o acesso direto pode ser recusado.'],
        ['3. Responsabilidade pelo uso', 'O Surveyor é uma ferramenta de apoio a atividades de georreferenciamento, agrimensura, cadastro, organização de projetos e geração de documentos. Cabe ao cliente conferir todos os dados antes do uso profissional.'],
        ['4. Pagamento, ativação e vigência', `O acesso será considerado ativo após a confirmação do pagamento. A vigência inicia em ${formatDate(data.startDate)} e termina em ${formatDate(data.endDate)}. A renovação não é automática.`],
        ['5. Vencimento e bloqueio', 'Após o vencimento sem renovação, a conta poderá ser bloqueada automaticamente. A regularização ocorrerá após contato com o suporte, confirmação do pagamento e reativação pelo administrador.'],
        ['6. Dados, segurança e serviços externos', 'O cliente é responsável pela licitude dos dados inseridos e pela proteção de suas credenciais. Serviços externos podem sofrer indisponibilidades fora do controle do Surveyor.'],
        ['7. Suporte', `O suporte será prestado pelos canais oficiais, incluindo ${data.supportEmail || 'o formulário de suporte do sistema'}.`],
        ['8. Ciência e aceite', 'O cliente declara ter recebido informações sobre o plano, valor, duração, recursos e condições de uso. O pagamento confirmado, o recebimento deste documento e o uso da conta constituem ciência e aceite administrativo.']
      ];
      clauses.forEach(([title, body]) => { heading(title); paragraph(body); });
    }

    paragraph(`${data.city || 'Local não informado'}, ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(data.generatedAt)}.`, { align: 'right', after: 5 });
    ensure(48);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(23,32,51); doc.text('ASSINATURA ADMINISTRATIVA', pageW / 2, y, { align: 'center' }); y += 5;
    const signature = pdfDataUrlForSignature(data);
    const signaturePosition = normalizeSignaturePosition(data.signaturePosition || state.signaturePosition);
    if (signature) {
      const signatureWidth = 54 * signaturePosition.scale / 100;
      const signatureHeight = 18 * signaturePosition.scale / 100;
      const desiredCenterX = margin + usable * signaturePosition.x / 100;
      const signatureX = Math.max(margin, Math.min(pageW - margin - signatureWidth, desiredCenterX - signatureWidth / 2));
      const verticalOffset = Math.max(-4, Math.min(7, (signaturePosition.y - 44) / 6));
      const signatureY = y + verticalOffset;
      try { doc.addImage(signature, 'PNG', signatureX, signatureY, signatureWidth, signatureHeight, undefined, 'FAST'); y += Math.max(18, signatureHeight + Math.max(0, verticalOffset)); } catch { y += 14; }
    } else { y += 14; }
    doc.setDrawColor(51,65,85); doc.line(pageW / 2 - 45, y, pageW / 2 + 45, y); y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(31,41,55); doc.text(data.responsibleName, pageW / 2, y, { align: 'center' }); y += 4.5;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.text(data.responsibleRole || 'Responsável administrativo pelo Surveyor', pageW / 2, y, { align: 'center' });
    pageFooter();
    return doc.output('blob');
  }

  async function ensurePdf() {
    const data = collectData(); validateData(data); saveSettings();
    const fingerprint = pdfFingerprint(data);
    if (state.lastPdf && state.lastPdf.fingerprint === fingerprint) return state.lastPdf;
    const blob = await buildPdf(data);
    if (state.lastPdf?.url) URL.revokeObjectURL(state.lastPdf.url);
    const url = URL.createObjectURL(blob);
    state.lastPdf = { blob, url, data, filename: pdfFileName(data), fingerprint };
    return state.lastPdf;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function generatePdfDocument() {
    const button = $('planDocGeneratePdf'); const original = button.textContent;
    try { button.disabled = true; button.textContent = 'Gerando PDF...'; const pdf = await ensurePdf(); downloadBlob(pdf.blob, pdf.filename); notify('Documento PDF gerado com sucesso.', 'success'); }
    catch (error) { console.error('[documentos dos planos PDF]', error); notify(error?.message || 'Não foi possível gerar o PDF.', 'error'); }
    finally { button.disabled = false; button.textContent = original; }
  }

  async function openPdfPreview() {
    try {
      const pdf = await ensurePdf();
      $('planDocPdfFrame').src = `${pdf.url}#page=1&zoom=page-width&toolbar=1&navpanes=1&scrollbar=1`;
      $('planDocPdfModalTitle').textContent = pdf.data.type === 'receipt' ? 'Comprovante de contratação' : 'Termo de adesão';
      $('planDocPdfModal').classList.remove('hidden');
    } catch (error) { notify(error?.message || 'Não foi possível visualizar o PDF.', 'error'); }
  }

  function closePdfPreview() { $('planDocPdfModal')?.classList.add('hidden'); $('planDocPdfFrame')?.removeAttribute('src'); }

  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '').split(',')[1] || ''); reader.onerror = reject; reader.readAsDataURL(blob); });
  }

  async function sendPdfByEmail() {
    const button = $('planDocSendEmail'); const modalButton = $('planDocPdfSend');
    const original = button?.textContent || '';
    try {
      const pdf = await ensurePdf();
      const email = pdf.data.clientEmail;
      if (!window.confirm(`Enviar ${pdf.data.type === 'receipt' ? 'o comprovante' : 'o termo'} em PDF para ${email}?`)) return;
      if (button) { button.disabled = true; button.textContent = 'Enviando...'; }
      if (modalButton) modalButton.disabled = true;
      const contentBase64 = await blobToBase64(pdf.blob);
      if (!auth?.sendPlanDocumentEmail) throw new Error('A API de envio de documentos ainda não está disponível.');
      await auth.sendPlanDocumentEmail({
        to: email, name: pdf.data.clientName, planName: pdf.data.plan.name,
        documentType: pdf.data.type, filename: pdf.filename, contentBase64,
        startDate: pdf.data.startDate, endDate: pdf.data.endDate, accessEmail: pdf.data.accessEmail || email,
        amountCents: pdf.data.amountCents, documentCode: pdf.data.code
      });
      notify(`PDF enviado com sucesso para ${email}.`, 'success');
    } catch (error) { console.error('[documentos dos planos e-mail]', error); notify(error?.message || 'Não foi possível enviar o PDF por e-mail.', 'error'); }
    finally { if (button) { button.disabled = false; button.textContent = original; } if (modalButton) modalButton.disabled = false; }
  }


  async function useOfficialKauaSignature({ notifyUser = true } = {}) {
    try {
      const response = await fetch(OFFICIAL_SIGNATURE_URL, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Assinatura padrão indisponível (${response.status}).`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const dataUrl = arrayBufferToDataUrl(bytes.buffer, 'image/png');
      state.signatureBytes = bytes;
      state.signatureDataUrl = dataUrl;
      sessionStorage.setItem(SIGNATURE_KEY, dataUrl);
      $('planDocSignaturePreview').src = dataUrl;
      $('planDocSignaturePreviewWrap').classList.remove('hidden');
      state.signaturePosition = normalizeSignaturePosition({ x: 50, y: 44, scale: 100 });
      updateSignatureEditor();
      if (notifyUser) notify('Assinatura de Kauã preenchida. Ajuste a posição e salve na conta administrativa.', 'success');
      return true;
    } catch (error) {
      console.error('[documentos dos planos] assinatura padrão', error);
      if (notifyUser) notify(error?.message || 'Não foi possível carregar a assinatura padrão.', 'error');
      return false;
    }
  }

  async function handleSignatureFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state.signatureBytes = await imageFileToPngBytes(file);
      const dataUrl = arrayBufferToDataUrl(state.signatureBytes.buffer, 'image/png');
      state.signatureDataUrl = dataUrl;
      sessionStorage.setItem(SIGNATURE_KEY, dataUrl);
      $('planDocSignaturePreview').src = dataUrl;
      $('planDocSignaturePreviewWrap').classList.remove('hidden');
      updateSignatureEditor();
      notify('Assinatura carregada. Posicione-a na área final do documento e salve na conta.', 'success');
    } catch (error) {
      notify('Não foi possível carregar a assinatura. Use uma imagem PNG ou JPG.', 'error');
    }
  }

  function clearSignature() {
    state.signatureBytes = null;
    state.signatureDataUrl = '';
    sessionStorage.removeItem(SIGNATURE_KEY);
    $('planDocSignature').value = '';
    $('planDocSignaturePreview').removeAttribute('src');
    $('planDocSignaturePreviewWrap').classList.add('hidden');
    updateSignatureEditor();
    notify('Assinatura removida da sessão local. Use Salvar na conta para confirmar a remoção remota.', 'success');
  }

  function normalizeSignaturePosition(value = {}) {
    return {
      x: Math.max(0, Math.min(100, Number(value.x ?? 50))),
      y: Math.max(0, Math.min(100, Number(value.y ?? 44))),
      scale: Math.max(70, Math.min(150, Number(value.scale ?? 100)))
    };
  }

  function updateSignatureEditor() {
    const image = $('planDocSignatureDraggable');
    const placeholder = $('planDocSignaturePlaceholder');
    const dataUrl = state.signatureDataUrl || (state.signatureBytes ? arrayBufferToDataUrl(state.signatureBytes.buffer, 'image/png') : '');
    if (image) {
      if (dataUrl) {
        image.src = dataUrl;
        image.classList.remove('hidden');
        image.style.left = `${state.signaturePosition.x}%`;
        image.style.top = `${state.signaturePosition.y}%`;
        image.style.width = `${220 * state.signaturePosition.scale / 100}px`;
      } else {
        image.removeAttribute('src');
        image.classList.add('hidden');
      }
    }
    placeholder?.classList.toggle('hidden', Boolean(dataUrl));
    if ($('planDocSignatureScale')) $('planDocSignatureScale').value = String(state.signaturePosition.scale);
    if ($('planDocSignatureScaleOutput')) $('planDocSignatureScaleOutput').textContent = `${Math.round(state.signaturePosition.scale)}%`;
    sessionStorage.setItem(SIGNATURE_POSITION_KEY, JSON.stringify(state.signaturePosition));
  }

  function pointerToSignaturePosition(event) {
    const zone = $('planDocSignatureZone');
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    state.signaturePosition.x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    state.signaturePosition.y = Math.max(4, Math.min(80, ((event.clientY - rect.top) / rect.height) * 100));
    updateSignatureEditor();
  }

  function startSignatureDrag(event) {
    if (!state.signatureDataUrl && !state.signatureBytes) return;
    state.dragging = true;
    $('planDocSignatureDraggable')?.classList.add('dragging');
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    pointerToSignaturePosition(event);
  }

  function moveSignatureDrag(event) {
    if (!state.dragging) return;
    pointerToSignaturePosition(event);
  }

  function stopSignatureDrag() {
    state.dragging = false;
    $('planDocSignatureDraggable')?.classList.remove('dragging');
  }

  async function loadSignerAccountSettings() {
    try {
      const custom = await auth?.getDocumentCustomization?.({ forceRefresh: true });
      state.customization = custom || {};
      const settings = custom?.options?.planDocumentSigner || {};
      if (settings.name) $('planDocResponsibleName').value = settings.name;
      if (settings.role) $('planDocResponsibleRole').value = settings.role;
      if (settings.city) $('planDocCity').value = settings.city;
      if (settings.supportEmail) $('planDocSupportEmail').value = settings.supportEmail;
      state.signaturePosition = normalizeSignaturePosition(settings.position || state.signaturePosition);
      const remoteSignature = String(custom?.planDocumentSignatureDataUrl || settings.signatureDataUrl || '');
      if (remoteSignature) {
        state.signatureDataUrl = remoteSignature;
        state.signatureBytes = dataUrlToBytes(remoteSignature);
        $('planDocSignaturePreview').src = remoteSignature;
        $('planDocSignaturePreviewWrap').classList.remove('hidden');
        sessionStorage.setItem(SIGNATURE_KEY, remoteSignature);
      } else if (!state.signatureDataUrl && !state.signatureBytes) {
        await useOfficialKauaSignature({ notifyUser: false });
      }
      updateSignatureEditor();
    } catch (error) {
      console.warn('[documentos dos planos] assinatura da conta indisponível', error);
      if (!state.signatureDataUrl && !state.signatureBytes) await useOfficialKauaSignature({ notifyUser: false });
    }
  }

  async function saveSignerAccountSettings() {
    const button = $('planDocSaveSignatureAccount');
    const original = button.textContent;
    try {
      if (!auth?.saveDocumentCustomization) throw new Error('A integração de personalização da conta não está disponível.');
      button.disabled = true;
      button.textContent = 'Salvando na conta...';
      const current = state.customization || await auth.getDocumentCustomization({ forceRefresh: true }).catch(() => ({}));
      const currentOptions = current?.options && typeof current.options === 'object' ? current.options : {};
      const signer = {
        name: $('planDocResponsibleName').value.trim(), role: $('planDocResponsibleRole').value.trim(),
        city: $('planDocCity').value.trim(), supportEmail: $('planDocSupportEmail').value.trim(),
        position: { ...state.signaturePosition }
      };
      const saved = await auth.saveDocumentCustomization({
        planDocumentSignatureDataUrl: state.signatureDataUrl || '',
        options: { ...currentOptions, planDocumentSigner: signer }
      });
      state.customization = saved || current;
      saveSettings();
      notify('Assinatura, responsável e posição salvos na conta administrativa.', 'success');
    } catch (error) {
      console.error('[documentos dos planos] salvar assinatura', error);
      notify(error?.message || 'Não foi possível salvar a assinatura na conta.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function loadData() {
    const results = await Promise.allSettled([
      auth?.loadUsers?.({ forceRefresh: true }) || Promise.resolve([]),
      auth?.loadPlans?.({ forceRefresh: true }) || Promise.resolve([])
    ]);
    if (results[0].status === 'fulfilled') state.users = results[0].value || [];
    if (results[1].status === 'fulfilled') state.plans = results[1].value || [];
    populateUserOptions();
    populatePlanOptions();
    syncPlanFields();
  }

  async function createOnboardingPdf(input = {}) {
    const settings = readSettings();
    const plan = getPlan(String(input.planSlug || 'basic_annual'));
    let signatureDataUrl = String(input.signatureDataUrl || state.signatureDataUrl || sessionStorage.getItem(SIGNATURE_KEY) || '');
    if (!signatureDataUrl) {
      try {
        const response = await fetch(OFFICIAL_SIGNATURE_URL, { cache: 'force-cache' });
        if (response.ok) signatureDataUrl = arrayBufferToDataUrl(await response.arrayBuffer(), 'image/png');
      } catch {}
    }
    const type = 'receipt';
    const data = {
      type,
      code: documentCode(type),
      plan,
      clientName: String(input.clientName || '').trim(),
      clientDocument: String(input.clientDocument || '').trim(),
      clientEmail: String(input.clientEmail || '').trim(),
      clientPhone: String(input.clientPhone || '').trim(),
      paymentMethod: String(input.paymentMethod || 'Pix').trim(),
      paymentDate: String(input.paymentDate || input.startDate || isoToday()).slice(0, 10),
      startDate: String(input.startDate || isoToday()).slice(0, 10),
      endDate: String(input.endDate || '').slice(0, 10),
      amountCents: Number(input.amountCents || plan.priceCents || 0),
      accessEmail: String(input.accessEmail || input.clientEmail || '').trim(),
      firstAccess: 'Link seguro enviado ao e-mail do cliente',
      responsibleName: String(input.responsibleName || settings.responsibleName || $('planDocResponsibleName')?.value || 'Kauã França').trim(),
      responsibleRole: String(input.responsibleRole || settings.responsibleRole || $('planDocResponsibleRole')?.value || 'Responsável administrativo pelo Surveyor').trim(),
      city: String(input.city || settings.city || $('planDocCity')?.value || 'Amargosa/BA').trim(),
      supportEmail: String(input.supportEmail || settings.supportEmail || $('planDocSupportEmail')?.value || 'suporte@surveyorr.com.br').trim(),
      signatureDataUrl,
      signaturePosition: normalizeSignaturePosition(input.signaturePosition || settings.signaturePosition || state.signaturePosition),
      generatedAt: new Date()
    };
    validateData(data);
    const blob = await buildPdf(data);
    return { blob, filename: pdfFileName(data), data };
  }

  function getOnboardingSignatureSettings() {
    const settings = readSettings();
    let signatureDataUrl = '';
    try { signatureDataUrl = state.signatureDataUrl || sessionStorage.getItem(SIGNATURE_KEY) || ''; } catch {}
    return {
      signatureDataUrl,
      signaturePosition: normalizeSignaturePosition(settings.signaturePosition || state.signaturePosition),
      responsibleName: settings.responsibleName || $('planDocResponsibleName')?.value || 'Kauã França',
      responsibleRole: settings.responsibleRole || $('planDocResponsibleRole')?.value || 'Responsável administrativo pelo Surveyor',
      city: settings.city || $('planDocCity')?.value || 'Amargosa/BA',
      supportEmail: settings.supportEmail || $('planDocSupportEmail')?.value || 'suporte@surveyorr.com.br'
    };
  }

  window.SurveyorPlanDocuments = Object.freeze({
    createOnboardingPdf,
    getOnboardingSignatureSettings,
    officialSignatureUrl: OFFICIAL_SIGNATURE_URL,
    normalizeSignaturePosition
  });

  function init() {
    if (state.initialized) return;
    const current = auth?.currentUser?.();
    const tabButton = document.querySelector('[data-tab="plan-documents"]');
    const panel = $('tab-plan-documents');
    if (!strictAdmin(current)) {
      tabButton?.remove();
      panel?.remove();
      return;
    }
    if (!panel) return;
    tabButton?.classList.remove('hidden');
    state.initialized = true;
    const settings = readSettings();
    try { state.signaturePosition = normalizeSignaturePosition(settings.signaturePosition || JSON.parse(sessionStorage.getItem(SIGNATURE_POSITION_KEY) || '{}')); } catch { state.signaturePosition = normalizeSignaturePosition({}); }
    $('planDocResponsibleName').value = settings.responsibleName || 'Kauã França';
    $('planDocResponsibleRole').value = settings.responsibleRole || 'Desenvolvedor responsável pelo Surveyor';
    $('planDocCity').value = settings.city || 'Amargosa/BA';
    $('planDocSupportEmail').value = settings.supportEmail || 'suporte@surveyorr.com.br';
    $('planDocStartDate').value = isoToday();
    $('planDocPaymentDate').value = isoToday();
    const storedSignature = sessionStorage.getItem(SIGNATURE_KEY);
    if (storedSignature) {
      try {
        state.signatureDataUrl = storedSignature;
        state.signatureBytes = dataUrlToBytes(storedSignature);
        $('planDocSignaturePreview').src = storedSignature;
        $('planDocSignaturePreviewWrap').classList.remove('hidden');
      } catch {}
    }
    $('planDocUser').addEventListener('change', syncUserFields);
    $('planDocPlan').addEventListener('change', () => syncPlanFields());
    $('planDocStartDate').addEventListener('change', () => syncPlanFields());
    $('planDocType').addEventListener('change', toggleDocumentFields);
    $('planDocSignature').addEventListener('change', handleSignatureFile);
    $('planDocUseKauaSignature').addEventListener('click', () => useOfficialKauaSignature());
    $('planDocClearSignature').addEventListener('click', clearSignature);
    $('planDocSaveSignatureAccount').addEventListener('click', saveSignerAccountSettings);
    $('planDocResetSignaturePosition').addEventListener('click', () => { state.signaturePosition = { x: 50, y: 44, scale: 100 }; updateSignatureEditor(); });
    $('planDocSignatureScale').addEventListener('input', (event) => { state.signaturePosition.scale = Number(event.target.value || 100); updateSignatureEditor(); });
    $('planDocSignatureZone').addEventListener('pointerdown', startSignatureDrag);
    $('planDocSignatureZone').addEventListener('pointermove', moveSignatureDrag);
    $('planDocSignatureZone').addEventListener('pointerup', stopSignatureDrag);
    $('planDocSignatureZone').addEventListener('pointercancel', stopSignatureDrag);
    $('planDocGenerate').addEventListener('click', generateWordDocument);
    $('planDocGeneratePdf')?.addEventListener('click', generatePdfDocument);
    $('planDocPreviewPdf')?.addEventListener('click', openPdfPreview);
    $('planDocSendEmail')?.addEventListener('click', sendPdfByEmail);
    $('planDocPdfClose')?.addEventListener('click', closePdfPreview);
    $('planDocPdfDownload')?.addEventListener('click', async () => { const pdf = await ensurePdf(); downloadBlob(pdf.blob, pdf.filename); });
    $('planDocPdfSend')?.addEventListener('click', sendPdfByEmail);
    $('planDocPdfModal')?.addEventListener('click', (event) => { if (event.target === $('planDocPdfModal')) closePdfPreview(); });
    panel.querySelectorAll('input,select').forEach((input) => input.addEventListener('input', () => { state.lastPdf = null; renderPreview(); }));
    document.querySelector('[data-tab="plan-documents"]')?.addEventListener('click', loadData);
    populatePlanOptions();
    toggleDocumentFields();
    updateSignatureEditor();
    loadSignerAccountSettings();
    loadData().catch((error) => console.warn('[documentos dos planos]', error));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
