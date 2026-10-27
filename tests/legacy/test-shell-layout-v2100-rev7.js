import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const layout = read('assets/js/core/layout.js');
const stabilizer = read('assets/css/core/ui.css');

assert.match(layout, /function retireLegacySidebar\(/, 'O layout deve aposentar o sidebar legado nas paginas modernas.');
assert.match(layout, /module-icon-fallback/, 'Icones devem possuir fallback visivel.');
assert.match(stabilizer, /data-page="mapa\.html"/, 'O mapa deve ser excluido da ocultacao do sidebar legado.');
assert.match(stabilizer, /legacy-sidebar-retired|workspace-sidebar/, 'O estabilizador deve neutralizar o sidebar legado.');

for (const icon of ['memorial.png', 'ambiental.png']) {
  const file = path.join(root, 'assets', 'module-icons', icon);
  assert.equal(fs.existsSync(file), true, `Icone ausente: ${icon}`);
  assert.ok(fs.statSync(file).size > 1000, `Icone invalido ou vazio: ${icon}`);
}

const pages = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, entry.name, 'index.html'))
  .filter((file) => fs.existsSync(file));

for (const file of pages) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel.startsWith('functions/') || rel.startsWith('deploy/') || rel.startsWith('docs/')) continue;
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /surveyor-(?:ui|map|login|utilities)-current-v21\.11\.5\.css/, `${rel}: bundle visual atual ausente.`);
  assert.match(html, /class="[^"]*surveyor-ui-booting/, `${rel}: gate anti-flash atual ausente.`);
  assert.match(html, /surveyor-ui-runtime-current-v21\.11\.5\.js/, `${rel}: runtime visual atual ausente.`);
}

for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<a[^>]*href="\/memorial\/"[^>]*>([\s\S]*?)<\/a>/g)) {
    assert.doesNotMatch(match[1], /module-icons\/car\.png/, `${path.relative(root, file)}: Memorial ainda usa a imagem do CAR.`);
  }
  for (const match of html.matchAll(/<a[^>]*href="\/ambiental\/"[^>]*>([\s\S]*?)<\/a>/g)) {
    assert.doesNotMatch(match[1], /module-icons\/car\.png/, `${path.relative(root, file)}: Relatorio ambiental ainda usa a imagem do CAR.`);
  }
}

console.log('OK v21.10.0 REV7: shell moderno sem flash legado, sidebar restrito ao mapa e icones restaurados.');
