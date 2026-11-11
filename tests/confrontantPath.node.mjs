import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveConfrontantPath, suggestedConfrontantDirection, confrontantPathSummary} from '../src/features/croqui/confrontantRange.ts';
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++};
const equal=(actual,expected,msg)=>{assert.deepEqual(actual,expected,msg);checks++};
const numbered=Array.from({length:25},(_,i)=>`V-${String(i+1).padStart(2,'0')}`);
const reversed=[numbered[0],...numbered.slice(1).reverse()];
const v3=numbered.indexOf('V-03'),v25=numbered.indexOf('V-25');
const rev3=reversed.indexOf('V-03'),rev25=reversed.indexOf('V-25');
// No anel invertido, V03 a V25 deve seguir a numeração, não o índice crescente.
equal(suggestedConfrontantDirection(reversed,rev3,rev25),'reverse','ordem geométrica inversa');
const path=resolveConfrontantPath(reversed,rev3,rev25,'auto');
equal(path.vertices.map(i=>reversed[i]),numbered.slice(2),'V03 ... V25 seguindo a numeração');
check(path.edges.length===22,'22 segmentos do intervalo selecionado');
check(new Set(path.edges).size===path.edges.length,'sem arestas repetidas');
check(path.edges.every(edge=>edge>=0&&edge<25),'arestas válidas');
// Mesmo no sentido direto da geometria deve haver escolha explícita do percurso alternativo.
const shorter=resolveConfrontantPath(reversed,rev3,rev25,'forward');
check(shorter.edges.length===3,'caminho alternativo com 3 arestas');
check(new Set([...path.edges,...shorter.edges]).size===25,'dois caminhos particionam o anel');
const forward=resolveConfrontantPath(numbered,v3,v25,'auto');
equal(forward.direction,'forward','sem inversão da ordem original');
equal(forward.vertices.map(i=>numbered[i]),numbered.slice(2),'sequência normal V03 até V25');
const wrap=resolveConfrontantPath(numbered,24,1,'forward');
equal(wrap.edges,[24,0],'fechamento do polígono V25 -> V01 -> V02');
const backWrap=resolveConfrontantPath(numbered,1,24,'reverse');
equal(backWrap.edges,[0,24],'caminho reverso V02 -> V01 -> V25');
const original=Array.from({length:25},(_,i)=>`confrontante ${i}`),updated=[...original];
for(const edge of path.edges)updated[edge]='novo confrontante';
for(const edge of shorter.edges)check(updated[edge]===original[edge],'não altera o lado oposto');
check(confrontantPathSummary(numbered,forward.vertices).includes('…'),'resumo compacto para trechos longos');
for(const input of [[numbered,-1,2],[numbered,2,2],[numbered,2,25],[numbered,25,2]]){
 assert.throws(()=>resolveConfrontantPath(...input,'auto'),/vértices diferentes e válidos/); checks++;
}
for (const file of ['../src/features/croqui/CroquiPage.tsx','../src/features/documents/TechnicalSheetsPage.tsx']) {
 const src=readFileSync(new URL(file,import.meta.url),'utf8');
 check(src.includes('resolveConfrontantPath('),'editores devem usar a mesma regra');
 check(src.includes('Caminho da confrontação'),'escolha de sentido disponível na interface');
 check(!src.includes('for(let j=i;j!==neighborUntil;j=(j+1)%count)'), 'percurso anterior removido');
}
console.log(`${checks} verificações de confrontações aprovadas.`);
