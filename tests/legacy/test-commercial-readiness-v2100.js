import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const support = fs.readFileSync(path.join(root, 'functions/surveyor-support/src/main.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'assets/js/core/auth.js'), 'utf8');
const projects = fs.readFileSync(path.join(root, 'assets/js/core/projects.js'), 'utf8');
const shared = fs.readFileSync(path.join(root, 'assets/js/features/public-project/public-project.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'assets/js/core/ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/core/ui.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'RELEASE_MANIFEST.json'), 'utf8'));

assert.equal(fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim(), '21.11.5');
assert.equal(manifest.release, '21.11.5');
assert.equal(manifest.api.version, '2.23.1-map-ux-21.11.2');
assert.equal(manifest.support.version, '1.1.0');

assert.match(api, /__Secure-surveyor_refresh/);
assert.match(api, /HttpOnly; Secure; SameSite=Strict/);
assert.match(api, /assertTrustedMutationOrigin/);
assert.match(auth, /credentials: 'include'/);
assert.match(auth, /refreshSession/);
assert.match(auth, /clientIdempotencyKey/);

assert.match(api, /subRoute === 'bundle'/);
assert.match(api, /assertRevisionMatches/);
assert.match(api, /stageProjectVersionSnapshot/);
assert.match(api, /PROJECT_VERSION_VERIFICATION_FAILED/);
assert.match(api, /cleanupProjectVersionFiles/);
assert.match(projects, /DRAFT_PREFIX/);
assert.match(projects, /georural:edit-conflict/);

assert.match(api, /security_events/);
assert.match(api, /persistSecurityEventRow/);
assert.match(api, /\/api\/admin\/system\/diagnostics/);
assert.match(api, /document_deleted_cleanup_pending/);

assert.match(api, /\/public-project\/#token=/);
assert.doesNotMatch(api, /\/public-project\/\?token=/);
assert.match(shared, /hashParams\.get\('token'\)/);
assert.match(shared, /credentials:'omit'/);
assert.doesNotMatch(shared, /prompt\(/);

assert.doesNotMatch(support, /surveyoragrimensura\.tech'[\s\S]{0,80}defaults/);
assert.match(support, /ENABLE_LEGACY_CORS_ORIGINS/);
assert.match(support, /Strict-Transport-Security/);
assert.match(support, /application\/json/);

assert.match(runtime, /api\/ready/);
assert.match(runtime, /georural:save-pending/);
assert.match(runtime, /MutationObserver/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(root);
assert.ok(htmlFiles.length >= 24);
for (const file of htmlFiles) {
  if (path.basename(file) === '404.html') continue;
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /Content-Security-Policy/, `${path.relative(root, file)} sem CSP`);
  assert.match(html, /surveyor-(?:ui|map|login|utilities)-current-v21\.11\.5\.css/, `${path.relative(root, file)} sem CSS atual consolidado`);
  assert.match(html, /surveyor-ui-runtime-current-v21\.11\.5\.js/, `${path.relative(root, file)} sem runtime atual consolidado`);
}

console.log('OK v21.10.0: segurança, concorrência, versões, diagnóstico, compartilhamento privado, CSP e experiência comercial validados.');
