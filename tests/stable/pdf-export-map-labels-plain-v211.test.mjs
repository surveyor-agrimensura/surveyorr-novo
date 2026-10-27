import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const typographySource = fs.readFileSync('assets/js/core/technical-svg-typography.js','utf8');
const pdfSource = fs.readFileSync('assets/js/core/pdf-preview.js','utf8');

assert.match(pdfSource,/preserveConfrontanteHalo:true, preserveAreaNameHalo:false, context:'pdf-export'/,'Exportação PDF deve preservar o halo dos confrontantes sem adicionar contornos em outros textos.');

class FakeStyle {
  constructor() { this.fontWeight=''; this.fill=''; this.stroke=''; this.strokeWidth=''; this.paintOrder=''; this.letterSpacing=''; this.fontSynthesis=''; this.fontSynthesisWeight=''; }
  removeProperty(name) {
    const map={ 'stroke':'stroke', 'stroke-width':'strokeWidth', 'paint-order':'paintOrder', 'letter-spacing':'letterSpacing' };
    if (map[name]) this[map[name]]='';
  }
}
class FakeText {
  constructor(text, attrs={}, classes=[]) { this.textContent=text; this.attrs={...attrs}; this.style=new FakeStyle(); this.nodeType=1; this.parentElement=null; this.classes=new Set(classes); }
  getAttribute(name){ return this.attrs[name] ?? null; }
  setAttribute(name,value){ this.attrs[name]=String(value); }
  removeAttribute(name){ delete this.attrs[name]; }
  matches(selector){ return selector.split(',').some((part)=>{const cls=part.trim().replace(/^\./,'');return this.classes.has(cls);}); }
  closest(selector){ let cur=this; while(cur){ if(cur.matches?.(selector)) return cur; cur=cur.parentElement; } return null; }
}
class FakeSvg extends FakeText {
  constructor(texts){ super('',{}); this.texts=texts; this.dataset={}; texts.forEach((node)=>{ node.parentElement=this; }); }
  querySelectorAll(selector){ return (selector==='text' || selector==='text,tspan') ? this.texts : []; }
}

const sandbox={ window:{}, console };
vm.runInNewContext(typographySource, sandbox, {filename:'technical-svg-typography.js'});
const typography=sandbox.window.SurveyorTechnicalSvgTypography;
assert.ok(typography, 'Política tipográfica deve existir.');

const areaName=new FakeText('JOSEFA',{'font-size':'12','font-weight':'800',fill:'#111827',stroke:'#fff','stroke-width':'2','paint-order':'stroke fill'},['sv-area-name-text']);
const confrontante=new FakeText('RIO',{'font-size':'10','font-weight':'700',fill:'#111827',stroke:'#fff','stroke-width':'1.5','paint-order':'stroke fill'},['sv-confrontante-name-text']);
const svg=new FakeSvg([areaName, confrontante]);
typography.normalize(svg,{ preserveConfrontanteHalo:true, preserveAreaNameHalo:false, context:'pdf-export' });
assert.equal(areaName.getAttribute('stroke'),'none','Nome sobre foto deve sair sem halo na finalização.');
assert.equal(areaName.getAttribute('paint-order'),'normal','Nome sobre foto deve usar paint-order normal na finalização.');
assert.equal(confrontante.getAttribute('stroke'),'#fff','Confrontante deve preservar o halo original antes de gerar as duas camadas.');
assert.equal(confrontante.getAttribute('paint-order'),'stroke fill','Normalização deve manter a semântica do texto, antes de duplicar a camada para o PDF.');

console.log('PASS pdf-export-map-labels-plain-v211: PDF preserva halo sem aplicar contorno aos outros textos técnicos.');
