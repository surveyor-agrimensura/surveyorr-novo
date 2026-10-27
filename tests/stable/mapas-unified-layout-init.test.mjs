import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

// Auditoria estática dos contratos que impedem os painéis concorrentes.
assert.match(app, /const visibleTools = \['map','appearance','signature'\]/,
  'O croqui deve mostrar somente as três abas atuais.');
assert.match(app, /mapPanel\.querySelector\('\[data-map-section="sheet"\]'\)/,
  'A seção Croqui deve ser incorporada uma só vez na aba Mapa.');
assert.match(app, /mapPanel\.insertBefore\(section, mapPanel\.firstChild\)/,
  'Croqui deve vir antes de Elementos na mesma aba.');
assert.match(app, /sheetPanel\.remove\(\)/,
  'O painel Croqui separado deve deixar de existir após a migração dos controles.');
assert.match(app, /if \(!modal\.querySelector\('\[data-tool-panel="map"\]'\)\) \{\s*mountPranchaBetaSourceTool\(modal,'sheet','Croqui'\);\s*mountPranchaBetaSourceTool\(modal,'elements','Elementos'\);/,
  'Uma nova abertura não pode recriar o painel Croqui já incorporado.');
assert.match(app, /activatePranchaInlineTool\(modal,'map'\)/,
  'A Personalização de Mapas deve iniciar na aba Mapa, onde fica Elementos.');
assert.match(app, /modal\.dataset\.inlineMapReady = '1'/,
  'O editor deve sinalizar quando o layout definitivo estiver montado.');
assert.match(css, /body\[data-page="mapas\.html"\] \.sv-confrontante-editor-modal\.is-inline-beta:not\(\[data-inline-map-ready="1"\]\)\{visibility:hidden;\}/,
  'A montagem provisória não deve aparecer antes do layout atual.');
assert.match(css, /body\[data-page="mapas\.html"\]:not\(\.sv-document-workspace-page\)>\.suite\{visibility:hidden;\}/,
  'A página não deve exibir o HTML legado antes do workspace oficial.');
assert.equal((app.match(/fontSize: Math\.max\(12\.5, autoLayout\.confrontanteFontSize \* 1\.75\)/g)||[]).length,2,
  'Nomes dos dois modelos de Mapas/Croquis devem receber o tamanho-base legível.');
console.log('PASS mapas-unified-layout-init: estrutura canônica, Elementos no Mapa e flash provisório bloqueado (checagens estáticas).');
