import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const editor = read('assets/js/core/technical-document-editor.js');
const rendererSource = read('assets/js/features/mapas/confrontantes.js');
const memorial = read('assets/js/features/memorial/app.js');
const css = read('assets/css/core/documents.css');

assert.match(editor, /menuButton\.dataset\.segmentMenuToggle='1'[\s\S]*menuButton\.textContent='⋯'/, 'Cada confrontante deve expor menu de três pontos no lugar do X de exclusão.');
assert.ok(editor.includes('Cadastro completo') && editor.includes('Excluir confrontante'), 'Menu do confrontante deve permitir abrir cadastro completo ou excluir.');
assert.match(editor,/row\.className='sv-confrontante-compact-row'/,'Lista principal deve usar uma linha compacta por lado.');
assert.match(editor,/segmentVertexDisplayLabel[\s\S]*label\.textContent=`Do \$\{startLabel\} ao \$\{endLabel\}`/,'Lista principal deve identificar diretamente o intervalo de cada lado usando os rótulos reais dos vértices.');
assert.match(editor,/input\.className='sv-confrontante-compact-input'[\s\S]*input\.placeholder='Nome do confrontante'/,'Campo principal deve ser somente o nome direto do confrontante.');
assert.match(editor,/input\.addEventListener\('input',syncName\)/,'Nome digitado deve atualizar o mapa imediatamente.');
assert.doesNotMatch(editor,/sv-confrontante-registration-summary sv-confrontante-registration-summary-compact/,'Resumo cadastral adicional não deve ocupar espaço na lista principal.');
assert.doesNotMatch(editor,/label class="sv-confrontante-label-color"/,'Cor e demais detalhes devem ficar apenas no cadastro dos três pontos.');
assert.ok(!editor.includes('title="Remover confrontante">×</button>'), 'O X antigo não pode continuar como ação principal de exclusão.');
for (const field of ['propriedade', 'cpfCnpj', 'orientacao', 'tipoLimite', 'observacao']) {
  assert.ok(editor.includes(`data-registration-field="${field}"`), `Cadastro deve possuir campo ${field}.`);
}
assert.ok(editor.includes("orientacao:safeText(segment.orientacao), observacao:safeText(segment.observacao)"), 'Salvamento do layout deve transportar orientação e observação no estado oficial do projeto.');
assert.ok(editor.includes("['nome','name','confrontante','propriedade','propertyName','imovel','cpfCnpj'") && editor.includes("delete clean[key]"), 'Sincronização por lado deve limpar cadastro antigo antes de aplicar os confrontantes atuais, evitando reaparecimento após exclusão.');
assert.ok(editor.includes("orientacao:safeText(item.orientacao || '')") && editor.includes("observacao:safeText(item.observacao || '')"), 'Espelho por segmento usado pelo Memorial deve receber orientação e observação.');
assert.ok(editor.includes('semanticById') && editor.includes('registered?.orientacao') && editor.includes('registered?.observacao'), 'Cadastro semântico já salvo deve sobreviver a layouts visuais antigos que não tinham todos os campos.');
assert.ok(css.includes('.sv-confrontante-segment-menu') && css.includes('.sv-confrontante-registration-card'), 'Menu e formulário de cadastro devem possuir estilos próprios no editor técnico.');
assert.ok(memorial.includes('tendo como limite') && memorial.includes('na orientação'), 'Memorial deve continuar consumindo tipo de divisa e orientação do confrontante salvo no projeto.');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(rendererSource, context);
const engine = context.window.SurveyorDocumentConfrontantes.create({ escape: (value) => String(value ?? '') });
const coords = [[0,0],[4,0],[4,3],[0,3],[0,0]];
const feature = { properties: { confrontanteTrechos: [{
  id:'cad-1', nome:'Herança de Jorge', propriedade:'Fazenda Modelo', cpfCnpj:'123.456.789-00', tipoLimite:'Cerca', orientacao:'Norte', observacao:'Cerca de arame', startVertex:1, endVertex:2
}] } };
const groups = engine.buildConfrontanteGroups(feature, coords);
assert.equal(groups.length, 1, 'Cadastro persistido deve reconstruir um grupo de confrontação na geração seguinte.');
assert.equal(groups[0].propriedade, 'Fazenda Modelo');
assert.equal(groups[0].cpfCnpj, '123.456.789-00');
assert.equal(groups[0].tipoLimite, 'Cerca');
assert.equal(groups[0].orientacao, 'Norte');
assert.equal(groups[0].observacao, 'Cerca de arame');
const svg = engine.smartConfrontanteLabels(feature, coords, ([x,y]) => [100 + x * 100, 100 + y * 100], { x:50, y:50, w:700, h:500 }, { placement:'boundary', fontSize:10 });
assert.ok(svg.includes('data-confrontante-property="Fazenda Modelo"') && svg.includes('data-orientacao="Norte"') && svg.includes('data-observacao="Cerca de arame"'), 'SVG documental deve transportar o cadastro semântico de volta ao editor compartilhado.');

console.log('PASS confrontante project registration: cadastro permanente, menu de três pontos, exclusão limpa e reutilização em documentos.');
