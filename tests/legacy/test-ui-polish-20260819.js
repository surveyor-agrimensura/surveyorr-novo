import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p,'utf8');
const core = read('assets/css/core/ui.css');
const custom = read('assets/css/features/customizacao/app.css');
const sign = read('assets/css/features/assinatura-digital/app.css');
const scope = read('assets/js/core/document-scope.js');
for (const asset of ['projetos.svg','customizacao.svg','suporte.svg','assinatura-digital.svg']) {
  assert.ok(fs.existsSync(`assets/module-icons/${asset}`), `${asset} ausente`);
}
for (const target of ['empresa','tecnico','memorial','mapas','pranchas','planialtimetria','perimetro','ambiental','car','loteamento']) {
  assert.ok(fs.existsSync(`assets/module-icons/custom/${target}.svg`), `ícone amigável ${target} ausente`);
  assert.match(custom, new RegExp(`data-target=\\"${target}\\"`));
}
assert.match(custom, /top:17px!important/);
assert.match(custom, /grid-template-columns:minmax\(0,1fr\) 30px!important/);
assert.match(core, /support-mini-icon/);
assert.match(core, /perimetros\.html.*sv-document-workspace/s);
assert.match(scope, /field\.hidden = !entries\.length/);
assert.match(sign, /grid-template-columns:390px minmax\(0,1fr\)!important/);
console.log('OK: polimento UI 2026-08-19 — ícones, alinhamento, suporte, glebas condicionais e compactação validados.');
