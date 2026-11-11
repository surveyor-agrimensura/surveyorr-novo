const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
async function check(){
 const app=read('src/app/App.tsx');
 const deferred=[...app.matchAll(/const (\w+) = lazy\(\(\) => import\('([^']+)'\)/g)];
 assert.ok(deferred.length>=20,`Expected >20 lazily-loaded routes, got ${deferred.length}`);
 for(const [,name,relative] of deferred){
  const candidate=path.resolve(root,'src/app',relative+'.tsx');
  assert.ok(fs.existsSync(candidate),`Missing route for ${name}: ${candidate}`);
  assert.ok(!app.includes(`import { ${name} } from`),`Eager import found for ${name}`);
 }
 assert.ok(!read('src/main.tsx').includes("import 'leaflet/dist/leaflet.css'"),'Leaflet CSS should only load in map pages');
 for (const [name,source] of [['01_Dourado','src/features/admin/AdminPage.tsx'],['02_Ciano','src/features/admin/AdminPage.tsx'],['03_Verde','src/features/customization/CustomizationPage.tsx'],['04_Amarelo','src/features/customization/CustomizationPage.tsx'],['05_AgroMais','src/features/customization/CustomizationPage.tsx']]){
  assert.ok(fs.existsSync(path.join(root,'public/admin-models',name+'.webp')),`Missing ${name}.webp`);
  assert.ok(read(source).includes(name+'.webp'),`Broken image reference: ${name}`);
 }
 assert.ok(read('public/_headers').includes('immutable'));
 assert.ok(read('public/sw.js').includes('surveyor-static-v56'));
 assert.ok(read('src/features/projects/ProjectsPage.tsx').includes('ProjectListSkeleton'));
 assert.ok(read('src/features/projects/ProjectsPage.tsx').includes('visibleProjects'));
 // Exercise the real cache implementation, transplanted from TS to isolated JS.
 const code=read('src/features/projects/projectsApi.ts');
 const start=code.indexOf('type SessionQueryCache=');const end=code.indexOf('export async function listProjects',start);
 assert.ok(start>=0&&end>start);
 const extracted=code.slice(start,end)+'\nexports.cache=cachedForSession;exports.invalidate=invalidateProjectQueries;';
 const compiled=ts.transpileModule(extracted,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const context={exports:{},Promise,WeakMap,Date};vm.runInNewContext(compiled,context);
 const {cache,invalidate}=context.exports;
 const session1={user:{id:'A'},accessToken:'1'},session2={user:{id:'B'},accessToken:'2'};
 let calls=0;
 const load=async()=>{calls+=1;return [{id:String(calls)}]};
 const [a,b]=await Promise.all([cache(session1,'projects',5000,load),cache(session1,'projects',5000,load)]);
 assert.equal(calls,1);assert.equal(a[0].id,b[0].id);
 await cache(session1,'projects',5000,load);assert.equal(calls,1);
 await cache(session2,'projects',5000,load);assert.equal(calls,2);
 invalidate(session1);await cache(session1,'projects',5000,load);assert.equal(calls,3);
 let resolvePrevious;const delayed=new Promise(resolve=>{resolvePrevious=resolve});
 const older=cache(session1,'storage',5000,()=>delayed);
 invalidate(session1);await cache(session1,'storage',5000,async()=>({usedBytes:21}));
 resolvePrevious({usedBytes:99});await older;
 const current=await cache(session1,'storage',5000,async()=>{throw Error('Unexpected fetch after cache fill')});
 assert.equal(current.usedBytes,21,'Old request must not replace a value after invalidation');
 console.log(`SURVEYOR performance: ${deferred.length} rotas sob demanda, cinco WebP, paginação, skeletons, cache isolado e invalidação aprovados.`);
}
check().catch(e=>{console.error(e);process.exitCode=1});
