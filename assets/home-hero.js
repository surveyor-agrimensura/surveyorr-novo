(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

  function showToast(message, type = 'error'){
    const toast = $('suiteToast');
    if(!toast){ window.alert(message); return; }
    toast.textContent = message;
    toast.classList.remove('success','error','show');
    toast.classList.add(type, 'show');
    window.setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function projectDate(project){
    const raw = project?.updatedAt || project?.modifiedAt || project?.createdAt || project?.$updatedAt || project?.$createdAt || 0;
    const value = new Date(raw).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function projectId(project){
    return project?.id || project?.$id || project?.projectId || '';
  }

  function openNewProject(){
    window.location.href = '/mapa/';
  }

  async function openLastProject(button){
    const auth = window.SurveyorAuth || window.GeoRuralAuth;
    if(!auth?.listProjects){
      showToast('Não foi possível consultar os trabalhos recentes.');
      return;
    }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Localizando último trabalho...';

    try{
      const projects = await auth.listProjects({ forceRefresh: true });
      const available = (Array.isArray(projects) ? projects : [])
        .filter((project) => projectId(project))
        .sort((a,b) => projectDate(b) - projectDate(a));
      const lastProject = available[0];
      if(!lastProject){
        showToast('Nenhum trabalho recente foi encontrado. Crie um novo projeto para começar.');
        return;
      }
      window.location.href = `/mapa/?project=${encodeURIComponent(projectId(lastProject))}`;
    }catch(error){
      console.error('[Surveyor Home] Falha ao abrir último trabalho:', error);
      showToast(error?.message || 'Não foi possível abrir o último trabalho.');
    }finally{
      button.disabled = false;
      button.textContent = original;
    }
  }

  function init(){
    $('homeStartProject')?.addEventListener('click', openNewProject);
    $('homeOpenLastProject')?.addEventListener('click', (event) => openLastProject(event.currentTarget));
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
