import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const excluded = new Set(['dist','tests','node_modules','legacy','.git']);
function htmlFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : htmlFiles(path.join(directory,entry.name));
    return entry.isFile() && entry.name.endsWith('.html') ? [path.join(directory,entry.name)] : [];
  });
}
let checked = 0;
for (const file of htmlFiles('.')) {
  const html = fs.readFileSync(file, 'utf8');
  const srcs = [...html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)]
    .map(match => match[1].split('?')[0]);
  const seen = new Set();
  for (const src of srcs) {
    assert.ok(!seen.has(src), `${file}: script carregado duas vezes: ${src}`);
    seen.add(src);
  }
  checked++;
}
assert.ok(checked > 0, 'Nenhum HTML auditado');
console.log(`PASS no-duplicate-scripts: ${checked} páginas sem duplicação literal de scripts externos.`);
