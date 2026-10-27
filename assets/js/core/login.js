    (() => {
      const auth = window.SurveyorAuth || window.GeoRuralAuth;
      const form = document.getElementById('loginForm');
      const email = document.getElementById('loginEmail');
      const password = document.getElementById('loginPassword');
      const toggleLoginPassword = document.getElementById('toggleLoginPassword');
      const message = document.getElementById('loginMessage');
      const renewSupportButton = document.getElementById('loginRenewSupportButton');
      const apiState = document.getElementById('apiState');
      const loadingOverlay = document.getElementById('loginLoadingOverlay');
      const loadingText = document.getElementById('loginLoadingText');
      const loadingSubtext = document.getElementById('loginLoadingSubtext');
      const forgotPasswordButton = document.getElementById('forgotPasswordButton');
      const passwordResetCard = document.getElementById('passwordResetCard');
      const passwordResetText = document.getElementById('passwordResetText');
      const passwordResetRequestForm = document.getElementById('passwordResetRequestForm');
      const passwordResetCodeForm = document.getElementById('passwordResetCodeForm');
      const passwordResetNewPasswordForm = document.getElementById('passwordResetNewPasswordForm');
      const passwordResetEmail = document.getElementById('passwordResetEmail');
      const passwordResetCode = document.getElementById('passwordResetCode');
      const passwordResetNewPassword = document.getElementById('passwordResetNewPassword');
      const passwordResetConfirmPassword = document.getElementById('passwordResetConfirmPassword');
      const passwordResetRequestSubmit = document.getElementById('passwordResetRequestSubmit');
      const passwordResetCodeSubmit = document.getElementById('passwordResetCodeSubmit');
      const passwordResetSaveSubmit = document.getElementById('passwordResetSaveSubmit');
      const passwordResetResend = document.getElementById('passwordResetResend');
      const passwordResetBackToCode = document.getElementById('passwordResetBackToCode');
      const passwordResetCancel = document.getElementById('passwordResetCancel');
      const passwordResetRestart = document.getElementById('passwordResetRestart');
      const passwordResetResult = document.getElementById('passwordResetResult');
      let pendingPasswordResetToken = '';
      let pendingPasswordResetCookie = false;
      let pendingPasswordResetAuthorization = '';
      let pendingPasswordResetAuthorizationCookie = false;
      let pendingPasswordResetEmail = '';
      let passwordResetResendTimer = null;

      const submit = form.querySelector('[type="submit"]');

      if (toggleLoginPassword && password) {
        toggleLoginPassword.addEventListener('click', () => {
          const reveal = password.type === 'password';
          password.type = reveal ? 'text' : 'password';
          toggleLoginPassword.textContent = reveal ? 'Ocultar' : 'Mostrar';
          toggleLoginPassword.setAttribute('aria-label', reveal ? 'Ocultar senha' : 'Mostrar senha');
          toggleLoginPassword.setAttribute('aria-pressed', reveal ? 'true' : 'false');
          password.focus({ preventScroll: true });
        });
      }

      const verificationCard = document.getElementById('loginVerificationCard');
      const verificationForm = document.getElementById('loginVerificationForm');
      const verificationCode = document.getElementById('loginVerificationCode');
      const verificationText = document.getElementById('loginVerificationText');
      const verificationBack = document.getElementById('loginVerificationBack');
      const verifySubmit = document.getElementById('loginVerifySubmit');
      let pendingVerificationToken = '';
      let pendingVerificationCookie = false;
      let pendingVerificationEmail = '';
      let pendingReturnTarget = '';

      function setLoginLoading(visible, title = 'Preparando sistema...', subtitle = 'Aguarde alguns segundos.') {
        if (!loadingOverlay) return;
        if (loadingText) loadingText.textContent = title;
        if (loadingSubtext) loadingSubtext.textContent = subtitle;
        loadingOverlay.classList.toggle('is-visible', Boolean(visible));
        loadingOverlay.setAttribute('aria-busy', visible ? 'true' : 'false');
      }

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      async function waitForApiAvailability() {
        while (true) {
          try {
            if (!auth?.checkHealth) return false;
            const health = await auth.checkHealth({ forceRefresh: true });
            if (health?.ok) return true;
          } catch (_) {}
          setLoginLoading(true, 'Preparando sistema...', 'Aguarde alguns segundos.');
          await wait(2500);
        }
      }

      async function initialize() {
        setLoginLoading(true, 'Preparando sistema...', 'Aguarde alguns segundos.');
        if (!auth) {
          setLoginLoading(true, 'Não foi possível iniciar.', 'Recarregue a página para tentar novamente.');
          return;
        }
        const session = auth.getSession();
        if (session?.accessToken && await auth.ensureSession()) {
          location.replace('/');
          return;
        }
        const ready = await waitForApiAvailability();
        if (ready) { clearApiAvailabilityWarnings(); setLoginLoading(false); }
      }

      function clearApiAvailabilityWarnings() {
        if (apiState) {
          apiState.textContent = '';
          apiState.classList.add('hidden');
          apiState.classList.remove('error');
        }
        const runtimeBanner = document.getElementById('surveyorRuntimeBanner');
        if (runtimeBanner?.dataset?.kind === 'danger') runtimeBanner.remove();
      }

      function resolveLoginTarget() {
        const params = new URLSearchParams(location.search);
        const apiBaseUrl = params.get('apiBaseUrl') || params.get('api') || localStorage.getItem('GEORURAL_API_URL_OVERRIDE') || '';
        const cleanRoutes = {
          'index.html': '/',
          'mapa.html': '/mapa/',
          'admin.html': '/admin/',
          'car.html': '/car/',
          'nuvem.html': '/nuvem/',
          'customizacao.html': '/customizacao/',
          'memorial.html': '/memorial/',
          'ods.html': '/ods/',
          'confrontacao.html': '/confrontacao/',
          'acervos.html': '/acervos/',
          'mapas.html': '/mapas/',
          'pranchas.html': '/pranchas/',
          'planialtimetria.html': '/planialtimetria/',
          'perimetros.html': '/perimetros/',
          'ambiental.html': '/ambiental/',
          'loteamentos-reurb.html': '/loteamentos-reurb/',
          'glebas.html': '/glebas/',
          'earth-3d.html': '/earth-3d/',
          'public-project.html': '/public-project/',
          'sobre.html': '/sobre/',
          'suporte.html': '/suporte/'
        };
        const returnTarget = params.get('return') || '/';
        let target = cleanRoutes[returnTarget] || returnTarget;
        try {
          const targetUrl = new URL(target, location.origin);
          if (targetUrl.origin !== location.origin) throw new Error('Destino externo bloqueado.');
          if (apiBaseUrl) targetUrl.searchParams.set('apiBaseUrl', apiBaseUrl);
          target = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
        } catch { target = '/'; }
        return target || '/';
      }

      function finishLoginRedirect(target = '') {
        location.replace(target || pendingReturnTarget || resolveLoginTarget() || '/');
      }

      function showPlanExpired(messageText = 'Login bloqueado por falta de pagamento. Fale com o suporte para renovar seu plano.') {
        message.textContent = messageText;
        message.classList.remove('hidden');
        message.classList.add('plan-expired');
        renewSupportButton?.classList.remove('hidden');
      }

      renewSupportButton?.addEventListener('click', () => {
        location.href = '/suporte/';
      });

      const loginParams = new URLSearchParams(location.search);
      if (loginParams.get('reason') === 'plan_expired') showPlanExpired();
      if (loginParams.get('reason') === 'account_blocked') {
        message.textContent = 'Sua conta foi bloqueada pelo administrador. A sessão anterior foi encerrada automaticamente.';
        message.classList.remove('hidden');
      }
      if (loginParams.get('reason') === 'session_revoked') {
        message.textContent = 'Sua sessão foi encerrada por segurança. Entre novamente para continuar.';
        message.classList.remove('hidden');
      }
      if (loginParams.get('reason') === 'idle_timeout') {
        message.textContent = 'Sua sessão expirou após 20 minutos sem atividade. Entre novamente para continuar.';
        message.classList.remove('hidden');
      }
      if (loginParams.get('first_access') === 'completed') {
        message.textContent = 'Senha criada com sucesso. Entre usando sua nova senha.';
        message.classList.remove('hidden');
        const rememberedEmail = sessionStorage.getItem('SURVEYOR_FIRST_ACCESS_EMAIL');
        if (rememberedEmail) email.value = rememberedEmail;
        sessionStorage.removeItem('SURVEYOR_FIRST_ACCESS_EMAIL');
      }


      function showPasswordResetResult(kind, text) {
        passwordResetResult.className = `password-reset-result ${kind}`;
        passwordResetResult.textContent = text;
      }

      function setPasswordResetStep(step) {
        const requestStep = step === 'request';
        const codeStep = step === 'code';
        const passwordStep = step === 'password';
        passwordResetRequestForm.classList.toggle('hidden', !requestStep);
        passwordResetCodeForm.classList.toggle('hidden', !codeStep);
        passwordResetNewPasswordForm.classList.toggle('hidden', !passwordStep);
      }

      function openPasswordReset() {
        document.body.classList.remove('login-verification-step');
        document.body.classList.add('password-reset-step');
        passwordResetCard.classList.remove('hidden');
        setPasswordResetStep('request');
        passwordResetResult.className = 'password-reset-result';
        passwordResetResult.textContent = '';
        pendingPasswordResetToken = '';
        pendingPasswordResetCookie = false;
        pendingPasswordResetAuthorization = '';
        pendingPasswordResetAuthorizationCookie = false;
        pendingPasswordResetEmail = '';
        passwordResetEmail.value = email.value.trim();
        setTimeout(() => passwordResetEmail.focus(), 60);
      }

      function closePasswordReset() {
        document.body.classList.remove('password-reset-step');
        passwordResetCard.classList.add('hidden');
        passwordResetRequestForm.reset();
        passwordResetCodeForm.reset();
        passwordResetNewPasswordForm.reset();
        pendingPasswordResetToken = '';
        pendingPasswordResetCookie = false;
        pendingPasswordResetAuthorization = '';
        pendingPasswordResetAuthorizationCookie = false;
        pendingPasswordResetEmail = '';
        clearInterval(passwordResetResendTimer);
        passwordResetResult.className = 'password-reset-result';
        email.focus();
      }

      function startPasswordResetResendCooldown(seconds = 30) {
        clearInterval(passwordResetResendTimer);
        let remaining = Math.max(0, Number(seconds) || 0);
        const update = () => {
          passwordResetResend.disabled = remaining > 0;
          passwordResetResend.textContent = remaining > 0 ? `Reenviar em ${remaining}s` : 'Reenviar código';
          remaining -= 1;
          if (remaining < 0) clearInterval(passwordResetResendTimer);
        };
        update();
        passwordResetResendTimer = setInterval(update, 1000);
      }

      async function sendPasswordResetCode(recoveryEmail, { resend = false } = {}) {
        const result = await auth.requestPasswordReset(recoveryEmail);
        if (!result.ok) throw new Error(result.message || 'Não foi possível enviar o código.');
        pendingPasswordResetToken = result.resetToken || '';
        pendingPasswordResetCookie = result.resetCookie === true;
        pendingPasswordResetAuthorization = '';
        pendingPasswordResetAuthorizationCookie = false;
        pendingPasswordResetEmail = recoveryEmail;
        passwordResetText.textContent = result.message || `Enviamos um código para ${result.maskedEmail || recoveryEmail}.`;
        setPasswordResetStep('code');
        passwordResetCode.value = '';
        showPasswordResetResult('success', resend ? 'Novo código enviado. O código anterior deixou de ser válido.' : 'Código enviado. Ele expira em 10 minutos.');
        startPasswordResetResendCooldown(30);
        passwordResetCode.focus();
      }

      forgotPasswordButton?.addEventListener('click', openPasswordReset);
      passwordResetCancel?.addEventListener('click', closePasswordReset);
      passwordResetRestart?.addEventListener('click', openPasswordReset);
      passwordResetBackToCode?.addEventListener('click', () => {
        pendingPasswordResetAuthorization = '';
        pendingPasswordResetAuthorizationCookie = false;
        setPasswordResetStep('code');
        showPasswordResetResult('success', 'Digite novamente o código recebido por e-mail.');
        passwordResetCode.focus();
      });

      passwordResetRequestForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        passwordResetResult.className = 'password-reset-result';
        const recoveryEmail = passwordResetEmail.value.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(recoveryEmail)) {
          showPasswordResetResult('error', 'Informe um e-mail válido.');
          passwordResetEmail.focus();
          return;
        }
        passwordResetRequestSubmit.disabled = true;
        passwordResetRequestSubmit.textContent = 'Enviando...';
        try {
          await sendPasswordResetCode(recoveryEmail);
        } catch (error) {
          showPasswordResetResult('error', error?.message || 'Não foi possível enviar o código.');
        } finally {
          passwordResetRequestSubmit.disabled = false;
          passwordResetRequestSubmit.textContent = 'Enviar código';
        }
      });

      passwordResetResend?.addEventListener('click', async () => {
        if (!pendingPasswordResetEmail || passwordResetResend.disabled) return;
        passwordResetResend.disabled = true;
        passwordResetResend.textContent = 'Reenviando...';
        try {
          await sendPasswordResetCode(pendingPasswordResetEmail, { resend: true });
        } catch (error) {
          passwordResetResend.disabled = false;
          passwordResetResend.textContent = 'Reenviar código';
          showPasswordResetResult('error', error?.message || 'Não foi possível reenviar o código.');
        }
      });

      passwordResetCodeForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        passwordResetResult.className = 'password-reset-result';
        const code = passwordResetCode.value.replace(/\D/g, '').slice(0, 6);
        if (code.length !== 6) {
          showPasswordResetResult('error', 'Informe o código de 6 dígitos.');
          passwordResetCode.focus();
          return;
        }
        passwordResetCodeSubmit.disabled = true;
        passwordResetCodeSubmit.textContent = 'Verificando...';
        try {
          const result = await auth.verifyPasswordResetCode(pendingPasswordResetEmail, code, pendingPasswordResetToken);
          if (!result.ok) {
            showPasswordResetResult('error', result.message || 'Código incorreto.');
            passwordResetCode.select();
            return;
          }
          pendingPasswordResetAuthorization = result.resetAuthorization || '';
          pendingPasswordResetAuthorizationCookie = result.resetAuthorizationCookie === true;
          setPasswordResetStep('password');
          showPasswordResetResult('success', result.message || 'Código confirmado. Agora crie uma nova senha.');
          passwordResetNewPassword.focus();
        } catch (error) {
          showPasswordResetResult('error', error?.message || 'Código incorreto.');
        } finally {
          passwordResetCodeSubmit.disabled = false;
          passwordResetCodeSubmit.textContent = 'Prosseguir';
        }
      });

      passwordResetNewPasswordForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        passwordResetResult.className = 'password-reset-result';
        const newPassword = passwordResetNewPassword.value;
        if (!pendingPasswordResetAuthorization && !pendingPasswordResetAuthorizationCookie) {
          setPasswordResetStep('code');
          showPasswordResetResult('error', 'Confirme primeiro o código recebido por e-mail.');
          passwordResetCode.focus();
          return;
        }
        if (newPassword.length < 12) { showPasswordResetResult('error', 'A nova senha deve possuir pelo menos 12 caracteres.'); passwordResetNewPassword.focus(); return; }
        if (newPassword !== passwordResetConfirmPassword.value) { showPasswordResetResult('error', 'As senhas informadas não são iguais.'); passwordResetConfirmPassword.focus(); return; }
        passwordResetSaveSubmit.disabled = true;
        passwordResetSaveSubmit.textContent = 'Salvando...';
        try {
          const result = await auth.confirmPasswordReset(pendingPasswordResetEmail, newPassword, pendingPasswordResetAuthorization);
          if (!result.ok) { showPasswordResetResult('error', result.message); return; }
          email.value = pendingPasswordResetEmail;
          password.value = '';
          showPasswordResetResult('success', result.message || 'Senha alterada com sucesso.');
          setPasswordResetStep('request');
          setTimeout(() => { closePasswordReset(); password.focus(); message.textContent = 'Senha alterada com sucesso. Entre com a nova senha.'; message.classList.remove('hidden'); }, 1100);
        } catch (error) {
          showPasswordResetResult('error', error?.message || 'Não foi possível alterar a senha.');
        } finally {
          passwordResetSaveSubmit.disabled = false;
          passwordResetSaveSubmit.textContent = 'Salvar nova senha';
        }
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearApiAvailabilityWarnings();
        message.classList.add('hidden');
        message.classList.remove('plan-expired');
        renewSupportButton?.classList.add('hidden');
        submit.disabled = true;
        submit.textContent = 'Entrando...';
        setLoginLoading(true, 'Entrando...', 'Validando seus dados com segurança.');
        let keepLoading = false;
        try {
          if (!auth?.login) throw new Error('Módulo de autenticação não carregado. Recarregue com Ctrl + F5.');
          const result = await auth.login(email.value, password.value);
          if (result?.ok || result?.requiresPasswordChange || result?.requiresEmailVerification) clearApiAvailabilityWarnings();
          if (result.requiresPasswordChange) {
            const firstAccessPayload = {
              token: result.firstAccessToken || '',
              cookie: result.firstAccessCookie === true,
              email: result.email || email.value.trim().toLowerCase(),
              maskedEmail: result.maskedEmail || '',
              message: result.message || 'Crie sua senha definitiva para continuar.',
              createdAt: new Date().toISOString()
            };
            sessionStorage.setItem('SURVEYOR_FIRST_ACCESS', JSON.stringify(firstAccessPayload));
            const target = result.firstAccessUrl || '/primeiro-acesso/';
            keepLoading = true;
            location.replace(target);
            return;
          }
          if (result.requiresEmailVerification) {
            pendingVerificationToken = result.verificationToken || '';
            pendingVerificationCookie = result.verificationCookie === true;
            pendingVerificationEmail = email.value.trim().toLowerCase();
            pendingReturnTarget = resolveLoginTarget();
            verificationText.textContent = result.message || `Enviamos um código de 6 dígitos para ${result.maskedEmail || 'o e-mail cadastrado'}.`;
            document.body.classList.add('login-verification-step');
            verificationCard.classList.remove('hidden');
            message.classList.add('hidden');
            verificationCode.value = '';
            verificationCode.focus();
            return;
          }
          if (!result.ok) {
            if (result.code === 'PLAN_EXPIRED') { showPlanExpired(result.message); return; }
            message.textContent = result.message;
            message.classList.remove('hidden');
            password.focus();
            return;
          }
          keepLoading = true;
          setLoginLoading(true, 'Acesso autorizado', 'Abrindo a Surveyor...');
          finishLoginRedirect(resolveLoginTarget());
        } catch (error) {
          message.textContent = error?.message || 'Não foi possível validar a conta.';
          message.classList.remove('hidden');
        } finally {
          submit.disabled = false;
          submit.textContent = 'Entrar';
          if (!keepLoading) setLoginLoading(false);
        }
      });

      verificationBack?.addEventListener('click', () => {
        pendingVerificationToken = '';
        pendingVerificationCookie = false;
        pendingVerificationEmail = '';
        document.body.classList.remove('login-verification-step');
        verificationCard.classList.add('hidden');
        password.focus();
      });

      verificationForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.classList.add('hidden');
        verifySubmit.disabled = true;
        verifySubmit.textContent = 'Confirmando...';
        try {
          if (!auth?.verifyLoginCode) throw new Error('Módulo de verificação não carregado. Recarregue com Ctrl + F5.');
          const result = await auth.verifyLoginCode(pendingVerificationEmail || email.value, verificationCode.value, pendingVerificationToken);
          if (!result.ok) {
            message.textContent = result.message;
            message.classList.remove('hidden');
            verificationCode.focus();
            return;
          }
          finishLoginRedirect();
        } catch (error) {
          message.textContent = error?.message || 'Não foi possível confirmar o código.';
          message.classList.remove('hidden');
        } finally {
          verifySubmit.disabled = false;
          verifySubmit.textContent = 'Confirmar e entrar';
        }
      });

      initialize();
    })();
  
