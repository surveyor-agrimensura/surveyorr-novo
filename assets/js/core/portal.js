(() => {
  'use strict';

  const menuItems = [
    ['/', 'inicio', 'Visão geral', null],
    ['/mapa/', 'mapa-cadastro', 'Mapa e cadastro', 'map:access'],
    ['/car/', 'car', 'Módulo CAR', 'car:access'],
    ['/consulta-car/', 'consulta-car', 'Consulta Pública CAR', 'car:access'],
    ['/loteamentos-reurb/', 'loteamentos', 'Loteamentos / REURB', 'loteamentos:access'],
    ['/nuvem/', 'nuvem', 'Projetos', 'cloud:access'],
    ['/customizacao/', 'customizacao', 'Personalização', 'company:settings'],
    ['/memorial/', 'memorial', 'Memorial descritivo', 'documents:memorial'],
    ['/ods/', 'ods', 'Planilha ODS', 'documents:ods'],
    ['/confrontacao/', 'confrontacao', 'Cartas de confrontação', 'documents:confrontacao'],
    ['/acervos/', 'acervos', 'Acervos oficiais', 'layers:official'],
    ['/mapas/', 'mapas', 'Mapas e croquis', 'documents:mapas'],
    ['/pranchas/', 'pranchas', 'Pranchas técnicas', 'documents:pranchas'],
    ['/planialtimetria/', 'planialtimetria', 'Planialtimetria / MDT', 'documents:planialtimetria'],
    ['/perimetros/', 'perimetros', 'Perímetros por azimute', 'documents:perimetros'],
    ['/ambiental/', 'ambiental', 'Relatório ambiental', 'ambiental:access']
  ];

  const pagePermissions = Object.fromEntries(menuItems.filter((item) => item[3]).map(([href,, label, permission]) => [href, { label, permission }]));

  const cleanRouteAliases = {
    'index.html': '/',
    'login.html': '/login/',
    'admin.html': '/admin/',
    'mapa.html': '/mapa/',
    'car.html': '/car/',
    'consulta-car.html': '/consulta-car/',
    'nuvem.html': '/nuvem/',
    'customizacao.html': '/customizacao/',
    'assinatura-digital.html': '/assinatura-digital/',
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
    'suporte.html': '/suporte/',
    'alterar-senha.html': '/alterar-senha/'
  };

  function cleanRouteForPageName(page) {
    const key = String(page || 'index.html').split('?')[0].split('#')[0];
    if (cleanRouteAliases[key]) return cleanRouteAliases[key];
    if (key.startsWith('/')) return key.endsWith('/') ? key : `${key}/`;
    return key.endsWith('.html') ? `/${key.slice(0, -5)}/` : `/${key}/`;
  }

  const featureSelectors = [
    { selector: '#generateMapV19,#downloadSvgV19,#printPreviewV19', permission: 'documents:mapas', label: 'Croqui do imóvel' },
    { selector: '#generateMemorial,#downloadMemorialHtml,#downloadMemorialWord,#downloadMemorialPdf,#printOutput', permission: 'documents:memorial', label: 'Memorial descritivo' },
    { selector: '#calculateIntersection,#calculateIntersections,#calculateAppIntersection,#appIntersectionBtn,#calculateApps', permission: 'car:access', label: 'Cálculo de interseção com APP' },
    { selector: '#generateAzimuth,#downloadAzimuthGeojson,#saveAzimuthProject', permission: 'documents:perimetros', label: 'Perímetros por azimutes' },
    { selector: '#analyzeElevation,#calculateIdw', permission: 'documents:planialtimetria', label: 'Planialtimetria / MDT' },
    { selector: '#generateConsent,#downloadConsentWord', permission: 'documents:confrontacao', label: 'Cartas de confrontação' },
    { selector: '#generateOds,#processOds,#downloadOds', permission: 'documents:ods', label: 'Planilha ODS' },
    { selector: '#openCloudUpload,#cloudUploadButton,#sendFileButton', permission: 'cloud:access', label: 'Projetos' }
  ];

  function escapeText(value) {
    return String(value || '').replace(/[&<>\"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function brandDisplayText(value) {
    return String(value || '').replace(/GeoRural\s*Pro/gi, 'Surveyor').replace(/GeoRural/gi, 'Surveyor');
  }

  function moduleIconMarkup(name, label) {
    const safeName = String(name || 'inicio').replace(/[^a-z0-9-]/gi, '');
    const safeLabel = escapeText(label || safeName);
    return `<img class="module-icon-img" src="/assets/module-icons/${safeName}.png" alt="${safeLabel}" loading="lazy" onerror="this.onerror=null;this.style.display='none'">`;
  }

  function can(auth, permission, user) {
    if (!permission) return true;
    if (!user) return false;
    if (user.role === 'admin') return true;
    return Boolean(auth.hasPermission?.(permission));
  }

  function renderAccessDenied(pageInfo) {
    const main = document.querySelector('.main') || document.querySelector('main') || document.body;
    const moduleName = pageInfo?.label || 'este módulo';
    const permission = pageInfo?.permission || '';
    main.innerHTML = `
      <header class="top"><div><h1>Acesso bloqueado</h1><p>Seu plano atual não possui permissão para acessar ${escapeText(moduleName)}.</p></div><div class="top-actions"><a class="link-btn primary" href="/">Voltar para visão geral</a></div></header>
      <section class="panel access-denied-panel">
        <div class="access-denied-icon">🔒</div>
        <h2>Função não liberada para este plano</h2>
        <p>Peça ao administrador para liberar a permissão <code>${escapeText(permission)}</code> no seu plano ou mudar sua conta para um plano superior.</p>
        <div class="button-row"><a class="link-btn" href="/">Início</a><a class="link-btn primary" href="/nuvem/">Minha conta</a></div>
      </section>`;
  }

  function applyFeatureLocks(auth, user) {
    featureSelectors.forEach(({ selector, permission, label }) => {
      if (can(auth, permission, user)) return;
      document.querySelectorAll(selector).forEach((element) => {
        element.disabled = true;
        element.classList.add('feature-locked');
        element.title = `${label} disponível somente em planos autorizados.`;
        element.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const toast = document.getElementById('suiteToast') || document.getElementById('toast');
          const message = `${label} não está liberado para o seu plano.`;
          if (toast) {
            toast.textContent = message;
            toast.classList.add('show', 'error');
            setTimeout(() => toast.classList.remove('show', 'error'), 3800);
          } else alert(message);
        }, true);
      });
    });
  }

  function renderPasswordSecurityBanner(auth, user) {
    const current = auth?.currentUser?.() || user || null;
    const main = document.querySelector('.main') || document.querySelector('main');
    if (!main) return;
    let banner = document.getElementById('accountPasswordSecurityBanner');
    if (!current?.mustChangePassword) {
      banner?.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement('aside');
      banner.id = 'accountPasswordSecurityBanner';
      banner.className = 'account-security-banner';
      banner.setAttribute('role', 'status');
      banner.innerHTML = `
        <span class="account-security-banner-icon" aria-hidden="true">!</span>
        <div class="account-security-banner-copy">
          <strong>Sua senha atual foi gerada eletronicamente.</strong>
          <span>Para aumentar a segurança da sua conta, altere para uma senha criada por você.</span>
        </div>
        <a class="account-security-banner-action" href="/alterar-senha/">Alterar senha</a>`;
      main.insertBefore(banner, main.firstChild);
    }
  }

  function noticeTypeLabel(type) {
    return ({ info: 'Informação', success: 'Sucesso', warning: 'Aviso', danger: 'Urgente', maintenance: 'Manutenção' }[type] || 'Aviso');
  }

  function formatNoticeDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  }

  function activeNoticeText(notice) {
    const parts = [];
    if (notice?.startsAt) parts.push(`início: ${formatNoticeDate(notice.startsAt)}`);
    if (notice?.endsAt) parts.push(`fim: ${formatNoticeDate(notice.endsAt)}`);
    return parts.join(' • ');
  }

  function noticeWindowState(notice = {}) {
    const now = Date.now();
    const start = notice.startsAt ? new Date(notice.startsAt).getTime() : NaN;
    const end = notice.endsAt ? new Date(notice.endsAt).getTime() : NaN;
    if (Number.isFinite(end) && end <= now) return 'expired';
    if (Number.isFinite(start) && start > now) return 'scheduled';
    return 'current';
  }

  function noticeIsCurrent(notice = {}) {
    return noticeWindowState(notice) === 'current';
  }


  function currentPageName() {
    const raw = document.body?.dataset?.page || location.pathname.split('/').pop() || 'index.html';
    return String(raw || 'index.html').split('?')[0].split('#')[0] || 'index.html';
  }

  function isOverviewPage() {
    const route = cleanRouteForPageName(currentPageName()).toLowerCase();
    return route === '/' || route === '';
  }

  function noticeWindowBadge(notice = {}) {
    const state = noticeWindowState(notice);
    if (state === 'scheduled') return '<em class="notice-window-badge is-scheduled">Agendada</em>';
    if (state === 'expired') return '<em class="notice-window-badge is-expired">Expirada</em>';
    return '<em class="notice-window-badge is-current">Agora</em>';
  }


  function normalizeNoticeReadValue(value) {
    if (value === undefined || value === null || value === false) return '';
    const text = String(value).trim().toLowerCase();
    if (!text || text === 'null' || text === 'undefined' || text === 'false' || text === '0') return '';
    return text;
  }

  function isNoticeUnread(notice = {}) {
    if (!notice || notice.blocksApp) return false;
    if (notice.isRead === true || notice.read === true || notice.dismissed === true) return false;
    if (normalizeNoticeReadValue(notice.readAt || notice.ReadAt || notice.read_at)) return false;
    if (normalizeNoticeReadValue(notice.dismissedAt || notice.DismissedAt || notice.dismissed_at)) return false;
    return true;
  }

  function noticeReadClass(notice = {}) {
    return isNoticeUnread(notice) ? '' : 'is-read';
  }

  async function markNoticeRead(auth, noticeId, callback) {
    try { await auth.markSystemNoticeRead?.(noticeId); }
    catch (error) { console.warn('[GeoRural Avisos] não foi possível marcar aviso como lido:', error); }
    if (typeof callback === 'function') callback();
  }

  function releaseMetadata(notice = {}) {
    return notice.metadata && typeof notice.metadata === 'object' ? notice.metadata : {};
  }

  function isHomeCardNotice(notice = {}) {
    const metadata = releaseMetadata(notice);
    return metadata.kind === 'home_card' || metadata.noticeMode === 'home-card' || Boolean(metadata.homeCard);
  }

  function releaseSlides(notice = {}) {
    const metadata = releaseMetadata(notice);
    const slides = Array.isArray(metadata.slides) ? metadata.slides : [];
    return slides.map((slide, index) => ({
      title: String(slide.title || `Novidade ${index + 1}`).trim(),
      description: String(slide.description || slide.text || '').trim(),
      imageDataUrl: String(slide.imageDataUrl || slide.imageUrl || '').trim(),
      imageName: String(slide.imageName || '').trim()
    })).filter((slide) => slide.title || slide.description || slide.imageDataUrl);
  }

  function showReleaseNotes(auth, notice, onRefresh) {
    if (!notice || document.querySelector(`[data-release-notes="${notice.id}"]`)) return;
    const metadata = releaseMetadata(notice);
    const slides = releaseSlides(notice);
    if (!slides.length) return;
    let index = 0;
    const theme = ['surveyor', 'dark', 'light'].includes(String(metadata.releaseTheme || metadata.theme || 'surveyor')) ? String(metadata.releaseTheme || metadata.theme || 'surveyor') : 'surveyor';
    const finalButton = String(metadata.releaseFinalButton || 'Começar a usar').trim() || 'Começar a usar';
    const overlay = document.createElement('div');
    overlay.className = `release-notes-overlay release-theme-${theme}`;
    overlay.dataset.releaseNotes = notice.id;
    function closeRelease() {
      overlay.remove();
      markNoticeRead(auth, notice.id, onRefresh);
    }
    function render() {
      const slide = slides[index] || slides[0];
      const isLast = index >= slides.length - 1;
      overlay.innerHTML = `
        <section class="release-notes-card" aria-label="Novidades da versão">
          <div class="release-notes-copy">
            <span class="release-notes-kicker">${escapeText(metadata.releaseVersion || metadata.version || 'Atualização')}</span>
            <h1>${index === 0 ? escapeText(notice.title || 'Atualização concluída!') : escapeText(slide.title)}</h1>
            ${index === 0 && notice.message ? `<p class="release-notes-intro">${escapeText(notice.message)}</p>` : ''}
            <h2>${escapeText(slide.title)}</h2>
            <p>${escapeText(slide.description)}</p>
            <div class="release-notes-actions">
              <button type="button" class="btn release-back" ${index === 0 ? 'disabled' : ''}>← Voltar</button>
              <button type="button" class="btn release-skip">Pular</button>
              <button type="button" class="btn primary release-next">${isLast ? escapeText(finalButton) : 'Avançar →'}</button>
            </div>
          </div>
          <div class="release-notes-media ${slide.imageDataUrl ? '' : 'is-empty'}">
            ${slide.imageDataUrl ? `<img src="${escapeText(slide.imageDataUrl)}" alt="${escapeText(slide.title || 'Novidade da versão')}">` : '<span>Sem imagem cadastrada</span>'}
          </div>
          <div class="release-notes-progress" aria-label="Progresso dos slides">
            ${slides.map((item, itemIndex) => `<button type="button" class="${itemIndex === index ? 'active' : ''}" data-release-index="${itemIndex}"><span>${itemIndex + 1}</span><em>${escapeText(item.title || `Slide ${itemIndex + 1}`)}</em></button>`).join('')}
          </div>
        </section>`;
      overlay.querySelector('.release-back')?.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
      overlay.querySelector('.release-skip')?.addEventListener('click', closeRelease);
      overlay.querySelector('.release-next')?.addEventListener('click', () => { if (isLast) closeRelease(); else { index += 1; render(); } });
      overlay.querySelectorAll('[data-release-index]').forEach((button) => button.addEventListener('click', () => { index = Number(button.dataset.releaseIndex) || 0; render(); }));
    }
    render();
    document.body.append(overlay);
  }

  function showNoticePopup(auth, notice, onRefresh) {
    if (!notice || document.querySelector(`[data-system-popup="${notice.id}"]`)) return;
    const overlay = document.createElement('div');
    overlay.className = `system-notice-popup system-notice-${escapeText(notice.type)}`;
    overlay.dataset.systemPopup = notice.id;
    overlay.innerHTML = `
      <article>
        <span class="notice-kicker">${escapeText(noticeTypeLabel(notice.type))}</span>
        <h2>${escapeText(notice.title)}</h2>
        <p>${escapeText(notice.message)}</p>
        ${activeNoticeText(notice) ? `<small>${escapeText(activeNoticeText(notice))}</small>` : ''}
        <div class="button-row"><button class="btn primary" type="button">Entendi</button></div>
      </article>`;
    overlay.querySelector('button')?.addEventListener('click', () => {
      overlay.remove();
      markNoticeRead(auth, notice.id, onRefresh);
    });
    document.body.append(overlay);
  }

  function renderMaintenanceLock(notice, user) {
    if (!notice || user?.role === 'admin' || document.querySelector('.system-maintenance-lock')) return;
    const lock = document.createElement('div');
    lock.className = 'system-maintenance-lock';
    lock.innerHTML = `
      <article>
        <span class="notice-kicker">MANUTENÇÃO DO GEORURAL</span>
        <h1>${escapeText(notice.title || 'Sistema em manutenção')}</h1>
        <p>${escapeText(notice.message || 'O sistema está temporariamente bloqueado para atualização.')}</p>
        ${activeNoticeText(notice) ? `<small>${escapeText(activeNoticeText(notice))}</small>` : ''}
        <div class="maintenance-loader"><span></span></div>
        <b>O acesso volta quando o administrador encerrar a manutenção.</b>
      </article>`;
    document.body.append(lock);
  }

  function notificationHost() {
    const proBar = document.querySelector('.sv-pro-topbar');
    const proActions = document.querySelector('.sv-pro-topbar-actions');
    if (proBar && proActions) return { anchor: proBar, actions: proActions, mode: 'portal-pro' };
    const top = document.querySelector('.top');
    if (top) {
      let actions = top.querySelector('.top-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'top-actions';
        top.append(actions);
      }
      return { anchor: top, actions, mode: 'portal' };
    }
    const mapBar = document.querySelector('.geo-brandbar');
    const mapActions = document.querySelector('.geo-brand-actions');
    if (mapBar && mapActions) return { anchor: mapBar, actions: mapActions, mode: 'map' };
    return null;
  }

  function renderNoticeBanners(notices = [], user) {
    document.querySelectorAll('.system-notice-banner').forEach((item) => item.remove());
    // v21.9.77: a faixa grande de aviso/manutenção fica somente na Visão geral.
    // Nas outras páginas, o sino continua recebendo notificações, mas sem atrapalhar mapa/módulos.
    if (!isOverviewPage()) return;
    const host = notificationHost();
    const main = document.querySelector('.main') || document.querySelector('main') || document.querySelector('.geo-app');
    const pageTop = document.querySelector('.top');
    if (!host || !main || !pageTop) return;
    const visible = notices.filter((notice) => !isHomeCardNotice(notice) && noticeIsCurrent(notice) && (notice.blocksApp || notice.deliveryMode === 'banner')).slice(0, 3);
    visible.reverse().forEach((notice) => {
      const banner = document.createElement('section');
      banner.className = `system-notice-banner system-notice-${escapeText(notice.type)} ${notice.blocksApp ? 'is-maintenance' : ''}`;
      banner.innerHTML = `
        <div><b>${escapeText(notice.title)}</b><p>${escapeText(notice.message)}</p>${activeNoticeText(notice) ? `<small>${escapeText(activeNoticeText(notice))}</small>` : ''}</div>
        ${notice.blocksApp && user?.role === 'admin' ? '<em>Usuários comuns bloqueados. Admin continua liberado.</em>' : ''}`;
      pageTop.insertAdjacentElement('afterend', banner);
    });
  }

  function renderNotificationCenter(auth, notices = [], user, loadError = null) {
    if (document.body?.classList?.contains('workspace-shell-v131')) {
      const topbarActions = document.querySelector('.workspace-topbar-actions');
      if (topbarActions && !topbarActions.querySelector('.notification-center')) {
        const existing = document.querySelector('.top-actions .notification-center,.workspace-page-head .notification-center');
        if (existing) topbarActions.prepend(existing);
      }
    }
    const host = notificationHost();
    if (!host) return;
    const actions = host.actions;
    let wrap = actions.querySelector('.notification-center');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'notification-center';
      wrap.innerHTML = `<button class="notification-bell" type="button" aria-label="Notificações" title="Notificações"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.6 2.6 0 0 0 2.45-1.75h-4.9A2.6 2.6 0 0 0 12 22Zm7-6.4-1.55-1.7V9.8A5.55 5.55 0 0 0 13 4.35V3a1 1 0 1 0-2 0v1.35A5.55 5.55 0 0 0 6.55 9.8v4.1L5 15.6V18h14v-2.4Z"></path></svg><span>0</span></button><div class="notification-panel hidden"></div>`;
      actions.prepend(wrap);
      wrap.querySelector('.notification-bell')?.addEventListener('click', () => wrap.querySelector('.notification-panel')?.classList.toggle('hidden'));
      document.addEventListener('click', (event) => {
        if (!wrap.contains(event.target)) wrap.querySelector('.notification-panel')?.classList.add('hidden');
      });
    }
    const activeNotifications = notices.filter((notice) => notice && !isHomeCardNotice(notice) && !notice.blocksApp && notice.isActive !== false && notice.deliveryMode !== 'release');
    const unread = activeNotifications.filter(isNoticeUnread);
    const badgeTotal = unread.length;
    const bell = wrap.querySelector('.notification-bell');
    const count = bell?.querySelector('span');
    if (count) count.textContent = String(badgeTotal);
    bell?.classList.toggle('has-unread', unread.length > 0);
    bell?.setAttribute('data-count', String(badgeTotal));
    const panel = wrap.querySelector('.notification-panel');
    if (!panel) return;
    const panelStatus = loadError ? 'API indisponível' : (unread.length ? `${unread.length} nova(s)` : (activeNotifications.length ? `${activeNotifications.length} notificação(ões)` : 'Tudo lido'));
    panel.innerHTML = `
      <header><b>Notificações</b><small>${panelStatus}</small></header>
      <div class="notification-list">
        ${loadError ? `<div class="empty-box notification-error"><b>Notificações indisponíveis</b><br>A API ainda não publicou a rota de avisos. Atualize também o backend e recarregue com Ctrl+F5.</div>` : activeNotifications.length ? activeNotifications.map((notice) => `
          <article class="notification-item ${noticeReadClass(notice)} system-notice-${escapeText(notice.type)}">
            <span>${escapeText(noticeTypeLabel(notice.type))}</span>
            <b>${escapeText(notice.title)}</b>
            <p>${escapeText(notice.message)}</p>
            ${activeNoticeText(notice) ? `<small>${escapeText(activeNoticeText(notice))}</small>` : ''}
            ${noticeWindowBadge(notice)}
            ${notice?.metadata?.renewal ? `<button type="button" class="tiny-button" data-plan-renewal="${escapeText(notice.id)}">${escapeText(notice.metadata.actionLabel || 'Renovar plano')}</button>` : (notice?.metadata?.supportPath ? `<a class="tiny-button" href="${escapeText(notice.metadata.supportPath)}">${escapeText(notice.metadata.actionLabel || 'Falar com suporte')}</a>` : '')}
            ${isNoticeUnread(notice) ? `<button type="button" class="tiny-button" data-notice-read="${escapeText(notice.id)}">Marcar como lida</button>` : '<em>Lida</em>'}
          </article>`).join('') : '<div class="empty-box">Nenhuma notificação no momento.</div>'}
      </div>`;
    panel.querySelectorAll('[data-plan-renewal]').forEach((button) => button.addEventListener('click', async () => {
      if (button.disabled) return;
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Abrindo renovação...';
      try {
        const result = await auth.apiFetch('/api/billing/renewal-handoff', { method: 'POST' });
        const checkoutUrl = String(result?.checkoutUrl || '').trim();
        if (!checkoutUrl) throw new Error('Não foi possível preparar o link de renovação.');
        window.location.href = checkoutUrl;
      } catch (error) {
        button.disabled = false;
        button.textContent = original;
        const message = String(error?.message || 'Não foi possível abrir a renovação agora.');
        if (typeof window.showSuiteToast === 'function') window.showSuiteToast(message, 'error');
        else alert(message);
      }
    }));
    panel.querySelectorAll('[data-notice-read]').forEach((button) => button.addEventListener('click', () => {
      markNoticeRead(auth, button.dataset.noticeRead, () => loadAndRenderSystemNotices(auth, user));
    }));
  }

  async function loadAndRenderSystemNotices(auth, user, options = {}) {
    if (!auth?.loadSystemNotices) return;
    let notices = [];
    let loadError = null;
    try { notices = await auth.loadSystemNotices(options); }
    catch (error) {
      loadError = error;
      console.warn('[GeoRural Avisos] avisos indisponíveis temporariamente:', error);
    }
    renderNotificationCenter(auth, notices, user, loadError);
    if (loadError) return;
    renderNoticeBanners(notices, user);
    const blocker = notices.find((notice) => noticeIsCurrent(notice) && notice.blocksApp);
    if (blocker) renderMaintenanceLock(blocker, user);
    const release = notices.find((notice) => noticeIsCurrent(notice) && isNoticeUnread(notice) && notice.deliveryMode === 'release');
    if (release) {
      showReleaseNotes(auth, release, () => loadAndRenderSystemNotices(auth, user));
      return;
    }
    const popup = notices.find((notice) => noticeIsCurrent(notice) && isNoticeUnread(notice) && notice.deliveryMode === 'popup');
    if (popup) showNoticePopup(auth, popup, () => loadAndRenderSystemNotices(auth, user));
  }


  function markPortalReady() {
    document.documentElement.dataset.portalReady = 'true';
    window.dispatchEvent(new CustomEvent('surveyor:portal-ready'));
  }

  async function bootstrapPortal() {
    if (document.documentElement.dataset.portalReady === 'true') return;

    const auth = window.SurveyorAuth || window.GeoRuralAuth;
    if (!auth) {
      console.error('[GeoRural Portal] O módulo de autenticação não foi carregado.');
      return;
    }

    const page = document.body?.dataset.page || location.pathname.split('/').filter(Boolean).pop() || 'index.html';
    const route = cleanRouteForPageName(page);
    if (page === 'login.html' || route === '/login/') return;

    const user = page === 'admin.html' || route === '/admin/' ? auth.requireAdmin() : auth.requireAuth();
    if (!user) return;

    // Valida a sessão antes de liberar o primeiro paint de qualquer rota protegida.
    // Assim uma URL direta (/mapas/, /mapa/, /admin/ etc.) nunca exibe o módulo
    // por um instante antes de redirecionar para o login.
    try {
      const validSession = await auth.ensureSession?.();
      if (validSession === false) {
        if (!auth.currentUser?.()) {
          const returnTo = encodeURIComponent(`${location.pathname || '/'}${location.search || ''}${location.hash || ''}`);
          location.replace(`/login/?return=${returnTo}`);
        }
        return;
      }
    } catch (error) {
      console.warn('[GeoRural Portal] Não foi possível confirmar a sessão antes do primeiro paint:', error);
      if (!auth.currentUser?.()) return;
    }

    try { await auth.loadPlans?.(); } catch (error) { console.warn('[GeoRural Portal] Planos indisponíveis temporariamente:', error); }
    renderPasswordSecurityBanner(auth, auth.currentUser?.() || user);
    window.addEventListener('surveyor:password-changed', () => renderPasswordSecurityBanner(auth, auth.currentUser?.() || user));

    window.addEventListener('georural:session-warning', (event) => {
      const toast = document.getElementById('suiteToast') || document.getElementById('toast');
      const message = event.detail?.message || 'A API está temporariamente indisponível.';
      if (!toast) {
        console.warn(message);
        return;
      }
      toast.textContent = `${message} Sua sessão foi mantida.`;
      toast.classList.add('show', 'error');
      setTimeout(() => toast.classList.remove('show', 'error'), 4500);
    });

    const nav = document.querySelector('.nav');
    if (nav) {
      const items = user.role === 'admin'
        ? [...menuItems, ['/admin/', 'admin', 'Administração', 'admin']]
        : menuItems.filter(([, , , permission]) => can(auth, permission, user));
      nav.innerHTML = items.map(([href, icon, label]) => `
        <a href="${href}" class="${route === href ? 'active' : ''}">
          <span class="nav-icon nav-icon-image">${moduleIconMarkup(icon, label)}</span><span>${label}</span>
        </a>`).join('');

      // No mapa, o portal pode terminar a autenticação depois do runtime visual
      // e reconstruir a navegação legada. Avise o runtime para normalizar o menu
      // imediatamente; se ele ainda não carregou, a inicialização dele fará isso.
      if (page === 'mapa.html' || route === '/mapa/') {
        document.dispatchEvent(new CustomEvent('surveyor:map-nav-source-updated'));
        requestAnimationFrame(() => window.SurveyorModernizeMapNav?.());
      }
    }

    const pageInfo = pagePermissions[route];
    if (pageInfo && !can(auth, pageInfo.permission, user)) {
      renderAccessDenied(pageInfo);
      markPortalReady();
      return;
    }

    const accountTarget = document.body?.classList?.contains('workspace-shell-v131')
      ? document.querySelector('.sv-pro-topbar-actions')
      : document.querySelector('.top');
    if (accountTarget && !accountTarget.querySelector('.account-zone')) {
      let actions = accountTarget;
      if (!document.body?.classList?.contains('workspace-shell-v131')) {
        actions = accountTarget.querySelector('.top-actions');
        if (!actions) {
          actions = document.createElement('div');
          actions.className = 'top-actions';
          accountTarget.append(actions);
        }
      }
      const plan = auth.currentPlan();
      const planLabel = String(user.planName || plan?.name || (user.role === 'admin' ? 'Administrador' : 'Conta ativa')).replace(/^Surveyor\s+/i, '').trim();
      const account = document.createElement('div');
      account.className = 'account-zone workspace-topbar-account';
      account.innerHTML = `
        <div class="account-avatar">${escapeText((brandDisplayText(user.name || user.email)).slice(0, 1).toUpperCase())}</div>
        <div class="account-copy"><strong>${escapeText(brandDisplayText(user.name))}</strong><small>${escapeText(planLabel)}</small></div>
        <button class="account-logout" type="button">Sair</button>`;
      account.querySelector('.account-logout')?.addEventListener('click', () => auth.logout());
      actions.append(account);
    }

    const note = document.querySelector('.side-note');
    if (note) {
      const plan = auth.currentPlan();
      note.innerHTML = `
        <b>${escapeText(brandDisplayText(user.name))}</b><br>
        ${escapeText(brandDisplayText(user.email))}<br>
        <span class="plan-mini">${escapeText(plan?.name || (user.role === 'admin' ? 'Administrador' : 'Conta ativa'))}</span>`;
    }

    const mapNav = document.getElementById('mapGlobalNav');
    const mapToggle = document.getElementById('mapGlobalNavToggle');
    const mapClose = document.getElementById('mapGlobalNavClose');
    const setMapNav = (open) => {
      document.body.classList.toggle('map-nav-open', open);
      mapNav?.classList.toggle('open', open);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
    };
    mapToggle?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMapNav(!document.body.classList.contains('map-nav-open'));
    });
    mapClose?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMapNav(false);
    });
    // No mapa, a navegação global é um popup lateral: começa fechada e não desloca o mapa.
    if (page === 'mapa.html') {
      setMapNav(false);
      document.addEventListener('pointerdown', (event) => {
        if (!document.body.classList.contains('map-nav-open')) return;
        if (mapNav?.contains(event.target) || mapToggle?.contains(event.target)) return;
        setMapNav(false);
      }, true);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('map-nav-open')) setMapNav(false);
      });
    }

    document.getElementById('mobileToggle')?.addEventListener('click', () => {
      document.getElementById('side')?.classList.toggle('open');
    });

    applyFeatureLocks(auth, user);
    setTimeout(() => { applyFeatureLocks(auth, user); }, 500);

    const NOTICE_POLL_MS = 60_000;
    const pollNotices = (force = false) => {
      if (document.hidden && !force) return;
      const now = Date.now();
      if (!force && window.__georuralNoticeLastPollAt && now - window.__georuralNoticeLastPollAt < NOTICE_POLL_MS) return;
      window.__georuralNoticeLastPollAt = now;
      return loadAndRenderSystemNotices(auth, auth.currentUser?.() || user, force ? { forceRefresh: true, noCache: true } : {});
    };
    window.GeoRuralRefreshNotices = () => pollNotices(true);
    window.SurveyorRefreshNotices = window.GeoRuralRefreshNotices;
    window.addEventListener('georural:notices-changed', window.GeoRuralRefreshNotices);
    pollNotices(true);
    if (!window.__georuralNoticeTimer) {
      window.__georuralNoticeTimer = setInterval(() => pollNotices(false), NOTICE_POLL_MS);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) pollNotices(false); });
    }


    markPortalReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bootstrapPortal(); }, { once: true });
  } else {
    bootstrapPortal();
  }
})();
