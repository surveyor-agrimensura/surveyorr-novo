(() => {
  'use strict';

  function deployBase() {
    const metaBase = document.querySelector('meta[name="surveyor-deploy-base"]')?.content;
    if (metaBase) return String(metaBase).replace(/\/$/, '');
    const parts = location.pathname.split('/').filter(Boolean);
    if (/github\.io$/i.test(location.hostname) && parts.length) return `/${parts[0]}`;
    return '';
  }

  const DEPLOY_BASE = deployBase();
  const assetUrl = (path) => `${DEPLOY_BASE}${String(path || '').startsWith('/') ? path : `/${path || ''}`}`;
  const routeUrl = (path) => `${DEPLOY_BASE}${String(path || '').startsWith('/') ? path : `/${path || ''}`}`;
  const logoImg = (className = '') => `<img${className ? ` class="${className}"` : ''} src="${assetUrl('/assets/logo.png')}" alt="Surveyor" onerror="this.onerror=null;this.src='${assetUrl('/assets/logo.png')}'">`;
  const iconImg = (className = '') => `<img${className ? ` class="${className}"` : ''} src="${assetUrl('/assets/logo.png')}" alt="Surveyor" onerror="this.onerror=null;this.style.display='none'">`;
  const LOGO = assetUrl('/assets/logo.png');
  const ICON_LOGO = assetUrl('/assets/logo.png');
  const PAGES = [
    { url: routeUrl('/'), icon: 'inicio', label: 'Visão geral', group: 'main' },
    { url: routeUrl('/mapa/'), icon: 'mapa-cadastro', label: 'Mapa e cadastro', group: 'main' , permission: 'map:access' },
    { url: routeUrl('/car/'), icon: 'car', label: 'Módulo CAR', group: 'main' , permission: 'car:access' },
    { url: routeUrl('/consulta-car/'), icon: 'consulta-car', label: 'Consulta Pública CAR', group: 'main' },
    { url: routeUrl('/loteamentos-reurb/'), icon: 'loteamentos', label: 'Loteamentos / REURB', group: 'main' , permission: 'loteamentos:access' },
    { url: routeUrl('/nuvem/'), icon: 'nuvem', label: 'Projetos', group: 'main' , permission: 'cloud:access' },
    { url: routeUrl('/central-lotes/'), icon: 'loteamentos', label: 'Central de Lotes', group: 'main', permission: 'projects:export-zip' },
    { url: routeUrl('/customizacao/'), icon: 'customizacao', label: 'Personalização', group: 'main' , permission: 'company:settings' },
    { url: routeUrl('/memorial/'), icon: 'memorial', label: 'Memorial descritivo', group: 'docs' , permission: 'documents:memorial' },
    { url: routeUrl('/ods/'), icon: 'ods', label: 'Planilha ODS', group: 'docs' , permission: 'documents:ods' },
    { url: routeUrl('/confrontacao/'), icon: 'confrontacao', label: 'Cartas de confrontação', group: 'docs' , permission: 'documents:confrontacao' },
    { url: routeUrl('/acervos/'), icon: 'acervos', label: 'Acervos oficiais', group: 'docs' , permission: 'layers:official' },
    { url: routeUrl('/mapas/'), icon: 'mapas', label: 'Mapas e croquis', group: 'docs' , permission: 'documents:mapas' },
    { url: routeUrl('/pranchas/'), icon: 'pranchas', label: 'Pranchas técnicas', group: 'docs' , permission: 'documents:pranchas' },
    { url: routeUrl('/planialtimetria/'), icon: 'planialtimetria', label: 'Planialtimetria / MDT', group: 'tech' , permission: 'documents:planialtimetria' },
    { url: routeUrl('/perimetros/'), icon: 'perimetros', label: 'Perímetros por azimute', group: 'tech' , permission: 'documents:perimetros' },
    { url: routeUrl('/ambiental/'), icon: 'ambiental', label: 'Relatório ambiental', group: 'tech' , permission: 'ambiental:access' },
    { url: routeUrl('/admin/'), icon: 'admin', label: 'Administração', group: 'admin' , permission: 'admin:dashboard' }
  ];

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const moduleIcon = (name, alt = '') => {
    const safeName = String(name || 'inicio').replace(/[^a-z0-9-]/gi, '');
    const safeAlt = escapeHtml(alt || safeName);
    const initials = escapeHtml(String(alt || safeName).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'SV');
    return `<span class="module-icon-safe"><img class="module-icon-img" src="${assetUrl(`/assets/module-icons/${safeName}.png`)}" alt="${safeAlt}" loading="lazy" onerror="this.onerror=null;this.hidden=true;const fallback=this.nextElementSibling;if(fallback)fallback.hidden=false"><span class="module-icon-fallback" aria-hidden="true" hidden>${initials}</span></span>`;
  };

  const topbarIcon = (name) => {
    const icons = {
      tools: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>',
      map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
      projects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 2h9v11H3V6Z"/></svg>',
      archives: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/></svg>',
      support: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15v-3a7 7 0 0 1 14 0v3"/><path d="M5 14H3v5h4v-5H5Zm14 0h2v5h-4v-5h2ZM17 19c0 1.1-2.2 2-5 2"/></svg>',
      courses: `<img class="sv-topbar-courses-icon" src="${assetUrl('/assets/module-icons/cursos.png')}" alt="" aria-hidden="true">`,
      install: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10m0 0 4-4m-4 4-4-4M5 18v2h14v-2"/></svg>'
    };
    return `<span class="sv-compact-nav-icon">${icons[name] || icons.tools}</span>`;
  };

  function loadOnboardingAssets() {
    if (!document.querySelector('link[data-surveyor-onboarding]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/assets/css/core/onboarding.css?v=1.0.0-rc.185.74';
      link.dataset.surveyorOnboarding = '1';
      document.head.appendChild(link);
    }
    if (document.querySelector('script[data-surveyor-onboarding]')) return;
    const script = document.createElement('script');
    script.src = '/assets/js/core/onboarding.js?v=1.0.0-rc.185.74';
    script.defer = true;
    script.dataset.surveyorOnboarding = '1';
    document.head.appendChild(script);
  }

  function installToastBridge() {
    let timer = null;
    const toast = (message, type = 'info') => {
      const text = String(message || '').trim();
      if (!text) return;
      let host = document.getElementById('suiteToast');
      if (!host) {
        host = document.createElement('div');
        host.id = 'suiteToast';
        host.className = 'toast';
        document.body.appendChild(host);
      }
      clearTimeout(timer);
      host.textContent = text;
      host.className = `toast show ${type || ''}`.trim();
      timer = setTimeout(() => { host.className = 'toast'; }, type === 'error' ? 5200 : 3200);
    };
    window.SurveyorToast = window.SurveyorToast || toast;
    window.GeoRuralSuite = window.GeoRuralSuite || {};
    window.GeoRuralSuite.toast = window.GeoRuralSuite.toast || toast;
  }

  let deferredPwaInstallPrompt = null;
  let pwaInstalled = Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true);

  function ensurePwaHead() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = routeUrl('/manifest.webmanifest?v=1.0.0-rc.185.74');
      document.head.appendChild(manifest);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = assetUrl('/assets/pwa/surveyor-192.png');
      document.head.appendChild(icon);
    }
  }

  function isSecurePwaContext() {
    return window.isSecureContext || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  }

  function syncPwaInstallButtons() {
    const canInstall = !pwaInstalled && Boolean(deferredPwaInstallPrompt);
    document.querySelectorAll('[data-surveyor-pwa-install]').forEach((button) => {
      button.hidden = !canInstall;
      button.setAttribute('aria-hidden', canInstall ? 'false' : 'true');
    });
  }

  async function runPwaInstall(button) {
    if (pwaInstalled) {
      syncPwaInstallButtons();
      return;
    }
    const promptEvent = deferredPwaInstallPrompt;
    if (!promptEvent) {
      window.SurveyorToast?.('A instalação ainda não está disponível neste navegador. Use Chrome ou Edge em conexão segura.', 'info');
      return;
    }
    button?.setAttribute('aria-busy', 'true');
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      deferredPwaInstallPrompt = null;
      if (choice?.outcome === 'accepted') {
        pwaInstalled = true;
        window.SurveyorToast?.('Surveyor instalado no computador.', 'success');
      } else {
        window.SurveyorToast?.('Instalação cancelada.', 'info');
      }
    } catch (error) {
      console.warn('[Surveyor PWA] Falha ao abrir instalação:', error);
      window.SurveyorToast?.('Não foi possível abrir a instalação agora.', 'error');
      deferredPwaInstallPrompt = null;
    } finally {
      button?.removeAttribute('aria-busy');
      syncPwaInstallButtons();
    }
  }

  function bindPwaInstallButtons(root = document) {
    root.querySelectorAll('[data-surveyor-pwa-install]').forEach((button) => {
      if (button.dataset.pwaBound === '1') return;
      button.dataset.pwaBound = '1';
      button.addEventListener('click', () => runPwaInstall(button));
    });
    syncPwaInstallButtons();
  }

  function setupPwaInstall() {
    ensurePwaHead();
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPwaInstallPrompt = event;
      pwaInstalled = false;
      syncPwaInstallButtons();
    });
    window.addEventListener('appinstalled', () => {
      deferredPwaInstallPrompt = null;
      pwaInstalled = true;
      syncPwaInstallButtons();
      window.SurveyorToast?.('Surveyor instalado com sucesso.', 'success');
    });
    try {
      window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', (event) => {
        if (event.matches) {
          pwaInstalled = true;
          deferredPwaInstallPrompt = null;
          syncPwaInstallButtons();
        }
      });
    } catch {}
    if ('serviceWorker' in navigator && isSecurePwaContext()) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(routeUrl('/sw.js'), { scope: routeUrl('/') })
          .catch((error) => console.warn('[Surveyor PWA] Service Worker não registrado:', error));
      }, { once: true });
    }
  }

  function pwaInstallButtonMarkup() {
    return `<button class="sv-pwa-install-button sv-compact-nav-item" type="button" data-surveyor-pwa-install hidden aria-hidden="true" title="Instalar Surveyor no computador">${topbarIcon('install')}<span class="sv-compact-nav-label">Instalar</span></button>`;
  }

  setupPwaInstall();

  const cleanRouteAliases = {
    'index.html': '/',
    'login.html': '/login/',
    'admin.html': '/admin/',
    'admin-cards.html': '/admin/',
    'mapa.html': '/mapa/',
    'car.html': '/car/',
    'consulta-car.html': '/consulta-car/',
    'nuvem.html': '/nuvem/',
    'central-lotes.html': '/central-lotes/',
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
    'suporte.html': '/suporte/',
  };

  function currentPage() {
    return document.body?.dataset?.page || location.pathname.split('/').filter(Boolean).pop() || 'index.html';
  }

  function stripDeployBase(path) {
    const raw = String(path || '/');
    if (DEPLOY_BASE && raw === DEPLOY_BASE) return '/';
    if (DEPLOY_BASE && raw.startsWith(`${DEPLOY_BASE}/`)) return raw.slice(DEPLOY_BASE.length) || '/';
    return raw;
  }

  function currentRoute() {
    const page = currentPage();
    const route = cleanRouteAliases[page] || stripDeployBase(location.pathname) || (String(page).startsWith('/') ? page : `/${String(page).replace(/\.html$/, '')}/`);
    return routeUrl(route);
  }

  function pageTitle() {
    return document.querySelector('.top h1')?.textContent?.trim()
      || document.title?.replace('— Surveyor', '').trim()
      || 'Dashboard';
  }

  function authUser() {
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    try { return auth?.currentUser?.() || null; } catch { return null; }
  }

  function displayUserName(user) {
    const raw = user?.name || user?.fullName || user?.email || 'Administrador Surveyor';
    return String(raw || 'Administrador Surveyor').replace(/GeoRural/gi, 'Surveyor').trim() || 'Administrador Surveyor';
  }

  function userRoleLabel(user) {
    if (user?.role === 'admin') return 'Administrador';
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    let plan = null;
    try { plan = auth?.currentPlan?.() || null; } catch {}
    return String(user?.planName || plan?.name || 'Conta ativa').replace(/^Surveyor\s+/i, '').trim() || 'Conta ativa';
  }

  function formatPlanDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function planStatusMeta(user = authUser()) {
    if (!user) return null;
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    let plan = null;
    try { plan = auth?.currentPlan?.() || null; } catch {}
    const rawName = String(user.planName || plan?.name || user.planSlug || user.planId || user.plan || '').trim();
    if (!rawName && isAdminUser(user)) {
      return {
        label: 'Conta administrativa',
        detail: 'Acesso sem vencimento',
        tone: 'is-admin',
        title: 'Conta administrativa — acesso sem vencimento'
      };
    }
    if (!rawName) return null;
    const compactName = rawName
      .replace(/^Surveyor\s+/i, '')
      .replace(/_/g, ' ')
      .replace(/\b(monthly|mensal)\b/i, 'Mensal')
      .replace(/\b(annual|anual)\b/i, 'Anual')
      .replace(/\s+/g, ' ')
      .trim();
    const label = /^plano\s/i.test(compactName) ? compactName : `Plano ${compactName}`;
    const slug = String(user.planSlug || user.planId || user.plan || '').toLowerCase();
    const tierText = `${compactName} ${slug}`.toLowerCase();
    const tier = tierText.includes('pro') ? 'pro' : tierText.includes('plus') ? 'plus' : tierText.includes('basic') || tierText.includes('básico') ? 'basic' : '';
    const tierClass = tier ? `is-plan-${tier}` : '';
    const icon = tier === 'pro' ? `<svg class="workspace-plan-premium-icon" viewBox="0 0 24 24" role="img" aria-label="Plano Pro"><path class="premium-crown-fill" d="M3.7 8.3 7.6 11.5 12 5.7l4.4 5.8 3.9-3.2-1.7 8.6H5.4L3.7 8.3Z"/><path class="premium-crown-line" d="M5.4 16.9h13.2M7.1 19.3h9.8"/><circle class="premium-crown-gem" cx="12" cy="9.2" r="1.15"/></svg>` : '';
    const formattedDate = formatPlanDate(user.expiresAt);
    const days = renewalDaysLeft(user);
    if (!user.expiresAt && /(vital[ií]cio|lifetime)/i.test(`${compactName} ${slug}`)) {
      return { label, detail: 'Acesso vitalício', tone: 'is-lifetime', title: `${label} — acesso vitalício`, tierClass, icon };
    }
    if (!formattedDate || !Number.isFinite(days)) {
      return { label, detail: 'Validade não informada', tone: 'is-neutral', title: `${label} — validade não informada`, tierClass, icon };
    }
    if (days < 0) return { label, detail: `Vencido em ${formattedDate}`, tone: 'is-expired', title: `${label} — vencido em ${formattedDate}`, tierClass, icon };
    if (days === 0) return { label, detail: `Vence hoje • ${formattedDate}`, tone: 'is-critical', title: `${label} — vence hoje`, tierClass, icon };
    if (days === 1) return { label, detail: `Vence amanhã • ${formattedDate}`, tone: 'is-critical', title: `${label} — vence amanhã`, tierClass, icon };
    if (days <= 7) return { label, detail: `${days} dias • ${formattedDate}`, tone: 'is-critical', title: `${label} — vence em ${days} dias`, tierClass, icon };
    if (days <= 30) return { label, detail: `${days} dias • ${formattedDate}`, tone: 'is-warning', title: `${label} — vence em ${days} dias`, tierClass, icon };
    return { label, detail: `Ativo até ${formattedDate}`, tone: 'is-active', title: `${label} — ativo até ${formattedDate}`, tierClass, icon };
  }


  function isAdminUser(user) {
    if (!user) return false;
    const role = String(user.role || user.type || '').toLowerCase();
    const permissions = [
      ...(Array.isArray(user.permissions) ? user.permissions : []),
      ...(Array.isArray(user.scopes) ? user.scopes : []),
      ...(Array.isArray(user.planPermissions) ? user.planPermissions : []),
      ...(Array.isArray(user.features) ? user.features : [])
    ].map((item) => String(item || '').toLowerCase());
    return role === 'admin'
      || role === 'administrator'
      || user.isAdmin === true
      || user.admin === true
      || permissions.includes('*')
      || permissions.includes('all')
      || permissions.includes('admin:all')
      || permissions.includes('admin');
  }



  function renewalDaysLeft(user = authUser()) {
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (auth?.renewalDaysLeft) { try { return auth.renewalDaysLeft(user); } catch {} }
    if (!user?.expiresAt) return null;
    const end = new Date(user.expiresAt);
    if (!Number.isFinite(end.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const expiry = new Date(end); expiry.setHours(0,0,0,0);
    return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  }


  const BASIC_FALLBACK_PERMISSIONS = ["map:access","map:view","map:create-basic","map:draw-basic","map:measure-basic","projects:access","projects:create","projects:edit-own","projects:view-own","projects:export","projects:export-basic","projects:unlimited","projects:templates-standard","documents:memorial","documents:memorial-basic","documents:ods","documents:ods-basic","documents:confrontacao","documents:confrontacao-basic","documents:mapas","documents:mapas-basic","documents:pranchas","documents:pranchas-basic","documents:download","cloud:access","cloud:view-own","cloud:basic","support:standard"];
  const PLUS_FALLBACK_PERMISSIONS = ["map:access","map:view","map:create-basic","map:draw-basic","map:measure-basic","projects:access","projects:create","projects:edit-own","projects:view-own","projects:export","projects:export-basic","projects:unlimited","projects:templates-standard","documents:memorial","documents:memorial-basic","documents:ods","documents:ods-basic","documents:confrontacao","documents:confrontacao-basic","documents:mapas","documents:mapas-basic","documents:pranchas","documents:pranchas-basic","documents:download","cloud:access","cloud:view-own","cloud:basic","support:standard","basic:*","car:access","car:full","layers:official","layers:catalog","layers:catalog-full","layers:view-full","layers:wms-wfs","geometry:access","geometry:edit-basic","geometry:offset","geometry:rotate","geometry:scale","geometry:mirror","geometry:vertices-edit","sig:access","sig:basic","terrain:access","terrain:basic","ambiental:access","ambiental:basic","loteamentos:access","loteamentos:basic","documents:perimetros","documents:perimetros-full","documents:planialtimetria","documents:planialtimetria-basic","sharing:readonly","sharing:password","sharing:expires","sharing:revoke","sharing:access-limit","workspace:members","workspace:settings","workspace:storage","workspace:audit-own","security:account-monitoring"];
  const PRO_FALLBACK_PERMISSIONS = ["map:access","map:view","map:create-basic","map:draw-basic","map:measure-basic","projects:access","projects:create","projects:edit-own","projects:view-own","projects:export","projects:export-basic","projects:unlimited","projects:templates-standard","documents:memorial","documents:memorial-basic","documents:ods","documents:ods-basic","documents:confrontacao","documents:confrontacao-basic","documents:mapas","documents:mapas-basic","documents:pranchas","documents:pranchas-basic","documents:download","cloud:access","cloud:view-own","cloud:basic","support:standard","basic:*","car:access","car:full","layers:official","layers:catalog","layers:catalog-full","layers:view-full","layers:wms-wfs","geometry:access","geometry:edit-basic","geometry:offset","geometry:rotate","geometry:scale","geometry:mirror","geometry:vertices-edit","sig:access","sig:basic","terrain:access","terrain:basic","ambiental:access","ambiental:basic","loteamentos:access","loteamentos:basic","documents:perimetros","documents:perimetros-full","documents:planialtimetria","documents:planialtimetria-basic","sharing:readonly","sharing:password","sharing:expires","sharing:revoke","sharing:access-limit","workspace:members","workspace:settings","workspace:storage","workspace:audit-own","security:account-monitoring","plus:*","projects:trash","projects:lock","projects:version-full","projects:templates","projects:export-zip","geometry:advanced","sig:advanced","terrain:advanced","ambiental:full","loteamentos:full","planialtimetria:full","sharing:full","company:settings","cloud:pro","support:priority"];
  const PERMISSION_ALIASES = {
    'mapa': ['map:access', 'map:view'],
    'map': ['map:access', 'map:view'],
    'map:view': ['map:access'],
    'map:access': ['map:view', 'map:create-basic', 'map:draw-basic', 'map:measure-basic'],
    'layers:catalog': ['layers:catalog-full', 'layers:view-full'],
    'layers:catalog-full': ['layers:catalog', 'layers:view-full'],
    'layers:view-basic': ['layers:official', 'layers:official-basic'],
    'layers:official': ['layers:official-basic'],
    'layers:official-basic': ['layers:official'],
    'acervos': ['layers:official', 'layers:official-basic'],
    'memorial': ['documents:memorial', 'documents:memorial-basic', 'documents:memorial-full'],
    'documents:memorial': ['documents:memorial-basic', 'documents:memorial-full'],
    'documents:memorial-basic': ['documents:memorial'],
    'documents:memorial-full': ['documents:memorial'],
    'ods': ['documents:ods', 'documents:ods-basic', 'documents:ods-full'],
    'documents:ods': ['documents:ods-basic', 'documents:ods-full'],
    'documents:ods-basic': ['documents:ods'],
    'documents:ods-full': ['documents:ods'],
    'confrontacao': ['documents:confrontacao', 'documents:confrontacao-basic', 'documents:confrontacao-full'],
    'documents:confrontacao': ['documents:confrontacao-basic', 'documents:confrontacao-full'],
    'documents:confrontacao-basic': ['documents:confrontacao'],
    'documents:confrontacao-full': ['documents:confrontacao'],
    'mapas': ['documents:mapas', 'documents:mapas-basic', 'documents:mapas-full'],
    'documents:mapas': ['documents:mapas-basic', 'documents:mapas-full'],
    'documents:mapas-basic': ['documents:mapas'],
    'documents:mapas-full': ['documents:mapas'],
    'pranchas': ['documents:pranchas', 'documents:pranchas-basic', 'documents:pranchas-full'],
    'documents:pranchas': ['documents:pranchas-basic', 'documents:pranchas-full'],
    'documents:pranchas-basic': ['documents:pranchas'],
    'documents:pranchas-full': ['documents:pranchas'],
    'perimetros': ['documents:perimetros', 'documents:perimetros-full'],
    'documents:perimetros': ['documents:perimetros-full'],
    'documents:perimetros-full': ['documents:perimetros'],
    'planialtimetria': ['documents:planialtimetria', 'documents:planialtimetria-basic', 'planialtimetria:full'],
    'documents:planialtimetria': ['documents:planialtimetria-basic', 'planialtimetria:full'],
    'documents:planialtimetria-basic': ['documents:planialtimetria'],
    'car': ['car:access', 'car:full'],
    'car:access': ['car:full'],
    'car:full': ['car:access'],
    'ambiental': ['ambiental:access', 'ambiental:basic', 'ambiental:full'],
    'ambiental:access': ['ambiental:basic', 'ambiental:full'],
    'ambiental:basic': ['ambiental:access'],
    'ambiental:full': ['ambiental:access', 'ambiental:basic'],
    'loteamentos': ['loteamentos:access', 'loteamentos:basic', 'loteamentos:full'],
    'loteamentos:access': ['loteamentos:basic', 'loteamentos:full'],
    'loteamentos:basic': ['loteamentos:access'],
    'loteamentos:full': ['loteamentos:access', 'loteamentos:basic'],
    'cloud': ['cloud:access', 'cloud:view-own', 'cloud:basic', 'cloud:plus', 'cloud:pro'],
    'cloud:access': ['cloud:view-own', 'cloud:basic'],
    'cloud:view-own': ['cloud:access'],
    'cloud:basic': ['cloud:access'],
    'support': ['support:standard']
  };

  function permissionCandidates(permission) {
    const key = String(permission || '').trim().toLowerCase();
    if (!key) return [];
    return [...new Set([key, ...(PERMISSION_ALIASES[key] || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)])];
  }

  function addPermissionAliases(set) {
    let changed = true;
    while (changed) {
      changed = false;
      [...set].forEach((permission) => {
        permissionCandidates(permission).forEach((alias) => {
          if (!set.has(alias)) { set.add(alias); changed = true; }
        });
      });
    }
    return set;
  }


  function localPermissionSet(user = authUser()) {
    const raw = [
      ...(Array.isArray(user?.effectivePermissions) ? user.effectivePermissions : []),
      ...(Array.isArray(user?.planPermissions) ? user.planPermissions : []),
      ...(Array.isArray(user?.permissions) ? user.permissions : []),
      ...(Array.isArray(user?.features) ? user.features : []),
      ...(Array.isArray(user?.scopes) ? user.scopes : [])
    ].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
    const plan = String(user?.planSlug || user?.planId || user?.plan || '').toLowerCase();
    const tier = /^(?:pro(?:_annual|_monthly)?|pro-max|promax)$/.test(plan) ? 'pro'
      : /^(?:plus(?:_annual|_monthly)?)$/.test(plan) ? 'plus'
      : /^(?:basic(?:_annual|_monthly)?)$/.test(plan) ? 'basic' : '';
    const official = tier === 'pro' ? PRO_FALLBACK_PERMISSIONS : tier === 'plus' ? PLUS_FALLBACK_PERMISSIONS : tier === 'basic' ? BASIC_FALLBACK_PERMISSIONS : null;
    let set = official
      ? (user?.isSubuser === true
          ? new Set(raw.filter((permission) => official.includes(permission) && !permission.endsWith(':*')))
          : new Set(official))
      : new Set(raw);
    if (tier && user?.isSubuser !== true) set.add(`${tier}:*`);
    if (user?.isSubuser !== true) {
      if (set.has('pro:*')) { set.add('plus:*'); PRO_FALLBACK_PERMISSIONS.forEach((perm) => set.add(perm)); }
      if (set.has('plus:*')) { set.add('basic:*'); PLUS_FALLBACK_PERMISSIONS.forEach((perm) => set.add(perm)); }
      if (set.has('basic:*')) BASIC_FALLBACK_PERMISSIONS.forEach((perm) => set.add(perm));
    }
    addPermissionAliases(set);
    return set;
  }

  function canAccessPermission(permission, user = authUser()) {
    if (!permission) return true;
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (auth?.hasPermission) {
      try { return Boolean(auth.hasPermission(permission)); } catch {}
    }
    if (isAdminUser(user)) return true;
    const set = localPermissionSet(user);
    const perm = String(permission).trim().toLowerCase();
    const candidates = permissionCandidates(perm);
    if (set.has('*') || set.has('all') || candidates.some((candidate) => set.has(candidate))) return true;
    for (const candidate of candidates) {
      const [scope, action] = candidate.split(':');
      if (set.has(`${scope}:*`)) return true;
      if (action && /-basic$/.test(action) && (set.has(`${scope}:full`) || set.has(`${scope}:advanced`) || set.has(`${scope}:access`))) return true;
      if (action === 'access' && (set.has(`${scope}:full`) || set.has(`${scope}:basic`) || set.has(`${scope}:view-basic`) || set.has(`${scope}:view-full`))) return true;
      if (action === 'view-basic' && (set.has(`${scope}:view-full`) || set.has(`${scope}:catalog-full`) || set.has(`${scope}:access`))) return true;
      if (action === 'official-basic' && (set.has(`${scope}:official`) || set.has(`${scope}:view-full`))) return true;
      if (scope === 'projects' && action === 'limit-20' && (set.has('projects:limit-100') || set.has('projects:limit-500') || set.has('projects:unlimited'))) return true;
      if (scope === 'projects' && action === 'limit-100' && (set.has('projects:limit-500') || set.has('projects:unlimited'))) return true;
      if (scope === 'projects' && action === 'limit-500' && set.has('projects:unlimited')) return true;
    }
    return false;
  }

  function pagesForUser(user = authUser()) {
    if (isAdminUser(user)) return PAGES;
    return PAGES.filter((item) => canAccessPermission(item.permission, user));
  }

  function guardCurrentRoute(user = authUser()) {
    if (!user || isAdminUser(user)) return;
    const route = stripDeployBase(location.pathname).replace(/\/index\.html$/i, '/');
    const normalized = route === '' ? '/' : (route.endsWith('/') ? route : `${route}/`);
    const page = PAGES.find((item) => stripDeployBase(new URL(item.url, location.origin).pathname) === normalized);
    if (!page?.permission || canAccessPermission(page.permission, user)) return;
    window.SurveyorToast?.('Seu plano atual não possui acesso a este recurso.', 'error');
    location.replace(routeUrl('/'));
  }

  function accountMarkup(user) {
    if (!user) return '';
    const name = displayUserName(user);
    const firstName = String(name || '').trim().split(/\s+/)[0] || 'Usuário';
    const greeting = `Olá, ${firstName.toLocaleUpperCase('pt-BR')}`;
    const planStatus = planStatusMeta(user);
    const planMarkup = planStatus ? `<span class="workspace-plan-status ${escapeHtml(planStatus.tone)} ${escapeHtml(planStatus.tierClass || '')}" title="${escapeHtml(planStatus.title)}" aria-label="${escapeHtml(planStatus.title)}">
      <strong>${planStatus.icon ? `<span class="workspace-plan-icon" aria-hidden="true">${planStatus.icon}</span>` : ''}${escapeHtml(planStatus.label)}</strong><small>${escapeHtml(planStatus.detail)}</small>
    </span>` : '';
    const accountTitle = `${name} — ${userRoleLabel(user)}`;
    return `${planMarkup}<div class="account-zone workspace-topbar-account" data-workspace-account="1" title="${escapeHtml(accountTitle)}">
      <div class="account-avatar">${escapeHtml(firstName.slice(0, 1).toLocaleUpperCase('pt-BR') || 'A')}</div>
      <div class="account-copy"><strong>${escapeHtml(greeting)}</strong><small>${escapeHtml(userRoleLabel(user))}</small></div>
      <button class="account-logout" type="button">Sair</button>
    </div>`;
  }

  function logout() {
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (auth?.logout) auth.logout();
    location.href = routeUrl('/login/');
  }

  function useUnifiedToolTopbar() {
    const page = currentPage();
    if (page === 'login.html') return false;
    if (document.body.classList.contains('georural-map-page')) return false;
    return page !== 'mapa.html';
  }

  function topbarToolGroups() {
    const items = [
      { url: routeUrl('/consulta-car/'), icon: 'consulta-car', label: 'Consulta Pública CAR', desc: 'Pesquisa em dados públicos do CAR.' },
      { url: routeUrl('/car/'), icon: 'car', label: 'Módulo CAR', desc: 'Ambiental e validação.', permission: 'car:access' },
      { url: routeUrl('/memorial/'), icon: 'memorial', label: 'Memorial descritivo', desc: 'Peça técnica editável.', permission: 'documents:memorial' },
      { url: routeUrl('/confrontacao/'), icon: 'confrontacao', label: 'Cartas de confrontação', desc: 'Anuência e confrontantes.', permission: 'documents:confrontacao' },
      { url: routeUrl('/ods/'), icon: 'ods', label: 'Planilha ODS', desc: 'Planilhas e dados.', permission: 'documents:ods' },
      { url: routeUrl('/mapas/'), icon: 'mapas', label: 'Mapas e croquis', desc: 'Plantas e croquis.', permission: 'documents:mapas' },
      { url: routeUrl('/pranchas/'), icon: 'pranchas', label: 'Pranchas técnicas', desc: 'Pranchas profissionais.', permission: 'documents:pranchas' },
      { url: routeUrl('/central-lotes/'), icon: 'loteamentos', label: 'Central de Lotes', desc: 'Gerar peças por lote em ZIP.', permission: 'projects:export-zip' },
      { url: routeUrl('/planialtimetria/'), icon: 'planialtimetria', label: 'Planialtimetria / MDT', desc: 'Altimetria e curvas.', permission: 'documents:planialtimetria' },
      { url: routeUrl('/perimetros/'), icon: 'perimetros', label: 'Perímetros por azimute', desc: 'Azimutes e distâncias.', permission: 'documents:perimetros' },
      { url: routeUrl('/ambiental/'), icon: 'ambiental', label: 'Relatório ambiental', desc: 'APP, RL e áreas.', permission: 'ambiental:access' },
      { url: routeUrl('/loteamentos-reurb/'), icon: 'loteamentos', label: 'Loteamentos / REURB', desc: 'Regularização e lotes.', permission: 'loteamentos:access' },
      { url: routeUrl('/customizacao/'), icon: 'customizacao', label: 'Personalização', desc: 'Identidade e modelos próprios.', permission: 'company:settings' },
      { url: routeUrl('/admin/'), icon: 'admin', label: 'Administração', desc: 'Usuários e avisos.', permission: 'admin:dashboard' }
    ];
    return [
      { title: '', items: items.slice(0, 5) },
      { title: '', items: items.slice(5, 10) },
      { title: '', items: items.slice(10) }
    ];
  }

  function topbarQuickLinks() {
    return [
      { url: routeUrl('/mapa/'), label: 'Mapa', icon: 'map', permission: 'map:access' },
      { url: routeUrl('/nuvem/'), label: 'Projetos', icon: 'projects', permission: 'cloud:access' },
      { url: routeUrl('/acervos/'), label: 'Acervos oficiais', icon: 'archives', permission: 'layers:official' },
      { url: routeUrl('/cursos/'), label: 'Cursos', icon: 'courses' },
      { url: routeUrl('/suporte/'), label: 'Suporte', icon: 'support' }
    ].filter((item) => canAccessPermission(item.permission, authUser()));
  }

  function retireLegacySidebar(side) {
    if (!side) return;
    side.hidden = true;
    side.setAttribute('aria-hidden', 'true');
    side.classList.add('legacy-sidebar-retired');
    side.style.setProperty('display', 'none', 'important');
  }

  function buildSidebar(side) {
    if (!side || side.dataset.workspaceRebuilt === 'v21.9.240') return;
    const page = currentPage();
    const route = currentRoute();
    const user = authUser();
    const nav = pagesForUser(user).map((item) => {
      const active = route === item.url || location.pathname === item.url || routeUrl(stripDeployBase(location.pathname)) === item.url;
      return `<a class="${active ? 'active' : ''}" href="${item.url}" data-search-label="${escapeHtml(item.label)}" data-group="${item.group}"><span class="nav-icon nav-icon-image">${moduleIcon(item.icon, item.label)}</span><span>${escapeHtml(item.label)}</span></a>`;
    }).join('');
    side.id = side.id || 'side';
    side.classList.add('workspace-sidebar');
    side.innerHTML = `
      <div class="workspace-brand">
        <a href="${routeUrl('/')}" aria-label="Dashboard Surveyor">${logoImg()}<span><strong>Surveyor</strong><small>Georreferenciamento e Agrimensura</small></span></a>
      </div>
      <div class="workspace-new"><a href="${routeUrl('/mapa/')}" class="workspace-new-project">+ Novo projeto</a></div>
      <nav class="nav workspace-nav" aria-label="Navegação principal">${nav}</nav>
      <a class="workspace-about-link" href="${routeUrl('/sobre/')}" aria-label="Abrir página Sobre">
        <span class="workspace-about-icon">i</span>
        <span><strong>Sobre</strong><small>Projeto, criador e suporte</small></span>
      </a>
      <div class="workspace-sidebar-footer"><a href="${routeUrl('/suporte/')}"><span>?</span>Suporte</a><a href="${routeUrl('/privacidade/')}">Privacidade</a><a href="${routeUrl('/termos/')}">Termos</a></div>`;
    side.dataset.workspaceRebuilt = 'v21.9.240';
  }

  function buildTopbar() {
    document.querySelectorAll('.sv-pro-topbar').forEach((node) => node.remove());
    const topbar = document.createElement('header');
    const user = authUser();
    if (currentPage() === 'admin.html') {
      topbar.className = 'workspace-topbar sv-pro-topbar sv-admin-only-topbar';
      topbar.innerHTML = `
        <div class="sv-home-brand"><a href="${routeUrl('/admin/')}" aria-label="Administração Surveyor">${iconImg()}<span><strong>Surveyor</strong><small>Administração</small></span></a></div>
        <nav class="sv-home-nav sv-admin-only-nav" aria-label="Navegação administrativa">
          <a href="${routeUrl('/admin/')}" class="active">Administração</a>
          <a href="${routeUrl('/')}">Voltar ao Surveyor</a>
        </nav>
        <div class="workspace-topbar-actions sv-pro-topbar-actions" aria-label="Conta do administrador">${accountMarkup(user)}</div>`;
      document.body.prepend(topbar);
      topbar.querySelector('.account-logout')?.addEventListener('click', logout);
      return;
    }
    if (useUnifiedToolTopbar()) {
      topbar.className = 'workspace-topbar sv-pro-topbar sv-home-topbar';
      const groups = topbarToolGroups().map((group) => ({
        ...group,
        items: isAdminUser(user) ? group.items : group.items.filter((item) => item.url !== routeUrl('/admin/'))
      }));
      const quickLinks = topbarQuickLinks();
      const isHome = currentPage() === 'index.html';
      const brandMarkup = isHome
        ? `<div class="sv-home-brand sv-wordmark-brand"><a href="${routeUrl('/')}" aria-label="Surveyor início"><img class="sv-wordmark-image" src="${assetUrl('/assets/nome.png')}" alt="SURVEYOR"></a></div>`
        : `<div class="sv-home-brand sv-compact-brand"><a href="${routeUrl('/')}" aria-label="Surveyor início">${iconImg()}<span class="sv-compact-brand-copy"><strong>Surveyor</strong><small>Georreferenciamento e Agrimensura</small></span></a></div>`;
      topbar.innerHTML = `
        ${brandMarkup}
        <nav class="sv-home-nav sv-compact-nav" aria-label="Navegação superior">
          <button class="sv-home-tools-btn sv-compact-nav-item" type="button" aria-expanded="false" aria-controls="svHomeToolsMenu" title="Ferramentas">${topbarIcon('tools')}<span class="sv-compact-nav-label">Ferramentas</span><span class="tools-chevron" aria-hidden="true">⌄</span></button>
          ${quickLinks.map((item) => `<a href="${escapeHtml(item.url)}" class="sv-compact-nav-item ${currentRoute() === item.url ? 'active' : ''}" title="${escapeHtml(item.label)}">${topbarIcon(item.icon)}<span class="sv-compact-nav-label">${escapeHtml(item.label)}</span></a>`).join('')}
        </nav>
        <div class="workspace-topbar-actions sv-pro-topbar-actions" aria-label="Conta do usuário">${pwaInstallButtonMarkup()}${accountMarkup(user)}</div>
        <div id="svHomeToolsMenu" class="sv-home-tools-menu hidden" role="menu" aria-hidden="true">
          ${groups.map((group) => { const items = group.items.filter((item) => canAccessPermission(item.permission, authUser())); return items.length ? `<section>${group.title ? `<h3>${escapeHtml(group.title)}</h3>` : ''}${items.map((item) => `<a href="${escapeHtml(item.url)}" role="menuitem"><span class="tool-icon">${moduleIcon(item.icon, item.label)}</span><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.desc)}</small></span></a>`).join('')}</section>` : ''; }).join('')}
        </div>`;
      document.body.prepend(topbar);
      topbar.querySelector('.account-logout')?.addEventListener('click', logout);
      bindPwaInstallButtons(topbar);
      const button = topbar.querySelector('.sv-home-tools-btn');
      const menu = topbar.querySelector('#svHomeToolsMenu');
      const closeMenu = () => { menu?.classList.add('hidden'); menu?.setAttribute('aria-hidden', 'true'); button?.setAttribute('aria-expanded', 'false'); };
      button?.addEventListener('click', (event) => {
        event.preventDefault();
        const open = menu?.classList.toggle('hidden') === false;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu?.setAttribute('aria-hidden', open ? 'false' : 'true');
      });
      document.addEventListener('click', (event) => {
        if (!menu || menu.classList.contains('hidden')) return;
        if (!topbar.contains(event.target)) closeMenu();
      });
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
      return;
    }
    topbar.className = 'workspace-topbar sv-pro-topbar';
    topbar.innerHTML = `
      <div class="workspace-search" role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"></path></svg>
        <input id="svProGlobalSearch" type="search" autocomplete="off" placeholder="Buscar coordenadas, projetos ou registros..." aria-label="Busca global">
        <div id="svProSearchResults" class="workspace-search-results sv-pro-search-results hidden" role="listbox"></div>
      </div>
      <div class="workspace-topbar-actions sv-pro-topbar-actions" aria-label="Conta do usuário">
        ${pwaInstallButtonMarkup()}${accountMarkup(user)}
      </div>`;
    document.body.prepend(topbar);
    topbar.querySelector('.account-logout')?.addEventListener('click', logout);
    bindPwaInstallButtons(topbar);
  }

  function normalizePageHeader() {
    const top = document.querySelector('.top');
    if (!top) return;
    top.classList.add('workspace-page-head');
    top.querySelectorAll('.mobile-toggle').forEach((button) => button.remove());
    const title = top.querySelector('h1');
    if (title) {
      const raw = title.textContent.trim().toLowerCase();
      if (raw === 'dashboard' || raw === 'visão geral') title.textContent = 'Painel inicial';
    }
    const desc = top.querySelector('p');
    if (desc && /welcome back|unified command center/i.test(desc.textContent || '')) {
      desc.textContent = 'Bem-vindo. Acesse suas ferramentas essenciais de georreferenciamento, cadastro e documentos técnicos.';
    }
    let actions = top.querySelector('.top-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'top-actions';
      top.appendChild(actions);
    }
    // A área de ações do cabeçalho deve ter apenas ações da página. Usuário e notificações ficam na topbar global.
    actions.querySelectorAll('.workspace-user-card,.account-zone,.notification-center').forEach((node) => node.remove());
    actions.querySelectorAll('a,button').forEach((node) => {
      const text = node.textContent || '';
      if (/new project/i.test(text)) node.textContent = '+ Novo projeto';
      if (currentPage() === 'index.html' && /novo projeto|new project/i.test(text)) node.remove();
    });
    if (currentPage() === 'index.html' && !actions.children.length) actions.remove();
  }

  function setupSearch() {
    const input = document.getElementById('svProGlobalSearch');
    const results = document.getElementById('svProSearchResults');
    if (!input || !results || input.dataset.workspaceBound === '1') return;
    input.dataset.workspaceBound = '1';
    const navItems = pagesForUser(authUser()).map((item) => ({ url: item.url, label: item.label, type: 'Módulo' }));
    let projects = [];

    const loadProjects = async () => {
      if (projects.length) return projects;
      try {
        if (window.GeoRuralProjects?.list) {
          const list = await window.GeoRuralProjects.list({ full: false, refresh: false });
          projects = (Array.isArray(list) ? list : []).map((p) => ({
            url: `/mapa/?project=${encodeURIComponent(p.id || '')}`,
            label: p.title || p.name || p.propertyName || 'Projeto sem nome',
            type: 'Projeto',
            meta: [p.city || p.municipality, p.uf || p.stateCode].filter(Boolean).join('/')
          }));
        }
      } catch { projects = []; }
      return projects;
    };

    const render = async () => {
      const query = input.value.trim().toLowerCase();
      if (!query) { results.classList.add('hidden'); results.innerHTML = ''; return; }
      const all = navItems.concat(await loadProjects());
      const found = all.filter((item) => `${item.label} ${item.type} ${item.meta || ''}`.toLowerCase().includes(query)).slice(0, 8);
      results.innerHTML = found.length ? found.map((item) => `
        <a href="${escapeHtml(item.url)}" role="option">
          <span>${escapeHtml(item.type)}</span>
          <b>${escapeHtml(item.label)}</b>
          ${item.meta ? `<small>${escapeHtml(item.meta)}</small>` : ''}
        </a>`).join('') : '<p>Nenhum resultado encontrado.</p>';
      results.classList.remove('hidden');
    };

    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const first = results.querySelector('a');
        if (first) { event.preventDefault(); first.click(); }
      }
      if (event.key === 'Escape') results.classList.add('hidden');
    });
    document.addEventListener('click', (event) => {
      if (!results.contains(event.target) && event.target !== input) results.classList.add('hidden');
    });
  }

  function cleanupWorkspaceHeader() {
    if (!document.body.classList.contains('workspace-shell-v131')) return;
    const topbarActions = document.querySelector('.sv-pro-topbar-actions');
    if (topbarActions) {
      topbarActions.querySelectorAll('.workspace-icon-btn,.workspace-admin-pill').forEach((node) => node.remove());
      const pageAccount = document.querySelector('.workspace-page-head .account-zone,.top .account-zone');
      const topbarAccount = topbarActions.querySelector('.account-zone');
      if (pageAccount && !topbarAccount) {
        pageAccount.classList.add('workspace-topbar-account');
        pageAccount.dataset.workspaceAccount = '1';
        topbarActions.append(pageAccount);
        pageAccount.querySelector('.account-logout')?.addEventListener('click', logout);
      } else if (pageAccount && topbarAccount && pageAccount !== topbarAccount) {
        pageAccount.remove();
      }
    }
    if (useUnifiedToolTopbar()) {
      const actions = document.querySelector('.workspace-page-head .top-actions,.top .top-actions');
      actions?.querySelectorAll('a,button').forEach((node) => {
        if (/novo projeto|new project/i.test(node.textContent || '')) node.remove();
      });
      if (actions && !actions.children.length) actions.remove();
    }
  }

  function observeWorkspaceHeader() {
    cleanupWorkspaceHeader();
    if (document.body.dataset.workspaceHeaderObserver === '1') return;
    document.body.dataset.workspaceHeaderObserver = '1';
    const observer = new MutationObserver(() => cleanupWorkspaceHeader());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function renderUsageFooter(usage = null) {
    // A franquia diária deixou de ocupar a página. O estado fica disponível
    // para o menu da conta e para qualquer componente que precise refletir o
    // consumo atual sem criar barras flutuantes ou rodapés extras.
    document.getElementById('svPlanUsageFooter')?.remove();
    window.__surveyorDailyUsage = usage || null;
    window.dispatchEvent(new CustomEvent('surveyor:usage-rendered', { detail: usage || null }));
  }

  async function setupUsageFooter() {
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    document.getElementById('svPlanUsageFooter')?.remove();
    if (!auth?.loadUsageStatus || !authUser()) return;
    try { renderUsageFooter(await auth.loadUsageStatus()); }
    catch { renderUsageFooter(null); }
    if (window.__surveyorUsageFooterBound) return;
    window.__surveyorUsageFooterBound = true;
    window.addEventListener('surveyor:usage-updated', (event) => renderUsageFooter(event.detail || null));
  }

  function setupHelp() {
    document.querySelector('.sv-pro-help')?.addEventListener('click', () => {
      window.SurveyorToast?.('Use a busca para abrir módulos, projetos ou registros. A navegação lateral concentra todas as ferramentas.', 'info');
    });
  }

  function applyPermissionVisibility(root = document) {
    root.querySelectorAll('[data-permission],[data-requires-permission]').forEach((node) => {
      const permission = node.getAttribute('data-permission') || node.getAttribute('data-requires-permission');
      const allowed = canAccessPermission(permission, authUser());
      node.hidden = !allowed;
      node.classList.toggle('permission-hidden', !allowed);
      if (!allowed) node.setAttribute('aria-hidden', 'true');
      else node.removeAttribute('aria-hidden');
    });
  }

  function refreshPermissionUi() {
    guardCurrentRoute(authUser());
    document.querySelectorAll('.sv-pro-topbar').forEach((node) => node.remove());
    const side = document.getElementById('side') || document.querySelector('.side');
    if (side) delete side.dataset.workspaceRebuilt;
    const mapNav = document.querySelector('.map-global-nav .nav');
    if (mapNav) delete mapNav.dataset.workspaceRebuilt;
    if (document.body.classList.contains('georural-map-page')) {
      bootMapSidebar();
    } else {
      if (useUnifiedToolTopbar()) retireLegacySidebar(side);
      else buildSidebar(side);
      buildTopbar();
      setupSearch();
    }
    applyPermissionVisibility();
  }

  function bootMapSidebar() {
    const nav = document.querySelector('.map-global-nav .nav');
    if (!nav || nav.dataset.workspaceRebuilt === 'v21.9.240') return;
    nav.innerHTML = pagesForUser(authUser()).map((item) => `<a class="${currentPage() === item.url ? 'active' : ''}" href="${item.url}"><span class="nav-icon nav-icon-image">${moduleIcon(item.icon, item.label)}</span><span>${escapeHtml(item.label)}</span></a>`).join('');
    nav.dataset.workspaceRebuilt = 'v21.9.240';
    const brand = document.querySelector('.map-global-nav .brand');
    if (brand) brand.innerHTML = `<a class="sv-map-brand-wordmark" href="${routeUrl('/')}" aria-label="Surveyor, página inicial"><img src="${assetUrl('/assets/nome.png')}" alt="SURVEYOR"></a><button id="mapGlobalNavClose" class="map-global-nav-close" type="button" aria-label="Fechar menu">×</button>`;
  }

  function boot() {
    installToastBridge();
    guardCurrentRoute(authUser());
    const page = currentPage();
    if (page === 'login.html') return;
    loadOnboardingAssets();
    if (document.body.classList.contains('georural-map-page')) {
      document.body.classList.add('workspace-map-v131');
      bootMapSidebar();
      applyPermissionVisibility();
      setupUsageFooter();
      const auth = window.GeoRuralAuth || window.SurveyorAuth;
      auth?.ensureSession?.().then((valid) => { if (valid) refreshPermissionUi(); }).catch(() => {});
      return;
    }
    document.body.classList.remove('surveyor-shell-pro');
    document.body.classList.add('workspace-shell-v131');
    document.body.dataset.workspaceDesign = 'v21.9.240';
    if (page === 'index.html') document.body.classList.add('sv-dashboard-page');
    if (useUnifiedToolTopbar()) document.body.classList.add('sv-toolmenu-page');
    const suite = document.querySelector('.suite');
    const side = document.getElementById('side') || document.querySelector('.side');
    const main = document.querySelector('.main');
    suite?.classList.add('workspace-suite');
    main?.classList.add('workspace-main');
    if (useUnifiedToolTopbar()) retireLegacySidebar(side);
    else buildSidebar(side);
    buildTopbar();
    normalizePageHeader();
    setupSearch();
    applyPermissionVisibility();
    setupUsageFooter();
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    auth?.ensureSession?.().then((valid) => { if (valid) refreshPermissionUi(); }).catch(() => {});
    setupHelp();
    observeWorkspaceHeader();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
