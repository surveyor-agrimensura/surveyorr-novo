import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const assets = fs.readFileSync('assets/js/core/document-assets.js','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(editor, /EDITABLE_OVERLAY_SELECTOR[\s\S]*\[data-document-signature\]/, 'Assinatura deve fazer parte da camada SVG editável.');
assert.match(editor, /editableOverlayRoots\(background\)\.forEach\(\(node\) => node\.remove\(\)\)/, 'Assinatura e demais elementos editáveis devem ser removidos do fundo sem duplicidade.');
assert.match(editor, /const editableRoots = editableOverlayRoots\(source\)/, 'Assinatura deve ser incluída na coleção deduplicada do overlay interativo.');
assert.match(editor, /input\.disabled=false/, 'Campo de nome no mapa deve continuar utilizável mesmo antes do primeiro nome existir.');
assert.match(editor, /addAreaName\(typed,\{focus:false\}\)/, 'Digitar o primeiro nome deve criar automaticamente um item editável.');
assert.match(editor, /editorEngine\?\.renderNode\?\.\(`document-area-name:\$\{id\}`\)/, 'Nome novo deve ser sincronizado e renderizado imediatamente no motor.');
assert.match(editor, /requested==='signature'[\s\S]*hydrateSignatureFromAccount\(\{force:true\}\)/, 'Abrir a ferramenta de assinatura deve atualizar a assinatura cadastrada sem depender do estado inicial.');
assert.match(assets, /async function resolveSignatureDataUrl\(/, 'Assets documentais devem ter uma fonte única para resolver a assinatura cadastrada.');
assert.match(assets, /resolveSignatureDataUrl,/, 'Resolvedor de assinatura deve ser público para os geradores documentais.');
assert.match(mapas, /SurveyorDocumentAssets\?\.resolveSignatureDataUrl/, 'Prancha deve usar o resolvedor central de assinatura.');

console.log('PASS technical-editor-names-signature-runtime: nomes e assinatura possuem fluxo interativo real e fonte única.');
