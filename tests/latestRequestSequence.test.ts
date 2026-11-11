import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LatestRequestSequence } from '../src/lib/latestRequestSequence';

const loadSources = [
  'src/features/generations/GenerationLayout.tsx',
  'src/features/documents/ProjectSpreadsheetPage.tsx',
  'src/features/documents/EnvironmentalReportPage.tsx',
  'src/features/documents/ConfrontationPage.tsx',
  'src/features/generations/LotCenterPage.tsx'
].map(path => readFileSync(resolve(process.cwd(), path), 'utf8'));
const confrontationPage = readFileSync(resolve(process.cwd(), 'src/features/documents/ConfrontationPage.tsx'), 'utf8');
const confrontationLoader = confrontationPage.slice(confrontationPage.indexOf('const open = useCallback'), confrontationPage.indexOf('const save = async'));

describe('sequência de carregamento', () => {
  it('invalida uma resposta anterior quando uma nova solicitação começa', () => {
    const requests = new LatestRequestSequence();
    const first = requests.begin();
    const second = requests.begin();

    expect(requests.isCurrent(first)).toBe(false);
    expect(requests.isCurrent(second)).toBe(true);
  });

  it('mantém atual a solicitação mais recente até outra começar', () => {
    const requests = new LatestRequestSequence();
    const current = requests.begin();

    expect(requests.isCurrent(current)).toBe(true);
    expect(requests.isCurrent(current + 1)).toBe(false);
  });

  it('usa a sequência para impedir que um projeto anterior sobrescreva o selecionado', () => {
    for (const source of loadSources) {
      expect(source).toContain('new LatestRequestSequence()');
      expect(source).toContain('projectLoads.current.isCurrent(request)');
    }
  });

  it('preserva a carta editada antes da troca e limpa dados antigos após confirmação', () => {
    expect(confrontationLoader).toContain('if (saving)');
    expect(confrontationLoader).toMatch(/if \(dirty && !await requestConfirmation\(/);
    expect(confrontationLoader).toMatch(/const blankFields = empty\(\);\s*setFields\(blankFields\);\s*original\.current = structuredClone\(blankFields\);/);
  });
});
