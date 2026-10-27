import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const mapApp = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const mapCss = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8').replace(/!important/g,'');

assert.match(editor, /let signatureHydrationAttempted = false, signatureHydrationPromise = null;/,
  'hidratação da assinatura deve possuir estado próprio e finito');
assert.match(editor, /if \(signatureHydrationAttempted && !force\) return '';/,
  'editor não pode repetir indefinidamente a leitura de uma assinatura ausente');
assert.doesNotMatch(editor, /syncSettingsControls\._checkingSignature/,
  'sincronização visual não pode iniciar um ciclo assíncrono recursivo');

const syncStart = editor.indexOf('    function syncSettingsControls(){');
const syncEnd = editor.indexOf('    function syncAreaNameLabels()', syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart, 'syncSettingsControls deve existir');
const syncBlock = editor.slice(syncStart, syncEnd);
assert.doesNotMatch(syncBlock, /hydrateSignatureFromAccount\(/,
  'syncSettingsControls deve ser puramente síncrono para não travar a prancha');

const focusStart = mapApp.indexOf('  async function focusRuralPropertySearchFeature(feature, options = {}) {');
const focusEnd = mapApp.indexOf('  async function fetchLocalRuralProperties', focusStart);
assert.ok(focusStart >= 0 && focusEnd > focusStart, 'fluxo de localização de imóvel deve existir');
const focusBlock = mapApp.slice(focusStart, focusEnd);
assert.match(focusBlock, /interactive: true/,
  'imóvel vermelho localizado deve aceitar clique explícito');
assert.match(focusBlock, /openRuralInformationFromContext\(\{ feature, sourceLayer, renderedLayer: highlight, latlng \}\)/,
  'clique no polígono vermelho deve abrir os detalhes do imóvel');
assert.doesNotMatch(focusBlock, /await identifyRuralRegistriesAt\(/,
  'selecionar um nome na lista não pode abrir detalhes automaticamente');
assert.match(focusBlock, /if \(options\.preserveSearchResults\) closeRuralInfoPanel\(\);/,
  'trocar o imóvel visualizado deve fechar detalhe antigo sem esconder a lista de resultados');

const ruralPanel = mapCss.match(/\.rural-info-panel\{[^}]*z-index:(\d+);/s);
const searchOverlay = mapCss.match(/\.city-suggest\.sv-map-search-overlay\.property-context-box\{[^}]*z-index:(\d+);/s);
assert.ok(ruralPanel && searchOverlay, 'camadas visuais do painel e da busca devem declarar z-index');
assert.ok(Number(ruralPanel[1]) > Number(searchOverlay[1]),
  'detalhes do imóvel devem aparecer acima da lista de nomes quando abertos pelo polígono');

console.log('PASS technical-editor-search-result-behavior: editor sem loop e detalhes fundiários abertos somente por clique explícito no imóvel.');
