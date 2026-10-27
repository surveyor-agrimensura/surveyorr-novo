import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const workspace = fs.readFileSync('assets/js/features/mapa/workspace.js','utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css','utf8').replace(/!important/g,'');
const html = fs.readFileSync('mapa/index.html','utf8');

assert.match(app,/SEARCH_MODE_STORAGE_KEY = 'surveyor:map-search-mode:v1'/,'modo principal deve possuir preferência local própria');
assert.match(app,/COORDINATE_MODE_STORAGE_KEY = 'surveyor:map-coordinate-mode:v1'/,'subtipo de coordenada deve possuir preferência local própria');
assert.match(app,/property:\s*\{ label: 'IMÓVEL'/,'modo IMÓVEL deve existir');
assert.match(app,/city:\s*\{ label: 'CIDADE'/,'modo CIDADE deve existir');
assert.match(app,/car:\s*\{ label: 'CAR'/,'modo CAR deve existir');
assert.match(app,/coordinate:\s*\{ label: 'COORDENADAS'/,'modo COORDENADAS deve existir');
assert.match(app,/function buildSearchModeMenu\(wrap\)/,'menu principal deve ter fonte única de construção');
assert.match(app,/function buildCoordinateSubtypeMenu\(wrap\)/,'COORDENADAS deve possuir submenu próprio');
assert.match(app,/SMART_COORDINATE_FORMATS\.forEach/,'submenu deve reutilizar DD, DMS, DDM, UTM e EPSG do módulo compartilhado');
assert.match(app,/function parseCoordinateForSelectedMode\(value\)/,'parser deve obedecer ao subtipo explicitamente escolhido');
assert.match(app,/if \(mode === 'epsg'\) return parseEpsgCoordinate\(raw\)/,'EPSG deve usar parser específico');
assert.match(app,/if \(mode === 'utm'\) return parseUtmCoordinate\(raw\)/,'UTM deve usar parser específico');
assert.match(app,/if \(mode === 'dms' \|\| mode === 'ddm'\) return parseDmsCoordinate\(raw\)/,'DMS e DDM devem ficar isolados no parser angular');
assert.ok(app.includes("if (/[A-Za-zÀ-ÿ]/.test(raw)) return null;"),'DD não pode aceitar texto e voltar a confundir nome de imóvel com coordenada');

const locateStart = app.indexOf('  async function locate() {');
const locateEnd = app.indexOf('  els.locateBtn.onclick', locateStart);
assert.ok(locateStart >= 0 && locateEnd > locateStart,'função locate deve existir');
const locate = app.slice(locateStart, locateEnd);
assert.match(locate,/activeSearchMode === 'car'/,'locate deve rotear CAR pelo modo selecionado');
assert.match(locate,/activeSearchMode === 'coordinate'/,'locate deve rotear coordenadas pelo modo selecionado');
assert.match(locate,/activeSearchMode === 'property'/,'locate deve rotear imóvel pelo modo selecionado');
assert.doesNotMatch(locate,/looksLikeCarSearch|looksLikeCoordinateDraft|looksLikeRuralPropertyName/,'locate não pode voltar a inferir o tipo pelo conteúdo digitado');
assert.doesNotMatch(locate,/locateRuralPropertyByName\(value\)/,'modo CIDADE não pode fazer fallback silencioso para busca de imóvel');

assert.match(css,/\.sv-search-mode-menu/,'CSS deve estilizar o seletor principal');
assert.match(css,/\.sv-coordinate-subtype-menu/,'CSS deve estilizar o segundo seletor de coordenadas');
assert.match(css,/#svCoordinateSubtypeMode/,'subtipo deve aparecer como segundo chip na própria barra');
assert.match(html,/placeholder="Digite o nome da cidade"/,'HTML deve ter fallback neutro coerente com modo inicial CIDADE');
assert.match(workspace,/O app principal conhece o modo explícito selecionado/,'workspace deve apenas encaminhar o clique da lupa');
assert.doesNotMatch(workspace,/showToast\('Digite cidade, imóvel, CAR, coordenadas geográficas/,'workspace não deve manter roteamento universal concorrente');

console.log('PASS map-explicit-search-modes: IMÓVEL, CIDADE, CAR e COORDENADAS isolados com subtipo técnico explícito.');
