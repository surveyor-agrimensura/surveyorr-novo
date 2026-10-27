import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const memorial = fs.readFileSync('assets/js/features/memorial/app.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.match(editor, /function optionValue\(options = \{\}, key, fallback = ''\)/, 'Editor técnico deve resolver opções estáticas e callbacks pela mesma função.');
assert.doesNotMatch(editor, /options\.editorNoun\?\.\(\)/, 'editorNoun em string não pode ser invocado como função.');
assert.match(editor, /optionValue\(options, 'editorNoun', ''\)/, 'Título do editor deve aceitar editorNoun textual.');
assert.match(editor, /optionValue\(options, 'page'/, 'Page deve aceitar valor estático ou callback.');
assert.match(editor, /optionValue\(options, 'projectId'/, 'ProjectId deve aceitar valor estático ou callback.');
assert.match(editor, /optionValue\(options, 'layoutId'/, 'LayoutId deve aceitar valor estático ou callback.');
assert.doesNotMatch(memorial, /editorNoun:\s*'mapa do memorial'/, 'Memorial não deve instanciar o editor técnico completo apenas para opções visuais do mapa.');
assert.match(sw, /catch \(error\)[\s\S]*request\.mode === 'navigate'/, 'Service Worker deve tratar falha de rede local sem rejeição não tratada.');

console.log('PASS technical-editor-option-values: opções estáticas/callbacks e falha transitória do SW estão protegidas.');
