const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const ok = (condition, message) => { if (!condition) throw new Error(message); };

const readiness = read('assets/js/core/commercial.js');
const runtime = read('assets/js/core/ui.js');
const login = read('assets/js/core/login.js');
const mapUx = read('assets/js/features/mapa/ux.js');
const mapCss = read('assets/css/features/mapa/app.css');
const mapApp = read('assets/js/features/mapa/app.js');
const shp = read('assets/js/features/mapa/shapefile.js');
const car = read('assets/js/features/consulta-car/app.js');
const worker = read('deploy/cloudflare-geoservices/src/worker.js');

ok(readiness.includes('/api/health') && !readiness.includes('/api/ready'), 'readiness comercial deve usar /api/health, não /api/ready');
ok(runtime.includes('/api/health') && !runtime.includes('/api/ready'), 'runtime consolidado deve usar /api/health');
ok(login.includes('clearApiAvailabilityWarnings') && login.includes("runtimeBanner?.dataset?.kind === 'danger'"), 'login bem-sucedido deve limpar alerta de disponibilidade obsoleto');

ok(mapUx.includes('Math.min(4, Math.max(1, neededW / w, neededH / h) + .045)'), 'rotação deve ampliar o mapa o suficiente para não criar cunhas cinzas');
ok(mapUx.includes("state.shield.style.pointerEvents = next !== 0 ? 'auto' : 'none'"), 'escudo da rotação deve liberar cliques ao voltar ao norte');
ok(mapUx.includes("editingObserver.observe(body, { attributes: true, attributeFilter: ['class'] })"), 'modo de desenho deve forçar reset seguro da rotação');

ok(mapCss.includes('gaveta de ferramentas do mapa realmente compacta'), 'gaveta de ferramentas compacta ausente');
ok(mapCss.includes('width:min(395px,calc(100vw - 24px))!important;'), 'gaveta de ferramentas ainda está larga demais');
ok(mapCss.includes('width:34px!important;') && mapCss.includes('height:34px!important;'), 'botões rápidos não foram compactados');

ok(mapApp.includes('DPA_A_100K_VIGENTE_GCS_SIR_SEI/FeatureServer/0/query'), 'camada administrativa não possui fonte oficial vigente da SEI');
ok(mapApp.includes('buildOfficialSeiDpaLayer'), 'fallback/rota oficial da DPA não foi implementado');
ok(mapApp.includes("sourceMode: 'stored-fallback'"), 'camadas remotas não usam cópia local de contingência quando disponível');

ok(!shp.includes('<div class="surveyor-shp-summary"></div>'), 'bloco explicativo redundante do Shapefile ainda é renderizado');
ok(shp.includes("warning.hidden = true;\n      warning.textContent = '';"), 'aviso redundante do perfil Shapefile ainda aparece por padrão');

ok(car.includes('fetchOfficialSicarFeatures'), 'Consulta CAR não possui busca oficial SICAR/WFS');
ok(car.includes("source: 'official'"), 'Consulta CAR não marca a fonte oficial');
ok(!car.includes("source: 'jsonl-fallback'") && !car.includes('findByCarLocalFallback'), 'Consulta CAR não deve depender de JSONL cadastral local');
ok(car.includes('IBGE_MUNICIPIOS_URL') && car.includes('servicodados.ibge.gov.br'), 'municípios devem vir do serviço oficial do IBGE');
ok(worker.includes("'geoserver.car.gov.br'"), 'Worker não permite o GeoServer oficial do CAR');

console.log('PASS: auditoria de estabilidade 2026-08-28 — API, rotação, ferramentas, camadas, SHP e consulta rural oficial online.');
