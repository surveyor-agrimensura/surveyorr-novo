const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const must=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}console.log('OK:',m)};
const admin=read('admin/index.html');
const adminCards=read('admin-cards/index.html');
const nuvem=read('nuvem/index.html');
const layout=read('assets/js/core/layout.js');
const adminJs=read('assets/js/admin/app.js');
const auth=read('assets/js/core/auth.js');
const api=read('functions/surveyor-api/src/main.js');
const save=read('functions/surveyor-save/src/main.js');
const mapa=read('mapa/index.html');
const mapJs=read('assets/js/features/mapa/app.js');
const mapCss=read('assets/css/features/mapa/app.css');

// Administração isolada
must(!/data-tab="home-cards"/.test(admin),'Cards da Home foram removidos do index do Admin');
must(/location\.replace\('\/admin\/'\)/.test(adminCards),'rota antiga /admin-cards redireciona para o Admin sem reativar cards');
must(!/workspaceActivityPanel/.test(nuvem),'Projetos não contém bloco administrativo de atividade');
must(/currentPage\(\) === 'admin\.html'/.test(layout)&&/sv-admin-only-topbar/.test(layout),'Admin recebe topbar própria e isolada');
must(!/url: routeUrl\('\/admin\/\?tab=home-cards'\), icon: 'admin'/.test(layout),'navegação geral não duplica Cards como módulo separado');

// Equipe e usuário existente
must(/team\/members/.test(auth)&&/team-members/.test(auth),'frontend usa rotas canônicas de equipe');
must(/\/api\/admin\/users\/\(\[\^\/\]\+\)\/team\/members/.test(api)||api.includes('/team\\/members$'), 'API possui rota de membros da equipe');
must(api.includes('attachExistingUserToWorkspace'),'API pode vincular usuário existente');
must(api.includes('migrateUserResourcesToWorkspace'),'API migra projetos/documentos existentes para a equipe');
must(/resourceOwnerId\(auth\)/.test(api),'API usa owner lógico da equipe para recursos');
must(/function resourceOwnerId\(user\)/.test(save),'Save Function usa owner lógico da equipe');
must(/workspaceAddMemberToggle/.test(admin)&&/workspaceSubuserForm" class="workspace-subuser-form" hidden/.test(admin),'formulário de membro fica recolhido até ser solicitado');
must(/setWorkspaceMemberEditorOpen/.test(adminJs),'UI controla abertura compacta do editor de membro');
const teamSummary=api.slice(api.indexOf('async function workspaceAdminSummary'),api.indexOf('function profileRoleFromWorkspaceRole'));
must(!teamSummary.includes('logicalStorageUsageBytesForUser')&&teamSummary.includes('shared: true'),'resumo da equipe evita varredura de Storage por membro');

// Painel lateral fundiário
must(/id="ruralInfoPanel"/.test(mapa)&&/id="ruralInfoPanelClose"/.test(mapa),'Mapa contém painel persistente à direita com X');
must(/ruralInfoCoordDd/.test(mapa)&&/ruralInfoCoordDms/.test(mapa)&&/ruralInfoCoordUtm/.test(mapa),'painel mostra DD, DMS e UTM');
must(/right:\s*18px/.test(mapCss),'painel está ancorado à direita');
must(/ruralInfoAccentFromContext/.test(mapJs)&&/--rural-info-arrow-color/.test(mapJs),'seta herda a cor da feição clicada');
must(/ruralInfoTargetRenderedLayer = null;/.test(mapJs),'estado visual do imóvel é limpo ao rejeitar clique fora da geometria');
must(/turf\.booleanPointInPolygon\(point, feature, \{ ignoreBoundary: false \}\)/.test(mapJs),'clique segue point-in-polygon estrito aceitando a borda real');
console.log('PASS: Admin isolado, equipe compartilhada e painel fundiário lateral validados.');
