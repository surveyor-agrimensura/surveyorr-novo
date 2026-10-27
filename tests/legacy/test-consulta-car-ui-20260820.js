import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const html = read('consulta-car/index.html');
const css = read('assets/css/features/consulta-car/app.css');
const js = read('assets/js/features/consulta-car/app.js');
const layout = read('assets/js/core/layout.js');
const runtime = read('assets/js/core/ui.js');
const portal = read('assets/js/core/portal.js');
const auth = read('assets/js/core/auth.js');
const coreCss = read('assets/css/core/ui.css');

assert.match(html, /<title>Consulta Pública CAR — Surveyor<\/title>/);
assert.match(html, /data-page="consulta-car\.html"/);
assert.match(html, /id="consultaCarRegistro"/);
assert.match(html, /id="consultaCarMunicipio"/);
assert.match(html, /id="consultaCarMap"/);
assert.match(html, /consulta-car-v21\.11\.5\.js/);
assert.match(html, /Panorama da Bahia/);

assert.match(layout, /routeUrl\('\/consulta-car\/'\)/);
assert.match(portal, /'consulta-car\.html': '\/consulta-car\/'/);
assert.match(auth, /'consulta-car\.html': '\/consulta-car\/'/);
assert.match(runtime, /dataset\.toolRoute = path/);
assert.match(runtime, /\['\/consulta-car','consulta-car','Consulta Pública CAR'/);
assert.equal(runtime.includes('sv-tools-flat-grid'), false);
assert.equal(coreCss.includes('sv-tools-flat-grid'), false);

assert.match(js, /const SICAR_WFS = 'https:\/\/geoserver\.car\.gov\.br\/geoserver\/sicar\/ows'/);
assert.match(js, /const CEFIR_WFS = 'https:\/\/geoserver\.inema\.ba\.gov\.br\/geoserver\/ows'/);
assert.match(js, /servicodados\.ibge\.gov\.br\/api\/v1\/localidades\/estados\/BA\/municipios/);
assert.match(js, /async function findByCar/);
assert.match(js, /async function findByMunicipality/);
assert.match(js, /SUPPORTED_UF = 'BA'/);
assert.match(js, /World_Imagery/);
assert.match(js, /Imóveis rurais \(CAR\)/);
assert.match(js, /Baixar perímetro \(GeoJSON\)/);
assert.match(js, /sicar:sicar_imoveis_/);
assert.match(js, /async function fetchOfficialGeometry/);
assert.match(js, /async function drawWmsFallback/);
assert.match(js, /Dados do imóvel/);
assert.match(js, /statusLabel\(item\.statusCodigo\)/);
assert.match(js, /cod_municipio_ibge/);
assert.match(js, /m_fiscal/);
assert.match(js, /status_imovel/);
assert.match(js, /data_atualizacao/);
assert.match(js, /Todos os atributos publicados pelo serviço oficial/);
assert.equal(js.includes('readJsonl('), false, 'Consulta não pode depender de JSONL local.');
assert.equal(js.includes('jsonl-fallback'), false, 'Fallback cadastral JSONL deve estar removido.');
assert.equal(js.includes('surveyorapiconsultas.kaualucasfrancasantos.workers.dev'), false);
assert.ok(css.length > 6000);

const dataDir = path.join(root, 'dados', 'car');
assert.equal(fs.existsSync(dataDir), false, 'Release online não deve empacotar a base cadastral local CAR.');

console.log('OK Consulta Pública CAR: SICAR/CEFIR/IBGE oficiais online, sem base cadastral JSONL local.');
