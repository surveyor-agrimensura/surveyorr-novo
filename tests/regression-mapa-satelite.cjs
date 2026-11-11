/* Regressão: o zoom percentual fracionário deve usar tiles XYZ de nível inteiro
 * e conservar a projeção geográfica dos vértices em relação ao raster. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const file=fs.readFileSync('src/features/memorial/memorialEngine.ts','utf8');
const snippet=file.slice(file.indexOf('export type MapTile='),file.indexOf('\nexport ',file.indexOf('export function mapLayout(')+30));
// A rotina está no fim do arquivo: caso a seleção termine vazia, pegamos até EOF.
const code=ts.transpileModule('type Vertex=[number,number]; type SurveyPolygon={vertices:Vertex[]};\n'+(snippet.includes('export function mapLayout')?snippet:file.slice(file.indexOf('export type MapTile='))),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const box={exports:{}};
vm.runInNewContext(code,{exports:box.exports,Math,Number,Array,vertexName:i=>`V-${i+1}`});
const poly={vertices:[[-39.52,-13.11],[-39.517,-13.11],[-39.517,-13.107],[-39.52,-13.107]]};
const base=box.exports.mapLayout(poly,800,480);
for(const fractional of [.01,.35,.67,.99,2.51]){
 const map=box.exports.mapLayout(poly,800,480,fractional,'satellite',17);
 assert.ok(map.tiles.length>0);
 assert.ok(!Number.isInteger(map.zoom));
 for(const tile of map.tiles){
   const z=Number(tile.url.match(/\/tile\/(\d+)\//)?.[1]);
   assert.ok(Number.isInteger(z),tile.url);
   assert.ok(z<=17);
 }
 for(const p of map.points){
  assert.ok(map.tiles.some(tile=>p.x>=tile.left-0.01&&p.x<=tile.left+tile.tileSize+0.01&&p.y>=tile.top-0.01&&p.y<=tile.top+tile.tileSize+0.01));
 }
}
const withVisualShift=box.exports.mapLayout(poly,800,480,.35,'satellite',17,180);
const withoutVisualShift=box.exports.mapLayout(poly,800,480,.35,'satellite',17,0);
assert.ok(withVisualShift.tiles.length>=withoutVisualShift.tiles.length);
assert.deepEqual(Array.from(withVisualShift.points,p=>[p.x,p.y]),Array.from(withoutVisualShift.points,p=>[p.x,p.y]));
const exact=box.exports.mapLayout(poly,800,480,0,'street',19);
assert.equal(exact.zoom,base.zoom);
console.log('SURVEYOR: tiles XYZ inteiros e alinhamento básico raster/vértices aprovados.');
