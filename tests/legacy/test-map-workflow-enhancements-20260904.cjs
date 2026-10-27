const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('mapa/index.html', 'utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const ui = fs.readFileSync('assets/js/core/ui.js', 'utf8');
const save = fs.readFileSync('assets/js/features/mapa/save-status.js', 'utf8');
const snap = fs.readFileSync('assets/js/features/mapa/snap.js', 'utf8');
const audit = fs.readFileSync('assets/js/features/mapa/audit.js', 'utf8');
const history = fs.readFileSync('assets/js/features/mapa/history.js', 'utf8');
const dossier = fs.readFileSync('assets/js/features/mapa/dossier.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/enhancements.css', 'utf8');

[
  'save-status.js',
  'snap.js',
  'audit.js',
  'history.js',
  'dossier.js'
].forEach((file) => assert.ok(html.includes(file), `mapa deve carregar ${file}`));
assert.ok(html.includes('enhancements.css'), 'mapa deve carregar o CSS modular das melhorias.');

// Recovery: o mesmo defeito que quebrou Refazer não pode existir no rascunho.
assert.match(app, /function restorePartialLiveDraft\(liveDraft\)[\s\S]*attach\(layer\);[\s\S]*drawn\.addLayer\(layer\)/, 'Rascunho recuperado deve usar attach().');
assert.doesNotMatch(app, /function restorePartialLiveDraft\(liveDraft\)[\s\S]{0,1500}bindLayer\(layer\)/, 'Recovery não pode chamar bindLayer inexistente.');

// Status de salvamento.
assert.match(save, /saved:\s*\['Salvo',\s*'saved'/, 'Status deve possuir estado Salvo.');
assert.ok(save.includes('Alterações pendentes') && save.includes('Salvando...') && save.includes('Salvo localmente — aguardando conexão'), 'Status deve preservar os estados técnicos definidos para o usuário.');
assert.ok(save.includes('surveyor:save-start') && save.includes('surveyor:save-success') && save.includes('surveyor:save-error'), 'Status deve reagir ao ciclo real de save.');
assert.ok(app.includes("new CustomEvent('surveyor:save-start')") && app.includes("new CustomEvent('surveyor:save-success'"), 'App deve emitir eventos de sincronização.');
assert.ok(css.includes('.sv-save-state-dot'), 'Estado de save deve estar integrado discretamente ao botão Salvar.');
assert.ok(save.includes("button.appendChild(dot)"), 'Indicador de save deve pertencer ao próprio botão Salvar.');
assert.ok(!save.includes('sv-project-save-status'), 'Não deve existir badge autônomo grande de status na toolbar.');
assert.match(app, /function projectContentSignature\(\)[\s\S]*hasUserContent[\s\S]*delete next\.confrontantes/, 'Confrontantes vazios gerados só pela seleção não podem marcar projeto como pendente.');

// Snap ao vivo.
assert.ok(snap.includes('Snap durante desenho'), 'CAD deve oferecer Snap durante desenho.');
assert.match(snap, /L\.Draw\.Polyline\.prototype[\s\S]*proto\.addVertex = function surveyorSnapAddVertex/, 'Snap deve atuar no addVertex nativo do Leaflet.Draw.');
assert.ok(snap.includes("type: 'vertex'") && snap.includes("type: 'segment'") && snap.includes("type: 'extension'"), 'Snap deve considerar vértice, segmento/perpendicular e prolongamento.');
assert.ok(snap.includes('Segmento ⟂'), 'Snap de segmento deve comunicar a projeção perpendicular.');

// Checklist técnico.
assert.ok(ui.includes("const verify=proxyButton('Verificar'"), 'Toolbar deve expor Verificar Projeto.');
assert.ok(audit.includes('PROJETO PRONTO PARA ENTREGA') && audit.includes('PROJETO REQUER REVISÃO'), 'Checklist deve produzir status técnico.');
assert.ok(audit.includes('Sistema de coordenadas identificado'), 'Checklist deve verificar CRS/coordenadas.');
assert.ok(audit.includes('confrontantes') && audit.includes('CAR') && audit.includes('SIGEF'), 'Checklist deve integrar confrontantes, CAR e SIGEF.');
assert.ok(audit.includes("button.textContent = 'Corrigir'"), 'Problemas verificáveis devem possuir ação Corrigir.');
assert.ok(audit.includes('score'), 'Checklist deve gerar nota técnica.');

// Histórico visual e nuvem.
assert.ok(app.includes('undoMetaStack') && app.includes('redoMetaStack'), 'Histórico rápido deve manter metadados descritivos.');
assert.ok(app.includes('getHistoryEntries: historyEntries') && app.includes('jumpToHistoryIndex'), 'Runtime deve permitir listar e voltar a um ponto do histórico.');
assert.ok(history.includes('Alterações da sessão') && history.includes('Abrir versões'), 'Painel deve separar histórico rápido e versões permanentes.');
assert.ok(history.includes('Voltar para o estado anterior'), 'Entrada histórica deve permitir voltar até aquele ponto.');
assert.match(app, /const beforeImportSnapshot = snapshotDrawn\(\);[\s\S]*Camada importada — \$\{first\.name\}/, 'Importação deve entrar no histórico rápido com nome do arquivo.');

// Dossiê técnico.
[
  '01 - Relatório do imóvel.pdf',
  '02 - Croqui.pdf',
  '03 - Memorial descritivo.pdf',
  '04 - Tabela de coordenadas.csv',
  '05 - Confrontantes.pdf',
  '06 - CAR-SIGEF.pdf',
  '07 - Projeto.geojson',
  '08 - Projeto.kml',
  '09 - Shapefile',
  '10 - Fotos de campo/README.txt',
  '11 - Metadados/projeto.json'
].forEach((name) => assert.ok(dossier.includes(name), `Dossiê deve conter ${name}`));
assert.ok(dossier.includes("exportWithProfile") && dossier.includes("'qgis-arcgis'"), 'Dossiê deve gerar Shapefile real pelo exportador existente.');
assert.ok(dossier.includes('Dossiê técnico (ZIP)'), 'Exportar deve oferecer Dossiê técnico.');

console.log('PASS: status de salvamento, snap ao vivo, checklist, histórico visual, dossiê e recovery modularizados.');
