(() => {
  'use strict';

  const auth = window.GeoRuralAuth;
  const CACHE_KEY = 'surveyor-project-cloud-cache-v21-10-0';
  const DRAFT_PREFIX = 'surveyor-project-draft-v21-10-0:';
  const LIST_TTL_MS = 10 * 60_000;
  const FULL_TTL_MS = 5 * 60_000;
  const RECOVERY_DB_NAME = 'surveyor-recovery-v1';
  const RECOVERY_STORE = 'drafts';

  function openRecoveryDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(RECOVERY_DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(RECOVERY_STORE)) db.createObjectStore(RECOVERY_STORE, { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  async function putRecoveryDraft(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
    const db = await openRecoveryDb();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(RECOVERY_STORE, 'readwrite');
        tx.objectStore(RECOVERY_STORE).put({ key, ...value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch { resolve(); }
    });
    db.close();
  }

  async function deleteRecoveryDraft(key) {
    try { sessionStorage.removeItem(key); } catch {}
    const db = await openRecoveryDb();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(RECOVERY_STORE, 'readwrite');
        tx.objectStore(RECOVERY_STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch { resolve(); }
    });
    db.close();
  }

  async function listIndexedDrafts() {
    const db = await openRecoveryDb();
    if (!db) return [];
    const rows = await new Promise((resolve) => {
      try {
        const tx = db.transaction(RECOVERY_STORE, 'readonly');
        const request = tx.objectStore(RECOVERY_STORE).getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
    db.close();
    return rows;
  }

  const fullCache = new Map();
  const fullLoadedAt = new Map();
  const inFlightFull = new Map();
  let summaries = [];
  let summariesLoadedAt = 0;
  let inFlightList = null;
  let lastCacheWarningAt = 0;
  function notifyCloudCacheFallback(kind, projectId = '') {
    // Um cache descartável nunca pode ser confundido com confirmação remota.
    try {
      window.dispatchEvent(new CustomEvent('surveyor:projects-cache-fallback', {
        detail: { kind, projectId, source:'local-cache', remoteConfirmed:false }
      }));
      if (Date.now()-lastCacheWarningAt > 15000) {
        lastCacheWarningAt=Date.now();
        window.SurveyorToast?.('Não foi possível confirmar os dados na nuvem. Exibindo uma cópia local, que pode estar desatualizada.', 'warning');
      }
    } catch (_error) {}
  }

  function safeReadCache() {
    try {
      const data = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
      if (Array.isArray(data.summaries)) {
        summaries = data.summaries;
        summariesLoadedAt = Number(data.summariesLoadedAt || 0);
      }
      if (data.full && typeof data.full === 'object') {
        Object.entries(data.full).forEach(([id, entry]) => {
          if (!entry?.project) return;
          fullCache.set(id, entry.project);
          fullLoadedAt.set(id, Number(entry.loadedAt || 0));
        });
      }
    } catch {}
  }

  function persistCache() {
    try {
      const full = {};
      fullCache.forEach((project, id) => {
        full[id] = { project, loadedAt: fullLoadedAt.get(id) || Date.now() };
      });
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ summaries, summariesLoadedAt, full }));
    } catch {}
  }

  safeReadCache();

  function hasFreshList() {
    return summaries.length > 0 && Date.now() - summariesLoadedAt < LIST_TTL_MS;
  }

  function hasFreshFull(id) {
    return fullCache.has(id) && Date.now() - (fullLoadedAt.get(id) || 0) < FULL_TTL_MS;
  }

  function toLegacy(project, features = []) {
    const metadata = project?.metadata || {};
    return {
      id: project.id,
      title: project.propertyName || project.name || 'Projeto sem nome',
      name: project.name,
      owner: project.ownerName || '',
      city: project.municipality || '',
      uf: project.stateCode || '',
      registrationNumber: project.registrationNumber || '',
      status: project.status,
      areaHa: Number(project.areaHa || metadata.areaHa || metadata.areaHectares || 0) || 0,
      perimeterM: Number(project.perimeterM || metadata.perimeterM || metadata.perimeterMeters || 0) || 0,
      featureCount: Array.isArray(features) ? features.length : Number(metadata.featureCount || 0),
      metadata: { ...metadata, featureCount: Array.isArray(features) ? features.length : Number(metadata.featureCount || 0) },
      referenceLayers: metadata.referenceLayers || [],
      geojson: {
        type: 'FeatureCollection',
        features: (features || []).map((feature) => ({
          type: 'Feature',
          properties: { ...(feature.properties || {}), name: feature.name, category: feature.category, remoteFeatureId: feature.id },
          geometry: feature.geoJson
        })).filter((feature) => feature.geometry)
      },
      view: project.centerLatitude != null && project.centerLongitude != null
        ? { center: { lat: project.centerLatitude, lng: project.centerLongitude }, zoom: project.defaultZoom || 14 }
        : null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      revision: project.revision || project.updatedAt
    };
  }

  function mergeSummaryWithFull(project) {
    if (!project?.id) return;
    const index = summaries.findIndex((item) => item.id === project.id);
    const summary = {
      id: project.id,
      title: project.title || project.propertyName || project.name || 'Projeto sem nome',
      name: project.name,
      propertyName: project.propertyName || project.title,
      owner: project.owner || project.ownerName || '',
      ownerName: project.ownerName || project.owner || '',
      city: project.city || project.municipality || '',
      municipality: project.municipality || project.city || '',
      uf: project.uf || project.stateCode || '',
      stateCode: project.stateCode || project.uf || '',
      status: project.status,
      areaHa: Number(project.areaHa || project.metadata?.areaHa || 0) || 0,
      perimeterM: Number(project.perimeterM || project.metadata?.perimeterM || 0) || 0,
      featureCount: Number(project.featureCount || project.metadata?.featureCount || project.geojson?.features?.length || 0) || 0,
      metadata: { ...(project.metadata || {}), featureCount: Number(project.featureCount || project.metadata?.featureCount || project.geojson?.features?.length || 0) || 0 },
      updatedAt: project.updatedAt,
      createdAt: project.createdAt
    };
    if (index >= 0) summaries[index] = { ...summaries[index], ...summary };
    else summaries.unshift(summary);
  }

  async function list({ full = false, refresh = false, cacheOnly = false } = {}) {
    if (!auth?.listProjects) return [];
    if (cacheOnly) {
      if (!full) return summaries.slice();
      return summaries.map((summary) => fullCache.get(summary.id)).filter(Boolean);
    }
    const needsRemote = Boolean(refresh) || !hasFreshList();
    if (needsRemote) {
      if (!inFlightList) {
        inFlightList = auth.listProjects(refresh ? { forceRefresh: true, noCache: true } : {})
          .then((items) => {
            summaries = Array.isArray(items) ? items : [];
            summariesLoadedAt = Date.now();
            persistCache();
            return summaries;
          })
          .catch((error) => {
            if (summaries.length) {
              console.warn('[projetos] usando cache local após falha temporária:', error);
              notifyCloudCacheFallback('list');
              return summaries;
            }
            throw error;
          })
          .finally(() => { inFlightList = null; });
      }
      await inFlightList;
    }
    if (!full) return summaries;
    const results = [];
    for (const summary of summaries) {
      try {
        const project = await get(summary.id);
        if (project) results.push(project);
      } catch (error) {
        console.warn('[projetos] não foi possível carregar projeto completo:', summary.id, error);
      }
    }
    return results;
  }

  async function get(id, refresh = false) {
    if (!id || !auth?.getProject) return null;
    if (!refresh && hasFreshFull(id)) return fullCache.get(id);
    if (!refresh && fullCache.has(id) && !navigator.onLine) {
      notifyCloudCacheFallback('project',id);
      return fullCache.get(id);
    }
    if (!refresh && inFlightFull.has(id)) return inFlightFull.get(id);

    const request = auth.getProject(id, refresh ? { forceRefresh: true, noCache: true } : {})
      .then((data) => {
        if (!data?.project) return null;
        const value = toLegacy(data.project, data.features || []);
        fullCache.set(id, value);
        fullLoadedAt.set(id, Date.now());
        mergeSummaryWithFull(value);
        persistCache();
        return value;
      })
      .catch((error) => {
        if (fullCache.has(id)) {
          console.warn('[projetos] usando projeto do cache após falha temporária:', error);
          notifyCloudCacheFallback('project',id);
          return fullCache.get(id);
        }
        throw error;
      })
      .finally(() => { inFlightFull.delete(id); });

    inFlightFull.set(id, request);
    return request;
  }

  async function updateMetadata(projectId, metadataPatch = {}) {
    const id = String(projectId || '').trim();
    if (!id || !auth?.updateProject) return null;
    const save = async (refresh = false) => {
      const current = await get(id, refresh);
      if (!current) throw new Error('Projeto não encontrado para atualização dos dados compartilhados.');
      const currentMetadata = current.metadata && typeof current.metadata === 'object' ? current.metadata : {};
      const patch = metadataPatch && typeof metadataPatch === 'object' ? metadataPatch : {};
      const documentProfile = patch.documentProfile && typeof patch.documentProfile === 'object'
        ? { ...(currentMetadata.documentProfile || {}), ...patch.documentProfile }
        : currentMetadata.documentProfile;
      const metadata = { ...currentMetadata, ...patch, ...(documentProfile ? { documentProfile } : {}) };
      const updated = await auth.updateProject(id, { metadata, expectedUpdatedAt: current.revision || current.updatedAt || '' });
      invalidate(id);
      const fresh = await get(id, true).catch(() => null);
      return fresh || toLegacy(updated || {}, []);
    };
    try { return await save(false); }
    catch (error) {
      if (error?.status === 409 || error?.code === 409 || /conflit|revision|if-match/i.test(String(error?.message || ''))) return save(true);
      throw error;
    }
  }

  // A comparação é independente da ordem das chaves dos objetos; IDs e datas
  // criados pelo servidor não representam mudanças nos dados do usuário.
  function canonicalSaveValue(value) {
    if (Array.isArray(value)) return value.map(canonicalSaveValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalSaveValue(value[key])]));
    }
    return value;
  }

  function featureSignature(features = []) {
    return JSON.stringify((Array.isArray(features) ? features : []).map((feature, index) => canonicalSaveValue({
      name: String(feature?.name || '').slice(0, 240),
      category: String(feature?.category || ''),
      geometryType: String(feature?.geometryType || feature?.geoJson?.type || ''),
      geoJson: feature?.geoJson || {},
      style: feature?.style || {},
      properties: feature?.properties || {},
      sortOrder: Number(feature?.sortOrder ?? index) || 0,
      isVisible: feature?.isVisible !== false
    })));
  }

  // Metadata de sistema (versões/histórico) pode ser incluído pelo servidor.
  // Confirmamos as chaves transmitidas pelo cliente, inclusive dados cadastrais.
  function savedProjectMatches(actual, expected) {
    if (!actual || !expected) return false;
    const fields = ['name','propertyName','ownerName','municipality','stateCode','status'];
    if (fields.some((field) => String(actual[field] ?? '') !== String(expected[field] ?? ''))) return false;
    const remoteMetadata = actual.metadata && typeof actual.metadata === 'object' ? actual.metadata : {};
    const requestedMetadata = expected.metadata && typeof expected.metadata === 'object' ? expected.metadata : {};
    // Estes campos são gerenciados pelo servidor e mudam a cada gravação.
    // Não comparar valores herdados da revisão anterior como se fossem conteúdo editável.
    const serverManaged = new Set([
      'versions','secureshares','geojsonfileid','featurecount','createdbyuserid','createdbyname',
      'migratedfromstandaloneuserid','storageowneruserid','workspaceowneruserid',
      'lastsavedbyuserid','lastsavedbyname','lastsavedat','updatedbyuserid',
      'updatedbyname','projectlocked','projectlockedat','lockedbyuserid',
      'lockedat','restoredfromversionid','restoredat','restoredbyuserid',
      'duplicatedfrom','duplicatedat','duplicatedbyuserid','clientrequestid'
    ]);
    return Object.entries(requestedMetadata).every(([key, value]) =>
      serverManaged.has(key.toLowerCase()) ||
      JSON.stringify(canonicalSaveValue(remoteMetadata[key])) === JSON.stringify(canonicalSaveValue(value)));
  }

  async function verifySavedBundle(projectId, expectedFeatures = [], expectedProject = {}, attempts = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
      try {
        const remote = await auth.getProject(projectId, { forceRefresh: true, noCache: true });
        const actual = Array.isArray(remote?.features) ? remote.features : [];
        if (remote?.project?.id === projectId
          && actual.length === expectedFeatures.length
          && featureSignature(actual) === featureSignature(expectedFeatures)
          && savedProjectMatches(remote.project, expectedProject)) {
          return remote;
        }
        lastError = new Error('A confirmação do projeto divergiu dos dados enviados (atributos, personalização ou geometria).');
      } catch (error) {
        lastError = error;
      }
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
    }
    const error = new Error(lastError?.message || 'O projeto não pôde ser confirmado após o salvamento.');
    error.code = 'PROJECT_PERSISTENCE_NOT_VERIFIED';
    throw error;
  }

  async function saveLegacy(project) {
    const coords = project?.geojson?.features?.flatMap((feature) => {
      const geometry = feature.geometry || {};
      if (geometry.type === 'Point') return [geometry.coordinates];
      if (geometry.type === 'LineString') return geometry.coordinates || [];
      if (geometry.type === 'Polygon') return geometry.coordinates?.[0] || [];
      if (geometry.type === 'MultiPolygon') return geometry.coordinates?.flatMap((poly) => poly[0] || []) || [];
      return [];
    }) || [];
    const center = coords.length ? coords.reduce((acc, point) => [acc[0] + Number(point[0]), acc[1] + Number(point[1])], [0, 0]).map((value) => value / coords.length) : [null, null];
    const payload = {
      name: project.title || project.name || 'Projeto Surveyor',
      propertyName: project.title || project.name || null,
      ownerName: project.owner || null,
      registrationNumber: project.registrationNumber || null,
      municipality: project.city || null,
      stateCode: project.uf || 'BA',
      status: project.status || 'active',
      description: project.description || 'Projeto salvo pelo Surveyor.',
      centerLatitude: center[1],
      centerLongitude: center[0],
      defaultZoom: project.view?.zoom || 15,
      expectedUpdatedAt: project.revision || project.updatedAt || '',
      metadata: { ...(project.metadata || {}), source: project.metadata?.source || 'surveyor-suite', savedAt: new Date().toISOString() }
    };
    const featurePayloads = (project.geojson?.features || []).map((feature, index) => {
      let areaHectares = null;
      let perimeterMeters = null;
      let vertexCount = 0;
      try {
        if (window.turf && /Polygon/.test(feature.geometry?.type)) areaHectares = turf.area(feature) / 10000;
        const coords = feature.geometry?.type === 'Polygon'
          ? feature.geometry.coordinates?.[0] || []
          : feature.geometry?.type === 'LineString'
            ? feature.geometry.coordinates || []
            : feature.geometry?.type === 'Point'
              ? [feature.geometry.coordinates]
              : [];
        vertexCount = coords.length;
        if (window.turf && coords.length > 1) perimeterMeters = turf.length(turf.lineString(coords), { units: 'kilometers' }) * 1000;
      } catch {}
      return {
        name: feature.properties?.name || `Elemento ${index + 1}`,
        category: feature.properties?.category || 'outros',
        geometryType: feature.geometry?.type || 'Polygon',
        geoJson: feature.geometry,
        areaHectares,
        perimeterMeters,
        vertexCount,
        style: feature.properties?.style || {},
        properties: feature.properties || {},
        sortOrder: index,
        isVisible: true
      };
    });
    const remoteId = project.id && /^[0-9a-f-]{36}$/i.test(project.id) ? project.id : null;
    const draftKey = `${DRAFT_PREFIX}${remoteId || 'novo'}`;
    const draft = { project, payload, features: featurePayloads, savedLocallyAt: new Date().toISOString() };
    await putRecoveryDraft(draftKey, draft);
    try {
      if (remoteId && !String(payload.expectedUpdatedAt || '').trim()) {
        const error = new Error('Revisão do projeto ausente. Reabra o projeto antes de salvar.');
        error.status = 428;
        error.code = 'PROJECT_REVISION_REQUIRED';
        throw error;
      }
      const saved = await auth.saveProjectBundle(remoteId, payload, featurePayloads);
      const savedProjectId = saved?.project?.id;
      if (!savedProjectId) throw new Error('A nuvem não retornou o identificador do projeto salvo.');
      const confirmed = await verifySavedBundle(savedProjectId, featurePayloads, payload);
      const value = toLegacy(confirmed.project || saved.project, confirmed.features || saved.features);
      fullCache.set(value.id, value);
      fullLoadedAt.set(value.id, Date.now());
      mergeSummaryWithFull(value);
      summariesLoadedAt = Date.now();
      persistCache();
      await deleteRecoveryDraft(draftKey);
      if (!remoteId && savedProjectId) await deleteRecoveryDraft(`${DRAFT_PREFIX}${savedProjectId}`);
      return value;
    } catch (error) {
      if (Number(error?.status || 0) === 409 || error?.code === 'EDIT_CONFLICT') {
        window.dispatchEvent(new CustomEvent('georural:edit-conflict', { detail: { projectId: remoteId, draftKey, error } }));
      } else {
        window.dispatchEvent(new CustomEvent('georural:save-pending', { detail: { projectId: remoteId, draftKey, error } }));
      }
      throw error;
    }
  }

  function invalidate(id = null) {
    if (id) {
      fullCache.delete(id);
      fullLoadedAt.delete(id);
      summaries = summaries.filter((item) => item.id !== id);
    } else {
      fullCache.clear();
      fullLoadedAt.clear();
      summaries = [];
      summariesLoadedAt = 0;
    }
    persistCache();
  }

  async function saveRecoverySnapshot(projectId, snapshot = {}) {
    const key = `${DRAFT_PREFIX}${String(projectId || 'novo')}`;
    const value = {
      recoveryOnly: true,
      projectId: projectId || null,
      snapshot,
      savedLocallyAt: new Date().toISOString()
    };
    await putRecoveryDraft(key, value);
    window.dispatchEvent(new CustomEvent('surveyor:recovery-snapshot', { detail: { key, savedLocallyAt: value.savedLocallyAt } }));
    return value;
  }

  async function listPendingDraftsAsync() {
    const indexed = await listIndexedDrafts();
    const merged = new Map(indexed.map((item) => [item.key, item]));
    listPendingDrafts().forEach((item) => merged.set(item.key, { ...merged.get(item.key), ...item }));
    return [...merged.values()].sort((a, b) => String(b.savedLocallyAt || '').localeCompare(String(a.savedLocallyAt || '')));
  }

  function listPendingDrafts() {
    const drafts = [];
    try {
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (!key?.startsWith(DRAFT_PREFIX)) continue;
        const value = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (value) drafts.push({ key, ...value });
      }
    } catch {}
    return drafts;
  }

  // O cadastro principal continua com um proprietário. O segundo é opcional e
  // permanece exclusivamente nos metadados salvos do projeto (não em preferências locais).
  function additionalOwner(project) {
    const value = project?.metadata?.additionalOwner || project?.additionalOwner || null;
    if (!value || typeof value !== 'object') return null;
    const name = String(value.name || '').trim();
    if (!name) return null;
    return {
      name,
      cpfCnpj: String(value.cpfCnpj || '').trim(),
      rg: String(value.rg || '').trim()
    };
  }
  function ownerNames(project, firstName = null) {
    const primary = String(firstName ?? project?.owner ?? project?.ownerName ?? '').trim();
    const second = additionalOwner(project)?.name || '';
    return [primary, second].filter(Boolean).join(' / ');
  }
  function ownerDocuments(project, firstDocument = null) {
    const primary = String(firstDocument ?? project?.ownerCpf ?? project?.metadata?.ownerCpf ?? '').trim();
    const second = additionalOwner(project)?.cpfCnpj || '';
    return [primary, second].filter(Boolean).join(' / ');
  }
  function ownerRgs(project, firstRg = null) {
    const primary = String(firstRg ?? project?.ownerRg ?? project?.metadata?.ownerRg ?? '').trim();
    const second = additionalOwner(project)?.rg || '';
    return [primary, second].filter(Boolean).join(' / ');
  }
  window.GeoRuralProjects = { list, get, saveLegacy, verifySavedBundle, updateMetadata, invalidate, toLegacy, listPendingDrafts, listPendingDraftsAsync, saveRecoverySnapshot, deleteRecoveryDraft, additionalOwner, ownerNames, ownerDocuments, ownerRgs };
})();
