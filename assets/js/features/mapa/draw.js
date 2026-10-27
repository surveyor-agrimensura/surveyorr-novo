(() => {
  'use strict';

  function installPortugueseLeafletDraw(L = window.L) {
    if (!L?.drawLocal) return;
    const local = L.drawLocal;
    local.draw = local.draw || {};
    local.draw.toolbar = local.draw.toolbar || {};
    local.draw.toolbar.actions = { title: 'Cancelar desenho', text: 'Cancelar' };
    local.draw.toolbar.finish = { title: 'Finalizar desenho', text: 'Finalizar' };
    local.draw.toolbar.undo = { title: 'Remover último ponto', text: 'Desfazer ponto' };
    local.draw.toolbar.buttons = {
      polyline: 'Desenhar linha', polygon: 'Desenhar polígono', rectangle: 'Desenhar retângulo',
      circle: 'Desenhar círculo', marker: 'Adicionar ponto', circlemarker: 'Adicionar ponto circular'
    };
    local.draw.handlers = local.draw.handlers || {};
    local.draw.handlers.polyline = {
      tooltip: { start: 'Clique para iniciar a linha.', cont: 'Clique para continuar a linha.', end: 'Clique no último ponto para finalizar.' },
      error: '<strong>Erro:</strong> as linhas não podem se cruzar.'
    };
    local.draw.handlers.polygon = { tooltip: { start: 'Clique para iniciar o polígono.', cont: 'Clique para continuar o polígono.', end: 'Clique no primeiro ponto para fechar.' } };
    local.draw.handlers.rectangle = { tooltip: { start: 'Clique e arraste para desenhar o retângulo.' } };
    local.draw.handlers.circle = { tooltip: { start: 'Clique e arraste para desenhar o círculo.' }, radius: 'Raio' };
    local.draw.handlers.marker = { tooltip: { start: 'Clique no mapa para adicionar o ponto.' } };
    local.edit = local.edit || {};
    local.edit.toolbar = local.edit.toolbar || {};
    local.edit.toolbar.actions = {
      save: { title: 'Salvar alterações', text: 'Salvar' },
      cancel: { title: 'Cancelar edição', text: 'Cancelar' },
      clearAll: { title: 'Remover todos os elementos', text: 'Limpar tudo' }
    };
    local.edit.toolbar.buttons = {
      edit: 'Editar elementos', editDisabled: 'Nenhum elemento para editar',
      remove: 'Excluir elementos', removeDisabled: 'Nenhum elemento para excluir'
    };
    local.edit.handlers = local.edit.handlers || {};
    local.edit.handlers.edit = {
      tooltip: {
        text: 'Arraste os vértices ou uma aresta destacada em vermelho para editar o desenho.',
        subtext: 'Passe o mouse sobre a linha para selecionar a aresta inteira.'
      }
    };
    local.edit.handlers.remove = { tooltip: { text: 'Clique no elemento que deseja excluir.' } };
  }

  window.SurveyorMapDraw = Object.freeze({ installPortugueseLeafletDraw });
})();
