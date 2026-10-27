(() => {
  'use strict';

  const state = { customization: null, loadedAt: 0 };

  function mergeCustomization(base = {}, extra = {}) {
    const merged = { ...(base || {}), ...(extra || {}) };
    if (base?.options || extra?.options) merged.options = { ...(base?.options || {}), ...(extra?.options || {}) };
    ['logoDataUrl','planDocumentSignatureDataUrl','baseTemplateContent'].forEach((field) => {
      if (!String(merged?.[field] || '').trim() && String(base?.[field] || '').trim()) merged[field] = base[field];
    });
    return merged;
  }

  async function loadCustomization(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh || options.noCache);
    const maxAge = Math.max(0, Number(options.maxAgeMs ?? 15_000));
    if (!forceRefresh && state.customization && (Date.now() - state.loadedAt) < maxAge) return { ...state.customization };

    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    const theme = window.GeoRuralDocumentTheme;
    let themeValue = theme?.get?.() || {};

    if (theme?.load) {
      try {
        await theme.load({ forceRefresh, noCache: forceRefresh });
        themeValue = theme.get?.() || themeValue;
      } catch (error) {
        console.warn('[documentos] Não foi possível atualizar o tema documental:', error);
      }
    }

    let remote = {};
    if (auth?.getDocumentCustomization) {
      try {
        remote = await auth.getDocumentCustomization({ forceRefresh, noCache: forceRefresh }) || {};
      } catch (error) {
        console.warn('[documentos] Personalização remota indisponível; usando a cópia já carregada:', error);
      }
    }

    const value = mergeCustomization(themeValue, remote);
    state.customization = value;
    state.loadedAt = Date.now();
    return { ...value, options: value.options ? { ...value.options } : {} };
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function toDataUrl(source, options = {}) {
    const value = String(source || '').trim();
    if (!value) return '';
    if (/^data:/i.test(value)) return value;
    if (/^blob:/i.test(value)) return value;

    const timeoutMs = Math.max(1000, Number(options.timeoutMs || 7000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL(value, location.href).href;
      const response = await fetch(url, { mode: 'cors', cache: options.cache || 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await blobToDataUrl(await response.blob());
    } catch (error) {
      console.warn('[documentos] Não foi possível incorporar a imagem ao documento:', value, error?.message || error);
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  function officialPublicOrigin() {
    try {
      const current = new URL(location.href);
      const host = String(current.hostname || '').toLowerCase();
      if (current.protocol === 'https:' && (host === 'surveyorr.com.br' || host.endsWith('.surveyorr.com.br'))) return current.origin;
    } catch {}
    return 'https://surveyorr.com.br';
  }



  const PUBLIC_LOCATION_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const PUBLIC_LOCATION_LENGTH = 10;

  function displayPublicLocationCode(value = '') {
    const code = String(value || '').toUpperCase().replace(/[^0-9A-HJKMNP-TV-Z]/g, '');
    return code.length === PUBLIC_LOCATION_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
  }

  function perimeterCentroid(ring = []) {
    if (!Array.isArray(ring) || ring.length < 3) return null;
    let twiceArea = 0;
    let cx = 0;
    let cy = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const [x1, y1] = ring[index];
      const [x2, y2] = ring[(index + 1) % ring.length];
      const cross = (x1 * y2) - (x2 * y1);
      twiceArea += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
    }
    if (Math.abs(twiceArea) > 1e-12) {
      const lng = cx / (3 * twiceArea);
      const lat = cy / (3 * twiceArea);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
    const valid = ring.filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (!valid.length) return null;
    const lng = valid.reduce((sum, point) => sum + point[0], 0) / valid.length;
    const lat = valid.reduce((sum, point) => sum + point[1], 0) / valid.length;
    return { lat, lng };
  }

  function encodePublicLocationCode(lat, lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return '';
    const max = (1n << 25n) - 1n;
    const latQ = BigInt(Math.max(0, Math.min(Number(max), Math.round(((latitude + 90) / 180) * Number(max)))));
    const lngQ = BigInt(Math.max(0, Math.min(Number(max), Math.round(((longitude + 180) / 360) * Number(max)))));
    let value = (latQ << 25n) | lngQ;
    let code = '';
    for (let index = 0; index < PUBLIC_LOCATION_LENGTH; index += 1) {
      code = PUBLIC_LOCATION_ALPHABET[Number(value & 31n)] + code;
      value >>= 5n;
    }
    return code;
  }

  function publicLocationShortUrl(project = {}) {
    const ring = perimeterRingFromProject(project);
    const center = perimeterCentroid(ring);
    if (!center) return '';
    const code = encodePublicLocationCode(center.lat, center.lng);
    if (!code) return '';
    return `${officialPublicOrigin()}/p/?l=${encodeURIComponent(displayPublicLocationCode(code))}`;
  }

  function base36Int(value) {
    const n = Math.trunc(Number(value) || 0);
    return n < 0 ? `-${Math.abs(n).toString(36)}` : n.toString(36);
  }

  function perimeterRingFromProject(project = {}) {
    const normalizeRing = (ring) => {
      if (!Array.isArray(ring)) return [];
      const points = ring
        .filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
        .map((point) => [Number(point[0]), Number(point[1])]);
      if (points.length > 1) {
        const a = points[0];
        const b = points[points.length - 1];
        if (a[0] === b[0] && a[1] === b[1]) points.pop();
      }
      return points.length >= 3 ? points : [];
    };
    const geometryRing = (geometry) => {
      if (!geometry || typeof geometry !== 'object') return [];
      if (geometry.type === 'Polygon') return normalizeRing(geometry.coordinates?.[0]);
      if (geometry.type === 'MultiPolygon') {
        const rings = (geometry.coordinates || []).map((polygon) => normalizeRing(polygon?.[0])).filter((ring) => ring.length);
        return rings.sort((a, b) => b.length - a.length)[0] || [];
      }
      return [];
    };
    try {
      const resolved = globalThis.SurveyorProjectGeometry?.resolvePerimeter?.(project);
      const ring = geometryRing(resolved?.geometry || resolved?.geoJson || resolved);
      if (ring.length) return ring;
    } catch {}
    const collections = [
      project?.geojson?.features, project?.geoJson?.features, project?.features, project?.metadata?.features
    ];
    const candidates = [];
    for (const list of collections) {
      if (!Array.isArray(list)) continue;
      for (const feature of list) {
        const ring = geometryRing(feature?.geometry || feature?.geoJson);
        if (ring.length) candidates.push(ring);
      }
    }
    return candidates.sort((a, b) => b.length - a.length)[0] || [];
  }

  function publicSnapshotUrl(project = {}) {
    const ring = perimeterRingFromProject(project);
    if (ring.length < 3) return '';
    const scale = 1e6;
    let previous = null;
    const encoded = ring.map(([lng, lat]) => {
      const x = Math.round(lng * scale);
      const y = Math.round(lat * scale);
      const pair = previous
        ? `${base36Int(x - previous[0])}~${base36Int(y - previous[1])}`
        : `${base36Int(x)}~${base36Int(y)}`;
      previous = [x, y];
      return pair;
    }).join('.');
    const params = new URLSearchParams();
    params.set('snapshot', `v1:${encoded}`);
    const title = String(project?.title || project?.propertyName || project?.name || 'Imóvel').trim();
    const city = String(project?.city || project?.municipality || '').trim();
    const uf = String(project?.uf || project?.stateCode || '').trim();
    if (title) params.set('name', title.slice(0, 120));
    if (city) params.set('city', city.slice(0, 80));
    if (uf) params.set('uf', uf.slice(0, 12));
    return `${officialPublicOrigin()}/public-project/#${params.toString()}`;
  }

  function publicUrlFromShare(share = {}) {
    const direct = String(share?.shortUrl || share?.publicUrl || share?.url || '').trim();
    if (direct) {
      try { return new URL(direct, `${officialPublicOrigin()}/`).href; }
      catch {}
    }
    const token = String(share?.token || '').trim();
    if (!token) return '';
    return `${officialPublicOrigin()}/public-project/#token=${encodeURIComponent(token)}`;
  }

  async function publicProjectAccess(projectOrId, options = {}) {
    const project = projectOrId && typeof projectOrId === 'object' ? projectOrId : (options.project || null);
    const id = String(project?.id || projectOrId || '').trim();
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (!id) return { url: '', qr: '', active: false, reason: 'PROJECT_ID_MISSING' };
    const qrLib = window.GeoRuralQR || window.QRCode;

    const makeQr = async (url) => {
      if (!url || !qrLib?.toDataURL) return '';
      try {
        return String(await qrLib.toDataURL(url, {
          width: Math.max(120, Number(options.qrSize || 260)),
          margin: 1,
          errorCorrectionLevel: 'M'
        }) || '');
      } catch (error) {
        console.warn('[documentos] Falha ao desenhar QR Code:', error);
        return '';
      }
    };

    // Documentos oficiais usam SEMPRE o link curto persistente como primeira fonte.
    // O compartilhamento legado continua existindo para compatibilidade do portal,
    // mas nunca deve voltar a imprimir token ou snapshot extenso na prancha.
    if (id && typeof auth?.ensureProjectPublicShort === 'function') {
      try {
        const short = await auth.ensureProjectPublicShort(id);
        const shortUrl = publicUrlFromShare(short);
        if (!shortUrl) throw new Error('O backend não retornou o link público curto do projeto.');
        const qr = await makeQr(shortUrl);
        if (!qr) throw new Error('Não foi possível desenhar o QR Code do link público curto.');
        return { url: shortUrl, qr, active: true, reason: 'PUBLIC_SHORT', publicShort: short };
      } catch (error) {
        const text = String(error?.message || error || '');
        if (/401|sess[aã]o|token|expir/i.test(text) && typeof auth.refreshSession === 'function') {
          try {
            await auth.refreshSession();
            const short = await auth.ensureProjectPublicShort(id);
            const shortUrl = publicUrlFromShare(short);
            if (shortUrl) {
              const qr = await makeQr(shortUrl);
              if (qr) return { url: shortUrl, qr, active: true, reason: 'PUBLIC_SHORT_REFRESHED', publicShort: short };
            }
          } catch {}
        }
        console.warn('[documentos] Link curto persistente indisponível; usando perímetro público incorporado no QR:', error?.message || error);
        const snapshotUrl = publicSnapshotUrl(project);
        if (snapshotUrl) {
          const qr = await makeQr(snapshotUrl);
          if (qr) return {
            url: snapshotUrl,
            qr,
            active: true,
            reason: 'PUBLIC_SNAPSHOT_FALLBACK',
            error: error?.message || String(error || '')
          };
        }
        const locationUrl = publicLocationShortUrl(project);
        if (locationUrl) {
          const qr = await makeQr(locationUrl);
          if (qr) return {
            url: locationUrl,
            qr,
            active: true,
            reason: 'PUBLIC_LOCATION_FALLBACK',
            error: error?.message || String(error || '')
          };
        }
        return {
          url: '',
          qr: '',
          active: false,
          reason: 'PUBLIC_SHORT_UNAVAILABLE',
          error: error?.message || String(error || '')
        };
      }
    }

    const snapshotUrl = publicSnapshotUrl(project);
    if (snapshotUrl) {
      const qr = await makeQr(snapshotUrl);
      if (qr) return { url: snapshotUrl, qr, active: true, reason: 'PUBLIC_SNAPSHOT_FALLBACK' };
    }
    const locationUrl = publicLocationShortUrl(project);
    if (locationUrl) {
      const qr = await makeQr(locationUrl);
      if (qr) return { url: locationUrl, qr, active: true, reason: 'PUBLIC_LOCATION_FALLBACK' };
    }
    return {
      url: '',
      qr: '',
      active: false,
      reason: id ? 'PUBLIC_SHORT_API_UNAVAILABLE' : 'PROJECT_ID_MISSING',
      error: id ? 'Cliente sem suporte ao link público curto.' : 'Projeto sem identificador persistido.'
    };
  }

  async function resolveLogo(customization = null, options = {}) {
    const custom = customization || await loadCustomization(options);
    const configured = String(custom?.logoDataUrl || '').trim();
    if (configured) {
      const embedded = await toDataUrl(configured, { timeoutMs: options.timeoutMs || 7000 });
      if (embedded) return embedded;
    }
    if (options.allowDefault === false) return '';
    return toDataUrl('/assets/logo.png', { timeoutMs: options.timeoutMs || 7000 });
  }


  async function resolveSignatureDataUrl(options = {}) {
    const theme = window.GeoRuralDocumentTheme;
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    const forceRefresh = Boolean(options.forceRefresh);
    const immediate = String(theme?.getSignature?.() || state.customization?.planDocumentSignatureDataUrl || '').trim();
    if (immediate && !forceRefresh) return immediate;

    // A assinatura precisa seguir o mesmo caminho usado pelo Memorial: a
    // personalização da conta é a fonte principal e o tema é apenas fallback.
    if (auth?.getDocumentCustomization) {
      try {
        const accountCustomization = await auth.getDocumentCustomization({ forceRefresh, noCache: forceRefresh }) || {};
        const accountSignature = String(accountCustomization?.planDocumentSignatureDataUrl || '').trim();
        if (accountSignature) {
          state.customization = mergeCustomization(state.customization || theme?.get?.() || {}, accountCustomization);
          state.loadedAt = Date.now();
          return accountSignature;
        }
      } catch (error) {
        console.warn('[documentos] Assinatura da conta indisponível; tentando tema/cache documental:', error);
      }
    }

    try {
      const custom = await loadCustomization({ forceRefresh, noCache: forceRefresh, maxAgeMs: forceRefresh ? 0 : 15000 });
      const value = String(custom?.planDocumentSignatureDataUrl || theme?.getSignature?.() || '').trim();
      if (value) return value;
    } catch (_error) {}
    return String(theme?.getSignature?.() || '').trim();
  }

  function clearCache() {
    state.customization = null;
    state.loadedAt = 0;
  }

  window.SurveyorDocumentAssets = Object.freeze({
    loadCustomization,
    toDataUrl,
    publicProjectAccess,
    publicSnapshotUrl,
    resolveLogo,
    resolveSignatureDataUrl,
    clearCache
  });
})();
