import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/features/documents/TechnicalSheetsPage.tsx'), 'utf8');
const openProject = page.slice(page.indexOf('const openProject=useCallback'), page.indexOf('const save=async()=>'));

describe('troca de projeto na prancha técnica', () => {
  it('pede confirmação antes de descartar edições locais', () => {
    expect(openProject).toContain('const pendingRoadPoints=roadAnchorsRef.current.length');
    expect(openProject).toContain('if(warnings.length&&!await requestConfirmation(');
    expect(openProject.indexOf('requestConfirmation(')).toBeLessThan(openProject.indexOf('setDirty(false)'));
    expect(openProject).toContain('Existem edições da prancha ainda não salvas.');
    expect(openProject).toContain('Há uma servidão em desenho');
    expect(openProject).toContain('Trocar de projeto?');
    expect(page).toContain("addEventListener('surveyor:before-route-change',protectWorkspaceNavigation)");
    expect(page).toContain('Existem edições da prancha ainda não salvas.');
    expect(page).toContain('addRouteTransitionConfirmation(event,requestConfirmation');
    expect(page).toContain("addEventListener('beforeunload',protectRoadDraft)");
    expect(page).toContain('if(!saving&&!dirty&&!roadAnchorsRef.current.length)return');
  });

  it('impede a troca enquanto o salvamento está em andamento', () => {
    expect(openProject).toContain('if(saving){setMessage(');
    expect(openProject.indexOf('if(saving){')).toBeLessThan(openProject.indexOf('setProjectId(id)'));
    expect(openProject).toContain('saving,projectId');
  });

  it('encerra o estado de carregamento ao limpar a seleção e invalida a busca anterior', () => {
    expect(openProject).toContain('const loadSeq=++projectLoadSeq.current');
    expect(openProject).toContain("if(!id||!session){setLoading(false);return;}");
    expect(openProject).toContain('if(loadSeq===projectLoadSeq.current)setLoading(false)');
  });

  it('preserva pontos provisórios ao trocar ferramenta ou gleba', () => {
    const switchTool = page.slice(page.indexOf('const switchTool='), page.indexOf('const finishRoad='));
    const featureSwitch = page.slice(page.indexOf('const pendingRoadPoints=', page.indexOf('const names=')));

    expect(switchTool).toContain('if(pendingPoints&&!discardRoadDraft&&!await requestConfirmation(');
    expect(switchTool.indexOf('return false')).toBeLessThan(switchTool.indexOf('clearRoadDraft()'));
    expect(featureSwitch).toContain('Há uma servidão em desenho');
    expect(featureSwitch.indexOf('requestConfirmation(')).toBeLessThan(featureSwitch.indexOf('clearRoadDraft()'));
    expect(page).toContain("switchTool('none',true)");
    expect(page).toContain("addEventListener('beforeunload',protectRoadDraft)");
  });

  it('mantém o rascunho quando a pessoa tenta finalizar uma servidão curta demais', () => {
    const finishRoad = page.slice(page.indexOf('const finishRoad='), page.indexOf('useEffect(()=>{if(mode!==\'road\')'));

    expect(finishRoad).toContain('if(valid.length<2){setMessage(');
    expect(finishRoad).toContain('Os pontos atuais foram mantidos.');
    expect(finishRoad.indexOf('if(valid.length<2)')).toBeLessThan(finishRoad.indexOf('clearRoadDraft()'));
    expect(finishRoad).toContain('Afaste o último ponto do início');
  });
});
