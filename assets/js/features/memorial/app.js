(() => {
  'use strict';
  window.SurveyorDedicatedMemorialGenerator = true;
  const auth = window.SurveyorAuth || window.GeoRuralAuth;
  const $ = (id) => document.getElementById(id);
  const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num = (v, d = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const slug = (v) => String(v || 'documento').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase() || 'documento';
  let lastMemorialHtml = '';
  let lastMapSvg = '';
  let lastMapPng = '';
  let lastMapRenderKey = '';
  let lastMapCoords = [];
  let currentMemorialTemplateId = 'standard';
  let lastTemplateData = null;
  let loadedCustomization = null;
  let lastWordHtml = '';
  let lastPdfHtml = '';
  let lastText = '';
  let lastGeneratedTemplateId = 'standard';
  let lastPdfBlob = null;
  let lastPdfBlobUrl = '';
  let pdfGenerationSerial = 0;
  let lastRenderedPdfPages = [];
  // A rasterização A4 só é refeita quando o conteúdo daquela página muda.
  let memorialPdfPageCache = [];
  let memorialPdfDocumentReady = false;
  let memorialPendingEdits = true;
  let memorialLiveRegenerationTimer = 0;
  // Cache descartável da DOM de prévia: não modifica os dados nem o documento exportado.
  const memorialPreviewHostCache = new WeakMap();
  let memorialParsedPagesSource = '';
  let memorialParsedPages = [];
  let memorialGenerationSerial = 0;
  let memorialModelLoadingToken = 0;
  let memorialPreviewZoom = 1;
  const memorialEditSettings = { fontScale: 1, includeSignature: false, importedSignatureEnabled: false, signaturePageIndex: 0, signatureX: 50, signatureY: 58, signatureWidth: 28 };
  const memorialSigner = { pages: [], signatureDataUrl: '', importedSignatureAsset: null, activeSignatureMode:'account', pageIndex: 0, x: 50, y: 58, width: 28, dragging: false, resizing: false, pointerStart: null };
  const MEMORIAL_SIGNATURE_DB='surveyor-document-assets-v1';
  const MEMORIAL_SIGNATURE_STORE='imported-signatures';
  let memorialSignatureDbPromise=null;
  function memorialEditStorageKey(){ return `surveyor:memorial-edit:v1:${String($('projectSelect')?.value || 'sem-projeto')}`; }
  function memorialImportedSignatureKey(){ return `surveyor:document-imported-signature:v1:${String($('projectSelect')?.value || 'sem-projeto')}`; }
  function loadMemorialEditSettings(){ try{ const value=JSON.parse(localStorage.getItem(memorialEditStorageKey())||'{}'); memorialEditSettings.fontScale=1; memorialEditSettings.includeSignature=value.includeSignature===true; memorialEditSettings.importedSignatureEnabled=value.importedSignatureEnabled===true; memorialEditSettings.signaturePageIndex=Math.max(0,Math.round(Number(value.signaturePageIndex||0)||0)); memorialEditSettings.signatureX=Math.max(0,Math.min(100,Number(value.signatureX??50)||50)); memorialEditSettings.signatureY=Math.max(0,Math.min(100,Number(value.signatureY??58)||58)); memorialEditSettings.signatureWidth=Math.max(10,Math.min(55,Number(value.signatureWidth??28)||28)); }catch{} return memorialEditSettings; }
  function normalizeMemorialImportedSignature(value){ if(!value||typeof value!=='object'||!String(value.dataUrl||'').startsWith('data:image/'))return null;return {name:String(value.name||'Assinatura importada'),dataUrl:String(value.dataUrl),width:Math.max(1,Number(value.width)||1),height:Math.max(1,Number(value.height)||1),updatedAt:String(value.updatedAt||'')}; }
  function openMemorialSignatureDb(){ if(memorialSignatureDbPromise)return memorialSignatureDbPromise;if(!globalThis.indexedDB)return Promise.resolve(null);memorialSignatureDbPromise=new Promise((resolve)=>{let request;try{request=indexedDB.open(MEMORIAL_SIGNATURE_DB,1);}catch(_error){resolve(null);return;}request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(MEMORIAL_SIGNATURE_STORE))db.createObjectStore(MEMORIAL_SIGNATURE_STORE);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);});return memorialSignatureDbPromise; }
  async function readMemorialImportedSignature(){ const key=memorialImportedSignatureKey(),db=await openMemorialSignatureDb();if(!db)return null;try{return normalizeMemorialImportedSignature(await new Promise((resolve,reject)=>{const tx=db.transaction(MEMORIAL_SIGNATURE_STORE,'readonly'),request=tx.objectStore(MEMORIAL_SIGNATURE_STORE).get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);}));}catch(_error){return null;} }
  async function writeMemorialImportedSignature(value){ const key=memorialImportedSignatureKey(),db=await openMemorialSignatureDb();if(!db)return false;const normalized=value?normalizeMemorialImportedSignature(value):null;try{await new Promise((resolve,reject)=>{const tx=db.transaction(MEMORIAL_SIGNATURE_STORE,'readwrite'),store=tx.objectStore(MEMORIAL_SIGNATURE_STORE);if(normalized)store.put(normalized,key);else store.delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return true;}catch(_error){return false;} }
  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('Falha ao ler a assinatura.'));reader.readAsDataURL(file);});}
  function imageDimensions(dataUrl){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth||1,height:image.naturalHeight||1});image.onerror=()=>reject(new Error('Imagem de assinatura inválida.'));image.src=dataUrl;});}
  function saveMemorialEditSettings(){ try{ localStorage.setItem(memorialEditStorageKey(),JSON.stringify(memorialEditSettings)); }catch{} }
  function notifyMemorialDirty(){ try{window.dispatchEvent(new CustomEvent('surveyor:document-dirty',{detail:{page:'memorial.html',dirty:true,source:'memorial'}}));}catch(_error){} }
  function runningMemorialDescriptionCss(){
    return `.memorial-running-text{margin:0;text-align:justify;text-align-last:left;text-justify:inter-word;white-space:normal;word-break:normal;overflow-wrap:normal;letter-spacing:normal;word-spacing:normal}.standard-memorial-page-first .memorial-running-text,.agro-first .memorial-running-text,.memorial-word-template .memorial-running-text{text-indent:38mm}.standard-memorial-page-continuation .memorial-running-text,.agro-continuation .memorial-running-text{text-indent:0}`;
  }
  function memorialFontOverrideCss(){ const s=memorialEditSettings.fontScale; return `.standard-template-description .memorial-running-text,.agro-description .memorial-running-text{font-size:${(8.8*s).toFixed(2)}pt}.custom-template-description .memorial-paragraph,.custom-template-closing{font-size:${(8.45*s).toFixed(2)}pt}.custom-docx-description,.custom-docx-description .memorial-paragraph,.custom-docx-closing{font-size:${(8.2*s).toFixed(2)}pt}`; }
  function effectiveMemorialTheme(theme={}){ return { ...theme, signatureDataUrl: memorialEditSettings.includeSignature ? String(theme.signatureDataUrl||theme.planDocumentSignatureDataUrl||window.GeoRuralDocumentTheme?.getSignature?.()||'') : '' }; }
  function memorialMapIncluded(memorialOptions={}){
    const control=$('memIncludeMap');
    if(control) return String(control.value??'1') !== '0';
    return memorialOptions?.showMap !== false;
  }
  function preferenceApi(){ return window.SurveyorMemorialPreference; }
  function validTemplateId(id) {
    const api=window.SurveyorMemorialTemplates;
    if(!api?.items?.some((item)=>item.id===id)) return false;
    return api?.canUse ? api.canUse(id,loadedCustomization||{}) : (preferenceApi()?.valid?.(id) ?? true);
  }
  function readLocalTemplatePreference() {
    return preferenceApi()?.read?.() || {id:'',updatedAt:'',explicit:false,source:''};
  }
  function writeLocalTemplatePreference(id,updatedAt=new Date().toISOString()) {
    if (!validTemplateId(id)) return;
    preferenceApi()?.write?.(id,{updatedAt,explicit:true,source:'memorial'});
  }
  async function resolveSavedMemorialTemplate({ forceRemote = false } = {}) {
    let remoteCustomization = {};
    if(auth?.getDocumentCustomization){
      try {
        loadedCustomization = await auth.getDocumentCustomization({ forceRefresh: forceRemote, noCache: forceRemote });
        remoteCustomization = loadedCustomization || {};
      } catch (error) {
        console.warn('[Memorial] Não foi possível atualizar a preferência do modelo:', error);
      }
    }
    const resolved = preferenceApi()?.resolve?.(remoteCustomization) || {id:'standard',source:'default'};
    if(validTemplateId(resolved.id)){
      preferenceApi()?.write?.(resolved.id,{updatedAt:resolved.updatedAt||new Date().toISOString(),explicit:true,source:resolved.source||'resolved'});
      return resolved.id;
    }
    return 'standard';
  }


  function updateTemplateStatus(id=currentMemorialTemplateId, source='') {
    const el=$('memorialTemplateStatus');
    if(!el) return;
    const item=window.SurveyorMemorialTemplates?.byId?.(id);
    el.textContent=`Modelo ativo: ${item?.name || id || 'Modelo padrão do sistema'}${source ? ` — ${source}` : ''}`;
    el.dataset.templateId=id||'standard';
  }

  function templateExists(id){
    const value=String(id||'').trim();
    return Boolean(value && window.SurveyorMemorialTemplates?.items?.some((item)=>item.id===value));
  }

  function selectedTemplateIdFromUi(){
    const select=$('memorialTemplateSelect');
    const value=String(select?.value||'').trim();
    if(!value || !templateExists(value)) return 'standard';
    const optionExists=Array.from(select?.options||[]).some((option)=>String(option.value)===value);
    return optionExists ? value : 'standard';
  }

  async function ensureSelectedTemplateAuthorized(id){
    if(id==='standard') return true;
    if(validTemplateId(id)) return true;
    if(auth?.getDocumentCustomization){
      try{
        loadedCustomization=await auth.getDocumentCustomization({forceRefresh:true,noCache:true})||loadedCustomization||{};
      }catch(error){
        console.warn('[Memorial] Não foi possível atualizar a autorização do modelo selecionado:',error);
      }
    }
    return validTemplateId(id);
  }

  function toast(msg, type='success') {
    const el = $('suiteToast');
    if (!el) return alert(msg);
    el.textContent = msg; el.className = `toast ${type} show`;
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 3600);
  }

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    try { anchor.click(); }
    finally {
      anchor.remove();
      // O navegador pode iniciar o download de forma assíncrona, sobretudo para PDFs grandes.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  function withTimeout(promise, timeoutMs, message = 'A operação excedeu o tempo limite.') {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), Math.max(1000, Number(timeoutMs || 0))))
    ]);
  }

  async function boundedStep(label, task, timeoutMs, fallbackValue) {
    try {
      return await withTimeout(typeof task === 'function' ? task() : task, timeoutMs, `${label} excedeu o tempo limite.`);
    } catch (error) {
      console.warn(`[Memorial] ${label}:`, error);
      if (arguments.length >= 4) return fallbackValue;
      throw error;
    }
  }

  async function loadGenerationCustomization() {
    const themeSnapshot = window.GeoRuralDocumentTheme?.get?.() || {};
    const cached = { ...(loadedCustomization || {}), ...themeSnapshot };
    if (loadedCustomization?.options || themeSnapshot?.options) cached.options = { ...(loadedCustomization?.options || {}), ...(themeSnapshot?.options || {}) };

    let fresh = cached;
    if (window.SurveyorDocumentAssets?.loadCustomization) {
      fresh = await boundedStep('Leitura da personalização', () => window.SurveyorDocumentAssets.loadCustomization({ forceRefresh:false, maxAgeMs:60_000 }), 6500, cached) || cached;
    } else if (auth?.getDocumentCustomization) {
      fresh = await boundedStep('Leitura da personalização', () => auth.getDocumentCustomization({ forceRefresh:false, noCache:false }), 6500, cached) || cached;
    }

    const merged = { ...cached, ...(fresh || {}) };
    if (cached?.options || fresh?.options) merged.options = { ...(cached?.options || {}), ...(fresh?.options || {}) };

    if (!String(merged.logoDataUrl || '').trim() && window.SurveyorDocumentAssets?.resolveLogo) {
      const embedded = await boundedStep('Carregamento do logotipo', () => window.SurveyorDocumentAssets.resolveLogo(merged, { timeoutMs:3500 }), 4500, '');
      if (embedded) merged.logoDataUrl = embedded;
    }
    loadedCustomization = merged;
    return merged;
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((script) => script.src === src)) return resolve();
      const script = document.createElement('script');
      const timer = setTimeout(() => reject(new Error(`Tempo limite ao carregar ${src}`)), 15000);
      script.src = src;
      script.async = true;
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(new Error(`Não foi possível carregar ${src}`)); };
      document.head.appendChild(script);
    });
  }

  function revokePdfPreviewUrl() {
    const readyLink = document.getElementById('memorialReadyPdfDownload');
    readyLink?.removeAttribute('href');
    if (readyLink) readyLink.hidden = true;
    if (lastPdfBlobUrl) {
      try { URL.revokeObjectURL(lastPdfBlobUrl); } catch {}
      lastPdfBlobUrl = '';
    }
    lastPdfBlob = null;
  }

  function showMemorialPreview() {
    const output = $('memorialOutput');
    if (!output) return null;
    output.hidden = false;
    output.removeAttribute('aria-hidden');
    return output;
  }

  function hideMemorialPreview({ clear = false } = {}) {
    const output = $('memorialOutput');
    if (!output) return;
    output.hidden = true;
    output.setAttribute('aria-hidden', 'true');
    if (clear) output.replaceChildren();
  }

  function resetGeneratedMemorial() {
    memorialGenerationSerial += 1;
    pdfGenerationSerial += 1;
    revokePdfPreviewUrl();
    lastMemorialHtml = '';
    lastMapSvg = '';
    lastMapPng = '';
    lastMapRenderKey = '';
    lastWordHtml = '';
    lastPdfHtml = '';
    lastText = '';
    lastTemplateData = null;
    lastRenderedPdfPages = [];
    memorialPdfPageCache = [];
    memorialPdfDocumentReady = false;
    memorialPendingEdits = true;
    closeMemorialSigner();
    hideMemorialPreview({ clear: true });
  }

  function waitForImages(root) {
    return Promise.all(Array.from(root?.querySelectorAll?.('img') || []).map((img) => {
      // Uma imagem que já falhou também tem complete=true. Esperar novamente
      // pelo evento load/error faz o PDF perder oito segundos desnecessários.
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 8000);
      });
    }));
  }

  async function ensurePdfLibraries() {
    if (!window.html2canvas) {
      await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    if (!window.jspdf?.jsPDF) {
      await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      throw new Error('Não foi possível carregar o gerador de PDF.');
    }
  }

  function previewLoading() {
    const output = showMemorialPreview();
    if (!output) return;
    output.replaceChildren();
    output.setAttribute('aria-busy', 'true');
  }

  function previewError(error) {
    const output = showMemorialPreview();
    if (!output) return;
    output.removeAttribute('aria-busy');
    output.innerHTML = `<div class="memorial-pdf-preview-error"><div><strong>Não foi possível montar a pré-visualização em PDF.</strong><br><small>${escape(error?.message || error || 'Erro desconhecido')}</small></div></div>`;
  }


  function setMemorialBusy(isBusy) {
    const button = $('generateMemorial');
    if (!button) return;
    button.disabled = Boolean(isBusy);
    if (isBusy) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
  }

  // Uma única geometria A4 para a assinatura na prévia responsiva e no PDF.
  // x/y guardam o CENTRO na folha, em percentual; o PDF converte para milímetros.
  function memorialSignaturePlacement(ratio=0.25,offsetMm=0){
    const widthMm=210*(Math.max(10,Math.min(55,Number(memorialEditSettings.signatureWidth??28)||28))/100);
    const heightMm=widthMm*Math.max(0.05,Number(ratio)||0.25);
    const centerX=Math.max(0,Math.min(100,Number(memorialEditSettings.signatureX??50)||50));
    const centerY=Math.max(0,Math.min(100,Number(memorialEditSettings.signatureY??58)||58));
    const xMm=Math.max(0,Math.min(210-widthMm,210*centerX/100-widthMm/2));
    const yMm=Math.max(0,Math.min(297-heightMm,297*centerY/100-heightMm/2+offsetMm));
    return {xMm,yMm,widthMm,heightMm,leftPct:xMm/210*100,topPct:yMm/297*100,widthPct:widthMm/210*100,heightPct:heightMm/297*100};
  }

  async function buildMemorialPdfBlob() {
    if (!lastPdfHtml && !lastMemorialHtml) throw new Error('Gere o memorial primeiro.');
    await ensurePdfLibraries();
    const JsPdf = window.jspdf.jsPDF;
    const host = document.createElement('div');
    host.className = 'memorial-pdf-render-host';
    host.style.cssText = 'position:fixed;left:-100000px;top:0;width:210mm;background:#fff;z-index:-999999;';
    host.innerHTML = `<style data-memorial-pdf-render-css>${documentCss()}</style>${lastPdfHtml || lastMemorialHtml}`;
    document.body.appendChild(host);
    try {
      let placedSignatureData = '';
      let placedSignatureRatio = 0.25;
      const importedSignatureAsset = memorialEditSettings.importedSignatureEnabled ? await readMemorialImportedSignature() : null;
      const importedSignatureData = String(importedSignatureAsset?.dataUrl || '');
      const importedSignatureRatio = importedSignatureAsset ? (Number(importedSignatureAsset.height||1)/Math.max(1,Number(importedSignatureAsset.width||1))) : 0.25;
      const embeddedSignatures=host.querySelectorAll('.standard-signature-image,.custom-signature-image,.custom-docx-tech-signature-image,.agro-tech-box img');
      const embeddedAccountUrl=Array.from(embeddedSignatures).map(node=>String(node.getAttribute('src')||'')).find(value=>value.startsWith('data:image/'))||'';
      // O PDF tem uma única origem para cada assinatura: somente addImage na página
      // escolhida. Imagens do HTML eram rasterizadas e adicionadas NOVAMENTE.
      embeddedSignatures.forEach(node=>node.remove());
      if (memorialEditSettings.includeSignature) {
        placedSignatureData = await resolveMemorialSignature({ forceRefresh:false }) || embeddedAccountUrl;
        if (placedSignatureData) {
          try {
            const signatureImage = await withTimeout(new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Assinatura cadastrada inválida.'));image.src=placedSignatureData;}),5000,'Tempo limite ao carregar a assinatura cadastrada.');
            placedSignatureRatio = signatureImage.naturalHeight / Math.max(1, signatureImage.naturalWidth);
          } catch (_error) {}
        }
      }
      await boundedStep('Carregamento das imagens do memorial',()=>waitForImages(host),9000,null);
      if (document.fonts?.ready) {
        await boundedStep('Carregamento das fontes do memorial',()=>document.fonts.ready,3000,null);
      }
      await boundedStep('Preparação visual do memorial',()=>new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),2500,null);
      const fixedPages = Array.from(host.querySelectorAll('.custom-memorial-page, .standard-memorial-page'));
      fixedPages.forEach((page,index)=>{
        page.querySelector('.memorial-page-number')?.remove();
        const number=document.createElement('div');
        number.className='memorial-page-number';
        number.textContent=`Página ${index+1} de ${fixedPages.length}`;
        page.appendChild(number);
      });
      const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const renderedPages = [];
      if (fixedPages.length) {
        for (let index = 0; index < fixedPages.length; index += 1) {
          const page = fixedPages[index];
          // Comparação exata (sem hash sujeito a colisão) para preservar dados
          // técnicos. Assinaturas móveis não fazem parte da imagem rasterizada.
          const pageMarkup=typeof page.outerHTML==='string'?page.outerHTML:null;
          const cachedPage=memorialPdfPageCache[index];
          let pageImage=pageMarkup!==null&&cachedPage?.markup===pageMarkup?cachedPage.image:null;
          if(!pageImage){
            const canvas = await withTimeout(window.html2canvas(page, {
              scale: 1.7,
              useCORS: true,
              allowTaint: false,
              backgroundColor: '#ffffff',
              logging: false,
              width: page.scrollWidth,
              height: page.scrollHeight,
              windowWidth: page.scrollWidth,
              windowHeight: page.scrollHeight,
              scrollX: 0,
              scrollY: 0
            }), 15000, 'A renderização de uma página do memorial excedeu o tempo limite.');
            pageImage=canvas.toDataURL('image/jpeg', 0.94);
            if(pageMarkup!==null)memorialPdfPageCache[index]={markup:pageMarkup,image:pageImage};
          }
          renderedPages.push(pageImage);
          if (index > 0) doc.addPage('a4', 'portrait');
          doc.addImage(pageImage, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
          const signaturePageIndex=Math.max(0,Math.min(fixedPages.length-1,Number(memorialEditSettings.signaturePageIndex||0)||0));
          if(placedSignatureData && index===signaturePageIndex){
            const pos=memorialSignaturePlacement(placedSignatureRatio);
            doc.addImage(placedSignatureData,'PNG',pos.xMm,pos.yMm,pos.widthMm,pos.heightMm,undefined,'FAST');
          }
          if(importedSignatureData && index===signaturePageIndex){
            const size=memorialSignaturePlacement(importedSignatureRatio);
            const offsetY=placedSignatureData?Math.min(18,size.heightMm+3):0;
            const pos=memorialSignaturePlacement(importedSignatureRatio,offsetY);
            doc.addImage(importedSignatureData,'PNG',pos.xMm,pos.yMm,pos.widthMm,pos.heightMm,undefined,'FAST');
          }
        }
      } else {
        host.style.width = '794px';
        await withTimeout(new Promise((resolve, reject) => {
          try {
            doc.html(host, {
              callback: () => resolve(),
              x: 10,
              y: 10,
              width: 190,
              windowWidth: 794,
              autoPaging: 'text',
              html2canvas: { scale: 1, useCORS: true, backgroundColor: '#ffffff', logging: false }
            });
          } catch (error) { reject(error); }
        }), 20000, 'A renderização alternativa do memorial excedeu o tempo limite.');
      }
      if (renderedPages.length){
        lastRenderedPdfPages = renderedPages;
        memorialPdfPageCache.length=fixedPages.length;
      }
      return doc.output('blob');
    } finally {
      host.remove();
    }
  }

  function scaleMemorialPreviewHost(host){
    const doc=host?.querySelector?.('.memorial-live-preview-document');
    if(!host||!doc)return;
    const width=Math.max(320,host.clientWidth-30);
    const fitScale=Math.max(.38,Math.min(1,width/794));
    const scale=Math.max(.24,Math.min(1.8,fitScale*memorialPreviewZoom));
    doc.style.zoom=String(scale);
  }

  function scaleMemorialLivePreview(){
    const scroll=$('memorialOutput')?.querySelector?.('.memorial-live-scroll');
    if(scroll)scaleMemorialPreviewHost(scroll);
    const modal=signerModal();
    const live=modal?.querySelector?.('[data-memorial-live-workspace]');
    if(live&&!live.hidden)scaleMemorialPreviewHost(live);
  }

  async function applyMemorialPreviewSignatureLayout(root){
    if(!root) return;
    const pages=Array.from(root.querySelectorAll('.standard-memorial-page,.custom-memorial-page'));
    if(!pages.length) return;
    pages.forEach((page)=>{
      page.querySelectorAll('[data-memorial-positioned-signature]').forEach((node)=>node.remove());
      page.querySelectorAll('.standard-signature-image,.custom-signature-image,.custom-docx-tech-signature-image,.agro-tech-box img').forEach((node)=>node.remove());
    });
    const signaturePageIndex=Math.max(0,Math.min(pages.length-1,Number(memorialEditSettings.signaturePageIndex||0)||0));
    const targetPage=pages[signaturePageIndex];
    if(!targetPage) return;
    const overlays=[];
    if(memorialEditSettings.includeSignature){
      const accountData=String(await resolveMemorialSignature({forceRefresh:false})||'').trim();
      if(accountData){
        let ratio=0.25;
        try{ const dims=await imageDimensions(accountData); ratio=Number(dims.height||1)/Math.max(1,Number(dims.width||1)); }catch(_error){}
        overlays.push({dataUrl:accountData,ratio,alt:'Assinatura do responsável técnico'});
      }
    }
    if(memorialEditSettings.importedSignatureEnabled){
      const importedAsset=await readMemorialImportedSignature();
      const importedData=String(importedAsset?.dataUrl||'').trim();
      if(importedData){
        const ratio=Number(importedAsset?.height||1)/Math.max(1,Number(importedAsset?.width||1));
        overlays.push({dataUrl:importedData,ratio,alt:String(importedAsset?.name||'Assinatura importada')});
      }
    }
    let verticalOffset=0;
    overlays.forEach((item,index)=>{
      const pos=memorialSignaturePlacement(item.ratio,verticalOffset);
      const image=document.createElement('img');
      image.src=item.dataUrl;
      image.alt=item.alt;
      image.setAttribute('data-memorial-positioned-signature','1');
      // A folha na tela muda de tamanho. Usar % e não mm impede deslocamento visual.
      image.style.cssText=`position:absolute;left:${pos.leftPct}%;top:${pos.topPct}%;width:${pos.widthPct}%;height:${pos.heightPct}%;object-fit:contain;z-index:6;pointer-events:none;`;
      targetPage.appendChild(image);
      if(index===0&&overlays.length>1)verticalOffset=Math.min(18,memorialSignaturePlacement(overlays[1].ratio).heightMm+3);
    });
  }

  function memorialPreviewSignatureKey(){
    // A mudança de posição/seleção não necessariamente altera o HTML documental.
    return [memorialEditSettings.includeSignature,memorialEditSettings.importedSignatureEnabled,
      memorialEditSettings.signaturePageIndex,memorialEditSettings.signatureX,
      memorialEditSettings.signatureY,memorialEditSettings.signatureWidth,
      memorialSigner.signatureDataUrl?.length||0,memorialSigner.importedSignatureAsset?.updatedAt||''].join('|');
  }

  function renderMemorialPersonalizationPreview(modal=signerModal()){
    const live=modal?.querySelector?.('[data-memorial-live-workspace]');
    if(!live||!lastMemorialHtml||live.hidden)return;
    const previous=memorialPreviewHostCache.get(live);
    const signatureKey=memorialPreviewSignatureKey();
    const liveDocumentReplaced=previous?.html!==lastMemorialHtml||!live.querySelector('.memorial-live-preview-document');
    if(liveDocumentReplaced){
      live.innerHTML=`<style data-memorial-live-css>${documentCss()}</style><div class="memorial-live-preview-document">${lastMemorialHtml}</div>`;
    }
    if(liveDocumentReplaced||previous?.signatureKey!==signatureKey){
      applyMemorialPreviewSignatureLayout(live).catch((error)=>console.warn('[Memorial] Falha ao alinhar as assinaturas da prévia:',error));
    }
    memorialPreviewHostCache.set(live,{html:lastMemorialHtml,signatureKey});
    scaleMemorialPreviewHost(live);
    requestAnimationFrame(()=>scaleMemorialPreviewHost(live));
  }

  function renderLiveMemorialPreview(){
    const output=showMemorialPreview();
    if(!output)return;
    output.classList.add('memorial-live-preview-host');
    output.removeAttribute('aria-busy');
    const previous=memorialPreviewHostCache.get(output);
    const signatureKey=memorialPreviewSignatureKey();
    // Regerar documento inteiro apenas quando o HTML mudou, mantendo rolagem/zoom.
    const outputDocumentReplaced=previous?.html!==lastMemorialHtml||!output.querySelector('.memorial-live-preview-document');
    if(outputDocumentReplaced){
      const lastScroll=output.querySelector('.memorial-live-scroll')?.scrollTop||0;
      output.innerHTML=`<div class="memorial-live-scroll"><style data-memorial-live-css>${documentCss()}</style><div class="memorial-live-preview-document">${lastMemorialHtml}</div></div>`;
      const next=output.querySelector('.memorial-live-scroll');
      if(next)next.scrollTop=lastScroll;
    }
    if(outputDocumentReplaced||previous?.signatureKey!==signatureKey){
      applyMemorialPreviewSignatureLayout(output).catch((error)=>console.warn('[Memorial] Falha ao alinhar as assinaturas da prévia:',error));
    }
    memorialPreviewHostCache.set(output,{html:lastMemorialHtml,signatureKey});
    syncMemorialSignerPages();
    scaleMemorialLivePreview();
    requestAnimationFrame(scaleMemorialLivePreview);
    const modal=signerModal();
    if(modal&&!modal.hidden)renderMemorialPersonalizationPreview(modal);
  }

  function memorialLivePages(){
    if(memorialParsedPagesSource===lastMemorialHtml)return memorialParsedPages;
    const host=document.createElement('div');
    host.innerHTML=lastMemorialHtml||'';
    const pages=Array.from(host.querySelectorAll('.standard-memorial-page,.custom-memorial-page'));
    memorialParsedPages=pages.length?pages.map((page)=>page.outerHTML):[
      host.querySelector('.memorial-profissional,article,.memorial-word-template')?.outerHTML||lastMemorialHtml||'<div></div>'
    ];
    memorialParsedPagesSource=lastMemorialHtml;
    return memorialParsedPages;
  }

  function syncMemorialSignerPages({preserveIndex=true}={}){
    const pages=memorialLivePages();
    if(!pages.length)return;
    const previousIndex=preserveIndex?Number(memorialSigner.pageIndex||0):0;
    memorialSigner.pages=pages;
    memorialSigner.pageIndex=Math.max(0,Math.min(pages.length-1,previousIndex));
    const select=$('memorialSignaturePageSelect');
    if(select){
      select.innerHTML=pages.map((_,index)=>`<option value="${index}">Página ${index+1} de ${pages.length}</option>`).join('');
      select.value=String(memorialSigner.pageIndex);
    }
    const modal=signerModal();
    if(modal&&!modal.hidden&&modal.dataset.activePersonalizationTool==='signature') updateSignerUi();
  }

  function setMemorialModelLoading(active,message='Aplicando modelo…'){
    let overlay=document.getElementById('memorialModelLoadingOverlay');
    if(active){
      if(!overlay){
        overlay=document.createElement('div');
        overlay.id='memorialModelLoadingOverlay';
        overlay.className='sv-document-app-loader';
        overlay.setAttribute('role','status');
        overlay.setAttribute('aria-label','Carregando documento');
        overlay.innerHTML='<span class="sv-document-app-loader-spinner" aria-hidden="true"></span>';
        document.body.appendChild(overlay);
      }
      overlay.hidden=false;
      overlay.setAttribute('aria-hidden','false');
    }else if(overlay){
      overlay.hidden=true;
      overlay.setAttribute('aria-hidden','true');
    }
  }
  async function rebuildMemorialModel(){
    if(!$('projectSelect')?.value)return;
    clearTimeout(memorialLiveRegenerationTimer);
    setMemorialModelLoading(true,'Aplicando modelo…');
    try{await generate({reason:'model',silent:true});}
    finally{setMemorialModelLoading(false);}
  }
  function scheduleMemorialLiveRegeneration(delay=280,{showLoader=false}={}){
    if(!$('projectSelect')?.value)return;
    clearTimeout(memorialLiveRegenerationTimer);
    const safeDelay=Math.max(200,Number(delay)||280);
    memorialLiveRegenerationTimer=window.setTimeout(async()=>{if(showLoader)setMemorialModelLoading(true,'Atualizando prévia…');try{await generate({reason:'live',silent:true});}catch(error){console.warn('[Memorial] Falha ao atualizar a prévia viva:',error);}finally{if(showLoader)setMemorialModelLoading(false);}},safeDelay);
  }

  async function renderPdfPreview(showInPreview = true) {
    const serial = ++pdfGenerationSerial;
    if(showInPreview) previewLoading();
    try {
      const blob = await withTimeout(buildMemorialPdfBlob(), 35000, 'A geração do memorial excedeu o tempo limite.');
      if (serial !== pdfGenerationSerial) return;
      revokePdfPreviewUrl();
      lastPdfBlob = blob;
      lastPdfBlobUrl = URL.createObjectURL(blob);
      if(showInPreview){
        const output = showMemorialPreview();
        if (!output) return;
        const template = window.SurveyorMemorialTemplates?.byId?.(lastGeneratedTemplateId);
        if (window.SurveyorPdfPreview?.showBlob) {
          try {
            await withTimeout(window.SurveyorPdfPreview.showBlob(output, blob, { title: `Memorial descritivo — ${template?.name || 'Surveyor'}` }), 6000, 'A pré-visualização do memorial demorou mais que o esperado.');
            output.querySelectorAll('.memorial-native-preview-actions').forEach((node) => node.remove());
          } catch (error) {
            console.warn('[Memorial] Pré-visualização avançada indisponível; usando o visualizador nativo.', error);
            output.innerHTML = `<div class="surveyor-pdf-native-wrap surveyor-pdf-native-wrap-official"><iframe class="surveyor-pdf-native-viewer surveyor-pdf-native-viewer-official" title="Pré-visualização do Memorial Descritivo em PDF" src="${lastPdfBlobUrl}#page=1&zoom=page-width&toolbar=1&navpanes=1&scrollbar=1"></iframe></div>`;
          }
        } else {
          output.innerHTML = `<div class="surveyor-pdf-native-wrap surveyor-pdf-native-wrap-official"><iframe class="surveyor-pdf-native-viewer surveyor-pdf-native-viewer-official" title="Pré-visualização do Memorial Descritivo em PDF" src="${lastPdfBlobUrl}#page=1&zoom=page-width&toolbar=1&navpanes=1&scrollbar=1"></iframe></div>`;
        }
        output.removeAttribute('aria-busy');
      }
    } catch (error) {
      console.error('[Memorial] Erro ao gerar PDF:', error);
      if (showInPreview && serial === pdfGenerationSerial) previewError(error);
      throw error;
    }
  }

  function signerModal(){ return $('memorialSignatureModal'); }

  function ensureMemorialEditorModal(){
    if(signerModal()) return signerModal();
    const modal=document.createElement('div');
    modal.id='memorialSignatureModal';
    modal.className='memorial-sign-modal';
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<section class="memorial-sign-dialog" role="dialog" aria-modal="true" aria-labelledby="memorialEditorTitle">
      <header class="memorial-sign-dialog-head"><div><h2 id="memorialEditorTitle">Editar memorial descritivo</h2><p>Ajuste o texto e posicione a assinatura diretamente sobre a página.</p></div><button type="button" class="memorial-sign-close" id="closeMemorialSignature" aria-label="Fechar">×</button></header>
      <div class="memorial-sign-dialog-body">
        <aside class="memorial-sign-tools">
          <nav class="memorial-personalization-tabs" aria-label="Personalização do memorial">
            <button type="button" class="active" data-memorial-personalization-tool="memorial">Memorial</button>
            <button type="button" data-memorial-personalization-tool="map">Mapa</button>
            <button type="button" data-memorial-personalization-tool="signature">Assinatura</button>
          </nav>
          <section class="memorial-personalization-panel active" data-memorial-personalization-panel="memorial"><div data-memorial-source-host="memorial"></div></section>
          <section class="memorial-personalization-panel" data-memorial-personalization-panel="map" hidden><div data-memorial-source-host="map"></div></section>
          <section class="memorial-personalization-panel" data-memorial-personalization-panel="signature" hidden>
            <div class="sv-editor-tool-section memorial-unified-signature-panel"><span class="sv-editor-tool-label">Assinatura</span><div class="sv-editor-signature-source-card sv-editor-signature-unified-card"><div class="sv-editor-signature-import-head"><strong>Assinatura externa</strong></div><input id="memorialImportedSignatureInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><div class="sv-editor-signature-toggle-row"><label class="sv-editor-check-row"><input id="memorialUseImportedSignature" type="checkbox"> Usar assinatura importada</label><label class="sv-editor-check-row"><input id="memorialIncludeSignature" type="checkbox"> Assinatura da conta</label></div><div class="sv-editor-signature-import-meta"><span id="memorialImportedSignatureName">Nenhuma assinatura importada</span></div><div class="sv-editor-signature-import-actions"><button type="button" class="btn" id="memorialImportSignature">Importar assinatura</button><button type="button" class="btn" id="memorialRemoveSignature" title="Retirar somente a assinatura selecionada do memorial">Remover selecionada</button><button type="button" class="btn" id="memorialDeleteImportedSignature" title="Excluir o arquivo de assinatura importada deste projeto">Excluir importada</button></div><div class="sv-editor-signature-import-actions memorial-signature-individual-actions"><button type="button" class="btn" id="memorialRemoveAccountSignature" title="Retirar apenas a assinatura da conta deste memorial, sem apagar o perfil">Remover assinatura da conta</button><button type="button" class="btn" id="memorialRemoveImportedSignature" title="Retirar apenas a assinatura importada deste memorial, mantendo o arquivo">Remover assinatura importada</button></div></div><label class="sv-editor-slider-row">Tamanho <input id="memorialSignatureSize" type="range" min="10" max="55" step="1" value="28"><output id="memorialSignatureSizeOutput">28%</output></label><button type="button" class="btn sv-editor-full-button" id="centerMemorialSignature">Restaurar posição</button><small class="sv-editor-tool-hint">A assinatura da conta e a importada podem permanecer habilitadas. A assinatura importada usa o mesmo padrão de armazenamento seguro das pranchas.</small><small id="memorialSignatureStatus" class="sv-editor-tool-hint"></small><select id="memorialSignaturePageSelect" hidden></select><button type="button" id="memorialSignaturePrevPage" hidden></button><button type="button" id="memorialSignatureNextPage" hidden></button></div>
          </section>
        </aside>
        <div class="memorial-personalization-workspace"><div class="memorial-personalization-live" data-memorial-live-workspace></div><div class="memorial-sign-workspace" data-memorial-signature-workspace hidden><div class="memorial-sign-pages" id="memorialSignaturePages"></div><div class="memorial-sign-overlay" id="memorialSignatureOverlay" hidden><img id="memorialSignatureImage" alt="Assinatura cadastrada"><span class="memorial-sign-resize-handle" id="memorialSignatureResizeHandle" aria-hidden="true"></span></div></div></div>
      </div>
      <footer class="memorial-sign-dialog-foot"><div class="memorial-footer-left" data-memorial-footer-left><button type="button" class="btn" id="cancelMemorialSignature">Cancelar</button></div><div class="memorial-footer-zoom" data-memorial-footer-zoom><button id="memorialFontMinus" type="button" class="btn" aria-label="Diminuir zoom do memorial">−</button><strong id="memorialFontValue">100%</strong><button id="memorialFontPlus" type="button" class="btn" aria-label="Aumentar zoom do memorial">+</button></div><div class="memorial-footer-right" data-memorial-footer-right></div></footer>
    </section>`;
    document.body.appendChild(modal);
    return modal;
  }

  function closeMemorialSigner(){
    const modal=signerModal();
    if(!modal) return;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    const mount=modal._surveyorInlineMount || null;
    mount?.classList?.remove?.('sv-beta-personalization-active');
    modal.classList.remove('is-inline-personalization');
    modal._surveyorInlineMount=null;
    memorialSigner.dragging=false;memorialSigner.resizing=false;memorialSigner.pointerStart=null;
  }

  function currentMemorialSignaturePage(){
    return document.querySelector(`.memorial-sign-page[data-page-index="${Number(memorialSigner.pageIndex)||0}"]`);
  }

  function signedPageDimensions(){
    const page=currentMemorialSignaturePage();
    return page ? page.getBoundingClientRect() : {left:0,top:0,width:1,height:1};
  }

  // No editor, a folha A4 mantém seus 210 × 297 mm reais e apenas a sua
  // representação visual é escalada. Alterar width/height do HTML da folha
  // preservando medidas internas em mm fazia o rodapé e a assinatura se moverem
  // um em relação ao outro; o PDF sempre renderiza em dimensões A4 reais.
  function syncMemorialSignaturePageScale(){
    const host=$('memorialSignaturePages');
    if(!host)return;
    const a4WidthPx=210*96/25.4;
    host.querySelectorAll('.memorial-sign-page').forEach((page)=>{
      if(page.clientWidth>0)page.style.setProperty('--memorial-page-scale',String(page.clientWidth/a4WidthPx));
    });
  }

  function renderMemorialSignaturePages({force=false}={}){
    const host=$('memorialSignaturePages');
    if(!host)return;
    const pages=Array.isArray(memorialSigner.pages)?memorialSigner.pages:[];
    const pagesKey=`${pages.length}:${pages.map((page)=>String(page||'').length).join(',')}`;
    if(!force&&host.dataset.pagesKey===pagesKey&&host.children.length===pages.length){syncMemorialSignaturePageScale();return;}
    const overlay=$('memorialSignatureOverlay');
    const workspace=host.closest('.memorial-sign-workspace');
    if(overlay&&host.contains(overlay)&&workspace)workspace.appendChild(overlay);
    host.dataset.pagesKey=pagesKey;
    host.innerHTML=pages.map((page,index)=>`<div class="memorial-sign-page" data-page-index="${index}" tabindex="0" aria-label="Página ${index+1} de ${pages.length}"><div class="memorial-sign-page-bg memorial-live-page-bg"><style>${documentCss()}</style>${page||''}</div></div>`).join('');
    syncMemorialSignaturePageScale();
  }

  function signatureNaturalRatio(){
    const image=$('memorialSignatureImage');
    const w=image?.naturalWidth||4,h=image?.naturalHeight||1;
    return h/Math.max(1,w);
  }

  function clampSignerPosition(){
    const ratio=signatureNaturalRatio();
    const pageRatio=297/210;
    const height=memorialSigner.width*ratio/pageRatio;
    memorialSigner.width=Math.max(10,Math.min(55,memorialSigner.width));
    memorialSigner.x=Math.max(memorialSigner.width/2,Math.min(100-memorialSigner.width/2,memorialSigner.x));
    memorialSigner.y=Math.max(height/2,Math.min(100-height/2,memorialSigner.y));
  }

  function updateSignerUi(){
    if(!memorialSigner.pages.length) return;
    memorialSigner.pageIndex=Math.max(0,Math.min(memorialSigner.pages.length-1,memorialSigner.pageIndex));
    const imported=memorialSigner.importedSignatureAsset;
    const useImported=memorialEditSettings.importedSignatureEnabled&&Boolean(imported?.dataUrl);
    const accountAvailable=Boolean(memorialSigner.signatureDataUrl);
    const useAccount=memorialEditSettings.includeSignature&&accountAvailable;
    const activeDataUrl=useImported?String(imported?.dataUrl||''):(useAccount?String(memorialSigner.signatureDataUrl||''):'');
    // Manter a seleção explícita, para remover exatamente a assinatura escolhida.
    if(!['account','imported'].includes(memorialSigner.activeSignatureMode))memorialSigner.activeSignatureMode=useImported?'imported':useAccount?'account':'none';
    if(memorialSigner.activeSignatureMode==='imported'&&!useImported)memorialSigner.activeSignatureMode=useAccount?'account':'none';
    if(memorialSigner.activeSignatureMode==='account'&&!useAccount)memorialSigner.activeSignatureMode=useImported?'imported':'none';
    if(memorialSigner.activeSignatureMode==='none')memorialSigner.activeSignatureMode=useImported?'imported':useAccount?'account':'none';
    const activeMode=memorialSigner.activeSignatureMode;
    const selectedDataUrl=activeMode==='imported'?String(imported?.dataUrl||''):String(memorialSigner.signatureDataUrl||'');
    const selectedSignature=activeMode==='imported'?useImported:useAccount;
    clampSignerPosition();
    renderMemorialSignaturePages();
    // A composição do PDF retira as imagens fixas do HTML antes de posicionar
    // a assinatura pelo estado do editor. A tela precisa fazer a MESMA retirada:
    // visibility:hidden deixava a imagem ocupando espaço e movia a linha.
    const signaturePages=$('memorialSignaturePages');
    signaturePages?.querySelectorAll('.standard-signature-image,.custom-signature-image,.custom-docx-tech-signature-image,.agro-tech-box img').forEach((node)=>node.remove());
    const signature=$('memorialSignatureImage'); if(signature){ if(selectedSignature) signature.src=selectedDataUrl; else signature.removeAttribute('src'); }
    const overlay=$('memorialSignatureOverlay');
    const activePage=currentMemorialSignaturePage();
    if(overlay&&activePage){
      if(overlay.parentElement!==activePage)activePage.appendChild(overlay);
      // A imagem selecionada usa a MESMA geometria do PDF (incluindo o
      // deslocamento da importada quando ambas as assinaturas estão ativas).
      const selectedRatio=signatureNaturalRatio();
      const baseSize=memorialSignaturePlacement(selectedRatio);
      const importedOffset=activeMode==='imported'&&useAccount&&useImported?Math.min(18,baseSize.heightMm+3):0;
      const placement=memorialSignaturePlacement(selectedRatio,importedOffset);
      overlay.style.left=`${placement.leftPct+placement.widthPct/2}%`;
      overlay.style.top=`${placement.topPct+placement.heightPct/2}%`;
      overlay.style.width=`${placement.widthPct}%`;
      overlay.hidden=!selectedSignature;
    }
    document.querySelectorAll('.memorial-sign-page').forEach((page)=>page.classList.toggle('is-active',Number(page.dataset.pageIndex)===memorialSigner.pageIndex));
    const select=$('memorialSignaturePageSelect'); if(select){ select.hidden=false; select.value=String(memorialSigner.pageIndex); select.title=`Página ${memorialSigner.pageIndex+1} de ${memorialSigner.pages.length}`; }
    const range=$('memorialSignatureSize'); if(range){range.value=String(Math.round(memorialSigner.width));range.disabled=!selectedSignature;}
    const output=$('memorialSignatureSizeOutput'); if(output) output.textContent=`${Math.round(memorialSigner.width)}%`;
    const include=$('memorialIncludeSignature'); if(include){include.checked=memorialEditSettings.includeSignature;include.disabled=!accountAvailable;}
    const useImportedToggle=$('memorialUseImportedSignature'); if(useImportedToggle){useImportedToggle.checked=useImported;useImportedToggle.disabled=!imported?.dataUrl;}
    const importedName=$('memorialImportedSignatureName');if(importedName)importedName.textContent=imported?.name||'Nenhuma assinatura importada';
    const removeSignature=$('memorialRemoveSignature');if(removeSignature){
      removeSignature.disabled=!selectedSignature;
      removeSignature.title=activeMode==='imported'?'Retirar a assinatura importada selecionada, sem excluir o arquivo.':'Retirar a assinatura da conta selecionada, sem excluir o cadastro.';
    }
    const removeAccount=$('memorialRemoveAccountSignature');if(removeAccount)removeAccount.disabled=!useAccount;
    const removeImported=$('memorialRemoveImportedSignature');if(removeImported)removeImported.disabled=!useImported;
    const deleteImported=$('memorialDeleteImportedSignature');if(deleteImported){deleteImported.hidden=!imported?.dataUrl;deleteImported.disabled=!imported?.dataUrl;}
    const status=$('memorialSignatureStatus');
    const prevPageButton=$('memorialSignaturePrevPage');
    if(prevPageButton){ prevPageButton.hidden=memorialSigner.pages.length<=1; prevPageButton.textContent='Página anterior'; prevPageButton.setAttribute('aria-label','Página anterior'); prevPageButton.disabled=memorialSigner.pageIndex<=0; }
    const nextPageButton=$('memorialSignatureNextPage');
    if(nextPageButton){ nextPageButton.hidden=memorialSigner.pages.length<=1; nextPageButton.textContent='Próxima página'; nextPageButton.setAttribute('aria-label','Próxima página'); nextPageButton.disabled=memorialSigner.pageIndex>=memorialSigner.pages.length-1; }
    if(status){
      const baseStatus = activeMode==='imported'&&useImported ? 'Assinatura importada selecionada para posição e tamanho.' : activeMode==='account'&&useAccount ? 'Assinatura da conta selecionada para posição e tamanho.' : 'Nenhuma assinatura habilitada neste memorial.';
      status.textContent = `${baseStatus} Página ${memorialSigner.pageIndex+1} de ${memorialSigner.pages.length}.`;
    }
  }


  function signerPointerPosition(event){
    const rect=signedPageDimensions();
    return {x:((event.clientX-rect.left)/rect.width)*100,y:((event.clientY-rect.top)/rect.height)*100};
  }

  function startSignerDrag(event){
    if(event.target?.id==='memorialSignatureResizeHandle') return;
    memorialSigner.dragging=true;
    const point=signerPointerPosition(event);
    memorialSigner.pointerStart={pointerX:point.x,pointerY:point.y,centerX:memorialSigner.x,centerY:memorialSigner.y};
    $('memorialSignatureOverlay')?.classList.add('is-dragging');
    event.currentTarget?.setPointerCapture?.(event.pointerId);event.preventDefault();
  }

  function startSignerResize(event){
    memorialSigner.resizing=true;
    const point=signerPointerPosition(event);
    memorialSigner.pointerStart={pointerX:point.x,pointerY:point.y,width:memorialSigner.width};
    $('memorialSignatureOverlay')?.classList.add('is-resizing');
    event.currentTarget?.setPointerCapture?.(event.pointerId);event.stopPropagation();event.preventDefault();
  }

  function moveSignerPointer(event){
    if(!memorialSigner.pointerStart) return;
    const point=signerPointerPosition(event);
    if(memorialSigner.dragging){
      memorialSigner.x=memorialSigner.pointerStart.centerX+(point.x-memorialSigner.pointerStart.pointerX);
      memorialSigner.y=memorialSigner.pointerStart.centerY+(point.y-memorialSigner.pointerStart.pointerY);
    }else if(memorialSigner.resizing){
      memorialSigner.width=memorialSigner.pointerStart.width+(point.x-memorialSigner.pointerStart.pointerX)*2;
    }
    updateSignerUi();event.preventDefault();
  }

  function stopSignerPointer(){
    const changed=Boolean(memorialSigner.pointerStart&&(memorialSigner.dragging||memorialSigner.resizing));
    memorialSigner.dragging=false;memorialSigner.resizing=false;memorialSigner.pointerStart=null;
    $('memorialSignatureOverlay')?.classList.remove('is-dragging','is-resizing');
    if(changed)updateMemorialSignatureSelection();
  }


  function syncMemorialSignaturePosition(){
    // Arrastar e redimensionar mudam memorialSigner; o PDF lê memorialEditSettings.
    // Salvar as coordenadas aqui, ANTES de disparar geração assíncrona ou exportação.
    clampSignerPosition();
    memorialEditSettings.signaturePageIndex=memorialSigner.pageIndex;
    memorialEditSettings.signatureX=memorialSigner.x;
    memorialEditSettings.signatureY=memorialSigner.y;
    memorialEditSettings.signatureWidth=memorialSigner.width;
  }

  function updateMemorialSignatureSelection(){
    memorialPendingEdits=true;
    memorialPdfDocumentReady=false;
    syncMemorialSignaturePosition();
    saveMemorialEditSettings();
    // Uma exportação em cache não pode sobreviver à retirada de uma assinatura.
    pdfGenerationSerial += 1;
    revokePdfPreviewUrl();
    updateSignerUi();
    notifyMemorialDirty();
    scheduleMemorialLiveRegeneration(10);
  }

  function removeMemorialSignatureFromDocument(mode=memorialSigner.activeSignatureMode){
    const selected=mode==='imported'?'imported':'account';
    if(selected==='imported'){
      if(!memorialEditSettings.importedSignatureEnabled)return false;
      memorialEditSettings.importedSignatureEnabled=false;
      memorialSigner.activeSignatureMode='account';
    }else{
      if(!memorialEditSettings.includeSignature)return false;
      memorialEditSettings.includeSignature=false;
      memorialSigner.activeSignatureMode='imported';
    }
    updateMemorialSignatureSelection();
    return true;
  }

  async function deleteMemorialImportedSignature(){
    if(!memorialSigner.importedSignatureAsset?.dataUrl)return false;
    const removed=await writeMemorialImportedSignature(null);
    if(!removed){toast('Não foi possível excluir o arquivo importado do armazenamento local.','error');return false;}
    memorialSigner.importedSignatureAsset=null;
    memorialEditSettings.importedSignatureEnabled=false;
    updateMemorialSignatureSelection();
    return true;
  }

  function installMemorialSigner(){
    const modal=ensureMemorialEditorModal();
    if(!modal || modal.dataset.bound==='1') return;
    modal.dataset.bound='1';
    const signWorkspace=$('memorialSignaturePages')?.closest('.memorial-sign-workspace');
    if(signWorkspace&&window.ResizeObserver){
      const signatureResizeObserver=new ResizeObserver(()=>syncMemorialSignaturePageScale());
      signatureResizeObserver.observe(signWorkspace);
    }
    window.addEventListener('resize',syncMemorialSignaturePageScale,{passive:true});
    $('closeMemorialSignature')?.addEventListener('click',closeMemorialSigner);
    $('cancelMemorialSignature')?.addEventListener('click',closeMemorialSigner);
    modal.addEventListener('click',(event)=>{if(event.target===modal)closeMemorialSigner();});
    $('memorialSignaturePageSelect')?.addEventListener('change',(event)=>{memorialSigner.pageIndex=Number(event.target.value)||0;updateMemorialSignatureSelection();});
    $('memorialSignaturePrevPage')?.addEventListener('click',()=>{memorialSigner.pageIndex-=1;updateMemorialSignatureSelection();});
    $('memorialSignatureNextPage')?.addEventListener('click',()=>{memorialSigner.pageIndex+=1;updateMemorialSignatureSelection();});
    $('memorialSignatureSize')?.addEventListener('input',(event)=>{memorialSigner.width=Number(event.target.value)||28;updateSignerUi();});
    $('memorialSignatureSize')?.addEventListener('change',()=>updateMemorialSignatureSelection());
    $('centerMemorialSignature')?.addEventListener('click',()=>{memorialSigner.x=50;memorialSigner.y=58;updateMemorialSignatureSelection();});
    $('memorialIncludeSignature')?.addEventListener('change',(event)=>{memorialEditSettings.includeSignature=Boolean(event.target.checked)&&Boolean(memorialSigner.signatureDataUrl);if(event.target.checked)memorialSigner.activeSignatureMode='account';updateMemorialSignatureSelection();});
    $('memorialUseImportedSignature')?.addEventListener('change',(event)=>{memorialEditSettings.importedSignatureEnabled=Boolean(event.target.checked)&&Boolean(memorialSigner.importedSignatureAsset?.dataUrl);if(event.target.checked)memorialSigner.activeSignatureMode='imported';updateMemorialSignatureSelection();});
    $('memorialImportSignature')?.addEventListener('click',()=>$('memorialImportedSignatureInput')?.click());
    $('memorialImportedSignatureInput')?.addEventListener('change',async(event)=>{const file=event.target?.files?.[0]||null;event.target.value='';if(!file)return;try{const dataUrl=await fileToDataUrl(file),dims=await imageDimensions(dataUrl);const asset={name:String(file.name||'Assinatura importada'),dataUrl,width:dims.width,height:dims.height,updatedAt:new Date().toISOString()};memorialSigner.importedSignatureAsset=asset;memorialEditSettings.importedSignatureEnabled=true;memorialSigner.activeSignatureMode='imported';await writeMemorialImportedSignature(asset);updateMemorialSignatureSelection();}catch(error){console.warn('[Memorial] Falha ao importar assinatura:',error);toast(error?.message||'Não foi possível importar a assinatura.','error');}});
    $('memorialRemoveSignature')?.addEventListener('click',()=>removeMemorialSignatureFromDocument());
    $('memorialRemoveAccountSignature')?.addEventListener('click',()=>removeMemorialSignatureFromDocument('account'));
    $('memorialRemoveImportedSignature')?.addEventListener('click',()=>removeMemorialSignatureFromDocument('imported'));
    $('memorialDeleteImportedSignature')?.addEventListener('click',deleteMemorialImportedSignature);
    $('memorialFontMinus')?.addEventListener('click',()=>updateMemorialFont(-0.05));
    $('memorialFontPlus')?.addEventListener('click',()=>updateMemorialFont(0.05));
    $('applyMemorialEdit')?.addEventListener('click',applyMemorialEdit);
    $('memorialSignatureOverlay')?.addEventListener('pointerdown',startSignerDrag);
    $('memorialSignatureResizeHandle')?.addEventListener('pointerdown',startSignerResize);
    $('memorialSignaturePages')?.addEventListener('pointerdown',(event)=>{
      if(event.target?.closest?.('#memorialSignatureOverlay'))return;
      const page=event.target?.closest?.('.memorial-sign-page');
      if(!page)return;
      memorialSigner.pageIndex=Math.max(0,Number(page.dataset.pageIndex)||0);
      const rect=page.getBoundingClientRect();
      if(rect.width>0&&rect.height>0){
        memorialSigner.x=((event.clientX-rect.left)/rect.width)*100;
        memorialSigner.y=((event.clientY-rect.top)/rect.height)*100;
        clampSignerPosition();
      }
      updateMemorialSignatureSelection();
    });
    window.addEventListener('pointermove',moveSignerPointer,{passive:false});
    window.addEventListener('pointerup',stopSignerPointer);
    window.addEventListener('pointercancel',stopSignerPointer);
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!modal.hidden)closeMemorialSigner();});
  }

  async function openPdfPrintWindow() {
    if (!lastPdfBlob && !lastPdfHtml && !lastMemorialHtml) throw new Error('Gere o memorial primeiro.');
    // Revalidar a composição antes de imprimir, inclusive após alterações de assinatura.
    if (!lastPdfBlob || memorialPendingEdits) {
      clearTimeout(memorialLiveRegenerationTimer);
      if((!memorialPdfDocumentReady||memorialPendingEdits||!lastPdfHtml)
        && await generate({reason:'export',silent:true})!==true)throw new Error('O memorial não ficou pronto para impressão.');
      await renderPdfPreview(false);
    }
    if (!lastPdfBlobUrl) throw new Error('O PDF não ficou disponível. Tente novamente.');
    const win = window.open(lastPdfBlobUrl, '_blank', 'noopener,noreferrer,width=980,height=760');
    if (!win) toast('O navegador bloqueou a janela do PDF. Use Download > PDF para salvar o arquivo.', 'error');
  }

  let memorialPdfExportPromise = null;
  function offerMemorialPdfDownload(name) {
    const menu = document.querySelector('.sv-doc-preview-download .export-menu-list')
      || document.querySelector('.export-menu .export-menu-list');
    if (!menu || !lastPdfBlobUrl) return;
    let link = document.getElementById('memorialReadyPdfDownload');
    if (!link) {
      link = document.createElement('a');
      link.id = 'memorialReadyPdfDownload';
      link.className = 'memorial-ready-pdf-download';
      link.textContent = 'PDF pronto: clicar para salvar';
      menu.appendChild(link);
    }
    link.href = lastPdfBlobUrl;
    link.download = name;
    link.hidden = false;
  }

  async function downloadMemorialPdf() {
    if (memorialPdfExportPromise) return memorialPdfExportPromise;
    if (!lastPdfBlob && !lastPdfHtml && !lastMemorialHtml) {
      return toast('Gere o memorial primeiro.','error');
    }
    const menu = document.querySelector('.sv-doc-preview-download') || document.querySelector('.export-menu');
    const trigger = menu?.querySelector(':scope > button');
    const originalLabel = trigger?.textContent || '';
    const exporting = async () => {
      try {
        if (trigger) { trigger.textContent = 'Preparando PDF…'; trigger.setAttribute('aria-busy', 'true'); }
        if (!lastPdfBlob || memorialPendingEdits) {
          toast('Preparando PDF. O processo pode levar alguns segundos…');
          clearTimeout(memorialLiveRegenerationTimer);
          if((!memorialPdfDocumentReady||memorialPendingEdits||!lastPdfHtml)
            && await generate({reason:'export',silent:true})!==true)throw new Error('O memorial não foi atualizado para exportação.');
          // Só rasterizar após a geração refletir o estado atual das assinaturas.
          await renderPdfPreview(false);
        }
        if (!lastPdfBlob) throw new Error('Não foi possível finalizar o PDF. Tente novamente.');
        const name = `${slug($('projectSelect')?.selectedOptions?.[0]?.text)}-memorial.pdf`;
        // Link clicável permanece disponível caso o navegador bloqueie o clique automático.
        offerMemorialPdfDownload(name);
        download(name, lastPdfBlob, 'application/pdf');
        toast('PDF preparado. Se não baixar automaticamente, abra Download e clique em “PDF pronto: clicar para salvar”.', 'success');
      } catch (error) {
        console.error('[Memorial] Falha no download do PDF:', error);
        toast(error?.message || 'Não foi possível baixar o PDF. Tente novamente.', 'error');
      } finally {
        if (trigger) { trigger.textContent = originalLabel; trigger.removeAttribute('aria-busy'); }
      }
    };
    memorialPdfExportPromise = exporting().finally(() => { memorialPdfExportPromise = null; });
    return memorialPdfExportPromise;
  }

  function getPerimeter(p) {
    return globalThis.SurveyorProjectGeometry?.resolvePerimeter?.(p)
      || p?.geojson?.features?.filter((f) => /Polygon/.test(f?.geometry?.type || '')).sort((a,b)=>(globalThis.turf?.area?.(b)||0)-(globalThis.turf?.area?.(a)||0))[0]
      || null;
  }
  function ring(p) {
    const coords = getPerimeter(p)?.geometry?.coordinates?.[0] || [];
    if (coords.length > 1 && coords[0][0] === coords.at(-1)[0] && coords[0][1] === coords.at(-1)[1]) return coords.slice(0,-1);
    return coords;
  }
  function hav(a,b){const R=6371008.8,rad=x=>x*Math.PI/180,dlat=rad(b[1]-a[1]),dlon=rad(b[0]-a[0]);const q=Math.sin(dlat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
  function azimuth(a,b){const rad=x=>x*Math.PI/180,deg=x=>x*180/Math.PI;const p1=rad(a[1]),p2=rad(b[1]),dl=rad(b[0]-a[0]);const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return (deg(Math.atan2(y,x))+360)%360;}
  function areaHa(p){try{return window.turf?.area ? window.turf.area(getPerimeter(p))/10000 : 0;}catch{return 0;}}
  function perimeterMeters(coords){return coords.reduce((s,c,i)=>s+hav(c,coords[(i+1)%coords.length]),0);}
  function segments(coords){return coords.map((a,i)=>({i:i+1,a,b:coords[(i+1)%coords.length],az:azimuth(a,coords[(i+1)%coords.length]),dist:hav(a,coords[(i+1)%coords.length])}));}
  function confrontanteForSegment(p,index){const f=getPerimeter(p),list=Array.isArray(f?.properties?.confrontantes)?f.properties.confrontantes:[];return list.find(item=>Number(item.segmentIndex)===index)||list[index]||{};}
  function distinctConfrontants(p){
    const f=getPerimeter(p), list=Array.isArray(f?.properties?.confrontantes)?f.properties.confrontantes:[];
    const seen=new Set(), out=[];
    list.forEach((item)=>{
      const name=String(item?.nome||item?.name||item?.confrontante||'').trim();
      const propertyName=String(item?.propriedade||item?.propertyName||item?.imovel||'').trim();
      const doc=String(item?.cpfCnpj||item?.cpf_cnpj||item?.cpf||item?.cnpj||item?.documento||'').trim();
      if(!name && !propertyName && !doc) return;
      const key=`${name.toLowerCase()}|${propertyName.toLowerCase()}|${doc.replace(/\D/g,'')}`;
      if(seen.has(key)) return;
      seen.add(key); out.push({name,propertyName,doc});
    });
    return out;
  }
  function confrontationPhrase(item){
    const parts=[];
    if(String(item?.nome||'').trim()) parts.push(`confrontando com <b>${escape(item.nome)}</b>`);
    if(String(item?.propriedade||'').trim()) parts.push(`no imóvel <b>${escape(item.propriedade)}</b>`);
    if(String(item?.tipoLimite||'').trim()) parts.push(`tendo como limite ${escape(String(item.tipoLimite).toLowerCase())}`);
    if(String(item?.orientacao||'').trim()) parts.push(`na orientação ${escape(item.orientacao)}`);
    if(String(item?.observacao||'').trim()) parts.push(escape(item.observacao));
    return parts.length ? `, ${parts.join(', ')}` : '';
  }
  function confrontationPlain(item){
    const parts=[];
    if(String(item?.nome||'').trim()) parts.push(`confrontando com ${item.nome}`);
    if(String(item?.propriedade||'').trim()) parts.push(`no imóvel ${item.propriedade}`);
    if(String(item?.tipoLimite||'').trim()) parts.push(`tendo como limite ${String(item.tipoLimite).toLowerCase()}`);
    if(String(item?.orientacao||'').trim()) parts.push(`na orientação ${item.orientacao}`);
    if(String(item?.observacao||'').trim()) parts.push(item.observacao);
    return parts.length ? `, ${parts.join(', ')}` : '';
  }
  function getTheme(){
    const theme=window.GeoRuralDocumentTheme?.get?.()||{};
    const remote=loadedCustomization||{};
    const merged={...theme,...remote};
    if(theme?.options||remote?.options) merged.options={...(theme?.options||{}),...(remote?.options||{})};
    return merged;
  }
  function attr(v){return escape(v).replace(/`/g,'&#96;');}
  function boundedImg(src, alt='Imagem', width=118, maxHeight=70){
    const clean=String(src||'').trim();
    if(!clean) return '';
    return `<img src="${attr(clean)}" alt="${attr(alt)}" width="${width}" style="width:${width}px;max-width:${width}px;height:auto;max-height:${maxHeight}px;object-fit:contain;display:block;margin:0 auto;">`;
  }
  function wordMapImg(src, alt='Mapa de localização'){
    const clean=String(src||'').trim();
    if(!clean) return `<div class="memorial-map-fallback"><b>Mapa de localização</b><br>Imagem do mapa indisponível para incorporação automática.</div>`;
    return `<img src="${attr(clean)}" alt="${attr(alt)}" width="680" style="width:680px;max-width:100%;height:auto;display:block;margin:0 auto;border:1px solid #94a3b8;">`;
  }

  function getCityUf(p){return {city:p?.city||p?.municipality||'', uf:p?.uf||p?.stateCode||''};}
  function fieldValue(id, fallback=''){return ($(id)?.value||fallback||'').trim();}
  function optionalIdentityValue(value){
    const raw=String(value??'').trim();
    if(!raw)return '';
    const normalized=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return ['nao informado','nao informada','sem informacao','sem informação','-','--'].includes(normalized)?'':raw;
  }
  function identityHtmlLine(label,value,{tag='div'}={}){
    const clean=optionalIdentityValue(value);
    return clean?`<${tag}><b>${escape(label)}</b> ${escape(clean)}</${tag}>`:'';
  }

  // A segunda titularidade não altera a primeira nem utiliza separadores como '/'.
  // A mesma estrutura alimenta prévia, PDF, impressão, Word e TXT.
  function ownerIdentityRows(data){
    const secondaryName=optionalIdentityValue(data.ownerSecondary);
    const hasSecond=Boolean(secondaryName);
    const primaryName=optionalIdentityValue(data.ownerPrimary || (!hasSecond ? data.owner : ''));
    const primaryCpf=optionalIdentityValue(data.ownerCpfPrimary || (!hasSecond ? data.ownerCpf : ''));
    const primaryRg=optionalIdentityValue(data.ownerRgPrimary || (!hasSecond ? data.ownerRg : ''));
    return [
      {label:hasSecond?'PROPRIETÁRIOS:':'PROPRIETÁRIO:',values:[primaryName,secondaryName].filter(Boolean)},
      {label:'CPF/CNPJ:',values:[primaryCpf,hasSecond?optionalIdentityValue(data.ownerCpfSecondary):''].filter(Boolean)},
      {label:'RG:',values:[primaryRg,hasSecond?optionalIdentityValue(data.ownerRgSecondary):''].filter(Boolean)}
    ];
  }
  function ownerIdentificationHtml(data,{tag='div'}={}){
    return ownerIdentityRows(data).map(({label,values})=>values.length
      ? `<${tag} class="memorial-owner-ident-row"><b>${escape(label)}</b> <span style="display:inline-block;vertical-align:top">${values.map((value)=>`<span style="display:block">${escape(value)}</span>`).join('')}</span></${tag}>`
      : '').join(tag==='span'?'<br>':'');
  }
  function standardOwnerIdentification(data){
    return ownerIdentityRows(data).map(({label,values})=>values.length
      ? `<p class="standard-template-ident-row"><b>${escape(label)}</b><span>${values.map((value)=>`<span style="display:block">${escape(value)}</span>`).join('')}</span></p>`
      : '').join('');
  }
  function currentDateLong(){return new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});}
  async function selectedProject(){
    const id=$('projectSelect')?.value;
    if(!id)return null;
    let project=null;
    try{
      project=await boundedStep('Carregamento do projeto',()=>window.GeoRuralProjects.get(id,false),7000,null);
      if(!project?.geojson?.features?.length){
        project=await boundedStep('Atualização do projeto',()=>window.GeoRuralProjects.get(id,true),10000,project);
      }
    }catch(error){
      console.warn('[Memorial] Projeto indisponível na leitura principal:',error);
    }
    return globalThis.SurveyorDocumentScope?.apply?.(project)||project;
  }

  async function publicAccess(p){
    if(window.SurveyorBatchDocumentContext?.active) return {url:'',qr:''};
    const id=String(p?.id||'');
    if(!id) return {url:'',qr:''};
    let url=String(p?.publicUrl||p?.shareUrl||'').trim();
    let qr='';
    let lastError='';
    if(window.SurveyorDocumentAssets?.publicProjectAccess){
      const access=await window.SurveyorDocumentAssets.publicProjectAccess(p,{qrSize:220});
      url=access?.url||url;
      qr=access?.qr||'';
      lastError=access?.error||'';
      if(url&&qr) return {url,qr,error:lastError};
    }
    try{
      if(!url){
        let share=await window.GeoRuralAuth.getProjectShare(id).catch(()=>null);
        if(!share?.active||!share?.token) share=await window.GeoRuralAuth.createProjectShare(id,null);
        if(share?.token) url=new URL(`/public-project/#token=${encodeURIComponent(share.token)}`,location.href).href;
      }
      const qrLib=window.GeoRuralQR||window.QRCode;
      if(url&&!qr&&qrLib?.toDataURL) qr=await qrLib.toDataURL(url,{width:220,margin:1,errorCorrectionLevel:'M'}).catch(()=> '');
      return {url,qr,error:lastError};
    }catch(error){console.error('Falha ao gerar link público do memorial:',error);return {url,qr,error:error?.message||lastError||'Falha ao gerar link público.'};}
  }

  async function mapSvg(p, share={url:'',qr:''}, options={}) {
    const coords = ring(p);
    const cleanCoords = coords.length > 1
      && Number(coords[0]?.[0]) === Number(coords.at(-1)?.[0])
      && Number(coords[0]?.[1]) === Number(coords.at(-1)?.[1])
      ? coords.slice(0, -1)
      : coords.slice();
    lastMapCoords = cleanCoords.map((coord) => Array.isArray(coord) ? [...coord] : coord);

    const renderer = window.SurveyorCroquiRenderer;
    if (!renderer?.generate) throw new Error('Motor único de Mapas/Croquis não foi carregado no Memorial.');

    const theme = getTheme();
    const showConfrontantes = String($('memShowConfrontantes')?.value ?? '1') !== '0';
    const registration = fieldValue('memRegistration', '');
    const technician = fieldValue('memTechnician', theme.responsibleTechnician || '');

    // O Memorial não possui mais um segundo desenho cartográfico próprio.
    // Ele gera a prancha pela MESMA implementação usada em /mapas/, preservando
    // cores, cotas, vértices, confrontantes, nomes, servidões e edições salvas.
    return renderer.generate(p, {
      page: 'mapas.html',
      zoom: Number($('memMapZoom')?.value || 15),
      backgroundKind: $('memMapBackground')?.value || 'sat',
      title: 'PLANTA DO IMÓVEL RURAL',
      registration,
      technician,
      showCotas: true,
      showGlebaCotas: false,
      showVertices: true,
      showConfrontantes,
      showNorth: true,
      showGrid: true,
      showScale: true,
      livePreview: options.livePreview === true,
      fastPreview: options.livePreview === true
    });
  }

  async function svgToPngDataUrl(svg){
    async function renderSvg(raw){
      const svgBlob=new Blob([raw],{type:'image/svg+xml;charset=utf-8'});
      const url=URL.createObjectURL(svgBlob);
      try{
        const img=await new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});
        const canvas=document.createElement('canvas');
        canvas.width=1200; canvas.height=970;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        return canvas.toDataURL('image/png');
      }finally{URL.revokeObjectURL(url);}
    }
    try{return await renderSvg(svg);}catch(error){
      console.warn('[Memorial] PNG com fundo completo falhou; tentando planta técnica sem imagens externas:',error);
      try{
        const sanitized=svg.replace(/<image\b[^>]*>/gi,'').replace('<rect x="44" y="74" width="1112" height="590" fill="#fff"/>','<rect x="44" y="74" width="1112" height="590" fill="#edf2f7"/><text x="600" y="350" text-anchor="middle" font-size="18" fill="#64748b">Base cartográfica indisponível no Word</text>');
        return await renderSvg(sanitized);
      }catch(second){console.warn('[Memorial] Não foi possível converter mapa para PNG:',second);return '';}
    }
  }


  function buildNarrative(p,ss){
    if(!ss.length) return '';
    return ss.map((r,idx)=>{
      const c=confrontanteForSegment(p,idx); const start=`V-${String(r.i).padStart(2,'0')}`; const end=`V-${String(r.i+1>ss.length?1:r.i+1).padStart(2,'0')}`;
      const prefix=idx===0?'Inicia-se a descrição deste perímetro no vértice':'deste, segue do vértice';
      return `<p class="memorial-paragraph">${prefix} <b>${start}</b>, de longitude <b>${r.a[0].toFixed(7)}</b> e latitude <b>${r.a[1].toFixed(7)}</b>${confrontationPhrase(c)}, com azimute de <b>${num(r.az,4)}°</b> e distância de <b>${num(r.dist,3)} m</b>, até o vértice <b>${end}</b>${idx===ss.length-1?', ponto inicial da descrição deste perímetro':''}.</p>`;
    }).join('');
  }
  function buildNarrativeText(p,ss){
    return ss.map((r,idx)=>{const c=confrontanteForSegment(p,idx),start=`V-${String(r.i).padStart(2,'0')}`,end=`V-${String(r.i+1>ss.length?1:r.i+1).padStart(2,'0')}`;const prefix=idx===0?'Inicia-se a descrição deste perímetro no vértice':'deste, segue do vértice';return `${prefix} ${start}, de longitude ${r.a[0].toFixed(7)} e latitude ${r.a[1].toFixed(7)}${confrontationPlain(c)}, com azimute de ${num(r.az,4)}° e distância de ${num(r.dist,3)} m, até o vértice ${end}${idx===ss.length-1?', ponto inicial da descrição deste perímetro':''}.`;}).join(' ');
  }
  function companyHeaderWordTable(){
    const t=getTheme(); const mem=t.options?.memorial||{};
    const logo=mem.showLogo===false?'':(t.logoDataUrl?boundedImg(t.logoDataUrl,'Logo da empresa',92,56):'<span class="word-logo-placeholder">LOGOTIPO</span>');
    const contato=[t.phoneText||t.phone, t.emailText||t.email, t.professionalRegistry].filter(Boolean).join(' | ') || '{{telefone | e-mail | CREA}}';
    return `<table class="word-company-header-table" border="0" cellspacing="0" cellpadding="0"><tr><td class="word-company-logo-cell">${logo}</td><td class="word-company-data-cell"><strong>${escape(t.companyName||'{{NOME DA EMPRESA}}')}</strong><span>${escape(t.addressText||'{{endereço da empresa}}')}</span><span>${escape(contato)}</span>${t.websiteUrl?`<span>${escape(t.websiteUrl)}</span>`:'<span>{{www.seusite.com.br}}</span>'}</td></tr></table>`;
  }

  function companyFooterWordTable(){
    const t=getTheme(); const mem=t.options?.memorial||{};
    const logo=(mem.showLogo===false)?'':(t.logoDataUrl?boundedImg(t.logoDataUrl,'Logo da empresa',34,22):'');
    return `<table class="word-company-footer-table" border="0" cellspacing="0" cellpadding="0"><tr><td>${logo ? `<span class="word-footer-logo">${logo}</span>` : ''}<span class="word-footer-text">${escape(t.footerText||t.companyName||'Memorial descritivo gerado pelo Surveyor')}</span></td></tr></table>`;
  }

  function wordIdentificationTable(data){
    const left=[
      identityHtmlLine('PROPRIEDADE:',data.title,{tag:'span'}),
      identityHtmlLine('DOCUMENTO:',[optionalIdentityValue(data.documentType),optionalIdentityValue(data.reg)].filter(Boolean).join(' — '),{tag:'span'}),
      identityHtmlLine('CÓDIGO INCRA:',data.incra,{tag:'span'}),
      identityHtmlLine('Número CIB:',data.cnib,{tag:'span'}),
      ownerIdentificationHtml(data,{tag:'span'})
    ].filter(Boolean).join('<br>');
    const right=[
      identityHtmlLine('CIDADE:',data.cityLabel,{tag:'span'}),
      identityHtmlLine('COMARCA:',data.comarca,{tag:'span'}),
      `<span><b>ÁREA:</b> ${num(data.area,4)} ha</span>`,
      `<span><b>PERÍMETRO:</b> ${num(data.per,3)} m</span>`
    ].filter(Boolean).join('<br>');
    return `<table class="word-ident-table" border="0" cellspacing="0" cellpadding="0"><tr><td>${left}</td><td>${right}</td></tr></table>`;
  }

  function wordSignaturesTable(data){
    const registryText=data.registry || ('CREA/CAU: ' + (fieldValue('memTechnician')||''));
    const second=data.ownerSecondary?`<td style="width:33%;padding:0 8px"><div class="word-sign-line"></div><b>${escape(data.ownerSecondary)}</b><small>${data.ownerCpfSecondary?`CPF/CNPJ: ${escape(data.ownerCpfSecondary)}`:''}</small></td>`:'';
    return `<table class="word-signatures-table" border="0" cellspacing="0" cellpadding="0"><tr><td${data.ownerSecondary?' style="width:33%;padding:0 8px"':''}><div class="word-sign-line"></div><b>${escape(data.ownerPrimary||data.owner)}</b><small>${data.ownerCpfPrimary?`CPF/CNPJ: ${escape(data.ownerCpfPrimary)}`:''}</small></td>${second}<td${data.ownerSecondary?' style="width:33%;padding:0 8px"':''}><div class="word-sign-line"></div><b>${escape(data.tech)}</b><small>${escape(registryText)}</small></td></tr></table>`;
  }

  function wordMapSection(mapBlock){
    if(!mapBlock) return '';
    return `<div style="page-break-before:always;font-size:1px;line-height:1px;height:1px">&nbsp;</div><section class="word-map-section"><h2>3. MAPA DE LOCALIZAÇÃO</h2><p class="memorial-map-note">Mapa/planta do imóvel rural gerado a partir do projeto, com imagem de satélite, vértices, limite do imóvel e QR Code de conferência pública quando disponível.</p><table class="word-map-table" border="0" cellspacing="0" cellpadding="0"><tr><td>${mapBlock}</td></tr></table></section>`;
  }

  function wordArticle(data, mapBlock){
    return `<article class="memorial-profissional memorial-word-template">${companyHeaderWordTable()}${wordIdentificationTable(data)}<h1 class="memorial-title">MEMORIAL DESCRITIVO</h1><h2>DESCRIÇÃO</h2><section class="memorial-description"><p class="memorial-paragraph memorial-running-text">${escape(runningMemorialText(data))}</p></section>${wordMapSection(mapBlock)}<p class="memorial-date">${escape(data.cityLabel||'')}, ${currentDateLong()}.</p>${wordSignaturesTable(data)}${companyFooterWordTable()}</article>`;
  }

  function wordHeaderFooter(){
    return `<div style="mso-element:header" id="memorialWordHeader">${companyHeaderWordTable()}</div><div style="mso-element:footer" id="memorialWordFooter">${companyFooterWordTable()}</div>`;
  }

  function templateAssetStem(item){
    return String(item?.file || '').replace(/\.docx$/i, '');
  }

  function narrativeParagraphs(html){
    const matches = String(html || '').match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
    return matches.length ? matches : [String(html || '')];
  }

  function runningMemorialText(data={}){
    return [String(data.narrativeText||'').trim(),String(data.closingText||'').trim()].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  }

  async function paginateRunningWords(text,renderBody,overflows){
    const words=String(text||'').split(/\s+/).filter(Boolean);
    if(!words.length) return [{text:'',pageIndex:0,isLast:true,body:renderBody('',{pageIndex:0,isLast:true})}];
    const pages=[];
    let cursor=0,pageIndex=0;
    while(cursor<words.length){
      let low=cursor+1,high=words.length,best=cursor;
      while(low<=high){
        const mid=Math.floor((low+high)/2);
        const candidate=words.slice(cursor,mid).join(' ');
        const isLast=mid===words.length;
        const body=renderBody(candidate,{pageIndex,isLast});
        if(await overflows(body,{pageIndex,isLast})) high=mid-1;
        else{best=mid;low=mid+1;}
      }
      if(best<=cursor) best=Math.min(words.length,cursor+1);
      const isLast=best===words.length;
      const chunk=words.slice(cursor,best).join(' ');
      pages.push({text:chunk,pageIndex,isLast,body:renderBody(chunk,{pageIndex,isLast})});
      cursor=best;
      pageIndex+=1;
    }
    return pages;
  }

  function nextPaint(){
    return new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }

  function standardPageCss(){
    return `.standard-memorial-document{display:block;width:210mm;margin:0;padding:0;background:#fff}.standard-memorial-page{position:relative;width:210mm;height:297mm;min-height:297mm;max-height:297mm;margin:0;background:#fff;overflow:hidden;box-sizing:border-box;page-break-after:always;font-family:Arial,Helvetica,sans-serif;color:#111827}.standard-memorial-page:last-child{page-break-after:auto}.standard-template-header{position:absolute;left:17mm;right:17mm;top:10mm;height:25mm;display:grid;grid-template-columns:38mm minmax(0,1fr);gap:7mm;align-items:center;border-bottom:1.4px solid #0f172a;padding-bottom:4mm;box-sizing:border-box}.standard-template-logo-slot{height:19mm;display:flex;align-items:center;justify-content:flex-start;overflow:visible}.standard-template-logo{display:block;max-width:34mm;max-height:18mm;width:auto;height:auto;object-fit:contain;object-position:left center}.standard-template-brand-fallback{font-size:14pt;font-weight:800;color:#0f2f63}.standard-template-company-data{text-align:right;min-width:0}.standard-template-company-data strong{display:block;font-size:13pt;line-height:1.18;color:#0f172a;overflow-wrap:anywhere}.standard-template-company-data span{display:block;margin-top:1mm;font-size:7.8pt;line-height:1.18;color:#475569;overflow-wrap:anywhere}.standard-template-page-body{position:absolute;left:17mm;right:17mm;top:41mm;bottom:17mm;overflow:hidden;box-sizing:border-box}.standard-template-footer{position:absolute;left:17mm;right:17mm;bottom:7mm;min-height:6mm;padding-top:2mm;border-top:.6px solid #cbd5e1;text-align:center;font-size:7.2pt;line-height:1.2;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.standard-template-title{text-align:center;font-size:15pt;line-height:1.15;letter-spacing:.02em;margin:0 0 5mm;color:#0f172a}.standard-template-ident{display:grid;grid-template-columns:1fr 1fr;gap:4mm 8mm;margin:0 0 5mm;padding:4mm 5mm;background:#f8fafc;border-radius:2.5mm;font-size:8.7pt;line-height:1.33}.standard-template-ident-column{min-width:0}.standard-template-ident-row{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:2mm;margin:0 0 1.4mm;align-items:start}.standard-template-ident-row:last-child{margin-bottom:0}.standard-template-ident-row b{font-size:8.35pt;white-space:nowrap}.standard-template-ident-row span{min-width:0;overflow-wrap:anywhere;word-break:normal}.standard-template-section-title,.standard-template-continuation,.standard-template-map-title{font-size:11.5pt;line-height:1.2;margin:3mm 0 3.5mm;padding-bottom:1.4mm;border-bottom:.6px solid #94a3b8;color:#0f172a}.standard-template-continuation{text-align:center;border-bottom:0;margin-top:0}.standard-template-description{width:100%;overflow:hidden}.standard-template-closing{font-size:9pt;line-height:1.38;margin:2.5mm 0 0;text-align:justify;overflow-wrap:anywhere;word-break:normal}.standard-template-map-title{text-align:center;border-bottom:0;margin-top:0}.standard-template-map-note{text-align:center;font-size:8.2pt;line-height:1.25;color:#475569;margin:0 0 3mm}.standard-template-map{display:block;width:auto;max-width:176mm;max-height:145mm;margin:0 auto;object-fit:contain;border:.7px solid #94a3b8;background:#fff}.standard-template-map.memorial-technical-map-vector{width:176mm;height:145mm;max-width:100%;box-sizing:border-box;overflow:hidden}.memorial-technical-map-vector>svg{display:block;width:100%;height:100%;max-width:none;max-height:none;margin:0;background:#fff}.standard-template-map-fallback{height:120mm;display:grid;place-items:center;text-align:center;border:1px dashed #94a3b8;background:#f8fafc;color:#64748b}.standard-template-date{margin:5mm 0 6mm;text-align:center;font-size:9.2pt}.standard-template-signatures{display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin-top:5mm}.standard-signature-box{text-align:center;min-height:30mm;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0}.standard-signature-image{display:block;max-width:52mm;max-height:17mm;width:auto;height:auto;object-fit:contain;margin:0 auto -1mm}.standard-signature-line{width:100%;border-top:1px solid #111827;margin-bottom:2mm}.standard-signature-box b{font-size:9pt;line-height:1.2;overflow-wrap:anywhere}.standard-signature-box small{font-size:7.5pt;line-height:1.2;margin-top:1mm;overflow-wrap:anywhere}.standard-template-description .memorial-running-text{font-size:8.8pt;line-height:1.34}${runningMemorialDescriptionCss()}.standard-memorial-measure-host{position:fixed!important;left:-100000px!important;top:0!important;width:210mm!important;visibility:hidden!important;pointer-events:none!important;z-index:-999999!important}@media print{@page{size:A4;margin:0}.standard-memorial-page{width:210mm!important;height:297mm!important;min-height:297mm!important;max-height:297mm!important;margin:0!important;box-shadow:none!important;overflow:hidden!important}}`;
  }

  function standardTemplateContact(theme){
    const parts=[theme.phoneNumber||theme.phoneText||theme.phone,theme.whatsappNumber,theme.emailAddress||theme.emailText||theme.email,theme.websiteUrl].filter(Boolean).map((item)=>String(item).trim()).filter(Boolean);
    const address=[theme.addressText,theme.addressNumber].filter(Boolean).join(', ').trim();
    if(address) parts.push(address);
    return parts.join(' • ');
  }

  function standardTemplatePage(theme,body,kind='content'){
    const mem=theme.options?.memorial||{};
    const logo=mem.showLogo===false?'':(theme.logoDataUrl?`<img class="standard-template-logo" src="${attr(theme.logoDataUrl)}" alt="Logotipo da empresa">`:`<strong class="standard-template-brand-fallback">${escape(theme.companyName||'Surveyor')}</strong>`);
    const company=theme.companyName||'Surveyor';
    const headerLines=[theme.addressText,[theme.phoneNumber||theme.phoneText||theme.phone,theme.emailAddress||theme.emailText||theme.email].filter(Boolean).join(' | '),theme.websiteUrl].filter(Boolean);
    const contact=standardTemplateContact(theme);
    const footer=theme.footerText||contact||company;
    return `<section class="standard-memorial-page standard-memorial-page-${kind}"><header class="standard-template-header"><div class="standard-template-logo-slot">${logo}</div><div class="standard-template-company-data"><strong>${escape(company)}</strong>${headerLines.map((line)=>`<span>${escape(line)}</span>`).join('')}</div></header><div class="standard-template-page-body">${body}</div><footer class="standard-template-footer">${escape(footer)}</footer></section>`;
  }

  function standardIdentRow(label,value){
    const clean=optionalIdentityValue(value);
    return clean?`<p class="standard-template-ident-row"><b>${escape(label)}</b><span>${escape(clean)}</span></p>`:'';
  }

  function standardIdentification(data){
    const documentValue=[optionalIdentityValue(data.documentType),optionalIdentityValue(data.reg)].filter(Boolean).join(' - ');
    return `<h1 class="standard-template-title">MEMORIAL DESCRITIVO</h1><div class="standard-template-ident"><div class="standard-template-ident-column">${standardIdentRow('PROPRIEDADE:',data.title)}${standardIdentRow('DOCUMENTO:',documentValue)}${standardIdentRow('CÓDIGO INCRA:',data.incra)}${standardIdentRow('Número CIB:',data.cnib)}${standardOwnerIdentification(data)}</div><div class="standard-template-ident-column">${standardIdentRow('MUNICÍPIO/UF:',data.cityLabel)}${standardIdentRow('COMARCA:',data.comarca)}${standardIdentRow('ÁREA:',`${num(data.area,4)} ha`)}${standardIdentRow('PERÍMETRO:',`${num(data.per,3)} m`)}</div></div>`;
  }

  async function standardTemplateBodyOverflows(theme,bodyHtml,kind='content'){
    const host=document.createElement('div');
    host.className='standard-memorial-measure-host';
    host.innerHTML=`<style>${standardPageCss()}${memorialFontOverrideCss()}</style>${standardTemplatePage(theme,bodyHtml,kind)}`;
    document.body.appendChild(host);
    try{
      await nextPaint();
      const body=host.querySelector('.standard-template-page-body');
      return Boolean(body && body.scrollHeight > body.clientHeight + 2);
    }finally{
      host.remove();
    }
  }

  async function paginateStandardNarrative(theme,data){
    const paged=await paginateRunningWords(
      runningMemorialText(data),
      (chunk,{pageIndex})=>{
        const prefix=pageIndex===0
          ? `${standardIdentification(data)}<h2 class="standard-template-section-title">DESCRIÇÃO</h2>`
          : `<h1 class="standard-template-continuation">MEMORIAL DESCRITIVO - CONTINUAÇÃO</h1><h2 class="standard-template-section-title">DESCRIÇÃO</h2>`;
        return `${prefix}<div class="standard-template-description"><p class="memorial-running-text">${escape(chunk)}</p></div>`;
      },
      (body,{pageIndex})=>standardTemplateBodyOverflows(theme,body,pageIndex===0?'first':'continuation')
    );
    return paged.map(({body,pageIndex})=>({kind:pageIndex===0?'first':'continuation',body}));
  }

  function standardSignatureBox(theme,data,type){
    const isTech=type==='technical';
    const image=isTech&&theme.signatureDataUrl?`<img class="standard-signature-image" src="${attr(theme.signatureDataUrl)}" alt="Assinatura do responsável técnico">`:'';
    const name=isTech?data.tech:(type==='owner-secondary'?data.ownerSecondary:(data.ownerPrimary||data.owner));
    const documentNumber=type==='owner-secondary'?data.ownerCpfSecondary:(data.ownerCpfPrimary||data.ownerCpf);
    const detail=isTech?[theme.professionalTitle,data.registry].filter(Boolean).join(' - '):documentNumber?`CPF/CNPJ: ${documentNumber}`:'';
    return `<div class="standard-signature-box">${image}<div class="standard-signature-line"></div><b>${escape(name||'Não informado')}</b><small>${escape(detail||'Não informado')}</small></div>`;
  }

  function memorialTechnicalMapMarkup(mapVisual={},className='standard-template-map'){
    const svg=String(mapVisual?.svg||'').trim();
    if(svg) return `<div class="${className} memorial-technical-map-vector" role="img" aria-label="Mapa técnico de localização do imóvel">${svg}</div>`;
    const png=String(mapVisual?.png||'').trim();
    if(png) return `<img class="${className}" src="${attr(png)}" alt="Mapa de localização do imóvel">`;
    return '<div class="standard-template-map-fallback">Mapa de localização indisponível para incorporação automática.</div>';
  }

  async function buildStandardTemplateDocument(theme,data,mapVisual,includeMap){
    const narrativePages=await paginateStandardNarrative(theme,data);
    const pages=narrativePages.map((entry)=>standardTemplatePage(theme,entry.body,entry.kind));
    const mapMarkup=includeMap ? memorialTechnicalMapMarkup(mapVisual,'standard-template-map') : '';
    const finalBody=`${includeMap?`<h2 class="standard-template-map-title">MAPA DE LOCALIZAÇÃO</h2><p class="standard-template-map-note">Planta do imóvel rural gerada a partir do projeto selecionado, com perímetro e vértices identificados.</p>${mapMarkup}`:''}<p class="standard-template-date">${escape(data.cityLabel||'')}, ${currentDateLong()}.</p><div class="standard-template-signatures"${data.ownerSecondary?' style="grid-template-columns:repeat(3,minmax(0,1fr));gap:6mm"':''}>${standardSignatureBox(theme,data,'owner')}${data.ownerSecondary?standardSignatureBox(theme,data,'owner-secondary'):''}${standardSignatureBox(theme,data,'technical')}</div>`;
    pages.push(standardTemplatePage(theme,finalBody,includeMap?'map-signatures':'signatures'));
    return `<style data-standard-memorial-css>${standardPageCss()}</style><div class="standard-memorial-document" data-template-id="standard">${pages.join('')}</div>`;
  }

  async function customTemplateBodyOverflows(bodyHtml, kind='content'){
    const page=document.createElement('section');
    page.className=`custom-memorial-page custom-memorial-page-${kind} custom-memorial-measure`;
    page.innerHTML=`<div class="custom-template-page-body">${bodyHtml}</div>`;
    document.body.appendChild(page);
    try{
      await nextPaint();
      const body=page.querySelector('.custom-template-page-body');
      return Boolean(body && body.scrollHeight > body.clientHeight + 2);
    }finally{
      page.remove();
    }
  }

  async function paginateCustomNarrative(data){
    const paragraphs=narrativeParagraphs(data.narrative);
    const pages=[];
    let cursor=0;
    let pageIndex=0;
    while(cursor<paragraphs.length){
      const heading=pageIndex===0 ? customIdentification(data) : '';
      const prefix=`${heading}<h2 class="custom-template-section-title">DESCRIÇÃO</h2>`;
      const accepted=[];
      while(cursor<paragraphs.length){
        const candidate=[...accepted,paragraphs[cursor]];
        const body=`${prefix}<div class="custom-template-description">${candidate.join('')}</div>`;
        const overflows=await customTemplateBodyOverflows(body,pageIndex===0?'first':'continuation');
        if(overflows && accepted.length) break;
        accepted.push(paragraphs[cursor]);
        cursor+=1;
        if(overflows) break;
      }
      if(!accepted.length && cursor<paragraphs.length){
        accepted.push(paragraphs[cursor]);
        cursor+=1;
      }
      let closing='';
      if(cursor>=paragraphs.length){
        const proposed=`<p class="custom-template-closing">${data.closing}</p>`;
        const bodyWithClosing=`${prefix}<div class="custom-template-description">${accepted.join('')}${proposed}</div>`;
        if(await customTemplateBodyOverflows(bodyWithClosing,pageIndex===0?'first':'continuation')){
          pages.push({kind:pageIndex===0?'first':'continuation',body:`${prefix}<div class="custom-template-description">${accepted.join('')}</div>`});
          pages.push({kind:'continuation',body:`<h2 class="custom-template-section-title custom-template-section-title-continuation">DESCRIÇÃO</h2><div class="custom-template-description">${proposed}</div>`});
          return pages;
        }
        closing=proposed;
      }
      pages.push({kind:pageIndex===0?'first':'continuation',body:`${prefix}<div class="custom-template-description">${accepted.join('')}${closing}</div>`});
      pageIndex+=1;
    }
    return pages.length?pages:[{kind:'first',body:`${customIdentification(data)}<h2 class="custom-template-section-title">DESCRIÇÃO</h2><div class="custom-template-description"><p class="custom-template-closing">${data.closing}</p></div>`}];
  }

  function customContactPhone(value){
    const raw=String(value||'').trim();
    return raw.replace(/\D/g,'').length>=8 ? raw : '';
  }

  function customTemplateContact(theme){
    return {
      whatsapp: customContactPhone(theme.whatsappNumber),
      phone: customContactPhone(theme.phoneNumber||theme.phoneText||theme.phone),
      email: String(theme.emailAddress||theme.emailText||theme.email||'').trim(),
      address: [theme.addressText,theme.addressNumber].filter(Boolean).join(', ').trim()
    };
  }

  function absoluteAsset(path){
    try{return new URL(path, location.origin || location.href).href;}catch{return path;}
  }

  function customTemplatePage(item,theme,body,kind='content'){
    const stem=templateAssetStem(item);
    const header=absoluteAsset(`/assets/memorial-template-backgrounds/${encodeURIComponent(stem)}-header.png?v=1.0.0-rc.185.74`);
    const footer=absoluteAsset(`/assets/memorial-template-backgrounds/${encodeURIComponent(stem)}-footer.png?v=1.0.0-rc.185.74`);
    const fixedBranding=Boolean(item.fixedBranding);
    const logo=fixedBranding?'':(theme.logoDataUrl ? `<img class="custom-template-logo" src="${theme.logoDataUrl}" alt="Logotipo da empresa">` : `<strong class="custom-template-company-name">${escape(theme.companyName||'Surveyor')}</strong>`);
    const contact=customTemplateContact(theme);
    const contactLines=[];
    if(contact.whatsapp || contact.phone){
      const parts=[];
      if(contact.whatsapp) parts.push(`<span class="custom-footer-item"><span class="custom-footer-icon custom-footer-icon-whatsapp">☎</span><span>${escape(contact.whatsapp)}</span></span>`);
      if(contact.phone && contact.phone!==contact.whatsapp) parts.push(`<span class="custom-footer-item"><span class="custom-footer-icon custom-footer-icon-phone">☎</span><span>${escape(contact.phone)}</span></span>`);
      contactLines.push(`<div class="custom-footer-line custom-footer-line-phones">${parts.join('')}</div>`);
    }
    if(contact.email) contactLines.push(`<div class="custom-footer-line"><span class="custom-footer-item"><span class="custom-footer-icon custom-footer-icon-email">✉</span><span>${escape(contact.email)}</span></span></div>`);
    if(contact.address) contactLines.push(`<div class="custom-footer-line"><span class="custom-footer-item"><span class="custom-footer-icon custom-footer-icon-location">●</span><span>${escape(contact.address)}</span></span></div>`);
    const footerMarkup=!fixedBranding&&contactLines.length?`<div class="custom-template-contact exact-footer" aria-label="Dados de contato da empresa">${contactLines.join('')}</div>`:'';
    const layout=String(item.layout||'');
    const fullPageLayout=layout==='docxExact'||layout==='agroExact';
    // A folha cartográfica usa fluxo próprio, inclusive em modelos que zeram o padding
    // das páginas de texto. Uma única geometria para prévia, HTML, PDF e impressão.
    const bodyStyle=kind==='map'
      ? 'padding:45mm 18mm 35mm;overflow:hidden;'
      : (fullPageLayout?'padding:0;overflow:hidden;':'');
    const layoutName=layout==='docxExact'?'docx-exact':(layout==='agroExact'?'agro-exact':'generic');
    const headerHeight=Number(item.headerHeightMm||34.7);
    const footerHeight=Number(item.footerHeightMm||38);
    return `<section class="custom-memorial-page custom-memorial-page-${kind}" data-layout="${layoutName}" style="--template-color:${escape(item.color||'#145edb')};--custom-header-height:${headerHeight}mm;--custom-footer-height:${footerHeight}mm">
      <img class="custom-template-header-art" src="${header}" alt="">
      <img class="custom-template-footer-art" src="${footer}" alt="">
      ${fixedBranding?'':`<div class="custom-template-logo-slot">${logo}</div>`}
      <div class="custom-template-page-body"${bodyStyle?` style="${bodyStyle}"`:''}>${body}</div>
      ${footerMarkup}
    </section>`;
  }

  function customDocxExactIdentification(data){
    const left=[
      identityHtmlLine('PROPRIEDADE:',data.title), identityHtmlLine('DOCUMENTO:',data.documentType),
      ownerIdentificationHtml(data)
    ].join('');
    const right=[
      identityHtmlLine('CÓDIGO INCRA:',data.incra), identityHtmlLine('Número CIB:',data.cnib),
      identityHtmlLine('CIDADE:',data.cityLabel), identityHtmlLine('COMARCA:',data.comarca),
      `<div><b>ÁREA:</b> ${num(data.area,4)} hectares</div>`,
      `<div class="custom-docx-perimeter"><b>PERÍMETRO:</b> ${num(data.per,3)} m</div>`
    ].join('');
    return `<div class="custom-docx-ident"><div class="custom-docx-ident-left">${left}</div><div class="custom-docx-ident-right">${right}</div></div>`;
  }

  function customDocxExactSignatures(data,theme){
    const techDetail=[theme.professionalTitle,data.registry].filter(Boolean).join(' - ');
    const techSignature=theme.signatureDataUrl?`<img class="custom-docx-tech-signature-image" src="${attr(theme.signatureDataUrl)}" alt="Assinatura do responsável técnico">`:'';
    return `<div class="custom-docx-final-block">
      <p class="custom-docx-date">${escape(data.cityLabel||'')}, ${currentDateLong()}.</p>
      <section class="custom-docx-tech-block">
        <h3>RESPONSÁVEL TÉCNICO:</h3>
        <div class="custom-docx-tech-signature">${techSignature}<div class="custom-docx-sign-line"></div><b>${escape(data.tech)}</b><small>${escape(techDetail||data.registry||'')}</small></div>
      </section>
      <section class="custom-docx-owner-block">
        <h3>${data.ownerSecondary?'PROPRIETÁRIOS:':'PROPRIETÁRIO:'}</h3>
        <p>Declaramos que essas descrições representam este imóvel.</p>
        <div style="display:flex;gap:7mm;align-items:flex-end"><div class="custom-docx-owner-signature" style="margin-left:0;flex:1"><div class="custom-docx-sign-line"></div><b>${escape(data.ownerPrimary||data.owner)}</b><small>${data.ownerCpfPrimary?`CPF: ${escape(data.ownerCpfPrimary)}`:''}</small></div>${data.ownerSecondary?`<div class="custom-docx-owner-signature" style="margin-left:0;flex:1"><div class="custom-docx-sign-line"></div><b>${escape(data.ownerSecondary)}</b><small>${data.ownerCpfSecondary?`CPF: ${escape(data.ownerCpfSecondary)}`:''}</small></div>`:''}</div>
      </section>
    </div>`;
  }

  function customDocxExactBody(data,paragraphs,{first=false,closing=false,signatures=false,theme={}}={}){
    const heading=first?customDocxExactIdentification(data):'';
    const close=closing&&data.closing?`<p class="custom-docx-closing">${data.closing}</p>`:'';
    const final=signatures?customDocxExactSignatures(data,theme):'';
    const titleClass=first?'custom-docx-description-title':'custom-docx-description-title custom-docx-description-title-continuation';
    return `<div class="custom-docx-exact-flow">${heading}<h2 class="${titleClass}">DESCRIÇÃO</h2><div class="custom-docx-description">${paragraphs.join('')}${close}</div>${final}</div>`;
  }

  async function customDocxExactOverflows(item,theme,body,kind='content'){
    const host=document.createElement('div');
    host.style.cssText='position:fixed;left:-100000px;top:0;width:210mm;visibility:hidden;pointer-events:none;z-index:-999999;';
    host.innerHTML=`<style>${documentCss()}${memorialFontOverrideCss()}</style>${customTemplatePage(item,theme,body,kind)}`;
    document.body.appendChild(host);
    try{
      await nextPaint();
      const flow=host.querySelector('.custom-docx-exact-flow');
      return Boolean(flow && flow.scrollHeight > flow.clientHeight + 2);
    }finally{ host.remove(); }
  }

  async function buildCustomDocxExactDocument(item,theme,data){
    const paragraphs=narrativeParagraphs(data.narrative);
    const pages=[];
    let cursor=0;
    let pageIndex=0;
    while(cursor<paragraphs.length){
      const accepted=[];
      while(cursor<paragraphs.length){
        const candidate=[...accepted,paragraphs[cursor]];
        const body=customDocxExactBody(data,candidate,{first:pageIndex===0,theme});
        const overflow=await customDocxExactOverflows(item,theme,body,pageIndex===0?'docx-exact-first':'docx-exact-continuation');
        if(overflow && accepted.length) break;
        accepted.push(paragraphs[cursor]);
        cursor+=1;
        if(overflow) break;
      }
      const isLastNarrativePage=cursor>=paragraphs.length;
      if(isLastNarrativePage){
        const completeBody=customDocxExactBody(data,accepted,{first:pageIndex===0,closing:true,signatures:true,theme});
        if(!await customDocxExactOverflows(item,theme,completeBody,pageIndex===0?'docx-exact-first':'docx-exact-continuation')){
          pages.push(customTemplatePage(item,theme,completeBody,pageIndex===0?'docx-exact-first':'docx-exact-continuation'));
          return `<div class="custom-memorial-document" data-template-id="${escape(item.id)}">${pages.join('')}</div>`;
        }
        const withClosing=customDocxExactBody(data,accepted,{first:pageIndex===0,closing:true,theme});
        if(!await customDocxExactOverflows(item,theme,withClosing,pageIndex===0?'docx-exact-first':'docx-exact-continuation')){
          pages.push(customTemplatePage(item,theme,withClosing,pageIndex===0?'docx-exact-first':'docx-exact-continuation'));
          const finalBody=`<div class="custom-docx-exact-flow custom-docx-final-page">${customDocxExactSignatures(data,theme)}</div>`;
          pages.push(customTemplatePage(item,theme,finalBody,'docx-exact-signatures'));
          return `<div class="custom-memorial-document" data-template-id="${escape(item.id)}">${pages.join('')}</div>`;
        }
      }
      pages.push(customTemplatePage(item,theme,customDocxExactBody(data,accepted,{first:pageIndex===0,theme}),pageIndex===0?'docx-exact-first':'docx-exact-continuation'));
      pageIndex+=1;
    }
    const onlyFinal=`<div class="custom-docx-exact-flow custom-docx-final-page">${customDocxExactSignatures(data,theme)}</div>`;
    pages.push(customTemplatePage(item,theme,onlyFinal,'docx-exact-signatures'));
    return `<div class="custom-memorial-document" data-template-id="${escape(item.id)}">${pages.join('')}</div>`;
  }

  function customIdentification(data){
    const left=[identityHtmlLine('PROPRIEDADE:',data.title),identityHtmlLine('DOCUMENTO:',data.documentType),identityHtmlLine('MATRÍCULA:',data.reg),ownerIdentificationHtml(data)].join('');
    const right=[identityHtmlLine('CÓDIGO INCRA:',data.incra),identityHtmlLine('Número CIB:',data.cnib),identityHtmlLine('CIDADE:',data.cityLabel),identityHtmlLine('COMARCA:',data.comarca),`<div><b>ÁREA:</b> ${num(data.area,4)} ha</div>`,`<div><b>PERÍMETRO:</b> ${num(data.per,3)} m</div>`].join('');
    return `<h1 class="custom-template-title">MEMORIAL DESCRITIVO</h1><div class="custom-template-ident"><div>${left}</div><div>${right}</div></div>`;
  }

  function agroIdentification(data){
    const left=[identityHtmlLine('PROPRIEDADE:',data.title),identityHtmlLine('DOCUMENTO:',data.documentType),ownerIdentificationHtml(data)].join('');
    const right=[identityHtmlLine('CÓDIGO INCRA:',data.incra),identityHtmlLine('Número CIB:',data.cnib),identityHtmlLine('CIDADE:',data.cityLabel),identityHtmlLine('COMARCA:',data.comarca),`<div><b>ÁREA:</b> ${num(data.area,4)} ha</div>`,`<div><b>PERÍMETRO:</b> ${num(data.per,2)} m</div>`].join('');
    return `<div class="agro-ident agro-ident-grid"><div class="agro-ident-column">${left}</div><div class="agro-ident-column agro-ident-column-right">${right}</div></div>`;
  }

  function agroNarrativeBody(data,text,{first=false,withDate=false}={}){
    const intro=first?`${agroIdentification(data)}<h2>DESCRIÇÃO</h2>`:'';
    const description=text?`<div class="agro-description"><p class="memorial-running-text">${escape(text)}</p></div>`:'';
    const date=withDate?`<p class="agro-date">${escape(data.cityLabel||'')}, ${currentDateLong()}.</p>`:'';
    return `<div class="agro-flow ${first?'agro-first':'agro-continuation'}">${intro}${description}${date}</div>`;
  }

  async function agroBodyOverflows(item,theme,body,kind='agro-content'){
    const host=document.createElement('div');
    host.style.cssText='position:fixed;left:-100000px;top:0;width:210mm;visibility:hidden;pointer-events:none;z-index:-999999;';
    host.innerHTML=`<style>${documentCss()}${memorialFontOverrideCss()}</style>${customTemplatePage(item,theme,body,kind)}`;
    document.body.appendChild(host);
    try{
      await nextPaint();
      const flow=host.querySelector('.agro-flow');
      return Boolean(flow && flow.scrollHeight > flow.clientHeight + 1);
    }finally{host.remove();}
  }

  async function buildAgroNarrativePages(item,theme,data){
    const paged=await paginateRunningWords(
      runningMemorialText(data),
      (chunk,{pageIndex,isLast})=>agroNarrativeBody(data,chunk,{first:pageIndex===0,withDate:isLast}),
      (body,{pageIndex})=>agroBodyOverflows(item,theme,body,pageIndex===0?'agro-first':'agro-continuation')
    );
    return paged.map(({body,pageIndex})=>customTemplatePage(item,theme,body,pageIndex===0?'agro-first':'agro-continuation'));
  }

  function agroSignatureGrid(data,theme){
    const emptyLabels=new Set(['nao informado','não informado','nao informada','não informada','sem informacao','sem informação','-','']);
    const confrontants=(Array.isArray(data.confrontants)?data.confrontants:[])
      .map((item)=>({name:String(item?.name||'').trim(),doc:String(item?.doc||'').trim()}))
      .filter((item)=>!emptyLabels.has(item.name.toLowerCase()) || !emptyLabels.has(item.doc.toLowerCase()))
      .slice(0,4);
    const techDetail=[theme.professionalTitle,data.registry].filter(Boolean).join(': ');
    const boxes=confrontants.map((item)=>`<div class="agro-confrontant"><div class="agro-sign-line"></div><b>${escape(item.name||'')}</b><small>${item.doc?`CPF/CNPJ: ${escape(item.doc)}`:''}</small></div>`).join('');
    const confrontantSection=confrontants.length?`<section class="agro-confrontant-section"><h3>CONFRONTANTE (S):</h3><p>Declaramos que concordamos com estas descrições e que elas representam os limites entre nossos imóveis.</p><div class="agro-confrontants agro-confrontants-${confrontants.length}">${boxes}</div></section>`:'';
    return `<div class="agro-signatures">
      <section class="agro-tech"><h3>RESPONSÁVEL TÉCNICO:</h3><div class="agro-tech-box">${theme.signatureDataUrl?`<img src="${attr(theme.signatureDataUrl)}" alt="Assinatura">`:''}<div class="agro-sign-line"></div><b>${escape(data.tech)}</b><small>${escape(techDetail||data.registry||'')}</small></div></section>
      <section><h3>${data.ownerSecondary?'PROPRIETÁRIOS:':'PROPRIETÁRIO:'}</h3><p>Declaramos que essas descrições representam este imóvel.</p><div class="agro-owner"><div class="agro-sign-line"></div><b>${escape(data.ownerPrimary||data.owner)}</b><small>${data.ownerCpfPrimary?`CPF/CNPJ: ${escape(data.ownerCpfPrimary)}`:''}${data.ownerRgPrimary?` • RG: ${escape(data.ownerRgPrimary)}`:''}</small></div>${data.ownerSecondary?`<div class="agro-owner"><div class="agro-sign-line"></div><b>${escape(data.ownerSecondary)}</b><small>${data.ownerCpfSecondary?`CPF/CNPJ: ${escape(data.ownerCpfSecondary)}`:''}${data.ownerRgSecondary?` • RG: ${escape(data.ownerRgSecondary)}`:''}</small></div>`:''}</section>
      ${confrontantSection}
    </div>`;
  }

  function customTemplateMapBody(mapVisual){
    return `<h2 class="custom-template-map-title" style="display:block;text-align:center;margin:0 0 3mm;font-size:11.5pt;line-height:1.2">MAPA DE LOCALIZAÇÃO</h2><p class="custom-template-map-note" style="text-align:center;margin:0 0 5mm;font-size:8.7pt;line-height:1.3">Planta técnica vetorial gerada a partir do projeto selecionado.</p>${memorialTechnicalMapMarkup(mapVisual,'custom-template-map')}`;
  }

  async function buildAgroExactDocument(item,theme,data,mapVisual,includeMap){
    const pages=await buildAgroNarrativePages(item,theme,data);
    if(includeMap){
      const mapBody=customTemplateMapBody(mapVisual);
      pages.push(customTemplatePage(item,theme,mapBody,'map'));
    }
    const signatureBody=`<div class="agro-flow agro-second">${agroSignatureGrid(data,theme)}</div>`;
    pages.push(customTemplatePage(item,theme,signatureBody,'agro-signatures'));
    return `<div class="custom-memorial-document agro-memorial-document" data-template-id="${escape(item.id)}">${pages.join('')}</div>`;
  }

  async function buildCustomTemplateDocument(item,theme,data,mapVisual,includeMap){
    if(String(item.layout||'')==='agroExact') return buildAgroExactDocument(item,theme,data,mapVisual,includeMap);
    if(String(item.layout||'')==='docxExact') return buildCustomDocxExactDocument(item,theme,data);
    const pageData=await paginateCustomNarrative(data);
    const pages=pageData.map((entry)=>customTemplatePage(item,theme,entry.body,entry.kind));
    if(includeMap){
      pages.push(customTemplatePage(item,theme,customTemplateMapBody(mapVisual),'map'));
    }
    const ownerSign=`<div class="custom-signature-box"><div class="custom-signature-line"></div><b>${escape(data.ownerPrimary||data.owner)}</b><small>${data.ownerCpfPrimary?`CPF/CNPJ: ${escape(data.ownerCpfPrimary)}`:''}</small></div>`;
    const secondOwnerSign=data.ownerSecondary?`<div class="custom-signature-box"><div class="custom-signature-line"></div><b>${escape(data.ownerSecondary)}</b><small>${data.ownerCpfSecondary?`CPF/CNPJ: ${escape(data.ownerCpfSecondary)}`:''}</small></div>`:'';
    const techSign=`<div class="custom-signature-box">${theme.signatureDataUrl?`<img class="custom-signature-image" src="${theme.signatureDataUrl}" alt="Assinatura do responsável técnico">`:''}<div class="custom-signature-line"></div><b>${escape(data.tech)}</b><small>${escape(theme.professionalTitle||'')} ${escape(data.registry||'')}</small></div>`;
    pages.push(customTemplatePage(item,theme,`<p class="custom-template-date">${escape(data.cityLabel||'')}, ${currentDateLong()}.</p><h2 class="custom-template-sign-heading">RESPONSÁVEL TÉCNICO E ${data.ownerSecondary?'PROPRIETÁRIOS':'PROPRIETÁRIO'}</h2><div class="custom-template-signatures"${data.ownerSecondary?' style="grid-template-columns:repeat(3,minmax(0,1fr));gap:6mm"':''}>${techSign}${ownerSign}${secondOwnerSign}</div>`,'signatures'));
    return `<div class="custom-memorial-document" data-template-id="${escape(item.id)}">${pages.join('')}</div>`;
  }


  async function generate(options={}){
    const generationId=++memorialGenerationSerial;
    memorialPdfDocumentReady=false;
    const silent=options?.silent===true;
    const livePreview=options?.reason==='live' && silent;
    if(!silent)setMemorialBusy(true);
    try{
      await boundedStep('Inicialização do tema documental',()=>window.GeoRuralDocumentTheme?.ready?.(),3500,null);
      await loadGenerationCustomization();
      const p=await selectedProject(); if(!p) throw new Error('Selecione um projeto.');
      const coords=ring(p); if(coords.length<3) throw new Error('Projeto sem perímetro válido.');
      const ss=segments(coords), feature=getPerimeter(p), title=p.propertyName||p.title||p.name||'Imóvel rural';
      const cityUf=getCityUf(p), cityLabel=[cityUf.city,cityUf.uf].filter(Boolean).join('/');
      const ownerPrimary=fieldValue('memOwnerName',p.owner||p.ownerName||'');
      const ownerCpfPrimary=fieldValue('memOwnerCpf',p.ownerCpf||p.metadata?.ownerCpf||'');
      const additionalOwner=window.GeoRuralProjects?.additionalOwner?.(p) || null;
      const ownerSecondary=String(additionalOwner?.name||'').trim();
      const ownerCpfSecondary=String(additionalOwner?.cpfCnpj||'').trim();
      const owner=window.GeoRuralProjects?.ownerNames?.(p,ownerPrimary) || ownerPrimary;
      const ownerCpf=window.GeoRuralProjects?.ownerDocuments?.(p,ownerCpfPrimary) || ownerCpfPrimary;
      const ownerRgPrimary=fieldValue('memOwnerRg',p.ownerRg||p.metadata?.ownerRg||'');
      const ownerRgSecondary=String(additionalOwner?.rg||'').trim();
      const ownerRg=window.GeoRuralProjects?.ownerRgs?.(p,ownerRgPrimary) || ownerRgPrimary;
      const documentType=fieldValue('memDocumentType','Documento');
      const reg=fieldValue('memRegistration','');
      const incra=fieldValue('memIncra','');
      const cnib=fieldValue('memCnib','');
      const comarca=fieldValue('memComarca',cityUf.city||'');
      const tech=fieldValue('memTechnician',getTheme().responsibleTechnician||'');
      const registry=getTheme().professionalRegistry||'';
      const confrontants=distinctConfrontants(p);
      loadMemorialEditSettings();
      const themeNow=effectiveMemorialTheme(getTheme()), memOpt=themeNow.options?.memorial || {};
      const select=$('memorialTemplateSelect');
      // A geração deve respeitar exatamente o modelo que o usuário está vendo/selecionou.
      // Se houver qualquer problema de autorização, interrompe com erro claro em vez de cair
      // silenciosamente no modelo padrão.
      const requestedTemplateId=selectedTemplateIdFromUi();
      if(!templateExists(requestedTemplateId)) throw new Error('O modelo selecionado não está disponível. Selecione novamente o modelo do memorial.');
      const authorized=await ensureSelectedTemplateAuthorized(requestedTemplateId);
      if(!authorized){
        const requested=window.SurveyorMemorialTemplates?.byId?.(requestedTemplateId);
        throw new Error(`O modelo ${requested?.name||requestedTemplateId} está selecionado, mas esta conta ainda não possui autorização para usá-lo.`);
      }
      currentMemorialTemplateId=requestedTemplateId;
      if(select){select.value=currentMemorialTemplateId;select.dataset.preferenceLoaded='true';}
      writeLocalTemplatePreference(currentMemorialTemplateId);
      const currentTemplate = window.SurveyorMemorialTemplates?.byId?.(currentMemorialTemplateId);
      if(!currentTemplate) throw new Error('Não foi possível carregar o modelo selecionado.');
      lastGeneratedTemplateId=currentTemplate.id;
      updateTemplateStatus(currentTemplate.id,'aplicado nesta geração');
      console.info('[Memorial] Modelo aplicado na geração:',currentTemplate.id,currentTemplate.name||'');
      const area=areaHa(p), per=perimeterMeters(coords), includeMap=memorialMapIncluded(memOpt);
      const share=includeMap && memOpt.showQr !== false
        ? await withTimeout(publicAccess(p), 15000, 'Tempo limite ao montar o link público do memorial.').catch(() => ({url:'',qr:'',error:'Tempo limite ao montar o link público do memorial.'}))
        : {url:'',qr:''};
      let svg='', png='';
      const mapRenderMode=livePreview?'live':'export';
      // Fonte da cena: a chave precisa mudar quando o projeto, seus atributos,
      // confrontantes ou personalização mudam, mesmo sem mudar o ID do imóvel.
      // Um hash evita guardar a geometria completa na chave de cache.
      const mapSourceState=JSON.stringify({
        geojson:p?.geojson || null, features:p?.features || null,
        metadata:p?.metadata || null, updatedAt:p?.updatedAt || p?.modifiedAt || '',
        visual:p?.documentVisualSettings || p?.visualSettings || null,
        theme:themeNow, registration:fieldValue('memRegistration',''),
        technician:fieldValue('memTechnician',''),
        zoom:String($('memMapZoom')?.value||15),
        background:String($('memMapBackground')?.value||'sat'),
        confrontantes:String($('memShowConfrontantes')?.value??'1'),
        renderMode:mapRenderMode
      });
      let fingerprint=2166136261;
      for(let i=0;i<mapSourceState.length;i+=1){ fingerprint=Math.imul(fingerprint^mapSourceState.charCodeAt(i),16777619); }
      const mapRenderKey=`${String(p?.id||'')}|${(fingerprint>>>0).toString(36)}|${mapSourceState.length}`;
      if(includeMap){
        if(lastMapRenderKey===mapRenderKey && lastMapSvg){
          svg=lastMapSvg;
          png=lastMapPng;
        }else{
          svg=await withTimeout(mapSvg(p,share,{livePreview}), livePreview?8000:20000, 'Tempo limite ao montar a prancha do memorial.');
          // A prévia HTML usa o SVG real; rasterizar a cada mudança atrasava fundo/zoom
          // e fazia a interface parecer dependente do botão Gerar. PNG é produzido só
          // quando a geração/exportação final realmente precisa dele.
          // Nunca anexar um PNG de outro snapshot à cena atual.
          png=livePreview?'':await withTimeout(svgToPngDataUrl(svg), 15000, 'Tempo limite ao rasterizar a prancha do memorial.');
          lastMapSvg=svg;
          lastMapPng=png;
          lastMapRenderKey=mapRenderKey;
        }
      }else{
        lastMapSvg='';
        lastMapPng='';
        lastMapRenderKey='';
        lastMapCoords=[];
      }
      const mapBlockWord=includeMap ? `<div class="croqui-preview memorial-map-preview word-map">${wordMapImg(png,'Mapa de localização do imóvel')}</div>` : '';
      const narrative=buildNarrative(p,ss), narrativeText=buildNarrativeText(p,ss);
      const closingText=`O perímetro acima descrito encerra uma área de ${num(area,4)} ha e perímetro de ${num(per,3)} m.`;
      const closing=`O perímetro acima descrito encerra uma área de <b>${num(area,4)} ha</b> e perímetro de <b>${num(per,3)} m</b>.`;
      const wordData={title, documentType, reg, incra, cnib, owner, ownerCpf, ownerRg, ownerPrimary, ownerSecondary, ownerCpfPrimary, ownerCpfSecondary, ownerRgPrimary, ownerRgSecondary, cityLabel, comarca, area, per, narrative, narrativeText, closing, closingText, tech, registry, confrontants, coordinateType:'DD (graus decimais)'};
      const wordBody=wordArticle(wordData, mapBlockWord);
      if(generationId!==memorialGenerationSerial)return false;
      const mapVisual={svg,png};
      const standardDocument=currentTemplate.id==='standard'
        ? await boundedStep('Montagem do modelo padrão',()=>buildStandardTemplateDocument(themeNow,wordData,mapVisual,includeMap),16000)
        : '';
      const customDocument=currentTemplate.id!=='standard'
        ? await boundedStep('Montagem do modelo personalizado',()=>buildCustomTemplateDocument(currentTemplate,themeNow,wordData,mapVisual,includeMap),22000)
        : '';
      if(generationId!==memorialGenerationSerial)return false;
      const fontStyle=`<style data-memorial-edit-font>${memorialFontOverrideCss()}</style>`;
      lastMemorialHtml=(currentTemplate.id==='standard' ? standardDocument : customDocument)+fontStyle;
      lastWordHtml=wordBody+fontStyle;
      lastPdfHtml=(currentTemplate.id==='standard' ? standardDocument : customDocument)+fontStyle;
      const textMapSection=includeMap?`

3. MAPA DE LOCALIZAÇÃO
A planta do imóvel rural acompanha a versão HTML/Word deste memorial.
${share?.url?`Link público: ${share.url}
`:''}`:'';
      const ownerTextIdentity=ownerIdentityRows(wordData).map(({label,values})=>
        values.length?`${label} ${values.join('\n')}`:''
      ).filter(Boolean);
      const textIdentity=[
        ['PROPRIEDADE',title],['DOCUMENTO',[optionalIdentityValue(documentType),optionalIdentityValue(reg)].filter(Boolean).join(' — ')],
        ['CÓDIGO INCRA',incra],['Número CIB',cnib]
      ].map(([label,value])=>[label,optionalIdentityValue(value)]).filter(([,value])=>value).map(([label,value])=>`${label}: ${value}`)
        .concat(ownerTextIdentity)
        .concat([['CIDADE',cityLabel],['COMARCA',comarca],['ÁREA',`${num(area,4)} ha`],['PERÍMETRO',`${num(per,3)} m`]]
          .map(([label,value])=>[label,optionalIdentityValue(value)]).filter(([,value])=>value).map(([label,value])=>`${label}: ${value}`)).join('\n');
      lastText=`MEMORIAL DESCRITIVO

${textIdentity}

DESCRIÇÃO
${narrativeText}
${closingText}${textMapSection}

${cityLabel}, ${currentDateLong()}.

${[ownerPrimary,ownerSecondary].filter(Boolean).join('\n')}
${ownerIdentityRows(wordData).find(({label})=>label==='CPF/CNPJ:')?.values.map((value)=>`CPF/CNPJ: ${value}`).join('\n')||''}

${tech}${registry?`
${registry}`:''}`;
      lastTemplateData={
        LOGO_EMPRESA: themeNow.companyName || 'Surveyor',
        LOGO_empresa: themeNow.companyName || 'Surveyor',
        LOGO_EMPRESA_DATA_URL: themeNow.logoDataUrl || '',
        TELEFONE_EMPRESA: themeNow.phoneNumber || '',
        WHATSAPP_EMPRESA: themeNow.whatsappNumber || '',
        EMAIL_EMPRESA: themeNow.emailAddress || '',
        SITE_EMPRESA: themeNow.websiteUrl || '',
        ENDERECO_EMPRESA: themeNow.addressText || '',
        NUMERO_EMPRESA: themeNow.addressNumber || '',
        contato_empresa_whatsapp: themeNow.whatsappNumber || '',
        contato_empresa_ligação: themeNow.phoneNumber || '',
        'contato_empresa_e-mail': themeNow.emailAddress || '',
        endereço_empresa: [themeNow.addressText, themeNow.addressNumber].filter(Boolean).join(', '),
        NOME_PROPRIEDADE: title,
        NOME_IMOVEL: title,
        TIPO_COORDENADA: 'DD (graus decimais)',
        SISTEMA_COORDENADAS: 'SIRGAS 2000',
        TIPO_DOCUMENTO: documentType,
        NOME: [ownerPrimary,ownerSecondary].filter(Boolean).join('\n'),
        NOME_PROPRIETARIO: ownerPrimary,
        NOME_PROPRIETARIO_2: ownerSecondary,
        CPF_CNPJ: ownerCpfPrimary,
        CPF: ownerCpfPrimary,
        CPF_proprietario: ownerCpfPrimary,
        CPF_PROPRIETARIO_2: ownerCpfSecondary,
        CODIGO_INCRA: incra,
        'código_incra': incra,
        NUMERO_CIB: cnib,
        CIB: cnib,
        NUMERO_CNIB: cnib,
        CNIB: cnib,
        MATRICULA: reg,
        MUNICIPIO: cityUf.city || cityLabel || '',
        CIDADE: cityUf.city || cityLabel || '',
        COMARCA: comarca,
        AREA_HECTARES: num(area,4),
        AREA: num(area,4),
        PERIMETRO_METROS: num(per,3),
        'perímetro': num(per,3),
        DESCRICAO_PERIMETRO: `${narrativeText} ${closingText}`,
        DESCRIÇÃO: `${narrativeText} ${closingText}`,
        DATA_EXTENSO: currentDateLong(),
        cidade_assinatura: cityUf.city || cityLabel || '',
        data_assinatura: currentDateLong(),
        ASSINATURA_RESPONSAVEL_TECNICO: '',
        NOME_RESPONSAVEL_TECNICO: tech,
        responsavel_tecnico: tech,
        TITULO_PROFISSIONAL: themeNow.professionalTitle || '',
        REGISTRO_PROFISSIONAL: registry || '',
        cfta: registry || '',
        ASSINATURA_PROPRIETARIO: '',
        RG_PROPRIETARIO: ownerRgPrimary,
        RG_proprietario: ownerRgPrimary,
        RG_PROPRIETARIO_2: ownerRgSecondary,
        CONFRONTANTE_1_NOME: confrontants[0]?.name || '', CONFRONTANTE_1_DOC: confrontants[0]?.doc || '',
        CONFRONTANTE_2_NOME: confrontants[1]?.name || '', CONFRONTANTE_2_DOC: confrontants[1]?.doc || '',
        CONFRONTANTE_3_NOME: confrontants[2]?.name || '', CONFRONTANTE_3_DOC: confrontants[2]?.doc || '',
        CONFRONTANTE_4_NOME: confrontants[3]?.name || '', CONFRONTANTE_4_DOC: confrontants[3]?.doc || ''
      };
      $('memorialOutput').dataset.memorialTemplate=currentTemplate.id==='standard'?'standard':'custom';
      $('memorialOutput').style.setProperty('--memorial-template-color',currentTemplate.color||'#145edb');
      revokePdfPreviewUrl();
      renderLiveMemorialPreview();
      memorialPendingEdits=false;
      memorialPdfDocumentReady=!livePreview;
      const standardMessage=includeMap
        ? (share?.qr?'Memorial gerado com descrição dinâmica, mapa e QR Code.':'Memorial gerado com descrição dinâmica e mapa.')
        : 'Memorial gerado com descrição dinâmica, sem mapa de localização.';
      if(!silent)toast(currentTemplate.id==='standard' ? standardMessage : 'Memorial personalizado gerado conforme o modelo selecionado.','success');
      return true;
    }catch(error){
      console.error('[Memorial] Falha ao gerar memorial:',error);
      if(!silent)previewError(error);
      if(!silent)toast(error?.message||'Não foi possível gerar o memorial.','error');
      if(options?.batch === true) throw error;
    }finally{
      if(!silent)setMemorialBusy(false);
      try{window.dispatchEvent(new CustomEvent('surveyor:document-generation-finished',{detail:{page:'memorial.html'}}));}catch(_error){}
    }
  }

  function fullDoc(forWord=false, forPdf=false){
    const html=forWord?lastWordHtml:(forPdf?lastPdfHtml:lastMemorialHtml);
    const head=forWord
      ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="pt-BR">`
      : `<html lang="pt-BR">`;
    const headerFooter='';
    const bodyClass = forWord ? 'memorial-word-body' : (forPdf ? 'memorial-pdf-body' : 'memorial-html-body');
    const baseHref=escape((location.origin || '') + '/');
    return `<!doctype html>${head}<head><meta charset="utf-8"><base href="${baseHref}"><meta name="ProgId" content="Word.Document"><meta name="Generator" content="Surveyor"><title>Memorial descritivo</title><style>${documentCss()}${forWord?wordDocumentCss():''}</style></head><body class="${bodyClass}">${headerFooter}<div class="Section1">${html}</div></body></html>`;
  }
  function wordDocumentCss(){return `.memorial-word-body .memorial-profissional{max-width:17.2cm!important;margin:0 auto!important;padding:0!important;background:#fff!important}.word-company-header-table{width:17.2cm;margin:0 auto 12px;border-collapse:collapse;table-layout:fixed;border-bottom:2px solid #111827;mso-table-lspace:0pt;mso-table-rspace:0pt}.word-company-header-table td{border:0;padding:0 0 8px 0;vertical-align:middle}.word-company-logo-cell{width:3.3cm;text-align:left}.word-company-logo-cell img{width:92px!important;max-width:92px!important;height:auto!important;max-height:56px!important;display:block!important}.word-logo-placeholder{display:inline-block;width:90px;height:45px;line-height:45px;text-align:center;border:1px dashed #94a3b8;color:#64748b;font-size:8pt}.word-company-data-cell{text-align:right;font-size:8.5pt;color:#475569;line-height:1.2}.word-company-data-cell strong{display:block;color:#111827;font-size:13pt;line-height:1.25;margin-bottom:2px}.word-company-data-cell span{display:block}.word-ident-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6px 0 16px;mso-table-lspace:0pt;mso-table-rspace:0pt}.word-ident-table td{width:50%;border:0;padding:8px 10px;vertical-align:top;font-size:10.5pt;line-height:1.5;background:#fff}.word-map-section{page-break-inside:avoid!important;margin-top:0!important;padding-top:0!important}.word-map-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:8px 0 16px;mso-table-lspace:0pt;mso-table-rspace:0pt;page-break-inside:avoid}.word-map-table td{border:1px solid #94a3b8;padding:6px;text-align:center;vertical-align:middle;background:#f8fafc}.word-map-table .croqui-preview{border:0!important;padding:0!important;margin:0!important;background:#fff!important}.word-map-table img{width:15.8cm!important;max-width:15.8cm!important;height:auto!important;display:block!important;margin:0 auto!important;border:0!important}.word-signatures-table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:34px;mso-table-lspace:0pt;mso-table-rspace:0pt}.word-signatures-table td{width:50%;border:0;text-align:center;vertical-align:top;padding:0 18px}.word-sign-line{height:1px;border-top:1px solid #111827;margin:0 0 7px}.word-signatures-table b,.word-signatures-table small{display:block}.word-company-footer-table{width:17.2cm;margin:22px auto 0;border-collapse:collapse;table-layout:fixed;border-top:1px solid #cbd5e1;mso-table-lspace:0pt;mso-table-rspace:0pt}.word-company-footer-table td{border:0;padding-top:7px;text-align:center;color:#64748b;font-size:8.5pt;vertical-align:middle}.word-company-footer-table img{width:34px!important;max-width:34px!important;height:auto!important;max-height:22px!important;vertical-align:middle!important;margin-right:6px!important}.word-footer-logo{display:inline-block;vertical-align:middle}.word-footer-text{vertical-align:middle}.memorial-word-template h2{font-size:13pt;margin:16px 0 8px;border-bottom:1px solid #94a3b8;padding-bottom:4px}.memorial-word-template .memorial-title{margin-top:18px!important}`;}

  function documentCss(){return `@page Section1{size:21cm 29.7cm;margin:1.75cm 1.75cm 1.75cm 1.75cm;mso-header-margin:.8cm;mso-footer-margin:.7cm}div.Section1{page:Section1}#memorialWordHeader{mso-element:header}#memorialWordFooter{mso-element:footer}body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0;padding:0;line-height:1.45;font-size:11pt}.memorial-html-body{background:#f1f5f9;padding:20px}.memorial-pdf-body,.memorial-word-body{background:#fff;padding:0}.memorial-profissional{max-width:760px;margin:0 auto;background:#fff;padding:18px 30px;border:0;box-sizing:border-box}.memorial-company-header{display:table;width:100%;border-bottom:2px solid #111827;padding-bottom:8px;margin:0 auto 14px;table-layout:fixed;max-width:760px;background:#fff}.memorial-company-logo{display:table-cell;width:132px;vertical-align:middle;text-align:left}.memorial-company-logo img{width:96px!important;max-width:96px!important;height:auto!important;max-height:52px!important;object-fit:contain!important;display:block!important}.memorial-logo-placeholder{width:96px;height:50px;border:1px dashed #94a3b8;display:table-cell;text-align:center;vertical-align:middle;color:#64748b;font-size:10pt}.memorial-company-data{display:table-cell;vertical-align:middle;text-align:right}.memorial-company-data strong{font-size:14pt;display:block;margin-bottom:2px}.memorial-company-data span{font-size:8.5pt;color:#475569;display:block;line-height:1.22}.memorial-title{text-align:center;font-size:17pt;letter-spacing:.04em;margin:20px 0 16px}.memorial-ident{display:table;width:100%;border:1px solid transparent;margin:8px 0 20px;border-collapse:collapse;table-layout:fixed;background:#f8fafc}.memorial-ident>div{display:table-cell;width:50%;padding:10px 12px;line-height:1.56;vertical-align:top;font-size:10.5pt;border:1px solid transparent}.memorial-ident>div+div{border-left:1px solid transparent}.memorial-ident b{letter-spacing:.01em}.memorial-profissional h2{font-size:13pt;margin:16px 0 8px;border-bottom:1px solid #94a3b8;padding-bottom:4px}.memorial-paragraph{text-align:justify;margin:0 0 6px;font-size:10.5pt;line-height:1.38}.memorial-description{margin-bottom:10px}.memorial-map-section{page-break-before:always;page-break-inside:avoid;margin-top:0;padding-top:0}.memorial-map-note{font-size:9pt;color:#475569;margin:0 0 10px}.croqui-preview{background:#fff;padding:0;text-align:center;border:0}.croqui-preview svg{max-width:100%;height:auto;background:#fff}.croqui-preview img{width:680px!important;max-width:100%!important;height:auto!important;background:#fff;display:block;margin:0 auto;border:1px solid #94a3b8}.memorial-map-fallback{border:1px dashed #94a3b8;padding:24px;text-align:center;color:#475569;background:#f8fafc}.memorial-date{margin:24px 0 18px;text-align:left}.memorial-signatures{display:table;width:100%;table-layout:fixed;margin-top:42px}.memorial-signatures div{display:table-cell;width:50%;text-align:center;padding:0 18px;vertical-align:top}.memorial-signatures span{display:block;border-top:1px solid #111827;margin-bottom:7px}.memorial-signatures b,.memorial-signatures small{display:block}.memorial-company-footer{margin:16px auto 0;padding-top:8px;border-top:1px solid #cbd5e1;text-align:center;color:#64748b;font-size:8.5pt;max-width:760px;background:#fff}.memorial-company-footer img{width:46px!important;max-width:46px!important;height:auto!important;max-height:24px!important;object-fit:contain!important;display:inline-block!important;vertical-align:middle;margin-right:8px}.memorial-company-footer span{vertical-align:middle}.memorial-pdf-export{width:190mm;margin:0 auto;background:#fff;color:#111827}.memorial-pdf-export .memorial-company-header{margin-bottom:8px}.memorial-pdf-export .memorial-profissional{border:0;box-shadow:none;padding:10px 22px}.memorial-pdf-export .memorial-ident{border-color:transparent!important}.memorial-pdf-export .memorial-ident>div{border-color:transparent!important}.memorial-pdf-export .memorial-map-section{page-break-before:always}.custom-memorial-document{display:block;width:210mm;margin:0;padding:0;background:#fff}.custom-memorial-page{position:relative;width:210mm;height:297mm;min-height:297mm;max-height:297mm;margin:0;background:#fff;overflow:hidden;box-sizing:border-box;page-break-after:always;box-shadow:none;font-family:Arial,Helvetica,sans-serif;color:#111}.custom-memorial-page:last-child{page-break-after:auto}.custom-template-header-art{position:absolute;left:0;top:0;width:210mm;height:var(--custom-header-height,34.7mm);object-fit:fill;z-index:0}.custom-template-footer-art{position:absolute;left:0;bottom:0;width:210mm;height:var(--custom-footer-height,38mm);object-fit:fill;z-index:0}.custom-template-logo-slot{position:absolute;left:50%;top:7.2mm;transform:translateX(-50%);width:52mm;height:20mm;display:flex;align-items:center;justify-content:center;z-index:3;text-align:center;overflow:visible;box-sizing:border-box}.custom-template-logo{display:block;max-width:46mm;max-height:18mm;width:auto;height:auto;object-fit:contain;object-position:center center;clip-path:none}.custom-template-company-name{font-size:11pt}.custom-template-page-body{position:relative;z-index:2;width:100%;height:297mm;min-height:0;max-height:297mm;padding:38mm 18mm 35mm;box-sizing:border-box;overflow:hidden;background:transparent}.custom-template-contact{position:absolute;z-index:3;left:17mm;right:17mm;bottom:8.2mm;text-align:center;font-size:7.2pt;line-height:1.15;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.custom-template-contact.exact-footer{left:26mm;right:26mm;bottom:10.5mm;white-space:normal;line-height:1.1;font-size:7pt;color:#334155}.custom-template-contact.exact-footer div{margin:0.6mm 0}.custom-template-title{text-align:center;font-size:15pt;line-height:1.15;margin:0 0 6mm}.custom-template-ident{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin:0 0 5mm;font-size:8.4pt;line-height:1.35}.custom-template-section-title,.custom-template-map-title,.custom-template-sign-heading{text-align:center;font-size:11.5pt;line-height:1.2;margin:3mm 0 4mm}.custom-template-continuation{display:none!important}.custom-template-section-title-continuation{margin-top:10mm}.custom-template-description{width:100%;overflow:hidden}.custom-template-description .memorial-paragraph{font-size:8.45pt;line-height:1.3;margin:0 0 1.7mm;text-align:justify;overflow-wrap:anywhere;word-break:normal}.custom-template-closing{font-size:8.45pt;line-height:1.3;text-align:justify;margin:2.4mm 0 0}.custom-memorial-page-map .custom-template-page-body{padding-top:45mm}.custom-memorial-page-map .custom-template-map-title{margin-top:0;position:relative}.custom-template-map-note{text-align:center;font-size:8.7pt;color:#475569;margin:0 0 3mm}.custom-template-map{display:block;width:auto;max-width:168mm;max-height:196mm;margin:3mm auto 0;object-fit:contain;border:1px solid #94a3b8}.custom-template-map.memorial-technical-map-vector{width:168mm;height:150mm;max-width:100%;box-sizing:border-box;overflow:hidden;background:#fff}.memorial-technical-map-vector>svg{display:block;width:100%;height:100%;max-width:none;max-height:none;margin:0;background:#fff}.custom-template-date{margin:16mm 0 10mm;text-align:center;font-size:10pt}.custom-template-signatures{display:grid;grid-template-columns:1fr 1fr;gap:15mm;margin-top:15mm}.custom-signature-box{text-align:center;min-height:34mm;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.custom-signature-image{max-width:54mm;max-height:19mm;object-fit:contain;margin-bottom:-1mm}.custom-signature-line{width:100%;border-top:1px solid #111;margin-bottom:2mm}.custom-signature-box b{font-size:9.6pt}.custom-signature-box small{font-size:7.8pt;margin-top:1mm}.custom-docx-exact-flow{position:absolute;z-index:2;left:30mm;right:30mm;top:31mm;bottom:42mm;box-sizing:border-box;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#111}.custom-docx-ident{display:grid;grid-template-columns:1fr 1fr;column-gap:14mm;font-size:8.3pt;line-height:1.33}.custom-docx-ident-left,.custom-docx-ident-right{min-width:0}.custom-docx-ident-right{padding-top:5.2mm}.custom-docx-perimeter{margin-top:20.2mm}.custom-docx-description-title{text-align:center;font-size:11.4pt;line-height:1.15;margin:13.5mm 0 8mm;font-weight:700}.custom-docx-description-title-continuation{margin:10mm 0 8mm}.custom-docx-description{font-size:8.2pt;line-height:1.3;text-align:justify}.custom-docx-description .memorial-paragraph{font-size:8.2pt;line-height:1.3;margin:0 0 2.4mm;text-align:justify;overflow-wrap:anywhere}.custom-docx-closing{font-size:8.2pt;line-height:1.3;margin:2.5mm 0 0;text-align:justify}.custom-docx-date{text-align:right;font-size:8.2pt;margin:5mm 0 10.5mm}.custom-docx-tech-block{text-align:center}.custom-docx-tech-block h3,.custom-docx-owner-block h3{font-size:8.8pt;line-height:1.2;font-weight:400;margin:0 0 11mm}.custom-docx-tech-signature{width:60mm;margin:0 auto;text-align:center;min-height:23mm}.custom-docx-tech-signature-image{display:block;max-width:48mm;max-height:15mm;width:auto;height:auto;object-fit:contain;margin:0 auto -0.8mm}.custom-docx-sign-line{border-top:1px solid #111;width:100%;margin:0 auto 1.4mm}.custom-docx-tech-signature b,.custom-docx-owner-signature b{display:block;font-size:8.2pt;line-height:1.15}.custom-docx-tech-signature small,.custom-docx-owner-signature small{display:block;font-size:6.7pt;line-height:1.15;margin-top:.6mm}.custom-docx-owner-block{text-align:center;margin-top:7mm}.custom-docx-owner-block h3{margin-bottom:2mm}.custom-docx-owner-block>p{font-size:8.4pt;line-height:1.2;margin:0 0 12mm}.custom-docx-owner-signature{width:48mm;text-align:center;margin-left:6mm}.custom-docx-final-page{padding-top:35mm}.agro-flow{position:absolute;z-index:2;left:18mm;right:18mm;top:31mm;bottom:41mm;overflow:hidden;color:#111;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}.agro-ident{font-size:9.3pt;line-height:1.35;font-weight:400}.agro-ident-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.95fr);column-gap:12mm;row-gap:1.1mm;align-items:start}.agro-ident-column{min-width:0}.agro-ident-column>div{margin:0 0 .7mm}.agro-ident-column-right{padding-top:.15mm}.agro-first h2{text-align:center;font-size:12.5pt;margin:6mm 0 5mm}.agro-description{width:100%}.agro-continuation{top:31mm;bottom:41mm}.agro-date{text-align:center;font-size:9pt;margin-top:5mm;break-inside:avoid}.agro-second{top:35mm;bottom:41mm}.agro-signatures h3{font-size:9pt;font-weight:400;margin:0 0 8mm}.agro-signatures p{font-size:9pt;margin:0 0 12mm}.agro-tech{text-align:center;margin-bottom:10mm}.agro-tech-box{width:55mm;margin:0 auto;text-align:center}.agro-tech-box img{max-width:45mm;max-height:14mm;object-fit:contain}.agro-sign-line{border-top:1px solid #111;margin-bottom:1.5mm}.agro-tech-box b,.agro-owner b,.agro-confrontant b{display:block;font-size:8.6pt}.agro-tech-box small,.agro-owner small,.agro-confrontant small{display:block;font-size:7.8pt;margin-top:.7mm}.agro-owner{width:80mm;margin:0 0 13mm 2mm}.agro-confrontants{display:grid;grid-template-columns:1fr 1fr;gap:25mm 7mm;margin:26mm 2mm 0}.agro-confrontants-1{grid-template-columns:1fr;max-width:80mm}.agro-confrontants-3 .agro-confrontant:last-child{grid-column:1/-1;max-width:80mm}.agro-confrontant{min-height:26mm}.agro-description .memorial-running-text{font-size:8.8pt;line-height:1.34}${runningMemorialDescriptionCss()}.custom-template-contact.exact-footer{left:24mm;right:24mm;bottom:8.8mm;white-space:normal;line-height:1.08;font-size:8.7pt;color:#111;overflow:visible;text-overflow:clip}.custom-footer-line{display:flex;align-items:center;justify-content:center;min-height:3.7mm;margin:.15mm 0}.custom-footer-line-phones{gap:4.2mm}.custom-footer-item{display:inline-flex;align-items:center;justify-content:center;gap:1.1mm;vertical-align:middle;white-space:nowrap}.custom-footer-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;font-family:Arial,Helvetica,sans-serif;font-weight:700;line-height:1}.custom-footer-icon-whatsapp{width:3.7mm;height:3.7mm;border-radius:50%;background:#25d366;color:#fff;font-size:6.2pt}.custom-footer-icon-phone{color:#111;font-size:10pt;transform:rotate(-12deg)}.custom-footer-icon-email{color:#475569;font-size:9.4pt}.custom-footer-icon-location{color:#e11d2e;font-size:8.5pt;position:relative}.custom-footer-icon-location:after{content:"";position:absolute;left:50%;bottom:-.9mm;transform:translateX(-50%);border-left:.8mm solid transparent;border-right:.8mm solid transparent;border-top:1.4mm solid #e11d2e}.custom-template-logo-slot{top:7.5mm;width:48mm;height:17mm}.custom-template-logo{max-width:40mm;max-height:15mm}.memorial-page-number{position:absolute;z-index:6;right:12mm;bottom:3.8mm;font-size:7pt;line-height:1;color:#111;font-family:Arial,Helvetica,sans-serif}.memorial-pdf-body .custom-memorial-document{padding:0;background:#fff;gap:0}.memorial-pdf-body .custom-memorial-page{box-shadow:none;margin:0}.memorial-html-body .custom-memorial-page{transform-origin:top center}@media print{@page{size:A4;margin:0}body{background:#fff!important;padding:0!important}.memorial-profissional{border:0!important;max-width:none}.memorial-ident,.memorial-ident>div{border-color:transparent!important}.croqui-preview{background:#fff!important;padding:0!important}.custom-memorial-document{display:block!important;padding:0!important;background:#fff!important}.custom-memorial-page{width:210mm!important;height:297mm!important;min-height:297mm!important;max-height:297mm!important;margin:0!important;box-shadow:none!important;overflow:hidden!important}}`;}


  async function syncProjectFields(){
    const p=await selectedProject().catch(()=>null); if(!p)return;
    const metadata=p.metadata&&typeof p.metadata==='object'?p.metadata:{};
    const profile=metadata.documentProfile&&typeof metadata.documentProfile==='object'?metadata.documentProfile:{};
    const cityUf=getCityUf(p);
    const values={
      memOwnerName:profile.ownerName||p.owner||p.ownerName||'',
      memOwnerCpf:profile.ownerCpf||p.ownerCpf||metadata.ownerCpf||'',
      memOwnerRg:profile.ownerRg||p.ownerRg||metadata.ownerRg||'',
      memRegistration:profile.registration||p.registrationNumber||metadata.registration||'',
      memIncra:profile.incra||metadata.incra||metadata.codigoIncra||'',
      memCnib:profile.cnib||metadata.cnib||metadata.cib||metadata.numeroCib||'',
      memComarca:profile.district||metadata.comarca||cityUf.city||'',
      memDocumentType:profile.documentType||''
    };
    Object.entries(values).forEach(([id,value])=>{
      const control=$(id);if(!control||value==null||String(value).trim()==='')return;
      if(control.tagName==='SELECT'){const option=Array.from(control.options||[]).find((item)=>String(item.value)===String(value)||String(item.textContent||'').trim()===String(value).trim());if(option)control.value=option.value;}
      else control.value=String(value);
      if (!window.SurveyorBatchDocumentContext?.active) control.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }
  async function loadMemorialTemplatePreference(){
    const select=$('memorialTemplateSelect'); if(!select)return;
    const generateButton=$('generateMemorial');
    if(generateButton){ generateButton.disabled=true; generateButton.dataset.waitingTemplate='true'; }
    const templateApi=window.SurveyorMemorialTemplates;
    let items=templateApi?.itemsForCustomization?templateApi.itemsForCustomization({}):(templateApi?.items||[]);
    select.innerHTML=items.map(item=>`<option value="${item.id}">${item.name}</option>`).join('');
    const immediate=readLocalTemplatePreference();
    currentMemorialTemplateId=templateExists(immediate.id)?immediate.id:'standard';
    updateTemplateStatus(currentMemorialTemplateId,'carregando da Personalização');
    try{
      if(auth?.getDocumentCustomization){
        loadedCustomization=await auth.getDocumentCustomization({forceRefresh:true,noCache:true})||{};
        items=templateApi?.itemsForCustomization?templateApi.itemsForCustomization(loadedCustomization):(templateApi?.items||[]);
        select.innerHTML=items.map(item=>`<option value="${item.id}">${item.name}</option>`).join('');

        // Resolve em uma única fonte de verdade. A preferência explícita feita pelo usuário
        // neste navegador tem prioridade; a preferência da conta serve para recuperar a
        // escolha em outro dispositivo. Não sobrescrever Agro+ por "standard" durante o load.
        const resolved=preferenceApi()?.resolve?.(loadedCustomization)||{id:'standard',source:'default'};
        const optionExists=Array.from(select.options||[]).some((option)=>option.value===resolved.id);
        if(optionExists && validTemplateId(resolved.id)){
          currentMemorialTemplateId=resolved.id;
        }else{
          const immediateOption=Array.from(select.options||[]).some((option)=>option.value===immediate.id);
          currentMemorialTemplateId=(immediateOption && validTemplateId(immediate.id))?immediate.id:'standard';
        }
      }
    }catch(error){
      console.warn('[Memorial] Personalização da conta indisponível; usando a preferência local como contingência.',error);
    }
    const finalOptionExists=Array.from(select.options||[]).some((option)=>option.value===currentMemorialTemplateId);
    if(!finalOptionExists) currentMemorialTemplateId='standard';
    select.value=currentMemorialTemplateId;
    select.dataset.preferenceLoaded='true';
    const includeMapControl=$('memIncludeMap');
    if(includeMapControl&&!includeMapControl.dataset.defaultApplied){includeMapControl.value='1';includeMapControl.dataset.defaultApplied='1';}
    updateTemplateStatus(currentMemorialTemplateId,'definido em Personalização');
    updateTemplateSpecificFields();
    if(generateButton){ generateButton.disabled=false; delete generateButton.dataset.waitingTemplate; }
  }

  function updateTemplateSpecificFields(){
    const isAgro=String($('memorialTemplateSelect')?.value||currentMemorialTemplateId)==='agro-mais';
    const rgField=$('memOwnerRgField'); if(rgField) rgField.hidden=!isAgro;
  }

  async function resolveMemorialSignature({forceRefresh=false}={}){
    if(window.SurveyorDocumentAssets?.resolveSignatureDataUrl){
      try{return String(await window.SurveyorDocumentAssets.resolveSignatureDataUrl({forceRefresh})||'').trim();}catch(_error){}
    }
    try{
      const custom=auth?.getDocumentCustomization?await auth.getDocumentCustomization({forceRefresh,noCache:forceRefresh}):loadedCustomization;
      return String(custom?.planDocumentSignatureDataUrl||window.GeoRuralDocumentTheme?.getSignature?.()||'').trim();
    }catch(_error){return String(window.GeoRuralDocumentTheme?.getSignature?.()||'').trim();}
  }

  function bindMemorialPersonalizationProxy(proxy,source){
    if(!proxy||!source)return;
    proxy.removeAttribute('id');
    const sync=()=>{const type=String(source.type||'').toLowerCase();if(type==='checkbox'||type==='radio')proxy.checked=Boolean(source.checked);else proxy.value=source.value??'';proxy.disabled=Boolean(source.disabled);};
    const push=(event)=>{const type=String(source.type||'').toLowerCase();if(type==='checkbox'||type==='radio')source.checked=Boolean(proxy.checked);else source.value=proxy.value;source.dispatchEvent(new Event(event.type==='input'?'input':'change',{bubbles:true}));};
    sync();proxy.addEventListener('input',push);proxy.addEventListener('change',push);source.addEventListener('input',sync);source.addEventListener('change',sync);
  }
  function memorialSourceLabel(selector,text){
    const source=document.querySelector(selector); if(!source) return null;
    const type=String(source.type||'').toLowerCase();
    const label=document.createElement('label');
    label.textContent=text;
    let proxy;
    if(type==='select-one' || source.tagName==='SELECT') proxy=source.cloneNode(true);
    else if(type==='checkbox'){
      const wrap=document.createElement('label');
      wrap.className='memorial-signature-toggle';
      proxy=source.cloneNode(true);
      const span=document.createElement('span'); span.textContent=text;
      wrap.append(proxy,span);
      bindMemorialPersonalizationProxy(proxy,source);
      return wrap;
    }else proxy=source.cloneNode(true);
    bindMemorialPersonalizationProxy(proxy,source);
    label.appendChild(proxy);
    return label;
  }
  function populateMemorialSourceHost(host,tool){
    const groups={
      memorial:[['#memorialTemplateSelect','Modelo do memorial'],['#memTechnician','Responsável técnico']],
      map:[['#memMapZoom','Zoom do mapa'],['#memMapBackground','Mapa de fundo'],['#memShowConfrontantes','Confrontantes no mapa'],['#memIncludeMap','Mapa no final do memorial']]
    };
    const selectors=groups[tool]||[];
    const grid=document.createElement('div');
    grid.className='sv-doc-fields';
    let appended=0;
    selectors.forEach(([selector,text])=>{ const node=memorialSourceLabel(selector,text); if(node){grid.appendChild(node); appended+=1;} });
    if(appended){host.appendChild(grid); return true;}
    return false;
  }
  function detectMemorialPageIndex(tool){
    const pages=Array.isArray(memorialSigner.pages)?memorialSigner.pages:[];
    if(!pages.length) return 0;
    if(tool==='map'){
      const index=pages.findIndex((page)=>/MAPA DE LOCALIZAÇÃO|custom-template-map|standard-template-map-title|word-map-section|memorial-map-preview/i.test(String(page||'')));
      return index>=0?index:0;
    }
    if(tool==='signature') return Math.max(0,Math.min(pages.length-1,Number(memorialEditSettings.signaturePageIndex ?? 0)||0));
    return 0;
  }
  function activateMemorialPersonalizationTool(modal,tool='memorial'){
    if(!modal)return;
    modal.dataset.activePersonalizationTool=tool;
    modal.querySelectorAll('[data-memorial-personalization-tool]').forEach((item)=>item.classList.toggle('active',item.dataset.memorialPersonalizationTool===tool));
    modal.querySelectorAll('[data-memorial-personalization-panel]').forEach((panel)=>{const active=panel.dataset.memorialPersonalizationPanel===tool;panel.hidden=!active;panel.classList.toggle('active',active);if(active)panel.scrollTop=0;});
    const live=modal.querySelector('[data-memorial-live-workspace]');
    const signatureWorkspace=modal.querySelector('[data-memorial-signature-workspace]');
    const signatureMode=tool==='signature';
    if(live)live.hidden=signatureMode;
    if(signatureWorkspace)signatureWorkspace.hidden=!signatureMode;
    // Outras abas não devem sobrescrever a página da assinatura escolhida.
    if(signatureMode){
      memorialSigner.pageIndex=detectMemorialPageIndex('signature');
      syncMemorialSignerPages({preserveIndex:true});
      renderMemorialSignaturePages({force:true});
      updateSignerUi();
      requestAnimationFrame(()=>currentMemorialSignaturePage()?.scrollIntoView?.({block:'center',inline:'nearest'}));
      return;
    }
    renderMemorialPersonalizationPreview(modal);
    if(tool==='map'&&live){
      requestAnimationFrame(()=>{
        const mapPage=live.querySelector('.custom-memorial-page-map,.standard-memorial-page-map-signatures,.word-map-section,.memorial-map-preview');
        if(mapPage)live.scrollTop=Math.max(0,mapPage.offsetTop-10);
        else live.scrollTop=0;
      });
    }else if(live)live.scrollTop=0;
  }
  function mountMemorialPersonalizationSources(modal){
    if(!modal)return;
    ['memorial','map'].forEach((tool)=>{
      const source=document.querySelector(`[data-beta-source="${tool}"]`),host=modal.querySelector(`[data-memorial-source-host="${tool}"]`);
      if(!host)return;
      host.replaceChildren();
      if(source){
        const clone=source.cloneNode(true);clone.classList.remove('sv-beta-source-controls');clone.removeAttribute('data-beta-source');clone.removeAttribute('data-beta-source-title');clone.querySelectorAll('[for]').forEach((label)=>label.removeAttribute('for'));
        const sourceControls=Array.from(source.querySelectorAll('input,select,textarea')),proxyControls=Array.from(clone.querySelectorAll('input,select,textarea'));
        proxyControls.forEach((proxy,index)=>bindMemorialPersonalizationProxy(proxy,sourceControls[index]));
        while(clone.firstChild)host.appendChild(clone.firstChild);
      }
      const hasControls=Boolean(host.querySelector('input,select,textarea'));
      if(!hasControls) populateMemorialSourceHost(host,tool);
    });
    if(modal.dataset.personalizationTabsBound!=='1'){
      modal.querySelectorAll('[data-memorial-personalization-tool]').forEach((button)=>button.addEventListener('click',()=>activateMemorialPersonalizationTool(modal,button.dataset.memorialPersonalizationTool||'memorial')));
      modal.dataset.personalizationTabsBound='1';
    }
  }

  async function openMemorialEditDialog({inlineMount=null}={}){
    loadMemorialEditSettings();
    const ensuredModal=ensureMemorialEditorModal();
    mountMemorialPersonalizationSources(ensuredModal);
    if(!lastMemorialHtml){
      if(!$('projectSelect')?.value) return toast('Selecione um projeto antes de editar o memorial.','error');
      try{ await generate(); }catch(_error){ return; }
    }
    memorialSigner.signatureDataUrl=await resolveMemorialSignature({forceRefresh:true});
    memorialSigner.importedSignatureAsset=await readMemorialImportedSignature();
    if(memorialEditSettings.importedSignatureEnabled&&!memorialSigner.importedSignatureAsset)memorialEditSettings.importedSignatureEnabled=false;
    memorialSigner.pageIndex=Math.max(0,Number(memorialEditSettings.signaturePageIndex ?? 0)||0);
    syncMemorialSignerPages({preserveIndex:true});
    memorialSigner.x=memorialEditSettings.signatureX;
    memorialSigner.y=memorialEditSettings.signatureY;
    memorialSigner.width=memorialEditSettings.signatureWidth;
    const select=$('memorialSignaturePageSelect');
    if(select) select.innerHTML=memorialSigner.pages.map((_,index)=>`<option value="${index}">Página ${index+1} de ${memorialSigner.pages.length}</option>`).join('');
    const fontValue=$('memorialFontValue'); if(fontValue)fontValue.textContent=`${Math.round(memorialPreviewZoom*100)}%`;
    const modal=signerModal(); if(!modal)return;
    if(inlineMount instanceof Element){
      inlineMount.dataset.betaPersonalizationSelected='1';
      inlineMount.classList.add('sv-beta-personalization-active');
      modal.classList.add('is-inline-personalization');
      modal._surveyorInlineMount=inlineMount;
      if(modal.parentElement!==inlineMount) inlineMount.appendChild(modal);
    }else{
      modal.classList.remove('is-inline-personalization');
      modal._surveyorInlineMount=null;
      if(modal.parentElement!==document.body) document.body.appendChild(modal);
    }
    modal.hidden=false;modal.setAttribute('aria-hidden','false');
    activateMemorialPersonalizationTool(modal,'memorial');
    if(inlineMount instanceof Element){
      try{window.dispatchEvent(new CustomEvent('surveyor:beta-personalization-mounted',{detail:{workspace:inlineMount,modal,mode:'memorial'}}));}catch(_error){}
    }
  }
  function updateMemorialFont(delta){ memorialPreviewZoom=Math.max(.5,Math.min(1.75,Number((memorialPreviewZoom+delta).toFixed(2)))); const value=$('memorialFontValue'); if(value)value.textContent=`${Math.round(memorialPreviewZoom*100)}%`; scaleMemorialLivePreview(); }
  function captureMemorialEditSettings(){
    // Em Projeto ou nas outras abas, o editor pode estar fechado/desatualizado.
    // Não sobrescrever posições persistidas com o índice padrão da página 1.
    const modal=signerModal();
    if(modal&&!modal.hidden&&modal.dataset.activePersonalizationTool==='signature'){
      memorialEditSettings.includeSignature=Boolean($('memorialIncludeSignature')?.checked)&&Boolean(memorialSigner.signatureDataUrl);
      memorialEditSettings.importedSignatureEnabled=Boolean($('memorialUseImportedSignature')?.checked)&&Boolean(memorialSigner.importedSignatureAsset?.dataUrl);
      syncMemorialSignaturePosition();
    }
    saveMemorialEditSettings();
    return {...memorialEditSettings};
  }

  async function saveMemorialDocumentState(){
    captureMemorialEditSettings();
    writeLocalTemplatePreference(selectedTemplateIdFromUi());
    if($('projectSelect')?.value){
      clearTimeout(memorialLiveRegenerationTimer);
      const generated=await generate({reason:'save',silent:true});
      if(generated!==true)throw new Error('O memorial não foi atualizado; as alterações continuam pendentes.');
    }
    return true;
  }

  async function applyMemorialEdit(){
    captureMemorialEditSettings();
    const inlineMount=signerModal()?._surveyorInlineMount || null;
    closeMemorialSigner();
    if(lastMemorialHtml){
      await generate();
      if(inlineMount?.isConnected) await openMemorialEditDialog({inlineMount});
    }else toast('Configuração do memorial atualizada.','success');
  }

  function install(){
    if(!$('generateMemorial')) return;
    hideMemorialPreview({ clear: true });
    installMemorialSigner();
    loadMemorialTemplatePreference();
    if(!$('memMapZoom')){
      const target=$('memTechnician')?.closest('label') || $('projectSelect')?.closest('label');
      target?.insertAdjacentHTML('afterend','<label>Zoom do mapa<select id="memMapZoom"><option>12</option><option>13</option><option>14</option><option selected>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option></select></label><label>Mapa de fundo<select id="memMapBackground"><option value="sat" selected>Satélite</option><option value="terrain">Topográfico</option><option value="topo">Topográfico / curvas de nível</option><option value="topographicReal">Topográfico real / altitude</option><option value="relief">Altimétrico colorido simples</option><option value="road">Ruas</option><option value="osm">Mapa viário</option><option value="none">Sem fundo</option></select></label>');
    }
    if(!$('downloadMemorialWord')) $('printOutput')?.insertAdjacentHTML('beforebegin','<button class="btn" id="downloadMemorialWord" type="button">Baixar Word</button>');
    if(!$('downloadMemorialPdf')) $('printOutput')?.insertAdjacentHTML('beforebegin','<button class="btn green" id="downloadMemorialPdf" type="button">Baixar PDF</button>');
    $('projectSelect')?.addEventListener('change',()=>{
      memorialPendingEdits=true;memorialPdfDocumentReady=false;
      loadMemorialEditSettings();
      syncProjectFields();
      if($('projectSelect')?.value){
        setMemorialModelLoading(true,'Carregando projeto…');
        scheduleMemorialLiveRegeneration(10,{showLoader:true});
      }else{
        setMemorialModelLoading(false);
        resetGeneratedMemorial();
      }
    });
    ['memMapZoom','memMapBackground','memShowConfrontantes','memIncludeMap'].forEach((controlId)=>{
      $(controlId)?.addEventListener('change',()=>{ if($('projectSelect')?.value) scheduleMemorialLiveRegeneration(10,{showLoader:true}); });
    });
    window.addEventListener('surveyor:document-step-change',(event)=>{
      if(event.detail?.page!=='memorial.html')return;
      const workspace=event.detail?.workspace||document.querySelector('.sv-doc-workspace');
      if(event.detail?.betaPersonalization){
        openMemorialEditDialog({inlineMount:workspace}).catch((error)=>{console.error('[Memorial] Falha ao abrir Personalização integrada:',error);toast(error?.message||'Não foi possível abrir a Personalização.','error');});
      }else if(signerModal()?.classList.contains('is-inline-personalization')) closeMemorialSigner();
    });
    $('memorialTemplateSelect')?.addEventListener('change',async()=>{
      memorialPendingEdits=true;memorialPdfDocumentReady=false;
      const select=$('memorialTemplateSelect');
      const selected=selectedTemplateIdFromUi();
      currentMemorialTemplateId=selected;
      if(select && select.value!==currentMemorialTemplateId) select.value=currentMemorialTemplateId;
      updateTemplateSpecificFields();
      writeLocalTemplatePreference(currentMemorialTemplateId);
      updateTemplateStatus(currentMemorialTemplateId,'aplicando modelo selecionado…');
      try{await rebuildMemorialModel();updateTemplateStatus(currentMemorialTemplateId,'aplicado nesta geração');}
      catch(error){console.error('[Memorial] Falha ao trocar modelo:',error);toast(error?.message||'Não foi possível aplicar o modelo.','error');}
    });
    const invalidateOnEdit=(event)=>{
      if(!event?.target?.matches?.('input, select, textarea'))return;
      if(event.target.id==='memorialTemplateSelect')return;
      memorialPendingEdits=true;memorialPdfDocumentReady=false;
      if(lastPdfBlob){pdfGenerationSerial+=1;revokePdfPreviewUrl();}
      const fastRefresh=new Set(['memMapZoom','memMapBackground','memShowConfrontantes','memIncludeMap','projectSelect']);
      scheduleMemorialLiveRegeneration(fastRefresh.has(event.target.id)?200:320,{showLoader:fastRefresh.has(event.target.id)});
    };
    $('generateMemorial')?.closest('.panel')?.addEventListener('input',invalidateOnEdit);
    $('generateMemorial')?.closest('.panel')?.addEventListener('change',invalidateOnEdit);
    $('generateMemorial').onclick=generate;
    $('downloadMemorialHtml').onclick=()=>lastMemorialHtml?download(`${slug($('projectSelect')?.selectedOptions?.[0]?.text)}-memorial.html`,fullDoc(false),'text/html;charset=utf-8'):toast('Gere o memorial primeiro.','error');
    $('downloadMemorialWord').onclick=async()=>{ if(!lastWordHtml)return toast('Gere o memorial primeiro.','error'); const base=`${slug($('projectSelect')?.selectedOptions?.[0]?.text)}-memorial`; if(lastGeneratedTemplateId==='standard') return download(`${base}.doc`,fullDoc(true),'application/msword;charset=utf-8'); try{ await window.SurveyorMemorialTemplates.createDocx(lastGeneratedTemplateId,lastTemplateData,`${base}.docx`); toast('Memorial personalizado gerado em Word.','success'); }catch(error){ console.error(error); toast(error.message||'Não foi possível gerar o DOCX personalizado.','error'); } };
    $('downloadMemorialPdf').onclick=downloadMemorialPdf;
    $('downloadMemorial').onclick=()=>lastText?download(`${slug($('projectSelect')?.selectedOptions?.[0]?.text)}-memorial.txt`,lastText,'text/plain;charset=utf-8'):toast('Gere o memorial primeiro.','error');
    $('printOutput').onclick=async(event)=>{event?.preventDefault?.(); try{await openPdfPrintWindow();}catch(error){console.error(error);toast(error.message||'Não foi possível abrir o PDF.','error');}};
    window.addEventListener('surveyor:document-save-request',(event)=>{
      if(event.detail?.page!=='memorial.html')return;
      captureMemorialEditSettings();
      writeLocalTemplatePreference(selectedTemplateIdFromUi());
    });
    window.SurveyorMemorialDocumentActions=Object.freeze({save:saveMemorialDocumentState});
    window.addEventListener('resize',scaleMemorialLivePreview,{passive:true});
  }
  if (window.SurveyorBatchDocumentContext?.active) {
    window.SurveyorOfficialBatchMemorial = Object.freeze({
      async pdf() {
        const id = String(window.SurveyorBatchDocumentContext.projectId);
        const select = $('projectSelect');
        if (!select) throw new Error('Seletor oficial de Memorial indisponível.');
        if (![...select.options].some(option => option.value === id)) select.add(new Option('Lote selecionado', id));
        select.value = id;
        await syncProjectFields();
        await loadMemorialTemplatePreference();
        const success = await generate({ silent: true, batch: true });
        if (!success || !lastPdfHtml) throw new Error('O gerador oficial não produziu o Memorial.');
        return buildMemorialPdfBlob();
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,100)); else setTimeout(install,100);
})();
