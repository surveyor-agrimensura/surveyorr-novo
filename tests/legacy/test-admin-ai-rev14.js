import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const html = read('admin/index.html');
const ai = read('assets/js/admin/ai.js');
const css = read('assets/css/admin/ai.css');
const admin = read('assets/js/admin/app.js');
const auth = read('assets/js/core/auth.js');
const map = read('assets/js/features/mapa/app.js');
const api = read('functions/surveyor-api/src/main.js');

assert.match(html, /data-ai-revision="rev1[456]"/);
assert.match(html, /adminAiImageInput/);
assert.match(html, /adminAiMicBtn/);
assert.match(html, /admin-ai-v21\.10\.0\.js/);
assert.match(ai, /renderMarkdownSafe/);
assert.match(ai, /imageDataUrl/);
assert.doesNotMatch(admin, /function appendAdminAiMessage/);
assert.match(css, /admin-ai-composer/);
assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/);
assert.match(api, /OPENROUTER_VISION_MODEL/);
assert.match(api, /type: 'image_url'/);
assert.match(api, /knownGroup && String\(knownGroup\.status/);
assert.match(api, /Cache-Control': 'no-store/);
assert.match(auth, /BroadcastChannel\('surveyor-layer-catalog'\)/);
assert.match(auth, /emitLayerCatalogChanged\('group-publish'\)/);
assert.match(map, /CATALOG_RELOAD_PERIODIC_MS = 30_000/);
assert.match(map, /forceRefresh: true, noCache: true/);
assert.match(map, /onLayerCatalogChanged/);

console.log('OK v21.10.0 REV14: IA com imagem, respostas organizadas e sincronização rápida de camadas preservadas.');
