    (() => {
      'use strict';
      const launcher = document.getElementById('loginSupportLauncher');
      const panel = document.getElementById('loginSupportPanel');
      const closeButton = document.getElementById('loginSupportClose');
      const form = document.getElementById('loginSupportForm');
      const result = document.getElementById('loginSupportResult');
      const submit = document.getElementById('loginSupportSubmit');
      const nameInput = document.getElementById('loginSupportName');
      const emailInput = document.getElementById('loginSupportEmail');
      const typeInput = document.getElementById('loginSupportType');
      const detailsInput = document.getElementById('loginSupportDetails');
      const loginEmail = document.getElementById('loginEmail');

      const setOpen = (open) => {
        panel.classList.toggle('open', open);
        launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          if (!emailInput.value && loginEmail?.value) emailInput.value = loginEmail.value.trim();
          setTimeout(() => (nameInput.value ? emailInput : nameInput).focus(), 80);
        }
      };

      window.addEventListener('surveyor:open-renewal-support', (event) => {
        if (event.detail?.email) emailInput.value = event.detail.email;
        typeInput.value = 'renovacao';
        detailsInput.value = 'Meu acesso foi bloqueado porque o plano venceu. Quero renovar meu plano e receber as orientações de pagamento.';
        setOpen(true);
        setTimeout(() => detailsInput.focus(), 100);
      });

      launcher?.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
      closeButton?.addEventListener('click', () => setOpen(false));
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });

      function showResult(kind, html) {
        result.className = 'login-support-result ' + kind;
        result.innerHTML = html;
      }


      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        result.className = 'login-support-result';
        result.textContent = '';
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const requestType = typeInput.value || 'acesso';
        const details = detailsInput.value.trim();

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
          showResult('error', '<strong>Informe um e-mail cadastrado válido.</strong>');
          emailInput.focus();
          return;
        }
        if (!details || details.length < 12) {
          showResult('error', '<strong>Descreva o problema com mais detalhes.</strong>');
          detailsInput.focus();
          return;
        }

        const supportBaseUrl = String(window.GEORURAL_CONFIG?.supportApiBaseUrl || window.SURVEYOR_SUPPORT_API_URL || '').replace(/\/$/, '');
        if (!supportBaseUrl) {
          showResult('error', '<strong>Canal de suporte indisponível.</strong><br>Tente novamente em instantes.');
          return;
        }

        const payload = {
          name,
          email,
          type: requestType,
          details: `[Chat rápido da tela de login]\n\n${details}`,
          page: location.href,
          createdAt: new Date().toISOString()
        };

        const originalLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = 'Enviando...';
        try {
          const endpoint = supportBaseUrl + '/api/support/request';
          console.info('[Surveyor Login Support] Enviando para:', endpoint);
          const response = await fetch(endpoint, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          const text = await response.text();
          let data = {};
          try { data = text ? JSON.parse(text) : {}; }
          catch { throw new Error(text ? ('Resposta inválida da Function: ' + text.slice(0, 120)) : 'Resposta vazia da Function.'); }
          if (!response.ok || data.ok === false || data.sent === false) {
            throw new Error(data.error || data.message || 'A Function de suporte recusou o envio.');
          }
          showResult('success', '<strong>Solicitação enviada com sucesso.</strong><br>Nossa equipe responderá em até 1 hora pelo e-mail cadastrado informado.');
          form.reset();
          if (loginEmail?.value) emailInput.value = loginEmail.value.trim();
        } catch (error) {
          showResult('error', '<strong>Não foi possível enviar.</strong><br>' + String(error.message || 'Tente novamente em instantes.'));
        } finally {
          submit.disabled = false;
          submit.textContent = originalLabel;
        }
      });
    })();
  
