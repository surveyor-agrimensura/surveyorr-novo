import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const mapHtml = fs.readFileSync('mapa/index.html', 'utf8');
const mapApp = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const mapUx = fs.readFileSync('assets/js/features/mapa/ux.js', 'utf8');
const importJs = fs.readFileSync('assets/js/features/mapa/import.js', 'utf8');
const mapsApp = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8').replace(/!important/g,'');

// RW5/RAW must be a first-class import format and parse real survey point records.
assert.match(mapHtml, /accept="[^"]*\.rw5[^\"]*\.raw/, 'entrada principal deve aceitar RW5 e RAW');
assert.match(importJs, /function parseRw5\(text\)/, 'importador RW5 deve existir');
assert.match(importJs, /parseRw5,/, 'parseRw5 deve fazer parte da API de importação');
const sandbox = { window: { addEventListener(){}, removeEventListener(){} }, console, setTimeout, clearTimeout, Map, Blob, TextEncoder, TextDecoder };
vm.createContext(sandbox);
vm.runInContext(importJs, sandbox, { filename: 'import.js' });
const rw5 = sandbox.window.GeoRuralLayerImport.parseRw5('SP,PN1,N 8551000.000,E 454500.000,EL 320.50,--MARCO 1\nSP,PN2,N 8551010.000,E 454520.000,EL 321.10,--MARCO 2');
assert.equal(rw5.features.length, 2, 'RW5 deve recuperar todos os pontos válidos');
assert.deepEqual(Array.from(rw5.features[0].geometry.coordinates), [454500, 8551000], 'RW5 deve preservar E/N projetados para normalização CRS posterior');
assert.equal(rw5.features[0].properties.elevation, 320.5, 'RW5 deve preservar elevação');

// CAD manual dimensions persist in project metadata and affect save-state signature.
assert.match(mapHtml, /data-draw-tool="cad-dimension"/, 'menu CAD deve expor cotagem manual');
assert.match(mapApp, /function beginManualDimensionTool\(\)/, 'cotagem manual deve ter interação própria');
assert.match(mapApp, /manualDimensions:list/, 'cotas devem persistir no metadata do projeto');
assert.match(mapApp, /manualDimensions: manualDimensionItems\(\)/, 'cotas devem participar da assinatura de conteúdo e do salvamento');
assert.match(mapApp, /currentProjectMetadata = project\.metadata \|\| \{\};\s*renderManualDimensions\(\);/, 'cotas devem ser restauradas ao carregar projeto');
assert.match(css, /\.sv-manual-dimension-label/, 'cotagem deve possuir rótulo técnico próprio');
assert.match(mapApp, /cadSegmentLabelPlacement\(q1, q2, \{ offset: 8, side: 'above' \}\)/, 'cota manual deve posicionar medida acima da linha');
assert.match(mapApp, /const size = 5\.5;[\s\S]*const wing = 3\.2;/, 'setas da cotagem manual devem permanecer compactas');
assert.match(css, /\.sv-manual-dimension-label\{[\s\S]*font:800 9px\/1 Arial/, 'rótulo da cota manual deve ser compacto e sem balão');

// Certified neighbors use official SIGEF/SNCI point queries and never fabricate geometry.
assert.match(mapHtml, /data-draw-tool="sig-certified-neighbors"/, 'SIG deve expor vizinhos certificados');
assert.match(mapApp, /async function analyzeCertifiedNeighbors\(\)/, 'analisador de vizinhos certificados deve existir');
assert.match(mapApp, /fetchIncraRegistryResult\(L\.latLng\(probe\.lat, probe\.lng\), 'sigef'\)/, 'análise deve consultar SIGEF');
assert.match(mapApp, /fetchIncraRegistryResult\(L\.latLng\(probe\.lat, probe\.lng\), 'snci'\)/, 'análise deve usar SNCI como fallback');
assert.match(mapApp, /geometria vetorial do vizinho não é inventada/, 'UI deve deixar explícita a limitação da consulta pontual oficial');

// Terrain elevation and navigation preferences are browser-local utilities.
assert.match(mapHtml, /data-draw-tool="terrain-elevation-click"/, 'Terreno deve expor consulta de altitude por clique');
assert.match(mapApp, /function terrainOperationElevationClick\(\)/, 'consulta DEM por clique deve existir');
assert.match(mapApp, /terrainElevationAt\(event\.latlng\.lng, event\.latlng\.lat\)/, 'consulta deve reutilizar o DEM oficial do módulo de terreno');
assert.match(mapHtml, /id="mapNavigationSettingsBtn"/, 'menu do projeto deve expor preferências de navegação');
assert.match(mapApp, /surveyor:map-navigation-preferences:v1/, 'preferências devem ser locais ao navegador');
assert.match(mapApp, /wheelPxPerZoomLevel/, 'sensibilidade da roda deve ser configurável');
assert.match(css, /--sv-map-ui-scale:1/, 'escala visual dos controles deve ser suportada');

// Technical coordinate table must be an optional real SVG object in technical output.
assert.match(editor, /coordinateTableEnabled/, 'editor técnico deve controlar tabela de coordenadas');
assert.match(editor, /syncCoordinateTableOverlay\(\)/, 'editor deve renderizar tabela no overlay técnico');
assert.match(mapsApp, /function technicalCoordinateTableSvg\(/, 'gerador deve possuir renderer da tabela técnica');
assert.ok((mapsApp.match(/technicalCoordinateTableSvg\(coords, mapBox/g) || []).length >= 2, 'tabela deve estar disponível nos principais layouts de prancha');
assert.match(mapsApp, /getCoordinateRows:\s*\(\)\s*=>/, 'editor deve receber coordenadas reais do perímetro');

// New tools stay in their contextual CAD/SIG/Terrain menus; generic quick drawer remains compact.
assert.match(mapUx, /'cad-dimension':/, 'ícone da cotagem CAD deve existir');
assert.doesNotMatch(mapUx, /label: 'Cotar manualmente'.*quickToolDefinitions/s, 'cotagem não deve inflar a grade genérica de atalhos');

console.log('PASS advanced-survey-tools: RW5, cotagem CAD, vizinhos certificados, DEM, navegação e tabela técnica validados.');
