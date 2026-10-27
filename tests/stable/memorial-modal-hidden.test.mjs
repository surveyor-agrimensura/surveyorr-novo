import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('assets/css/features/memorial/signature.css', 'utf8');
const modal = fs.readFileSync('assets/js/features/memorial/app.js', 'utf8');
assert.match(css, /\.memorial-sign-modal\[hidden\]\s*\{\s*display:\s*none\s*\}/,
  'O modal oculto deve respeitar o atributo HTML hidden.');
assert.match(css, /\.memorial-sign-modal:not\(\.is-inline-personalization\):not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/,
  'A regra de exibição do popup só pode afetar modais sem hidden.');
assert.match(modal, /modal\.hidden=true;[\s\S]*?modal\.setAttribute\('aria-hidden','true'\)/,
  'Fechar o Memorial deve restaurar o estado oculto.');
assert.match(modal, /modal\.hidden=false;modal\.setAttribute\('aria-hidden','false'\)/,
  'Abrir o editor explicitamente deve exibir o modal.');
console.log('PASS memorial-modal-hidden: popup não pode aparecer espontaneamente nem permanecer visível após fechar.');
