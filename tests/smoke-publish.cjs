/* Testes essenciais sem navegador/API real. Requer TypeScript (npm install). */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let assertions = 0;
const check = (description, predicate) => { assert.ok(predicate, description); assertions++; };
Module._extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  module._compile(compiled, filename);
};
const source = file => require(path.join(root, 'src', file));
const persistence = source('features/map/mapCloudPersistence.ts');
const geometry = source('features/map/importedPointPolygon.ts');
const { placeTechnicalLabels } = source('features/croqui/labelLayout.ts');
const point = (id,x,y,extra={}) => ({type:'Feature',id,geometry:{type:'Point',coordinates:[x,y]},properties:{pointOrigin:'importado',pointBatchId:'import-1',...extra}});
const pts=[point('a',-39.6,-13.1),point('b',-39.599,-13.1),point('c',-39.599,-13.099),point('d',-39.6,-13.099)];
const batch = {id:'import-1',label:'test.csv',points:pts};
check('reconhecer lote com >=4 pontos',geometry.importedPointBatches(pts).length===1);
const poly=geometry.buildPolygonFromBatch(batch);
check('fechar polígono na primeira coordenada',JSON.stringify(poly.ring.at(-1))===JSON.stringify(poly.ring[0]));
check('polígono formado com quatro vértices',poly.uniqueVertices===4);
const duplicated=geometry.buildPolygonFromBatch({...batch,points:[...pts,point('e',-39.599,-13.1)]});
check('descartar repetições sem destruir o lote',duplicated.uniqueVertices===4&&duplicated.skippedDuplicates===1);
const linkedPoint={...pts[0],properties:{...pts[0].properties,pointPolygonId:'per-1'}};
const polygon={type:'Feature',id:'per-1',geometry:{type:'Polygon',coordinates:[poly.ring]},properties:{sourcePointIds:pts.map(p=>p.id)}};
check('esconder alfinete vinculado',!geometry.visibleOnMap(linkedPoint,[linkedPoint,polygon]));
check('mostrar alfinete quando polígono removido',geometry.visibleOnMap(linkedPoint,[linkedPoint]));
const cloud=[linkedPoint,polygon].map((f,i)=>({id:`api-${i+1}`,geoJson:f.geometry,properties:persistence.serializeMapFeature(f)}));
check('confirmar integridade após gravação',persistence.hasVerifiedFeatureIds(cloud,[linkedPoint,polygon]));
const restored=persistence.restoreMapFeatures(cloud);
check('preservar identificadores lógicos após API mudar IDs',String(restored[0].id)==='a'&&String(restored[1].id)==='per-1');
check('não reaparecer alfinete ao abrir em outra máquina',!geometry.visibleOnMap(restored[0],restored));
const legacy=persistence.restoreMapFeatures([
  {id:'api-old-p',geometry:pts[0].geometry,properties:{pointOrigin:'importado',pointPolygonId:'id-original-sumiu'}},
  {id:'api-old-poly',geometry:polygon.geometry,properties:{generatedFromPoints:true}}
]);
check('migrar vinculo inequívoco do projeto antigo',!geometry.visibleOnMap(legacy[0],legacy));
check('detectar backend que perdeu vínculos',!persistence.hasVerifiedFeatureIds([{...cloud[0],properties:{surveyorFeatureId:'a'}},cloud[1]],[linkedPoint,polygon]));
check('detectar backend que perdeu identificador',!persistence.hasVerifiedFeatureIds([{...cloud[0],properties:{}},cloud[1]],[linkedPoint,polygon]));
check('assinatura do rascunho ignora somente ID interno para sincronizar',persistence.mapFingerprint([linkedPoint])===persistence.mapFingerprint([{...linkedPoint,properties:persistence.serializeMapFeature(linkedPoint)}]));
const a={key:'cota:0',text:'123,4 m',anchor:{x:100,y:100},preferred:{x:100,y:100},normal:{x:0,y:-1},tangent:{x:1,y:0},size:9,angle:0,priority:100};
const b={...a,key:'cota:1'};
const placed=placeTechnicalLabels([a,b],{left:0,top:0,right:300,bottom:300});
check('organizar duas cotas próximas sem sobreposição',placed.visible.length===2&&JSON.stringify(placed.visible[0].position)!==JSON.stringify(placed.visible[1].position));
const navigation=fs.readFileSync(path.join(root,'src/data/navigation.ts'),'utf8');
const appRoutes=fs.readFileSync(path.join(root,'src/app/App.tsx'),'utf8');
const navigationPaths=[...navigation.matchAll(/href:\s*'([^']+)'/g)].map(match=>match[1]);
const registeredPaths=new Set([...appRoutes.matchAll(/<Route path="([^"]+)"/g)].map(match=>match[1]));
check('ferramentas ativas têm rota, Chancela foi removida e divisão de glebas abre no mapa', navigationPaths.length>0 && navigationPaths.every(route=>registeredPaths.has(route)) && navigation.includes("label: 'Central de Lotes'") && !navigation.includes('Chancela') && !navigation.includes("label: 'Divisão de Glebas'") && navigation.includes('divisão de glebas') && registeredPaths.has('/mapa/') && appRoutes.includes('path="/glebas/*" element={<Protected><Navigate to="/mapa/" replace/></Protected>}'));
const singleSectionPages=['features/documents/ConfrontationPage.tsx','features/documents/EnvironmentalReportPage.tsx','features/documents/ProjectSpreadsheetPage.tsx'];
check('seções de documentos usam etapas compartilhadas com navegação funcional',singleSectionPages.every(file=>{const page=fs.readFileSync(path.join(root,'src',file),'utf8');return page.includes('<DocumentWorkflowBar')&&page.includes('steps={[')&&page.includes('onStepChange=')&&!/<button className="active">/.test(page);}));
const mapImportSource=fs.readFileSync(path.join(root,'src/features/map/MapWorkPanels.tsx'),'utf8');
check('importador não exibe opção Referência sem comportamento próprio',!mapImportSource.includes("tab==='reference'")&&!mapImportSource.includes('map-import-tabs'));
console.log(`SURVEYOR: ${assertions} verificações funcionais concluídas com sucesso.`);

const mapSource=fs.readFileSync(path.join(root,'src/features/map/OperationalMap.tsx'),'utf8');
check('Salvar superior abre painel Projeto sem gravar direto', /button\('Salvar'[\s\S]{0,220}setPanel\('project'\)/.test(mapSource));
check('painel mostra erro persistente de salvamento', mapSource.includes('saveError={saveError}') && mapSource.includes('setSaveError(message)'));
check('instalador PWA e manifesto existem', fs.existsSync(path.join(root,'public/manifest.webmanifest')) && fs.existsSync(path.join(root,'public/sw.js')) && fs.existsSync(path.join(root,'src/features/pwa/InstallPwaButton.tsx')));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/manifest.webmanifest'),'utf8'));
check('manifesto PWA usa ícones da logo nos tamanhos corretos',manifest.icons.some(icon=>icon.sizes==='192x192') && manifest.icons.some(icon=>icon.sizes==='512x512'));
check('service worker não armazena API nem páginas autenticadas', fs.readFileSync(path.join(root,'public/sw.js'),'utf8').includes("url.pathname.startsWith('/assets/')"));
console.log('SURVEYOR: conferência adicional do fluxo Salvar e da instalação PWA aprovada.');
