import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readHistoryIndex, reversePopDelta } from '../src/app/RouteTransitionGuard';

const source = readFileSync(resolve(process.cwd(), 'src/app/RouteTransitionGuard.tsx'), 'utf8');
const app = readFileSync(resolve(process.cwd(), 'src/app/App.tsx'), 'utf8');

describe('bloqueio de navegação pelo histórico do navegador', () => {
  it('lê o índice do React Router e calcula como restaurar Voltar e Avançar', () => {
    expect(readHistoryIndex({ idx: 4 })).toBe(4);
    expect(readHistoryIndex({ idx: '4' })).toBeNull();
    expect(readHistoryIndex(null)).toBeNull();
    expect(reversePopDelta(4, 3)).toBe(1);
    expect(reversePopDelta(3, 4)).toBe(-1);
    expect(reversePopDelta(3, 3)).toBeNull();
    expect(reversePopDelta(null, 2)).toBeNull();
  });

  it('consulta os módulos antes do popstate e restaura o histórico se a saída for cancelada', () => {
    expect(source).toContain('dispatchRouteTransitionRequest()');
    expect(source).toContain('request.confirmations.length');
    expect(source).toContain("addEventListener('popstate', onPopState, true)");
    expect(source).toContain('event.stopImmediatePropagation()');
    expect(source).toContain('window.history.go(delta)');
    expect(source).toContain("window.history.pushState(previous.state, '', previous.href)");
    expect(app).toContain('<RouteTransitionGuard/>');
  });
});
