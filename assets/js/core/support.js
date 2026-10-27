    (() => {
      'use strict';
      const form = document.getElementById('supportRequestForm');
      const type = document.getElementById('supportType');
      const alertBox = document.getElementById('featureRequestAlert');
      const details = document.getElementById('supportDetails');
      const detailsLabel = document.getElementById('supportDetailsLabel');
      const result = document.getElementById('supportResult');
      const clearButton = document.getElementById('supportClear');
      const emailInput = document.getElementById('supportEmail');
      const nameInput = document.getElementById('supportName');
      const accountUser = () => {
        const auth = window.GeoRuralAuth || window.SurveyorAuth;
        try { return auth?.currentUser?.() || null; } catch { return null; }
      };
      const hydrateAccountEmail = () => {
        const accountEmail = String(accountUser()?.email || '').trim();
        if (accountEmail && emailInput) {
          emailInput.value = accountEmail;
          emailInput.dataset.accountEmail = '1';
        }
      };
      const toast = (message, status = 'info') => {
        if (window.SurveyorToast) return window.SurveyorToast(message, status);
        alert(message);
      };
      const updateMode = () => {
        const isFeature = type.value === 'nova_funcao';
        alertBox.classList.toggle('hidden', !isFeature);
        detailsLabel.firstChild.textContent = isFeature ? 'Detalhe a função solicitada' : 'Mensagem';
        details.placeholder = isFeature
          ? 'Ex.: Quero uma função para gerar relatório X. Ela deve aparecer no módulo Y, receber estes campos e gerar este resultado...'
          : 'Descreva sua solicitação com detalhes.';
      };
      type.addEventListener('change', updateMode);
      clearButton.addEventListener('click', () => {
        form.reset();
        hydrateAccountEmail();
        result.className = 'support-result hidden';
        result.textContent = '';
        updateMode();
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        result.className = 'support-result hidden';
        const email = emailInput.value.trim();
        const name = nameInput.value.trim();
        const requestType = type.value;
        const message = details.value.trim();
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
          toast('Informe um e-mail válido para retorno.', 'error');
          emailInput.focus();
          return;
        }
        if (!message || message.length < 12) {
          toast('Descreva sua solicitação com mais detalhes.', 'error');
          details.focus();
          return;
        }
        if (requestType === 'nova_funcao' && message.length < 30) {
          toast('Detalhe melhor a função que deseja solicitar para implementação.', 'error');
          details.focus();
          return;
        }
        const payload = {
          name,
          email,
          type: requestType,
          details: message,
          page: location.href,
          createdAt: new Date().toISOString()
        };
        const submitButton = document.getElementById('supportSubmit');
        const originalLabel = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';
        try {
          const supportBaseUrl = String(window.GEORURAL_CONFIG?.supportApiBaseUrl || window.SURVEYOR_SUPPORT_API_URL || '').replace(/\/$/, '');
          if (!supportBaseUrl) {
            throw new Error('Function de suporte ainda não configurada. Defina supportApiBaseUrl em assets/js/core/api.js ou abra com ?supportBaseUrl=URL_DA_FUNCTION.');
          }
          const endpoint = supportBaseUrl + '/api/support/request';
          console.info('[Surveyor Suporte] Enviando para:', endpoint);

          // Envio textual direto para a Function separada. A URL é sanitizada no assets/js/core/api.js para evitar POST acidental no GitHub Pages.
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
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            throw new Error(text ? ('Resposta inválida da Function: ' + text.slice(0, 180)) : 'Resposta vazia da Function.');
          }
          if (!response.ok || data.ok === false || data.sent === false) {
            throw new Error(data.error || data.message || 'A Function de suporte recusou o envio.');
          }
          result.className = 'support-result success';
          result.innerHTML = '<strong>Solicitação enviada.</strong><br>Sua mensagem foi enviada para <b>' + (data.supportEmail || 'suporte@surveyorr.com.br') + '</b>. O suporte poderá responder pelo e-mail informado.';
          toast('Solicitação enviada para o suporte.', 'success');
          form.reset();
          hydrateAccountEmail();
          updateMode();
        } catch (error) {
          result.className = 'support-result error';
          result.innerHTML = '<strong>Não foi possível enviar.</strong><br>' + String(error.message || 'Verifique a configuração da Function e tente novamente.');
          toast(error.message || 'Não foi possível enviar a solicitação.', 'error');
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
      });
      hydrateAccountEmail();
      setTimeout(hydrateAccountEmail, 250);
      updateMode();
    })();
  
