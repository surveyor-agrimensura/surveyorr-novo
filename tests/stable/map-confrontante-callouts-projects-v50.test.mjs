import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const mapApp = read('assets/js/features/mapa/app.js');
const mapHtml = read('mapa/index.html');
const docsConfront = read('assets/js/features/mapas/confrontantes.js');
const editor = read('assets/js/core/technical-document-editor.js');
const ui = read('assets/js/core/ui.js');

assert.ok(!mapHtml.includes('id="traceConfrontanteGuides"'), 'Mapa não deve oferecer desenho de linhas visuais.');
assert.ok(!mapHtml.includes('id="addFreeConfrontanteCallout"') && !mapHtml.includes('id="freeConfrontanteDialog"'), 'Chamadas livres antigas devem sair da interface do mapa.');
assert.ok(mapHtml.includes('Aplicar do vértice') && mapHtml.includes('Vértice final'), 'Mapa deve continuar definindo confrontante por intervalo.');
assert.ok(mapApp.includes('o mapa cadastra somente o confrontante lógico por intervalo'), 'Runtime do mapa deve manter linhas visuais fora do mapa.');
assert.ok(mapApp.includes('delete p.confrontanteChamadas'), 'Ao normalizar/salvar, lixo visual antigo deve ser removido.');
assert.ok(docsConfront.includes('Chamadas visuais antigas desenhadas no mapa') && docsConfront.includes('confrontanteVisualLayout'), 'Documentos devem ignorar chamadas antigas e usar layout documental.');
assert.ok(editor.includes('saveProjectVisualLayout') && editor.includes('confrontanteVisualLayout'), 'Editor deve salvar o visual final dentro do projeto.');
assert.ok(ui.includes("['loteamentos-reurb.html','nuvem.html','acervos.html','customizacao.html'].includes(page)"), 'Projetos, Acervos e Personalização não devem voltar ao acordeão genérico Etapa 1.');

console.log('PASS V50 mapa: confrontante apenas semântico; desenho visual fica nas gerações e salva no projeto.');
