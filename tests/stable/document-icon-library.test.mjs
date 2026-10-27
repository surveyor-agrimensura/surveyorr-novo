import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';

const read = (p) => readFileSync(p,'utf8');
const stylesheet='assets/css/core/action-icons.css';
const css=read(stylesheet);
const pages=['memorial','mapas','pranchas','planialtimetria','loteamentos-reurb'];
for(const page of pages){
  const html=read(`${page}/index.html`);
  assert.match(html, /\/assets\/css\/core\/action-icons\.css\?v=/, `${page}: carregar ícones locais após estilos canônicos`);
  assert.equal((html.match(/action-icons\.css/g)||[]).length,1, `${page}: não duplicar biblioteca`);
}
const matches=[...css.matchAll(/\/assets\/icons\/ui\/([\w-]+\.svg)/g)].map(m=>m[1]);
const names=new Set(matches);
assert.ok(names.size>=12, 'Coleção seletiva deve integrar ícones em ações gerais e módulos técnicos');
for(const name of names){
  const file=`assets/icons/ui/${name}`;
  assert.ok(existsSync(file), `SVG referido não existe: ${file}`);
  const xml=read(file);
  assert.match(xml, /<svg\b/);
  assert.doesNotMatch(xml, /<(script|foreignObject|image)\b|\son\w+\s*=|(?:href|src)\s*=\s*[\"']https?:\/\//i, `SVG não deve conter recursos ativos/externos: ${file}`);
}
const svgs=readdirSync('assets/icons/ui').filter(f=>f.endsWith('.svg'));
assert.deepEqual(new Set(svgs),names, 'Somente SVGs efetivamente referidos devem permanecer no pacote');
assert.match(css, /data-editor-tool="dimensions"/, 'Ferramenta de cotas integrada');
assert.match(css, /data-memorial-personalization-tool="signature"/, 'Aba Assinatura integrada');
assert.match(css, /\.sv-doc-save-changes::before/, 'Salvar alterações integrado');
assert.doesNotMatch(css, /!important|@import\b|<script\b/, 'Sem hacks de CSS, scripts e dependências remotas');
assert.ok(existsSync('assets/icons/ui/LICENSE-TABLER.txt'));
assert.ok(existsSync('assets/icons/ui/LICENSE-LUCIDE.txt'));
// Teste de preservação de superfície: os rótulos canônicos continuam no JS e no DOM.
const docs=read('assets/js/core/documents.js');
const tech=read('assets/js/core/technical-document-editor.js');
const memorial=read('assets/js/features/memorial/app.js');
assert.match(docs, /'Salvar alterações'/);
assert.match(docs, /'Salvar rascunho'/);
assert.match(tech, /data-editor-tool="dimensions"/);
assert.match(memorial, /data-memorial-personalization-tool="signature"/);
console.log(`PASS document-icon-library: ${names.size} SVGs locais presentes, 5 telas, rótulos e handlers preservados.`);
