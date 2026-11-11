/** Contrato de salvamento com servidor Appwrite simulado: REST de banco + Storage.
 * Executa o cliente real, validacao de schema, criptografia real AES-GCM e
 * rotinas reais de serializacao do SURVEYOR. Sem credenciais externas. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createAppwriteClient } from '../functions/surveyor-api/src/appwrite/client.js';
import { encryptJsonText, decryptJsonText } from '../functions/surveyor-api/src/security/crypto.js';

process.env.SURVEYOR_CRYPTO_ACTIVE_KEY = 'v1';
process.env.SURVEYOR_DATA_KEY_V1 = crypto.randomBytes(32).toString('base64');
const rows = new Map();
const files = new Map();
const calls = [];
let next = 0;
const appwriteId = () => crypto.randomUUID();
const statusError = (status, message, details = {}) => Object.assign(new Error(message), { status, details });
const fakeFetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const path = new URL(String(url)).pathname.replace(/^\/v1/, '');
  calls.push({ path, method });
  const json = (obj, status=200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type':'application/json' } });
  const rowPath = '/databases/surveyor_db/collections/customization/documents';
  if (path === rowPath && method === 'POST') {
    const payload = JSON.parse(options.body);
    const value = payload.data?.options;
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 65535) return json({message:"Invalid document structure: Attribute 'options' has invalid type. Value must be a valid string no longer than 65535 bytes."},400);
    const row = {...payload.data,$id:payload.documentId};
    rows.set(row.$id, row);return json(row,201);
  }
  const m = path.match(/^\/databases\/surveyor_db\/collections\/customization\/documents\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (method === 'PATCH') {
      const data = JSON.parse(options.body).data;
      if (typeof data.options !== 'string' || Buffer.byteLength(data.options,'utf8') > 65535) return json({message:"Invalid document structure: Attribute 'options' has invalid type. Value must be a valid string no longer than 65535 bytes."},400);
      const stored={...rows.get(id),...data};rows.set(id,stored);return json(stored);
    }
    if (method === 'GET') return rows.has(id)?json(rows.get(id)):json({message:'Not found'},404);
  }
  if (path === '/storage/buckets/user_assets/files' && method === 'POST') {
    const fileId=String(options.body.get('fileId'));
    files.set(fileId,await options.body.get('file').text());
    return json({$id:fileId},201);
  }
  const assetMatch=path.match(/^\/storage\/buckets\/user_assets\/files\/([^/]+)\/(download|view)$/);
  if (assetMatch && method === 'GET') {
    const value=files.get(assetMatch[1]);
    return value === undefined?json({message:'Not found'},404):new Response(value,{status:200,headers:{'content-type':'application/octet-stream'}});
  }
  const deleteMatch=path.match(/^\/storage\/buckets\/user_assets\/files\/([^/]+)$/);
  if(deleteMatch && method==='DELETE') {files.delete(deleteMatch[1]);return new Response(null,{status:204});}
  throw Error(`Endpoint nao simulado: ${method} ${path}`);
};
const previousFetch=globalThis.fetch;
globalThis.fetch=fakeFetch;
const client=createAppwriteClient({env:(key,fallback='')=>({
  APPWRITE_ENDPOINT:'https://mock.appwrite.invalid/v1', APPWRITE_PROJECT_ID:'test-project',
  APPWRITE_DATABASE_ID:'surveyor_db', APPWRITE_API_KEY:'fake-key-for-test-only'
}[key]||fallback),statusError,appwriteId,normalizeEmail:v=>String(v).toLowerCase()});
try {
  const source=fs.readFileSync(new URL('../functions/surveyor-api/src/main.js',import.meta.url),'utf8');
  const begin=source.indexOf('const CUSTOMIZATION_OPTIONS_INLINE_LIMIT = 60000;');
  const end=source.indexOf('function hasUsefulCustomization(value = {}) {',begin);
  assert(begin>=0&&end>begin);
  const context={
    Buffer,sha256Hex:txt=>crypto.createHash('sha256').update(String(txt),'utf8').digest('hex'),
    statusError,customizationOptions:row=>typeof row.options==='string'?JSON.parse(row.options):row.options||{},
    readFileText:client.readFileText,createFile:client.createFile,deleteFile:client.deleteFile,
    encryptJsonText,decryptJsonText,bucketId:v=>v,appwriteId
  };
  const helpers=new Function(...Object.keys(context),`${source.slice(begin,end)}\nreturn {stageCustomizationOptions,readHydratedCustomizationOptions}`)(...Object.values(context));
  const old={documentOptions:{croquiDraftsByFeature:{p1:{g1:{title:'SÍTIO DEUS DARÁ',labelColors:{nome:'#0033ff'}}}}}};
  const legacyRow=await client.createRow('customization',{userId:'owner-1',options:JSON.stringify(old),createdAt:'2026-10-30T11:00:00.000Z'});
  assert.deepEqual(await helpers.readHydratedCustomizationOptions(await client.getRow('customization',legacyRow.$id)),old,'compatibilidade de croqui antigo');
  const big=structuredClone(old);
  big.documentOptions.croquiDraftsByFeature.p1.g1={
    ...big.documentOptions.croquiDraftsByFeature.p1.g1,
    svg:'<svg><text fill="#0033ff">Sítio São José</text></svg>',
    vertices:[{lat:-12.1,lng:-39.3,identifier:'V1'},{lat:-12.2,lng:-39.4,identifier:'V2'}],
    labelOffsets:{name:{dx:1.35,dy:-15}},labelAngles:{name:22},
    easements:[{id:'servidao-1',visible:false,color:'#ff0000'}],
    signature:'data:image/png;base64,'+'A'.repeat(95000),
    photoOverlay:{src:'data:image/jpeg;base64,'+'B'.repeat(100000),x:30,y:44,size:140}
  };
  const staged=await helpers.stageCustomizationOptions('owner-1',big);
  assert(Buffer.byteLength(staged.rowValue,'utf8')<65535);
  assert(files.has(staged.stagedFileId));
  const saved=await client.updateRow('customization',legacyRow.$id,{userId:'owner-1',options:staged.rowValue});
  const readBack=await client.getRow('customization',saved.$id);
  const hydrated=await helpers.readHydratedCustomizationOptions(readBack);
  assert.deepEqual(hydrated,big,'reabertura integra de croqui, vertices, SVG, posicoes, foto e assinatura');
  assert.equal(JSON.parse(readBack.options).__surveyorOptionsBlob.version,1);
  await assert.rejects(client.updateRow('customization',legacyRow.$id,{options:42}),/string JSON/i);
  await assert.rejects(client.updateRow('customization',legacyRow.$id,{options:'{broken'}),/objeto JSON valido/i);
  await assert.rejects(client.updateRow('customization',legacyRow.$id,{options:JSON.stringify(big)}),/65535/);
  await assert.rejects(client.updateRow('customization',legacyRow.$id,{options:{big:'A'.repeat(75000)}}),/65535/);
  assert.deepEqual(await helpers.readHydratedCustomizationOptions(await client.getRow('customization',saved.$id)),big,'erros nao destroem o salvamento anterior');
  const oldPayload=files.get(staged.stagedFileId);files.set(staged.stagedFileId,oldPayload+'BAD');
  await assert.rejects(helpers.readHydratedCustomizationOptions(readBack),/integridade/i,'arquivo alterado bloqueia leitura');
  files.set(staged.stagedFileId,oldPayload);
  assert.deepEqual(await helpers.readHydratedCustomizationOptions(readBack),big);
  assert(calls.some(x=>x.path.endsWith('/download')),'verificacao pelo endpoint raw download');
  console.log('OK: fluxo REST Appwrite simulado, banco string, legados, 195KB, upload, leitura, assinatura, SVG, anti-perda e integridade.');
} finally {globalThis.fetch=previousFetch;delete process.env.SURVEYOR_DATA_KEY_V1;delete process.env.SURVEYOR_CRYPTO_ACTIVE_KEY;}
