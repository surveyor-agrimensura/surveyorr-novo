import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

// O caminho real de digitação da bancada deve atualizar o SVG visível sem
// executar todos os cálculos de posicionamento e recadastrar o seletor Auto
// a cada tecla; a confirmação do campo executa a sincronização completa.
const start = editor.indexOf('        const syncName=()=>{');
const end = editor.indexOf("        menuButton.addEventListener('click'", start);
assert.ok(start > 0 && end > start, 'Caminho dos campos de confrontantes localizado.');
const nameChunk = editor.slice(start,end);
const liveName={textContent:''};
const liveGroup={dataset:{}, querySelector:(selector)=>selector==='.sv-confrontante-name-text'?liveName:null};
const segment={id:'segment-1',nome:'',propriedade:'',showPropertyInLabel:false};
const callbacks={};
const counts={full:0,auto:0,dirty:0,checkpoint:0};
const input={value:'', addEventListener:(event,fn)=>callbacks[event]=fn};
const ctx={
  input, segment, selectedSegmentId:'', segmentsDirty:false, hasUnsavedChanges:false,
  safeText:(value)=>String(value??''),
  ensureSegment:()=>segment, groupForSegment:()=>liveGroup,
  ensureManualSegmentCallout:()=>{counts.full++;return liveGroup;},
  list:{querySelectorAll:()=>[]}, scheduleNativePublish:()=>{},
  markDirty:()=>{counts.dirty++;ctx.hasUnsavedChanges=true;},
  refreshConfrontanteAutoControls:()=>{counts.auto++;},
  checkpoint:()=>{counts.checkpoint++;},
  selectSegmentRow:()=>{}
};
vm.runInNewContext(`(function(){${nameChunk}})()`,ctx);
for (const value of ['S','Si','Sit','Siti','Sitio']) { input.value=value; callbacks.input(); }
assert.equal(liveName.textContent,'Sitio','Texto visível acompanha a digitação.');
assert.equal(segment.nome,'Sitio','Estado do confrontante acompanha a digitação.');
assert.equal(counts.full,0,'A digitação não recalcula a geometria completa do rótulo já existente.');
assert.equal(counts.auto,0,'A digitação não recria as opções do seletor Auto a cada tecla.');
assert.equal(counts.dirty,1,'A bancada informa alteração pendente apenas uma vez por edição.');
callbacks.change();
assert.equal(counts.full,1,'Confirmação atualiza caixa, ancoragem e geometria do rótulo.');
assert.equal(counts.auto,1,'Confirmação atualiza o seletor Auto de confrontantes.');
assert.equal(counts.checkpoint,1,'Confirmação mantém o histórico de alterações.');

// A reconstrução estrutural da prévia deve ser agendada e agrupada mesmo
// quando input/change disparam praticamente ao mesmo tempo.
const scheduleStart=app.indexOf('  function scheduleMapasLivePreview(');
const scheduleEnd=app.indexOf('  async function refreshPranchaLivePreview',scheduleStart);
assert.ok(scheduleStart>0 && scheduleEnd>scheduleStart);
const scheduleChunk=app.slice(scheduleStart,scheduleEnd);
const timers=[];const cancelled=[];
const scheduler={
  mapasLiveTimer:0,
  mapasInlineEditorActive:()=>false,
  document:{body:{dataset:{page:'mapas.html'}}},select:{value:'projeto-1'},
  clearTimeout:(id)=>cancelled.push(id),
  window:{setTimeout:(_callback,delay)=>{const id=timers.length+1;timers.push({id,delay});return id;}},
  refreshMapasLivePreview:()=>Promise.resolve(),console
};
vm.runInNewContext(`${scheduleChunk} scheduleMapasLivePreview(15); scheduleMapasLivePreview(25);`,scheduler);
assert.equal(timers.length,2,'Ambos eventos solicitam agendamento, sem executar regenerações imediatas.');
assert.equal(cancelled.at(-1),1,'O segundo evento cancela a reconstrução anterior.');
assert.ok(timers.every(t=>t.delay>=180),'Reconstrução pesada deve esperar a estabilização da entrada.');

assert.doesNotMatch(editor,/applyDocumentSettingsToOverlay\(\);\s*syncSettingsControls\(\);\s*scheduleNativePublish\(\);/, 'Controles de aparência não devem percorrer o SVG duas vezes por evento.');
console.log('PASS mapas-editor-performance: digitação contínua, atualização geométrica no change, dirty único e debounce real do redraw.');
