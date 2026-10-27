import assert from 'node:assert/strict';
import fs from 'node:fs';

const map = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8').replace(/!important/g,'');

assert.ok(map.includes("operation === 'restore' ? 'restore'"), 'Ferramenta deve possuir modo de restauração virtual.');
assert.ok(map.includes('function restoreHiddenVertex(layer, latlng)'), 'Restauração deve remover a chave persistida do vértice oculto.');
assert.ok(map.includes('Restaurar removidos virtualmente'), 'Menu deve expor restauração de vértices virtuais.');
assert.ok(map.includes("vertexHideOperation === 'restore' && !isHiddenVertex"), 'Modo de restauração deve aceitar somente vértices virtualmente ocultados.');
assert.ok(map.includes('scheduleRecoverySnapshot();'), 'Mudança deve participar do snapshot de recuperação do mapa.');
assert.ok(map.includes('pushUndoSnapshot(snapshotDrawn()'), 'Restauração deve entrar no histórico Undo/Redo.');
assert.ok(html.includes('restaurar removidos virtuais'), 'Tooltip da ferramenta deve explicar a restauração.');
assert.ok(css.includes('.surveyor-vertex-restore-mode .surveyor-edit-hidden-vertex-handle'), 'Vértices ocultos devem ficar visíveis durante restauração.');
assert.ok(css.includes('border-color:#16a34a'), 'Alvos de restauração devem possuir destaque visual próprio.');

console.log('✓ restauração de vértices virtuais no mapa validada');
assert.ok(map.includes('function restorableVertexLayers()'), 'Restauração deve descobrir todos os desenhos com vértices virtuais removidos.');
assert.ok(map.includes('function openVertexRestoreTargetChoice()'), 'Restauração deve possuir seletor próprio de desenho.');
assert.ok(map.indexOf('data-vertex-remove-mode="restore"') < map.indexOf('data-vertex-remove-mode="virtual"'), 'Restaurar removidos virtualmente deve ser a primeira ação do menu.');
assert.ok(map.includes('De qual desenho deseja restaurar os vértices?'), 'Com múltiplos desenhos, o usuário deve escolher explicitamente a origem da restauração.');
assert.ok(map.includes('if (candidates.length === 1)'), 'Um único desenho recuperável deve ser selecionado automaticamente.');
assert.ok(map.includes('select(item.layer, { focus: false });'), 'Escolha do desenho deve torná-lo o elemento ativo antes da restauração.');
assert.ok(css.includes('.surveyor-vertex-restore-list'), 'Seletor de desenhos deve possuir layout próprio e rolável.');
