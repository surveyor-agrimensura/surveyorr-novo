import fs from 'node:fs';
import assert from 'node:assert/strict';

const mapas=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const memorial=fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const vertices=fs.readFileSync('assets/js/features/mapas/vertices.js','utf8');
const dimensions=fs.readFileSync('assets/js/features/mapas/dimensions.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(mapas,/node\.className='sv-document-app-loader'/,'Troca de projeto em Mapas/Pranchas deve usar o loading global da aplicação.');
assert.match(mapas,/node\.hidden=!visible/,'Loading de troca de projeto deve bloquear a tela durante a renderização.');
assert.match(memorial,/setMemorialModelLoading\(true,'Carregando projeto…'\)/,'Memorial deve abrir o loading imediatamente ao selecionar projeto.');

assert.match(memorial,/id="memorialSignaturePages"/,'Assinatura do Memorial deve possuir pilha rolável de páginas.');
assert.match(memorial,/function renderMemorialSignaturePages/,'Memorial deve renderizar todas as páginas durante a edição da assinatura.');
assert.match(memorial,/data-page-index="\$\{index\}"/,'Cada página do Memorial deve manter índice próprio para posicionamento da assinatura.');
assert.match(memorial,/memorialSigner\.pageIndex=Math\.max\(0,Number\(page\.dataset\.pageIndex\)\|\|0\)/,'Clique em qualquer página deve selecionar essa página para assinatura.');
assert.match(css,/\.memorial-sign-pages\{[\s\S]*flex-direction:column/,'Páginas da assinatura devem ficar empilhadas verticalmente com rolagem.');

assert.match(vertices,/if \(options\.strictPlacement !== false\)/,'Posicionamento literal dos vértices deve ser o padrão do renderer.');
assert.doesNotMatch(vertices,/const centerX = clamp\(baseX/,'Modo literal não deve deslocar vértices para evitar colisão.');
assert.match(vertices,/const baseTextX = point\.x \+ nx \* literalOffset/,'Rótulo deve permanecer geometricamente ligado ao próprio vértice.');

assert.match(dimensions,/const useContinuousOutsideChain = options\.lockNormalOffset === true && defaultPlacement === 'outside'/,'Geometrias densas devem preservar a cadeia contínua em todo o perímetro.');
assert.match(dimensions,/fallback[\s\S]*bevel|const bevel =/,'Junções densas devem possuir fallback bevel local.');
assert.match(dimensions,/const miterLimit = \(maxOffset \* 2\.45\) \+ 2\.4/,'Junções de cota devem possuir limite explícito contra espículas.');

assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');
console.log('PASS V261: loader de projeto, assinatura multipágina, vértices literais e cotas densas corrigidos.');
