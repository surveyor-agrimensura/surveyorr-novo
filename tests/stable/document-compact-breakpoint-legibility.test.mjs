import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('assets/css/core/documents.css', 'utf8');
const styles = [
  ['body.sv-document-compact-model.sv-document-workspace-page .sv-doc-step-head p', /font-size:\s*1[01]px/],
  ['body.sv-document-compact-model.sv-document-workspace-page .sv-doc-fields label,\nbody.sv-document-compact-model.sv-document-workspace-page .sv-doc-generated-label', /font-size:\s*11px/],
  ['body.sv-document-compact-model.sv-document-workspace-page .sv-doc-fields input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),', /font-size:\s*11px/],
  ['body.sv-document-compact-model.sv-document-workspace-page .sv-doc-nav-btn', /font-size:\s*11px/],
  ['body.sv-document-compact-model.sv-document-workspace-page .sv-doc-compact-footer-actions>.btn,', /font-size:\s*11px/],
  ['body.sv-document-workspace-page .sv-doc-draft-btn', /font-size:\s*11px/],
  ['body[data-page="pranchas.html"].sv-document-workspace-page .sv-prancha-footer-download-trigger', /font-size:\s*11px/],
];
for (const [start, value] of styles) {
  const position = css.indexOf(start);
  assert(position !== -1, `Seletor canônico ausente: ${start}`);
  const end = css.indexOf('}', position);
  assert.match(css.slice(position, end), value, `Texto operacional precisa continuar legível: ${start}`);
}
const desktopSelector = 'body.sv-document-compact-model.sv-document-workspace-page .sv-doc-workspace:not(.sv-beta-personalization-active)';
const desktop = css.indexOf(desktopSelector);
assert(desktop !== -1, 'Bancada compacta canônica deve continuar definida');
const mobile = css.lastIndexOf(`  ${desktopSelector}{`);
assert(mobile > desktop, 'Mobile deve declarar o mesmo seletor (mesma especificidade), depois da regra desktop');
const media = css.lastIndexOf('@media(max-width:900px){', mobile);
assert(media !== -1 && media > desktop, 'Regra de coluna única precisa pertencer à media query mobile');
const end = css.indexOf('}', mobile);
assert.match(css.slice(mobile, end), /grid-template-columns:\s*(?:minmax\(0,1fr\)|1fr)/);
assert.match(css.slice(mobile, end), /grid-template-rows:\s*auto minmax\((?:400|520)px,1fr\) auto/);
assert.equal((css.match(/!important/g) || []).length, 0, 'Evitar correções com !important');
console.log('PASS: breakpoint compacto não perde pela especificidade e controles têm tipografia legível.');
