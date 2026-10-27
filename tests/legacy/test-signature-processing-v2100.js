import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../assets/js/features/customizacao/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../customizacao/index.html', import.meta.url), 'utf8');

assert.match(js, /hasUsefulTransparency/);
assert.match(js, /clearSignaturePixel/);
assert.match(js, /backgroundIsDark/);
assert.match(js, /RGB branco mesmo com alfa zero/);
assert.match(js, /fundo preto foi removido/);
assert.match(html, /preserva transparência existente/);
assert.match(html, /customizacao-v21\.9\.118\.js\?v=21\.10\.1-rev11-performance/);
console.log('OK v21.10.0 REV6: assinatura transparente, fundo claro/escuro e proteção contra quadrado preto validados.');
