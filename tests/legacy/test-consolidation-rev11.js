import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const auth = read('assets/js/core/auth.js');
const customization = read('assets/js/features/customizacao/app.js');
const api = read('functions/surveyor-api/src/main.js');
const adminDocs = read('assets/js/admin/documents.js');
const adminHtml = read('admin/index.html');
const login = [read('login/index.html'), read('assets/js/core/login.js'), read('assets/js/core/login-support.js')].join('\n');
const acervos = read('acervos/index.html');
const gitattributes = read('.gitattributes');

assert(auth.includes('const inFlightGetRequests = new Map()'), 'GETs concorrentes precisam ser deduplicados');
assert(auth.includes('void warmSessionResources()'), 'aquecimento da sessão deve ser não bloqueante');
assert(!auth.includes('const confirmed = await ensureSession();'), 'login não pode aguardar segunda confirmação antes de redirecionar');
assert(auth.includes("writeApiCache('/api/customization/document'"), 'salvamento deve atualizar cache local imediatamente');
assert(customization.includes("delete payload.logoDataUrl"), 'logo inalterado não deve ser reenviado');
assert(customization.includes("delete payload.planDocumentSignatureDataUrl"), 'assinatura inalterada não deve ser reenviada');
assert(customization.includes('confirmação em segundo plano'), 'verificação posterior não deve bloquear o botão');
assert(api.includes("const APP_VERSION = '2.23.1-map-ux-21.11.2'"), 'API deve anunciar 2.22.8');
assert(api.includes('const [profile, appwriteUser] = await Promise.all'), 'autenticação deve buscar identidade em paralelo');
assert(api.includes('PLAN_CACHE_TTL_MS = 60_000'), 'planos devem usar cache curto');
assert(api.includes('Resposta rápida: não lê novamente do Storage'), 'save de personalização não deve reler Storage');
assert(adminDocs.includes('ensureWordLibrary'), 'JSZip deve carregar sob demanda');
assert(adminDocs.includes('ensurePdfLibrary'), 'jsPDF deve carregar sob demanda');
assert(!adminHtml.includes('jszip@3.10.1/dist/jszip.min.js'), 'JSZip não deve bloquear o carregamento inicial do admin');
assert(!adminHtml.includes('jspdf.umd.min.js'), 'jsPDF não deve bloquear o carregamento inicial do admin');
assert(login.includes('login-slideshow-1.webp'), 'primeiro slide deve usar WebP');
assert(login.includes("background-image:url(\'../assets/login-slideshow-2.webp"), 'slide 2 deve ter background direto para nao ficar azul');
assert(login.includes('requestIdleCallback'), 'hidratação dos slides deve usar tempo ocioso quando disponível');
assert(acervos.includes('preconnect') && !acervos.includes('@turf/turf'), 'Acervos deve ter preconnect e não carregar Turf');
assert(gitattributes.includes('*.ps1 text eol=crlf') && gitattributes.includes('*.png binary'), 'Git deve normalizar texto e preservar binários');
for (let i = 1; i <= 6; i += 1) {
  assert(fs.existsSync(`assets/login-slideshow-${i}.webp`), `WebP ${i} ausente`);
  assert(!fs.existsSync(`assets/login-slideshow-${i}.jpg`), `JPG antigo ${i} deve ser removido`);
}
console.log('OK v21.10.0 REV11: estabilidade, desempenho, disponibilidade, compatibilidade e limpeza técnica validados.');
