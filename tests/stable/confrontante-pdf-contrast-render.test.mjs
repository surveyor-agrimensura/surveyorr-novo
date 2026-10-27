import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('assets/js/core/pdf-preview.js','utf8');
const begin = src.indexOf('  function addPrintableConfrontanteOutlines(svg) {');
const end = src.indexOf('  function normalizeVectorSvgTypography(svg) {', begin);
assert.ok(begin > 0 && end > begin, 'Preparador de contorno para PDF deve existir.');
const source = src.slice(begin,end);
const testFn = vm.runInNewContext(`${source}\naddPrintableConfrontanteOutlines;`);

function textNode(label, fill, cssClass = 'sv-confrontante-name-text') {
  const attributes = new Map(Object.entries({ class:cssClass, fill, 'font-size':'11', 'stroke-width':'1.7', stroke:'#ffffff', 'paint-order':'stroke fill' }));
  const node = {
    textContent:label, parentNode:null,
    style:{ fill:'', removeProperty() {} },
    getAttribute(key){ return attributes.get(key) ?? null; },
    setAttribute(key,value){ attributes.set(key,String(value)); },
    removeAttribute(key){ attributes.delete(key); },
    cloneNode(){ return textNode(label, attributes.get('fill'), attributes.get('class')); }
  };
  return node;
}
function scene(texts) {
  const nodes = [...texts];
  const parent = { insertBefore(copy,ref){ const index=nodes.indexOf(ref); assert.ok(index>=0); nodes.splice(index,0,copy); copy.parentNode=parent; } };
  texts.forEach((text) => { text.parentNode=parent; });
  return { nodes, querySelectorAll(selector){
    assert.equal(selector,'.sv-confrontante-name-text,.sv-confrontante-cpf-text');
    return nodes.filter((node) => ['sv-confrontante-name-text','sv-confrontante-cpf-text'].includes(node.getAttribute('class')));
  } };
}
const white=textNode('CONFRONTANTE CLARO', '#ffffff');
const black=textNode('CONFRONTANTE ESCURO', '#111827');
const cpf=textNode('CPF', '#ffffff', 'sv-confrontante-cpf-text');
const svg=scene([white,black,cpf]);
testFn(svg);
assert.equal(svg.nodes.length,6,'Cada nome e CPF deve possuir contorno e primeiro plano.');
assert.equal(svg.nodes[0].getAttribute('class'),'sv-pdf-confrontante-halo');
assert.equal(svg.nodes[0].getAttribute('fill'),'none','Nome branco não recebe fundo escuro.');
assert.equal(svg.nodes[0].getAttribute('stroke'),'#111827','Nome branco recebe apenas borda escura.');
assert.ok(Number(svg.nodes[0].getAttribute('stroke-width')) <= 1,'Borda fina, sem unir os caracteres em uma tarja.');
assert.equal(white.getAttribute('fill'),'#ffffff','Nome branco preserva a cor solicitada.');
assert.equal(white.getAttribute('stroke'),'none','O contorno nunca cobre a tinta branca na frente.');
assert.equal(svg.nodes[2].getAttribute('fill'),'none','Nome escuro também não recebe preenchimento por trás.');
assert.equal(svg.nodes[2].getAttribute('stroke'),'#ffffff','Nome escuro recebe contorno claro.');
assert.equal(black.getAttribute('fill'),'#111827');
assert.equal(svg.nodes[4].getAttribute('fill'),'none','CPF branco não deve receber fundo preto.');
assert.equal(svg.nodes[4].getAttribute('stroke'),'#111827','CPF branco recebe borda fina.');
testFn(svg);
assert.equal(svg.nodes.length,6,'Preparador de halo deve ser idempotente.');
console.log('PASS: contorno PDF vazado (sem tarja) para confrontantes e CPF, preserva cor, ordem e não duplica.');
