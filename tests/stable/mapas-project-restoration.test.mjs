import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');
const start=app.indexOf('  function suspendMapasPersonalization(workspace) {');
const end=app.indexOf('  let pranchaLiveTimer =',start);
assert.ok(start>=0 && end>start,'Rotina real de retorno para Projeto encontrada');

function runReturn({ structural=false, dirty=true }={}) {
  const called={render:[], regenerate:0, patch:0, message:[]};
  const editor={isActive:()=>true,presentationMode:()=> 'inline',setVisible:()=>{}};
  const state={
    document:{body:{dataset:{page:'mapas.html'}}},
    select:{value:'imovel-1'},
    technicalDocumentEditor:editor,ensureTechnicalDocumentEditorInstance:()=>editor,
    projects:[{id:'imovel-1',title:'SÍTIO JÓ'}],
    lastSvg:'<svg><g class="sv-confrontante-callout"><text class="sv-confrontante-name-text">TERINHA DE JESUS SANTOS</text></g></svg>',
    lastSvgProjectId:'imovel-1',
    mapasProjectPreviewDeferred:dirty,
    mapasProjectPreviewStructuralPending:structural,
    mapasPreviewAwaitingRefresh:false,
    currentPranchaLiveFieldValues:()=>({mapTitle:'PLANTA DO IMÓVEL RURAL'}),
    patchSvgLiveFields:(svg)=>{called.patch++;return svg;},
    renderMapPreviewSvg:(svg)=>{called.render.push(svg);return Promise.resolve();},
    setPreviewMessage:(text)=>called.message.push(text),
    scheduleMapasLivePreview:()=>called.regenerate++,
    console
  };
  vm.runInNewContext(`${app.slice(start,end)}\nthis.suspend=suspendMapasPersonalization;`,state);
  const workspace={dataset:{betaPersonalizationSelected:'1'}};
  state.suspend(workspace);
  assert.equal(workspace.dataset.betaPersonalizationSelected,'0','Editor deixa de ser proprietário da etapa Projeto');
  return {called,state};
}

const textOnly=runReturn();
assert.equal(textOnly.called.regenerate,0,'Editar nomes e título não pode provocar reconstrução do mapa/satélite ao voltar para Projeto');
assert.equal(textOnly.called.patch,1,'Campos vivos consolidados uma única vez na saída');
assert.equal(textOnly.called.render.length,1,'Projeto exibe imediatamente o SVG final publicado pelo editor');
assert.match(textOnly.called.render[0],/TERINHA DE JESUS SANTOS/,'Nome de confrontante editado permanece visível no Projeto');
assert.equal(textOnly.state.mapasProjectPreviewDeferred,false);

const noEdit=runReturn({dirty:false});
assert.equal(noEdit.called.patch,0,'Sem mudanças, não reprocessar SVG');
assert.equal(noEdit.called.regenerate,0,'Sem mudanças, não gerar mapa');
assert.equal(noEdit.called.render.length,1);

const scaleChanged=runReturn({structural:true});
assert.equal(scaleChanged.called.regenerate,1,'Mudança estrutural requer recálculo único da prévia');
assert.equal(scaleChanged.called.render.length,0,'Não mostrar SVG com zoom/fundo antigo');
assert.equal(scaleChanged.called.message[0],'Atualizando croqui…');

const mapTextStart=css.indexOf('/* Na prévia cartográfica');
const memorialStart=css.indexOf('/* O estilo do mapa do memorial',mapTextStart);
assert.ok(mapTextStart>=0 && memorialStart>mapTextStart,'Regra de contraste do Projeto existe');
const mapTextCss=css.slice(mapTextStart,memorialStart);
assert.doesNotMatch(mapTextCss,/stroke:\s*none|stroke-width:\s*0|paint-order:\s*normal/,'CSS da prévia deve preservar os contornos claros dos nomes');
assert.match(app,/observer\.observe\(previewHost,\{childList:true\}\)/,'Observador não deve inspecionar todas as mutações dentro da cena SVG');
assert.match(app,/const alreadyMounted = window\.SurveyorMapasLivePreviewSvg === markup/,'Prévia idêntica não deve ser montada novamente');
console.log('PASS Mapas/Croquis: nomes preservados, retorno sem reconstrução e contraste do SVG.');
