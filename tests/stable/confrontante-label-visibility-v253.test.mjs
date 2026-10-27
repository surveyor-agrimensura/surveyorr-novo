import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const confrontantes = fs.readFileSync('assets/js/features/mapas/confrontantes.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(editor,/data-registration-toggle="showPropertyInLabel"/,'Cadastro deve permitir escolher se o nome da propriedade aparece na prancha.');
assert.match(editor,/data-registration-toggle="showCpfCnpjInLabel"/,'Cadastro deve permitir escolher se o CPF\/CNPJ aparece na prancha.');
assert.match(editor,/segment\.showPropertyInLabel=Boolean\(/,'Preferência de exibição da propriedade deve ser persistida no segmento.');
assert.match(editor,/segment\.showCpfCnpjInLabel=Boolean\(/,'Preferência de exibição do CPF\/CNPJ deve ser persistida no segmento.');
assert.match(editor,/showCpfCnpjInLabel:item\.showCpfCnpjInLabel===true/,'CPF\/CNPJ deve permanecer opt-in ao normalizar o projeto.');
assert.match(editor,/sv-confrontante-cpf-text/,'Editor deve possuir uma segunda linha exclusiva para o CPF\/CNPJ.');
assert.match(editor,/const cpfLine=showCpf\?\(cpfDisplay\.label\|\|`CPF\/CNPJ: \${cpfCnpj}`\):''/,'CPF/CNPJ só deve entrar no rótulo quando a opção estiver marcada.');
assert.match(confrontantes,/showCpfCnpjInLabel: entry\.showCpfCnpjInLabel === true/,'Renderer deve tratar CPF\/CNPJ como opção explícita, sem exposição automática.');
assert.match(confrontantes,/const displayLabel = showProperty && propertyName \? `\$\{label\} — \$\{propertyName\}` : label/,'Nome da propriedade deve obedecer à checkbox do cadastro.');
assert.match(confrontantes,/if \(cpfLine\) parts\.push\(`<text class="sv-confrontante-cpf-text"/,'CPF\/CNPJ deve ser renderizado em linha própria abaixo do nome.');
assert.match(css,/\.sv-confrontante-registration-visibility\{[^}]*display:grid[^}]*place-items:center/,'Checkboxes de exibição devem ficar isoladas e alinhadas ao cabeçalho do respectivo campo.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V253: propriedade e CPF/CNPJ possuem exibição opcional e CPF fica em linha própria na prancha.');
