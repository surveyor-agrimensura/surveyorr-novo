import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(editor, /function editableOverlayRoots\(source\)/, 'Editor inline deve deduplicar raízes editáveis antes de clonar o overlay.');
assert.match(editor, /if \(candidateSet\.has\(parent\)\) return false;/, 'Filhos de uma camada editável já clonada não podem ser clonados novamente.');
assert.match(editor, /const editableRoots = editableOverlayRoots\(source\);/, 'parseSvg deve calcular uma única coleção de raízes editáveis.');
assert.match(editor, /editableRoots\.forEach\(\(group\) => overlay\.appendChild\(group\.cloneNode\(true\)\)\)/, 'Overlay deve receber apenas raízes editáveis sem duplicação de textos/elementos.');
assert.match(editor, /function freezeSvgTypography\(svg\)/, 'Editor inline deve congelar os pesos do SVG antes da composição visual.');
assert.match(editor, /async function vectorBackground\(svg\)/, 'Bancada inline deve manter fundo vetorial isolado da cascata HTML.');
assert.match(editor, /if \(requestedMode === 'inline'\) raster = await vectorBackground\(parts\.background\);/, 'Modo inline deve usar o fundo SVG isolado em data URL.');
assert.match(css, /\.sv-confrontante-editor-background\{[\s\S]*pointer-events:none/, 'Fundo vetorial isolado deve permanecer não interativo atrás do overlay.');
assert.match(editor, /import\('\/assets\/js\/core\/editor-engine\/index\.js'\)/, 'Editor deve continuar carregando o motor próprio SurveyorEditorEngine.');
assert.match(editor, /new SurveyorEditorEngine\(\{ historyLimit: 120, snapTolerance: 8/, 'Motor próprio deve continuar sendo instanciado na sessão real.');
assert.match(editor, /window\.SurveyorEditorEngineRuntime = Object\.freeze/, 'Runtime do motor deve continuar disponível para diagnóstico.');

console.log('PASS inline-editor-native-svg-v205: fundo vetorial isolado, overlay sem duplicação e motor próprio preservado.');
