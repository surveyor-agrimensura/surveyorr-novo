import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const vertices = readFileSync('assets/js/features/mapas/vertices.js','utf8');
const begin = vertices.indexOf('    function croquiVertexMarks(');
const end = vertices.indexOf('    return Object.freeze(',begin);
assert.ok(begin>=0&&end>begin);
const ctx=vm.createContext({escape:(text)=>String(text)});
vm.runInContext(vertices.slice(begin,end)+'\nglobalThis.makeMarks=croquiVertexMarks;',ctx);
const coords=[[0,0],[50,0],[25,60],[0,0]];
const box={x:0,y:0,w:100,h:100};
const opts={strictPlacement:true,labels:['P-01','M-02','V-03'],showAnchorDots:false};
const drawing=ctx.makeMarks(coords,(coord)=>coord,box,opts);
assert.equal((drawing.match(/class="sv-vertex-anchor"/g)||[]).length,3,'Os pontos continuam como âncoras geométricas');
assert.equal((drawing.match(/fill="transparent"/g)||[]).length,3,'Pontos auxiliares não devem ser impressos');
for(const label of opts.labels)assert.ok(drawing.includes(label),'Identificações P/M/V devem permanecer no documento');
const defaultMarks=ctx.makeMarks(coords,(coord)=>coord,box,{strictPlacement:true});
assert.ok(defaultMarks.includes('fill="#dc2626"'),'Marcação de vértices padrão permanece para outras chamadas');

const maps=readFileSync('assets/js/features/mapas/app.js','utf8');
assert.equal((maps.match(/showAnchorDots: false,/g)||[]).length,3,'Três modelos de croqui devem ocultar os círculos auxiliares');
assert.match(maps,/sorted\.filter\(\(f\) => f !== feature && !\['Point','MultiPoint'\]\.includes\(f\?\.geometry\?\.type\)\)/,
  'Pontos isolados não podem retornar como feições extras no croqui');
assert.doesNotMatch(maps,/return `<circle cx="\$\{x\}" cy="\$\{y\}" r="2\.35"/, 'Planta alternativa não pode imprimir pontos auxiliares');

const start=maps.indexOf('  function isGoogleBackground(');
const stop=maps.indexOf('  function backgroundUrl(',start);
assert.ok(start>=0&&stop>start);
const tileCtx=vm.createContext({});
vm.runInContext(maps.slice(start,stop)+'\nglobalThis.base=backgroundTileBaseUrl;',tileCtx);
const history=tileCtx.base('satWayback2023','World_Imagery');
assert.equal(history,'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/56102');
assert.ok(!history.includes('server.arcgisonline.com'),'A imagem histórica deve utilizar um mosaico separado');
assert.match(maps,/if \(kind === 'satClarity' \|\| kind === 'satWayback2023'\) return '';/,
  'Quando falha, o histórico não deve trocar silenciosamente por imagem nublada');
assert.match(maps,/function printableDocumentSvg|const printableDocumentSvg/, 'O SVG exportado deve ser limpo independentemente do cache antigo');
assert.match(maps,/parsed\.querySelectorAll\('\.sv-confrontante-editor-anchors,\.sv-vertex-anchor,\.sv-editor-servitude-handle/,'Exportações também descartam controles de servidão');
const pdfPreview=readFileSync('assets/js/core/pdf-preview.js','utf8');
assert.match(pdfPreview,/stripNonPrintableSvgUi\(svg\)[\s\S]*\.sv-confrontante-editor-anchors,\.sv-vertex-anchor/,
  'O PDF remove também âncoras herdadas de projetos antigos');
const html=readFileSync('mapas/index.html','utf8');
assert.match(html,/<option value="satWayback2023">Satélite histórico \(Esri Wayback 2023\)<\/option>/);
console.log('PASS croqui-gps-point-and-wayback: círculos ocultos, etiquetas preservadas e Wayback separado da imagem atual.');
