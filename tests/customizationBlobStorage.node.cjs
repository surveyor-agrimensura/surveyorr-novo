/* Simula Appwrite Storage para conferir os dois caminhos do campo options:
 * JSON inline legado e documento extenso criptografado com ponteiro.
 * Testes locais não substituem ambiente Appwrite de produção. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const source=fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
const begin=source.indexOf('const CUSTOMIZATION_OPTIONS_INLINE_LIMIT = 60000;');
const end=source.indexOf('function hasUsefulCustomization(value = {}) {',begin);
assert(begin>=0&&end>begin,'rotinas de armazenamento não encontradas');
const memory=new Map();let id=0,deleted=[];
const env={
 Buffer,crypto,
 customizationOptions:row=>typeof row.options==='string'?JSON.parse(row.options):row.options||{},
 sha256Hex:content=>crypto.createHash('sha256').update(String(content),'utf8').digest('hex'),
 statusError:(status,message,details)=>Object.assign(new Error(message),{status,details}),
 encryptJsonText:(obj,{aad})=>JSON.stringify({aad,data:obj}),
 decryptJsonText:(blob,{aad})=>{const p=JSON.parse(blob);assert.equal(p.aad,aad);return p.data},
 readFileText:async(_bucket,file)=>memory.get(file)||'',
 createFile:async(_bucket,_name,text,_type,file)=>{memory.set(file,text);return {$id:file}},
 deleteFile:async(_bucket,file)=>{deleted.push(file);memory.delete(file)},
 bucketId:value=>value,
 appwriteId:()=>`01234567-${++id}`
};
const helpers=new Function(...Object.keys(env),`${source.slice(begin,end)}\nreturn {stageCustomizationOptions,readHydratedCustomizationOptions};`)(...Object.values(env));
(async()=>{
 const original={documentIdentity:{companyName:'Empresa São José'}, documentOptions:{croquiDraftsByFeature:{'property:a':{labelColors:{'vertex:1':'#0000ff'},labelAngles:{'vertex:1':-37},easements:[{id:'s1',points:[{x:9,y:4},{x:19,y:26}],visible:false}],labelOffsets:{'area:polygon':{dx:130,dy:-58}},svg:'<text fill="#00f">Sítio</text>'}}}};
 const small=await helpers.stageCustomizationOptions('owner-a',original);
 assert.equal(typeof small.rowValue,'string');
 assert.equal(small.stagedFileId,'');
 assert.deepEqual(await helpers.readHydratedCustomizationOptions({options:small.rowValue,userId:'owner-a'}),original,'leitura do legado inline');
 const big=structuredClone(original);
 big.documentOptions.croquiDraftsByFeature['property:a'].photoOverlay={src:'data:image/png;base64,'+'A'.repeat(180000),x:120,y:85,size:160};
 const staged=await helpers.stageCustomizationOptions('owner-a',big);
 assert.notEqual(staged.stagedFileId,'');
 assert(Buffer.byteLength(staged.rowValue,'utf8')<65535,'string Appwrite dentro do limite');
 assert.deepEqual(await helpers.readHydratedCustomizationOptions({options:staged.rowValue,userId:'owner-a'}),big,'nenhuma propriedade descartada');
 assert(memory.get(staged.stagedFileId)?.length>180000,'foto, SVG, vértices e estilos no Storage');
 memory.set(staged.stagedFileId,memory.get(staged.stagedFileId).replace('Sítio','EDITADO'));
 await assert.rejects(helpers.readHydratedCustomizationOptions({options:staged.rowValue,userId:'owner-a'}),/integridade/i,'corrupção precisa bloquear releitura');
 memory.delete(staged.stagedFileId);
 await assert.rejects(helpers.readHydratedCustomizationOptions({options:staged.rowValue,userId:'owner-a'}),/integridade/i,'arquivo ausente bloqueia atualização');
 const invalid={options:JSON.stringify({__surveyorOptionsBlob:{version:1,fileId:'bad'}}),userId:'owner-a'};
 await assert.rejects(helpers.readHydratedCustomizationOptions(invalid),/referência/i);
 assert.equal(deleted.length,0,'sem descartar dados na leitura');
 console.log('SURVEYOR: armazenamento Appwrite options, inline, 180 KB, fidelidade de SVG/foto, UTF-8, corrupção e referência: 8 cenários aprovados.');
})().catch(e=>{console.error(e);process.exitCode=1});
