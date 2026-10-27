import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawn } from 'node:child_process';

const saveCode = fs.readFileSync('assets/js/features/mapa/save-status.js','utf8');
function saveScenario(persistResult) {
  const listeners = {};
  let signature = 'perimetro-inicial';
  const dot = { className:'', setAttribute(){} };
  const button = {
    dataset:{},title:'',_dot:null,
    classList:{add(){}},
    querySelector(){return this._dot;},
    appendChild(node){this._dot=node;},
    setAttribute(){}
  };
  const document = {querySelector(){return button;},createElement(){return dot;},addEventListener(){}};
  const window = {
    SurveyorMapRuntime: {getContentSignature(){return signature;},persistRecoveryNow(){return persistResult;}},
    addEventListener(name,callback){listeners[name] = callback;}
  };
  const context = {window,document,navigator:{onLine:false},setInterval(){return 1;},clearInterval(){},
    setTimeout(fn){return 1;},clearTimeout(){}};
  vm.runInNewContext(saveCode,context,{timeout:1000});
  assert.equal(button.dataset.saveState,'saved','Projeto inicial não está alterado');
  signature='perimetro-alterado';
  listeners.offline();
  return button.dataset.saveState;
}
assert.equal(saveScenario(false),'error','Falha real de recuperação nunca pode ser mostrada como salva');
assert.equal(saveScenario(true),'local','Confirmação positiva da gravação pode ser mostrada como cópia local');

const docs = fs.readFileSync('assets/js/core/documents.js','utf8');
assert.match(docs,/Promise\.race\(\[\s*collectGenerationConsentData\(\)/);
assert.match(docs,/Conferência indisponível/);
assert.match(docs,/confirm\.disabled = true/);
const mapDocs = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
assert.match(mapDocs,/withTimeout\(\s*refreshPranchaLivePreview/);
assert.match(mapDocs,/Tempo esgotado ao preparar a prancha/);
assert.match(mapDocs,/clearPranchaPreparingShell\(workspace\)/);
const ods = fs.readFileSync('assets/js/features/ods/app.js','utf8');
assert.match(ods,/\$\('generateOds'\)\?\.addEventListener\('click'/);
assert.match(ods,/XLSX\.writeFile\(workbook,.*bookType:'ods'/);
assert.match(ods,/rows\.length < 3 \|\| !perimeter\(current\)/);
assert.match(ods,/if \(token !== projectLoadToken/);
assert.ok(fs.existsSync('projetos/index.html'));
assert.ok(fs.readFileSync('projetos/index.html','utf8').includes('/nuvem/'));

// Inicia o servidor real em porta efêmera e testa controles HTTP, sem browser/cookies.
const port = 35000 + Math.floor(Math.random()*20000);
const child = spawn(process.execPath,['scripts/dev.mjs'], {env:{...process.env,SURVEYOR_LOCAL_PORT:String(port)},stdio:'ignore'});
try {
  let ready=false;
  for (let i=0;i<60;i++) {
    try {const response=await fetch(`http://127.0.0.1:${port}/login/`);ready=response.status===200; if(ready)break;}catch{}
    await new Promise(r=>setTimeout(r,80));
  }
  assert.ok(ready,'Servidor local deve iniciar');
  for(const secret of ['/functions/surveyor-api/src/main.js','/scripts/dev.mjs','/config/.env.example','/package.json','/.env.example','/AGENTS.md','/tests/stable/run.mjs']) {
    const response=await fetch(`http://127.0.0.1:${port}${secret}`);
    assert.equal(response.status,404,`Arquivo interno deve ser privado: ${secret}`);
  }
  for (const publicFile of ['/', '/login/','/assets/js/core/documents.js','/projetos/','/central-lotes/','/assets/js/features/central-lotes/app.js']) {
    const response=await fetch(`http://127.0.0.1:${port}${publicFile}`);
    assert.equal(response.status,200,`Rota legítima deve funcionar: ${publicFile}`);
  }
} finally { child.kill('SIGTERM'); }
console.log('PASS operational-reliability: estado de salvamento, validação de geração, ODS, pranchas e superfície HTTP local.');
