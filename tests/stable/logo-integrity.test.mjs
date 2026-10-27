import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

// A marca redonda oficial é a imagem integral enviada pelo titular.
// Alterações futuras de identidade visual devem atualizar esta referência.
const logo = fs.readFileSync('assets/logo.png');
assert.equal(logo.toString('hex', 0, 8), '89504e470d0a1a0a', 'logo deve ser PNG');
const width = logo.readUInt32BE(16);
const height = logo.readUInt32BE(20);
assert.equal(width, 1647, 'largura da imagem oficial');
assert.equal(height, 1766, 'altura original com respiro transparente inferior');
assert.equal(crypto.createHash('sha256').update(logo).digest('hex'),
  'd45b6077f6993dfa140f1dac0eb22f57ad597b5bc18b11a855c9460eb5ec2e1c',
  'a marca precisa corresponder exatamente ao arquivo oficial enviado');
for (const [size, path] of [
  [192, 'assets/pwa/surveyor-192.png'],
  [512, 'assets/pwa/surveyor-512.png'],
]) {
  const icon = fs.readFileSync(path);
  assert.equal(icon.toString('hex', 0, 8), '89504e470d0a1a0a', `icone ${size} deve ser PNG`);
  assert.equal(icon.readUInt32BE(16), size, `largura ${size}`);
  assert.equal(icon.readUInt32BE(20), size, `altura ${size}`);
}
const homepage = fs.readFileSync('index.html', 'utf8');
assert.match(homepage, /class="home-hero-mark"[^]*?<img src="assets\/logo\.png/, 'hero usa logo oficial');
assert.match(homepage, /class="home-footer-brand"[^]*?<img src="assets\/logo\.png/, 'rodape usa logo oficial');
const homeCss = fs.readFileSync('assets/home-hero.css', 'utf8');
assert.match(homeCss, /\.home-hero-mark img\{[^}]*object-fit:cover;[^}]*object-position:center top/, 'o hero enquadra circulo sem cortar conteudo');
console.log('PASS logo-integrity: imagem integral oficial, icones PWA e enquadramento da Home.');
