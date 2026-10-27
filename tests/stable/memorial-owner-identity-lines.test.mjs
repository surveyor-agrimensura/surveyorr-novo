import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync('assets/js/features/memorial/app.js','utf8');
const start=src.indexOf('  function ownerIdentityRows(data){');
const end=src.indexOf('  function currentDateLong(){',start);
assert.ok(start>0 && end>start,'Funções canônicas do quadro de proprietários encontradas');
const context=vm.createContext({
  optionalIdentityValue:(value)=>String(value??'').trim(),
  escape:(value)=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
});
vm.runInContext(src.slice(start,end)+'\nglobalThis.owner={ownerIdentityRows,ownerIdentificationHtml,standardOwnerIdentification};',context);
const {ownerIdentityRows,ownerIdentificationHtml,standardOwnerIdentification}=context.owner;

const single={owner:'Proprietária Única',ownerCpf:'123.456.789-00',ownerRg:'123456'};
const one=ownerIdentityRows(single);
assert.equal(one[0].label,'PROPRIETÁRIO:');
assert.deepEqual([...one[0].values],['Proprietária Única']);
assert.deepEqual([...one[1].values],['123.456.789-00']);
assert.deepEqual([...one[2].values],['123456']);
assert.doesNotMatch(standardOwnerIdentification(single),/PROPRIETÁRIOS:/);

const double={
  owner:'Proprietária Única / Segundo Titular',ownerCpf:'123.456.789-00 / 987.654.321-00',ownerRg:'123456 / 654321',
  ownerPrimary:'Proprietária Única',ownerSecondary:'Segundo Titular',
  ownerCpfPrimary:'123.456.789-00',ownerCpfSecondary:'987.654.321-00',
  ownerRgPrimary:'123456',ownerRgSecondary:'654321'
};
const two=ownerIdentityRows(double);
assert.equal(two[0].label,'PROPRIETÁRIOS:');
assert.deepEqual([...two[0].values],['Proprietária Única','Segundo Titular']);
assert.deepEqual([...two[1].values],['123.456.789-00','987.654.321-00']);
assert.deepEqual([...two[2].values],['123456','654321']);
for(const generated of [ownerIdentificationHtml(double),standardOwnerIdentification(double),ownerIdentificationHtml(double,{tag:'span'})]){
  assert.equal((generated.match(/PROPRIETÁRIOS:/g)||[]).length,1,'Rótulo plural aparece uma vez');
  assert.equal((generated.match(/CPF\/CNPJ:/g)||[]).length,1,'Rótulo documento aparece uma vez');
  assert.equal((generated.match(/RG:/g)||[]).length,1,'Rótulo RG aparece uma vez');
  assert.ok(generated.indexOf('Segundo Titular')>generated.indexOf('Proprietária Única'));
  assert.ok(generated.indexOf('987.654.321-00')>generated.indexOf('123.456.789-00'));
  assert.ok(generated.indexOf('654321')>generated.indexOf('123456'));
  assert.ok(!generated.includes(' / '),'Sem barras para separar os documentos');
  assert.match(generated, /display:block/, 'Linhas separadas de cada titular');
}
const word=ownerIdentificationHtml(double,{tag:'span'});
assert.match(word, /<br>/, 'Word recebe divisores de linha entre nome, CPF/CNPJ e RG');

const secondWithoutDocs={...double,ownerCpfSecondary:'',ownerRgSecondary:''};
assert.deepEqual([...ownerIdentityRows(secondWithoutDocs)[0].values],['Proprietária Única','Segundo Titular']);
assert.deepEqual([...ownerIdentityRows(secondWithoutDocs)[1].values],['123.456.789-00']);
assert.deepEqual([...ownerIdentityRows(secondWithoutDocs)[2].values],['123456']);
const withoutName={...double,ownerSecondary:''};
assert.equal(ownerIdentityRows(withoutName)[0].label,'PROPRIETÁRIO:');
assert.equal(ownerIdentityRows(withoutName)[0].values.length,1);

// As rotas reais de HTML/Word/padrão e TXT devem compartilhar essa mesma fonte.
for(const token of [
  'function standardOwnerIdentification(data)',
  'function customDocxExactIdentification(data)',
  'function customIdentification(data)',
  'function agroIdentification(data)',
  "ownerIdentificationHtml(data,{tag:'span'})",
  "ownerRgSecondary=String(additionalOwner?.rg||'').trim()",
  'const ownerTextIdentity=ownerIdentityRows(wordData)',
  'ownerCpfPrimary, ownerCpfSecondary, ownerRgPrimary, ownerRgSecondary'
]) assert.ok(src.includes(token),'Ausente no Memorial: '+token);
console.log('PASS memorial-owner-identity-lines: nome, CPF e RG em linhas individuais; singular/plural e exportadores sincronizados.');
