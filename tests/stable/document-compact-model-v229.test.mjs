import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(documents, /'memorial\.html':\s*\{[\s\S]*compactModel:true, noFinalStep:true,[\s\S]*bottomActionSelectors:\['#generateMemorial','\.export-menu'\]/, 'Memorial deve manter somente geração e download no rodapé; edição pertence à Personalização.');
assert.match(documents, /\{ title:'Personalização', betaPersonalization:true, runtimePersonalization:true, betaBadge:false,[\s\S]*tool:'memorial'[\s\S]*tool:'map'/, 'Memorial deve expor Personalização integrada com ferramentas Memorial e Mapa.');
assert.match(documents, /'mapas\.html':\s*\{[\s\S]*compactModel:true, noFinalStep:true,[\s\S]*bottomActionSelectors:\['#generateMapV19','\.export-menu'\]/, 'Mapas/Croquis deve remover Editar croqui do rodapé e manter edição dentro de Personalização.');
assert.match(documents, /if \(cfg\.compactModel\) document\.body\.classList\.add\('sv-document-compact-model'\)/, 'Controlador central deve ativar o modelo compacto sem implementação paralela por página.');
assert.match(documents, /function setupCompactFooterActions\(workspace\)[\s\S]*sv-doc-compact-footer-actions[\s\S]*cfg\.bottomActionSelectors/, 'Ações inferiores devem ser montadas pela fonte central do workspace documental.');
assert.match(css, /body\.sv-document-compact-model\.sv-document-workspace-page \.sv-doc-workspace(?::not\(\.sv-beta-personalization-active\))?\{[\s\S]*grid-template-columns:clamp\(330px,24vw,365px\) minmax\(0,1fr\)/, 'Memorial e Mapas/Croquis devem repetir a proporção compacta da Prancha sem sobrescrever a Personalização ativa.');
assert.match(css, /body\.sv-document-compact-model\.sv-document-workspace-page \.sv-doc-preview-head\{\s*display:none;/, 'Bancada compacta não deve reintroduzir cartão/cabeçalho redundante de prévia.');
assert.match(css, /body\.sv-document-compact-model\.sv-document-workspace-page \.sv-doc-draft-dock\{[\s\S]*grid-column:1\/-1;[\s\S]*min-height:48px;/, 'Rodapé deve ocupar toda a bancada como na Prancha Técnica.');

assert.match(mapas, /const mini = \{ x: panel\.x \+ 34, y: panel\.y \+ 614, w: 330, h: 210 \};/, 'Minimapa deve ficar centralizado horizontalmente e deslocado abaixo do título dentro do quadro de situação.');
assert.match(mapas, /<rect x="\$\{panel\.x \+ 16\}" y="\$\{panel\.y \+ 570\}" width="366" height="270"/, 'Quadro externo do minimapa deve manter geometria técnica estável.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V229: Memorial e Mapas/Croquis usam a bancada compacta e o minimapa respeita o quadro de situação.');
