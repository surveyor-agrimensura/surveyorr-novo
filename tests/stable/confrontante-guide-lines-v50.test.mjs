import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const editor = read('assets/js/core/technical-document-editor.js');
const confrontantes = read('assets/js/features/mapas/confrontantes.js');
const vertices = read('assets/js/features/mapas/vertices.js');
const mapas = read('assets/js/features/mapas/app.js');
const css = read('assets/css/core/documents.css');

assert.ok(confrontantes.includes('outwardNormal'), 'Chamadas principais devem nascer automaticamente para fora do perímetro.');
assert.ok(confrontantes.includes('data-guide-line="1"') && confrontantes.includes('data-guide-line="2"'), 'Cada confrontante deve ter duas linhas principais independentes.');
assert.ok(!confrontantes.includes('class="sv-confrontante-guide-bridge"'), 'Não deve existir ponte automática ligando as pontas das duas linhas.');
assert.ok(confrontantes.includes('labelRotation') && confrontantes.includes('sv-confrontante-label-rotator'), 'Nome deve aceitar rotação na geração.');
assert.ok(confrontantes.includes('extraLines'), 'Motor deve renderizar linhas extras independentes.');

assert.ok(editor.includes('attachGuideHandleDrag'), 'Pontas das linhas devem ser arrastáveis para redimensionar/reposicionar.');
assert.ok(editor.includes('sv-confrontante-compact-input') && editor.includes('Nome do confrontante'), 'Nome do confrontante deve ficar disponível diretamente por lado na lista compacta.');
assert.ok(!editor.includes('data-registration-field="labelScale"') && !editor.includes('data-registration-field="labelRotation"'), 'Cadastro completo não deve misturar ajustes visuais de tamanho/rotação.');
assert.ok(editor.includes('data-confrontante-context-scale') && editor.includes('data-confrontante-context-rotation'), 'Tamanho e rotação do confrontante devem ficar no menu contextual direto da prancha.');
assert.ok(editor.includes('Desenhar linha') && editor.includes('Remover última linha'), 'Editor V55 deve criar uma linha independente por comando e permitir removê-la.');
assert.ok(editor.includes('documentSettings.technicalLines') && editor.includes('startTechnicalLineMode'), 'Linhas técnicas novas devem usar o estado visual compartilhado, sem depender de confrontante fictício.');
assert.ok(!editor.includes('segment.extraLines.push'), 'O comando Desenhar linha não deve mais gravar nova linha dentro de confrontante.');
assert.ok(css.includes('.sv-editor-guide-handle') && css.includes('.sv-confrontante-label-rotation'), 'CSS deve expor handles e rotação de rótulo.');

assert.ok(vertices.includes('* 2.15'), 'Números dos vértices devem permanecer legíveis sem dominar perímetros densos.');
assert.ok(mapas.includes('font-size="11.4"'), 'Modelo georreferenciado também deve usar número de vértice maior.');
assert.ok(mapas.includes("const showConfrontantes = enabled('showConfrontantes','mapShowConfrontantes')"), 'Opção com/sem confrontantes deve continuar controlando a geração, inclusive quando o renderer é reutilizado por outro documento.');

console.log('PASS linhas técnicas: chamadas legadas preservadas, novas linhas independentes do confrontante e vértices equilibrados.');
