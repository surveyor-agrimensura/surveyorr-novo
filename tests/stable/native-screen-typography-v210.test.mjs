import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const pdf = fs.readFileSync('assets/js/core/pdf-preview.js','utf8');

assert.match(css,/\.sv-confrontante-editor-sheet\.is-native-document \.sv-native-document-canvas text,[\s\S]*font-family:"Segoe UI",Arial,sans-serif;[\s\S]*font-weight:300;[\s\S]*text-rendering:auto;/,'Bancada nativa deve usar perfil de tela leve, próprio para textos pequenos.');
assert.match(css,/text:not\(\.sv-area-name-text\):not\(\.sv-confrontante-name-text\)\{[\s\S]*stroke:none;[\s\S]*paint-order:normal/,'Texto comum da cena não pode herdar contorno que simule negrito.');
assert.match(css,/\.sv-native-document-canvas \.sv-area-name-text,[\s\S]*\.sv-native-document-canvas \.sv-confrontante-name-text[\s\S]*font-weight:400/,'Nomes editáveis não devem ganhar negrito artificial na bancada.');
assert.match(editor,/new XMLSerializer\(\)\.serializeToString\(documentSvg\)/,'Cena publicada deve serializar cópia vetorial limpa do documento, sem herdar estilos CSS da bancada ou ferramentas de edição.');
assert.match(pdf,/SurveyorTechnicalSvgTypography\?\.normalize/,'Exportação PDF deve continuar usando a política documental vetorial, independente do perfil de tela.');

console.log('PASS native-screen-typography: bancada usa tipografia fina e elimina contorno herdado sem alterar o SVG/PDF documental.');
