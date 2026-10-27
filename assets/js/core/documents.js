(() => {
  'use strict';

  const page = document.body?.dataset?.page || '';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const pageConfigs = {
    'memorial.html': {
      title: 'Memorial descritivo',
      preview: '#memorialOutput',
      previewTitle: 'Pré-visualização do memorial',
      previewText: 'Prévia viva: selecione o projeto e ajuste os dados; o memorial acompanha as alterações.',
      generate: '#generateMemorial',
      compactModel:true, noFinalStep:true, autoPreviewOnProject:true, liveFieldPreview:true,
      bottomActionSelectors:['#generateMemorial','.export-menu'],
      sections: [
        { title:'Projeto', selectors:['#projectSelect','#memDocumentType','#memRegistration','#memIncra','#memCnib','#memOwnerName','#memOwnerCpf','#memOwnerRg','#memComarca'], info:'' },
        { title:'Personalização', betaPersonalization:true, runtimePersonalization:true, betaBadge:false, betaStatus:'Memorial vivo e personalizável.', betaGroups:[
          { tool:'memorial', title:'Memorial', selectors:['#memorialTemplateSelect','#memTechnician'] },
          { tool:'map', title:'Mapa', selectors:['#memMapZoom','#memMapBackground','#memShowConfrontantes','#memIncludeMap'] }
        ] }
      ]
    },
    'mapas.html': {
      title:'Mapas e croquis', preview:'#mapPreview', previewTitle:'Pré-visualização do mapa / croqui',
      previewText:'Prévia viva: ao selecionar o projeto, o croqui é preparado e exibido automaticamente.', generate:'#generateMapV19',
      compactModel:true, noFinalStep:true, autoPreviewOnProject:true, liveFieldPreview:true,
      bottomActionSelectors:['#generateMapV19','.export-menu'],
      sections:[
        { title:'Projeto', selectors:['#projectSelect','#mapTitle','#mapRegistration','#mapTechnician'], info:'' },
        { title:'Personalização', betaPersonalization:true, runtimePersonalization:true, betaBadge:false, betaStatus:'Croqui ao vivo.', betaGroups:[
          { tool:'sheet', title:'Croqui', selectors:['#mapBackground','#mapZoom','#printFormat'] },
          { tool:'elements', title:'Elementos', blocks:['.sv-doc-options'] }
        ] }
      ]
    },
    'pranchas.html': {
      title:'Pranchas técnicas', preview:'#mapPreview', previewTitle:'Pré-visualização da prancha',
      previewText:'Prévia permanente: qualquer ajuste é refletido automaticamente na prancha.', generate:'#generateMapV19',
      hideManualGenerate:true, noFinalStep:true,
      sections:[
        { title:'Projeto', selectors:['#projectSelect','#mapTitle','#mapRegistration','#mapDistrict','#mapRegistryOffice','#mapIncra','#mapCnib','#mapTechnician'], info:'' },
        { title:'Personalização', betaPersonalization:true, runtimePersonalization:true, betaGroups:[
          { tool:'sheet', title:'Prancha', selectors:['#mapSheetLayout','#mapZoom','#printFormat','#mapScale','#mapSheetNumber'] },
          { tool:'elements', title:'Elementos', blocks:['.sv-doc-options'] }
        ] }
      ]
    },
    'planialtimetria.html': {
      title:'Planialtimetria / MDT', preview:'#elevationPreview', previewTitle:'Pré-visualização planialtimétrica',
      previewText:'Prévia viva da planta planialtimétrica.', generate:'#analyzeElevation',
      compactModel:true, noFinalStep:true, autoPreviewOnProject:true, liveFieldPreview:true,
      bottomActionSelectors:['#analyzeElevation','#printPreview','#downloadPlanialtSvg'],
      sections:[
        { title:'Projeto', selectors:['#projectSelect','#altitudeSource','#reliefCorrection','#elevationPoints','#printFormat','#idwLat','#idwLng','#idwPower'], blockControls:['#loadProjectAltitudes','#calculateIdw'], info:'' },
        { title:'Personalização', betaPersonalization:true, betaBadge:false, betaStatus:'Personalize a planta planialtimétrica diretamente na prévia.' }
      ]
    },
    'perimetros.html': {
      title:'Perímetros por azimute', preview:'#azimuthPreview', previewTitle:'Pré-visualização do perímetro',
      previewText:'Prévia viva do perímetro e da planta técnica.', generate:'#generateAzimuth',
      compactModel:true, noFinalStep:true, autoPreviewOnProject:true, liveFieldPreview:true,
      bottomActionSelectors:['#generateAzimuth','#saveAzimuthProject','.export-menu'], saveAction:'#saveAzimuthProject',
      sections:[
        { title:'Projeto', selectors:['#projectSelect','#startLat','#startLng','#azProjectName','#azimuthMapZoom','#azimuthLines'], info:'' },
        { title:'Personalização', betaPersonalization:true, betaBadge:false, betaStatus:'Personalize a planta de perímetro diretamente na prévia.' }
      ]
    },
    'confrontacao.html': {
      title:'Cartas de confrontação', preview:'#letterOutput', previewTitle:'Pré-visualização da carta',
      previewText:'A carta acompanha os dados preenchidos e permanece pronta para download.', generate:'#generateLetter',
      compactModel:true, noFinalStep:true, autoPreviewOnProject:true, liveFieldPreview:true,
      bottomActionSelectors:['#generateLetter','.export-menu'],
      sections:[
        { title:'Projeto', selectors:['#projectSelect','#letterPlace','#letterDate','#neighborName','#neighborDoc','#neighborSide','#neighborLimit','#neighborNotes'], info:'' }
      ]
    },
    'ambiental.html': {
      title:'Relatório ambiental', preview:'#environmentOutput', previewTitle:'Pré-visualização do relatório ambiental',
      previewText:'Prévia viva do relatório ambiental.', generate:'#generateEnvironmental',
      compactModel:true, noFinalStep:true, autoPreviewOnProject:true, liveFieldPreview:true,
      bottomActionSelectors:['#generateEnvironmental','.export-menu'],
      sections:[
        { title:'Projeto', selectors:['#projectSelect','#environmentAnalyst','#environmentNotes'], info:'' }
      ]
    },
    'ods.html': {
      title:'Planilha do projeto', special:'ods', preview:'#sheet-vertices', previewTitle:'Planilha e pré-visualização técnica',
      previewText:'Confira vértices, confrontantes e informações técnicas antes de exportar.', generate:'#sheetDownloadPdf',
      sections:[
        { title:'Projeto', selectors:['#sheetProjectSelect'], info:'Selecione o projeto que será usado para montar a planilha técnica.' },
        { title:'Conteúdo da planilha', selectors:['#coordinateFormat'] },
        { title:'Pré-visualização', note:'Use as abas da pré-visualização para conferir planilha, proprietário, confrontantes, mapa e memorial.' }
      ]
    },
    'loteamentos-reurb.html': {
      title:'Loteamentos e REURB', special:'loteamento', preview:'#lotPreview', previewTitle:'Pré-visualização / croqui',
      previewText:'Prévia viva do lote selecionado e das edições do croqui.', generate:'#downloadLotReportPdf',
      compactModel:true,
      bottomActionSelectors:['#lotSaveProject','.sv-lote-download-menu'], saveAction:'#lotSaveProject',
      footerDownloadSelectors:['#downloadProjectDxf','#exportConfrontantes','#downloadAllMemorials','#downloadAllCroquis','#downloadLotWord','#downloadLotReportPdf','#downloadLotReportWord','#downloadLotReportHtml'],
      sections:[
        { title:'Projeto', selectors:['#lotProjectName','#lotOwner','#lotCity','#lotUf','#lotZone','#lotDate','#techName','#techCompany','#techType','#techDoc','#techRg','#techCouncil','#techCouncilNumber','#techRt','#techPhone','#techEmail','#techWebsite','#techCouncilUf'], blockControls:['#lotSaveProject'], info:'' },
        { title:'Feições e lotes', selectors:['#featureType','#featureFile','#lotBasemap'], blockControls:['#featureImport'], note:'Importe e selecione o lote que será visualizado e personalizado.' },
        { title:'Personalização', betaPersonalization:true, betaBadge:false, betaStatus:'Personalize o croqui do lote diretamente na prévia.', betaGroups:[
          { tool:'sheet', title:'Croqui do lote', selectors:['#lotZoom','#orthoFiles'] }
        ] }
      ]
    }
  };

  const cfg = pageConfigs[page];
  if (!cfg) return;
  // Estilo compacto validado nos editores cartográficos: as ações mantêm rótulos acessíveis.
  if (page === 'mapas.html' || page === 'pranchas.html') document.body.classList.add('sv-document-icon-mode');

  const GENERATION_CONSENT_SECONDS = 5;
  const previewDownloadPages = new Set([
    'memorial.html',
    'mapas.html',
    'pranchas.html',
    'perimetros.html',
    'confrontacao.html',
    'ambiental.html'
  ]);

  function create(tag, className, html = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  }

  function iconMarkup(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v5h5"></path><path d="M9.5 12h5M9.5 16h5"></path></svg>';
  }

  function ensurePageHeader(main){
    main.querySelector(':scope > .sv-doc-module-head')?.remove();
    const sourceHeader = main.querySelector(':scope > .top, :scope > .workspace-page-head');
    const heading = create('header','sv-doc-module-head');
    heading.innerHTML = `<div class="sv-doc-module-title"><span class="sv-doc-module-icon">${iconMarkup()}</span><h1>${cfg.title}</h1></div>`;
    if (sourceHeader) {
      sourceHeader.insertAdjacentElement('beforebegin', heading);
      sourceHeader.remove();
    } else {
      main.prepend(heading);
    }
    return heading;
  }

  function ensureMapOptions(){
    if (!['mapas.html','pranchas.html'].includes(page) || $('#mapShowCotas')) return;
    const box = create('div','sv-doc-options');
    box.innerHTML = `
      <div class="sv-doc-options-grid">
        <label><input type="checkbox" id="mapShowCotas" checked><span>Cotas</span></label>
        <label><input type="checkbox" id="mapShowGlebaCotas"><span>Cotas da gleba</span></label>
        <label><input type="checkbox" id="mapShowVertices" checked><span>Vértices</span></label>
        <label><input type="checkbox" id="mapShowConfrontantes" checked><span>Confrontantes</span></label>
        <label><input type="checkbox" id="mapShowNorth" checked><span>Norte</span></label>
        <label><input type="checkbox" id="mapShowGrid" checked><span>Grade técnica</span></label>
        <label><input type="checkbox" id="mapShowScale" checked><span>Escala gráfica</span></label>
      </div>`;
    const firstPanel = document.querySelector('.main > section.panel');
    const row = firstPanel?.querySelector('.button-row');
    if (row) row.before(box); else firstPanel?.appendChild(box);
  }

  function labelFor(selector){
    const control = $(selector);
    if (!control) return null;
    const label = control.closest('label');
    if (label) return label;
    const wrapper = create('label','sv-doc-generated-label');
    let text = control.getAttribute('aria-label') || control.getAttribute('name') || 'Opção';
    if (control.id === 'coordinateFormat') text = 'Formato de coordenadas';
    wrapper.append(document.createTextNode(text), control);
    return wrapper;
  }

  function blockForControl(selector){
    const control = $(selector);
    if (!control) return null;
    return control.closest('.button-row') || control.closest('.form-grid') || control.parentElement;
  }

  function makeStep(spec, index){
    const section = create('section','sv-doc-step');
    section.dataset.stepIndex = String(index);
    const head = create('div','sv-doc-step-head');
    head.innerHTML = `<h2>${spec.title}</h2>${spec.description ? `<p>${spec.description}</p>` : ''}`;
    section.appendChild(head);
    if (spec.info) section.appendChild(create('div','sv-doc-info',`<span aria-hidden="true">i</span><p>${spec.info}</p>`));
    if (spec.note) section.appendChild(create('div','sv-doc-step-note',`<p>${spec.note}</p>`));
    if (spec.betaPersonalization) {
      section.classList.add('sv-doc-beta-personalization');
      section.dataset.betaPersonalization = '1';
      if (spec.runtimePersonalization) section.classList.add('sv-doc-runtime-personalization');
      if (!spec.runtimePersonalization) {
        const beta = create('div','sv-beta-personalization-placeholder');
        const badge = spec.betaBadge === false ? '' : '<span>BETA</span>';
        beta.innerHTML = `<div class="sv-beta-personalization-kicker">${badge}<strong>Editor integrado</strong></div><small data-beta-personalization-status>${spec.betaStatus || 'Prévia ao vivo.'}</small>`;
        section.appendChild(beta);
      }
      (spec.betaGroups || []).forEach((group) => {
        const host = create('div','sv-beta-source-controls');
        if (spec.runtimePersonalization) host.hidden = true;
        host.dataset.betaSource = String(group.tool || 'group');
        host.dataset.betaSourceTitle = String(group.title || 'Opções');
        const groupFields = [];
        (group.selectors || []).forEach((selector) => {
          const label = labelFor(selector);
          if (label && !groupFields.includes(label)) groupFields.push(label);
        });
        if (groupFields.length) {
          const grid = create('div', `sv-doc-fields${groupFields.length > 1 ? ' is-two' : ''}`);
          groupFields.forEach((label) => grid.appendChild(label));
          host.appendChild(grid);
        }
        (group.blocks || []).forEach((selector) => {
          const node = $(selector);
          if (node) host.appendChild(node);
        });
        section.appendChild(host);
      });
    }

    const fields = [];
    (spec.selectors || []).forEach((selector) => {
      const label = labelFor(selector);
      if (label && !fields.includes(label)) fields.push(label);
    });
    if (fields.length) {
      const grid = create('div', `sv-doc-fields${fields.length > 1 ? ' is-two' : ''}`);
      fields.forEach((label) => grid.appendChild(label));
      section.appendChild(grid);
    }

    (spec.blocks || []).forEach((selector) => {
      const node = $(selector);
      if (node) section.appendChild(node);
    });
    (spec.blockControls || []).forEach((selector) => {
      const node = blockForControl(selector);
      if (node && node.isConnected && node.parentElement !== section) section.appendChild(node);
    });
    if ((spec.actions || []).length) {
      const row = create('div','button-row sv-doc-personalization-actions');
      (spec.actions || []).forEach((selector) => {
        const node = $(selector);
        if (node) row.appendChild(node);
        else {
          const slot = create('span','sv-doc-personalization-action-slot');
          slot.dataset.actionSelector = selector;
          slot.hidden = true;
          row.appendChild(slot);
        }
      });
      section.appendChild(row);
    }
    return section;
  }

  function makeNavigation(stepCount, currentIndex){
    const nav = create('div','sv-doc-step-nav');
    if (currentIndex > 0) {
      const prev = create('button','sv-doc-nav-btn is-secondary','Anterior');
      prev.type = 'button'; prev.dataset.docStep = String(currentIndex - 1);
      prev.title = 'Anterior'; prev.setAttribute('aria-label','Anterior'); nav.appendChild(prev);
    } else nav.appendChild(create('span','sv-doc-nav-spacer'));
    if (currentIndex < stepCount - 1) {
      const next = create('button','sv-doc-nav-btn is-primary','Próximo');
      next.type = 'button'; next.dataset.docStep = String(currentIndex + 1);
      next.title = 'Próximo'; next.setAttribute('aria-label','Próximo'); nav.appendChild(next);
    }
    return nav;
  }

  function makePranchaFooterDownload(){
    const menu = create('div','sv-prancha-footer-download');
    const trigger = create('button','sv-prancha-footer-download-trigger','Download');
    trigger.type = 'button';
    trigger.setAttribute('aria-label','Abrir opções de download da prancha');
    trigger.title = 'Baixar documento';
    trigger.setAttribute('aria-haspopup','menu');
    trigger.setAttribute('aria-expanded','false');
    const list = create('div','sv-prancha-footer-download-menu');
    list.hidden = true;
    const setOpen = (open) => {
      const next = Boolean(open);
      menu.classList.toggle('is-open',next);
      trigger.setAttribute('aria-expanded',next?'true':'false');
      list.hidden = !next;
    };
    trigger.addEventListener('click',(event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(trigger.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('pointerdown',(event) => event.stopPropagation());
    document.addEventListener('pointerdown',(event) => {
      if (trigger.getAttribute('aria-expanded') === 'true' && !menu.contains(event.target)) setOpen(false);
    },true);
    document.addEventListener('keydown',(event) => {
      if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') { setOpen(false); trigger.focus(); }
    });
    const options = [
      { target:'printPreviewV19', format:'PDF', title:'PDF técnico' },
      { target:'downloadSvgV19', format:'SVG', title:'SVG vetorial' },
      { target:'downloadMapWordV197', format:'DOC', title:'Word editável' }
    ];
    options.forEach((item) => {
      const button = create('button','sv-prancha-footer-download-item');
      button.type = 'button';
      button.setAttribute('data-click-target',item.target);
      button.innerHTML = `<span>${item.format}</span><strong>${item.title}</strong>`;
      button.addEventListener('click',() => setOpen(false));
      list.appendChild(button);
    });
    menu.append(trigger,list);
    return menu;
  }

  function makeFinalStep(buttonRow, index){
    const section = create('section','sv-doc-step sv-doc-final-step');
    section.dataset.stepIndex = String(index);
    const heading = cfg.finalHeading || 'Gerar e baixar';
    const text = cfg.finalText || 'Revise as informações e gere o arquivo final.';
    section.dataset.tabTitle = cfg.finalTitle || heading;
    section.appendChild(create('div','sv-doc-step-head',`<h2>${heading}</h2><p>${text}</p>`));
    if (buttonRow) {
      buttonRow.classList.add('sv-doc-final-actions');
      if (cfg.hideManualGenerate) {
        const generate = buttonRow.querySelector(cfg.generate);
        if (generate) { generate.hidden = true; generate.dataset.livePreviewTrigger = '1'; }
      }
      section.appendChild(buttonRow);
      if (cfg.hideManualGenerate && page !== 'pranchas.html') section.appendChild(create('div','sv-doc-step-note','<p>A pré-visualização é atualizada automaticamente. Use o menu Download acima da prancha para exportar.</p>'));
    } else {
      section.appendChild(create('div','sv-doc-step-note','<p>Os comandos de geração e download ficam disponíveis na pré-visualização ao lado.</p>'));
    }
    return section;
  }

  function extractGeneric(main, left, rightBody){
    const preview = $(cfg.preview);
    const generate = $(cfg.generate);
    const buttonRow = generate?.closest('.button-row') || null;
    const extras = [];
    (cfg.rightExtras || []).forEach((selector) => $$(selector, main).forEach((node) => { if (!extras.includes(node)) extras.push(node); }));
    const finalExtras = [];
    (cfg.finalExtras || []).forEach((selector) => $$(selector, main).forEach((node) => { if (!finalExtras.includes(node)) finalExtras.push(node); }));

    const steps = cfg.sections.map((spec, index) => makeStep(spec, index));
    if (!cfg.noFinalStep) {
      const final = makeFinalStep(buttonRow, steps.length);
      if (finalExtras.length) {
        const finalExtrasHost = create('div','sv-doc-final-extras');
        finalExtras.forEach((node) => {
          node.classList.remove('sv-doc-preview-extra');
          finalExtrasHost.appendChild(node);
        });
        final.appendChild(finalExtrasHost);
      }
      steps.push(final);
    } else if (buttonRow) {
      buttonRow.hidden = true;
      buttonRow.setAttribute('aria-hidden','true');
      buttonRow.classList.add('sv-doc-source-actions');
      left.appendChild(buttonRow);
    }

    if (preview) { preview.hidden = false; preview.classList.add('sv-doc-primary-preview'); rightBody.appendChild(preview); }
    extras.forEach((node) => { if (node !== preview && !node.contains(preview)) { node.classList.add('sv-doc-preview-extra'); rightBody.appendChild(node); } });
    steps.forEach((section) => left.appendChild(section));

    $$('.main > section.panel').forEach((panel) => panel.remove());
    return steps;
  }

  function extractOds(main, left, rightBody){
    const panel = main.querySelector(':scope > section.panel.sheet-panel');
    if (!panel) return [];
    const edit = $('#editVertices');
    const steps = cfg.sections.map((spec,index) => makeStep(spec,index));
    if (edit) {
      const row = create('div','sv-doc-inline-action');
      row.appendChild(edit);
      steps[0]?.appendChild(row);
    }
    steps.push(makeFinalStep(null, steps.length));
    const tabs = panel.querySelector('.sheet-tabs');
    if (tabs) rightBody.appendChild(tabs);
    $$('.sheet-tab-panel', panel).forEach((section) => rightBody.appendChild(section));
    steps.forEach((section) => left.appendChild(section));
    panel.remove();
    return steps;
  }

  function extractLoteamento(main, left, rightBody){
    const panels = $$('.main > section.panel');
    if (!panels.length) return [];
    const lastPanel = panels.find((panel) => panel.classList.contains('loteamento-layout')) || panels[panels.length - 1];
    const preview = $(cfg.preview);
    const lotsBlock = lastPanel?.children?.[0] || null;
    const previewBlock = lastPanel?.children?.[1] || null;
    const steps = cfg.sections.map((spec,index) => makeStep(spec,index));
    const projectStep = steps[0] || null;
    const lotsStep = steps[1] || null;
    const personalizationStep = steps.find((section)=>section.dataset.betaPersonalization === '1') || steps.at(-1) || null;

    const sourceActions = create('div','sv-doc-source-actions');
    sourceActions.hidden = true;
    const footerDownloads = (cfg.footerDownloadSelectors || []).flatMap((selector)=>$$(selector));
    const preserveForFooter = new Set([...(cfg.bottomActionSelectors || []).flatMap((selector)=>$$(selector)), ...footerDownloads]);
    preserveForFooter.forEach((node)=>{ if(node && !footerDownloads.includes(node)) sourceActions.appendChild(node); });
    if (footerDownloads.length) {
      const menu = create('div','export-menu sv-lote-download-menu');
      const trigger = create('button','btn');
      trigger.type = 'button';
      trigger.textContent = 'Download';
      const list = create('div','export-menu-list');
      list.setAttribute('role','menu');
      footerDownloads.forEach((node)=>{
        node.classList.remove('primary','green');
        node.setAttribute('role','menuitem');
        list.appendChild(node);
      });
      menu.append(trigger,list);
      sourceActions.appendChild(menu);
    }
    left.appendChild(sourceActions);

    if (lotsStep && lotsBlock) {
      lotsStep.querySelector(':scope > .sv-doc-step-note')?.remove();
      const host = create('div','sv-lote-step-zone sv-lote-lots-zone');
      Array.from(lotsBlock.children).forEach((node) => {
        if (preserveForFooter.has(node) || node.matches?.('h1,h2,h3,h4,h5,h6')) return;
        host.appendChild(node);
      });
      host.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => heading.remove());
      host.querySelectorAll('details').forEach((detail) => {
        detail.open = true;
        detail.setAttribute('open','open');
        const summary = detail.querySelector(':scope > summary');
        if (summary) summary.hidden = true;
      });
      lotsStep.appendChild(host);
    }

    if (personalizationStep && previewBlock) {
      const controls = create('div','sv-lote-step-zone sv-lote-generation-zone');
      Array.from(previewBlock.children).forEach((node) => {
        if (node === preview || preserveForFooter.has(node) || node.matches?.('h1,h2,h3,h4,h5,h6')) return;
        controls.appendChild(node);
      });
      controls.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => heading.remove());
      controls.querySelectorAll('details').forEach((detail) => {
        detail.open = true;
        detail.setAttribute('open','open');
        const summary = detail.querySelector(':scope > summary');
        if (summary) summary.hidden = true;
      });
      controls.querySelectorAll('.button-row').forEach((row)=>{
        const visible = Array.from(row.children).some((child)=>!child.hidden && !child.matches?.('input[type="hidden"]'));
        if(!visible) row.remove();
      });
      if (controls.children.length) personalizationStep.appendChild(controls);
    }

    // Dados complementares que ficaram em painéis auxiliares entram no projeto,
    // preservando uma única coluna de configuração.
    panels.forEach((panel)=>{
      if(panel===lastPanel) return;
      Array.from(panel.children).forEach((node)=>{
        if(node.matches?.('h1,h2,h3,h4,h5,h6') || preserveForFooter.has(node)) return;
        if(projectStep && node.isConnected) projectStep.appendChild(node);
      });
    });

    steps.forEach((section) => left.appendChild(section));
    if (preview) {
      preview.hidden = false;
      preview.classList.add('sv-doc-primary-preview','sv-lote-preview-only');
      rightBody.appendChild(preview);
    }
    panels.forEach((panel) => panel.remove());
    return steps;
  }

  function buildTabs(main, top, steps){
    const existing = $('.sv-doc-tabs', main);
    existing?.remove();
    const nav = create('nav','sv-doc-tabs');
    nav.setAttribute('aria-label','Etapas da geração');
    steps.forEach((section,index) => {
      const title = section.dataset.tabTitle || section.querySelector('h2')?.textContent || `Etapa ${index + 1}`;
      const isBeta = section.dataset.betaPersonalization === '1';
      const showBadge = isBeta && section.querySelector('.sv-beta-personalization-kicker>span');
      const button = create('button',`sv-doc-tab${isBeta?' is-beta-tab':''}`,showBadge ? `${title}<span class="sv-doc-beta-badge">BETA</span>` : title);
      button.type='button'; button.dataset.docStep=String(index); button.setAttribute('role','tab');
      if (isBeta) button.dataset.betaPersonalization = '1';
      nav.appendChild(button);
    });
    top?.insertAdjacentElement('afterend', nav);
    return nav;
  }

  const DOCUMENT_DRAFT_PREFIX = 'surveyor-document-draft-v1';

  function draftUserKey(){
    const auth = window.SurveyorAuth || window.GeoRuralAuth;
    let user = null;
    try { user = auth?.currentUser?.() || null; } catch {}
    const value = String(user?.id || user?.sub || user?.email || 'anonymous').trim().toLowerCase();
    return value.replace(/[^a-z0-9@._-]+/g,'_').slice(0,160) || 'anonymous';
  }

  function documentDraftKey(){
    return `${DOCUMENT_DRAFT_PREFIX}:${draftUserKey()}:${page || 'document'}`;
  }

  function draftControls(left){
    return $$('input,select,textarea', left).filter((control) => {
      if (!control || control.disabled) return false;
      const type = String(control.type || '').toLowerCase();
      if (['file','password','button','submit','reset','hidden'].includes(type)) return false;
      return Boolean(control.id || control.name);
    });
  }

  function controlDraftKey(control, index){
    const id = String(control?.id || '').trim();
    if (id) return `id:${id}`;
    const name = String(control?.name || '').trim();
    if (name) return `name:${name}:${String(control?.value || '')}:${index}`;
    return `control:${index}`;
  }

  function serializeDocumentDraft(left){
    const fields = draftControls(left).map((control,index) => ({
      key: controlDraftKey(control,index),
      id: String(control.id || ''),
      name: String(control.name || ''),
      type: String(control.type || control.tagName || '').toLowerCase(),
      value: String(control.value ?? ''),
      checked: Boolean(control.checked)
    }));
    return {
      schema: 1,
      page,
      userKey: draftUserKey(),
      savedAt: new Date().toISOString(),
      fields
    };
  }

  function readDocumentDraft(){
    try {
      const value = JSON.parse(localStorage.getItem(documentDraftKey()) || 'null');
      return value && value.schema === 1 && Array.isArray(value.fields) ? value : null;
    } catch { return null; }
  }

  function persistDocumentDraft(left){
    const payload = serializeDocumentDraft(left);
    try {
      localStorage.setItem(documentDraftKey(), JSON.stringify(payload));
      return payload;
    } catch { return null; }
  }

  function findDraftControl(left, field){
    if (field?.id) {
      const byId = document.getElementById(field.id);
      if (byId && left.contains(byId)) return byId;
    }
    if (field?.name) {
      const candidates = $$('[name]',left).filter((control) => String(control.name || '') === String(field.name || ''));
      if (candidates.length === 1) return candidates[0];
      const sameValue = candidates.find((control) => String(control.value ?? '') === String(field.value ?? ''));
      if (sameValue) return sameValue;
    }
    return null;
  }

  function applyDraftFields(left, fields, { projectsOnly = false } = {}){
    const projectIds = new Set(['projectSelect','sheetProjectSelect','lotProjectName']);
    (Array.isArray(fields) ? fields : []).forEach((field) => {
      const control = findDraftControl(left, field);
      if (!control) return;
      const isProject = projectIds.has(String(control.id || ''));
      if (projectsOnly !== isProject) return;
      const type = String(control.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') control.checked = Boolean(field.checked);
      else control.value = String(field.value ?? '');
      control.dispatchEvent(new Event('input',{bubbles:true}));
      control.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }

  async function restoreDocumentDraft(left, payload){
    const draft = payload || readDocumentDraft();
    if (!draft) return false;
    // O projeto é restaurado primeiro porque várias telas preenchem os demais
    // campos de forma assíncrona ao disparar o change do seletor.
    applyDraftFields(left,draft.fields,{projectsOnly:true});
    await new Promise((resolve) => setTimeout(resolve,120));
    applyDraftFields(left,draft.fields,{projectsOnly:false});
    return true;
  }

  const SHARED_PROJECT_PROFILE_FIELDS = Object.freeze({
    'memorial.html': {
      memDocumentType:'documentType', memRegistration:'registration', memIncra:'incra', memCnib:'cnib',
      memOwnerName:'ownerName', memOwnerCpf:'ownerCpf', memOwnerRg:'ownerRg', memComarca:'district'
    },
    'mapas.html': { mapTitle:'mapTitle', mapRegistration:'registration', mapTechnician:'technician' },
    'pranchas.html': {
      mapTitle:'mapTitle', mapRegistration:'registration', mapDistrict:'district', mapRegistryOffice:'registryOffice',
      mapIncra:'incra', mapCnib:'cnib', mapTechnician:'technician'
    }
  });

  function sharedProfileValues(project){
    const metadata = project?.metadata && typeof project.metadata === 'object' ? project.metadata : {};
    const profile = metadata.documentProfile && typeof metadata.documentProfile === 'object' ? metadata.documentProfile : {};
    return {
      ...profile,
      ownerName: profile.ownerName || project?.ownerName || project?.owner || '',
      ownerCpf: profile.ownerCpf || metadata.ownerCpf || '',
      ownerRg: profile.ownerRg || metadata.ownerRg || '',
      registration: profile.registration || project?.registrationNumber || metadata.registration || '',
      incra: profile.incra || metadata.incra || metadata.codigoIncra || '',
      cnib: profile.cnib || metadata.cnib || metadata.cib || metadata.numeroCib || '',
      district: profile.district || metadata.comarca || project?.city || project?.municipality || '',
      technician: profile.technician || metadata.technician || '',
      mapTitle: profile.mapTitle || ''
    };
  }

  async function hydrateSharedProjectProfile(left, projectId){
    const id = String(projectId || '').trim();
    const mapping = SHARED_PROJECT_PROFILE_FIELDS[page];
    if (!id || !mapping || !window.GeoRuralProjects?.get) return false;
    const project = await window.GeoRuralProjects.get(id, false).catch(()=>null);
    if (!project) return false;
    const values = sharedProfileValues(project);
    Object.entries(mapping).forEach(([controlId,key]) => {
      const control = document.getElementById(controlId);
      const value = values[key];
      if (!control || value == null || String(value).trim() === '') return;
      if (control.tagName === 'SELECT') {
        const option = Array.from(control.options || []).find((item)=>String(item.value)===String(value) || String(item.textContent||'').trim()===String(value).trim());
        if (option) control.value = option.value;
      } else control.value = String(value);
      control.dispatchEvent(new Event('input',{bubbles:true}));
      control.dispatchEvent(new Event('change',{bubbles:true}));
    });
    return true;
  }

  async function persistSharedProjectProfile(left){
    const mapping = SHARED_PROJECT_PROFILE_FIELDS[page];
    const projectSelect = documentProjectSelect();
    const projectId = String(projectSelect?.value || '').trim();
    if (!mapping || !projectId || !window.GeoRuralProjects?.updateMetadata) return false;
    const documentProfile = {};
    Object.entries(mapping).forEach(([controlId,key]) => {
      const control = document.getElementById(controlId);
      if (!control) return;
      const value = controlValue(control);
      if (value !== '') documentProfile[key] = value;
    });
    if (!Object.keys(documentProfile).length) return false;
    const metadataPatch = { documentProfile };
    if (documentProfile.ownerCpf != null) metadataPatch.ownerCpf = documentProfile.ownerCpf;
    if (documentProfile.ownerRg != null) metadataPatch.ownerRg = documentProfile.ownerRg;
    await window.GeoRuralProjects.updateMetadata(projectId, metadataPatch);
    return true;
  }

  function setupDocumentDrafts(left,tabs,workspace){
    if (!left || !tabs || !workspace) return;
    const actions = create('div','sv-doc-draft-actions');
    const save = create('button','sv-doc-draft-btn','Salvar rascunho');
    const restore = create('button','sv-doc-draft-btn is-restore','Restaurar rascunho');
    const status = create('span','sv-doc-draft-status','');
    const downloadMenu = page === 'pranchas.html' ? makePranchaFooterDownload() : null;
    save.type = 'button';
    restore.type = 'button';
    save.title = 'Salvar rascunho local';
    save.setAttribute('aria-label','Salvar rascunho');
    restore.setAttribute('aria-label','Restaurar rascunho');
    actions.append(save,restore,status);
    const bottomActions = create('div','sv-doc-bottom-actions');
    bottomActions.appendChild(actions);
    if (downloadMenu) bottomActions.appendChild(downloadMenu);
    const dock = create('div','sv-doc-draft-dock');
    dock.appendChild(bottomActions);
    workspace.classList.add('has-draft-dock');
    workspace.appendChild(dock);

    const refresh = (message = '') => {
      const draft = readDocumentDraft();
      const hasSaved = Boolean(draft?.savedAt);
      restore.disabled = !draft;
      restore.title = draft?.savedAt ? `Restaurar rascunho salvo em ${new Date(draft.savedAt).toLocaleString('pt-BR')}` : 'Restaurar rascunho (nenhum disponível nesta tela)';
      save.classList.toggle('is-saved',hasSaved);
      save.innerHTML = hasSaved ? 'Salvar rascunho <span aria-hidden="true">✓</span>' : 'Salvar rascunho';
      // Um pequeno símbolo de edição sobre o disquete distingue rascunho de salvamento real.
      const draftMark = create('span','sv-doc-draft-mark');
      draftMark.setAttribute('aria-hidden','true');
      save.appendChild(draftMark);
      if (message) status.textContent = message;
      else if (draft?.savedAt) status.textContent = `Rascunho ${new Date(draft.savedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
      else status.textContent = '';
    };

    let timer = 0;
    let restoring = false;
    const scheduleAutoSave = () => {
      if (restoring) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const draft = persistDocumentDraft(left);
        refresh(draft ? 'Rascunho salvo' : 'Falha ao salvar');
      },700);
    };

    left.addEventListener('input',scheduleAutoSave);
    left.addEventListener('change',scheduleAutoSave);
    const sharedProjectSelect = documentProjectSelect();
    sharedProjectSelect?.addEventListener('change',()=>{
      if (!sharedProjectSelect.value) return;
      window.setTimeout(()=>hydrateSharedProjectProfile(left,sharedProjectSelect.value).catch((error)=>console.warn('[Surveyor] Não foi possível restaurar os dados compartilhados do projeto:',error)),0);
    });
    if (sharedProjectSelect?.value) window.setTimeout(()=>hydrateSharedProjectProfile(left,sharedProjectSelect.value).catch(()=>{}),120);
    save.addEventListener('click',async() => {
      clearTimeout(timer);
      const draft = persistDocumentDraft(left);
      if (!draft) return refresh('Falha ao salvar');
      save.disabled=true;
      try {
        const shared = await persistSharedProjectProfile(left);
        refresh(shared ? 'Rascunho + projeto salvos' : 'Rascunho salvo');
      } catch (error) {
        console.warn('[Surveyor] Rascunho local salvo, mas os dados do projeto não sincronizaram:',error);
        refresh('Rascunho salvo; projeto pendente');
      } finally { save.disabled=false; }
    });
    restore.addEventListener('click',async() => {
      const draft = readDocumentDraft();
      if (!draft) return refresh('Nenhum rascunho');
      restoring = true;
      restore.disabled = true;
      status.textContent = 'Restaurando…';
      try {
        await restoreDocumentDraft(left,draft);
        status.textContent = 'Rascunho restaurado';
      } finally {
        restoring = false;
        refresh(status.textContent);
      }
    });
    const moveBottomActions = (editorActive) => {
      if (editorActive) {
        const technicalTarget = workspace.querySelector('.sv-confrontante-editor-modal.is-inline-beta [data-editor-footer-left]');
        const memorialActive = Boolean(workspace.querySelector('.memorial-sign-modal.is-inline-personalization [data-memorial-footer-left]'));
        const primaryTarget = workspace.querySelector('.sv-confrontante-editor-modal.is-inline-beta [data-editor-download-slot]');
        const beforeHistory = technicalTarget?.querySelector?.('[data-editor-action="undo"]') || null;
        if (technicalTarget && actions.parentElement !== technicalTarget) {
          if (beforeHistory) technicalTarget.insertBefore(actions, beforeHistory);
          else technicalTarget.appendChild(actions);
        }
        if (primaryTarget && downloadMenu && downloadMenu.parentElement !== primaryTarget) primaryTarget.appendChild(downloadMenu);
        dock.hidden = Boolean(technicalTarget || memorialActive);
      } else {
        if (actions.parentElement !== bottomActions) bottomActions.insertBefore(actions, bottomActions.firstChild || null);
        if (downloadMenu && downloadMenu.parentElement !== bottomActions) bottomActions.appendChild(downloadMenu);
        if (bottomActions.parentElement !== dock) dock.appendChild(bottomActions);
        dock.hidden = false;
      }
    };
    window.addEventListener('surveyor:beta-personalization-mounted',(event)=>{
      if (event.detail?.workspace === workspace) moveBottomActions(true);
    });
    window.addEventListener('surveyor:document-step-change',(event)=>{
      if (event.detail?.workspace === workspace && !event.detail?.betaPersonalization) moveBottomActions(false);
    });
    refresh();
  }

  function setupCompactFooterActions(workspace){
    if (!cfg.compactModel || !workspace) return;
    const dock = workspace.querySelector('.sv-doc-draft-dock');
    const bottom = workspace.querySelector('.sv-doc-bottom-actions');
    if (!dock || !bottom || dock.querySelector('.sv-doc-compact-footer-actions')) return;
    const host = create('div','sv-doc-compact-footer-actions');
    const moved = new Set();
    (cfg.bottomActionSelectors || []).forEach((selector) => {
      const node = $(selector);
      if (!node || moved.has(node) || node.matches?.('.export-hidden')) return;
      moved.add(node);
      node.hidden = false;
      node.removeAttribute('aria-hidden');
      if (node.matches?.('.button-row')) return;
      host.appendChild(node);
    });
    // Mantém somente ações reais; botões auxiliares invisíveis continuam na origem.
    if (!host.children.length) return;
    bottom.appendChild(host);
    dock.dataset.compactActions = '1';
    const move = (editorActive = false) => {
      if (editorActive) {
        const technicalTarget = workspace.querySelector('.sv-confrontante-editor-modal.is-inline-beta .sv-editor-footer-right');
        const memorialTarget = workspace.querySelector('.memorial-sign-modal.is-inline-personalization [data-memorial-footer-right]');
        const target = technicalTarget || memorialTarget;
        if (target && host.parentElement !== target) target.insertBefore(host,target.firstChild || null);
      } else if (host.parentElement !== bottom) bottom.appendChild(host);
    };
    window.addEventListener('surveyor:beta-personalization-mounted',(event)=>{
      if (event.detail?.workspace === workspace) move(true);
    });
    window.addEventListener('surveyor:document-step-change',(event)=>{
      if (event.detail?.workspace === workspace && !event.detail?.betaPersonalization) move(false);
    });
  }


  function setupUnifiedDocumentActions(workspace,left){
    if(!workspace||!left||workspace.dataset.unifiedDocumentActions==='1')return;
    const generate=$(cfg.generate);
    const moduleSave=cfg.saveAction?$(cfg.saveAction):null;
    if(generate){
      generate.hidden=true;
      generate.setAttribute('aria-hidden','true');
      generate.dataset.documentInternalGenerate='1';
    }
    if(moduleSave){
      moduleSave.hidden=true;
      moduleSave.setAttribute('aria-hidden','true');
      moduleSave.dataset.documentInternalSave='1';
    }
    const compactHost=workspace.querySelector('.sv-doc-compact-footer-actions');
    const bottomHost=workspace.querySelector('.sv-doc-bottom-actions');
    const host=compactHost||bottomHost;
    if(!host)return;
    const excluded=new Set([generate,moduleSave].filter(Boolean));
    const postSaveNodes=Array.from(host.children).filter((node)=>{
      if(excluded.has(node))return false;
      if(node.classList?.contains('sv-doc-draft-actions'))return false;
      return true;
    });
    if(!postSaveNodes.length)return;
    const saveButton=create('button','btn primary sv-doc-save-changes','Salvar alterações');
    saveButton.type='button';
    saveButton.title='Salvar alterações no projeto';
    saveButton.setAttribute('aria-label','Salvar alterações no projeto');
    saveButton.hidden=true;
    host.insertBefore(saveButton,postSaveNodes[0]||null);
    const memorialSaveFeedback=page==='memorial.html' ? create('span','sv-memorial-save-feedback','') : null;
    if(memorialSaveFeedback){
      memorialSaveFeedback.setAttribute('role','status');
      memorialSaveFeedback.setAttribute('aria-live','polite');
      memorialSaveFeedback.hidden=true;
      host.insertBefore(memorialSaveFeedback,saveButton);
    }
    const setMemorialSaveFeedback=(message,failed=false)=>{
      if(!memorialSaveFeedback)return;
      memorialSaveFeedback.textContent=message;
      memorialSaveFeedback.dataset.failed=failed?'1':'0';
      memorialSaveFeedback.hidden=!message;
    };
    workspace.dataset.unifiedDocumentActions='1';

    let dirty=false;
    let technicalEditor=null;
    let saving=false;
    const projectControl=documentProjectSelect();
    const currentInlineTechnicalModal=()=>{
      const modal=workspace.querySelector('.sv-confrontante-editor-modal.is-inline-beta');
      return modal&&!modal.hidden?modal:null;
    };
    const sync=()=>{
      const modal=currentInlineTechnicalModal();
      if(modal){
        const editorDirty=modal.dataset.editorDirty==='1';
        saveButton.hidden=true;
        postSaveNodes.forEach((node)=>{node.hidden=editorDirty;});
        return;
      }
      saveButton.hidden=!dirty;
      saveButton.style.pointerEvents=dirty?'auto':'none';
      postSaveNodes.forEach((node)=>{node.hidden=dirty;});
      postSaveNodes.forEach((node)=>{node.style.pointerEvents=dirty?'none':'';if(dirty)node.querySelectorAll?.('details[open]').forEach((details)=>details.removeAttribute('open'));});
    };
    const setDirty=(value=true)=>{
      dirty=value!==false;
      workspace.dataset.documentDirty=dirty?'1':'0';
      sync();
    };
    const isEditableUserChange=(event)=>{
      const target=event?.target;
      if(!event?.isTrusted||!target?.matches?.('input,select,textarea'))return false;
      if(target===projectControl||['projectSelect','sheetProjectSelect'].includes(String(target.id||'')))return false;
      if(target.closest?.('.sv-doc-draft-actions'))return false;
      return true;
    };
    const handleUserChange=(event)=>{
      if(!isEditableUserChange(event))return;
      setDirty(true);
      const modal=currentInlineTechnicalModal();
      if(modal&&technicalEditor?.markDirty) technicalEditor.markDirty(true);
    };
    workspace.addEventListener('input',handleUserChange,true);
    workspace.addEventListener('change',handleUserChange,true);
    projectControl?.addEventListener('change',()=>setDirty(false));

    const waitForTechnicalSave=(modal,timeoutMs=15000)=>new Promise((resolve)=>{
      if(!modal||modal.dataset.editorDirty!=='1')return resolve(true);
      const started=Date.now();
      let finished=false;
      let timer=null;
      const onFailed=(event)=>{if(event.detail?.page&&event.detail.page!==page)return;finish(false);};
      const onSuccess=(event)=>{if(event.detail?.page&&event.detail.page!==page)return;finish(modal.dataset.editorDirty!=='1');};
      const finish=(success)=>{
        if(finished)return;
        finished=true;
        window.clearInterval(timer);
        window.removeEventListener('surveyor:document-save-failed',onFailed);
        window.removeEventListener('surveyor:document-save-success',onSuccess);
        resolve(success);
      };
      window.addEventListener('surveyor:document-save-failed',onFailed);
      window.addEventListener('surveyor:document-save-success',onSuccess);
      timer=window.setInterval(()=>{
        if(!modal.isConnected||modal.dataset.editorDirty!=='1'||Date.now()-started>=timeoutMs)
          finish(modal.dataset.editorDirty!=='1');
      },80);
    });

    saveButton.addEventListener('click',async()=>{
      if(saving)return;
      saving=true;
      const label=saveButton.textContent;
      saveButton.disabled=true;
      saveButton.setAttribute('aria-busy','true');
      saveButton.textContent='Salvando...';
      saveButton.title='Salvando alterações...';
      setMemorialSaveFeedback('Salvando memorial…');
      try{
        let saveVerified = true;
        try{window.dispatchEvent(new CustomEvent('surveyor:document-save-request',{detail:{page,workspace}}));}catch(_error){}
        if(page==='memorial.html'&&window.SurveyorMemorialDocumentActions?.save){
          await window.SurveyorMemorialDocumentActions.save();
        }
        const modal=workspace.querySelector('.sv-confrontante-editor-modal.is-inline-beta');
        if(technicalEditor?.isDirty?.()||modal?.dataset?.editorDirty==='1'){
          const nativeSave=modal?.querySelector?.('[data-editor-action="save"]');
          nativeSave?.click?.();
          if (!nativeSave || !(await waitForTechnicalSave(modal))) {
            saveVerified = false;
            console.warn('[Surveyor] O salvamento do editor técnico não foi confirmado.');
          }
        }
        // Não iniciar outras gravações se o editor técnico falhou.
        if (saveVerified && moduleSave && moduleSave.isConnected) moduleSave.click();
        persistDocumentDraft(left);
        if (saveVerified) {
          try { await persistSharedProjectProfile(left); }
          catch (error) {
            saveVerified = false;
            console.warn('[Surveyor] Os dados compartilhados do projeto não sincronizaram:',error);
          }
        }
        if (saveVerified) {
          setDirty(false);
          setMemorialSaveFeedback('Alterações salvas.');
          try{window.dispatchEvent(new CustomEvent('surveyor:document-save-success',{detail:{page,workspace,source:'workspace'}}));}catch(_error){}
        } else {
          setDirty(true);
          setMemorialSaveFeedback('O salvamento não foi confirmado. Tente novamente.',true);
          try{window.dispatchEvent(new CustomEvent('surveyor:document-save-incomplete',{detail:{page,workspace,source:'workspace'}}));}catch(_error){}
        }
      } catch (error) {
        setDirty(true);
        console.error('[Surveyor] Falha ao salvar alterações documentais:',error);
        setMemorialSaveFeedback(error?.message||'Não foi possível salvar. Tente novamente.',true);
        try{window.dispatchEvent(new CustomEvent('surveyor:document-save-incomplete',{detail:{page,workspace,source:'workspace'}}));}catch(_error){}
      } finally {
        saving=false;
        saveButton.disabled=false;
        saveButton.removeAttribute('aria-busy');
        saveButton.textContent=label||'Salvar alterações';
        saveButton.title='Salvar alterações no projeto';
        sync();
      }
    });

    window.addEventListener('surveyor:document-dirty',(event)=>{
      if(event.detail?.page&&event.detail.page!==page)return;
      setDirty(event.detail?.dirty!==false);
    });
    window.addEventListener('surveyor:document-save-success',(event)=>{
      if(event.detail?.page&&event.detail.page!==page)return;
      persistDocumentDraft(left);
      setDirty(false);
    });
    window.addEventListener('surveyor:technical-editor-opened',(event)=>{
      if(event.detail?.mount!==workspace&&event.detail?.mode==='inline')return;
      technicalEditor=event.detail?.editor||technicalEditor;
      const modal=workspace.querySelector('.sv-confrontante-editor-modal.is-inline-beta');
      if(modal&&!modal.dataset.unifiedDirtyObserved){
        modal.dataset.unifiedDirtyObserved='1';
        new MutationObserver(()=>{
          if(modal.dataset.editorDirty==='1')dirty=true;
          else if(technicalEditor&&!technicalEditor.isDirty?.())dirty=false;
          sync();
        }).observe(modal,{attributes:true,attributeFilter:['data-editor-dirty','hidden']});
      }
      sync();
    });
    window.addEventListener('surveyor:beta-personalization-mounted',(event)=>{if(event.detail?.workspace===workspace)sync();});
    window.addEventListener('surveyor:document-step-change',(event)=>{if(event.detail?.workspace===workspace)sync();});
    sync();
  }

  function hydrateDeferredPersonalizationActions(root){
    root?.querySelectorAll?.('[data-action-selector]').forEach((slot) => {
      const selector = slot.dataset.actionSelector;
      const node = selector ? $(selector) : null;
      if (!node || !slot.parentElement) return;
      slot.replaceWith(node);
    });
  }

  function setupDeferredPersonalizationActions(left){
    [0,140,360,900].forEach((delay) => window.setTimeout(() => hydrateDeferredPersonalizationActions(left), delay));
  }

  function syncInlinePersonalizationVisibility(workspace, betaSelected){
    if (!workspace || betaSelected) return;
    workspace.classList.remove('sv-beta-personalization-active');
    if (page === 'memorial.html') {
      workspace.querySelectorAll('.memorial-sign-modal.is-inline-personalization').forEach((modal)=>{
        modal.hidden = true;
        modal.setAttribute('aria-hidden','true');
      });
    }
    if (['mapas.html','planialtimetria.html','perimetros.html','loteamentos-reurb.html'].includes(page)) {
      workspace.querySelectorAll('.sv-confrontante-editor-modal.is-inline-beta').forEach((modal)=>{
        modal.hidden = true;
        modal.setAttribute('aria-hidden','true');
      });
    }
  }

  function setupSteps(left, tabs, steps, workspace){
    let current = 0;
    const show = (index) => {
      current = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
      const currentSection = steps[current];
      const betaSelected = currentSection?.dataset?.betaPersonalization === '1';
      if (workspace) workspace.dataset.betaPersonalizationSelected = betaSelected ? '1' : '0';
      steps.forEach((section,i) => {
        section.hidden = i !== current;
        let nav = section.querySelector(':scope > .sv-doc-step-nav');
        if (!nav && i < steps.length - 1) { nav = makeNavigation(steps.length,i); section.appendChild(nav); }
        if (!nav && i === steps.length - 1) { nav = makeNavigation(steps.length,i); section.appendChild(nav); }
      });
      $$('.sv-doc-tab',tabs).forEach((button,i) => {
        const active = i === current;
        button.classList.toggle('is-active',active);
        button.setAttribute('aria-selected',active ? 'true' : 'false');
      });
      left.scrollTop = 0;
      syncInlinePersonalizationVisibility(workspace,betaSelected);
      try { window.dispatchEvent(new CustomEvent('surveyor:document-step-change',{detail:{page,index:current,title:currentSection?.querySelector('h2')?.textContent||'',betaPersonalization:betaSelected,workspace}})); } catch (_error) {}
    };
    tabs.addEventListener('click',(event)=>{ const button=event.target.closest('[data-doc-step]'); if(button) show(button.dataset.docStep); });
    left.addEventListener('click',(event)=>{
      const button=event.target.closest('[data-doc-step]'); if(button) return show(button.dataset.docStep);
      if (event.target.closest('[data-beta-personalization-open]')) {
        try { window.dispatchEvent(new CustomEvent('surveyor:open-beta-personalization',{detail:{page,workspace}})); } catch (_error) {}
      }
    });
    show(0);
  }

  function buildWorkspace(main, top){
    const workspace = create('div','sv-doc-workspace');
    const left = create('aside','sv-doc-config-card');
    const right = create('section','sv-doc-preview-card');
    const rightHead = create('header','sv-doc-preview-head');
    const previewTitleId = `svDocPreviewTitle-${page.replace(/[^a-z0-9]+/gi,'-')}`;
    rightHead.innerHTML = `<span class="sv-doc-preview-icon">${iconMarkup()}</span><div class="sv-doc-preview-copy"><h2 id="${previewTitleId}">${cfg.previewTitle}</h2><p>${cfg.previewText}</p></div><div class="sv-doc-preview-actions" hidden></div>`;
    const rightBody = create('div','sv-doc-preview-body');

    workspace.dataset.documentWorkspaceRoot = '1';
    left.dataset.documentConfigPanel = '1';
    right.dataset.documentPreviewPanel = '1';
    rightHead.dataset.documentPreviewHeader = '1';
    rightBody.dataset.documentPreviewBody = '1';
    right.setAttribute('aria-labelledby', previewTitleId);
    rightBody.setAttribute('role','region');
    rightBody.setAttribute('aria-label','Conteúdo da pré-visualização');

    right.append(rightHead,rightBody);
    workspace.append(left,right);

    // Só publica o workspace depois que as etapas foram extraídas, evitando
    // estados intermediários no DOM e mantendo preview/configuração isolados.
    return {workspace,left,right,rightHead,rightBody};
  }

  function normalizedFieldKey(value){
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  }

  function controlLabel(control){
    const label = control?.closest?.('label');
    if (!label) return control?.getAttribute?.('aria-label') || control?.name || control?.id || 'Informação';
    const clone = label.cloneNode(true);
    clone.querySelectorAll('input,select,textarea,button,small,.sv-field-help').forEach((node) => node.remove());
    const text = String(clone.textContent || '').replace(/\s+/g,' ').trim();
    return text || control?.getAttribute?.('aria-label') || control?.name || control?.id || 'Informação';
  }

  function controlValue(control){
    if (!control || control.disabled) return '';
    if (control.matches('input[type="checkbox"],input[type="radio"],input[type="file"],input[type="hidden"]')) return '';
    if (control.tagName === 'SELECT') return String(control.selectedOptions?.[0]?.textContent || control.value || '').trim();
    return String(control.value || '').replace(/\s+/g,' ').trim();
  }

  function deepProjectValue(project, candidates){
    const candidateKeys = new Set((candidates || []).map(normalizedFieldKey));
    const visited = new Set();
    const walk = (value, depth = 0) => {
      if (!value || typeof value !== 'object' || depth > 3 || visited.has(value)) return '';
      visited.add(value);
      for (const [key, item] of Object.entries(value)) {
        if (Array.isArray(item) || (item && typeof item === 'object')) continue;
        if (!candidateKeys.has(normalizedFieldKey(key))) continue;
        const text = String(item ?? '').trim();
        if (text) return text;
      }
      for (const [key, item] of Object.entries(value)) {
        if (Array.isArray(item) || !item || typeof item !== 'object') continue;
        if (!['metadata','dados','property','owner','proprietario','cadastro'].includes(normalizedFieldKey(key))) continue;
        const found = walk(item, depth + 1);
        if (found) return found;
      }
      return '';
    };
    return walk(project, 0);
  }

  function escapeConsentHtml(value){
    return String(value ?? '').replace(/[&<>"']/g,(char)=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function addConsentRow(rows, seen, label, value){
    const cleanLabel = String(label || '').replace(/\s+/g,' ').trim();
    const cleanValue = String(value ?? '').replace(/\s+/g,' ').trim();
    if (!cleanLabel || !cleanValue || /^(selecione|escolha)(\s|$)/i.test(cleanValue)) return;
    const key = normalizedFieldKey(cleanLabel);
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push({ label: cleanLabel, value: cleanValue });
  }

  async function collectGenerationConsentData(){
    const rows = [];
    const seen = new Set();
    addConsentRow(rows, seen, 'Documento', cfg.title);

    const projectSelect = $('#projectSelect') || $('#sheetProjectSelect');
    const projectId = String(projectSelect?.value || '').trim();
    const selectedProjectText = String(projectSelect?.selectedOptions?.[0]?.textContent || '').replace(/\s+/g,' ').trim();
    let project = null;
    if (projectId && window.GeoRuralProjects?.get) {
      try { project = await window.GeoRuralProjects.get(projectId, false); } catch (_error) {}
    }
    const projectName = project?.title || project?.propertyName || project?.name || selectedProjectText;
    addConsentRow(rows, seen, 'Projeto / imóvel', projectName);

    if (project) {
      addConsentRow(rows, seen, 'Proprietário', project.owner || project.ownerName || deepProjectValue(project,['ownerName','owner','proprietario','nomeProprietario','titular']));
      addConsentRow(rows, seen, 'CPF/CNPJ', deepProjectValue(project,['ownerCpf','ownerCpfCnpj','ownerDocument','cpfCnpj','cpf_cnpj','cpf','cnpj','proprietarioCpf','proprietarioCpfCnpj','documentoProprietario']));
      const city = project.city || project.municipality || deepProjectValue(project,['municipality','municipio','city','cidade']);
      const uf = project.uf || project.stateCode || deepProjectValue(project,['uf','stateCode','estado']);
      addConsentRow(rows, seen, 'Município / UF', [city, uf].filter(Boolean).join(' / '));
      addConsentRow(rows, seen, 'Matrícula / referência', project.registrationNumber || deepProjectValue(project,['registrationNumber','matricula','registro','registration']));
    }

    for (const spec of (cfg.sections || [])) {
      for (const selector of (spec.selectors || [])) {
        const control = $(selector);
        if (!control || control === projectSelect) continue;
        const value = controlValue(control);
        if (!value) continue;
        addConsentRow(rows, seen, controlLabel(control), value);
      }
    }

    return rows.slice(0, 18);
  }

  function ensureGenerationConsentDialog(){
    let modal = $('#svGenerationConsent');
    if (modal) return modal;
    modal = create('div','sv-generation-consent');
    modal.id = 'svGenerationConsent';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="sv-generation-consent-card" role="dialog" aria-modal="true" aria-labelledby="svGenerationConsentTitle">
        <header class="sv-generation-consent-head">
          <div><span class="sv-generation-consent-kicker">Confirmação obrigatória</span><h2 id="svGenerationConsentTitle">Confirmar geração</h2></div>
          <button type="button" class="sv-generation-consent-close" data-consent-cancel aria-label="Fechar">×</button>
        </header>
        <div class="sv-generation-consent-body">
          <p class="sv-generation-consent-question"></p>
          <div class="sv-generation-consent-summary" data-consent-summary></div>
          <p class="sv-generation-consent-note">Confira os dados acima antes de gerar. Se precisar corrigir qualquer informação, volte para o formulário.</p>
        </div>
        <footer class="sv-generation-consent-footer">
          <button type="button" class="btn" data-consent-cancel>Voltar e revisar</button>
          <button type="button" class="btn primary" data-consent-confirm disabled>Confirmar geração (5s)</button>
        </footer>
      </section>`;
    document.body.appendChild(modal);
    return modal;
  }

  function openGenerationConsent(generate){
    const modal = ensureGenerationConsentDialog();
    const question = modal.querySelector('.sv-generation-consent-question');
    const summary = modal.querySelector('[data-consent-summary]');
    const confirm = modal.querySelector('[data-consent-confirm]');
    const cancelButtons = Array.from(modal.querySelectorAll('[data-consent-cancel]'));

    question.textContent = `Deseja gerar ${String(cfg.title || 'este documento').toLowerCase()} com os dados abaixo?`;
    summary.innerHTML = '<div class="sv-generation-consent-empty">Conferindo os dados da geração...</div>';
    confirm.disabled = true;
    confirm.textContent = 'Conferindo dados...';
    modal.hidden = false;
    document.body.classList.add('sv-generation-consent-open');

    return new Promise((resolve) => {
      let remaining = GENERATION_CONSENT_SECONDS;
      let timer = 0;
      let fetchTimer = 0;
      let settled = false;
      const cleanup = (confirmed) => {
        if (settled) return;
        settled = true;
        window.clearInterval(timer);
        window.clearTimeout(fetchTimer);
        modal.hidden = true;
        document.body.classList.remove('sv-generation-consent-open');
        document.removeEventListener('keydown', onKeydown, true);
        confirm.removeEventListener('click', onConfirm);
        cancelButtons.forEach((button) => button.removeEventListener('click', onCancel));
        resolve(Boolean(confirmed));
      };
      const onConfirm = () => { if (!confirm.disabled) cleanup(true); };
      const onCancel = () => cleanup(false);
      const onKeydown = (event) => { if (event.key === 'Escape') { event.preventDefault(); cleanup(false); } };
      confirm.addEventListener('click', onConfirm);
      cancelButtons.forEach((button) => button.addEventListener('click', onCancel));
      document.addEventListener('keydown', onKeydown, true);
      cancelButtons.at(-1)?.focus?.({ preventScroll:true });

      void (async () => {
        let rows;
        try {
          rows = await Promise.race([
            collectGenerationConsentData(),
            new Promise((_, reject) => { fetchTimer = window.setTimeout(() => reject(new Error('A conferência dos dados excedeu o tempo limite.')), 12000); })
          ]);
        } catch (error) {
          if (!settled) {
            console.warn('[Surveyor] Conferência do documento indisponível:', error);
            summary.innerHTML = '<div class="sv-generation-consent-empty" role="alert">Não foi possível conferir os dados do projeto. Volte ao formulário, verifique a conexão e tente novamente.</div>';
            confirm.disabled = true;
            confirm.textContent = 'Conferência indisponível';
          }
          return;
        } finally {
          window.clearTimeout(fetchTimer);
        }
        if (settled) return;
        summary.innerHTML = rows.length
          ? rows.map((row) => `<div class="sv-generation-consent-row"><span>${escapeConsentHtml(row.label)}</span><strong>${escapeConsentHtml(row.value)}</strong></div>`).join('')
          : '<div class="sv-generation-consent-empty">Nenhum dado complementar informado.</div>';
        remaining = GENERATION_CONSENT_SECONDS;
        confirm.disabled = true;
        confirm.textContent = `Confirmar geração (${remaining}s)`;
        timer = window.setInterval(() => {
          remaining -= 1;
          if (remaining > 0) {
            confirm.textContent = `Confirmar geração (${remaining}s)`;
            return;
          }
          window.clearInterval(timer);
          confirm.disabled = false;
          confirm.textContent = 'Confirmar e gerar';
        }, 1000);
      })();
    });
  }

  function setupGenerationConsent(){
    if (page === 'pranchas.html') return;
    const generate = $(cfg.generate);
    if (!generate || generate.dataset.generationConsentBound === '1') return;
    generate.dataset.generationConsentBound = '1';
    let opening = false;
    generate.addEventListener('click', async (event) => {
      if (generate.dataset.generationConsentBypass === '1') {
        delete generate.dataset.generationConsentBypass;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (opening || generate.disabled) return;
      opening = true;
      try {
        const confirmed = await openGenerationConsent(generate);
        if (!confirmed || !generate.isConnected || generate.disabled) return;
        generate.dataset.generationConsentBypass = '1';
        generate.click();
      } finally {
        opening = false;
      }
    }, true);
  }

  function setupPreviewDownloadAction(rightHead){
    const actions = rightHead?.querySelector?.('.sv-doc-preview-actions');
    if (page === 'pranchas.html' || cfg.compactModel) return { setReady: () => {} };
    if (!actions || !previewDownloadPages.has(page)) return { setReady: () => {} };
    const menu = $('.sv-doc-final-step .export-menu') || $('.export-menu');
    if (!menu || menu.contains($(cfg.generate))) return { setReady: () => {} };
    menu.classList.add('sv-doc-preview-download');
    actions.appendChild(menu);
    actions.hidden = true;
    const setReady = (ready) => {
      actions.hidden = !ready;
      actions.setAttribute('aria-hidden', ready ? 'false' : 'true');
      if (!ready && menu.matches('details[open]')) menu.removeAttribute('open');
    };
    const configCard = $('.sv-doc-config-card');
    const invalidate = (event) => {
      const target = event?.target;
      if (!target || target === $(cfg.generate) || target.closest?.('.sv-doc-final-actions')) return;
      if (target.matches?.('input,select,textarea')) setReady(false);
    };
    configCard?.addEventListener('input', invalidate);
    configCard?.addEventListener('change', invalidate);
    setReady(false);
    return { setReady };
  }

  function previewPlaceholderMarkup(){
    const title = page === 'planialtimetria.html'
      ? 'Selecione um projeto para visualizar a planta planialtimétrica.'
      : (page === 'memorial.html'
        ? 'Selecione um projeto para visualizar o memorial.'
        : (page === 'mapas.html'
          ? 'Selecione um projeto para visualizar o croqui.'
          : (page === 'perimetros.html'
            ? 'Selecione um projeto para visualizar a planta técnica do perímetro.'
            : (page === 'loteamentos-reurb.html'
              ? 'Selecione um projeto para visualizar a planta técnica.'
              : (page === 'ambiental.html'
                ? 'Selecione um projeto para visualizar o relatório.'
                : 'Selecione um projeto para visualizar o documento.')))));
    return '<div class="sv-prancha-inline-preparing-preview sv-doc-canonical-empty-preview">'
      + '<div class="sv-prancha-inline-empty-sheet" aria-hidden="true"></div>'
      + '<p class="sv-prancha-inline-empty-message">'+title+'</p>'
      + '</div>';
  }

  function ensurePreviewPlaceholder(rightBody){
    const preview = $(cfg.preview);
    if (!preview) return;
    const text = String(preview.textContent || '').replace(/\s+/g,' ').trim();
    const hasVisualContent = Boolean(preview.querySelector('iframe,embed,object,svg,canvas,img,.surveyor-pdf-preview-shell,.memorial-pdf-preview-shell,.memorial-profissional,.preview-sheet,.azimuth-sheet,.planialt-document-preview,table,article'));
    if (!hasVisualContent && (!preview.children.length || /selecione|preencha|clique|aguardando/i.test(text))) {
      preview.innerHTML = previewPlaceholderMarkup();
      preview.hidden = false;
    }
    if (rightBody && preview.parentElement !== rightBody && !rightBody.contains(preview)) rightBody.appendChild(preview);
  }

  function setupEmptyProjectPreview(){
    const preview = $(cfg.preview);
    const select = $('#projectSelect') || $('#sheetProjectSelect');
    if (!preview || !select) return;
    let syncing = false;
    const sync = () => {
      if (syncing || select.value) return;
      if (preview.querySelector('.sv-doc-canonical-empty-preview')) return;
      syncing = true;
      try {
        window.SurveyorPdfPreview?.reset?.(preview);
        preview.classList.remove('surveyor-pdf-preview-host','is-live-svg-preview');
        preview.innerHTML = previewPlaceholderMarkup();
        preview.hidden = false;
      } finally {
        syncing = false;
      }
    };
    select.addEventListener('change',()=>{
      if (!select.value) window.setTimeout(sync,0);
    });
    new MutationObserver(()=>{
      if (!select.value) window.requestAnimationFrame(sync);
    }).observe(preview,{childList:true,subtree:true,characterData:true});
    [0,80,250].forEach((delay)=>window.setTimeout(sync,delay));
  }

  function ensureGenerationOverlay(){
    let overlay = $('#svDocLoaderOverlay');
    if (overlay) return overlay;
    overlay = create('div','sv-doc-loader-overlay');
    overlay.id = 'svDocLoaderOverlay';
    overlay.innerHTML = '<div class="sv-doc-loader-spinner" aria-label="Processando"></div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function showGenerationOverlay(){
    if (cfg.compactModel) {
      const workspace=$('.sv-doc-workspace');
      if (workspace) { showWorkspacePreviewLoader(workspace,'Atualizando documento…'); return; }
    }
    ensureGenerationOverlay().classList.add('is-visible');
  }

  function hideGenerationOverlay(){
    hideWorkspacePreviewLoader($('.sv-doc-workspace'));
    $('#svDocLoaderOverlay')?.classList.remove('is-visible');
  }

  function generatedContent(){
    const preview = $(cfg.preview);
    if (!preview) return false;
    if (preview.querySelector('iframe,embed,object,svg,canvas,img,.surveyor-pdf-preview-shell,.memorial-pdf-preview-shell,.memorial-profissional,.preview-sheet,.azimuth-sheet,.planialt-document-preview,table,article')) return true;
    const text = String(preview.textContent || '').replace(/\s+/g,' ').trim();
    return text.length > 80 && !/selecione|clique em|aguardando|preencha/i.test(text);
  }

  function generationErrorText(){
    const preview = $(cfg.preview);
    const text = String(preview?.textContent || '').replace(/\s+/g,' ').trim();
    return /não foi possível|falha ao gerar|erro ao gerar|indisponível|tempo limite excedido/i.test(text) ? text : '';
  }

  function setupGenerationWatcher(downloadAction){
    if (page === 'pranchas.html') { hideGenerationOverlay(); downloadAction?.setReady?.(true); return; }
    const generate = $(cfg.generate);
    const preview = $(cfg.preview);
    let timer = 0;
    let started = false;
    const finishGeneration = () => { started = false; clearTimeout(timer); hideGenerationOverlay(); downloadAction?.setReady?.(!generationErrorText() && generatedContent()); };
    if (generate) {
      generate.addEventListener('click',() => {
        started = true;
        downloadAction?.setReady?.(false);
        showGenerationOverlay();
        clearTimeout(timer);
        timer = window.setTimeout(() => finishGeneration(),45000);
      },true);
      new MutationObserver(() => {
        if (!started) return;
        const busy = generate.getAttribute('aria-busy') === 'true';
        if (!busy && !generate.disabled) window.setTimeout(() => {
          if (generationErrorText() || generatedContent() || generate.getAttribute('aria-busy') !== 'true') finishGeneration();
        },80);
      }).observe(generate,{attributes:true,attributeFilter:['aria-busy','disabled']});
    }
    if (preview) new MutationObserver(() => {
      if (generationErrorText() || generatedContent()) finishGeneration();
    }).observe(preview,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['src','class','hidden']});
    window.addEventListener('surveyor:document-generation-finished',(event)=>{
      if (!event?.detail?.page || event.detail.page === page) finishGeneration();
    });
  }


  function documentProjectSelect(){
    return $('#projectSelect') || $('#sheetProjectSelect');
  }

  function ensureWorkspacePreviewLoader(workspace){
    if (!workspace) return null;
    let overlay = document.getElementById(`svDocumentLiveLoader-${page.replace(/[^a-z0-9]+/gi,'-')}`);
    if (overlay) return overlay;
    overlay = create('div','sv-doc-live-loader');
    overlay.id = `svDocumentLiveLoader-${page.replace(/[^a-z0-9]+/gi,'-')}`;
    overlay.hidden = true;
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-label','Carregando documento');
    overlay.innerHTML = '<span class="sv-document-app-loader-spinner" aria-hidden="true"></span>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function showWorkspacePreviewLoader(workspace, _message = 'Preparando pré-visualização…'){
    const overlay = ensureWorkspacePreviewLoader(workspace);
    if (!overlay) return;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden','false');
  }

  function hideWorkspacePreviewLoader(workspace){
    const overlay = document.getElementById(`svDocumentLiveLoader-${page.replace(/[^a-z0-9]+/gi,'-')}`) || workspace?.querySelector?.('.sv-doc-live-loader');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden','true');
  }

  function setupProjectLivePreview(workspace){
    if (!cfg.autoPreviewOnProject || !workspace) return;
    // Memorial, Mapas/Croquis e Pranchas possuem renderizadores vivos próprios.
    // O watcher genérico disparava mudanças repetidas no projeto e exibia um loader
    // concorrente, criando corrida entre resumo e geometria completa do mesmo projeto.
    if (['mapas.html','pranchas.html','memorial.html'].includes(page)) return;
    const select = documentProjectSelect();
    const preview = $(cfg.preview);
    if (!select || !preview) return;
    let token = 0;
    let timer = 0;
    const waitUntilReady = (localToken) => {
      clearTimeout(timer);
      const started = Date.now();
      const check = () => {
        if (localToken !== token) return;
        if (!select.value) { hideWorkspacePreviewLoader(workspace); return; }
        if (generationErrorText() || generatedContent()) { hideWorkspacePreviewLoader(workspace); return; }
        if (Date.now() - started > 45000) { hideWorkspacePreviewLoader(workspace); return; }
        timer = window.setTimeout(check,90);
      };
      check();
    };
    const onProjectChange = () => {
      token += 1;
      clearTimeout(timer);
      if (!select.value) { hideWorkspacePreviewLoader(workspace); return; }
      showWorkspacePreviewLoader(workspace,'Preparando documento…');
      waitUntilReady(token);
    };
    select.addEventListener('change',onProjectChange);
    new MutationObserver(() => {
      if (select.value && (generationErrorText() || generatedContent())) hideWorkspacePreviewLoader(workspace);
    }).observe(preview,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['src','class','hidden','aria-busy']});
    window.addEventListener('surveyor:document-generation-finished',(event)=>{
      if (!event?.detail?.page || event.detail.page === page) hideWorkspacePreviewLoader(workspace);
    });
    if (select.value && !generatedContent()) onProjectChange();
    [320,720,1400].forEach((delay)=>window.setTimeout(()=>{
      if (!select.value || generatedContent()) return;
      select.dispatchEvent(new Event('change',{bubbles:true}));
    },delay));
  }

  function setupLiveFieldPreview(workspace){
    if (!cfg.liveFieldPreview || !workspace) return;
    if (['mapas.html','pranchas.html','memorial.html'].includes(page)) return;
    const left = workspace.querySelector('.sv-doc-config-card');
    const generate = $(cfg.generate);
    if (!left || !generate) return;
    let timer = 0;
    let running = false;
    const request = () => {
      const project = documentProjectSelect();
      if (project && !project.value) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (running || generate.disabled) return;
        running = true;
        if (cfg.autoPreviewOnProject) showWorkspacePreviewLoader(workspace,'Atualizando pré-visualização…');
        generate.dataset.generationConsentBypass = '1';
        generate.dataset.liveAutoPreview = '1';
        generate.click();
        window.setTimeout(()=>{running=false;},700);
      },520);
    };
    left.addEventListener('input',(event)=>{ if (event.target?.matches?.('input,textarea,select')) request(); });
    left.addEventListener('change',(event)=>{ if (event.target?.matches?.('input,textarea,select')) request(); });
  }

  function normalizeExportMenus(workspace){
    if (!workspace) return;
    const closeAll = (except = null) => {
      workspace.querySelectorAll('.export-menu.is-open').forEach((menu)=>{ if(menu!==except) menu.classList.remove('is-open'); });
    };
    workspace.querySelectorAll('.export-menu').forEach((menu)=>{
      if (menu.dataset.svExportBound === '1') return;
      menu.dataset.svExportBound = '1';
      const trigger = menu.querySelector(':scope > .btn, :scope > button');
      const list = menu.querySelector(':scope > .export-menu-list');
      if (!trigger || !list) return;
      trigger.type = 'button';
      // Mesmo com texto oculto no modo de ícones, o comando continua
      // identificado por mouse, teclado e leitores de tela.
      if (document.body.classList.contains('sv-document-icon-mode')
        && menu.closest('.sv-doc-compact-footer-actions, .sv-doc-draft-dock')) {
        trigger.title = 'Baixar documento';
        trigger.setAttribute('aria-label','Baixar documento');
      }
      trigger.setAttribute('aria-haspopup','menu');
      trigger.setAttribute('aria-expanded','false');
      trigger.addEventListener('click',(event)=>{
        event.preventDefault(); event.stopPropagation();
        const open = !menu.classList.contains('is-open');
        closeAll(menu);
        menu.classList.toggle('is-open',open);
        trigger.setAttribute('aria-expanded',open?'true':'false');
      });
      list.querySelectorAll('[data-click-target]').forEach((item)=>{
        item.type = 'button';
        item.addEventListener('click',(event)=>{
          event.preventDefault(); event.stopPropagation();
          const target = document.getElementById(item.dataset.clickTarget || '');
          menu.classList.remove('is-open');
          trigger.setAttribute('aria-expanded','false');
          target?.click?.();
        });
      });
      list.querySelectorAll('button:not([data-click-target])').forEach((item)=>{
        item.addEventListener('click',()=>{
          window.setTimeout(()=>{
            menu.classList.remove('is-open');
            trigger.setAttribute('aria-expanded','false');
          },0);
        });
      });
    });
    document.addEventListener('pointerdown',(event)=>{ if(!event.target?.closest?.('.export-menu')) closeAll(); },true);
    document.addEventListener('keydown',(event)=>{ if(event.key==='Escape') closeAll(); });
  }

  function fitWorkspace(workspace){
    if (!workspace) return;
    let raf = 0;
    const sync = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!workspace.isConnected || window.innerWidth <= 900) {
          workspace.style.removeProperty('height');
          workspace.style.removeProperty('max-height');
          return;
        }
        const top = workspace.getBoundingClientRect().top;
        const height = Math.max(360, Math.floor(window.innerHeight - top - 10));
        workspace.style.setProperty('height', `${height}px`);
        workspace.style.setProperty('max-height', `${height}px`);
      });
    };
    window.addEventListener('resize',sync,{passive:true});
    [0,80,240,600].forEach((delay) => window.setTimeout(sync,delay));
  }

  function boot(){
    const main = $('.main');
    if (!main || document.body.dataset.documentWorkspace === 'official-v3') return;
    document.body.dataset.documentWorkspace = 'official-v3';
    document.documentElement.classList.add('sv-document-workspace-root');
    document.body.classList.add('sv-document-workspace-page');
    if (cfg.compactModel) document.body.classList.add('sv-document-compact-model');
    if ((cfg.sections || []).some((section) => section.betaPersonalization)) document.body.classList.add('sv-document-inline-personalization');
    ensureMapOptions();
    const top = ensurePageHeader(main);
    const parts = buildWorkspace(main,top);
    let steps = [];
    if (cfg.special === 'ods') steps = extractOds(main,parts.left,parts.rightBody);
    else if (cfg.special === 'loteamento') steps = extractLoteamento(main,parts.left,parts.rightBody);
    else steps = extractGeneric(main,parts.left,parts.rightBody);
    if (!steps.length) return;
    const tabs = buildTabs(main,top,steps);
    // O workspace deve vir depois das abas, como no layout oficial.
    tabs.insertAdjacentElement('afterend',parts.workspace);
    setupSteps(parts.left,tabs,steps,parts.workspace);
    setupDeferredPersonalizationActions(parts.left);
    setupDocumentDrafts(parts.left,tabs,parts.workspace);
    setupCompactFooterActions(parts.workspace);
    setupUnifiedDocumentActions(parts.workspace,parts.left);
    ensurePreviewPlaceholder(parts.rightBody);
    setupEmptyProjectPreview();
    const previewDownloadAction = setupPreviewDownloadAction(parts.rightHead);
    setupGenerationConsent();
    setupGenerationWatcher(previewDownloadAction);
    setupProjectLivePreview(parts.workspace);
    setupLiveFieldPreview(parts.workspace);
    normalizeExportMenus(parts.workspace);
    previewDownloadAction.setReady(generatedContent());
    fitWorkspace(parts.workspace);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
