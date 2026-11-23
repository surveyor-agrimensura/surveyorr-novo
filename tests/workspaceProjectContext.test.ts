import { describe, expect, it } from 'vitest';
import { projectIdFromSearch, withProjectSearch, workspaceProjectContextKey } from '../src/lib/workspaceProjectContext';

describe('contexto de projeto entre módulos', () => {
  it('lê o projeto da URL sem confundir parâmetros', () => {
    expect(projectIdFromSearch('?feature=gleba-2&project=projeto%2F1')).toBe('projeto/1');
    expect(projectIdFromSearch('?feature=gleba-2')).toBe('');
  });

  it('preserva parâmetros existentes ao definir ou remover o projeto', () => {
    expect(withProjectSearch('/memorial?feature=gleba-2', 'projeto/1')).toBe('/memorial?feature=gleba-2&project=projeto%2F1');
    expect(withProjectSearch('/memorial?feature=gleba-2&project=antigo', '')).toBe('/memorial?feature=gleba-2');
  });

  it('mantém o mesmo projeto ao navegar Croqui, Memorial e Prancha pelos atalhos', () => {
    const projectId = 'projeto-permitido-42';
    const routes = ['/mapas/', '/memorial/', '/pranchas/'];
    const visited = routes.map(route => withProjectSearch(route, projectId));
    expect(visited.map(url => projectIdFromSearch(new URL(url, 'https://surveyor.test').search))).toEqual([projectId, projectId, projectId]);
  });

  it('isola o contexto salvo por conta', () => {
    expect(workspaceProjectContextKey('conta A')).not.toBe(workspaceProjectContextKey('conta B'));
    expect(workspaceProjectContextKey('conta A')).toContain('conta%20A');
  });
});
