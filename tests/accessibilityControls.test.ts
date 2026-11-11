import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const croqui = readFileSync(new URL('../src/features/croqui/CroquiPage.tsx', import.meta.url), 'utf8');
const technicalSheet = readFileSync(new URL('../src/features/documents/TechnicalSheetsPage.tsx', import.meta.url), 'utf8');

describe('estado acessível dos controles de apresentação', () => {
  it('expõe o estado visível dos elementos do Croqui e da Prancha', () => {
    expect(croqui).toMatch(/aria-pressed=\{settings\.elements\[k\]\.visible\}/);
    expect(technicalSheet).toMatch(/aria-pressed=\{settings\.elements\[k\]\.visible\}/);
  });

  it('aplica no Croqui o passo inteiro anunciado pelo controle de zoom', () => {
    expect(croqui).toMatch(/min="1" max="100" step="1" value=\{zoomToPercent\(settings\.zoom\)\}/);
    expect(croqui).not.toContain('Math.round(Number(e.target.value)/5)*5');
  });

  it('mantém uma única ação de organizar rótulos, ligada ao comando preservado', () => {
    const buttons = croqui.match(/<button\b[^>]*onClick=\{autoOrganize\}[^>]*>/g) || [];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain('title="Organizar rótulos"');
  });
});
