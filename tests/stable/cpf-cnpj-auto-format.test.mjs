import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const ui = fs.readFileSync('assets/js/core/ui.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const confrontantes = fs.readFileSync('assets/js/features/mapas/confrontantes.js','utf8');

assert.match(bridge,/function formatCpfCnpj\(value\)/,'Deve existir uma única formatação documental compartilhada para CPF/CNPJ.');
assert.match(bridge,/digits\.length === 11[\s\S]*label:`CPF: \$\{formatted\}`/,'CPF completo deve ser identificado e rotulado automaticamente como CPF.');
assert.match(bridge,/digits\.length === 14[\s\S]*label:`CNPJ: \$\{formatted\}`/,'CNPJ completo deve ser identificado e rotulado automaticamente como CNPJ.');
assert.match(ui,/\['\[data-registration-field="cpfCnpj"\]', 'cpfcnpj'\]/,'Campo dinâmico do cadastro de confrontante deve usar a máscara central.');
assert.match(editor,/data-sv-mask-type="cpfcnpj" data-registration-field="cpfCnpj"/,'Modal do confrontante deve declarar explicitamente a máscara CPF/CNPJ.');
assert.match(editor,/formatCpfCnpj\?\.\(read\('cpfCnpj'\)\)/,'Cadastro deve persistir o documento já normalizado.');
assert.match(editor,/cpfCnpjDisplay\?\.\(segment\.cpfCnpj\)/,'Prévia técnica deve formatar valores antigos antes de desenhar o rótulo.');
assert.match(confrontantes,/cpfCnpjDisplay\?\.\(group\.cpfCnpj\)/,'Renderer compartilhado de confrontantes deve usar a mesma identificação CPF/CNPJ.');

console.log('PASS cpf-cnpj-auto-format: máscara em digitação, persistência normalizada e rótulo CPF/CNPJ automático validados.');
