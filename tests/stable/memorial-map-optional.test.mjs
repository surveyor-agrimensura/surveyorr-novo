import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const memorialHtml = fs.readFileSync('memorial/index.html','utf8');
const customizationHtml = fs.readFileSync('customizacao/index.html','utf8');

assert.match(memorialHtml, /id="memIncludeMap"[\s\S]*?<option value="1" selected>Incluir<\/option>[\s\S]*?<option value="0">Não incluir<\/option>/, 'Memorial deve expor escolha explícita para incluir ou não o mapa final.');
assert.match(documents, /Personalização'[\s\S]*?#memIncludeMap/, 'A escolha do mapa deve participar da etapa oficial Personalização.');
assert.match(app, /function memorialMapIncluded\(memorialOptions=\{\}\)[\s\S]*?memIncludeMap[\s\S]*?memorialOptions\?\.showMap !== false/, 'A geração deve ter um único resolvedor da inclusão do mapa, usando a escolha da tela e a Personalização apenas como fallback.');
assert.match(app, /includeMap=memorialMapIncluded\(memOpt\)/, 'A geração deve resolver a inclusão do mapa uma única vez por documento.');
assert.match(app, /const share=includeMap && memOpt\.showQr !== false[\s\S]*?if\(includeMap\)\{[\s\S]*?mapSvg\(p,share,\{livePreview\}\)/, 'Link público, QR e renderização do mapa não devem ser executados quando o mapa estiver desativado.');
assert.match(app, /else\{\s*lastMapSvg='';\s*lastMapPng='';\s*lastMapRenderKey='';\s*lastMapCoords=\[\];\s*\}/, 'Ao gerar sem mapa, o estado visual e os caches do mapa anterior devem ser limpos.');
assert.match(app, /const textMapSection=includeMap\?/, 'Exportação TXT deve obedecer à mesma escolha do preview/PDF/Word.');
assert.match(app, /includeMapControl&&!includeMapControl\.dataset\.defaultApplied\)\{includeMapControl\.value='1'/, 'O mapa deve iniciar incluído no memorial e só ser removido por escolha explícita da geração.');
assert.match(customizationHtml, /Incluir mapa\/planta por padrão nos memoriais/, 'A Personalização deve deixar claro que sua opção é o padrão, não uma trava para cada geração.');

console.log('PASS memorial-map-optional: mapa final opcional usa uma única decisão por geração e evita processamento desnecessário quando desativado.');
