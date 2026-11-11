import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/features/map/OperationalMap.tsx'), 'utf8');
const sourceFile = ts.createSourceFile('OperationalMap.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findArrowBody(name: string): string {
  let body = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === name && node.initializer) {
      const initializer = node.initializer;
      if (ts.isArrowFunction(initializer)) body = initializer.body.getText(sourceFile);
      if (ts.isCallExpression(initializer) && initializer.arguments[0] && ts.isArrowFunction(initializer.arguments[0])) {
        body = initializer.arguments[0].body.getText(sourceFile);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return body;
}

describe('proteção de desenhos incompletos no mapa', () => {
  it('confirma antes de trocar de ferramenta e preserva o desenho se a pessoa cancelar', () => {
    const changeTool = findArrowBody('changeTool');

    expect(changeTool).toMatch(/pendingVertices&&!discardDraft&&!await requestConfirmation/);
    expect(changeTool).toContain('return false');
    expect(changeTool.indexOf('return false')).toBeLessThan(changeTool.indexOf('draftRef.current=[]'));
    expect(changeTool).toContain('return true');
  });

  it('impede salvar, validar ou exportar enquanto houver vértices provisórios', () => {
    const saveProject = findArrowBody('saveProject');

    expect(saveProject.indexOf('draftRef.current.length')).toBeLessThan(saveProject.indexOf('save(true)'));
    expect(page).toContain("const validate=()=>{if(!ensureCompletedDrawing('validar o projeto'))return;setModal('verify');}");
    expect(page).toContain("draft.length?'Finalize ou cancele o desenho para exportar':undefined");
    expect(page).toContain("ensureCompletedDrawing('exportar o pacote técnico')");
  });

  it('mantém cancelamento explícito pelo Escape e pelo menu de contexto', () => {
    expect(page).toMatch(/if\(toolRef\.current!=='pan'\)await changeTool\('pan',true\)/);
    expect(page).toContain("await changeTool('pan',true);setMapContext(null)");
    expect(page).toContain('Desenho em andamento cancelado.');
  });

  it('avisa antes de sair do mapa com um desenho provisório', () => {
    const navigateBack = findArrowBody('navigateBack');
    const navigateHome = findArrowBody('navigateHome');

    expect(navigateBack).toContain('if(await confirmMapExit())navigate');
    expect(navigateHome).toContain('if(await confirmMapExit())navigate');
    expect(navigateBack.indexOf('confirmMapExit()')).toBeLessThan(navigateBack.indexOf('navigate('));
    expect(navigateHome.indexOf('confirmMapExit()')).toBeLessThan(navigateHome.indexOf('navigate('));
    expect(page).toContain("addEventListener('beforeunload',protectMapWork)");
    expect(page).toContain("addEventListener('surveyor:before-route-change',protectMapNavigation)");
    expect(page).toContain("addRouteTransitionConfirmation(event,requestConfirmation({title:'Sair do mapa?'");
    expect(page).toContain('if(pending)addRouteTransitionConfirmation');
    expect(page).toContain('if(!cloudPending&&!draftRef.current.length)return');
    expect(page).toContain("if(cloudPending){event.preventDefault();setSaveError('Aguarde a confirmação do salvamento na nuvem antes de sair do mapa.')");
  });

  it('exibe um controle de toque para cancelar o desenho ou encerrar marcações', () => {
    expect(page).toContain("aria-label={tool==='point'?'Concluir marcação de pontos':'Cancelar desenho'}");
    expect(page).toContain("tool==='point'?'Concluir pontos':'Cancelar'");
    expect(page).toContain("onClick={async()=>{if(await changeTool('pan',true))setPointDialog(false);}}");
  });
});
