import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../assets/js/features/memorial/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../../assets/css/features/memorial/signature.css',import.meta.url),'utf8');
const start=source.indexOf('  function syncMemorialSignaturePageScale(){');
const end=source.indexOf('  function renderMemorialSignaturePages(',start);
assert.ok(start>0&&end>start,'A função de escala A4 deve existir na fonte canônica');
const scales=[];
const pages=[320,736,794].map((width)=>({
  clientWidth:width,
  style:{setProperty(name,value){assert.equal(name,'--memorial-page-scale');scales.push({width,value:Number(value)});}}
}));
const host={querySelectorAll(selector){assert.equal(selector,'.memorial-sign-page');return pages;}};
const ctx=vm.createContext({$:()=>host});
vm.runInContext(source.slice(start,end)+'\nglobalThis.scalePage=syncMemorialSignaturePageScale;',ctx);
ctx.scalePage();
assert.equal(scales.length,3);
for(const item of scales){
  const target=item.width/(210*96/25.4);
  assert.ok(Math.abs(target-item.value)<1e-10,`Escala A4 errada para ${item.width}px`);
}
assert.match(css,/\.memorial-sign-page \.memorial-sign-page-bg\s*\{[^}]*width:210mm;height:297mm;[^}]*transform:scale\(var\(--memorial-page-scale,1\)\)/s,
  'O documento de fundo deve preservar A4 e usar somente escala uniforme');
assert.match(source,/host.innerHTML=pages.map[\s\S]{0,500}syncMemorialSignaturePageScale\(\)/,
  'Reconstrução do editor deve recalcular a escala A4');
assert.match(source,/ResizeObserver\(\(\)=>syncMemorialSignaturePageScale\(\)\)/,
  'Resize da bancada deve atualizar a escala do documento');
console.log('PASS memorial-a4-signature-scale: página A4 preservada para 320, 736 e 794px, escala uniforme e resize.');
