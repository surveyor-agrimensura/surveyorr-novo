const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const ok=(v,m)=>{if(!v)throw new Error(m);console.log('OK:',m)};
const auth=read('assets/js/core/auth.js');
const admin=read('assets/js/admin/app.js');
const api=read('functions/surveyor-api/src/main.js');
const html=read('admin/index.html');

const createStart=auth.indexOf('async function createSubuser');
const createEnd=auth.indexOf('async function updateSubuser',createStart);
const create=auth.slice(createStart,createEnd);
ok(createStart>=0&&createEnd>createStart,'createSubuser encontrado');
ok(!/await\s+loadUsers\s*\(/.test(create),'inclusão não depende de refresh global pós-POST');
ok(create.includes('timeoutMs: 30000'),'inclusão possui timeout administrativo ampliado');

const updateStart=auth.indexOf('async function updateSubuser');
const updateEnd=auth.indexOf('async function deleteSubuser',updateStart);
const update=auth.slice(updateStart,updateEnd);
ok(!/await\s+loadUsers\s*\(/.test(update),'edição não depende de refresh global pós-PATCH');

const saveStart=admin.indexOf('async function saveWorkspaceMember');
const saveEnd=admin.indexOf('async function removeWorkspaceMember',saveStart);
const save=admin.slice(saveStart,saveEnd);
ok(save.includes("Promise.resolve(auth.loadUsers({ forceRefresh: true }))"),'refresh global ocorre em segundo plano');
ok(save.includes('vínculo salvo; resumo completo'),'frontend preserva sucesso quando resumo completo falha');
ok(save.includes('nextMembers.push(result.user)'),'frontend faz atualização otimista do membro confirmado');

ok(api.includes('async function safeWorkspaceAdminSummary'),'API possui resumo pós-gravação tolerante a falha');
ok(api.includes('async function writeWorkspaceMembership'),'API adapta schema legado de workspace_members');
const versionMatch=api.match(/APP_VERSION\s*=\s*['"](\d+)\.(\d+)\.(\d+)-([^'"]+)['"]/);
ok(Boolean(versionMatch),'API possui versão identificável');
const patch=Number(versionMatch?.[3]||0);
ok(Number(versionMatch?.[1]||0)>2 || (Number(versionMatch?.[1]||0)===2 && (Number(versionMatch?.[2]||0)>26 || (Number(versionMatch?.[2]||0)===26 && patch>=4))),'API mantém hotfix de inclusão de membro ou versão superior');
ok(html.includes('20260829-admin-team-member-write-1'),'Admin carrega JS com cache-bust do hotfix');
console.log('PASS: inclusão de membro não pode ser invalidada por refresh/resumo secundário.');
