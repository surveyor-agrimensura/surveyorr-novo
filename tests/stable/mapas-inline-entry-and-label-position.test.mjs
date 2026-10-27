import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(app,/const hasPreparedScene = Boolean\(lastSvg && lastSvgProjectId === selectedProjectId\)/,
  'Ao passar Projeto para Personalização reutilizar a mesma prévia completa.');
assert.match(app,/let mapasPersonalizationStart = null;/);
assert.match(app,/if \(mapasPersonalizationStart\) return mapasPersonalizationStart;/,
  'Evitar inicializações concorrentes por aba e ação de abertura.');
assert.match(app,/getLoadedProject: \(\) => projects\.find/);
assert.match(editor,/project = projectId && projectPerimeterFeature\(readyProject\) \? readyProject : null;/);
assert.doesNotMatch(editor.slice(editor.indexOf('async function start(startOptions = {})'),editor.indexOf('modal = document.createElement',editor.indexOf('async function start(startOptions = {})'))),/window\.GeoRuralProjects\.get\(projectId, true\)/,
  'Não forçar segunda consulta de geometria ao entrar na Personalização.');
assert.match(editor,/URL\.revokeObjectURL\(editorBackgroundObjectUrl\)/);
assert.doesNotMatch(editor,/reader\.readAsDataURL\(blob\)/);
assert.match(editor,/if \(presentationMode === 'inline'\) requestAnimationFrame.*else setZoom\(1,\{preserveFocus:false\}\)/);

// Exercitar o cálculo real da posição da chamada, inclusive quando
// não existe posição salva nem âncora (Number(null) não pode virar zero).
const functionStart=editor.indexOf('function ensureManualSegmentCallout(segment)');
const start=editor.indexOf('      const finiteCoordinate=', functionStart);
const end=editor.indexOf("      const ns='http://www.w3.org/2000/svg';",start);
assert.ok(start>0 && end>start);
const snippet=editor.slice(start,end);
function position(segment,anchors){
  const ctx={segment,
    startAnchor:anchors?.[0]??null,endAnchor:anchors?.[1]??null,
    mapFrameFromOverlay:()=>({x:100,y:200,w:600,h:400})};
  return vm.runInNewContext(`(function(){${snippet} return {cx,cy};})()`,ctx);
}
const p=position({labelX:null,labelY:null},[
  {getAttribute:(key)=>key==='cx'?'240':'360'},
  {getAttribute:(key)=>key==='cx'?'440':'560'}]);
assert.deepEqual({cx:p.cx,cy:p.cy},{cx:340,cy:460},'Rótulo centralizado entre vértices, nunca em 0,0.');
const fallback=position({labelX:null,labelY:null},null);
assert.deepEqual({cx:fallback.cx,cy:fallback.cy},{cx:400,cy:400},'Sem âncoras, manter a chamada dentro do quadro do mapa.');
const manual=position({labelX:280,labelY:510},null);
assert.deepEqual({cx:manual.cx,cy:manual.cy},{cx:280,cy:510},'Posição manual válida prevalece.');

// Testar a transformação do fundo sem codificação base64 desnecessária.
const vbStart=editor.indexOf('  async function vectorBackground(svg) {');
const vbEnd=editor.indexOf('  function nativeDocumentFromOptions',vbStart);
assert.ok(vbStart>=0 && vbEnd>vbStart);
const vbCode=editor.slice(vbStart,vbEnd);
let created=0;
const node={cloneNode:()=>({setAttribute(){},removeAttribute(){},querySelectorAll:()=>[]})};
const ctx={freezeSvgTypography:()=>{},svgViewBoxSize:()=>({width:1600,height:1000}),XMLSerializer:class {serializeToString(){return '<svg/>';}} ,Blob,
  URL:{createObjectURL:()=>{created++;return 'blob:surveyor-test';}}};
const render=vm.runInNewContext(`(function(){${vbCode};return vectorBackground;})()`,ctx);
const asset=await render(node);
assert.equal(asset.dataUrl,'blob:surveyor-test');
assert.equal(asset.objectUrl,'blob:surveyor-test');
assert.equal(created,1);
console.log('PASS: prévia única, consulta cache-first, rótulos por trecho e fundo SVG sem base64.');
