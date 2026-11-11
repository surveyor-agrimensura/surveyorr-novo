import { describe, expect, it } from 'vitest';
import { filterToolGroups, toolGroups } from '../src/data/navigation';

describe('busca no catálogo de ferramentas', () => {
  it('encontra ferramenta pelo nome sem exigir acentos', () => {
    expect(filterToolGroups(toolGroups, 'confrontacao').flatMap(group => group.tools.map(tool => tool.label)))
      .toEqual(['Cartas de Confrontação']);
  });

  it('também pesquisa a descrição da ferramenta', () => {
    expect(filterToolGroups(toolGroups, 'INCRA').flatMap(group => group.tools.map(tool => tool.label)))
      .toEqual(['Acervos Oficiais']);
  });

  it('mantém a divisão de glebas e partilha dentro do mapa', () => {
    expect(filterToolGroups(toolGroups, 'partilha').flatMap(group => group.tools.map(tool => tool.href)))
      .toContain('/mapa/');
  });

  it('mantém todos os grupos quando a busca está vazia e retorna vazio quando não há resultado', () => {
    expect(filterToolGroups(toolGroups, '')).toHaveLength(toolGroups.length);
    expect(filterToolGroups(toolGroups, 'ferramenta inexistente')).toEqual([]);
  });
});
