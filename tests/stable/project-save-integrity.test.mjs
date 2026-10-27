import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const projectsSource = fs.readFileSync('assets/js/core/projects.js', 'utf8');
const editorSource = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const saveSource = fs.readFileSync('functions/surveyor-save/src/main.js', 'utf8');
const apiModel = fs.readFileSync('functions/surveyor-api/src/projects/model.js', 'utf8');

// No erro remoto o editor não pode emitir sucesso ou liberar a exportação.
const editorSaveStart = editorSource.indexOf("if (action === 'save') {");
const editorSaveEnd = editorSource.indexOf("        }\n      \n    }", editorSaveStart);
assert.ok(editorSaveStart > 0 && editorSaveEnd > editorSaveStart, 'ação de salvamento do editor precisa existir');
const editorSave = editorSource.slice(editorSaveStart, editorSaveEnd);
assert.match(editorSave, /catch \(error\) \{[\s\S]*?markDirty\(true\);[\s\S]*?return;/,
  'falha remota preserva alterações pendentes e interrompe caminho de sucesso');
assert.match(editorSave, /surveyor:document-save-failed/, 'falha remota precisa ter evento próprio');
assert.match(editorSave, /surveyor:document-save-success/, 'evento de sucesso mantido somente para salvamento concluído');

// Executar o ramo real do botão Salvar, com os serviços de rede simulados.
const eventLog = [];
const saveButton = {disabled:false,textContent:'Salvar alterações'};
const saveContext = {
  action:'save', showSaveLoading:()=>()=>eventLog.push('release-loading'),
  modal:{querySelector:()=>saveButton}, syncVisualStateFromOverlay(){},
  promoteAreaNamesToGeometrySpace(){}, promoteTechnicalLinesToGeometrySpace(){},
  draftSegments:[], safeText:value=>String(value??''), confrontanteLabelColor:v=>v,
  persistOffsets(){}, writeSegments(){}, writeDocumentSettings(){},
  writeProjectLayout(){}, clearProjectContextCaches(){},
  options:{ persistProject:true, projectId:'proj-1', page:'pranchas.html', onSave:async()=>eventLog.push('onSave') },
  documentSettings:{}, normalizedSegmentForProject:segment=>segment,
  normalizeDocumentSettings:settings=>settings, editorNoun:()=> 'prancha',
  toast:message=>eventLog.push(`toast:${message}`),
  markDirty:bool=>eventLog.push(`dirty:${bool}`),
  setGuideStatus:message=>eventLog.push(`guide:${message}`),
  saveProjectVisualLayout:async()=>{throw new Error('Rede indisponível');},
  updatePrimaryActionState:()=>eventLog.push('ui-clean'),
  hasUnsavedChanges:true, nativeMode:false, presentationMode:'inline',
  document:{body:{dataset:{page:'pranchas.html'}}},
  window:{dispatchEvent:event=>eventLog.push(event.type)},
  CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}},
  optionValue:(opts,key,fallback)=>opts[key]??fallback,
  showSaveLoadingIsActive:false, console:{error(){},warn(){}}, Date
};
const saveBlock = editorSave + '\n        }';
const handleSave = vm.runInNewContext(`async function runSave(action) { ${saveBlock} }\nrunSave`,saveContext);
await handleSave('save');
assert.ok(eventLog.includes('dirty:true'), 'falha na nuvem mantém editor pendente');
assert.ok(eventLog.includes('surveyor:document-save-failed'), 'falha emite somente evento de falha');
assert.ok(!eventLog.includes('surveyor:document-save-success'), 'não emitir sucesso após erro');
assert.ok(!eventLog.includes('onSave'), 'não executar callback de confirmação após falha');
assert.equal(saveButton.disabled,false, 'botão volta a ficar clicável para nova tentativa');
assert.equal(saveContext.hasUnsavedChanges,true,'estado pendente é preservado');
eventLog.length=0;
saveContext.saveProjectVisualLayout=async()=>({id:'proj-1'});
await handleSave('save');
assert.ok(eventLog.includes('surveyor:document-save-success'), 'sucesso confirmado emite evento esperado');
assert.ok(eventLog.includes('onSave'), 'callback de salvamento só após confirmação');
assert.equal(saveContext.hasUnsavedChanges,false,'limpar dirty somente após confirmação');

// Confirmação real: mesma geometria não autoriza aceitar alterações perdidas de CPF, cor e propriedades.
const storage = new Map();
const sessionStorage = { getItem:k=>storage.get(k)??null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k), get length(){return storage.size;}, key:i=>[...storage.keys()][i] };
let corrupted = false;
let recorded = null;
const auth = {
  async saveProjectBundle(projectId, project, features) {
    recorded = { project:{ id:projectId || 'a'.repeat(36), name:project.name, propertyName:project.propertyName, ownerName:project.ownerName, municipality:project.municipality, stateCode:project.stateCode, status:project.status, updatedAt:'2026-10-22T15:20:00.000Z', revision:'2026-10-22T15:20:00.000Z', metadata:{...project.metadata} },
      features: features.map((feature,index) => ({...feature, id:`remote-${index}`, properties:{...feature.properties}, style:{...feature.style}})) };
    if (corrupted) { recorded.features[0].properties.cpfCnpj = '000.000.000-00'; recorded.features[0].style.labelColor = '#fff'; }
    return recorded;
  },
  async getProject() { return structuredClone(recorded); },
  listProjects: async()=>[]
};
const scope = { window:{GeoRuralAuth:auth, dispatchEvent(){}}, sessionStorage, navigator:{onLine:true}, console, setTimeout, Date, Map, Promise, CustomEvent: class { constructor(name,props){this.type=name;this.detail=props?.detail;} } };
vm.runInNewContext(projectsSource, scope, {filename:'projects.js'});
const projects = scope.window.GeoRuralProjects;
const raw = {
  title:'Sítio do teste', owner:'Pessoa', city:'Amargosa', uf:'BA',
  geojson:{features:[{ type:'Feature', properties:{ name:'Perímetro', category:'perimetro', cpfCnpj:'123.456.789-00', confrontanteVisualLayout:{segments:[{nome:'Vizinho',labelColor:'#111827'}]}, style:{labelColor:'#111827'} }, geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]}
};
const good = await projects.saveLegacy(raw);
assert.equal(good.geojson.features[0].properties.cpfCnpj, '123.456.789-00');
// A revisão seguinte tem dados de controle alterados pelo servidor, sem alterar
// o cadastro digitado: isto não pode produzir falso negativo.
const next = structuredClone(raw);
next.id = good.id; next.revision = good.revision;
next.metadata = {versions:[{id:'versao-antiga'}], geojsonFileId:'arquivo-antigo'};
const originalSave = auth.saveProjectBundle;
auth.saveProjectBundle = async(...args) => {
  const result = await originalSave(...args);
  result.project.metadata.versions = [{id:'nova-versao-do-servidor'}];
  result.project.metadata.geojsonFileId = 'arquivo-atualizado';
  return result;
};
const subsequent = await projects.saveLegacy(next);
assert.equal(subsequent.id, good.id);
corrupted = true;
await assert.rejects(projects.saveLegacy(raw), error => error.code === 'PROJECT_PERSISTENCE_NOT_VERIFIED',
  'salvar a mesma geometria sem CPF/cor alterados deve ser rejeitado');
assert.ok((await projects.listPendingDraftsAsync()).length > 0, 'rascunho de recuperação deve permanecer após falha de confirmação');

const functionBlock = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `função ${name} encontrada`);
  let depth = 0, open = source.indexOf('{', start);
  for(let i=open;i<source.length;i++) { if(source[i]==='{') depth++; else if(source[i]==='}' && --depth===0) return source.slice(start,i+1); }
  throw new Error(`função ${name} incompleta`);
};
// Rascunho local deve sobreviver ao fechamento como pendente, sem se declarar sincronizado.
const layouts = new Map();
const layoutScope = {
  projectLayoutKey:()=> 'layout-proj-1',
  writeJson:(key,data)=>layouts.set(key,structuredClone(data)),
  readJson:(key,fallback)=>layouts.get(key)??fallback,
  normalizeDocumentSettings:data=>data,
  safeText:value=>String(value??''),
  Date, Array, Object
};
const layoutFunctions = [
  editorSource.slice(editorSource.indexOf('  function readProjectLayout('),editorSource.indexOf('  function readProjectSegments(')),
  editorSource.slice(editorSource.indexOf('  function writeProjectLayout('),editorSource.indexOf('  function clearProjectLayoutCache('))
].join('\n');
const layoutApi = vm.runInNewContext(`${layoutFunctions}\n({readProjectLayout,writeProjectLayout})`,layoutScope);
layoutApi.writeProjectLayout({}, {segments:[{nome:'Vizinho'}],documentSettings:{elementVisibility:{cotas:false}}});
assert.equal(layoutApi.readProjectLayout({}).syncStatus,'pending','primeiro salvamento é somente rascunho');
layoutApi.writeProjectLayout({}, {segments:[{nome:'Vizinho'}],documentSettings:{},syncStatus:'confirmed'});
assert.equal(layoutApi.readProjectLayout({}).syncStatus,'confirmed','confirmação é gravada apenas após sucesso remoto');
assert.match(editorSource,/localProjectLayout\.syncStatus === 'pending'[\s\S]*?markDirty\(true\)/,
  'reabertura de rascunho sinaliza ao usuário que a nuvem ainda não confirmou');
const docSource = fs.readFileSync('assets/js/core/documents.js','utf8');
assert.match(docSource,/surveyor:document-save-failed/, 'espaço documental recebe falha sem aguardar timeout de 15 segundos');
assert.match(docSource,/if \(saveVerified && moduleSave && moduleSave\.isConnected\)/,'não iniciar gravações paralelas depois da falha do editor');

const mkStatusError = (status,message,details) => Object.assign(new Error(message),{status,details});
// Retornar a função propriamente por expressão final.
const checker = vm.runInNewContext(`${functionBlock(saveSource,'canonicalDate')}\n${functionBlock(saveSource,'assertRevisionMatches')}\nassertRevisionMatches`,{statusError:mkStatusError,Date});
const row = {updatedAt:'2026-10-22T12:00:00Z'};
assert.throws(()=>checker(row,''),e=>e.status===428 && e.details?.code==='PROJECT_REVISION_REQUIRED', 'sem revisão não pode editar projeto existente');
assert.throws(()=>checker(row,'2026-10-21T12:00:00Z'),e=>e.status===409, 'revisão antiga deve ser recusada');
assert.doesNotThrow(()=>checker(row,'2026-10-22T12:00:00Z'));
const mapSource = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
assert.match(mapSource,/currentProjectRevision = String\(project\.revision \|\| project\.updatedAt \|\| ''\)/,
  'Mapa registra a revisão real quando abre um projeto');
assert.match(mapSource,/expectedUpdatedAt: currentProjectId \? currentProjectRevision : ''/,
  'Mapa fornece revisão nos salvamentos subsequentes');
assert.match(mapSource,/window\.GeoRuralProjects\?\.verifySavedBundle/,
  'Mapa utiliza a mesma confirmação de dados do editor, sem checagem incompleta por geometria');
assert.doesNotMatch(mapSource,/remoteFeatureGeometrySignature/, 'não deve existir checagem geométrica redundante no mapa');
assert.match(apiModel, /PROJECT_REVISION_REQUIRED/, 'API principal precisa rejeitar bundle sem revisão');
const apiSource = fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
assert.match(apiSource,/assertRevisionMatches\(row, request, \{ \.\.\.\(input\.project \|\| \{\}\), \.\.\.input \}, true\)/,
  'API valida revisão presente tanto no bundle como no corpo do projeto');
assert.match(apiSource,/assertRevisionMatches\(row, request, rawInput, true\)/, 'PATCH do projeto exige revisão');
assert.match(apiSource,/assertRevisionMatches\(row, request, input, true\)/, 'alteração de feições exige revisão');
console.log('PASS project-save-integrity: sem falso sucesso, propriedades verificadas, revisão obrigatória em bundle.');
