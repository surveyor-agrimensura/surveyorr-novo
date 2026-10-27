import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const css = fs.readFileSync('assets/css/core/documents.css', 'utf8');

assert.match(source,/function hasManualTechnicalLines\(\)/,'Linhas técnicas devem ter helper único para saber se já existem linhas manuais.');
assert.match(source,/toggle\.disabled=!hasManualLines/,'Botão Editar linhas deve ficar desabilitado enquanto não houver linhas técnicas.');
assert.match(source,/removeLast\.disabled=!hasManualLines/,'Botão Remover última linha deve ficar desabilitado enquanto não houver linhas técnicas.');
assert.match(source,/if\(!hasManualLines\)\{[\s\S]*editLinesActive=false;[\s\S]*selectedLineRef=null;/,'Ao zerar as linhas técnicas, o modo de edição deve ser desligado e a seleção limpa.');
assert.match(source,/if\(!hasManualTechnicalLines\(\)\)\{[\s\S]*Desenhe uma linha técnica para liberar a edição e a remoção\./,'Tentativa de editar sem linhas deve orientar o usuário em vez de ativar o modo.');
assert.match(css,/\.sv-editor-element-card\{[\s\S]*min-height:98px;[\s\S]*padding:7px;/,'Cards de Elementos devem ficar mais compactos e limitados ao tamanho homologado.');
assert.match(css,/\.sv-editor-element-color-control i\{[\s\S]*display:block;[\s\S]*aspect-ratio:1\/1;[\s\S]*transform:rotate\(45deg\);/,'Indicador do seletor de cor deve ser renderizado sem artefato residual.');
assert.match(css,/\.sv-editor-polygon-style-card\{display:grid;gap:7px;padding:8px;/,'Cards de polígonos da Aparência devem usar a versão compacta padronizada.');

console.log('PASS V248: line actions gated by real technical lines and compact cards aligned.');
