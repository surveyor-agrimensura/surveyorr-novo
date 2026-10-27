(() => {
  'use strict';
  const auth = window.SurveyorAuth || window.GeoRuralAuth;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtDate = (value) => {
    if (!value) return '—';
    const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
  };
  const notify = (message, type='info') => {
    if (window.SurveyorToast) return window.SurveyorToast(message, type);
    const host=$('suiteToast'); if(!host)return; host.textContent=message; host.className=`toast show ${type}`; setTimeout(()=>host.className='toast',3500);
  };

  /* ------------------------------------------------------------------ */
  /* Equipes: nome próprio                                               */
  /* ------------------------------------------------------------------ */
  async function saveWorkspaceName() {
    const ownerId=String($('workspaceOwnerUserId')?.value||'').trim();
    const input=$('workspaceTeamName'); const button=$('workspaceTeamSaveName');
    const name=String(input?.value||'').trim();
    if(!ownerId) return notify('Abra uma equipe antes de salvar o nome.','error');
    if(name.length<2) return notify('Informe um nome de equipe com pelo menos 2 caracteres.','error');
    button && (button.disabled=true);
    try{
      const result=await auth.apiFetch(`/api/admin/users/${encodeURIComponent(ownerId)}/team`,{method:'PATCH',body:JSON.stringify({name})});
      if($('workspaceTeamTitle')) $('workspaceTeamTitle').textContent=result?.team?.name||name;
      notify('Nome da equipe salvo.','success');
    }catch(error){notify(error?.message||'Não foi possível salvar o nome da equipe.','error')}
    finally{button && (button.disabled=false)}
  }
  $('workspaceTeamSaveName')?.addEventListener('click',saveWorkspaceName);

  /* ------------------------------------------------------------------ */
  /* Termos/comprovantes por etapas                                      */
  /* ------------------------------------------------------------------ */
  let planStep=1;
  function planReceiptMode(){return String($('planDocType')?.value||'term')==='receipt'}
  function visiblePlanSteps(){return planReceiptMode()?[1,2,3,4,5]:[1,2,4,5]}
  function planStepSection(step){return document.querySelector(`.plan-documents-section[data-plan-doc-step="${step}"]`)}
  function updatePlanWizardSummary(){
    const host=$('planDocWizardSummary'); if(!host)return;
    const item=(label,value)=>`<div><small>${esc(label)}</small><b>${esc(value||'—')}</b></div>`;
    host.innerHTML=[
      item('Documento',$('planDocType')?.selectedOptions?.[0]?.textContent),
      item('Cliente',$('planDocClientName')?.value),
      item('Plano',$('planDocPlan')?.selectedOptions?.[0]?.textContent),
      item('Pagamento',$('planDocPaymentMethod')?.value),
      item('Início',$('planDocStartDate')?.value),
      item('Vencimento',$('planDocEndDate')?.value),
      item('Responsável',$('planDocResponsibleName')?.value),
      item('E-mail',$('planDocClientEmail')?.value)
    ].join('');
  }
  function renderPlanWizard(){
    const steps=visiblePlanSteps();
    if(!steps.includes(planStep)) planStep=steps[0];
    document.querySelectorAll('.plan-documents-section[data-plan-doc-step]').forEach((section)=>section.classList.toggle('wizard-active',Number(section.dataset.planDocStep)===planStep));
    document.querySelectorAll('[data-plan-doc-target]').forEach((button)=>{
      const target=Number(button.dataset.planDocTarget); const hidden=target===3&&!planReceiptMode();
      button.hidden=hidden; button.classList.toggle('active',target===planStep); button.classList.toggle('completed',steps.indexOf(target)<steps.indexOf(planStep));
    });
    const idx=steps.indexOf(planStep);
    if($('planDocWizardBack')) $('planDocWizardBack').disabled=idx<=0;
    if($('planDocWizardNext')) { $('planDocWizardNext').hidden=idx===steps.length-1; $('planDocWizardNext').textContent=idx===steps.length-2?'Revisar':'Próximo'; }
    document.querySelector('.plan-documents-actions')?.classList.toggle('wizard-actions-hidden',planStep!==5);
    updatePlanWizardSummary();
  }
  function validatePlanStep(){
    const section=planStepSection(planStep); if(!section)return true;
    const controls=[...section.querySelectorAll('input[required],select[required],textarea[required]')].filter(el=>!el.disabled&&!el.closest('.hidden'));
    for(const control of controls){if(!control.checkValidity()){control.reportValidity();control.focus();return false}}
    return true;
  }
  function movePlanStep(delta){
    const steps=visiblePlanSteps(), idx=steps.indexOf(planStep); if(delta>0&&!validatePlanStep())return;
    const next=steps[Math.max(0,Math.min(steps.length-1,idx+delta))]; if(next){planStep=next;renderPlanWizard()}
  }
  $('planDocWizardBack')?.addEventListener('click',()=>movePlanStep(-1));
  $('planDocWizardNext')?.addEventListener('click',()=>movePlanStep(1));
  $('planDocType')?.addEventListener('change',()=>{if(planStep===3&&!planReceiptMode())planStep=4;renderPlanWizard()});
  document.querySelectorAll('[data-plan-doc-target]').forEach((button)=>button.addEventListener('click',()=>{
    const target=Number(button.dataset.planDocTarget); const steps=visiblePlanSteps();
    if(!steps.includes(target))return; if(steps.indexOf(target)>steps.indexOf(planStep)&&!validatePlanStep())return; planStep=target;renderPlanWizard();
  }));
  ['planDocClientName','planDocClientEmail','planDocPlan','planDocPaymentMethod','planDocStartDate','planDocEndDate','planDocResponsibleName'].forEach(id=>$(id)?.addEventListener('input',updatePlanWizardSummary));
  renderPlanWizard();

  /* ------------------------------------------------------------------ */
  /* Usuários em cards + painel de detalhes                              */
  /* ------------------------------------------------------------------ */
  let detailUserId='';
  function originalRow(userId){return [...document.querySelectorAll('#adminUsersTable tr[data-user-id]')].find(row=>String(row.dataset.userId)===String(userId))||null}
  function proxyAction(userId, action){
    const row=originalRow(userId); const button=row?.querySelector(`[data-user-action="${action}"]`);
    if(button&&!button.disabled){button.click();return true} return false;
  }
  function rowInfo(row){
    const userId=row?.dataset.userId||''; const name=row?.querySelector('.user-name')?.textContent?.trim()||'Usuário'; const email=row?.querySelector('.user-email')?.textContent?.trim()||'';
    const caption=row?.querySelector('.workspace-user-caption')?.textContent?.trim()||''; const teamName=/^Equipe:\s*/i.test(caption)?caption.replace(/^Equipe:\s*/i,'').trim():'';
    return {userId,name,email,caption,teamName,profile:row?.cells?.[2]?.textContent?.trim()||'—',plan:row?.cells?.[3]?.childNodes?.[0]?.textContent?.trim()||row?.cells?.[3]?.textContent?.trim()||'—',expiry:row?.cells?.[5]?.textContent?.trim()||'—',status:row?.cells?.[6]?.textContent?.trim()||'—',isSubuser:row?.classList.contains('workspace-subuser-row'),warning:row?.classList.contains('user-integrity-warning')};
  }
  function renderUserCards(){
    const grid=$('adminUsersGrid'), tbody=$('adminUsersTable'); if(!grid||!tbody)return;
    const rows=[...tbody.querySelectorAll('tr[data-user-id]')];
    if(!rows.length){grid.innerHTML='<div class="empty-box">Nenhum usuário encontrado.</div>';return}
    grid.innerHTML=rows.map(row=>{const u=rowInfo(row);return `<article class="sv-user-card${u.isSubuser?' is-subuser':''}${u.warning?' is-warning':''}" data-card-user-id="${esc(u.userId)}"><div class="sv-user-card-head"><span class="sv-user-avatar">${esc(u.name.slice(0,1).toUpperCase())}</span><div class="sv-user-card-copy"><b>${esc(u.name)}</b><small>${esc(u.email)}</small><small>${esc(u.caption)}</small></div>${u.isSubuser?`<span class="sv-team-badge" title="Equipe compartilhada">${esc(u.teamName||'Equipe')}</span>`:''}</div><div class="sv-user-card-meta"><span><small>Plano</small><b>${esc(u.plan)}</b></span><span><small>Perfil</small><b>${esc(u.profile)}</b></span><span><small>Vencimento</small><b>${esc(u.expiry)}</b></span><span><small>Status</small><b>${esc(u.status)}</b></span></div><div class="sv-user-card-footer"><span class="status-pill ${/ativo/i.test(u.status)?'active':/bloq/i.test(u.status)?'blocked':'pending'}">${esc(u.status)}</span><button type="button" class="sv-user-card-open" data-open-user-detail="${esc(u.userId)}">Ver usuário →</button></div></article>`}).join('');
  }
  function ensureUserDetailDialog(){
    if($('adminUserDetailsDialog'))return $('adminUserDetailsDialog');
    const dialog=document.createElement('dialog'); dialog.id='adminUserDetailsDialog';dialog.className='sv-user-detail-dialog';
    dialog.innerHTML='<div class="sv-user-detail-shell"><div class="sv-user-detail-head"><span class="sv-user-avatar" id="svDetailAvatar">U</span><div class="sv-user-detail-head-copy"><h2 id="svDetailName">Usuário</h2><p id="svDetailEmail"></p><p id="svDetailCaption"></p></div><button class="sv-user-detail-close" type="button" aria-label="Fechar">×</button></div><div class="sv-user-detail-stats" id="svDetailStats"></div><div class="sv-user-detail-actions" id="svDetailActions"></div><div class="sv-user-detail-history"><h3>Alterações e atividades recentes</h3><div class="sv-user-detail-history-list" id="svDetailHistory"><article><b>Carregando...</b></article></div></div></div>';
    document.body.appendChild(dialog); dialog.querySelector('.sv-user-detail-close').addEventListener('click',()=>dialog.close()); dialog.addEventListener('click',(e)=>{if(e.target===dialog)dialog.close()});
    return dialog;
  }
  function actionLabel(action=''){
    const key=String(action).toLowerCase(); const map={login_success:'Entrou no sistema',session_resumed:'Retomou a sessão',refresh_rotated:'Sessão renovada',login_failed:'Senha incorreta',login_locked:'Conta bloqueada temporariamente',logout:'Saiu do sistema',remote_logout:'Logout remoto aplicado',login_lock_removed:'Bloqueio de login removido',project_created:'Criou um projeto',project_opened:'Abriu um projeto',project_bundle_saved:'Salvou um projeto',project_updated:'Alterou um projeto',document_created:'Gerou um documento',document_updated:'Atualizou um documento',password_changed:'Alterou a senha',workspace_name_updated:'Alterou o nome da equipe',user_updated:'Conta alterada',email_changed:'E-mail alterado'};return map[key]||action||'Atividade';
  }
  async function openUserDetail(userId){
    const row=originalRow(userId); if(!row)return; const u=rowInfo(row); detailUserId=userId;
    const dialog=ensureUserDetailDialog(); $('svDetailAvatar').textContent=u.name.slice(0,1).toUpperCase();$('svDetailName').textContent=u.name;$('svDetailEmail').textContent=u.email;$('svDetailCaption').textContent=u.caption;
    $('svDetailStats').innerHTML='<article><span>Plano</span><strong>'+esc(u.plan)+'</strong></article><article><span>Perfil</span><strong>'+esc(u.profile)+'</strong></article><article><span>Último login</span><strong>Carregando...</strong></article><article><span>Sessão</span><strong>Carregando...</strong></article>';
    $('svDetailActions').innerHTML='<button class="btn" type="button" data-detail-action="edit">Editar</button><button class="btn" type="button" data-detail-action="team">Equipe</button><button class="btn danger" type="button" data-detail-action="remote">Logout remoto</button>';
    $('svDetailHistory').innerHTML='<article><b>Carregando histórico...</b></article>'; dialog.showModal();
    try{
      const [sessionsState,logsState]=await Promise.allSettled([
        auth.apiFetch('/api/admin/sessions',{method:'GET',noCache:true}),
        auth.apiFetch('/api/admin/audit-logs?limit=2000',{method:'GET',noCache:true})
      ]);
      const sessionsRes=sessionsState.status==='fulfilled'?sessionsState.value:{sessions:[]};
      const logsRes=logsState.status==='fulfilled'?logsState.value:{logs:[]};
      const session=(sessionsRes?.sessions||[]).find(x=>String(x.userId)===String(userId)||String(x.email||'').toLowerCase()===u.email.toLowerCase())||{};
      const auditLogs=(logsRes?.logs||[]).filter(log=>String(log.actorUserId||'')===String(userId)||String(log.targetUserId||'')===String(userId)||String(log.actorEmail||'').toLowerCase()===u.email.toLowerCase());
      const sessionLogs=Array.isArray(session.recentActivity)?session.recentActivity:[];
      const byEventKey=new Map();
      [...sessionLogs,...auditLogs].forEach((log)=>{
        const key=String(log.id||`${log.action||''}|${log.createdAt||''}|${log.target||''}`);
        if(!byEventKey.has(key)) byEventKey.set(key,log);
      });
      const logs=[...byEventKey.values()].sort((a,b)=>(Date.parse(b.createdAt||'')||0)-(Date.parse(a.createdAt||'')||0)).slice(0,20);
      $('svDetailStats').innerHTML=`<article><span>Plano</span><strong>${esc(u.plan)}</strong></article><article><span>Último login/acesso</span><strong>${esc(fmtDate(session.lastLoginAt))}</strong></article><article><span>Última atividade real</span><strong>${esc(fmtDate(session.lastSeenAt))}</strong></article><article><span>Última saída registrada</span><strong>${esc(fmtDate(session.lastLogoutAt))}</strong></article><article><span>Último projeto</span><strong>${esc(session.lastProjectName||'—')}</strong><small>${esc(fmtDate(session.lastProjectAt))}</small></article><article><span>Sessão</span><strong>${session.isOnline?'<span class="sv-online-dot"></span>Online agora':'<span class="sv-online-dot sv-offline-dot"></span>Offline'}</strong></article>`;
      let actions='<button class="btn" type="button" data-detail-action="edit">Editar usuário</button>';
      if(row.querySelector('[data-user-action="team"], [data-user-action="edit-subuser"]')) actions+='<button class="btn" type="button" data-detail-action="team">Editar equipe</button>';
      if(row.querySelector('[data-user-action="change-email"]')) actions+='<button class="btn" type="button" data-detail-action="email">Alterar e-mail</button>';
      if(row.querySelector('[data-user-action="toggle"]')) actions+='<button class="btn" type="button" data-detail-action="toggle">Bloquear / desbloquear</button>';
      actions+='<button class="btn danger" type="button" data-detail-action="remote">Logout remoto</button>';
      if(session.loginLock?.locked) actions+=`<button class="btn" type="button" data-detail-action="unlock">Desbloquear login</button><span class="sv-lock-pill">Bloqueado até ${esc(fmtDate(session.loginLock.lockedUntil))}</span>`;
      if(row.querySelector('[data-user-action="delete-user"], [data-user-action="delete-subuser"]')) actions+='<button class="btn danger" type="button" data-detail-action="delete">Excluir / remover</button>';
      $('svDetailActions').innerHTML=actions;
      const warnings=[];
      if(sessionsState.status!=='fulfilled') warnings.push('Sessão/último login temporariamente indisponível.');
      if(logsState.status!=='fulfilled') warnings.push('Histórico de auditoria temporariamente indisponível.');
      const warningHtml=warnings.length?`<article class="sv-detail-warning"><b>${esc(warnings.join(' '))}</b></article>`:'';
      $('svDetailHistory').innerHTML=warningHtml+(logs.length?logs.map(log=>`<article><time>${esc(fmtDate(log.createdAt))}</time><div><b>${esc(actionLabel(log.action))}</b><small>${esc(log.message||activityTarget(log)||'')}</small></div></article>`).join(''):'<article><b>Nenhuma alteração recente registrada para este usuário.</b></article>');
    }catch(error){
      $('svDetailStats').innerHTML=`<article><span>Plano</span><strong>${esc(u.plan)}</strong></article><article><span>Perfil</span><strong>${esc(u.profile)}</strong></article><article><span>Último login</span><strong>Indisponível</strong></article><article><span>Sessão</span><strong>Indisponível</strong></article>`;
      $('svDetailHistory').innerHTML=`<article><b>${esc(error?.message||'Não foi possível carregar o histórico.')}</b></article>`
    }
  }
  $('adminUsersGrid')?.addEventListener('click',(event)=>{const button=event.target.closest('[data-open-user-detail]');const card=event.target.closest('[data-card-user-id]');const id=button?.dataset.openUserDetail||card?.dataset.cardUserId;if(id)openUserDetail(id)});
  ensureUserDetailDialog().addEventListener('click',async(event)=>{
    const button=event.target.closest('[data-detail-action]');if(!button||!detailUserId)return;const action=button.dataset.detailAction;
    if(action==='edit'){if(!proxyAction(detailUserId,'edit'))proxyAction(detailUserId,'edit-subuser');return}
    if(action==='team'){if(!proxyAction(detailUserId,'team'))proxyAction(detailUserId,'edit-subuser');return}
    if(action==='email'){proxyAction(detailUserId,'change-email');return}
    if(action==='toggle'){proxyAction(detailUserId,'toggle');return}
    if(action==='delete'){if(!proxyAction(detailUserId,'delete-user'))proxyAction(detailUserId,'delete-subuser');return}
    if(action==='remote'){
      if(!confirm('Encerrar agora todas as sessões deste usuário?'))return;button.disabled=true;
      try{await auth.apiFetch(`/api/admin/users/${encodeURIComponent(detailUserId)}/logout-remote`,{method:'POST',body:JSON.stringify({})});notify('Sessão encerrada remotamente.','success');await openUserDetail(detailUserId);loadOrganizedSecurity()}catch(error){notify(error?.message||'Falha no logout remoto.','error')}finally{button.disabled=false}return;
    }
    if(action==='unlock'){
      button.disabled=true;try{await auth.apiFetch(`/api/admin/users/${encodeURIComponent(detailUserId)}/unlock-login`,{method:'POST',body:JSON.stringify({})});notify('Bloqueio de login removido.','success');await openUserDetail(detailUserId);loadOrganizedSecurity()}catch(error){notify(error?.message||'Falha ao desbloquear.','error')}finally{button.disabled=false}
    }
  });
  const userTable=$('adminUsersTable'); if(userTable){new MutationObserver(renderUserCards).observe(userTable,{childList:true,subtree:true});setTimeout(renderUserCards,250)}
  $('adminUserSearch')?.addEventListener('input',()=>setTimeout(renderUserCards,0));

  /* ------------------------------------------------------------------ */
  /* Operação e segurança objetiva                                      */
  /* ------------------------------------------------------------------ */
  let organizedSessions=[];
  const importantAudit=/password|senha|user_|account|email_|workspace|team|subuser|role|permission|plan_|remote_logout|login_lock_removed|blocked|unblock|delete|create_user|verification/i;
  function renderSessions(filter=''){
    const host=$('advancedSessionsTable');if(!host)return; const q=String(filter||'').toLowerCase().trim();
    const rows=organizedSessions.filter(s=>!q||`${s.name||''} ${s.email||''}`.toLowerCase().includes(q));
    host.innerHTML=rows.map(s=>`<tr><td><div class="sv-session-user"><b>${esc(s.name||'Usuário')}</b><small>${esc(s.email||'')}</small><small>${Number(s.activeRefreshSessionCount||0)} sessão(ões) renovável(is)</small></div></td><td><span class="sv-session-now ${s.isOnline?'online':'offline'}">${s.isOnline?'● Online agora':'● Offline'}</span></td><td>${esc(fmtDate(s.lastLoginAt))}</td><td>${esc(fmtDate(s.lastSeenAt))}</td><td>${esc(fmtDate(s.lastLogoutAt))}</td><td><b>${esc(s.lastProjectName||'—')}</b><small>${esc(fmtDate(s.lastProjectAt))}</small></td><td>${s.loginLock?.locked?`<span class="sv-lock-pill">Até ${esc(fmtDate(s.loginLock.lockedUntil))}</span>`:'—'}</td><td><div class="sv-session-actions"><button class="tiny-button danger-link" data-org-logout="${esc(s.userId)}">Logout remoto</button>${s.loginLock?.locked?`<button class="tiny-button" data-org-unlock="${esc(s.userId)}">Desbloquear</button>`:''}<button class="tiny-button" data-open-user-detail="${esc(s.userId)}">Abrir usuário</button></div></td></tr>`).join('')||'<tr><td colspan="8">Nenhum usuário encontrado.</td></tr>';
  }
  function activityTarget(item={}){return item.metadata?.projectName||item.metadata?.documentName||item.targetName||item.target||item.targetUserId||'—'}
  async function loadOrganizedSecurity(){
    if(!$('tab-advanced-admin'))return;
    try{
      const [dashRes,sessionsRes,auditRes,attemptsRes]=await Promise.all([auth.apiFetch('/api/admin/dashboard',{method:'GET',noCache:true}),auth.apiFetch('/api/admin/sessions',{method:'GET',noCache:true}),auth.apiFetch('/api/admin/audit-logs?limit=2000',{method:'GET',noCache:true}),auth.apiFetch('/api/admin/login-attempts?limit=150',{method:'GET',noCache:true})]);
      const dashboard=dashRes?.dashboard||{}, logs=auditRes?.logs||[], attempts=attemptsRes?.attempts||[]; organizedSessions=sessionsRes?.sessions||[];
      const integrity=auditRes?.integrity||{}; const integrityHost=$('auditIntegrityBanner');
      if(integrityHost){
        const invalid=Number(integrity.invalid||0),verified=Number(integrity.verified||0),legacy=Number(integrity.legacy||0);
        integrityHost.classList.remove('hidden','ok','warning','danger');
        if(invalid>0){integrityHost.classList.add('danger');integrityHost.textContent=`Atenção: ${invalid} evento(s) de auditoria falharam na verificação de integridade.`}
        else if(verified>0){integrityHost.classList.add('ok');integrityHost.textContent=`Auditoria protegida: ${verified} evento(s) recentes verificados criptograficamente${legacy?`; ${legacy} registro(s) antigo(s) sem assinatura`:''}.`}
        else{integrityHost.classList.add('warning');integrityHost.textContent='Auditoria legada: os próximos eventos passarão a receber verificação criptográfica de integridade.'}
      }
      if($('advStorageUsage')) $('advStorageUsage').textContent=formatBytesOrg(dashboard.storage?.totalBytes||0);
      if($('advOnlineCount')) $('advOnlineCount').textContent=String(organizedSessions.filter(s=>s.isOnline).length);
      if($('advLockedCount')) $('advLockedCount').textContent=String(organizedSessions.filter(s=>s.loginLock?.locked).length);
      const activities=logs.filter(x=>/^(project_created|project_opened|project_bundle_saved|project_updated|document_created|document_updated)$/i.test(String(x.action||''))).slice(0,30);
      if($('advRecentActivityCount')) $('advRecentActivityCount').textContent=String(activities.length);
      if($('advRecentActivityTable')) $('advRecentActivityTable').innerHTML=activities.map(x=>`<tr><td>${esc(fmtDate(x.createdAt))}</td><td><b>${esc(x.actorName||x.actorEmail||x.actorUserId||'Usuário')}</b></td><td>${esc(actionLabel(x.action))}</td><td>${esc(activityTarget(x))}</td></tr>`).join('')||'<tr><td colspan="4">Nenhuma atividade recente registrada ainda.</td></tr>';
      renderSessions($('advancedSessionFilter')?.value||'');
      const auditImportant=logs.filter(x=>importantAudit.test(String(x.action||''))).slice(0,70);
      if($('advancedAuditTable')) $('advancedAuditTable').innerHTML=auditImportant.map(x=>`<tr><td>${esc(fmtDate(x.createdAt))}</td><td><b>${esc(actionLabel(x.action))}</b><small>${esc(x.message||'')}</small></td><td>${esc(x.actorName||x.actorEmail||x.actorUserId||'—')}</td><td>${esc(x.targetEmail||x.targetUserId||x.target||'—')}</td><td><span class="status-pill ${String(x.status)==='failed'?'blocked':'active'}">${esc(x.status||'ok')}</span></td></tr>`).join('')||'<tr><td colspan="5">Nenhuma alteração importante registrada ainda.</td></tr>';
      if($('securityAttemptsTable')) $('securityAttemptsTable').innerHTML=attempts.slice(0,100).map(x=>`<tr><td>${esc(fmtDate(x.createdAt))}</td><td>${esc(x.actorEmail||x.email||x.actorUserId||'—')}</td><td>${esc(actionLabel(x.action))}</td><td>${esc(x.ip||'—')}</td><td>${esc(compactAgent(x.userAgent))}</td><td><span class="status-pill ${String(x.status)==='failed'?'blocked':'active'}">${esc(x.status||'ok')}</span></td></tr>`).join('')||'<tr><td colspan="6">Nenhum evento de login registrado.</td></tr>';
    }catch(error){console.warn('[Surveyor admin organized security]',error?.message||error)}
  }
  function formatBytesOrg(bytes){const n=Math.max(0,Number(bytes)||0);if(n>=1024**3)return`${(n/1024**3).toLocaleString('pt-BR',{maximumFractionDigits:2})} GB`;if(n>=1024**2)return`${(n/1024**2).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB`;return`${(n/1024).toLocaleString('pt-BR',{maximumFractionDigits:1})} KB`}
  function compactAgent(value=''){const s=String(value||'');const browser=/Edg\//.test(s)?'Edge':/Chrome\//.test(s)?'Chrome':/Firefox\//.test(s)?'Firefox':/Safari\//.test(s)?'Safari':'Navegador';const os=/Windows/i.test(s)?'Windows':/Android/i.test(s)?'Android':/iPhone|iPad/i.test(s)?'iOS':/Mac OS/i.test(s)?'macOS':/Linux/i.test(s)?'Linux':'';return`${browser}${os?' / '+os:''}`}
  $('advancedSessionFilter')?.addEventListener('input',(e)=>renderSessions(e.target.value));
  $('tab-advanced-admin')?.addEventListener('click',async(event)=>{
    const logout=event.target.closest('[data-org-logout]'),unlock=event.target.closest('[data-org-unlock]'),detail=event.target.closest('[data-open-user-detail]');
    if(detail){openUserDetail(detail.dataset.openUserDetail);return}
    if(logout){if(!confirm('Encerrar remotamente a sessão deste usuário?'))return;logout.disabled=true;try{await auth.apiFetch(`/api/admin/users/${encodeURIComponent(logout.dataset.orgLogout)}/logout-remote`,{method:'POST',body:'{}'});notify('Logout remoto aplicado.','success');await loadOrganizedSecurity()}catch(e){notify(e.message||'Falha no logout remoto.','error')}finally{logout.disabled=false}}
    if(unlock){unlock.disabled=true;try{await auth.apiFetch(`/api/admin/users/${encodeURIComponent(unlock.dataset.orgUnlock)}/unlock-login`,{method:'POST',body:'{}'});notify('Login desbloqueado.','success');await loadOrganizedSecurity()}catch(e){notify(e.message||'Falha ao desbloquear.','error')}finally{unlock.disabled=false}}
  });
  $('refreshAdvancedAdmin')?.addEventListener('click',()=>setTimeout(loadOrganizedSecurity,40));
  $('refreshAdvancedSecurity')?.addEventListener('click',loadOrganizedSecurity);
  document.querySelector('[data-tab="advanced-admin"]')?.addEventListener('click',()=>setTimeout(loadOrganizedSecurity,80));
  if(new URLSearchParams(location.search).get('tab')==='advanced-admin') setTimeout(loadOrganizedSecurity,300);
})();
