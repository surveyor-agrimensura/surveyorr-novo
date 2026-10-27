import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const html = read('admin/index.html');
const ai = read('assets/js/admin/ai.js');
const api = read('functions/surveyor-api/src/main.js');
const env = read('functions/surveyor-api/.env.example');

assert.match(html, /data-ai-revision="rev1[56]"/);
assert.match(html, /> Ditar<\/button>/);
assert.match(html, /Nenhum arquivo de áudio é enviado à IA/);
assert.match(ai, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
assert.match(ai, /interimResults = true/);
assert.match(ai, /continuous = true/);
assert.match(ai, /Ouvindo e escrevendo/);
assert.match(ai, /canvas\.toDataURL\('image\/jpeg'/);
assert.match(ai, /timeoutMs: sentAttachment \? 75_000 : 55_000/);
assert.doesNotMatch(ai, /MediaRecorder/);
assert.doesNotMatch(ai, /getUserMedia/);
assert.doesNotMatch(ai, /audioBase64/);
assert.doesNotMatch(ai, /\/api\/admin\/ai\/transcribe/);
assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/);
assert.match(api, /OPENROUTER_VISION_MODEL/);
assert.match(api, /retryWithFreeVision/);
assert.doesNotMatch(api.slice(api.indexOf("if (path === '/api/health')"), api.indexOf("if (path === '/api/favicon.ico')")), /browserDictation|audioUpload/, 'health publico nao deve expor capacidades internas da IA');
assert.doesNotMatch(api, /transcribeOpenRouterAdmin/);
assert.doesNotMatch(api, /\/api\/admin\/ai\/transcribe/);
assert.doesNotMatch(api, /OPENROUTER_TRANSCRIPTION_MODEL/);
assert.doesNotMatch(env, /OPENROUTER_TRANSCRIPTION_MODEL/);
assert.doesNotMatch(env, /ADMIN_AI_MAX_AUDIO_BYTES/);

console.log('OK v21.10.0 REV15: ditado em tempo real no navegador, nenhum upload de áudio e imagem otimizada com fallback visual.');
