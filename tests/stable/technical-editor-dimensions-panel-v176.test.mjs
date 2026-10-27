import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');

assert.match(source, /data-editor-tool="dimensions"[\s\S]*?title="Editar cotas"/, 'A barra lateral do editor deve expor a opção dedicada "Editar cotas".');
assert.match(source, /data-tool-panel="dimensions"[\s\S]*?Tamanho geral das cotas/, 'O painel de cotas deve conter o controle geral de tamanho.');
assert.match(source, /data-selected-dimension-controls hidden[\s\S]*?Ajuste desta cota/, 'O controle individual deve existir, mas permanecer oculto até selecionar uma cota.');
assert.match(source, /dimensions:'Editar cotas'/, 'O título do drawer deve reconhecer o painel de cotas.');
assert.match(source, /dimensionButton\.hidden=!dimensionsAvailable[\s\S]*dimensionButton\.disabled=!dimensionsAvailable/, 'O botão de cotas deve ser ocultado/desabilitado quando não houver cotas na prancha.');
const appearanceStart = source.indexOf('data-tool-panel="appearance"');
const dimensionsStart = source.indexOf('data-tool-panel="dimensions"');
assert.ok(appearanceStart >= 0 && dimensionsStart > appearanceStart, 'Os painéis de aparência e cotas devem existir na ordem esperada.');
const appearanceChunk = source.slice(appearanceStart, dimensionsStart);
assert.ok(!appearanceChunk.includes('dimensionScale'), 'Controles de cota não devem permanecer misturados no painel genérico de aparência.');
assert.doesNotMatch(source, /Somente a cota selecionada será redimensionada|Escala disponível:|Clique diretamente no valor de uma cota da planta para selecionar/, 'As explicações redundantes solicitadas para remoção não devem permanecer no painel.');

console.log('PASS technical-editor-dimensions-panel-v176: painel limpo com escala geral e opção individual contextual validado.');
