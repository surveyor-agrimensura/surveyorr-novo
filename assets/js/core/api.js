(() => {
  'use strict';

  const ENDPOINTS = Object.freeze({
    api: 'https://api.surveyorr.com.br',
    save: 'https://6a7bce66000fc9c90d88.nyc.appwrite.run',
    support: 'https://6a46d3d0003091f98222.nyc.appwrite.run',
    geoservices: 'https://tiny-king-d719georural-geoservices.kaualucasfrancasantos.workers.dev',
    consultas: 'https://surveyorapiconsultas.kaualucasfrancasantos.workers.dev'
  });
  const appVersion = '1.0.0-rc.185.74';
  const PRIMARY_SITE_URL = 'https://surveyorr.com.br';
  const LEGACY_SITE_URL = 'https://surveyoragrimensura.tech';

  const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');
  const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);
  const isLocalDevelopment = localHostnames.has(String(window.location.hostname || '').toLowerCase());

  function endpointHost(value) {
    try {
      const parsed = new URL(normalizeUrl(value));
      if (parsed.protocol !== 'https:' && !(isLocalDevelopment && parsed.protocol === 'http:')) return '';
      return parsed.hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  function localDevelopmentOverride({ queryNames, storageKey, allowedHosts, allowedHostSuffixes = [], persist = true }) {
    if (!isLocalDevelopment) return '';
    try {
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = queryNames.map((name) => params.get(name)).find(Boolean) || '';
      const fromStorage = persist ? (localStorage.getItem(storageKey) || '') : '';
      const candidate = normalizeUrl(fromQuery || fromStorage);
      if (!candidate) {
        if (!persist) localStorage.removeItem(storageKey);
        return '';
      }
      const host = endpointHost(candidate);
      if (!host || (!allowedHosts.has(host) && !allowedHostSuffixes.some((suffix) => host.endsWith(String(suffix || '').toLowerCase())))) {
        localStorage.removeItem(storageKey);
        return '';
      }
      if (persist) localStorage.setItem(storageKey, candidate);
      else localStorage.removeItem(storageKey);
      return candidate;
    } catch {
      return '';
    }
  }

  // Remove os overrides antigos e inseguros em qualquer acesso de produção.
  if (!isLocalDevelopment) {
    try {
      [
        'GEORURAL_API_URL_OVERRIDE',
        'SURVEYOR_SUPPORT_API_URL_OVERRIDE',
        'SURVEYOR_DEV_SAVE_API_URL',
        'GEORURAL_GEOSERVICES_URL_OVERRIDE',
        'GEORURAL_WMS_PROXY_URL',
        'GEORURAL_FORCE_WFS_GEOBAHIA',
        'SURVEYOR_DEV_CONSULTAS_API_URL'
      ].forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage indisponível não altera os endpoints fixos de produção.
    }
  }

  // A API principal não deve ficar presa a um override antigo do navegador.
  // Em localhost, o padrão continua sendo a API oficial. Um endpoint alternativo
  // só vale para a navegação atual quando informado explicitamente na URL.
  try {
    if (isLocalDevelopment) {
      const params = new URLSearchParams(window.location.search || '');
      const hasExplicitApiOverride = ['apiBaseUrl', 'api'].some((name) => Boolean(params.get(name)));
      if (!hasExplicitApiOverride) {
        localStorage.removeItem('SURVEYOR_DEV_API_URL');
        localStorage.removeItem('GEORURAL_API_URL_OVERRIDE');
      }
    }
  } catch {
    // Falha de storage não impede o uso do endpoint oficial.
  }

  const apiBaseUrl = normalizeUrl(localDevelopmentOverride({
    queryNames: ['apiBaseUrl', 'api'],
    storageKey: 'SURVEYOR_DEV_API_URL',
    allowedHosts: new Set([endpointHost(ENDPOINTS.api), 'localhost', '127.0.0.1']),
    persist: false
  }) || ENDPOINTS.api);

  const saveApiBaseUrl = normalizeUrl(localDevelopmentOverride({
    queryNames: ['saveApiBaseUrl', 'saveApi'],
    storageKey: 'SURVEYOR_DEV_SAVE_API_URL',
    allowedHosts: new Set([endpointHost(ENDPOINTS.save), 'localhost', '127.0.0.1']),
    allowedHostSuffixes: ['.appwrite.run', '.appwrite.network']
  }) || ENDPOINTS.save);

  const supportApiBaseUrl = normalizeUrl(localDevelopmentOverride({
    queryNames: ['supportBaseUrl', 'supportApiUrl', 'support'],
    storageKey: 'SURVEYOR_DEV_SUPPORT_API_URL',
    allowedHosts: new Set([endpointHost(ENDPOINTS.support), 'localhost', '127.0.0.1'])
  }) || ENDPOINTS.support);

  const geoservicesBaseUrl = normalizeUrl(localDevelopmentOverride({
    queryNames: ['geoBaseUrl', 'geoservicesBaseUrl', 'wmsProxyBaseUrl'],
    storageKey: 'SURVEYOR_DEV_GEOSERVICES_URL',
    allowedHosts: new Set([endpointHost(ENDPOINTS.geoservices), 'localhost', '127.0.0.1'])
  }) || ENDPOINTS.geoservices);

  const consultasApiBaseUrl = normalizeUrl(localDevelopmentOverride({
    queryNames: ['consultasBaseUrl', 'consultasApiUrl', 'consultas'],
    storageKey: 'SURVEYOR_DEV_CONSULTAS_API_URL',
    allowedHosts: new Set([endpointHost(ENDPOINTS.consultas), 'localhost', '127.0.0.1']),
    allowedHostSuffixes: ['.workers.dev']
  }) || ENDPOINTS.consultas);
  function secureGeoservicesUrl(value) {
    return String(value || '').trim();
  }

  window.GEORURAL_SECURE_GEOSERVICES_URL = secureGeoservicesUrl;

  window.GEORURAL_API_URL = apiBaseUrl;
  window.GEORURAL_WMS_PROXY_URL = geoservicesBaseUrl;
  window.GEORURAL_GEOSERVICES_URL = geoservicesBaseUrl;
  window.SURVEYOR_CONSULTAS_API_URL = consultasApiBaseUrl;

  window.GEORURAL_CONFIG = Object.freeze({
    appVersion,
    mode: isLocalDevelopment ? 'development' : 'production',
    apiBaseUrl,
    saveApiBaseUrl,
    remoteApiBaseUrl: apiBaseUrl,
    wmsProxyBaseUrl: geoservicesBaseUrl,
    geoservicesBaseUrl,
    consultasApiBaseUrl,
    supportApiBaseUrl,
    localProxyEnabled: false,
    authEndpoint: '/api/auth',
    projectsEndpoint: '/api/projects',
    documentsEndpoint: '/api/documents',
    layersEndpoint: '/api/layers',
    adminEndpoint: '/api/admin',
    customizationEndpoint: '/api/customization',
    publicEndpoint: '/api/public',
    wmsProxyEndpoint: '/wms-url',
    storageProvider: 'appwrite-storage',
    databaseProvider: 'appwrite-database',
    apiProvider: 'appwrite-functions',
    supportProvider: 'appwrite-functions',
    frontendProvider: 'github-pages',
    primarySiteUrl: PRIMARY_SITE_URL,
    legacySiteUrl: LEGACY_SITE_URL,
    geoservicesProvider: 'cloudflare-worker',
    consultasProvider: 'cloudflare-worker-r2',
    paymentProvider: 'cloudflare-worker',
    geoservicesColo: 'GRU',
    preferGeobahiaWfs: false,
    // O Worker Cloudflare permanece primário, mas a API oficial possui proxy
    // geográfico público allowlisted e atua como contingência quando o Worker
    // ou o upstream demorarem/ficarem indisponíveis.
    allowAppwriteGeoFallback: true,
    externalGeoRequests: 'cloudflare-worker-only'
  });

  console.info(`[Surveyor] v${appVersion}: endpoints de produção fixos e overrides permitidos somente em localhost.`);
})();
