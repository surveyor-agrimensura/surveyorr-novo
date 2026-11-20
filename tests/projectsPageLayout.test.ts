import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('lista de projetos na nuvem', () => {
  it('mantém a lista rolável e impede que os cartões de projetos sejam comprimidos', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/institutional.css'), 'utf8');
    const listRule = css.match(/\.workspace-shell \.projects-page \.projects-list\{([^}]+)\}/)?.[1] ?? '';
    const itemRule = css.match(/\.workspace-shell \.projects-page \.project-item\{([^}]+)\}/)?.[1] ?? '';
    const viewportRule = css.match(/\.workspace-shell \.projects-page \.projects-list\{([^}]+)\}/g)?.at(-1) ?? '';

    expect(listRule).toContain('display:flex');
    expect(listRule).toContain('flex-direction:column');
    expect(itemRule).toContain('flex:0 0 auto');
    expect(itemRule).toContain('min-height:74px');
    expect(viewportRule).toContain('overflow-y:auto');
  });

  it('remove o cabeçalho visual sem perder o título acessível da página', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/features/projects/ProjectsPage.tsx'), 'utf8');
    expect(page).not.toContain('project-page-heading');
    expect(page).not.toContain('Gerencie e retome seus trabalhos de campo.');
    expect(page).toContain('<h1 className="sr-only">Projetos</h1>');
  });
});
