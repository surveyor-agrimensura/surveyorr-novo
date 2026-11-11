import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeScopedDraftPatch,validateScopedDraftInput,compactMirroredDocumentOptions} from '../functions/surveyor-api/src/documents/scoped-draft.js';
import {encryptJsonText,decryptJsonText} from '../functions/surveyor-api/src/security/crypto.js';

let count=0;
const check=(condition,message)=>{assert(condition,message);count++;};
const json=value=>JSON.stringify(value);
const projects={};
const shared={};
for(let index=1;index<=6;index++){
 const id=`project-${index}`;
 projects[id]={};shared[id]={};
 for(let part=1;part<=4;part++){
  projects[id][`gleba-${part}`]={title:`P${index} G${part}`,signature:'data:image/png;base64,'+'A'.repeat(30000),revision:part};
  shared[id][`gleba-${part}`]={polygonFill:'#abcdef'};
 }
}
const oldOptions={
 documentIdentityByProject:{'project-6':{reference:'antiga',owner:'João'}},
 layerPreferences:[{id:'rl',enabled:true}],
 croquiDraftsByFeature:{'project-6':{'gleba-1':{custom:'preservado'}}},
 generatedDocumentDraftsByFeature:{technicalSheets:projects},
 mapAppearanceByFeature:shared,
 documentOptions:{generatedDocumentDraftsByFeature:{technicalSheets:projects},mapAppearanceByFeature:shared}
};
const changed={title:'Gleba 04 - Atualizada',revision:245,polygonFill:'#00aaff',divisionColors:{'feature:0':'#12ab34'},technicalLines:[{id:'a',start:{x:1,y:2},end:{x:3,y:4}}],signature:'data:image/png;base64,'+'B'.repeat(100000)};
const userPayload={kind:'technicalSheets',projectId:'project-6',featureId:'gleba-4',data:changed,mapAppearance:{polygonFill:'#00aaff',divisionColors:{'feature:0':'#12ab34'}}};
const originalBytes=Buffer.byteLength(json(oldOptions),'utf8');
const requestBytes=Buffer.byteLength(json(userPayload),'utf8');
check(requestBytes<originalBytes/5,'o pedido deve enviar apenas um documento, não todo o histórico');
const patch=makeScopedDraftPatch(oldOptions,userPayload);
check(!Object.hasOwn(userPayload,'options'),'o request não deve carregar options completo');
check(patch.generatedDocumentDraftsByFeature.technicalSheets['project-6']['gleba-4'].revision===245,'revisão atualizada');
check(patch.generatedDocumentDraftsByFeature.technicalSheets['project-6']['gleba-3'].revision===3,'outras glebas preservadas');
check(patch.generatedDocumentDraftsByFeature.technicalSheets['project-1']['gleba-1'].title==='P1 G1','outros projetos preservados');
check(patch.mapAppearanceByFeature['project-6']['gleba-3'].polygonFill==='#abcdef','mapa de outra gleba preservado');
check(patch.mapAppearanceByFeature['project-6']['gleba-4'].divisionColors['feature:0']==='#12ab34','cor selecionada salva');
check(patch.documentIdentityByProject['project-6'].reference==='antiga','identidade anterior preservada');
const combined={...oldOptions,...patch,documentOptions:{...oldOptions.documentOptions,...patch}};
const lean=compactMirroredDocumentOptions(combined);
check(!Object.hasOwn(lean,'generatedDocumentDraftsByFeature'),'cópia externa idêntica não deve ser salva duas vezes');
check(Object.hasOwn(lean,'layerPreferences'),'preferências alheias preservadas');
check(Object.hasOwn(lean,'croquiDraftsByFeature'),'croqui preservado');
check(lean.documentOptions.generatedDocumentDraftsByFeature.technicalSheets['project-6']['gleba-4'].signature===changed.signature,'imagem/assinatura intacta');
const memorialGlobal=makeScopedDraftPatch(oldOptions,{kind:'memorial',projectId:'project-6',featureId:'',data:{fields:{owner:'Manuel'}}});
check(memorialGlobal.generatedDocumentDrafts.memorial['project-6'].fields.owner==='Manuel','Memorial legado sem feição continua compatível');
const conflict=compactMirroredDocumentOptions({oldRecord:{revision:1},documentOptions:{oldRecord:{revision:2}}});
check(conflict.oldRecord.revision===1,'cópia divergente não pode ser descartada');
assert.throws(()=>validateScopedDraftInput({kind:'technicalSheets',projectId:'P',featureId:'',data:{}}),/gleba/);count++;
assert.throws(()=>validateScopedDraftInput({kind:'technicalSheets',projectId:'P',featureId:'G',data:[]}),/inválido/);count++;
process.env.SURVEYOR_CRYPTO_ACTIVE_KEY='v1';process.env.SURVEYOR_DATA_KEY_V1=crypto.randomBytes(32).toString('base64');
const encrypted=encryptJsonText(lean,{aad:'customization-options:owner-1'});
const recovered=decryptJsonText(encrypted,{aad:'customization-options:owner-1'});
check(json(recovered)===json(lean),'arquivo criptografado reaberto sem perda');
const pointer={__surveyorOptionsBlob:{version:1,fileId:crypto.randomUUID(),sha256:crypto.createHash('sha256').update(encrypted).digest('hex'),bytes:Buffer.byteLength(encrypted,'utf8')}};
check(Buffer.byteLength(json(pointer),'utf8')<65535,'referência cabe no campo options');
const src=fs.readFileSync(new URL('../functions/surveyor-api/src/main.js',import.meta.url),'utf8');
const browser=fs.readFileSync(new URL('../src/features/documents/cloudDraft.ts',import.meta.url),'utf8');
check(src.includes("path === '/api/customization/document/draft'"),'rota está incluída na API');
check(browser.includes('saveScopedDocumentCustomization(session,payload)'),'frontend usa a nova rota');
console.log(`OK: ${count} verificações de rascunho pontual, dados legados, 24 glebas, Storage, criptografia e endpoint.`);
console.log(`Payload anterior estimado: ${originalBytes} bytes; envio de uma prancha: ${requestBytes} bytes; redução ${(100*(1-requestBytes/originalBytes)).toFixed(1)}% neste cenário sintético.`);
