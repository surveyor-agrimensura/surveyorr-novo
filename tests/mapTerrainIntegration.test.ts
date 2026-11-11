import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('integração das ferramentas altimétricas do mapa', () => {
  it('fecha o perfil no último lado de polígonos e ignora respostas antigas', () => {
    const page = readSource('src/features/map/advancedTerrainTools.tsx');

    expect(page).toMatch(/rawPts\s*=\s*ring\.length\s*\?\s*\[\.\.\.ring,\s*ring\[0\]\]/);
    expect(page).toMatch(/requestId\s*!==\s*elevationRequestRef\.current/);
    expect(page).toMatch(/setElevationError\(error instanceof Error/);
  });

  it('cria linhas contínuas de curvas e não autoriza saída sem cotas reais', () => {
    const page = readSource('src/features/map/advancedTerrainTools.tsx');
    const elevations = readSource('src/features/map/terrainTools.ts');

    expect(page).toMatch(/const contourLines\s*=\s*stitchContours\(filtered\)/);
    expect(page).toMatch(/coordinates:\s*line\.points\.map/);
    expect(page).toMatch(/disabled=\{busy\s*\|\|\s*!hasElevationData\}/);
    expect(page).not.toMatch(/elevations\[i\]\s*\?\?\s*300/);
    expect(elevations).not.toContain('syntheticElevation');
    expect(elevations).toMatch(/throw new Error\(`Não foi possível consultar elevações reais/);
  });
});
