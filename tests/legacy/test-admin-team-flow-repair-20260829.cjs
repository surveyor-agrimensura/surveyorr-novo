const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const ok=(v,m)=>{if(!v)throw new Error(m);console.log('OK:',m)};
const auth=read('assets/js/core/auth.js');
const admin=read('assets/js/admin/app.js');
const api=read('functions/surveyor-api/src/main.js');
const html=read('admin/index.html');
const css=read('assets/css/admin/organization.css');

const cachedStart=auth.indexOf('async function cachedApiFetchFallbackMany');
const cachedEnd=auth.indexOf('function removeLegacyDemoSessions', cachedStart);
const cached=auth.slice(cachedStart,cachedEnd);
ok(cached.includes('isMissingRoute')&&cached.includes('if (!isMissingRoute) throw error'), 'fallback GET só troca rota quando a rota realmente não existe');
ok(auth.includes('async function updateWorkspaceTeam')&&auth.includes("method: 'PATCH'")&&auth.includes("method: 'PUT'"), 'auth salva nome da equipe com PATCH/PUT compatível');
ok(auth.includes('`${CONFIG.adminEndpoint}/users/${owner}/team`'), 'rota /team participa da compatibilidade de leitura/salvamento');

ok(admin.includes('workspaceFallbackTeam(ownerRecord)'), 'modal renderiza resumo local enquanto API carrega');
ok(admin.includes('saveWorkspaceTeamName')&&admin.includes("workspaceTeamSaveName')?.addEventListener('click'"), 'botão Salvar do nome possui ação real');
ok(admin.includes('savedNameOverride'), 'resposta de carregamento antiga não sobrescreve nome recém-salvo');
ok(admin.includes('workspaceApiMessage')&&admin.includes('API de equipes do servidor está desatualizada'), 'rota antiga gera diagnóstico útil em vez de erro cru');
ok(admin.includes('workspace-team-loading-row'), 'tabela mantém titular e estado de carregamento sem ficar vazia');

const summaryStart=api.indexOf('async function workspaceAdminSummary');
const summaryEnd=api.indexOf('function profileRoleFromWorkspaceRole',summaryStart);
const summary=api.slice(summaryStart,summaryEnd);
ok(summaryStart>=0&&summaryEnd>summaryStart, 'workspaceAdminSummary encontrado');
ok(!summary.includes('ensureWorkspaceCollectionAvailable()'), 'leitura do resumo não é bloqueada pela collection de membros');
ok(/adminWorkspaceSettingsMatch && httpMethod === 'GET'/.test(api), 'API expõe GET /api/admin/users/:id/team');
const versionMatch=api.match(/APP_VERSION\s*=\s*['"](\d+)\.(\d+)\.(\d+)-([^'"]+)['"]/);
ok(versionMatch && (Number(versionMatch[1])>2 || (Number(versionMatch[1])===2 && (Number(versionMatch[2])>26 || (Number(versionMatch[2])===26 && Number(versionMatch[3])>=3)))), 'API preserva reparo de Equipe 2.26.3+');

ok(/20260829-admin-team-[a-z0-9-]+-1/.test(html), 'Admin usa cache-bust versionado do reparo de Equipe');
ok(css.includes('reparo completo do fluxo de Equipe no Admin')&&css.includes('max-height:245px'), 'interface da equipe compacta tabela e controla rolagem');
console.log('PASS: fluxo completo de Equipe/Admin reparado.');
