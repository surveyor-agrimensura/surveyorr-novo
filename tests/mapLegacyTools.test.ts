import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { isLegacyToolSelected, isMoreToolsSelected, legacyMapTools } from '../src/features/map/legacyToolCatalog';

describe('ferramentas adicionais do mapa', () => {
  it('remove o controle Identificar duplicado; a seleção normal já abre os dados da feição', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/features/map/OperationalMap.tsx'), 'utf8');
    const ids = legacyMapTools.map(tool => tool.id);

    expect(ids).not.toContain('identify');
    expect(page).not.toMatch(/identifyMode|case 'identify'/);
    expect(page).toMatch(/setSelectedFeature\(String\(f\.id\)\);setDetailsFeatureId\(String\(f\.id\)\);setInfoExpanded\(false\);setEditingFeature\(null\);setContextAt\(null\);setMapContext\(null\);setPanel\('layers'\)/);
  });

  it('tem um caminho de execução para cada ferramenta publicada no catálogo', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/features/map/OperationalMap.tsx'), 'utf8');
    const sourceFile = ts.createSourceFile('OperationalMap.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const handled = new Set<string>();
    let dispatcher: ts.ArrowFunction | null = null;

    const findDispatcher = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === 'useLegacyTool' && node.initializer && ts.isArrowFunction(node.initializer)) {
        dispatcher = node.initializer;
      }
      ts.forEachChild(node, findDispatcher);
    };
    findDispatcher(sourceFile);
    expect(dispatcher).not.toBeNull();
    if (!dispatcher) return;

    const collect = (node: ts.Node) => {
      if (ts.isSwitchStatement(node) && node.expression.getText(sourceFile) === 'id') {
        for (const clause of node.caseBlock.clauses) {
          if (ts.isCaseClause(clause) && ts.isStringLiteral(clause.expression)) handled.add(clause.expression.text);
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'includes' &&
          ts.isIdentifier(node.arguments[0]) && node.arguments[0].text === 'id' && ts.isArrayLiteralExpression(node.expression.expression)) {
        const directBranch = node.parent;
        if (ts.isIfStatement(directBranch) && directBranch.thenStatement.getText(sourceFile).includes('changeTool(')) {
          for (const item of node.expression.expression.elements) if (ts.isStringLiteral(item)) handled.add(item.text);
        }
      }
      ts.forEachChild(node, collect);
    };
    collect(dispatcher);

    expect(legacyMapTools.map(tool => tool.id).filter(id => !handled.has(id))).toEqual([]);
  });

  it('reflete os modos de edição e os toggles na paleta', () => {
    const state = { tool: 'pan', activeLegacy: 'pan', autoPoints: false, snap: false, vertexRemoval: false, showMeasures: true, basemap: 'default' };

    expect(isLegacyToolSelected('hide-vertex', { ...state, vertexRemoval: true })).toBe(true);
    expect(isLegacyToolSelected('auto-points', { ...state, autoPoints: true })).toBe(true);
    expect(isLegacyToolSelected('snap', { ...state, snap: true })).toBe(true);
    expect(isLegacyToolSelected('cotas', state)).toBe(true);
    expect(isLegacyToolSelected('line', { ...state, tool: 'line', activeLegacy: 'line' })).toBe(true);
  });

  it('mantém Mais destacado enquanto um submodo continuar ativo', () => {
    const idle = { paletteOpen: false, vertexRemoval: false, autoPoints: false, snap: false, activeLegacy: 'pan', tool: 'pan' };

    expect(isMoreToolsSelected(idle)).toBe(false);
    expect(isMoreToolsSelected({ ...idle, snap: true })).toBe(true);
    expect(isMoreToolsSelected({ ...idle, vertexRemoval: true })).toBe(true);
    expect(isMoreToolsSelected({ ...idle, paletteOpen: true })).toBe(true);
  });
});
