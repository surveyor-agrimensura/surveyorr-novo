const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const app = read('assets/js/features/mapa/app.js');
const api = read('functions/surveyor-api/src/main.js');
const save = read('functions/surveyor-save/src/main.js');
const cloud = read('assets/js/core/projects.js');
function ok(condition, message) { if (!condition) throw new Error(message); }
ok(!/featureCount:\s*0\s*\}\)\)\.sort/.test(api), 'API ainda força featureCount=0 na listagem de projetos.');
ok(/mapStoredProject\(row, payload\)/.test(api), 'API não recompõe projeto com metadata do payload persistido.');
ok(/featureCount:\s*Array\.isArray\(payload\?\.features\)/.test(api), 'API não calcula a contagem real das feições persistidas.');
ok(/verifyRemoteProjectPersistence\(/.test(app), 'Mapa não verifica readback após salvar na nuvem.');
ok(/clearRecoveryDraftAliases\(/.test(app), 'Mapa não limpa rascunhos antigo/novo após criação do projeto.');
ok(/featureCount:\s*projectLayers\.length/.test(app), 'Mapa não persiste featureCount no metadata do projeto.');
ok(/areaHa:\s*totals\.areaM2\s*\/\s*10000/.test(app), 'Mapa não persiste área consolidada no metadata.');
ok(/function mapProject\(row = \{\}, payload = \{\}\)/.test(save), 'Save Function não devolve metadata do payload salvo.');
ok(/verifySavedBundle\(/.test(cloud), 'Camada ProjectCloud não confirma o bundle por leitura independente.');
console.log('OK: persistência de projetos endurecida com contagem real, metadata e verificação pós-salvamento.');
