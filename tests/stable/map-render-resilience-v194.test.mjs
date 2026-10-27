import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js', 'utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const mapsApp = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const dimensions = fs.readFileSync('assets/js/features/mapas/dimensions.js', 'utf8');

assert.match(bridge, /dimensionColor: normalizeHexColor\(safe\(value\?\.dimensionColor\)\.trim\(\), '#111827'\)/, 'Normalização oficial deve persistir a cor global das cotas.');
assert.match(bridge, /function readableLabelColor\(/, 'Bridge deve expor utilitário de legibilidade para nomes da gleba.');
assert.match(editor, /data-document-setting="dimensionColor"/, 'Editor técnico deve permitir escolher a cor das cotas.');
assert.match(editor, /documentSettings\.dimensionColor=normalizeHexColor\(event\.target\.value,'#111827'\)/, 'Mudança da cor das cotas deve persistir no layout oficial.');
assert.match(editor, /group\?\.querySelectorAll\?\.\('\.sv-cad-dimension-line, \.sv-cad-dimension-tick'\)\.forEach\(\(lineNode\)=>lineNode\.setAttribute\('stroke',color\)\)/, 'Editor deve aplicar a cor das cotas às linhas auxiliares.');
assert.match(dimensions, /const dimensionVisual = ownerRaw === 'perimeter' \? elementVisuals\.cotas : elementVisuals\.glebaCotas;[\s\S]*const lineColor = String\(options\.lineColor \|\| dimensionVisual\?\.color \|\| visualSettings\.dimensionColor \|\| '#111827'\)/, 'Renderizador das cotas deve herdar a cor do cartão correspondente e manter compatibilidade com a cor legada.');
assert.match(dimensions, /data-dimension-color="\$\{escape\(lineColor\)\}"/, 'SVG das cotas deve transportar a cor efetiva para reedição.');
assert.match(mapsApp, /function backgroundUrls\(/, 'Renderização do mapa deve ter fallback encadeado para o fundo cartográfico.');
assert.match(mapsApp, /resolveBackgroundImage\(backgroundKind, backgroundBounds, backgroundWidth, backgroundHeight, zoom/, 'Pré-visualização deve usar a cadeia resiliente de fundo cartográfico.');
assert.match(mapsApp, /function arcgisTileBackgroundDataUrl\(/, 'Renderização deve possuir mosaico de tiles ArcGIS para o fundo cartográfico.');
assert.match(mapsApp, /function arcgisRasterLooksUnavailable\(/, 'Renderer deve rejeitar o tile cinza de indisponibilidade devolvido pelo ArcGIS.');
assert.match(mapsApp, /if \(kind === 'satClarity' \|\| kind === 'satWayback2023'\) return 18;/, 'Fontes históricas Esri devem limitar o LOD ao nível de cobertura publicado.');
assert.match(mapsApp, /function georefSheet\([\s\S]*renderOptions = \{\}/, 'Prancha georreferenciada deve receber renderOptions por padrão para evitar ReferenceError.');
assert.match(mapsApp, /return georefSheet\([\s\S]*renderOptions \}\);/, 'Fluxo de geração deve repassar renderOptions ao renderer georreferenciado.');

console.log('PASS map-render-resilience-v194: satélite resiliente, cotas com cor editável e prancha sem ReferenceError.');
