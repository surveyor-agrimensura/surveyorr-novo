import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function extractLiteral(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Marcador ausente: ${startMarker}`);
  const valueStart = start + startMarker.length;
  const end = source.indexOf(endMarker, valueStart);
  assert.notEqual(end, -1, `Fim ausente: ${endMarker}`);
  return vm.runInNewContext(`(${source.slice(valueStart, end).trim()})`);
}

const api = read('functions/surveyor-api/src/main.js');
const admin = read('assets/js/admin/app.js');
const adminHtml = read('admin/index.html');
const mapApp = read('assets/js/features/mapa/app.js');
const mapHtml = read('mapa/index.html');
const version = read('VERSION').trim();

assert.equal(version, '21.11.5');
assert.match(api, /const APP_VERSION = ['"]2\.23\.1-map-ux-21\.11\.2['"]/);

// Administração global não pode ser concedida por plano comercial.
const defaults = extractLiteral(api, 'const DEFAULT_PLANS = ', ';\n\n\nconst OBSOLETE_PAYMENT_TEST_PLAN_SLUGS');
const presets = extractLiteral(admin, 'const planPresets = ', ';\n\n  function applyPlanPreset');
for (const plan of [...defaults, ...Object.values(presets)]) {
  if (!String(plan.slug || '').startsWith('pro_')) continue;
  const permissions = Array.from(plan.permissions || [], String);
  assert.equal(permissions.some((permission) => /^(?:admin:|backup:|company:|billing:|white-label:)/i.test(permission)), false, `${plan.slug}: contém permissão administrativa global.`);
  assert.equal(permissions.includes('workspace:members'), true, `${plan.slug}: gestão do próprio workspace ausente.`);
}
assert.match(api, /const GLOBAL_ADMIN_PERMISSION_PATTERN/);
assert.match(api, /function sanitizeCommercialPermissions/);
const requireAdminStart = api.indexOf('function requireAdminAccess');
const requireAdmin = api.slice(requireAdminStart, api.indexOf('async function listAppwriteUsers', requireAdminStart));
assert.match(requireAdmin, /role === 'admin'/);
assert.match(requireAdmin, /permissions\.includes\('admin:all'\)/);
assert.doesNotMatch(requireAdmin, /startsWith\(['"]admin:/);

// Salvamento copy-on-write: novo arquivo verificado antes de trocar referência e apagar o anterior.
assert.match(api, /async function stageProjectPayload/);
assert.match(api, /async function commitProjectPayload/);
const projectCommit = api.slice(api.indexOf('async function commitProjectPayload'), api.indexOf('function mapFeature'));
assert.ok(projectCommit.indexOf("updateRow('projects'") < projectCommit.lastIndexOf('deleteFile(staged.bucket, staged.previousFileId)'), 'Projeto antigo deve ser excluído somente após atualização da linha.');
assert.match(api, /PROJECT_FILE_VERIFICATION_FAILED/);
assert.match(api, /DOCUMENT_FILE_VERIFICATION_FAILED/);
assert.match(api, /LAYER_FILE_VERIFICATION_FAILED/);

// Proteções de autenticação e disponibilidade.
assert.match(api, /async function assertLoginRateLimit/);
assert.match(api, /fetchWithAbortTimeout/);
assert.match(api, /APPWRITE_UPSTREAM_TIMEOUT_MS/);
assert.match(api, /rotatedRefreshToken/);
assert.match(api, /sessionVersion: appwriteId\(\)/);
assert.match(api, /metadata_inventory/);
assert.match(adminHtml, /Gerar inventário/);
assert.doesNotMatch(adminHtml, />Gerar backup agora</i);

// Popup rural deve voltar a exibir ajuda e painéis CAR/SIGEF.
assert.match(mapApp, /function ruralRegistrySections/);
assert.match(mapApp, /CAR/);
assert.match(mapApp, /SIGEF/);
assert.match(mapApp, /Consultar CAR e SIGEF neste imóvel/);
assert.match(mapApp, /showLayerInformationHelp\(latlng, \{ forceRural: true, feature, sourceLayer:/);
assert.match(mapApp, /identifyRuralRegistriesAt\(latlng, liveEntries, \{ feature: options\.feature/);
assert.match(mapHtml, /21\.9\.433-registry-popup/);
assert.match(mapHtml, /21\.10\.0-(?:commercial-ready|rev18-seia-strict)/);

console.log('OK v21.10.0: autorização, integridade copy-on-write, sessão, inventário e popup CAR/SIGEF validados.');
