import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/features/generations/GlebaDivisionPage.tsx'), 'utf8');
const projectLoader = page.slice(page.indexOf('const openProject'), page.indexOf('const handleFileUpload'));

describe('carregamento de projeto na divisão de glebas', () => {
  it('limpa perímetro e proprietário anteriores antes de abrir outro projeto', () => {
    expect(projectLoader).toMatch(/setGeojsonText\(''\);\s*setFamilyOwner\(''\);\s*setLoading\(true\);/);
    expect(projectLoader).toContain('O projeto selecionado não contém um polígono para dividir.');
  });

  it('ignora respostas antigas e preserva o estado de carregamento da solicitação atual', () => {
    expect(projectLoader).toMatch(/const loadSequence = \+\+projectLoadSequence\.current/);
    expect(projectLoader).toMatch(/const data = await getProject\(session, id\);\s*if \(loadSequence !== projectLoadSequence\.current\) return;/);
    expect(projectLoader).toMatch(/if \(loadSequence === projectLoadSequence\.current\) setLoading\(false\);/);
  });
});
