(() => {
  'use strict';
  const auth = window.GeoRuralAuth || window.SurveyorAuth;
  if (!auth?.requireAuth?.()) return;
  const $ = (id) => document.getElementById(id);
  const core = window.SurveyorLotCenterCore;
  let project = null;
  let lots = [];
  let busy = false;
  let downloadUrl = '';
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const status = (text, error = false) => { $('batchStatus').textContent = String(text); $('batchStatus').dataset.error = String(Boolean(error)); };
  const showBusy = (value) => { busy = value; $('generateBatch').disabled = value; $('batchProject').disabled = value; $('reloadBatch').disabled = value; $('selectAllLots').disabled = value; };
  const fmt = (num, digits = 2) => Number(num || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });

  function setDownload(blob, filename) {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    const a = $('downloadBatch');
    a.href = downloadUrl; a.download = filename; a.hidden = false;
  }
  function clearDownload() {
    $('downloadBatch').hidden = true; $('downloadBatch').removeAttribute('href');
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = ''; }
  }
  function updateSelection() {
    const checkboxes = [...document.querySelectorAll('[data-lot-index]')];
    $('selectionCount').textContent = `${checkboxes.filter((x) => x.checked).length} de ${checkboxes.length} polígonos selecionados`;
    $('generateBatch').disabled = busy || !project || !checkboxes.some((c) => c.checked);
  }
  function renderLots() {
    $('lotItems').replaceChildren();
    if (!lots.length) { $('lotItems').textContent = 'Este projeto não possui polígonos salvos. Abra o mapa e salve um perímetro ou uma gleba antes de gerar documentos.'; updateSelection(); return; }
    for (const lot of lots) {
      const error = core.validate(lot.feature);
      const row = document.createElement('label'); row.className = 'batch-lot';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.lotIndex = String(lot.index); checkbox.checked = lot.selectedByDefault && !error; checkbox.disabled = Boolean(error); checkbox.addEventListener('change', updateSelection);
      const detail = document.createElement('span'); detail.className = 'batch-lot-body';
      const area = !error ? fmt(turf.area(lot.feature) / 10000, 4) + ' ha' : 'Geometria inválida';
      detail.innerHTML = `<strong>${escape(lot.label)}</strong><small>${escape(lot.category)} · ${escape(area)}${error ? ' · ' + escape(error) : ''}</small>`;
      row.append(checkbox, detail); $('lotItems').appendChild(row);
    }
    updateSelection();
  }
  let selectToken = 0;
  async function selectProject(id) {
    const token = ++selectToken;
    project = null; lots = []; clearDownload(); $('lotItems').textContent = 'Carregando geometrias salvas…'; $('batchRows').replaceChildren();
    if (!id) { $('lotItems').textContent = 'Escolha um projeto para listar os lotes.'; updateSelection(); return; }
    try {
      const loaded = await window.GeoRuralProjects.get(id, true);
      if (token !== selectToken) return;
      if (!loaded) throw new Error('Projeto não encontrado.');
      project = loaded; lots = core.lots(loaded); renderLots();
      $('projectDetails').textContent = `${window.GeoRuralProjects?.ownerNames?.(loaded) || loaded.owner || loaded.ownerName || 'Proprietário não informado'} · ${loaded.city || loaded.municipality || 'Município não informado'}`;
      status(`${lots.length} polígonos encontrados. Selecione os lotes e as peças desejadas.`);
    } catch (error) {
      if (token !== selectToken) return;
      $('lotItems').textContent = 'Não foi possível obter os dados salvos deste projeto.'; status(error?.message || 'Falha ao carregar projeto.', true); updateSelection();
    }
  }
  async function loadProjects(force = false) {
    if (busy) return;
    const selected = $('batchProject').value || new URLSearchParams(location.search).get('project') || '';
    status('Buscando seus projetos salvos…');
    try {
      const summaries = await window.GeoRuralProjects.list({refresh:force});
      const sel = $('batchProject'); sel.replaceChildren(new Option('Selecione um projeto salvo…', ''));
      summaries.forEach((p) => sel.add(new Option(p.propertyName || p.title || p.name || 'Projeto sem nome', p.id)));
      if (selected && [...sel.options].some((option) => option.value === selected)) sel.value = selected;
      if (!sel.value && summaries.length === 1) sel.value = summaries[0].id;
      if (sel.value) await selectProject(sel.value);
      else { $('lotItems').textContent = summaries.length ? 'Selecione um projeto para visualizar os lotes.' : 'Nenhum projeto salvo encontrado.'; status(`${summaries.length} projetos disponíveis.`); }
    } catch (error) { status('Não foi possível carregar os projetos: ' + (error?.message || 'erro desconhecido'), true); }
  }
  function addResult(label, ok, detail) {
    const item = document.createElement('li');
    item.className = ok ? 'batch-ok' : 'batch-error';
    item.textContent = `${label}: ${detail}`; $('batchRows').appendChild(item);
  }
  // Processa documentos nos PRÓPRIOS módulos oficiais, com contexto efêmero de lote.
  // Não usa o PDF simplificado do dossiê para Memorial, Croqui ou Prancha.
  const batchRequests = new Map();
  window.SurveyorBatchDocumentProvider = Object.freeze({
    get: token => {
      const value = batchRequests.get(String(token));
      return value ? {project: JSON.parse(JSON.stringify(value))} : null;
    }
  });
  const officialTypes = Object.freeze({
    memorial: {route:'memorial', api:'SurveyorOfficialBatchMemorial', method:'pdf', name:'Memorial descritivo - modelo oficial.pdf'},
    prancha: {route:'pranchas', api:'SurveyorOfficialBatchCartography', method:'pdf', name:'Prancha tecnica - modelo oficial.pdf'},
    croqui: {route:'mapas', api:'SurveyorOfficialBatchCartography', method:'pdf', name:'Mapa e croqui - modelo oficial.pdf'},
    ods: {route:'ods', api:'SurveyorOfficialBatchOds', method:'ods', name:'Planilha ODS - modelo do sistema.ods'}
  });
  function withTimeout(task, duration, description) {
    let timeoutId;
    return Promise.race([Promise.resolve(task), new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${description}: tempo limite excedido.`)), duration);
    })]).finally(() => clearTimeout(timeoutId));
  }
  async function generateOfficialDoc(type, projectData) {
    const cfg = officialTypes[type];
    if (!cfg) throw new Error(`Gerador oficial não cadastrado: ${type}`);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) => v.toString(16).padStart(2, '0')).join('');
    // O contexto é mantido só na memória e removido após o arquivo ser retornado.
    batchRequests.set(token, projectData);
    const frame = document.createElement('iframe');
    frame.className = 'batch-official-renderer';
    frame.title = `Gerador oficial de ${type}`;
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1366px;height:900px;border:0;pointer-events:none;';
    try {
      const loaded = new Promise((resolve, reject) => {
        frame.onload = resolve;
        frame.onerror = () => reject(new Error(`Falha ao abrir módulo oficial de ${type}.`));
      });
      frame.src = `/${cfg.route}/?project=${encodeURIComponent(projectData.id)}&svBatch=${token}`;
      document.body.appendChild(frame);
      await withTimeout(loaded, 45000, `Carregamento do ${type}`);
      const w = frame.contentWindow;
      if (!w || w.location.origin !== location.origin || !w.SurveyorBatchDocumentContext?.active) {
        throw new Error(`O módulo ${cfg.route} não aceitou o contexto isolado. Recarregue a página.`);
      }
      let method;
      for (let i = 0; i < 60; i++) {
        method = w[cfg.api]?.[cfg.method];
        if (typeof method === 'function') break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (typeof method !== 'function') throw new Error(`O gerador oficial de ${type} não terminou a inicialização.`);
      await new Promise(resolve => setTimeout(resolve, 250));
      const contents = await withTimeout(method(), 90000, `Geração oficial de ${type}`);
      if (!contents || (contents.size === 0) || (contents.byteLength === 0)) throw new Error(`O gerador oficial não retornou conteúdo de ${type}.`);
      return contents.arrayBuffer ? await contents.arrayBuffer() : contents;
    } finally {
      frame.remove();
      batchRequests.delete(token);
    }
  }
  async function documentsForLot(lot, selectedDocs) {
    const data = core.isolate(project, lot);
    const files = {};
    const errors = [];
    // Cada peça falha ou é concluída de modo independente. Uma falha não apaga
    // PDFs/planilhas já gerados do mesmo lote, nem cria documentos de substituição.
    for (const name of selectedDocs) {
      const cfg = officialTypes[name];
      if (cfg) {
        try {
          status(`Gerando ${cfg.route} no modelo do sistema: ${lot.label}…`);
          const source = core.officialProject(project, lot);
          files[cfg.name] = await generateOfficialDoc(name, source);
        } catch (error) {
          console.error(`[Central de Lotes] Falha no gerador ${name} do lote ${lot.label}:`, error);
          errors.push({documento: cfg.name, mensagem: error?.message || 'Falha desconhecida.'});
        }
      } else {
        try {
          Object.assign(files, await window.SurveyorProjectDossier.lotDocuments(data, [name]));
        } catch (error) {
          console.error(`[Central de Lotes] Falha no arquivo auxiliar ${name} do lote ${lot.label}:`, error);
          errors.push({documento: name, mensagem: error?.message || 'Falha desconhecida.'});
        }
      }
    }
    return {files, errors};
  }
  async function generate() {
    if (busy || !project) return;
    if (!auth.hasPermission?.('projects:export-zip')) { status('A Central de Lotes requer permissão de exportação ZIP do plano Pro.', true); return; }
    const selectedIds = [...document.querySelectorAll('[data-lot-index]:checked')].map((checkbox) => Number(checkbox.dataset.lotIndex));
    const selected = lots.filter((lot) => selectedIds.includes(lot.index));
    const selectedDocs = [...document.querySelectorAll('[data-batch-doc]:checked')].map((checkbox) => checkbox.dataset.batchDoc);
    if (!selected.length || !selectedDocs.length) { status('Selecione ao menos um lote e um documento.', true); return; }
    if (!window.JSZip || !window.SurveyorProjectDossier?.lotDocuments) { status('Geradores não disponíveis; recarregue a página.', true); return; }
    clearDownload(); showBusy(true); $('batchRows').replaceChildren();
    const zip = new JSZip(), manifest = [], summary = ['lote;categoria;area_ha;perimetro_m;status'];
    let successes = 0;
    let warnings = 0;
    try {
      for (let i = 0; i < selected.length; i++) {
        const lot = selected[i], base = `${i + 1}/${selected.length}: ${lot.label}`;
        status(`Processando ${base}…`);
        const error = core.validate(lot.feature);
        if (error) { warnings++; manifest.push({ lot:lot.label, status:'erro', error }); addResult(lot.label, false, error); continue; }
        try {
          const folderName = core.lotFolder(lot, i);
          const data = core.isolate(project, lot);
          const {files: pieces, errors} = await documentsForLot(lot, selectedDocs);
          if (!Object.keys(pieces).length) throw new Error(errors.map(item => `${item.documento}: ${item.mensagem}`).join(' | ') || 'Nenhum documento produzido.');
          const folder = zip.folder(folderName);
          Object.entries(pieces).forEach(([filename, contents]) => folder.file(filename, contents));
          if (errors.length) folder.file('ERROS_GERACAO.txt', 'Geração incompleta. Documentos solicitados não produzidos:\n\n' + errors.map(item => `${item.documento}: ${item.mensagem}`).join('\n'));
          const feature = data.featureCollection.features[0];
          const area = turf.area(feature) / 10000;
          let length = 0; try { length = turf.length(turf.polygonToLine(feature), {units:'kilometers'}) * 1000; } catch {}
          const lotStatus = errors.length ? 'parcial' : 'ok';
          summary.push([lot.label,lot.category,area.toFixed(4),length.toFixed(2),lotStatus.toUpperCase()].map((s) => `"${String(s).replace(/"/g,'""')}"`).join(';'));
          manifest.push({lot:lot.label,status:lotStatus,folder:folderName,files:Object.keys(pieces),errors,areaHa:area,perimeterM:length});
          successes++;
          if (errors.length) {
            warnings++;
            addResult(lot.label, false, `${Object.keys(pieces).length} arquivos gerados; ${errors.length} falha(s): ${errors.map(item => `${item.documento}: ${item.mensagem}`).join(' | ')}`);
          } else addResult(lot.label, true, `${Object.keys(pieces).length} arquivos`);
        } catch (error) { warnings++; const message = error?.message || 'Falha ao gerar documentos.'; manifest.push({lot:lot.label,status:'erro',error:message}); addResult(lot.label, false, message); }
      }
      if (!successes) throw new Error('Nenhum lote foi gerado. Verifique os erros apresentados.');
      zip.file('RESUMO_GERAL.csv', '\ufeff' + summary.join('\n'));
      zip.file('RELATORIO_GERACAO.json', JSON.stringify({generator:'SURVEYOR Central de Lotes',version:'official-templates-1',projectId:project.id,generatedAt:new Date().toISOString(),lots:manifest},null,2));
      zip.file('LEIA-ME.txt','Central de Lotes — Memorial, Prancha e Croqui usam os geradores oficiais dos módulos SURVEYOR com o modelo ativo da conta. A planilha ODS utiliza o mesmo gerador do módulo ODS e NÃO é a planilha oficial do SIGEF. Os quadros auxiliares e arquivos geográficos usam as rotinas técnicas do dossiê. Confira todas as peças antes de protocolar. O contexto de cada lote é temporário; o projeto salvo não foi alterado. QR/link público de imóvel completo são omitidos na geração isolada, pois não identificam a gleba individual.');
      status('Compactando arquivos…');
      const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
      setDownload(blob, `${core.safeName(project.title || project.name || 'projeto')}-Central-de-Lotes.zip`);
      status(warnings
        ? `Geração incompleta: ${successes} de ${selected.length} lotes com arquivos; ${warnings} lote(s) com falhas. Baixe o ZIP e confira os relatórios de erro.`
        : `Concluído: ${successes} de ${selected.length} lotes gerados. Clique em “Baixar ZIP”.`, Boolean(warnings));
    } catch (error) { status(error?.message || 'Falha ao criar lote de documentos.', true); }
    finally { showBusy(false); updateSelection(); }
  }
  $('batchProject').addEventListener('change', (event) => selectProject(event.target.value));
  $('reloadBatch').addEventListener('click', () => loadProjects(true));
  $('selectAllLots').addEventListener('click', () => { const available = [...document.querySelectorAll('[data-lot-index]:not(:disabled)')]; const all = available.length && available.every((x) => x.checked); available.forEach((box) => {box.checked = !all;}); updateSelection(); });
  $('generateBatch').addEventListener('click', generate);
  window.addEventListener('pagehide', () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); });
  loadProjects();
})();
