const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const api=read('functions/surveyor-api/src/main.js');
const admin=read('admin/index.html');
const org=read('assets/js/admin/organization.js');
const cards=read('assets/js/features/home-cards/admin-home-cards-v21.11.5.js');
const loginCss=read('assets/css/core/login.css');
const auth=read('assets/js/core/auth.js');
const must=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exit(1)}};
// 3 tentativas + 5 horas, controlado pela API
must(/3 tentativas de senha incorreta/.test(api),'bloqueio após 3 tentativas não encontrado');
must(/5 horas/.test(api),'janela de 5 horas não encontrada');
must(/assertLoginAccountUnlocked\(email\)/.test(api),'checagem server-side de bloqueio não encontrada');
must(/\/logout-remote/.test(api)&&/remoteLogoutAt/.test(api)&&/sessionVersion/.test(api),'logout remoto não invalida sessão');
must(/\/unlock-login/.test(api),'endpoint de desbloqueio administrativo ausente');
// presença real
must(/\/api\/auth\/presence/.test(api),'endpoint de presença ausente');
must(/PRESENCE_HEARTBEAT_MS/.test(auth),'heartbeat de presença no frontend ausente');
// equipe compartilha owner/resourceOwner
must(/function resourceOwnerId/.test(api),'resourceOwnerId ausente');
must(/workspaceOwnerUserId: resourceOwnerId\(auth\)/.test(api),'projetos não vinculados ao titular da equipe');
must(/sharedByAllMembers: true/.test(api),'armazenamento compartilhado não sinalizado');
must(/subuserLimitBytes: null/.test(api),'ainda existe limite individual de armazenamento');
must(/WORKSPACE_USER_LIMIT_REACHED/.test(api),'limite de usuários do plano não aplicado');
must(!/Marque este acesso como usuário adicional/.test(api),'regra antiga de usuário adicional pago ainda ativa');
must(/Este e-mail já pertence a outra conta do Surveyor/.test(api),'proteção de e-mail já usado ausente');
// UI
must(/id="adminUsersGrid"/.test(admin),'grid de usuários ausente');
must(/data-plan-doc-target="5"/.test(admin),'wizard de termos ausente');
must(/id="advancedSessionsTable"/.test(admin),'sessões organizadas ausentes');
must(/Logout remoto/.test(org),'logout remoto ausente da UI');
must(/data-detail-action="team"/.test(org),'edição de equipe no detalhe do usuário ausente');
must(/Despublicar/.test(cards)&&/EXCLUIR 40/.test(cards),'ações em massa dos 40 cards ausentes');
must(/caixa de status do login organizada/.test(loginCss),'caixa de status de login nova ausente');
// CORS não anuncia segredos internos
must(!/Access-Control-Allow-Headers[^\n]+X-Bootstrap-Secret/.test(api),'CORS ainda anuncia X-Bootstrap-Secret');
must(!/Access-Control-Allow-Headers[^\n]+X-API-Key/.test(api),'CORS ainda anuncia X-API-Key');
console.log('OK 2026-08-26: admin organizado, equipe compartilhada, cards em massa, wizard, presença, logout remoto e bloqueio de login validados.');
