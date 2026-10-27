import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/features/memorial/app.js','utf8');
const functionNames=['saveMemorialEditSettings','updateSignerUi','syncMemorialSignaturePosition','updateMemorialSignatureSelection','removeMemorialSignatureFromDocument','deleteMemorialImportedSignature'];
function extractFunction(name){
  const matched=app.match(new RegExp(`\\b(?:async )?function ${name}\\(`));
  assert(matched,`A função ${name} deve existir`);
  const start=matched.index, brace=app.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<app.length;i++){
    if(app[i]==='{')depth++;
    else if(app[i]==='}'&&!--depth)return app.slice(start,i+1);
  }
  throw new Error(`Função ${name} incompleta`);
}
function fixture({includeAccount=true,includeImported=false,hasImported=false,dbResult=true}={}){
  const state={includeSignature:includeAccount,importedSignatureEnabled:includeImported,signaturePageIndex:0,signatureX:50,signatureY:58,signatureWidth:28};
  const signer={pages:['página'],signatureDataUrl:'data:image/png;base64,YWNjb3VudA==',importedSignatureAsset:hasImported?{dataUrl:'data:image/png;base64,aW1wb3J0ZWQ=',name:'assinatura.png'}:null,pageIndex:0,x:50,y:58,width:28};
  const nodes=new Map();
  const get=(key)=>{
    if(!nodes.has(key))nodes.set(key,{style:{},classList:{toggle(){}},dataset:{},parentElement:null,hidden:false,disabled:false,checked:false,value:'',textContent:'',title:'',setAttribute(){},removeAttribute(name){delete this[name];}});
    return nodes.get(key);
  };
  const page=get('page');const overlay=get('memorialSignatureOverlay');overlay.parentElement=page;
  const embeddedSignature={style:{visibility:''},removed:false,remove(){this.removed=true;}};
  get('memorialSignaturePages').querySelectorAll=()=>[embeddedSignature];
  const events=[];const storage=new Map();
  const context=vm.createContext({
    memorialEditSettings:state,memorialSigner:signer,pdfGenerationSerial:0,
    revokePdfPreviewUrl(){events.push('pdf-invalidated');},
    localStorage:{setItem(k,v){storage.set(k,v);},getItem(k){return storage.get(k)||null;}},
    memorialEditStorageKey(){return 'memorial:projeto-atual';},
    $(id){return get(id);},
    document:{querySelectorAll(){return [];}},
    currentMemorialSignaturePage(){return page;},
    renderMemorialSignaturePages(){events.push('render');},
    clampSignerPosition(){},
    signatureNaturalRatio(){return .3;},
    memorialSignaturePlacement(ratio,offset=0){return {leftPct:35,topPct:50+(offset/2.97),widthPct:28,heightPct:6, xMm:73.5,yMm:148.5,widthMm:58.8,heightMm:17.64};},
    notifyMemorialDirty(){events.push('dirty');},
    scheduleMemorialLiveRegeneration(){
      assert(storage.has('memorial:projeto-atual'),'Regeneração não pode ocorrer antes da persistência');
      const current=JSON.parse(storage.get('memorial:projeto-atual'));
      assert.equal(current.includeSignature,state.includeSignature,'Estado da conta deve persistir antes de gerar');
      assert.equal(current.importedSignatureEnabled,state.importedSignatureEnabled,'Estado importado deve persistir antes de gerar');
      events.push('generate');
    },
    async writeMemorialImportedSignature(value){events.push('delete-file');assert.equal(value,null);return dbResult;},
    toast(message,type){events.push([message,type]);}
  });
  vm.runInContext(functionNames.map(extractFunction).join('\n')+'\n globalThis.api={updateSignerUi,removeMemorialSignatureFromDocument,deleteMemorialImportedSignature};',context);
  return {state,signer,events,storage,get,embeddedSignature,api:context.api};
}

// Caso da captura: arquivo importado inexistente, assinatura da conta marcada.
const account=fixture();
account.api.updateSignerUi();
assert.equal(account.get('memorialRemoveSignature').disabled,false,'Remover não pode ficar inativo com assinatura da conta habilitada');
assert.equal(account.get('memorialDeleteImportedSignature').hidden,true,'Exclusão de importada não deve aparecer sem arquivo importado');
assert.equal(account.embeddedSignature.removed,true,'Remover assinatura fixa do HTML para manter o layout igual ao PDF');
assert.equal(account.api.removeMemorialSignatureFromDocument(),true);
assert.equal(account.state.includeSignature,false);
assert.equal(account.get('memorialSignatureOverlay').hidden,true,'Assinatura removida não deve continuar na página');
assert.equal(account.get('memorialRemoveSignature').disabled,true);
assert.equal(JSON.parse(account.storage.get('memorial:projeto-atual')).includeSignature,false,'Remoção deve persistir');
assert.ok(account.events.includes('generate'),'Prévia/exportação devem ser regeneradas');
assert.ok(account.events.includes('pdf-invalidated'),'PDF antigo deve ser invalidado imediatamente');
assert.equal(account.signer.signatureDataUrl,'data:image/png;base64,YWNjb3VudA==','Remover não pode excluir a assinatura da conta');

// Duas assinaturas habilitadas: a remoção afeta somente a importada selecionada.
const both=fixture({includeAccount:true,includeImported:true,hasImported:true});
both.api.updateSignerUi();
assert.equal(both.embeddedSignature.removed,true,'Não conservar assinatura fixa na prévia quando a importada for selecionada');
assert.equal(both.api.removeMemorialSignatureFromDocument(),true);
assert.equal(both.state.importedSignatureEnabled,false);
assert.equal(both.state.includeSignature,true);
assert.equal(both.get('memorialSignatureOverlay').hidden,false,'Assinatura da conta permanece exibida');
assert.ok(!both.events.includes('delete-file'),'Remover da página não deve excluir o arquivo importado');
assert.equal(both.api.removeMemorialSignatureFromDocument(),true);
assert.equal(both.state.includeSignature,false);
assert.equal(both.get('memorialSignatureOverlay').hidden,true);

// Excluir arquivo importado precisa falhar com segurança se a gravação falhar.
const denied=fixture({includeImported:true,hasImported:true,dbResult:false});
assert.equal(await denied.api.deleteMemorialImportedSignature(),false);
assert.ok(denied.signer.importedSignatureAsset,'Não perder imagem na memória se a exclusão persistida falhar');
assert.ok(denied.events.some(item=>Array.isArray(item)&&item[1]==='error'));
const allowed=fixture({includeImported:true,hasImported:true});
assert.equal(await allowed.api.deleteMemorialImportedSignature(),true);
assert.equal(allowed.signer.importedSignatureAsset,null);
assert.equal(allowed.state.importedSignatureEnabled,false);
assert.ok(allowed.events.includes('generate'));

// O botão da UI deve estar vinculado à função testada, e não a um listener paralelo.
assert.match(app,/id="memorialRemoveSignature"[^>]*>Remover selecionada/);
assert.match(app,/\$\('memorialRemoveSignature'\)\?\.addEventListener\('click',\(\)=>removeMemorialSignatureFromDocument\(\)\)/);
assert.match(app,/\$\('memorialIncludeSignature'\)\?\.addEventListener\('change',[^\n]*updateMemorialSignatureSelection\(\)/);
assert.match(app,/\$\('memorialUseImportedSignature'\)\?\.addEventListener\('change',[^\n]*updateMemorialSignatureSelection\(\)/);
assert.match(app,/if \(memorialEditSettings\.includeSignature\) \{/,'Exportação PDF ainda depende do estado da assinatura da conta');
assert.match(app,/id="memorialRemoveAccountSignature"/,'Remoção específica da assinatura da conta');
assert.match(app,/id="memorialRemoveImportedSignature"/,'Remoção específica da assinatura importada');
const separate=fixture({includeAccount:true,includeImported:true,hasImported:true});
separate.api.updateSignerUi();
assert.equal(separate.api.removeMemorialSignatureFromDocument('account'),true);
assert.equal(separate.state.includeSignature,false,'Retirar a conta não pode desligar a importada');
assert.equal(separate.state.importedSignatureEnabled,true);
assert.equal(separate.api.removeMemorialSignatureFromDocument('imported'),true);
assert.equal(separate.state.importedSignatureEnabled,false);
console.log('PASS memorial-signature-removal: remoção da conta, importada, persistência, prévia, arquivos e eventos validados.');
