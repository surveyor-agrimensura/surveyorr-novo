(() => {
  'use strict';
  const form = document.getElementById('changePasswordForm');
  if (!form) return;
  const message = document.getElementById('changePasswordMessage');
  const submit = document.getElementById('changePasswordSubmit');
  const setMessage = (text, type = '') => { message.textContent = String(text || ''); message.dataset.type = type; };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const auth = window.SurveyorAuth || window.GeoRuralAuth;
    if (!auth?.changePassword) return setMessage('O módulo de segurança não está disponível. Atualize a página.', 'error');
    const currentPassword = document.getElementById('currentPassword').value;
    const password = document.getElementById('newPassword').value;
    const confirmation = document.getElementById('confirmPassword').value;
    if (password !== confirmation) return setMessage('As novas senhas não são iguais.', 'error');
    submit.disabled = true; setMessage('Alterando senha…');
    const result = await auth.changePassword(currentPassword, password, confirmation);
    submit.disabled = false;
    if (!result?.ok) return setMessage(result?.message || 'Não foi possível alterar a senha.', 'error');
    form.reset(); setMessage('Senha alterada com sucesso. O aviso de senha temporária foi removido.', 'success');
    setTimeout(() => location.assign('/'), 1100);
  });
})();
