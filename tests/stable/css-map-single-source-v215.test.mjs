import fs from 'node:fs';
import assert from 'node:assert/strict';

const canonical = 'assets/css/features/mapa/app.css';
const removed = 'assets/css/features/mapa/workspace.css';
const css = fs.readFileSync(canonical, 'utf8').replace(/!important/g, '');
const html = fs.readFileSync('mapa/index.html', 'utf8');
const controls = fs.readFileSync('assets/js/features/mapa/controls.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const mapApp = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const build = fs.readFileSync('scripts/build.mjs', 'utf8');

assert.equal(fs.existsSync(removed), false, 'workspace.css deve ter sido eliminado fisicamente.');
assert.doesNotMatch(html, /workspace\.css/, 'HTML do mapa não pode carregar stylesheet removido.');
assert.match(css, /body\[data-page="mapa\.html"\] \.sv-map-search-host #coordSearch\{[^}]*height:40px[^}]*min-height:40px[^}]*max-height:40px/, 'Busca deve usar a dimensão canônica moderna.');
assert.match(css, /body\[data-page="mapa\.html"\] \.sv-map-toolbar-item, body\[data-page="mapa\.html"\] \.sv-map-toolbar-modern>details\{[^}]*height:46px/, 'Toolbar deve usar a dimensão compacta moderna.');
assert.match(css, /body\.georural-map-page \.geo-sidepanel\{[^}]*width:var\(--panel-w\)[^}]*grid-template-rows:58px minmax\(0,1fr\)/, 'Sidepanel deve possuir uma definição canônica moderna.');
assert.match(css, /body\.georural-map-page \.gleba-cut-actions\{[^}]*display:grid[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'Ações de gleba devem usar o layout moderno em grid.');
assert.doesNotMatch(controls, /SurveyorRuntimeHotfix2115g/, 'Runtime hotfix antigo não pode existir.');
assert.doesNotMatch(auth, /\bHotfix\b|\bHOTFIX\b/, 'Auth não pode carregar blocos identificados como hotfix.');
assert.doesNotMatch(mapApp, /SurveyorLegacyLayerCatalog|openLegacyLayerCatalogDialog|legacy-catalog-mode/, 'Catálogo legado não pode permanecer no runtime.');
assert.equal(fs.existsSync('audit-v208.html'), false, 'Artefato audit-v208.html deve ser removido da raiz.');
assert.match(build, /'audit-v208\.html'/, 'Build deve bloquear republicação acidental do artefato de auditoria removido.');

console.log('PASS css-map-single-source-v215: CSS canônico e resíduos estruturais eliminados.');
