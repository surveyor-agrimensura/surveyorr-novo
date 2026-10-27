import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (p) => fs.readFileSync(p, 'utf8');
const api = read('functions/surveyor-api/src/main.js');
const save = read('functions/surveyor-save/src/main.js');
const geo = read('functions/surveyor-geoservices/src/main.js');
const cloud = read('assets/js/core/projects.js');
const map = read('assets/js/features/mapa/app.js');
const workflow = read('.github/workflows/validate-appwrite-functions.yml');
const apiGeom = fs.readFileSync('functions/surveyor-api/src/geometry-validation.js');
const saveGeom = fs.readFileSync('functions/surveyor-save/src/geometry-validation.js');
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const manifest = JSON.parse(read('RELEASE_MANIFEST.json'));

assert.equal(sha(apiGeom), sha(saveGeom), 'API e Save precisam usar a mesma política de validação geométrica');
assert.equal(manifest.commercialReadiness?.packageTechnicalScore, 8.5);
assert.equal(manifest.commercialReadiness?.productionCertificationPendingExternalChecks, true);
assert.match(String(manifest.backupStatus || ''), /restore-drill-required/);
assert.equal(manifest.operations?.publicSmokeEveryMinutes, 30);

assert.match(api, /PROJECT_MAX_VERTICES_PER_RING/);
assert.match(save, /MAX_PROJECT_VERTICES_PER_RING/);
assert.match(save, /validateProjectFeatures\(normalized/);
assert.doesNotMatch(api, /http:\/\/geoserver\.inema\.ba\.gov\.br/);
assert.match(api, /rejectUnauthorized:\s*true/);
assert.match(geo, /LAYER_IMPORT_MAX_ZIP_BYTES/);
assert.match(geo, /LAYER_IMPORT_MAX_FEATURES/);
assert.match(geo, /LAYER_IMPORT_MAX_VERTICES/);
assert.match(api, /REFRESH_TOKEN_REPLAY/);
assert.match(api, /issueRefreshSession/);
assert.match(api, /rotateRefreshSession/);
assert.match(api, /ENABLE_BOOTSTRAP_ROUTES/);
assert.match(api, /PAYMENT_ALLOW_SANDBOX/);
assert.match(api, /PAYMENT_SANDBOX_DISABLED/);
for (const service of ['functions/surveyor-api/src/main.js','functions/surveyor-save/src/main.js','functions/surveyor-support/src/main.js','functions/surveyor-geoservices/src/main.js']) assert.doesNotMatch(read(service), /codebykaua\.github\.io/, `${service}: origem GitHub não deve ser CORS padrão de produção`);
assert.equal(manifest.paymentPortal?.testMode, false);
assert.match(cloud, /indexedDB\.open\(RECOVERY_DB_NAME/);
assert.match(cloud, /saveRecoverySnapshot/);
assert.match(map, /maybeRestoreRecovery/);
assert.match(map, /rascunho local foi preservado/i);
assert.ok(fs.existsSync('scripts/backup.mjs'));
assert.ok(fs.existsSync('scripts/restore.mjs'));
assert.ok(fs.existsSync('scripts/backup-verify.mjs'));
assert.ok(fs.existsSync('scripts/audit-production.mjs'));
assert.ok(fs.existsSync('scripts/validate-env.mjs'));
assert.match(read('scripts/validate-env.mjs'), /PAYMENT_ALLOW_SANDBOX/);
assert.match(read('scripts/validate-env.mjs'), /ENABLE_BOOTSTRAP_ROUTES/);
assert.match(read('.gitignore'), /backups\//);
assert.match(workflow, /needs:\s*validate/);
assert.match(workflow, /actions\/deploy-pages@v4/);
assert.match(workflow, /audit-level=high/);

const smoke = read('scripts/smoke-production.mjs');
const smokeWorkflow = read('.github/workflows/production-smoke.yml');
assert.match(smoke, /API ready/);
assert.match(smoke, /Save ready/);
assert.match(smoke, /GeoServices/);
assert.match(smokeWorkflow, /cron:\s*'\*\/30/);
assert.match(smokeWorkflow, /workflow_run/);
assert.ok(fs.existsSync('README.md'), 'README.md consolidado ausente');
const consolidatedReadme = read('README.md');
for (const section of ['Backup e restauração','Segurança','Deploy do frontend']) assert.match(consolidatedReadme, new RegExp(section, 'i'), `README consolidado sem seção: ${section}`);
assert.match(read('login/index.html'), /\/privacidade\//);
assert.match(read('login/index.html'), /\/termos\//);
assert.match(read('login/index.html'), /\/seguranca\//);
assert.ok(fs.existsSync('.well-known/security.txt'));
assert.match(read('suporte/index.html'), /value="privacidade"/);
assert.match(read('functions/surveyor-support/src/main.js'), /privacidade: 'Privacidade \/ solicitação sobre meus dados'/);


for (const file of fs.readdirSync('.', { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `${e.name}/index.html`).filter((f) => fs.existsSync(f))) {
  const html = read(file);
  assert.doesNotMatch(html, /script-src[^;]*'unsafe-inline'/, `${file}: CSP de scripts ainda permite unsafe-inline`);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, `${file}: script inline executável ainda presente`);
  assert.doesNotMatch(html, /\son(?:click|error|change|input|submit|load|keydown|keyup|pointerdown|mousedown)=/i, `${file}: handler HTML inline ainda presente`);
}
assert.match(read('assets/js/core/ui.js'), /data-click-target/);

for (const file of [
  'assets/js/core/downloads.js',
  'assets/js/core/suite.js',
  'assets/js/core/ui.js',
  'assets/js/features/planialtimetria/app.js',
  'assets/js/features/loteamentos-reurb/app.js',
  'assets/js/features/mapa/app.js',
  'assets/js/features/mapa/interface.js'
]) {
  const code = read(file);
  assert.doesNotMatch(code, /<script>[\s\S]{0,180}?(?:window\.)?print\s*\(/i, `${file}: fluxo de impressão ainda injeta script inline`);
  assert.doesNotMatch(code, /onclick=["'](?:window\.)?print\s*\(/i, `${file}: botão de impressão ainda usa onclick inline`);
}

for (const page of ['privacidade/index.html','termos/index.html','seguranca/index.html']) {
  const html = read(page);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /suporte@surveyorr\.com\.br/);
}
console.log('OK: Commercial readiness — geometria, sessão, importação, recovery, backup, deploy gate, monitoramento, Appwrite audit, runbooks e páginas legais validados.');
