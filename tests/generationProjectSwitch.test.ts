import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/features/generations/GenerationLayout.tsx'), 'utf8');
const draftLoad = page.slice(page.indexOf('useEffect(()=>{let parsed:'), page.indexOf('const chooseProject='));
const chooseProject = page.slice(page.indexOf('const chooseProject='), page.indexOf('const saveDraft='));
const saveDraft = page.slice(page.indexOf('const saveDraft='), page.indexOf('const positions='));

describe('isolamento de configurações dos geradores por projeto', () => {
  it('carrega o rascunho daquele projeto ou restaura os padrões sem reaproveitar posições antigas', () => {
    expect(draftLoad).toContain('surveyor-geracao-v1-${kind}-${data.projectId||\'avulso\'}');
    expect(draftLoad).toContain('...defaultOptions');
    expect(draftLoad).toContain('elements:parsed.elements||base.elements');
    expect(draftLoad).toContain('setDraftDirty(false)');
  });

  it('confirma antes de trocar de projeto com ajustes não salvos', () => {
    expect(chooseProject).toContain('if(draftDirty&&!await requestConfirmation(');
    expect(chooseProject.indexOf('requestConfirmation(')).toBeLessThan(chooseProject.indexOf('data.load(id)'));
    expect(chooseProject).toContain('if(id===data.projectId)return');
  });

  it('marca alterações de formulário e arraste como pendentes e limpa a marca ao salvar', () => {
    expect(page).toContain('setOpts(o=>({...o,[name]:value}));setDraftDirty(true);');
    expect(page).toContain('}}}));setDraftDirty(true);};');
    expect(saveDraft).toContain('localStorage.setItem(');
    expect(saveDraft).toContain('setDraftDirty(false)');
  });
});
