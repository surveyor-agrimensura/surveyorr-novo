const fs = require('node:fs');
const assert = require('node:assert/strict');
const api = fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
const map = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const html = fs.readFileSync('mapa/index.html','utf8');
const auth = fs.readFileSync('assets/js/core/auth.js','utf8');
const admin = fs.readFileSync('assets/js/admin/app.js','utf8');
const org = fs.readFileSync('assets/js/admin/organization.js','utf8');
const adminCss = fs.readFileSync('assets/css/admin/organization.css','utf8');
const mapCss = fs.readFileSync('assets/css/features/mapa/app.css','utf8');
const mega = fs.readFileSync('assets/js/features/mapa/interface.js','utf8');
const worker = fs.readFileSync('deploy/cloudflare-geoservices/src/worker.js','utf8');
const adminHtml = fs.readFileSync('admin/index.html','utf8');
const portal = fs.readFileSync('assets/js/core/portal.js','utf8');
const manifest = JSON.parse(fs.readFileSync('RELEASE_MANIFEST.json','utf8'));

const stateCodes = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
for (const uf of stateCodes) {
  assert.match(api, new RegExp(`\\b${uf}:'`), `API sem UF ${uf}`);
  assert.match(html, new RegExp(`<option value="${uf}"(?:\\s+selected)?>`), `seletor sem UF ${uf}`);
}
assert.equal(manifest.geobahiaCatalog.sicarStatePropertyLayers, 27);
assert.equal(manifest.geobahiaCatalog.bahiaOfficialTechnicalLayers, 82);
assert.equal(manifest.geobahiaCatalog.statePreferencePersistedPerAccount, true);
assert.match(api, /sicar:sicar_imoveis_\$\{safeCode\.toLowerCase\(\)\}/);
assert.match(api, /storedLayers\.filter\(\(layer\) => !isLegacyGeobahiaPropertyBoundaryLayer\(layer\)\)/);
assert.match(api, /\.\.\.sicarPropertyVirtualLayers\(\)/);
assert.match(map, /function buildSicarPropertyBoundaryWmsLayer/);
assert.match(map, /return buildSicarPropertyBoundaryWmsLayer\(layer, pref, runtime\)/);
assert.match(map, /sicarLayerNameFor\(layer\)/);
assert.doesNotMatch(map, /function buildCefirPropertyBoundaryWmsLayer/);
assert.doesNotMatch(map, /scheduleCefirLivePropertyOverlay/);
assert.match(worker, /2\.25\.1-sicar-national-r21-no-secret/);
assert.match(worker, /geoserver\.car\.gov\.br/);

assert.match(html, /id="catalogLocationButton"/);
assert.match(html, /id="catalogStateSelect"/);
assert.match(map, /saveLayerCatalogState\?\.\(selectedCatalogState\)/);
assert.match(auth, /saveLayerCatalogState/);
assert.match(api, /layerCatalogState/);

assert.match(api, /workspaceMembershipFromAppwriteUser/);
assert.match(api, /for \(const item of \[\.\.\.prefsRows, \.\.\.\(Array\.isArray\(rows\)/);
assert.match(admin, /Compartilhado ·/);
assert.match(admin, /manager: 'Gestor', technician: 'Técnico', collaborator: 'Colaborador'/);
assert.match(org, /sv-team-badge/);
assert.match(adminCss, /\.sv-team-badge\{/);
assert.match(org, /audit-logs\?limit=2000/);
assert.match(api, /Math\.min\(2000, Number\(limit\)/);
assert.match(api, /lastSessionCreatedAt/);
assert.match(api, /surveyor\.lastLoginAt/);

assert.doesNotMatch(mapCss, /body\.georural-map-page\{--panel-w:360px!important\}/);
assert.match(mega, /document\.body\.style\.setProperty\('--panel-w'/);

for (const mode of ['notification','popup','banner','maintenance','login-expiration','release']) {
  assert.match(adminHtml, new RegExp(`data-notice-mode="${mode}"`), `modo de aviso ausente: ${mode}`);
}
assert.match(api, /async function enforceServerMaintenanceLock/);
assert.match(api, /code: 'SYSTEM_MAINTENANCE'/);
assert.match(api, /if \(String\(auth\?\.user\?\.role \|\| ''\)\.toLowerCase\(\) === 'admin'\) return/);
assert.match(portal, /notice\.blocksApp/);
assert.match(portal, /deliveryMode === 'release'/);
assert.match(portal, /deliveryMode === 'popup'/);

console.log('PASS R21: SICAR nacional por UF, preferência persistida, equipe compartilhada, logs, resize e avisos validados.');
