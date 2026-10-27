    (() => {
      const auth = window.SurveyorAuth || window.GeoRuralAuth;
      const form = document.getElementById('firstAccessForm');
      const password = document.getElementById('newPassword');
      const confirmation = document.getElementById('confirmPassword');
      const status = document.getElementById('status');
      const saveButton = document.getElementById('saveButton');
      const emailLabel = document.getElementById('accountEmail');
      let payload = null;
      try { payload = JSON.parse(sessionStorage.getItem('SURVEYOR_FIRST_ACCESS') || 'null'); } catch {}
      try {
        const fragment = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
        const token = String(fragment.get('token') || '').trim();
        const email = String(fragment.get('email') || '').trim();
        if (token) {
          payload = { token, email, maskedEmail: email || 'E-mail da contratação' };
          sessionStorage.setItem('SURVEYOR_FIRST_ACCESS', JSON.stringify(payload));
          history.replaceState(null, document.title, `${location.pathname}${location.search}`);
        }
      } catch {}

      function show(kind, message) {
        status.className = `status show ${kind}`;
        status.textContent = message;
      }

      if (!payload?.token && payload?.cookie !== true) {
        show('error', 'A autorização do primeiro acesso não foi encontrada ou expirou. Solicite um novo link de primeiro acesso.');
        form.querySelectorAll('input,button').forEach((element) => { element.disabled = true; });
      } else {
        emailLabel.textContent = payload.maskedEmail || payload.email || 'E-mail da contratação';
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!payload?.token && payload?.cookie !== true) return;
        const nextPassword = password.value;
        const confirmPassword = confirmation.value;
        if (nextPassword.length < 12) return show('error', 'A nova senha deve possuir pelo menos 12 caracteres.');
        if (!/[a-z]/.test(nextPassword) || !/[A-Z]/.test(nextPassword) || !/\d/.test(nextPassword) || !/[^A-Za-z0-9]/.test(nextPassword)) {
          return show('error', 'Use pelo menos uma letra maiúscula, uma minúscula, um número e um símbolo.');
        }
        if (nextPassword !== confirmPassword) return show('error', 'As senhas informadas não são iguais.');
        if (!auth?.confirmFirstAccessPassword) return show('error', 'O módulo de primeiro acesso não foi carregado. Atualize a página com Ctrl + F5.');

        saveButton.disabled = true;
        saveButton.textContent = 'Salvando nova senha...';
        try {
          const result = await auth.confirmFirstAccessPassword(payload.token, nextPassword, confirmPassword);
          if (!result.ok) return show('error', result.message || 'Não foi possível alterar a senha.');
          sessionStorage.setItem('SURVEYOR_FIRST_ACCESS_EMAIL', result.email || payload.email || '');
          sessionStorage.removeItem('SURVEYOR_FIRST_ACCESS');
          show('success', result.message || 'Senha criada com sucesso.');
          setTimeout(() => location.replace('../login/?first_access=completed'), 1200);
        } catch (error) {
          show('error', error?.message || 'Não foi possível concluir o primeiro acesso.');
        } finally {
          saveButton.disabled = false;
          saveButton.textContent = 'Criar nova senha';
        }
      });
    })();
  
