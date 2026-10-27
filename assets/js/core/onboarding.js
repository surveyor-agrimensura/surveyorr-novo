(() => {
  'use strict';
  if (window.SurveyorOnboarding) return;

  const SCHEMA_VERSION = 1;
  const ONBOARDING_ROLLOUT_AT = Date.parse('2026-08-23T00:00:00-03:00');
  const REVIEW_AFTER_DAYS = 30;
  const DAY = 86400000;
  const TOUR_VERSIONS = {
    global: 1, mapa: 1, memorial: 1, mapas: 1, pranchas: 1, planialtimetria: 1,
    perimetros: 1, consultaCar: 1, acervos: 1, projetos: 1, confrontacao: 1,
    ods: 1, ambiental: 1, customizacao: 1, assinatura: 1, loteamentos: 1, admin: 1,
    suporte: 1, car: 1
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const visible = (el) => Boolean(el && !el.hidden && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none');
  const currentUser = () => (window.GeoRuralAuth || window.SurveyorAuth)?.currentUser?.() || null;
  const localKey = () => `surveyor:onboarding:v1:${currentUser()?.id || currentUser()?.userId || currentUser()?.email || 'anon'}`;
  const iso = () => new Date().toISOString();
  const parseTime = (value) => { const t = Date.parse(value || ''); return Number.isFinite(t) ? t : 0; };
  const clone = (v) => JSON.parse(JSON.stringify(v || {}));
  let state = { schemaVersion: SCHEMA_VERSION, lastSeenAt: '', lastReviewPromptAt: '', tours: {} };
  let active = null;
  let helpPanel = null;

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(localKey()) || '{}') || {}; } catch { return {}; }
  }
  function writeLocal(next) {
    try { localStorage.setItem(localKey(), JSON.stringify(next)); } catch {}
  }
  function mergeStates(a = {}, b = {}) {
    const out = { schemaVersion: SCHEMA_VERSION, lastSeenAt: '', lastReviewPromptAt: '', tours: {} };
    out.lastSeenAt = parseTime(a.lastSeenAt) >= parseTime(b.lastSeenAt) ? (a.lastSeenAt || '') : (b.lastSeenAt || '');
    out.lastReviewPromptAt = parseTime(a.lastReviewPromptAt) >= parseTime(b.lastReviewPromptAt) ? (a.lastReviewPromptAt || '') : (b.lastReviewPromptAt || '');
    const keys = new Set([...Object.keys(a.tours || {}), ...Object.keys(b.tours || {})]);
    keys.forEach((key) => {
      const av = a.tours?.[key] || {}; const bv = b.tours?.[key] || {};
      const chosen = Number(av.version || 0) >= Number(bv.version || 0) ? av : bv;
      out.tours[key] = { version: Number(chosen.version || 0), completedAt: chosen.completedAt || '', skippedAt: chosen.skippedAt || '' };
    });
    return out;
  }
  async function loadRemote() {
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (!auth?.apiFetch || !currentUser()) return {};
    try { return (await auth.apiFetch('/api/onboarding', { method: 'GET' }))?.state || {}; } catch { return {}; }
  }
  async function saveRemote(next) {
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (!auth?.apiFetch || !currentUser()) return;
    try { await auth.apiFetch('/api/onboarding', { method: 'PATCH', body: JSON.stringify({ state: next }) }); } catch {}
  }
  function persist({ remote = true } = {}) {
    writeLocal(state);
    if (remote) saveRemote(state);
  }
  function tourStatus(key) { return state.tours?.[key] || { version: 0, completedAt: '', skippedAt: '' }; }
  function tourNeeded(key) { return Number(tourStatus(key).version || 0) < Number(TOUR_VERSIONS[key] || 1); }
  function markTour(key, completed = true) {
    state.tours ||= {};
    state.tours[key] = { version: TOUR_VERSIONS[key] || 1, completedAt: completed ? iso() : '', skippedAt: completed ? '' : iso() };
    persist();
  }

  function topLink(href) { return `.sv-home-nav a[href="${href}"],.sv-home-nav a[href="${href.replace(/\/$/, '')}"]`; }
  const TOURS = {
    global: {
      title: 'Primeiros passos no Surveyor',
      steps: [
        { selector: '.sv-home-tools-btn', title: 'Ferramentas', text: 'Aqui ficam os módulos técnicos do Surveyor. Você pode acessar documentos, consultas, mapas, pranchas e outras rotinas.', after: 'openTools' },
        { selector: '#svHomeToolsMenu', title: 'Módulos técnicos', text: 'O menu organiza as ferramentas por finalidade. Escolha o módulo de acordo com a atividade que deseja executar.', before: 'openTools', after: 'closeTools' },
        { selector: topLink('/mapa/'), title: 'Mapa e Cadastro', text: 'É o ambiente principal para desenhar imóveis, marcar pontos, importar arquivos, consultar camadas e trabalhar com coordenadas.' },
        { selector: topLink('/nuvem/'), title: 'Projetos', text: 'Seus trabalhos salvos ficam aqui. Abra, pesquise, continue ou baixe um projeto já cadastrado.' },
        { selector: topLink('/acervos/'), title: 'Acervos oficiais', text: 'Use esta área para acessar fontes e referências oficiais disponíveis no Surveyor.' },
        { selector: topLink('/suporte/'), title: 'Suporte', text: 'Quando precisar de ajuda, abra o suporte. Você também poderá refazer os tutoriais a qualquer momento.' },
        { selector: '[data-surveyor-pwa-install]', title: 'Instalar no computador', text: 'Quando este botão estiver disponível, você pode instalar o Surveyor como aplicativo no Windows. Depois da instalação ele desaparece.', optional: true },
        { selector: '.account-zone,.workspace-account,.workspace-user-card', title: 'Sua conta', text: 'Aqui ficam seu plano, dados da conta e opções de sessão.' }
      ]
    },
    mapa: {
      title: 'Mapa e Cadastro',
      steps: [
        { selector: '#mapGlobalNavToggle', title: 'Menu principal', text: 'Use este botão para abrir a navegação do Surveyor sem sair do mapa.' },
        { selector: '#toggleLayersPanel', title: 'Camadas', text: 'Ative e organize as camadas oficiais e as camadas do projeto. A divisão político-administrativa inicia ligada por padrão.' },
        { selector: '#topQuickPolygonBtn', title: 'Desenhar polígono', text: 'Comece por aqui quando precisar delimitar uma área diretamente no mapa.' },
        { selector: '#topQuickMarkPointBtn', title: 'Marcar pontos', text: 'Cadastre pontos por coordenadas, importe listas e, quando houver pontos suficientes, transforme-os em polígono.' },
        { selector: '#mapQuickToolsToggle', title: 'Mais ferramentas', text: 'Este botão abre as ferramentas técnicas adicionais do mapa.', after: 'openMapTools' },
        { selector: '#mapQuickToolsDrawer', title: 'Ferramentas técnicas', text: 'Aqui ficam ferramentas complementares de desenho, medição e análise. Use somente quando precisar.', before: 'openMapTools', after: 'closeMapTools' },
        { selector: '.top-basemap-menu,#baseMapSelect', title: 'Mapa base', text: 'Troque entre satélite, ruas, terreno e outras bases cartográficas.' },
        { selector: '#openImportLayersBtn', title: 'Importar', text: 'Importe KML, GeoJSON, CSV, ZIP/Shapefile e outras fontes suportadas.' },
        { selector: '.top-download-menu', title: 'Exportar', text: 'Baixe o trabalho em formatos como KML, GeoJSON, CSV e Shapefile.' },
        { selector: '#saveBtn', title: 'Salvar projeto', text: 'Salve o trabalho na sua conta para continuar depois em qualquer computador.' },
        { selector: '#toggleMapSearch', title: 'Pesquisa e coordenadas', text: 'Pesquise cidade, CAR, coordenadas decimais, DMS, UTM e EPSG no mesmo campo.' }
      ]
    },
    memorial: {
      title: 'Memorial Descritivo',
      steps: [
        { selector: '#projectSelect', title: 'Selecione o projeto', text: 'Primeiro escolha o imóvel salvo que fornecerá o perímetro e as coordenadas do memorial.' },
        { selector: '.form-grid', title: 'Dados do documento', text: 'Confira proprietário, documento, INCRA, comarca, mapa de fundo e responsável técnico antes de gerar.' },
        { selector: '#memorialTemplateSelect', title: 'Modelo do memorial', text: 'Escolha o modelo definido na Personalização para manter o padrão da empresa.' },
        { selector: '#generateMemorial', title: 'Gerar memorial', text: 'Depois de conferir os dados, clique aqui para montar o documento automaticamente.' },
        { selector: '#memorialOutput', title: 'Prévia e download', text: 'O resultado aparece nesta área. Depois você pode baixar em PDF, Word, HTML ou imprimir.', optional: true }
      ]
    },
    mapas: {
      title: 'Mapas e Croquis',
      steps: [
        { selector: '#projectSelect', title: 'Projeto', text: 'Escolha o projeto que será usado para gerar a planta ou croqui.' },
        { selector: '#mapBackground', title: 'Mapa de fundo', text: 'Defina a base cartográfica: satélite, ruas, topográfico ou sem fundo.' },
        { selector: '#mapZoom', title: 'Enquadramento', text: 'Ajuste o nível visual usado na planta.' },
        { selector: '#printFormat', title: 'Formato', text: 'Escolha o formato de impressão disponível para este documento.' },
        { selector: '#generateMapV19', title: 'Gerar', text: 'Clique para montar a planta com perímetro, vértices, confrontantes e quadro técnico.' },
        { selector: '#mapPreview', title: 'Prévia', text: 'Confira o resultado aqui antes de imprimir ou baixar.', optional: true }
      ]
    },
    pranchas: {
      title: 'Pranchas Técnicas',
      steps: [
        { selector: '#projectSelect', title: 'Projeto', text: 'Selecione o imóvel. A prancha fica disponível automaticamente para conferência e edição.' },
        { selector: '[data-beta-personalization="1"]', title: 'Personalização', text: 'Ajuste a prancha em tempo real no editor vetorial nativo.' },
        { selector: '.sv-prancha-footer-download', title: 'Baixar', text: 'Use o menu inferior para baixar PDF, SVG ou Word diretamente da cena documental atual.' },
        { selector: '#mapPreview', title: 'Prévia permanente', text: 'A mesma prancha permanece como referência durante todo o fluxo.', optional: true }
      ]
    },
    planialtimetria: {
      title: 'Planialtimetria / MDT',
      steps: [
        { selector: '#projectSelect', title: 'Projeto', text: 'Selecione o levantamento salvo.' },
        { selector: '#elevationPoints', title: 'Pontos altimétricos', text: 'Informe ou confira os pontos com altitude usados na análise.' },
        { selector: '#analyzeElevation', title: 'Analisar', text: 'Clique para calcular e gerar a planialtimetria.' },
        { selector: '#elevationPreview', title: 'Resultado', text: 'A prévia técnica e os indicadores aparecem nesta área.', optional: true }
      ]
    },
    perimetros: {
      title: 'Perímetro por Azimute',
      steps: [
        { selector: '#projectSelect', title: 'Projeto', text: 'Selecione o projeto de referência. A geração só ocorre quando você solicitar.' },
        { selector: '#azimuthLines', title: 'Azimutes e distâncias', text: 'Informe os segmentos que formarão o perímetro.' },
        { selector: '#generateAzimuth', title: 'Gerar perímetro', text: 'Clique para calcular e visualizar o perímetro por azimute.' },
        { selector: '#azimuthPreview', title: 'Prévia', text: 'Confira fechamento, área, vértices e desenho antes de salvar ou exportar.', optional: true }
      ]
    },
    consultaCar: {
      title: 'Consulta Pública CAR',
      steps: [
        { selector: '#consultaCarModeRegistro,#consultaCarModeMunicipio', title: 'Tipo de pesquisa', text: 'Escolha se deseja pesquisar pelo número do CAR ou pelo município.' },
        { selector: '#consultaCarForm', title: 'Pesquisa', text: 'Informe os dados e clique em Buscar. O Surveyor consulta a base pública disponível.' },
        { selector: '#consultaCarMap', title: 'Mapa', text: 'O imóvel selecionado e as referências do CAR aparecem no mapa.' },
        { selector: '.consulta-car-results-card', title: 'Dados do imóvel', text: 'Os dados do imóvel consultado aparecem neste painel.', optional: true }
      ]
    },
    projetos: {
      title: 'Projetos',
      steps: [
        { selector: '#projectSearch', title: 'Pesquisar', text: 'Encontre rapidamente um trabalho salvo pelo nome ou informação cadastrada.' },
        { selector: '#projectSort', title: 'Ordenar', text: 'Organize os projetos da forma mais útil para o trabalho atual.' },
        { selector: '#projectsList', title: 'Seus projetos', text: 'Expanda um projeto para visualizar a miniatura e acessar as ações disponíveis.' }
      ]
    },
    acervos: {
      title: 'Acervos Oficiais',
      steps: [
        { selector: '.panel,.workspace-main', title: 'Acervos oficiais', text: 'Aqui ficam as referências oficiais disponíveis para consulta. Use os filtros da página para localizar o acervo necessário.' }
      ]
    },
    confrontacao: {
      title: 'Cartas de Confrontação',
      steps: [
        { selector: '#projectSelect', title: 'Projeto', text: 'Selecione o imóvel de origem.' },
        { selector: '.form-grid', title: 'Dados do confrontante', text: 'Preencha o confrontante, documento, lado, limite, local e observações.' },
        { selector: '#generateLetter', title: 'Gerar carta', text: 'Gere a carta e confira a prévia antes de baixar ou imprimir.' },
        { selector: '#letterOutput', title: 'Prévia', text: 'O documento gerado aparece aqui.', optional: true }
      ]
    },
    ods: {
      title: 'Planilha ODS',
      steps: [
        { selector: '#sheetProjectSelect,#projectSelect', title: 'Projeto', text: 'Escolha o projeto que fornecerá os vértices e dados da planilha.' },
        { selector: '#coordinateFormat', title: 'Coordenadas', text: 'Defina o formato de coordenadas que deseja usar.' },
        { selector: '#sheet-vertices', title: 'Vértices', text: 'Confira a tabela de vértices antes de exportar.' },
        { selector: '.button-row,.sheet-actions', title: 'Exportações', text: 'Baixe a planilha e os formatos complementares disponíveis.' }
      ]
    },
    ambiental: {
      title: 'Relatório Ambiental',
      steps: [
        { selector: '#projectSelect', title: 'Projeto', text: 'Selecione o projeto que será analisado.' },
        { selector: '#environmentNotes', title: 'Observações técnicas', text: 'Registre as observações e restrições relevantes para o relatório.' },
        { selector: '#generateEnvironmental', title: 'Gerar relatório', text: 'Clique para montar o relatório ambiental.' },
        { selector: '#environmentOutput', title: 'Prévia', text: 'Confira o relatório antes do download ou impressão.', optional: true }
      ]
    },
    customizacao: {
      title: 'Personalização',
      steps: [
        { selector: '#customizationChooser', title: 'Escolha o documento', text: 'Selecione qual tipo de documento deseja personalizar.' },
        { selector: '#companyName', title: 'Identidade da empresa', text: 'Cadastre nome, endereço, contatos e informações que irão para os documentos.' },
        { selector: '#logoPreviewWrap,#logoFile', title: 'Logotipo', text: 'Envie o logotipo que aparecerá nos documentos técnicos.' },
        { selector: '#responsibleTechnician', title: 'Responsável técnico', text: 'Informe os dados profissionais usados nos documentos.' },
        { selector: '#signaturePreviewWrap,#signatureFile', title: 'Assinatura', text: 'Cadastre a assinatura digitalizada quando desejar usar os fluxos de assinatura.' },
        { selector: '#saveCustomizationTop', title: 'Salvar', text: 'Salve as alterações para aplicá-las aos próximos documentos.' }
      ]
    },
    assinatura: {
      title: 'Assinatura Digital',
      steps: [
        { selector: '#signatureDropZone', title: 'Documento PDF', text: 'Selecione ou arraste o PDF que será assinado.' },
        { selector: '#signatureImageFrame', title: 'Assinatura cadastrada', text: 'O Surveyor usa a assinatura definida na Personalização.' },
        { selector: '#signatureViewerShell', title: 'Posicionar', text: 'Posicione a assinatura sobre a página e ajuste o tamanho.' },
        { selector: '#signatureApply', title: 'Aplicar', text: 'Aplique a assinatura e, se precisar, use a opção para aplicar outra.' },
        { selector: '#signatureDownload', title: 'Baixar', text: 'Baixe a nova cópia do PDF com a assinatura aplicada.' }
      ]
    },
    loteamentos: {
      title: 'Loteamentos / REURB',
      steps: [
        { selector: '#lotProjectName', title: 'Dados do projeto', text: 'Comece informando os dados básicos do loteamento ou REURB.' },
        { selector: '#featureFile', title: 'Geometria', text: 'Importe a geometria que será usada no processamento.' },
        { selector: '#lotsTable', title: 'Lotes', text: 'Os lotes e resultados aparecem nesta área.' },
        { selector: '.button-row,.toolbar', title: 'Ações e documentos', text: 'Use as ações disponíveis para salvar, exportar e gerar os documentos do projeto.' }
      ]
    },
    suporte: {
      title: 'Suporte',
      steps: [
        { selector: '#supportType', title: 'Tipo de atendimento', text: 'Escolha o assunto da solicitação para encaminhar o atendimento corretamente.' },
        { selector: '#supportDetails', title: 'Descreva o que aconteceu', text: 'Explique a dúvida, erro ou solicitação com o máximo de contexto necessário.' },
        { selector: '#supportSubmit', title: 'Enviar ao suporte', text: 'Depois de conferir seus dados, envie a solicitação para a equipe de suporte do Surveyor.' },
        { selector: '.support-info-card', title: 'Contato oficial', text: 'Aqui você encontra também as informações oficiais de atendimento.', optional: true }
      ]
    },
    car: {
      title: 'Módulo CAR',
      steps: [
        { selector: '#carProjectSelect', title: 'Projeto CAR', text: 'Selecione um projeto existente ou inicie um novo cadastro CAR.' },
        { selector: '#carProjectName', title: 'Dados do imóvel', text: 'Preencha os dados básicos do projeto, imóvel, município e cadastrante.' },
        { selector: '#addCarOwner', title: 'Proprietários e possuidores', text: 'Cadastre os titulares relacionados ao imóvel antes de validar o projeto.' },
        { selector: '#openCarMap', title: 'Feições no mapa', text: 'Abra o mapa para criar ou conferir perímetro, APP, reserva e demais geometrias.', optional: true },
        { selector: '#validateCarProject', title: 'Validar projeto', text: 'Use a validação preliminar para conferir dados e feições antes de gerar documentos.' },
        { selector: '#generateCarReport', title: 'Documentos CAR', text: 'Gere o relatório e os arquivos técnicos depois que o cadastro estiver conferido.', optional: true }
      ]
    },
    admin: {
      title: 'Administração',
      steps: [
        { selector: '.admin-nav,.admin-sidebar,.workspace-nav', title: 'Áreas administrativas', text: 'A navegação reúne usuários, planos, camadas e demais configurações administrativas.' },
        { selector: '.admin-main,.main,.workspace-main', title: 'Painel administrativo', text: 'Use somente as áreas necessárias para administrar o Surveyor. As ações de usuários e publicação afetam o ambiente de produção.' }
      ]
    }
  };

  function pageTourKey() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const page = document.body?.dataset?.page || '';
    if (/\/admin(?:\/|$)/.test(path)) return 'admin';
    if (page === 'mapa.html') return 'mapa';
    if (page === 'car.html') return 'car';
    if (page === 'memorial.html') return 'memorial';
    if (page === 'mapas.html') return 'mapas';
    if (page === 'pranchas.html') return 'pranchas';
    if (page === 'planialtimetria.html') return 'planialtimetria';
    if (page === 'perimetros.html') return 'perimetros';
    if (page === 'consulta-car.html') return 'consultaCar';
    if (page === 'acervos.html') return 'acervos';
    if (page === 'nuvem.html') return 'projetos';
    if (page === 'confrontacao.html') return 'confrontacao';
    if (page === 'ods.html') return 'ods';
    if (page === 'ambiental.html') return 'ambiental';
    if (page === 'customizacao.html') return 'customizacao';
    if (page === 'assinatura-digital.html') return 'assinatura';
    if (page === 'loteamentos-reurb.html') return 'loteamentos';
    if (page === 'suporte.html' || /\/suporte(?:\/|$)/.test(path)) return 'suporte';
    return '';
  }

  function runAction(name) {
    if (!name) return;
    if (name === 'openTools') { const b = $('.sv-home-tools-btn'); const m = $('#svHomeToolsMenu'); if (m?.classList.contains('hidden')) b?.click(); }
    if (name === 'closeTools') { const b = $('.sv-home-tools-btn'); const m = $('#svHomeToolsMenu'); if (m && !m.classList.contains('hidden')) b?.click(); }
    if (name === 'openMapTools') { const b = $('#mapQuickToolsToggle'); const d = $('#mapQuickToolsDrawer'); if (d?.classList.contains('hidden')) b?.click(); }
    if (name === 'closeMapTools') { const b = $('#mapQuickToolsToggle'); const d = $('#mapQuickToolsDrawer'); if (d && !d.classList.contains('hidden')) b?.click(); }
  }

  function resolveSelector(selector) {
    if (!selector) return null;
    for (const part of selector.split(',').map((v) => v.trim()).filter(Boolean)) {
      const el = $(part);
      if (visible(el)) return el;
    }
    return null;
  }
  async function waitForElement(selector, ms = 4500) {
    const start = performance.now();
    while (performance.now() - start < ms) {
      const el = resolveSelector(selector);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }

  function buildTourDom() {
    const curtains = ['top','right','bottom','left'].map((name) => {
      const el = document.createElement('div'); el.className = `sv-tour-curtain sv-tour-curtain-${name}`; el.dataset.side = name; document.body.appendChild(el); return el;
    });
    const spot = document.createElement('div'); spot.className = 'sv-tour-spotlight'; document.body.appendChild(spot);
    const card = document.createElement('section'); card.className = 'sv-tour-card'; card.setAttribute('role','dialog'); card.setAttribute('aria-modal','true'); card.innerHTML = `
      <div class="sv-tour-eyebrow"><span class="sv-tour-label">Tutorial Surveyor</span><span class="sv-tour-step">1/1</span></div>
      <h2></h2><p></p>
      <div class="sv-tour-actions"><button class="sv-tour-skip" type="button">Pular tutorial</button><button class="sv-tour-prev" type="button">Voltar</button><button class="sv-tour-next" type="button">Próximo</button></div>`;
    document.body.appendChild(card);
    return { curtains, spot, card };
  }
  function setCurtains(dom, r, pad = 8) {
    const x1 = Math.max(0, r.left - pad), y1 = Math.max(0, r.top - pad), x2 = Math.min(innerWidth, r.right + pad), y2 = Math.min(innerHeight, r.bottom + pad);
    const by = Object.fromEntries(dom.curtains.map((el) => [el.dataset.side, el]));
    Object.assign(by.top.style, { left:'0px', top:'0px', width:'100vw', height:`${y1}px` });
    Object.assign(by.bottom.style, { left:'0px', top:`${y2}px`, width:'100vw', height:`${Math.max(0, innerHeight-y2)}px` });
    Object.assign(by.left.style, { left:'0px', top:`${y1}px`, width:`${x1}px`, height:`${Math.max(0,y2-y1)}px` });
    Object.assign(by.right.style, { left:`${x2}px`, top:`${y1}px`, width:`${Math.max(0,innerWidth-x2)}px`, height:`${Math.max(0,y2-y1)}px` });
    Object.assign(dom.spot.style, { left:`${x1}px`, top:`${y1}px`, width:`${Math.max(20,x2-x1)}px`, height:`${Math.max(20,y2-y1)}px` });
  }
  function positionCard(card, rect) {
    if (innerWidth <= 700) return;
    const gap = 18, w = Math.min(370, innerWidth - 28), h = Math.min(card.offsetHeight || 230, innerHeight - 28);
    let left = rect.right + gap, top = rect.top;
    if (left + w > innerWidth - 14) left = rect.left - w - gap;
    if (left < 14) { left = Math.max(14, Math.min(innerWidth - w - 14, rect.left + (rect.width - w)/2)); top = rect.bottom + gap; }
    if (top + h > innerHeight - 14) top = Math.max(14, innerHeight - h - 14);
    if (top < 14) top = 14;
    if (top < rect.bottom && top + h > rect.top && left < rect.right && left + w > rect.left) {
      const below = rect.bottom + gap;
      const above = rect.top - h - gap;
      if (below + h <= innerHeight - 14) top = below; else if (above >= 14) top = above;
    }
    card.style.left = `${left}px`; card.style.top = `${top}px`; card.style.right='auto'; card.style.bottom='auto';
  }
  function cleanupActive() {
    if (!active) return;
    active.target?.classList.remove('sv-tour-focus-target');
    active.resizeHandler && window.removeEventListener('resize', active.resizeHandler);
    active.scrollHandler && window.removeEventListener('scroll', active.scrollHandler, true);
    active.dom.curtains.forEach((el) => el.remove()); active.dom.spot.remove(); active.dom.card.remove();
    active = null;
  }
  async function showStep(index) {
    if (!active) return;
    const tour = active.tour;
    if (index < 0) index = 0;
    if (index >= tour.steps.length) { finishTour(true); return; }
    const previous = active.step;
    if (previous?.after) runAction(previous.after);
    active.target?.classList.remove('sv-tour-focus-target');
    const step = tour.steps[index];
    if (step.before) runAction(step.before);
    const target = await waitForElement(step.selector, step.optional ? 800 : 4500);
    if (!target) { if (step.optional) { active.step = null; return showStep(index + 1); } active.step = null; return showStep(index + 1); }
    target.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
    await new Promise((r) => setTimeout(r, 260));
    active.index = index; active.step = step; active.target = target; target.classList.add('sv-tour-focus-target');
    const card = active.dom.card;
    $('.sv-tour-label', card).textContent = tour.title || 'Tutorial Surveyor';
    $('.sv-tour-step', card).textContent = `${index + 1}/${tour.steps.length}`;
    $('h2', card).textContent = step.title || 'Surveyor'; $('p', card).textContent = step.text || '';
    $('.sv-tour-prev', card).disabled = index === 0;
    $('.sv-tour-next', card).textContent = index === tour.steps.length - 1 ? 'Concluir' : 'Próximo';
    const refresh = () => { if (!active?.target?.isConnected) return; const rect = active.target.getBoundingClientRect(); setCurtains(active.dom, rect, 8); positionCard(card, rect); };
    refresh();
  }
  function finishTour(completed) {
    if (!active) return;
    const key = active.key; const step = active.step;
    if (step?.after) runAction(step.after);
    cleanupActive();
    markTour(key, completed);
  }
  async function startTour(key, { force = false } = {}) {
    if (active || !TOURS[key]) return false;
    if (!force && !tourNeeded(key)) return false;
    if (key === 'admin') {
      const role = String(currentUser()?.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'administrator') return false;
    }
    const dom = buildTourDom();
    active = { key, tour: TOURS[key], index: 0, step: null, target: null, dom };
    $('.sv-tour-next', dom.card).addEventListener('click', () => showStep(active.index + 1));
    $('.sv-tour-prev', dom.card).addEventListener('click', () => showStep(active.index - 1));
    $('.sv-tour-skip', dom.card).addEventListener('click', () => finishTour(false));
    dom.curtains.forEach((c) => c.addEventListener('click', (e) => e.preventDefault()));
    const resizeHandler = () => active && active.target && (() => { const r = active.target.getBoundingClientRect(); setCurtains(dom, r, 8); positionCard(dom.card, r); })();
    const scrollHandler = resizeHandler;
    active.resizeHandler = resizeHandler; active.scrollHandler = scrollHandler;
    window.addEventListener('resize', resizeHandler); window.addEventListener('scroll', scrollHandler, true);
    await showStep(0);
    return true;
  }

  function showReviewPrompt() {
    if ($('.sv-tour-review')) return;
    const wrap = document.createElement('div'); wrap.className = 'sv-tour-review';
    wrap.innerHTML = `<section class="sv-tour-review-card"><div class="sv-tour-review-mark">↻</div><h2>Bem-vindo de volta ao Surveyor</h2><p>Faz mais de 30 dias desde seu último acesso. Quer fazer uma revisão rápida das principais áreas antes de continuar?</p><div class="sv-tour-review-actions"><button type="button" data-review-later>Agora não</button><button class="primary" type="button" data-review-start>Fazer revisão</button></div></section>`;
    document.body.appendChild(wrap);
    const close = () => { state.lastReviewPromptAt = iso(); persist(); wrap.remove(); };
    $('[data-review-later]', wrap).addEventListener('click', close);
    $('[data-review-start]', wrap).addEventListener('click', () => { close(); const key = pageTourKey(); startTour(key && key !== 'admin' ? key : 'global', { force:true }); });
  }

  function installHelpButton() {
    // O atalho flutuante de ajuda pertence somente à tela inicial.
    // Os tutoriais contextuais das outras páginas continuam funcionando no primeiro acesso,
    // mas não deixam um botão flutuante ocupando a interface dos módulos técnicos.
    const isHome = document.body?.dataset?.page === 'index.html' || /^\/(?:index\.html)?$/i.test(location.pathname);
    if (!isHome || $('.sv-tour-help')) return;
    const btn = document.createElement('button'); btn.type='button'; btn.className='sv-tour-help'; btn.setAttribute('aria-label','Ajuda e tutoriais'); btn.title='Ajuda e tutoriais'; btn.textContent='?';
    const panel = document.createElement('div'); panel.className='sv-tour-help-panel'; panel.hidden=true;
    panel.innerHTML = `<strong>Ajuda e tutoriais</strong><button type="button" data-tour-global>Refazer introdução ao Surveyor</button><a href="/suporte/">Abrir suporte</a>`;
    document.body.append(btn,panel); helpPanel=panel;
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; });
    $('[data-tour-global]', panel)?.addEventListener('click', () => { panel.hidden=true; startTour('global',{force:true}); });
    document.addEventListener('click', (event) => { if (!panel.hidden && event.target !== btn && !panel.contains(event.target)) panel.hidden=true; });
  }

  async function boot() {
    if (/\/login\/?$/i.test(location.pathname) || /\/public-project\/?$/i.test(location.pathname)) return;
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (!auth) return;
    try { await auth.ensureSession?.(); } catch {}
    const user = currentUser();
    if (!user) return;

    const local = readLocal();
    const remote = await loadRemote();
    state = mergeStates(local, remote);

    // Migração de contas que já existiam antes do lançamento do tutorial.
    // Elas não recebem à força todos os tutoriais de primeiro acesso agora;
    // continuam podendo abrir a ajuda na Home e receber a revisão após 30 dias.
    // Contas novas (criadas após o rollout) começam com tours zerados e recebem
    // automaticamente a introdução e o tour de cada módulo na primeira visita.
    const accountCreatedAt = parseTime(user.createdAt || user.$createdAt || '');
    const legacyAccount = accountCreatedAt > 0 && accountCreatedAt < ONBOARDING_ROLLOUT_AT;
    if (legacyAccount) {
      let changed = false;
      Object.entries(TOUR_VERSIONS).forEach(([key, version]) => {
        if (Number(state.tours?.[key]?.version || 0) < Number(version || 1)) {
          state.tours ||= {};
          state.tours[key] = { version: Number(version || 1), completedAt: iso(), skippedAt: '' };
          changed = true;
        }
      });
      if (!state.lastSeenAt) { state.lastSeenAt = iso(); changed = true; }
      if (changed) persist();
    }

    const previousSeen = parseTime(state.lastSeenAt);
    const inactiveMs = previousSeen ? Date.now() - previousSeen : 0;
    const isHome = document.body?.dataset?.page === 'index.html' || /^\/(?:index\.html)?$/i.test(location.pathname);
    const key = pageTourKey();

    installHelpButton();
    await new Promise((r) => setTimeout(r, key === 'mapa' ? 950 : 600));

    // A Home ensina a navegação geral. Em qualquer módulo, o tutorial específico
    // daquele módulo pode começar mesmo que a introdução global ainda não tenha sido
    // concluída. Isso cobre, por exemplo, uma conta nova que entra direto no Mapa.
    if (!legacyAccount) {
      if (isHome && tourNeeded('global')) {
        await startTour('global');
      } else if (key && tourNeeded(key)) {
        await startTour(key);
      }
    }

    if (!active && legacyAccount && inactiveMs >= REVIEW_AFTER_DAYS * DAY) {
      const lastPrompt = parseTime(state.lastReviewPromptAt);
      if (!lastPrompt || Date.now() - lastPrompt >= 7 * DAY) showReviewPrompt();
    } else if (!active && !legacyAccount && !tourNeeded('global') && inactiveMs >= REVIEW_AFTER_DAYS * DAY) {
      const lastPrompt = parseTime(state.lastReviewPromptAt);
      if (!lastPrompt || Date.now() - lastPrompt >= 7 * DAY) showReviewPrompt();
    }

    const todayEnough = !previousSeen || Date.now() - previousSeen >= 12 * 60 * 60 * 1000;
    state.lastSeenAt = iso();
    persist({ remote: todayEnough });
  }

  window.SurveyorOnboarding = { boot, startTour, getState: () => clone(state), pageTourKey };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 250), { once:true });
  else setTimeout(boot, 250);
})();
