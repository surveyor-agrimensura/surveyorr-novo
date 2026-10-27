(() => {
  'use strict';
  const auth = window.SurveyorAuth || window.GeoRuralAuth;
  // A interface deve inicializar mesmo enquanto a sessão ainda está sendo reidratada.
  // As chamadas de API continuam protegidas pelo módulo de autenticação.
  const $ = (id) => document.getElementById(id);
  let logoDataUrl = '';
  let signatureDataUrl = '';
  let signatureTouched = false;
  let lastSignatureSourceFile = null;
  let loadedCustomization = {};
  const identityTouchedFields = new Set();
  let baseTemplateContent = '';
  let baseTemplateName = '';
  let selectedTarget = 'memorial';
  let modelModes = {};
  let customModelTargets = {};
  let currentModelMode = 'standard';
  let selectedMemorialTemplateId = 'standard';
  function preferenceApi(){ return window.SurveyorMemorialPreference; }
  function validMemorialTemplateId(id){ const api=window.SurveyorMemorialTemplates; if(!api?.items?.some((item)=>item.id===id)) return false; return api?.canUse ? api.canUse(id,loadedCustomization||{}) : true; }
  function firstCustomMemorialTemplateId(){ const api=window.SurveyorMemorialTemplates; const items=api?.itemsForCustomization?api.itemsForCustomization(loadedCustomization||{}):(api?.items||[]); return items.find?.((item)=>item.id!=='standard')?.id || 'standard'; }
  function readRememberedMemorialTemplate(){ return preferenceApi()?.read?.()?.id || ''; }
  function rememberMemorialTemplate(id){
    if(!validMemorialTemplateId(id)) return null;
    return preferenceApi()?.write?.(id,{explicit:true,source:'customizacao'}) || null;
  }


  function toast(message, type = '') {
    const el = $('suiteToast'); el.textContent = message; el.className = `toast show ${type}`;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.className = 'toast'; }, 3200);
  }
  const escape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const safeUrl = (value) => { try { const url = new URL(String(value || ''), location.href); return ['http:','https:'].includes(url.protocol) ? escape(url.href) : ''; } catch { return ''; } };

  function fieldValue(id) { return String($(id)?.value || '').trim(); }

  function upgradeCustomizationHubUi() {
    const pageTitle = document.querySelector('header.top h1');
    if (pageTitle) pageTitle.textContent = 'Personalização';
    const pageDescription = document.querySelector('header.top p');
    if (pageDescription) pageDescription.textContent = 'Configure e personalize seus documentos e relatórios. Complete os módulos abaixo para uma experiência completa.';
    const summary = document.querySelector('.customization-progress-summary');
    if (summary && summary.dataset.hubStyleApplied !== '1') {
      summary.dataset.hubStyleApplied = '1';
      summary.innerHTML = `
        <output id="customizationProgressOutput" aria-live="polite">0%</output>
        <div>
          <strong id="customizationProgressLabel">Progresso geral</strong>
          <b id="customizationProgressHeadline">Sua personalização está quase pronta!</b>
          <span id="customizationProgressText">Complete os módulos pendentes para liberar todos os recursos.</span>
        </div>
        <button class="btn primary customization-review-btn" id="customizationReviewAll" type="button">Revisar tudo</button>`;
      summary.querySelector('#customizationReviewAll')?.addEventListener('click', () => {
        const cards = Array.from(document.querySelectorAll('.custom-target-card[data-target]'));
        const firstIncomplete = cards.find((card) => !card.classList.contains('is-complete'));
        const target = (firstIncomplete || cards[0])?.dataset?.target || 'empresa';
        setTarget(target);
      });
    }
  }
  function companyCompletion() {
    const checks = [
      Boolean(fieldValue('companyName')),
      Boolean(fieldValue('addressText')),
      Boolean(fieldValue('phoneNumber') || fieldValue('whatsappNumber') || fieldValue('emailAddress')),
      Boolean(logoDataUrl)
    ];
    return { completed: checks.filter(Boolean).length, total: checks.length, complete: checks.every(Boolean) };
  }
  function technicianCompletion() {
    const checks = [
      Boolean(fieldValue('responsibleTechnician')),
      Boolean(fieldValue('professionalRegistry')),
      Boolean(fieldValue('professionalTitle')),
      Boolean(signatureDataUrl)
    ];
    return { completed: checks.filter(Boolean).length, total: checks.length, complete: checks.every(Boolean) };
  }
  function targetCompletion(target) {
    const company = companyCompletion();
    const technician = technicianCompletion();
    if (target === 'empresa') return company;
    if (target === 'tecnico') return technician;
    if (target === 'memorial') {
      const checks = [company.complete, technician.complete, validMemorialTemplateId(selectedMemorialTemplateId)];
      return { completed: checks.filter(Boolean).length, total: checks.length, complete: checks.every(Boolean) };
    }
    if (target === 'car') {
      const checks = [company.complete, technician.complete, Boolean(fieldValue('carReportTitle'))];
      return { completed: checks.filter(Boolean).length, total: checks.length, complete: checks.every(Boolean) };
    }
    if (target === 'loteamento') {
      const checks = [company.complete, technician.complete, Boolean(fieldValue('lotReportTitle'))];
      return { completed: checks.filter(Boolean).length, total: checks.length, complete: checks.every(Boolean) };
    }
    if (target === 'mapas') {
      const checks = [company.complete, technician.complete, Boolean(document.querySelector('input[name="mapCroquiTemplate"]:checked')?.value)];
      return { completed: checks.filter(Boolean).length, total: checks.length, complete: checks.every(Boolean) };
    }
    const checks = [company.complete, technician.complete];
    return { completed: checks.filter(Boolean).length, total: checks.length, complete: checks.every(Boolean) };
  }
  function updateLogoPreview() {
    const wrap = $('logoPreviewWrap');
    const image = $('logoPreview');
    const state = $('logoUploadState');
    if (image && wrap) {
      if (logoDataUrl) {
        image.src = logoDataUrl;
        wrap.hidden = false;
      } else {
        image.removeAttribute('src');
        wrap.hidden = true;
      }
    }
    if (state) state.textContent = logoDataUrl ? 'Logotipo anexado e pronto para uso nos documentos.' : 'Nenhum logotipo anexado.';
  }
  function dependencyMarkup() {
    const company = companyCompletion();
    const technician = technicianCompletion();
    const item = (target, title, state) => `<div class="module-dependency-item"><span>${escape(title)}</span><span class="module-dependency-state ${state.complete ? 'complete' : 'incomplete'}">${state.complete ? '✓ Completo' : `✕ ${state.completed}/${state.total}`}</span><button type="button" data-open-target="${target}">Editar</button></div>`;
    return item('empresa', 'Dados da empresa', company) + item('tecnico', 'Responsável técnico', technician);
  }
  function updateCustomizationStatuses() {
    const targets = ['empresa','tecnico','memorial','mapas','pranchas','planialtimetria','perimetro','ambiental','car','loteamento'];
    targets.forEach((target) => {
      const state = targetCompletion(target);
      const card = document.querySelector(`.custom-target-card[data-target="${target}"]`);
      const status = document.querySelector(`[data-status-target="${target}"]`);
      const count = document.querySelector(`[data-count-target="${target}"]`);
      const sectionStatus = document.querySelector(`[data-section-status="${target}"]`);
      card?.classList.toggle('is-complete', state.complete);
      if (status) {
        const automatic = ['mapas','pranchas','planialtimetria','perimetro','ambiental'].includes(target);
        status.classList.toggle('is-complete', state.complete);
        status.classList.toggle('is-waiting', automatic && !state.complete);
        if (state.complete) status.textContent = automatic ? 'Identidade aplicada' : 'Concluído';
        else if (automatic) status.textContent = 'Aguardando identidade';
        else if (target === 'memorial' || target === 'car' || target === 'loteamento') status.textContent = 'Configuração pendente';
        else status.textContent = 'Precisa concluir';
      }
      if (count) count.textContent = `${state.completed}/${state.total}`;
      const bar = card?.querySelector('.custom-target-progress-bar span');
      if (bar) bar.style.width = `${Math.round((state.completed / Math.max(1, state.total)) * 100)}%`;
      if (sectionStatus) {
        const automatic = ['mapas','pranchas','planialtimetria','perimetro','ambiental'].includes(target);
        sectionStatus.classList.toggle('is-complete', state.complete);
        sectionStatus.classList.toggle('is-waiting', automatic && !state.complete);
        sectionStatus.textContent = state.complete
          ? (automatic ? '✓ Identidade aplicada' : '✓ Completo')
          : (automatic ? `${state.completed}/${state.total} itens da identidade` : `${state.completed}/${state.total} concluídos`);
      }
    });
    document.querySelectorAll('[data-dependencies]').forEach((host) => { host.innerHTML = dependencyMarkup(); });
    const company = companyCompletion();
    const technician = technicianCompletion();
    const completed = company.completed + technician.completed;
    const total = company.total + technician.total;
    const percent = Math.round((completed / Math.max(1, total)) * 100);
    const progressHeadline = $('customizationProgressHeadline');
    const progressText = $('customizationProgressText');
    if (progressHeadline) progressHeadline.textContent = percent >= 100
      ? 'Sua personalização está pronta!'
      : percent >= 75
        ? 'Sua personalização está quase pronta!'
        : percent >= 35
          ? 'Sua personalização já começou muito bem!'
          : 'Vamos começar a sua personalização';
    if (progressText) progressText.textContent = percent >= 100
      ? 'Todos os módulos essenciais foram configurados e estão prontos para uso.'
      : completed === total
        ? 'Identidade profissional completa e pronta para todos os módulos.'
        : 'Complete os módulos pendentes para liberar todos os recursos.';
    const progressOutput = $('customizationProgressOutput');
    if (progressOutput) {
      progressOutput.textContent = `${percent}%`;
      progressOutput.style.setProperty('--progress', String(percent));
    }
  }
  function configureEditorActions(target = selectedTarget) {
    const automatic = ['mapas','pranchas','planialtimetria','perimetro','ambiental'].includes(target);
    const resettable = ['memorial','car','loteamento'].includes(target);
    const submit = document.querySelector('#customizationForm .editor-actions button[type="submit"]');
    const reset = $('resetCustomization');
    if (submit) submit.hidden = automatic;
    if (reset) reset.hidden = !resettable;
    const top = $('saveCustomizationTop');
    if (top) top.hidden = automatic;
    const help = $('editorActionHelp');
    if (help) help.textContent = automatic
      ? 'Este módulo usa automaticamente os dados da empresa e do responsável técnico. Não há informações duplicadas para salvar aqui.'
      : 'As alterações são salvas na sua conta Appwrite e reutilizadas automaticamente.';
  }

  function targetLabel(target = selectedTarget) {
    return {
      empresa: 'DADOS DA EMPRESA', tecnico: 'RESPONSÁVEL TÉCNICO', memorial: 'MEMORIAL DESCRITIVO', mapas: 'MAPAS E PERFIS', pranchas: 'PRANCHA TÉCNICA', planialtimetria: 'PLANIALTIMETRIA', perimetro: 'PERÍMETRO', ambiental: 'RELATÓRIO AMBIENTAL', car: 'RELATÓRIO CAR', loteamento: 'LOTEAMENTOS / REURB'
    }[target] || 'DOCUMENTO TÉCNICO';
  }
  function documentDisplayName(target = selectedTarget) {
    return {
      empresa: 'Dados da empresa', tecnico: 'Responsável técnico e assinatura', memorial: 'Memorial descritivo', mapas: 'Mapas e perfis', pranchas: 'Prancha técnica', planialtimetria: 'Planialtimetria', perimetro: 'Perímetro', ambiental: 'Relatório ambiental', car: 'Módulo CAR', loteamento: 'Loteamentos / REURB'
    }[target] || 'Documento técnico';
  }
  function setCustomizationView(view='chooser'){
    const choosing=view!=='editor';
    const chooser=$('customizationChooser');
    const editor=$('customizationEditor');
    const saveTop=$('saveCustomizationTop');
    if(chooser) chooser.hidden=!choosing;
    if(editor) editor.hidden=choosing;
    if(saveTop) saveTop.hidden=choosing;
    document.body.dataset.customizationView=choosing?'chooser':'editor';
  }
  function closeDocumentPicker(){
    setCustomizationView('editor');
    requestAnimationFrame(()=>$('documentPickerSummary')?.scrollIntoView?.({block:'start',behavior:'smooth'}));
  }
  function openDocumentPicker(){
    setCustomizationView('chooser');
    document.querySelectorAll('.custom-target-card').forEach((btn)=>btn.classList.remove('active'));
    updateCustomizationStatuses();
    requestAnimationFrame(()=>$('customizationChooser')?.scrollIntoView?.({block:'start',behavior:'smooth'}));
  }
  function setTarget(target) {
    if(!target) return openDocumentPicker();
    selectedTarget = target;
    $('customizationTarget').value = selectedTarget;
    document.querySelectorAll('.custom-target-card').forEach((btn) => btn.classList.toggle('active', btn.dataset.target === selectedTarget));
    document.querySelectorAll('.custom-section[data-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === selectedTarget));
    const selectedLabel=$('selectedDocumentLabel'); if(selectedLabel) selectedLabel.textContent=documentDisplayName(selectedTarget);
    closeDocumentPicker();
    currentModelMode = selectedTarget === 'memorial' ? (selectedMemorialTemplateId === 'standard' ? 'standard' : 'custom') : 'standard';
    const modelPanel = document.querySelector('.model-choice-panel'); if (modelPanel) modelPanel.dataset.hidden = selectedTarget === 'memorial' ? 'false' : 'true';
    configureEditorActions(selectedTarget);
    updateModelModeUi();
    renderCustomModelList();
    updateCustomizationStatuses();
    renderPreview({ resetScroll: true });
  }
  function selectedCroquiTemplateId() {
    return document.querySelector('input[name="mapCroquiTemplate"]:checked')?.value || 'classic';
  }
  function croquiTemplateName(id = selectedCroquiTemplateId()) {
    return id === 'rural-reference' ? 'Planta do Imóvel Rural' : 'Modelo padrão Surveyor';
  }
  function updateCroquiTemplateSaveState(saved = false) {
    const state = $('croquiTemplateSaveState');
    const hint = $('croquiTemplateSaveHint');
    const button = $('saveMapCroquiTemplate');
    if (!state || !hint) return;
    const name = croquiTemplateName();
    state.textContent = `${saved ? 'Modelo salvo' : 'Modelo selecionado'}: ${name}`;
    hint.textContent = saved
      ? 'Esta opção ficará ativa nas próximas gerações de Mapas e croquis.'
      : 'Alteração ainda não salva. Clique em “Salvar modelo” para confirmar.';
    state.closest('.croqui-template-savebar')?.classList.toggle('is-saved', saved);
    if (button) button.textContent = saved ? 'Modelo salvo' : 'Salvar modelo';
  }

  function optionsData() {
    return {
      showLogoOnEveryPage: true,
      clickableLogo: true,
      qrLinksToPublicProject: true,
      selectedTarget,
      modelModes,
      customModelTargets,
      memorialTemplateId: selectedMemorialTemplateId,
      memorialTemplateMode: selectedMemorialTemplateId === 'standard' ? 'standard' : 'custom',
      memorialTemplateUpdatedAt: preferenceApi()?.read?.()?.updatedAt || new Date().toISOString(),
      memorial: {
        showLogo: $('memorialShowLogo')?.checked !== false,
        showMap: $('memorialShowMap')?.checked !== false,
        showQr: $('memorialShowQr')?.checked !== false,
        useSatellite: $('memorialUseSatellite')?.checked !== false
      },
      mapas: {
        croquiTemplateId: selectedCroquiTemplateId()
      },
      carReport: {
        title: $('carReportTitle')?.value?.trim() || 'RELATÓRIO PRELIMINAR - CADASTRO AMBIENTAL RURAL',
        subtitle: $('carReportSubtitle')?.value?.trim() || '',
        showSummaryCards: $('carReportSummaryCards')?.checked !== false,
        showFeatureTable: $('carReportFeatureTable')?.checked !== false,
        showTechnicalNotice: $('carReportTechnicalNotice')?.checked === true,
        showPublicQr: $('carReportPublicQr')?.checked !== false,
        showRegistrant: $('carReportRegistrant')?.checked !== false,
        showOwnerDocuments: $('carReportOwnerDocs')?.checked === true
      },
      loteamentoReport: {
        title: $('lotReportTitle')?.value?.trim() || 'RELATÓRIO TÉCNICO DE LOTEAMENTO / REURB',
        subtitle: $('lotReportSubtitle')?.value?.trim() || 'Memorial, croqui e identificação técnica do lote selecionado.',
        showCroqui: $('lotReportCroqui')?.checked !== false,
        showSegments: $('lotReportSegments')?.checked !== false,
        showConfrontants: $('lotReportConfrontants')?.checked !== false,
        showTech: $('lotReportTech')?.checked !== false,
        showSignature: $('lotReportSignature')?.checked !== false
      },
      version: 21.990
    };
  }
  function data() {
    return {
      companyName: $('companyName').value.trim(), addressText: $('addressText').value.trim(),
      responsibleTechnician: $('responsibleTechnician').value.trim(), professionalRegistry: $('professionalRegistry').value.trim(),
      websiteUrl: $('websiteUrl').value.trim(), footerText: $('footerText').value.trim(),
      phoneNumber: $('phoneNumber')?.value.trim() || '', whatsappNumber: $('whatsappNumber')?.value.trim() || '',
      emailAddress: $('emailAddress')?.value.trim() || '', addressNumber: $('addressNumber')?.value.trim() || '',
      professionalTitle: $('professionalTitle')?.value.trim() || '', logoDataUrl,
      planDocumentSignatureDataUrl: signatureDataUrl,
      baseTemplateName, baseTemplateContent, options: optionsData()
    };
  }
  function companyLogo(value, className = '') {
    if (value.logoDataUrl && value.options.memorial.showLogo) {
      const image = `<img class="${className}" src="${value.logoDataUrl}" alt="Logotipo da empresa">`;
      return safeUrl(value.websiteUrl) ? `<a href="${safeUrl(value.websiteUrl)}" target="_blank" rel="noopener noreferrer">${image}</a>` : image;
    }
    return '<div class="word-logo-placeholder">LOGOTIPO</div>';
  }
  function wordHeader(value) {
    return `<header class="word-template-header">
      <div class="word-template-logo">${companyLogo(value, 'word-header-logo')}</div>
      <div class="word-template-company">
        <strong>${escape(value.companyName || '{{NOME DA EMPRESA}}')}</strong>
        <span>${escape(value.addressText || '{{endereço da empresa}}')}</span>
        <span>${escape(value.professionalRegistry || '{{telefone | e-mail | CREA}}')}</span>
        <span>${safeUrl(value.websiteUrl) || '{{www.seusite.com.br}}'}</span>
      </div>
    </header>`;
  }
  function wordFooter(value) {
    return `<footer class="word-template-footer">
      <div class="word-footer-logo">${value.logoDataUrl && value.options.memorial.showLogo ? `<img src="${value.logoDataUrl}" alt="Logo no rodapé">` : ''}</div>
      <div>
        <strong>${escape([value.responsibleTechnician, value.professionalRegistry].filter(Boolean).join(' — ') || '{{RESPONSÁVEL TÉCNICO}}')}</strong>
        <span>${escape(value.footerText || '{{rodapé do documento}}')}</span>
      </div>
    </footer>`;
  }
  function memorialWordBody(value) {
    const mapBlock = value.options.memorial.showMap ? `<section class="word-map-section">
      <h2>3. MAPA DE LOCALIZAÇÃO / PLANTA DO IMÓVEL</h2>
      <div class="word-map-frame">
        <div class="word-map-satellite"></div>
        <svg viewBox="0 0 420 250" role="img" aria-label="Planta do imóvel rural">
          <rect x="0" y="0" width="420" height="250" fill="#eef4f0"/>
          <path d="M62 168 L122 74 L250 46 L350 118 L316 202 L166 218 Z" fill="rgba(250,204,21,.38)" stroke="#d9a600" stroke-width="5"/>
          <circle cx="62" cy="168" r="6" fill="#123b8a"/><circle cx="122" cy="74" r="6" fill="#123b8a"/><circle cx="250" cy="46" r="6" fill="#123b8a"/><circle cx="350" cy="118" r="6" fill="#123b8a"/><circle cx="316" cy="202" r="6" fill="#123b8a"/><circle cx="166" cy="218" r="6" fill="#123b8a"/>
          <text x="50" y="152">V-01</text><text x="105" y="62">V-02</text><text x="252" y="37">V-03</text><text x="354" y="113">V-04</text><text x="318" y="222">V-05</text><text x="144" y="238">V-06</text>
          <rect x="286" y="166" width="78" height="54" rx="6" fill="white" stroke="#1d3557"/><text x="297" y="190" font-size="13">QR Code</text><text x="305" y="207" font-size="10">link público</text>
        </svg>
      </div>
      <p class="word-caption">Planta de localização gerada automaticamente pelo sistema com imagem de satélite, perímetro, vértices, legenda e QR Code quando habilitado.</p>
    </section>` : '';
    return `<section class="word-identification word-borderless-table">
      <div><b>PROPRIEDADE:</b> Fazenda Exemplo</div><div><b>CIDADE:</b> Município/UF</div>
      <div><b>DOCUMENTO:</b> Matrícula — Nº do documento</div><div><b>COMARCA:</b> Município</div>
      <div><b>CÓDIGO INCRA:</b> Código informado</div><div><b>ÁREA:</b> 0,0000 ha</div>
      <div><b>PROPRIETÁRIO:</b> Nome do proprietário</div><div><b>PERÍMETRO:</b> 0.000,00 m</div>
      <div><b>CPF/CNPJ:</b> CPF/CNPJ informado</div><div></div>
    </section>
    <h1 class="word-main-title">MEMORIAL DESCRITIVO</h1>
    <h2 class="word-section-title">DESCRIÇÃO</h2>
    <p class="word-paragraph">Inicia-se a descrição deste perímetro no vértice <b>V-01</b>, de longitude <b>-39.8134230</b> e latitude <b>-12.9540410</b>, com azimute de <b>92,0868°</b> e distância de <b>1.531,020 m</b>, até o vértice <b>V-02</b>.</p>
    <p class="word-paragraph">Deste, segue do vértice <b>V-02</b>, de longitude <b>-39.7993040</b> e latitude <b>-12.9545420</b>, com azimute de <b>4,0034°</b> e distância de <b>1.398,577 m</b>, até o vértice <b>V-03</b>.</p>
    <p class="word-paragraph word-muted-note">No documento final, esta descrição é montada automaticamente para qualquer quantidade real de vértices do imóvel.</p>
    ${mapBlock}
    <section class="word-signatures"><div><span></span><b>PROPRIETÁRIO / REQUERENTE</b><small>CPF/CNPJ</small></div><div><span></span><b>RESPONSÁVEL TÉCNICO</b><small>CREA/CAU</small></div></section>`;
  }
  function genericWordBody(value) {
    const title = targetLabel();
    if (selectedTarget === 'mapas') {
      const croquiTemplateId = value.options?.mapas?.croquiTemplateId || 'classic';
      if (croquiTemplateId === 'rural-reference') {
        return `<h1 class="word-main-title">PLANTA DO IMÓVEL RURAL</h1>
          <section class="word-module-preview croqui-reference-preview">
            <img src="/assets/croqui-template-previews/02_planta_imovel_rural.webp" alt="Modelo Planta do Imóvel Rural" style="width:100%;display:block;border:1px solid #cbd5e1;border-radius:10px">
          </section>
          <p class="word-preview-note"><b>Novo modelo selecionado.</b> O documento final é gerado com os dados reais do projeto, identidade da empresa, glebas, vértices, mapa de localização e QR Code.</p>`;
      }
      return `<h1 class="word-main-title">PLANTA DO IMÓVEL RURAL</h1>
        <section class="word-module-preview">
          <div class="word-map-mock"><div class="word-map-poly"></div><span style="position:absolute;left:18px;top:14px;font-weight:900;font-size:20px">N</span><span style="position:absolute;left:14px;bottom:12px;background:#fff;padding:4px 8px;border-radius:5px">Imagem cartográfica de referência · SIRGAS 2000</span></div>
          <div class="word-stamp-grid"><div><b>SISTEMA DE COORDENADAS GEOGRÁFICAS</b><small>Datum: SIRGAS 2000</small><small>QR Code do mapa público</small></div><div><b>DADOS DO IMÓVEL</b><small>Imóvel: Fazenda Exemplo</small><small>Área: 0,0000 ha · Perímetro: 0.000,00 m</small><small>Proprietário(a): Nome do proprietário</small></div><div>${value.logoDataUrl ? `<img src="${value.logoDataUrl}" style="max-width:82px;max-height:54px;object-fit:contain">` : '<b>LOGO</b>'}<small>${escape(value.companyName || 'Surveyor')}</small><small>Prancha técnica gerada digitalmente</small></div></div>
        </section>
        <p class="word-preview-note">Esta prévia segue o modelo real de Mapas e croquis: mapa principal, perímetro, legenda, QR Code e carimbo técnico inferior.</p>`;
    }
    if (selectedTarget === 'pranchas') {
      return `<h1 class="word-main-title">PLANTA DO IMÓVEL GEORREFERENCIADO</h1>
        <section class="word-module-preview" style="display:grid;grid-template-columns:1.35fr .85fr;gap:14px">
          <div class="word-map-mock" style="height:430px;background:#f8fafc"><div class="word-map-poly" style="border-color:#111827;background:rgba(226,232,240,.65)"></div><span style="position:absolute;left:28px;top:28px;font-weight:900;font-size:22px">N</span><span style="position:absolute;left:40%;bottom:10px">Escala Gráfica 1:3.500</span></div>
          <div style="display:grid;gap:8px"><div style="border:1.5px solid #111827;border-radius:10px;padding:8px;text-align:center"><b>${escape(value.companyName || 'NOME DA EMPRESA')}</b><br><small>${escape(value.footerText || '')}</small></div><div style="border:1.5px solid #111827;border-radius:10px;padding:10px"><b>IMÓVEL:</b> Fazenda Exemplo<br><b>PROPRIETÁRIO:</b> Nome<br><b>MUNICÍPIO:</b> Município/UF<br><b>ÁREA:</b> 0,0000 ha<br><b>PERÍMETRO:</b> 0.000,00 m</div><div style="border:1.5px solid #111827;border-radius:10px;padding:10px;height:72px">Quadro de Assinatura Proprietário(s)</div><div style="border:1.5px solid #111827;border-radius:10px;padding:10px;height:118px">Planta de situação + quadro de áreas</div><div style="border:1.5px solid #111827;border-radius:10px;padding:10px;height:56px">Local do imóvel · QR Code</div></div>
        </section>
        <p class="word-preview-note">Esta é a estrutura real da prancha georreferenciada lateral: desenho técnico à esquerda e quadros oficiais à direita.</p>`;
    }
    if (selectedTarget === 'planialtimetria') {
      return `<h1 class="word-main-title">PLANIALTIMÉTRICO DO IMÓVEL</h1>
        <section class="word-module-preview"><div class="word-altimetry-mock"><span style="position:absolute;left:28px;top:22px;font-weight:900;font-size:22px">N</span><span style="position:absolute;right:16px;top:20px;writing-mode:vertical-rl;font-weight:700">Altitude (metros)</span></div>
          <div class="word-stamp-grid"><div><b>SISTEMA DE COORDENADAS</b><small>Datum: SIRGAS 2000</small><small>Legendas e QR Code</small></div><div><b>DADOS DO IMÓVEL</b><small>Imóvel: Fazenda Exemplo</small><small>Área e perímetro calculados</small><small>Proprietário e responsável técnico</small></div><div>${value.logoDataUrl ? `<img src="${value.logoDataUrl}" style="max-width:82px;max-height:54px;object-fit:contain">` : '<b>LOGO</b>'}<small>${escape(value.companyName || 'Surveyor')}</small></div></div>
        </section>
        <p class="word-preview-note">A prévia representa o documento real de Planialtimetria/MDT: superfície altimétrica, curvas de nível, perímetro tracejado, barra de altitude e carimbo técnico.</p>`;
    }

    if (selectedTarget === 'car') {
      const carOpts = value.options.carReport || {};
      return `<h1 class="word-main-title">${escape(carOpts.title || 'RELATÓRIO PRELIMINAR - CADASTRO AMBIENTAL RURAL')}</h1>
        <section class="word-identification word-borderless-table compact"><div><b>PROJETO:</b> Fazenda Exemplo</div><div><b>IMÓVEL:</b> Fazenda Exemplo</div><div><b>PROPRIETÁRIO:</b> Nome do proprietário</div><div><b>MUNICÍPIO/UF:</b> Município/UF</div><div><b>FUSO UTM:</b> 24S</div><div><b>CADASTRANTE:</b> Técnico responsável</div></section>
        <section class="word-module-preview" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0"><div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#f8fafc"><b>Perímetro</b><br><span>2,8629 ha</span></div><div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#f0fdf4"><b>APP</b><br><span>0,1836 ha</span></div><div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#ecfdf5"><b>Reserva Legal</b><br><span>1,1991 ha</span></div><div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#fffbeb"><b>Produtiva</b><br><span>0,8184 ha</span></div></section>
        <table class="word-azimuth-table"><thead><tr><th>Categoria</th><th>Área (ha)</th><th>% do perímetro</th></tr></thead><tbody><tr><td>Perímetro total</td><td>2,8629</td><td>100,00%</td></tr><tr><td>APP</td><td>0,1836</td><td>6,41%</td></tr><tr><td>Reserva Legal</td><td>1,1991</td><td>41,88%</td></tr></tbody></table>
        <p class="word-preview-note">Esta prévia representa o relatório técnico do Módulo CAR: layout formal, quadro de áreas, feições e QR Code público usando a identidade cadastrada em Personalização.</p>`;
    }

    if (selectedTarget === 'ambiental') {
      return `<h1 class="word-main-title">RELATÓRIO AMBIENTAL PRELIMINAR</h1>
        <section class="word-identification word-borderless-table compact"><div><b>IMÓVEL:</b> Fazenda Exemplo</div><div><b>PROPRIETÁRIO:</b> Nome</div><div><b>LOCALIZAÇÃO:</b> Município/UF</div><div><b>RESPONSÁVEL:</b> Técnico responsável</div></section>
        <section class="word-module-preview" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0"><div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px"><b>APP</b><br><span>0,0000 ha</span></div><div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px"><b>Reserva Legal</b><br><span>0,0000 ha</span></div><div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px"><b>Vegetação</b><br><span>0,0000 ha</span></div><div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px"><b>Produtiva</b><br><span>0,0000 ha</span></div></section>
        <table class="word-azimuth-table"><thead><tr><th>Categoria</th><th>Área (ha)</th><th>% do perímetro</th></tr></thead><tbody><tr><td>APP</td><td>0,0000</td><td>0,00%</td></tr><tr><td>Reserva Legal</td><td>0,0000</td><td>0,00%</td></tr><tr><td>Área produtiva</td><td>0,0000</td><td>0,00%</td></tr></tbody></table>
        <p class="word-preview-note">Esta prévia segue o novo relatório ambiental: cabeçalho profissional, quadro de áreas, observações técnicas, alertas automáticos e rodapé personalizado.</p>`;
    }

    if (selectedTarget === 'loteamento') {
      const lotOpts = value.options.loteamentoReport || {};
      return `<h1 class="word-main-title">${escape(lotOpts.title || 'RELATÓRIO TÉCNICO DE LOTEAMENTO / REURB')}</h1>
        <section class="word-identification word-borderless-table compact"><div><b>PROJETO:</b> Residencial Exemplo</div><div><b>LOTE:</b> Lote 01</div><div><b>PROPRIETÁRIO:</b> Cliente Exemplo</div><div><b>MUNICÍPIO/UF:</b> Município/UF</div><div><b>ÁREA:</b> 0,0000 ha</div><div><b>PERÍMETRO:</b> 0,000 m</div></section>
        <h2 class="word-section-title">Descrição perimétrica</h2>
        <p class="word-paragraph">Do vértice <b>V-01</b>, segue-se com azimute de <b>92,0868°</b> e distância de <b>153,100 m</b> até o vértice <b>V-02</b>, confrontando com <b>Lote 02</b>.</p>
        <table class="word-azimuth-table"><thead><tr><th>Trecho</th><th>Azimute</th><th>Distância</th><th>Confrontante</th></tr></thead><tbody><tr><td>V-01 → V-02</td><td>92,0868°</td><td>153,100 m</td><td>Lote 02</td></tr><tr><td>V-02 → V-03</td><td>4,0034°</td><td>139,850 m</td><td>Sistema viário</td></tr></tbody></table>
        <section class="word-module-preview"><div class="word-map-mock"><div class="word-map-poly"></div><span style="position:absolute;left:18px;top:14px;font-weight:900;font-size:20px">N</span><span style="position:absolute;left:14px;bottom:12px;background:#fff;padding:4px 8px;border-radius:5px">Croqui técnico do lote</span></div></section>
        <section class="word-signatures"><div><span></span><b>PROPRIETÁRIO / REQUERENTE</b><small>Assinatura</small></div><div><span></span><b>RESPONSÁVEL TÉCNICO</b><small>Registro profissional</small></div></section>
        <p class="word-preview-note">Esta prévia representa o relatório técnico isolado do módulo Loteamentos / REURB: sem imprimir a página, com cabeçalho personalizado, memorial, croqui e assinaturas.</p>`;
    }

    if (selectedTarget === 'perimetro') {
      return `<h1 class="word-main-title">RELATÓRIO DE PERÍMETRO POR AZIMUTE</h1>
        <section class="word-identification word-borderless-table compact"><div><b>IMÓVEL:</b> Fazenda Exemplo</div><div><b>MUNICÍPIO:</b> Município/UF</div><div><b>ÁREA:</b> 0,0000 ha</div><div><b>PERÍMETRO:</b> 0.000,00 m</div></section>
        <table class="word-azimuth-table"><thead><tr><th>Vértice</th><th>Latitude</th><th>Longitude</th><th>Azimute</th><th>Distância</th></tr></thead><tbody><tr><td>V-01</td><td>-13.000000</td><td>-39.000000</td><td>92,0868°</td><td>153,10 m</td></tr><tr><td>V-02</td><td>-13.000400</td><td>-39.001200</td><td>4,0034°</td><td>139,85 m</td></tr><tr><td>V-03</td><td>-13.001000</td><td>-39.002100</td><td>276,7477°</td><td>158,28 m</td></tr></tbody></table>
        <p class="word-preview-note">Esta prévia segue o relatório técnico de perímetro: coordenadas, azimutes, distâncias, totais e identificação profissional.</p>`;
    }
    return `<h1 class="word-main-title">${escape(title)}</h1><div class="word-placeholder-box">Modelo técnico do módulo ${escape(title.toLowerCase())}.</div>`;
  }
  function exactCustomTemplatePreview(template, value){
    if(!template?.file) return '';
    const base=String(template.file).replace(/\.docx$/i,'');
    const company = escape(value.companyName || 'NOME DA EMPRESA');
    const address = escape([value.addressText, value.addressNumber].filter(Boolean).join(', ') || 'ENDEREÇO DA EMPRESA');
    const contacts = escape([
      value.phoneNumber ? `☎ ${value.phoneNumber}` : '',
      value.whatsappNumber ? `◉ ${value.whatsappNumber}` : '',
      value.emailAddress ? `✉ ${value.emailAddress}` : ''
    ].filter(Boolean).join('   ') || 'TELEFONE • WHATSAPP • E-MAIL');
    const site = escape(value.websiteUrl || 'SITE DA EMPRESA');
    const tech = escape(value.responsibleTechnician || 'NOME DO RESPONSÁVEL TÉCNICO');
    const registry = escape([value.professionalTitle, value.professionalRegistry].filter(Boolean).join(': ') || 'TÍTULO PROFISSIONAL: REGISTRO');
    const logo = value.logoDataUrl ? `<img class="live-template-logo" src="${value.logoDataUrl}" alt="Logotipo da empresa">` : `<span class="live-template-logo-placeholder">${company}</span>`;
    const pageCount = Math.max(1, Number(template.previewPages || 2));
    const techPage = Math.max(1, Number(template.techOverlayPage || pageCount));
    const page = (number) => `<div class="exact-template-sheet">
      <img class="exact-template-page" src="/assets/memorial-template-previews/pages/${encodeURIComponent(base)}-p${number}.png" alt="Página ${number} do modelo ${escape(template.name)}">
      <div class="live-template-overlay live-template-overlay-p${number}">
        <div class="live-template-header-logo">${logo}</div>
        <div class="live-template-footer-contact">${contacts}</div>
        <div class="live-template-footer-site">${site}</div>
        <div class="live-template-footer-address">${address}</div>
        ${number===techPage ? `<div class="live-template-tech-name">${tech}</div><div class="live-template-tech-registry">${registry}</div>` : ''}
      </div>
    </div>`;
    const pages = Array.from({length:pageCount},(_,index)=>`<div class="exact-template-caption">${escape(template.name)} — página ${index+1}</div>${page(index+1)}`).join('');
    return `<div class="exact-template-preview live-edit-preview" aria-label="Pré-visualização ao vivo do template ${escape(template.name)}">${pages}</div>`;
  }

  let customizationPreviewPdfUrl = '';

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível carregar a imagem do modelo.'));
      image.src = src;
    });
  }

  function fitImageSize(image, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    return { width: image.naturalWidth * ratio, height: image.naturalHeight * ratio };
  }

  async function addCustomizationOverlayToPdf(doc, pageNumber, value, template = {}) {
    const pageWidth = 210;
    if (value.logoDataUrl) {
      try {
        const logo = await loadImageElement(value.logoDataUrl);
        const size = fitImageSize(logo, 30, 14);
        doc.setFillColor(255, 255, 255);
        doc.rect(72, 3.4, 66, 15, 'F');
        doc.addImage(value.logoDataUrl, value.logoDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG', (pageWidth - size.width) / 2, 4.5, size.width, size.height, undefined, 'FAST');
      } catch (error) {
        console.warn('Falha ao inserir logotipo na prévia PDF:', error);
      }
    }

    const contact = [
      value.phoneNumber ? `Telefone: ${value.phoneNumber}` : '',
      value.whatsappNumber ? `WhatsApp: ${value.whatsappNumber}` : '',
      value.emailAddress ? value.emailAddress : '',
      value.websiteUrl ? value.websiteUrl : ''
    ].filter(Boolean).join('  •  ');
    const address = [value.addressText, value.addressNumber].filter(Boolean).join(', ');
    if (contact || address) {
      doc.setFillColor(255, 255, 255);
      doc.rect(22, 278.3, 166, 11.5, 'F');
      doc.setTextColor(20, 45, 80);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      if (contact) doc.text(contact, 105, 283, { align: 'center', maxWidth: 158 });
      if (address) doc.text(address, 105, 287, { align: 'center', maxWidth: 158 });
    }

    if (pageNumber === Number(template.techOverlayPage || template.previewPages || 2) && (value.responsibleTechnician || value.professionalRegistry || value.professionalTitle)) {
      doc.setFillColor(255, 255, 255);
      doc.rect(55, 136, 100, 16, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(value.responsibleTechnician || 'RESPONSÁVEL TÉCNICO', 105, 142, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const registryLine = [value.professionalTitle, value.professionalRegistry].filter(Boolean).join(' — ');
      if (registryLine) doc.text(registryLine, 105, 147, { align: 'center' });
    }
  }

  async function generateCustomizationPdfPreview() {
    const host = $('customizationPreview');
    const button = $('generateCustomizationPdfPreview');
    if (!host || !button) return;
    const JsPdf = window.jspdf?.jsPDF;
    if (!JsPdf) return toast('O gerador de PDF ainda está carregando. Aguarde e tente novamente.', 'error');
    button.disabled = true;
    host.innerHTML = '<div class="pdf-preview-loading">Gerando a pré-visualização em PDF...</div>';
    try {
      const value = data();
      const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      if (selectedTarget === 'memorial' && selectedMemorialTemplateId !== 'standard') {
        const template = window.SurveyorMemorialTemplates?.byId?.(selectedMemorialTemplateId);
        if (!template?.file) throw new Error('Modelo personalizado não encontrado.');
        const base = String(template.file).replace(/\.docx$/i, '');
        const previewPages = Math.max(1, Number(template.previewPages || 2));
        for (let pageNumber = 1; pageNumber <= previewPages; pageNumber += 1) {
          if (pageNumber > 1) doc.addPage('a4', 'portrait');
          const src = `/assets/memorial-template-previews/pages/${encodeURIComponent(base)}-p${pageNumber}.png`;
          const image = await loadImageElement(src);
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
          await addCustomizationOverlayToPdf(doc, pageNumber, value, template);
        }
      } else {
        doc.setDrawColor(20, 94, 219);
        doc.setLineWidth(1.2);
        doc.rect(10, 10, 190, 277);
        if (value.logoDataUrl) {
          try { doc.addImage(value.logoDataUrl, value.logoDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG', 88, 16, 34, 18, undefined, 'FAST'); } catch {}
        }
        doc.setTextColor(15, 47, 99);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(targetLabel(), 105, 48, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.text(value.companyName || 'Nome da empresa', 20, 65);
        doc.text([value.addressText, value.addressNumber].filter(Boolean).join(', ') || 'Endereço da empresa', 20, 72);
        doc.text(value.responsibleTechnician || 'Responsável técnico', 20, 79);
        doc.text([value.professionalTitle, value.professionalRegistry].filter(Boolean).join(' — ') || 'Título e registro profissional', 20, 86);
        doc.setFontSize(11);
        doc.text('Esta é a pré-visualização do modelo padrão do sistema.', 20, 110);
      }
      const blob = doc.output('blob');
      if (customizationPreviewPdfUrl) URL.revokeObjectURL(customizationPreviewPdfUrl);
      customizationPreviewPdfUrl = URL.createObjectURL(blob);
      host.innerHTML = `<iframe class="pdf-preview-frame" title="Pré-visualização do PDF" src="${customizationPreviewPdfUrl}#page=1&zoom=page-width&toolbar=1&navpanes=1&scrollbar=1"></iframe>`;
      toast('Pré-visualização em PDF gerada.', 'success');
    } catch (error) {
      console.error(error);
      host.innerHTML = `<div class="pdf-preview-empty"><strong>Não foi possível gerar a pré-visualização</strong><span>${escape(error.message || 'Erro inesperado.')}</span></div>`;
      toast(error.message || 'Falha ao gerar a pré-visualização.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function renderPreview(options = {}) {
    const host = $('customizationPreview');
    if (!host) return;
    const resetScroll = options.resetScroll === true;
    const previousScrollTop = host.scrollTop;
    const previousScrollLeft = host.scrollLeft;
    const value = data();
    const template = window.SurveyorMemorialTemplates?.byId?.(selectedMemorialTemplateId) || {name:'Modelo padrão do sistema',color:'#145edb'};
    if(selectedTarget === 'memorial' && selectedMemorialTemplateId !== 'standard'){
      host.innerHTML = '<div class="pdf-preview-empty"><strong>Modelo selecionado: ' + escape(template.name) + '</strong><span>Preencha os dados e clique em “Gerar pré-visualização em PDF”.</span></div>';
      host.scrollTop = 0;
      host.scrollLeft = 0;
      return;
    }
    const body = selectedTarget === 'memorial' ? memorialWordBody(value) : genericWordBody(value);
    const modelBadge = selectedTarget === 'memorial' ? `<div style="margin:0 0 10px;padding:8px 10px;border:1px solid ${template.color};background:#f8fbff;font-weight:800;color:${template.color}">${escape(template.name)}</div>` : '';
    host.innerHTML = `<div class="word-template-preview" aria-label="Prévia do modelo Word">${modelBadge}
      <article class="word-template-page" style="border-top:8px solid ${selectedTarget === 'memorial' ? template.color : '#145edb'};border-bottom:8px solid ${selectedTarget === 'memorial' ? template.color : '#145edb'}">
        ${wordHeader(value)}
        <main class="word-template-body">${body}</main>
        ${wordFooter(value)}
      </article>
    </div>`;
    requestAnimationFrame(() => {
      host.scrollTop = resetScroll ? 0 : Math.min(previousScrollTop, Math.max(0, host.scrollHeight - host.clientHeight));
      host.scrollLeft = resetScroll ? 0 : previousScrollLeft;
    });
  }
  function updateModelModeUi(){
    document.querySelectorAll('[data-model-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.modelMode===currentModelMode));
    document.querySelectorAll('[data-model-pane]').forEach(pane=>pane.classList.toggle('active',pane.dataset.modelPane===currentModelMode));
  }
  function renderCustomModelList(){
    const host=$('customModelList'); if(!host) return;
    if(selectedTarget !== 'memorial'){ host.innerHTML=''; return; }
    host.innerHTML = window.SurveyorMemorialTemplates?.galleryHtml?.(selectedMemorialTemplateId, false, loadedCustomization||{}) || '';
    const hint=$('customModelHint'); if(hint) hint.textContent='Modelos personalizados oficiais do Memorial Descritivo. A escolha fica salva na sua conta.';
  }
  function setModelMode(mode){
    if(selectedTarget !== 'memorial') return;
    if(mode === 'custom' && selectedMemorialTemplateId === 'standard') selectedMemorialTemplateId=firstCustomMemorialTemplateId();
    if(mode !== 'custom') selectedMemorialTemplateId='standard';
    rememberMemorialTemplate(selectedMemorialTemplateId);
    currentModelMode=selectedMemorialTemplateId==='standard'?'standard':'custom';
    modelModes.memorial=currentModelMode;
    updateModelModeUi(); renderCustomModelList(); updateCustomizationStatuses(); renderPreview({ resetScroll: true });
  }
  function fill(value) {
    loadedCustomization = value && typeof value === 'object' ? value : {};
    identityTouchedFields.clear();
    ['companyName','addressText','responsibleTechnician','professionalRegistry','websiteUrl','footerText','phoneNumber','whatsappNumber','emailAddress','addressNumber','professionalTitle'].forEach((id) => { if($(id)) $(id).value = value?.[id] || ''; });
    logoDataUrl = value?.logoDataUrl || ''; signatureDataUrl = value?.planDocumentSignatureDataUrl || ''; signatureTouched = false; updateSignaturePreview(); updateLogoPreview(); baseTemplateContent = value?.baseTemplateContent || ''; baseTemplateName = value?.baseTemplateName || '';
    const opts = value?.options || {};
    selectedTarget = opts.selectedTarget || selectedTarget || 'memorial';
    modelModes = opts.modelModes && typeof opts.modelModes === 'object' ? opts.modelModes : {};
    customModelTargets = opts.customModelTargets && typeof opts.customModelTargets === 'object' ? opts.customModelTargets : {};
    const rememberedTemplateId=readRememberedMemorialTemplate();
    const resolvedPreference=preferenceApi()?.resolve?.(value)||null;
    selectedMemorialTemplateId = validMemorialTemplateId(resolvedPreference?.id)
      ? resolvedPreference.id
      : (rememberedTemplateId || (opts.memorialTemplateMode === 'custom' ? firstCustomMemorialTemplateId() : 'standard'));
    if(validMemorialTemplateId(selectedMemorialTemplateId)) rememberMemorialTemplate(selectedMemorialTemplateId);
    currentModelMode = selectedMemorialTemplateId === 'standard' ? 'standard' : 'custom';
    const mem = opts.memorial || {};
    if ($('memorialShowLogo')) $('memorialShowLogo').checked = mem.showLogo !== false;
    if ($('memorialShowMap')) $('memorialShowMap').checked = mem.showMap !== false;
    if ($('memorialShowQr')) $('memorialShowQr').checked = mem.showQr !== false;
    if ($('memorialUseSatellite')) $('memorialUseSatellite').checked = mem.useSatellite !== false;
    const mapasOptions = opts.mapas || {};
    const mapTemplateId = mapasOptions.croquiTemplateId || 'classic';
    const mapTemplateInput = document.querySelector(`input[name="mapCroquiTemplate"][value="${mapTemplateId}"]`)
      || document.querySelector('input[name="mapCroquiTemplate"][value="classic"]');
    if (mapTemplateInput) mapTemplateInput.checked = true;
    updateCroquiTemplateSaveState(true);
    const carReport = opts.carReport || opts.car || {};
    if ($('carReportTitle')) $('carReportTitle').value = carReport.title || 'RELATÓRIO PRELIMINAR - CADASTRO AMBIENTAL RURAL';
    if ($('carReportSubtitle')) $('carReportSubtitle').value = carReport.subtitle || '';
    if ($('carReportSummaryCards')) $('carReportSummaryCards').checked = carReport.showSummaryCards !== false;
    if ($('carReportFeatureTable')) $('carReportFeatureTable').checked = carReport.showFeatureTable !== false;
    if ($('carReportTechnicalNotice')) $('carReportTechnicalNotice').checked = carReport.showTechnicalNotice === true;
    if ($('carReportPublicQr')) $('carReportPublicQr').checked = carReport.showPublicQr !== false;
    if ($('carReportRegistrant')) $('carReportRegistrant').checked = carReport.showRegistrant !== false;
    if ($('carReportOwnerDocs')) $('carReportOwnerDocs').checked = carReport.showOwnerDocuments === true;

    const loteamentoReport = opts.loteamentoReport || opts.loteamentos || {};
    if ($('lotReportTitle')) $('lotReportTitle').value = loteamentoReport.title || 'RELATÓRIO TÉCNICO DE LOTEAMENTO / REURB';
    if ($('lotReportSubtitle')) $('lotReportSubtitle').value = loteamentoReport.subtitle || 'Memorial, croqui e identificação técnica do lote selecionado.';
    if ($('lotReportCroqui')) $('lotReportCroqui').checked = loteamentoReport.showCroqui !== false;
    if ($('lotReportSegments')) $('lotReportSegments').checked = loteamentoReport.showSegments !== false;
    if ($('lotReportConfrontants')) $('lotReportConfrontants').checked = loteamentoReport.showConfrontants !== false;
    if ($('lotReportTech')) $('lotReportTech').checked = loteamentoReport.showTech !== false;
    if ($('lotReportSignature')) $('lotReportSignature').checked = loteamentoReport.showSignature !== false;
    $('customizationTarget').value = '';
    const selectedLabel=$('selectedDocumentLabel'); if(selectedLabel) selectedLabel.textContent='Documento técnico';
    const modelPanel=document.querySelector('.model-choice-panel'); if(modelPanel) modelPanel.dataset.hidden='true';
    document.querySelectorAll('.custom-section[data-panel]').forEach((panel)=>panel.classList.remove('active'));
    updateCustomizationStatuses();
    openDocumentPicker();
  }
  function readFile(file) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.')); reader.onload = () => resolve(String(reader.result || '')); reader.readAsDataURL(file); });
  }
  function updateSignaturePreview(message = '') {
    const wrap = $('signaturePreviewWrap');
    const image = $('signaturePreview');
    const status = $('signatureProcessingStatus');
    if (status && message) status.textContent = message;
    if (!wrap || !image) return;
    if (signatureDataUrl) {
      image.src = signatureDataUrl;
      wrap.hidden = false;
    } else {
      image.removeAttribute('src');
      wrap.hidden = true;
    }
    if ($('reprocessSignature')) $('reprocessSignature').disabled = !lastSignatureSourceFile;
    updateCustomizationStatuses();
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem da assinatura.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('A imagem da assinatura é inválida.'));
      image.src = dataUrl;
    });
  }

  function percentile(values, ratio = 0.5) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)));
    return sorted[index];
  }

  function estimateSignatureBackground(pixelData, width, height) {
    const border = Math.max(2, Math.round(Math.min(width, height) * 0.045));
    const step = Math.max(1, Math.floor(Math.min(width, height) / 180));
    const red = [], green = [], blue = [];
    const add = (x, y) => {
      const index = (y * width + x) * 4;
      if (pixelData[index + 3] < 32) return;
      red.push(pixelData[index]);
      green.push(pixelData[index + 1]);
      blue.push(pixelData[index + 2]);
    };
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (x < border || y < border || x >= width - border || y >= height - border) add(x, y);
      }
    }
    if (!red.length) return { color: [255, 255, 255], luminance: 255, noise: 0 };
    const color = [percentile(red), percentile(green), percentile(blue)];
    const luminance = (color[0] * 0.299) + (color[1] * 0.587) + (color[2] * 0.114);
    const distances = red.map((value, index) => Math.sqrt(
      (value - color[0]) ** 2 +
      (green[index] - color[1]) ** 2 +
      (blue[index] - color[2]) ** 2
    ));
    return { color, luminance, noise: percentile(distances, 0.72) };
  }

  function clearSignaturePixel(pixelData, index) {
    // Mantém RGB branco mesmo com alfa zero. Leitores de PDF que não respeitam
    // corretamente a transparência exibem branco, nunca um quadrado preto.
    pixelData[index] = 255;
    pixelData[index + 1] = 255;
    pixelData[index + 2] = 255;
    pixelData[index + 3] = 0;
  }

  function smoothSignatureAlpha(value, low, high) {
    if (value <= low) return 0;
    if (value >= high) return 255;
    const normalized = (value - low) / Math.max(1, high - low);
    const smooth = normalized * normalized * (3 - (2 * normalized));
    return Math.round(smooth * 255);
  }

  async function processSignatureFile(file) {
    if (!file) throw new Error('Selecione uma imagem da assinatura.');
    if (file.size > 8_000_000) throw new Error('A imagem da assinatura deve ter no máximo 8 MB.');
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error('Use uma assinatura em PNG, JPEG ou WEBP.');
    const source = await readImageFile(file);
    const image = await loadImage(source);
    const maxWidth = 1600, maxHeight = 700;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = frame.data;
    const totalPixels = Math.max(1, canvas.width * canvas.height);
    let transparentPixels = 0;
    let visiblePixels = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] <= 12) transparentPixels += 1;
      if (px[i + 3] >= 32) visiblePixels += 1;
    }

    // PNGs de assinatura frequentemente já possuem fundo transparente. Nessa
    // situação o alfa original é a fonte da verdade; não se calcula "escuridão"
    // nos pixels transparentes, pois eles costumam ter RGB preto internamente.
    const hasUsefulTransparency = (transparentPixels / totalPixels) >= 0.004 && visiblePixels > 12;
    const background = estimateSignatureBackground(px, canvas.width, canvas.height);
    const backgroundIsDark = background.luminance < 118;
    const lowThreshold = Math.max(15, Math.min(58, 12 + (background.noise * 2.15)));
    const highThreshold = lowThreshold + 48;

    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const sourceAlpha = px[i + 3];
        let alpha = 0;

        if (hasUsefulTransparency) {
          alpha = sourceAlpha;
        } else {
          const distance = Math.sqrt(
            (r - background.color[0]) ** 2 +
            (g - background.color[1]) ** 2 +
            (b - background.color[2]) ** 2
          );
          const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
          const directionalContrast = backgroundIsDark
            ? Math.max(0, luminance - background.luminance)
            : Math.max(0, background.luminance - luminance);
          const chroma = Math.max(r, g, b) - Math.min(r, g, b);
          const signal = Math.max(distance * 1.3, directionalContrast * 1.25, chroma * 0.52);
          alpha = smoothSignatureAlpha(signal, lowThreshold, highThreshold);
        }

        if (alpha < 18) {
          clearSignaturePixel(px, i);
          continue;
        }

        px[i + 3] = alpha;
        if (backgroundIsDark && !hasUsefulTransparency) {
          // Assinatura clara fotografada sobre fundo escuro é convertida em tinta
          // escura para permanecer visível nos documentos de fundo branco.
          const ink = Math.max(8, Math.round(38 - ((alpha / 255) * 30)));
          px[i] = ink;
          px[i + 1] = ink;
          px[i + 2] = ink;
        } else {
          // Preserva caneta azul/preta e reforça apenas traços excessivamente claros.
          const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
          if (luminance > 210) {
            const factor = 210 / Math.max(1, luminance);
            px[i] = Math.round(r * factor);
            px[i + 1] = Math.round(g * factor);
            px[i + 2] = Math.round(b * factor);
          }
        }

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    ctx.putImageData(frame, 0, 0);
    if (maxX < minX || maxY < minY) {
      throw new Error('Não foi possível identificar a assinatura. Use uma imagem nítida, com o traço visível e sem sombras fortes.');
    }

    const pad = Math.max(10, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width - 1, maxX + pad);
    maxY = Math.min(canvas.height - 1, maxY + pad);

    const cropped = document.createElement('canvas');
    cropped.width = Math.max(1, maxX - minX + 1);
    cropped.height = Math.max(1, maxY - minY + 1);
    const croppedCtx = cropped.getContext('2d', { willReadFrequently: true });
    croppedCtx.clearRect(0, 0, cropped.width, cropped.height);
    croppedCtx.drawImage(canvas, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);

    // Normaliza novamente a área transparente após o recorte para evitar fundo
    // preto em geradores de PDF/Word com suporte incompleto a PNG alfa.
    const croppedFrame = croppedCtx.getImageData(0, 0, cropped.width, cropped.height);
    for (let i = 0; i < croppedFrame.data.length; i += 4) {
      if (croppedFrame.data[i + 3] < 18) clearSignaturePixel(croppedFrame.data, i);
    }
    croppedCtx.putImageData(croppedFrame, 0, 0);
    return cropped.toDataURL('image/png');
  }

  async function handleSignatureFile(file) {
    if (!file) return;
    const status=$('signatureProcessingStatus');
    try {
      if(status) status.textContent='Tratando a assinatura e removendo o fundo…';
      lastSignatureSourceFile=file;
      signatureDataUrl=await processSignatureFile(file);
      signatureTouched=true;
      updateSignaturePreview('Assinatura tratada com transparência segura. O fundo preto foi removido. Salve para usar nos documentos.');
    } catch (error) {
      console.error('[Personalização] assinatura:',error);
      if(status) status.textContent='';
      toast(error.message||'Não foi possível tratar a assinatura.','error');
    }
  }

  function resetTargetOptions(target = selectedTarget) {
    if (target === 'memorial') {
      if ($('memorialShowLogo')) $('memorialShowLogo').checked = true;
      if ($('memorialShowMap')) $('memorialShowMap').checked = true;
      if ($('memorialShowQr')) $('memorialShowQr').checked = true;
      if ($('memorialUseSatellite')) $('memorialUseSatellite').checked = true;
    } else if (target === 'mapas') {
      const classic = document.querySelector('input[name="mapCroquiTemplate"][value="classic"]');
      if (classic) classic.checked = true;
      updateCroquiTemplateSaveState(false);
    } else if (target === 'car') {
      if ($('carReportTitle')) $('carReportTitle').value = 'RELATÓRIO PRELIMINAR - CADASTRO AMBIENTAL RURAL';
      if ($('carReportSubtitle')) $('carReportSubtitle').value = '';
      ['carReportSummaryCards','carReportFeatureTable','carReportPublicQr','carReportRegistrant'].forEach((id)=>{if($(id))$(id).checked=true;});
      ['carReportTechnicalNotice','carReportOwnerDocs'].forEach((id)=>{if($(id))$(id).checked=false;});
    } else if (target === 'loteamento') {
      if ($('lotReportTitle')) $('lotReportTitle').value = 'RELATÓRIO TÉCNICO DE LOTEAMENTO / REURB';
      if ($('lotReportSubtitle')) $('lotReportSubtitle').value = 'Memorial, croqui e identificação técnica do lote selecionado.';
      ['lotReportCroqui','lotReportSegments','lotReportConfrontants','lotReportTech','lotReportSignature'].forEach((id)=>{if($(id))$(id).checked=true;});
    }
    updateCustomizationStatuses();
    renderPreview({ resetScroll: false });
    toast(`Opções de ${documentDisplayName(target)} restauradas. Os dados da empresa e do responsável técnico foram mantidos.`, 'success');
  }

  function hasUsefulCustomization(value = {}) {
    return Boolean(String(value.companyName || value.addressText || value.responsibleTechnician || value.professionalRegistry || value.footerText || value.websiteUrl || value.phoneNumber || value.whatsappNumber || value.emailAddress || value.addressNumber || value.professionalTitle || value.logoDataUrl || value.planDocumentSignatureDataUrl || '').trim());
  }
  async function save() {
    const topButton = $('saveCustomizationTop');
    const formButton = document.querySelector('#customizationForm button[type="submit"]');
    const buttons = [topButton, formButton].filter(Boolean);
    const originalLabels = buttons.map((button) => button.textContent);
    const current = loadedCustomization && Object.keys(loadedCustomization).length
      ? loadedCustomization
      : await auth.getDocumentCustomization().catch(() => ({}));
    const payload = data();
    const universalFields=['companyName','addressText','responsibleTechnician','professionalRegistry','websiteUrl','footerText','phoneNumber','whatsappNumber','emailAddress','addressNumber','professionalTitle'];
    universalFields.forEach((field)=>{ if(!identityTouchedFields.has(field) && !String(payload[field]||'').trim() && String(current?.[field]||'').trim()) payload[field]=current[field]; });

    // Não reenvia imagens grandes se o usuário apenas alterou um texto ou opção.
    if (!identityTouchedFields.has('logoDataUrl')) delete payload.logoDataUrl;
    if (!signatureTouched) delete payload.planDocumentSignatureDataUrl;

    const prefFields=preferenceApi()?.payloadFields?.(selectedMemorialTemplateId)||{
      memorialTemplateId:selectedMemorialTemplateId,
      memorialTemplateMode:selectedMemorialTemplateId==='standard'?'standard':'custom',
      memorialTemplateUpdatedAt:new Date().toISOString()
    };
    payload.options = { ...(current?.options || {}), ...(payload.options || {}), ...prefFields };
    buttons.forEach((button) => { button.disabled = true; button.textContent = 'Salvando...'; });
    try {
      const saved = await auth.saveDocumentCustomization(payload);
      loadedCustomization = {
        ...(current || {}),
        ...(payload || {}),
        ...(saved || {}),
        logoDataUrl: Object.prototype.hasOwnProperty.call(payload, 'logoDataUrl') ? payload.logoDataUrl : (saved?.logoDataUrl || current?.logoDataUrl || logoDataUrl || ''),
        planDocumentSignatureDataUrl: Object.prototype.hasOwnProperty.call(payload, 'planDocumentSignatureDataUrl') ? payload.planDocumentSignatureDataUrl : (saved?.planDocumentSignatureDataUrl || current?.planDocumentSignatureDataUrl || signatureDataUrl || ''),
        options: { ...(current?.options || {}), ...(payload.options || {}), ...(saved?.options || {}) }
      };
      signatureDataUrl = loadedCustomization?.planDocumentSignatureDataUrl || signatureDataUrl;
      logoDataUrl = loadedCustomization?.logoDataUrl || logoDataUrl;
      signatureTouched = false;
      identityTouchedFields.clear();
      updateSignaturePreview();
      updateLogoPreview();
      updateCustomizationStatuses();
      rememberMemorialTemplate(selectedMemorialTemplateId);
      renderCustomModelList();
      updateModelModeUi();
      updateCroquiTemplateSaveState(true);
      buttons.forEach((button) => { button.textContent = 'Salvo'; });
      toast(`Personalização salva. Modelo ativo: ${window.SurveyorMemorialTemplates?.byId?.(selectedMemorialTemplateId)?.name || selectedMemorialTemplateId}.`, 'success');

      // Não reaplica a resposta do servidor no seletor: a escolha explícita local permanece ativa.
      // Confirmação e tema em segundo plano, sem segurar o botão.
      setTimeout(async () => {
        try {
          const verified = await auth.getDocumentCustomization({ forceRefresh: true, noCache: true });
          if (verified) loadedCustomization = { ...loadedCustomization, ...verified, options: { ...(loadedCustomization.options || {}), ...(verified.options || {}) } };
          await window.GeoRuralDocumentTheme?.load?.({ forceRefresh: true, noCache: true });
        } catch (error) {
          console.warn('[Personalização] confirmação em segundo plano indisponível:', error?.message || error);
        }
      }, 0);
    }
    catch (error) { console.error(error); toast(error.message || 'Falha ao salvar a personalização.', 'error'); }
    finally {
      setTimeout(() => buttons.forEach((button, index) => { button.disabled = false; button.textContent = originalLabels[index] || 'Salvar alterações'; }), 650);
    }
  }
  const customizationChooser = $('customizationChooser');
  if (customizationChooser && customizationChooser.dataset.targetDelegationBound !== '1') {
    customizationChooser.dataset.targetDelegationBound = '1';
    customizationChooser.addEventListener('click', (event) => {
      const btn = event.target.closest('.custom-target-card[data-target]');
      if (!btn || !customizationChooser.contains(btn)) return;
      event.preventDefault();
      setTarget(btn.dataset.target);
    });
  }
  $('chooseAnotherDocument')?.addEventListener('click', openDocumentPicker);
  $('customizationEditor')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-target]');
    if (button) setTarget(button.dataset.openTarget);
  });
  document.querySelectorAll('[data-model-mode]').forEach(btn=>btn.addEventListener('click',()=>setModelMode(btn.dataset.modelMode)));
  $('customModelList')?.addEventListener('click',(event)=>{ const btn=event.target.closest('[data-memorial-template-id]'); if(!btn)return; selectedMemorialTemplateId=btn.dataset.memorialTemplateId||'standard'; rememberMemorialTemplate(selectedMemorialTemplateId); currentModelMode=selectedMemorialTemplateId==='standard'?'standard':'custom'; modelModes.memorial=currentModelMode; renderCustomModelList(); updateModelModeUi(); updateCustomizationStatuses(); renderPreview({ resetScroll: true }); });
  document.querySelectorAll('input[name="mapCroquiTemplate"]').forEach((input) => {
    input.addEventListener('change', () => {
      updateCroquiTemplateSaveState(false);
      updateCustomizationStatuses();
      if (selectedTarget === 'mapas') renderPreview({ resetScroll: true });
    });
  });
  $('saveMapCroquiTemplate')?.addEventListener('click', async () => {
    const button = $('saveMapCroquiTemplate');
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
    try {
      await save();
      updateCroquiTemplateSaveState(true);
    } finally {
      if (button) button.disabled = false;
    }
  });
  let livePreviewTimer = null;
  $('customizationForm').addEventListener('input', () => {
    updateCustomizationStatuses();
    if (selectedTarget === 'memorial' && selectedMemorialTemplateId !== 'standard') return;
    clearTimeout(livePreviewTimer);
    livePreviewTimer = setTimeout(() => renderPreview({ resetScroll: false }), 120);
  });
  $('generateCustomizationPdfPreview')?.addEventListener('click', generateCustomizationPdfPreview);
  $('customizationForm').addEventListener('submit', (event) => { event.preventDefault(); save(); });
  $('saveCustomizationTop').addEventListener('click', save);
  $('logoFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (file.size > 1_500_000) return toast('O logotipo deve ter no máximo 1,5 MB.', 'error');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast('Use PNG, JPEG ou WEBP.', 'error');
    logoDataUrl = await readFile(file); identityTouchedFields.add('logoDataUrl'); updateLogoPreview(); updateCustomizationStatuses(); if (!(selectedTarget === 'memorial' && selectedMemorialTemplateId !== 'standard')) renderPreview({ resetScroll: false });
  });
  $('clearLogo').addEventListener('click', () => { logoDataUrl = ''; identityTouchedFields.add('logoDataUrl'); updateLogoPreview(); updateCustomizationStatuses(); if (!(selectedTarget === 'memorial' && selectedMemorialTemplateId !== 'standard')) renderPreview({ resetScroll: false }); });
  ['companyName','addressText','responsibleTechnician','professionalRegistry','websiteUrl','footerText','phoneNumber','whatsappNumber','emailAddress','addressNumber','professionalTitle'].forEach((id)=>$(id)?.addEventListener('input',()=>identityTouchedFields.add(id)));
  $('signatureFile')?.addEventListener('change', async (event) => { const file=event.target.files?.[0]; event.target.value=''; await handleSignatureFile(file); });
  $('reprocessSignature')?.addEventListener('click', async () => { if(lastSignatureSourceFile) await handleSignatureFile(lastSignatureSourceFile); });
  $('clearSignature')?.addEventListener('click', () => { signatureDataUrl=''; signatureTouched=true; lastSignatureSourceFile=null; updateSignaturePreview('Assinatura removida. Salve para confirmar na conta.'); });
  $('resetCustomization').addEventListener('click', () => { if (confirm('Restaurar somente as opções específicas deste documento?')) resetTargetOptions(selectedTarget||'memorial'); });
  function ensureCustomizationShellFallback() {
    const removeFallbackIfNativeExists = () => {
      const native = document.querySelector('.workspace-topbar:not(.sv-custom-fallback-topbar), .sv-pro-topbar:not(.sv-custom-fallback-topbar)');
      const fallback = document.querySelector('.sv-custom-fallback-topbar');
      if (native && fallback) {
        fallback.remove();
        document.body.classList.remove('sv-custom-shell-fallback');
      }
    };
    setTimeout(() => {
      removeFallbackIfNativeExists();
      if (document.querySelector('.workspace-topbar, .sv-pro-topbar')) return;
      if (document.querySelector('.sv-custom-fallback-topbar')) return;
      const bar = document.createElement('header');
      bar.className = 'sv-custom-fallback-topbar';
      bar.innerHTML = `<a class="sv-custom-fallback-brand" href="/"><img src="/assets/logo.png" alt=""><span><strong>Surveyor</strong><small>Georreferenciamento e Agrimensura</small></span></a><nav aria-label="Navegação principal"><a href="/mapa/">Mapa</a><a href="/nuvem/">Projetos</a><a href="/acervos/">Acervos oficiais</a><a href="/suporte/">Suporte</a></nav><a class="sv-custom-fallback-home" href="/">Início</a>`;
      document.body.prepend(bar);
      document.body.classList.add('sv-custom-shell-fallback');
    }, 900);
    const observer = new MutationObserver(removeFallbackIfNativeExists);
    observer.observe(document.body, { childList: true });
    setTimeout(() => observer.disconnect(), 5000);
  }
  ensureCustomizationShellFallback();
  upgradeCustomizationHubUi();

  updateLogoPreview();
  updateCustomizationStatuses();
  auth.getDocumentCustomization({ forceRefresh: true, noCache: true }).then(fill).catch((error) => toast(error.message || 'Não foi possível carregar a personalização.', 'error'));
})();
