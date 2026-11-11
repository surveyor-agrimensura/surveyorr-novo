import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/features/croqui/CroquiPage.tsx'), 'utf8');

describe('proteção de edições provisórias no Croqui', () => {
  it('confirma antes de trocar projeto ou polígono com alterações ou servidão em desenho', () => {
    const openProject = page.slice(page.indexOf('const openProject=useCallback'), page.indexOf('const selectPolygon='));
    const selectPolygon = page.slice(page.indexOf('const selectPolygon='), page.indexOf('const chooseAreaForAdvancedEditing='));

    for (const handler of [openProject, selectPolygon]) {
      expect(handler).toContain('const pendingRoadPoints=latestRoad.current.length');
      expect(handler).toContain('if(warnings.length&&!await requestConfirmation(');
      expect(handler.indexOf('requestConfirmation(')).toBeLessThan(handler.indexOf('clearRoadDraft()'));
      expect(handler).toContain('ela será descartada.');
    }
  });

  it('não descarta um percurso curto ao tentar finalizá-lo e confirma mudanças de ferramenta', () => {
    const switchMode = page.slice(page.indexOf('const switchMode='), page.indexOf('const [lineColor='));
    const commitRoad = page.slice(page.indexOf('const commitRoad='), page.indexOf('const handlePointerUp='));

    expect(switchMode).toContain('if(pendingPoints&&target!==\'road\'&&!discardRoadDraft&&!await requestConfirmation(');
    expect(switchMode.indexOf('return false')).toBeLessThan(switchMode.indexOf('clearRoadDraft()'));
    expect(commitRoad).toContain('if(filtered.length<2){setMessage(');
    expect(commitRoad.indexOf('if(filtered.length<2)')).toBeLessThan(commitRoad.indexOf('clearRoadDraft()'));
    expect(page).toContain("onClick={()=>switchMode('none',true)}>Cancelar desenho");
    expect(page).toMatch(/Organizar rótulos[\s\S]*?return;\s*clearRoadDraft\(\)/);
  });

  it('avisa ao sair por navegação do aplicativo ou ao fechar a página', () => {
    expect(page).toContain("addEventListener('surveyor:before-route-change',protectWorkspaceNavigation)");
    expect(page).toContain("addEventListener('beforeunload',protectPageLeave)");
    expect(page).toContain('Sair do Croqui?');
    expect(page).toContain('addRouteTransitionConfirmation(event,requestConfirmation');
    expect(page).toContain('dirty||dirtyAreaIds.length');
    expect(page).toContain('!dirtyAreaIds.length');
    expect(page).toContain('!saving&&!dirty');
  });
});
