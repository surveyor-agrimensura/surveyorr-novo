import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(resolve(process.cwd(), 'src/components/layout/WorkspaceLayout.tsx'), 'utf8');

describe('proteção de rascunhos ao navegar pelos módulos', () => {
  it('dispara um evento cancelável antes de navegar por links do cabeçalho e atalhos', () => {
    expect(layout).toContain('dispatchRouteTransitionRequest()');
    expect(layout).toContain('resolveRouteTransitionRequest(request).then(allowed=>');
    expect(layout).toContain('onClickCapture={guardWorkspaceLink}');
    expect(layout).toContain('event.preventDefault();');
    expect(layout).toContain('if (!await requestRouteTransition()) return;');
    expect(layout).toContain('navigate(`${destination.pathname}${destination.search}${destination.hash}`)');
  });

  it('permite abrir links externos, downloads e nova aba sem bloquear a navegação atual', () => {
    expect(layout).toContain("anchor.target === '_blank'");
    expect(layout).toContain("anchor.hasAttribute('download')");
    expect(layout).toContain('destination.origin !== window.location.origin');
    expect(layout).toContain('event.metaKey || event.ctrlKey || event.shiftKey || event.altKey');
  });
});
