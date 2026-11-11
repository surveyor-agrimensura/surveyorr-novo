import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createGeoserviceProxy } from '../functions/surveyor-api/src/geoservices/proxy.js';
import { createPublicShortCodes } from '../functions/surveyor-api/src/projects/public-short.js';
import { createPlanDocumentValidator } from '../functions/surveyor-api/src/documents/plan-attachment.js';

let checks = 0;
function check(fn) { fn(); checks++; }
const statusError = (status, message) => Object.assign(new Error(message), {status});
const queryValue = (req, key) => req.query?.[key] || '';
const proxy = createGeoserviceProxy({
  env: (_name, fallback = '') => fallback, statusError, queryValue,
  parsePath: r => r.path || '', queryStringSources: r => [r.search || ''],
  corsOrigin: () => 'https://www.surveyorr.com.br', appVersion: 'test'
});
check(() => assert.deepEqual(proxy.remoteLayerDetection({serviceUrl:'https://example.org/geoserver/wms'}), {
  serviceType:'wms', serviceUrl:'https://example.org/geoserver/wms',ok:true,message:'URL reconhecida para cadastro no Appwrite.'
}));
check(() => assert.equal(proxy.remoteLayerDetection({serviceUrl:''}).ok,false));
check(() => assert.equal(proxy.normalizeProxyBaseTarget('https://geoserver.inema.ba.gov.br/wms?BBOX=1%2C2%2C3%2C4&token=abc').pathname,'/geoserver/ows'));
check(() => assert.equal(proxy.normalizeProxyBaseTarget('https://geoserver.inema.ba.gov.br/wms?BBOX=1%2C2%2C3%2C4&token=abc').searchParams.has('BBOX'),false));
check(() => assert.throws(()=>proxy.normalizeProxyBaseTarget('https://attacker.example/wms'),{status:403}));
check(() => assert.throws(()=>proxy.normalizeProxyBaseTarget('javascript:alert(1)'),{status:400}));
check(() => {
  const url = proxy.buildGeoserviceUpstreamUrl({query:{LAYERS:'g:land',REQUEST:'GetMap',BBOX:'1,2,3,4', target:'ignore-me'}},'https://geoserver.inema.ba.gov.br/geoserver/ows');
  assert.equal(url.searchParams.get('LAYERS'),'g:land');
  assert.equal(url.searchParams.get('REQUEST'),'GetMap');
  assert.equal(url.searchParams.get('SERVICE'),'WMS');
  assert.equal(url.searchParams.get('VERSION'),'1.1.1');
  assert.equal(url.searchParams.get('target'),null);
});
check(() => {
  const url= new URL('https://geoserver.inema.ba.gov.br/geoserver/ows?SERVICE=WMS');
  assert.deepEqual(proxy.geoserviceUpstreamCandidates(url).map(x=>x.pathname),['/geoserver/ows','/geoserver/wms']);
});
check(() => {
  const url='https://geoserver.inema.ba.gov.br/geoserver/ows?SERVICE=WMS';
  const encoded= Buffer.from(url).toString('base64url');
  assert.equal(proxy.geoserviceEncodedUpstreamFromPath({path:'/api/geoservices/wms-url/'+encoded}).toString(),url);
});
check(() => assert.throws(()=>proxy.geoserviceEncodedUpstreamFromPath({path:'/api/geoservices/wms-url/bm90LWEtdXJs'}), {status:400}));

let stored = new Map();
const fixture = [{id:'geometry-A',status:'active'},{id:'geometry-B',status:'active'}];
let listCalls = 0, writes = 0;
const short = createPublicShortCodes({
  crypto, jwtSecret: ()=>'fixed-test-secret', bucketId: ()=> 'project_files',
  deleteFile: async(_bucket,id)=> {stored.delete(id)},
  createFile: async(_bucket,_name,contents,_mime,id)=> {stored.set(id,contents);writes++},
  readFileText: async(_bucket,id)=> {if(!stored.has(id))throw new Error('absent');return stored.get(id)},
  getRow: async(_collection,id)=> fixture.find(r=>r.id===id) || null,
  listAllRows: async()=>{listCalls++;return fixture}
});
check(() => {
  const expected = crypto.createHash('sha256').update('surveyor-public-project:v3:geometry-A').digest();
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let value=0n;for(let i=0;i<7;i++)value=(value<<8n)|BigInt(expected[i]);value>>=6n;
  let result='';for(let i=0;i<10;i++){result=alphabet[Number(value&31n)]+result;value>>=5n}
  assert.equal(short.projectShortCode('geometry-A'),result);
});
check(()=>assert.equal(short.displayPublicShortCode(short.projectShortCode('geometry-A')).length,11));
check(()=>assert.equal(short.normalizePublicShortCode(' oI-l '),'011'));
check(()=>assert.equal(short.publicShortPath('geometry-A').startsWith('/p/?c='),true));
const testLookup = async()=>{
  const first=await short.findProjectRowByShortCode(short.projectShortCode('geometry-A'));
  assert.equal(first?.id,'geometry-A');
  assert.equal(listCalls,1);
  assert.ok(writes >= 1);
  const second=await short.findProjectRowByShortCode(short.projectShortCode('geometry-A'));
  assert.equal(second?.id,'geometry-A');
  assert.equal(listCalls,1);
};
await testLookup();checks+=3;
const validate=createPlanDocumentValidator({normalizeEmail: v=>String(v||'').trim().toLowerCase(),env:(_n,f)=>f,statusError});
const base={email:'TEST@EXAMPLE.COM',name:'Nome',planName:'Pro',filename:'plano.pdf',contentBase64:Buffer.from('%PDF-1.4\ntest').toString('base64')};
check(()=>assert.equal(validate(base).to,'test@example.com'));
check(()=>assert.equal(validate(base).documentType,'receipt'));
check(()=>assert.equal(validate({...base,documentType:'term'}).documentType,'term'));
check(()=>assert.equal(validate(base).pdfBuffer.toString('utf8'),'%PDF-1.4\ntest'));
check(()=>assert.throws(()=>validate({...base,filename:'plan.exe'}),{status:400}));
check(()=>assert.throws(()=>validate({...base,contentBase64:Buffer.from('not a PDF').toString('base64')}),{status:400}));
check(()=>assert.throws(()=>validate({...base,contentBase64:Buffer.concat([Buffer.from('%PDF'),Buffer.alloc(8*1024*1024)]).toString('base64')}),{status:413}));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const name of ['geometry-validation.js','security/crypto.js']){
 const a=readFileSync(path.join(root,'functions/surveyor-api/src',name));
 const b=readFileSync(path.join(root,'functions/surveyor-save/src',name));
 check(()=>assert.equal(crypto.createHash('sha256').update(a).digest('hex'),crypto.createHash('sha256').update(b).digest('hex'),`Funções independentes com espelhos divergentes: ${name}`));
}
const api=await import('../functions/surveyor-api/src/main.js');
check(()=>assert.equal(typeof api.default,'function'));
console.log(`SURVEYOR BLOCO 2: ${checks} verificações de proxy, URL/allowlist, códigos públicos, PDF, espelhos e carregamento da Function aprovadas.`);
