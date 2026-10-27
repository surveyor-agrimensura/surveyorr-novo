(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);

  function openMemberEditor() {
    const form = byId('workspaceSubuserForm');
    const add = byId('workspaceAddMemberToggle');
    if (!form) return;
    form.hidden = false;
    add?.classList.add('hidden');

    const existing = byId('workspaceExistingMemberBox');
    const modeButtons = document.querySelectorAll('[data-workspace-member-mode]');
    if (!byId('editSubuserId')?.value) {
      modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.workspaceMemberMode === 'existing'));
      if (existing) existing.hidden = false;
      document.querySelectorAll('.workspace-new-member-field').forEach((field) => { field.hidden = true; });
      const name = byId('subuserName');
      const email = byId('subuserEmail');
      if (name) name.required = false;
      if (email) email.required = false;
    }
    requestAnimationFrame(() => form.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function closeMemberEditor() {
    const form = byId('workspaceSubuserForm');
    const add = byId('workspaceAddMemberToggle');
    if (form) form.hidden = true;
    add?.classList.remove('hidden');
  }

  // Capture garante que esses controles básicos continuem respondendo mesmo se
  // algum módulo administrativo opcional falhar durante o bootstrap principal.
  document.addEventListener('click', (event) => {
    if (event.target.closest('#workspaceAddMemberToggle')) {
      event.preventDefault();
      openMemberEditor();
      return;
    }
    if (event.target.closest('#workspaceMemberEditorCancel')) {
      event.preventDefault();
      closeMemberEditor();
      return;
    }
  }, true);

  const observer = new MutationObserver(() => {
    const dialog = byId('workspaceTeamDialog');
    const table = byId('workspaceMembersTable');
    if (!dialog?.open || !table || !/Carregando equipe/i.test(table.textContent || '')) return;
    const openedAt = Number(dialog.dataset.teamOpenedAt || 0);
    if (!openedAt) dialog.dataset.teamOpenedAt = String(Date.now());
  });

  document.addEventListener('DOMContentLoaded', () => {
    const dialog = byId('workspaceTeamDialog');
    if (dialog) observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }, { once: true });
})();
