import assert from 'node:assert/strict';
import {parseConfrontantText,suggestEdgeDirections} from '../src/lib/confrontantPaste.ts';
const cases=[
  ['LESTE - PESSOA LESTE – 123.456.789-10\nOESTE – PESSOA OESTE – 234.567.890-11\nNORTE – PESSOA NORTE – 345.678.901-22\nSUL – PESSOA SUL - 456.789.012-33',4],
  ['Norte: Dona Maria, CPF: 34567890122; Sul: Carlos Pessoa CPF 45678901233',2],
  ['LESTE - TESTE LESTE',1],
  ['NORTE – ALFA 12.345.678/0001-01\nSUL – BETA 11122233344',2],
  ['Sem direção nenhuma',0],
];
let assertions=0;
for(const [content,count] of cases){const result=parseConfrontantText(content);assert.equal(result.records.length,count);assert.equal(new Set(result.records.map(r=>r.side)).size,count);assertions+=2;}
const four=parseConfrontantText(cases[0][0]);assert.equal(four.records.find(v=>v.side==='LESTE')?.document,'123.456.789-10');assert.equal(four.records.find(v=>v.side==='OESTE')?.name,'PESSOA OESTE');assertions+=2;
assert.deepEqual(suggestEdgeDirections([[0,0],[2,0],[2,2],[0,2]]),['SUL','LESTE','NORTE','OESTE']);
assert.deepEqual(suggestEdgeDirections([[0,0],[0,2],[2,2],[2,0]]),['OESTE','NORTE','LESTE','SUL']);
assert.deepEqual(suggestEdgeDirections([[0,0],[2,0],[2,2],[0,2],[0,0]]),['SUL','LESTE','NORTE','OESTE']);
assertions+=3;
console.log(`Importação de confrontantes: ${assertions} verificações passaram.`);
