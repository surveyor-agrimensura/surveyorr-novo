import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SurveyorEditorEngine, Scene, GeometryKernel, SnapEngine, ToolStateMachine } from '../../assets/js/core/editor-engine/index.js';

const scene = new Scene();
scene.add({ id: 'a', type: 'label', data: { x: 10, y: 20 } });
assert.equal(scene.get('a').data.x, 10, 'Scene deve registrar nós editáveis.');

const geometry = new GeometryKernel();
assert.equal(geometry.distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5, 'Kernel geométrico deve calcular distância vetorial.');
assert.equal(geometry.polygonArea([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]), 100, 'Kernel geométrico deve calcular área.');

const snap = new SnapEngine({ geometry, tolerance: 3 });
const snapped = snap.snap({x:9,y:1},{vertices:[{x:10,y:0}],segments:[]});
assert.equal(snapped.kind, 'vertex', 'SnapEngine deve priorizar vértice dentro da tolerância.');

const engine = new SurveyorEditorEngine({ historyLimit: 8 });
engine.addNode({ id: 'node', type: 'label', data: { x: 1 }, locked: false });
engine.updateNode('node', { data: { x: 5 } }, 'Mover');
assert.equal(engine.getNode('node').data.x, 5, 'Engine deve executar comando de alteração.');
assert.equal(engine.history.canUndo, true, 'CommandStack deve registrar undo.');
engine.undo();
assert.equal(engine.getNode('node').data.x, 1, 'Undo deve restaurar estado anterior.');
engine.redo();
assert.equal(engine.getNode('node').data.x, 5, 'Redo deve reaplicar comando.');
engine.lock('node', true);
assert.equal(engine.getNode('node').locked, true, 'Engine deve controlar bloqueio do nó.');

// Validação da Máquina de Estados (FSM) de Ferramentas
let deactivatedOld = false;
let activatedNew = false;
engine.tools.registerTool({
  id: 'tool-a',
  activate() {},
  deactivate() { deactivatedOld = true; }
});
engine.tools.registerTool({
  id: 'tool-b',
  activate() { activatedNew = true; },
  deactivate() {}
});
assert.equal(engine.getActiveToolId(), 'idle', 'Estado inicial deve ser idle');
assert.equal(engine.toggleTool('tool-a'), true, 'Primeiro clique deve ativar tool-a');
assert.equal(engine.getActiveToolId(), 'tool-a');
assert.equal(engine.setTool('tool-b'), true, 'Transição atômica de tool-a para tool-b');
assert.equal(deactivatedOld, true, 'Transição deve desativar a ferramenta anterior');
assert.equal(activatedNew, true, 'Transição deve ativar a nova ferramenta');
assert.equal(engine.setTool('inexistente'), false, 'Ferramenta desconhecida não pode ser anunciada como ativada.');
assert.equal(engine.getActiveToolId(), 'tool-b', 'Tentativa inválida não pode desativar ferramenta atual.');
assert.throws(() => engine.tools.registerTool({ id: 'sem-desativacao', activate() {} }), /deactivate/, 'JS também deve exigir limpeza obrigatória.');
assert.equal(engine.toggleTool('tool-b'), false, 'Segundo clique na ferramenta ativa deve fazer toggle off');
assert.equal(engine.getActiveToolId(), 'idle', 'Ao desativar deve retornar ao estado idle');

engine.tools.registerTool({ id: 'insegura', activate() {}, deactivate() { throw new Error('falha ao limpar'); } });
assert.equal(engine.setTool('insegura'), true);
assert.equal(engine.setTool('tool-a'), false, 'Falha em deactivate deve impedir ferramenta concorrente.');
assert.equal(engine.getActiveToolId(), 'insegura', 'FSM conserva ferramenta ativa até limpeza ser concluída.');
assert.equal(engine.tools.unregisterTool('insegura'), false, 'Não descadastrar ferramenta cuja limpeza falhou.');
engine.destroy();
assert.equal(engine.getActiveToolId(), 'idle', 'Destruição deve liberar referência da ferramenta mesmo com exceção.');

const editor = await readFile(new URL('../../assets/js/core/technical-document-editor.js', import.meta.url), 'utf8');
assert.match(editor, /import\('\/assets\/js\/core\/editor-engine\/index\.js'\)/, 'Editor documental deve carregar o motor formal.');
assert.match(editor, /await mountEditorEngine\(overlay\)/, 'Editor documental deve montar o motor na edição real.');
assert.match(editor, /data-editor-engine-version/, 'Runtime deve identificar a versão do engine no editor.');
assert.match(editor, /SurveyorEditorEngineRuntime/, 'Runtime deve expor diagnóstico do engine ativo.');
assert.match(editor, /function autoOrganizeLayout/, 'Editor deve implementar auto-organização de layout.');
assert.match(editor, /function autoOrganizeVertices/, 'Editor deve calcular bissetriz externa dos vértices.');
assert.match(editor, /function applyRegulatoryPreset/, 'Editor deve suportar perfis normativos INCRA, SEIA/CEFIR, Comercial e REURB.');
assert.match(editor, /function highlightCoordinateVertex/, 'Editor deve suportar destaque cruzado tabela <-> vértices.');
assert.match(editor, /function attachLiveFieldDirectEditing/, 'Editor deve suportar edição in-place do selo/carimbo.');
assert.match(editor, /data-editor-action="auto-organize"/, 'Rodapé deve expor ação de auto-organização da prancha.');
assert.match(editor, /data-document-setting="regulatoryPreset"/, 'Aparência deve expor seletor de padrões regulatórios.');
assert.doesNotMatch(editor, /attachVertexLabelDrag\(/, 'Implementação antiga de drag de vértice não deve coexistir com o motor.');
assert.doesNotMatch(editor, /attachAreaNameDrag\(/, 'Implementação antiga de drag do nome não deve coexistir com o motor.');

console.log('OK: motor formal de edição possui Scene, GeometryKernel, SnapEngine, CommandStack, auto-organização e padrões regulatórios.');
