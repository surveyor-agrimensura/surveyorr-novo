import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apiConfig = fs.readFileSync(path.join(root, 'assets/js/core/api.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'assets/js/core/auth.js'), 'utf8');
const mainApi = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const saveApi = fs.readFileSync(path.join(root, 'functions/surveyor-save/src/main.js'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'appwrite.config.json'), 'utf8'));

assert.match(mainApi, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2';/);
assert.match(saveApi, /const APP_VERSION = '2\.0\.0';/);
assert.match(saveApi, /const SERVICE_NAME = 'Surveyor Save Function';/);
assert.match(saveApi, /SURVEYOR_SAVE_APPWRITE_API_KEY/);
assert.match(saveApi, /\/api\/auth\/me/,'Save Function deve delegar validacao de sessao a API principal');
assert.doesNotMatch(saveApi, /JWT_SECRET/,'Save Function nao deve duplicar segredo JWT');
assert.match(saveApi, /const create = path === '\/api\/projects' && httpMethod === 'POST';/);
assert.match(saveApi, /const bundle = path\.match\(\/\^\\\/api\\\/projects/);
assert.match(saveApi, /Cross-Origin-Resource-Policy': 'cross-origin'/);
assert.match(mainApi, /Cross-Origin-Resource-Policy': 'same-site'/);

assert.match(apiConfig, /save: 'https:\/\/6a7bce66000fc9c90d88\.nyc\.appwrite\.run'/);
assert.match(apiConfig, /saveApiBaseUrl/);
assert.match(auth, /function saveApiUrl\(path\)/);
assert.match(auth, /async function saveApiFetch\(path, options = \{\}, allowRefresh = true\)/);
assert.match(auth, /credentials: 'omit'/);
assert.match(auth, /'Content-Type': 'text\/plain;charset=UTF-8'/);
assert.match(auth, /method: 'POST'/);
assert.doesNotMatch(auth.slice(auth.indexOf('async function saveApiFetch'), auth.indexOf('async function apiFetchFallback')), /attachSessionAuthHeaders\(/);
assert.match(auth, /__surveyorSaveTransport/);
assert.match(auth, /const data = await saveApiFetch\(endpoint, \{/);
assert.match(auth, /async function createProject\(payload\)[\s\S]*?await apiFetch\('\/api\/projects'/, 'createProject normal continua na API principal');

const saveFn = config.functions.find((item) => item.$id === 'surveyor-save');
assert.ok(saveFn);
assert.equal(saveFn.path, 'functions/surveyor-save');
assert.equal(saveFn.entrypoint, 'src/main.js');
assert.equal(saveFn.runtime, 'node-22');
assert.deepEqual(saveFn.execute, ['any']);

for (const ext of ['.tgz', '.tar.gz']) {
  const found=[];
  const walk=(dir)=>{ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const full=path.join(dir,e.name); if(e.isDirectory()){ if(['.git','node_modules'].includes(e.name)) continue; walk(full);} else if(e.name.endsWith(ext)) found.push(full); }};
  walk(root);
  assert.equal(found.length,0,`nao deve haver pacote ${ext} dentro do projeto`);
}
console.log('OK: surveyor-save dedicada, minimalista e Cloud Save funcional preservado.');
