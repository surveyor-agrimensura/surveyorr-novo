(() => {
  'use strict';

  const DB_NAME = 'surveyor-property-search-index-v5';
  const LEGACY_DB_NAMES = ['surveyor-property-cache-v1', 'surveyor-property-cache-v2', 'surveyor-property-cache-v3-json', 'surveyor-property-search-index-v4'];
  const DB_VERSION = 1;
  // Geometrias confirmadas ficam em banco separado para não atualizar/bloquear
  // a conexão IndexedDB do índice municipal já instalado (inclusive outras abas).
  const VERIFIED_GEOMETRY_DB = 'surveyor-property-verified-geometry-v1';
  const VERIFIED_GEOMETRY_STORE = 'features';
  const VERIFIED_GEOMETRY_TTL = 90 * 24 * 60 * 60 * 1000;
  let verifiedGeometryDbPromise = null;
  function openVerifiedGeometryDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponível.'));
    if (verifiedGeometryDbPromise) return verifiedGeometryDbPromise;
    verifiedGeometryDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(VERIFIED_GEOMETRY_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(VERIFIED_GEOMETRY_STORE)) {
          const store = db.createObjectStore(VERIFIED_GEOMETRY_STORE, { keyPath: 'key' });
          store.createIndex('savedAt', 'savedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { verifiedGeometryDbPromise = null; reject(request.error); };
    });
    return verifiedGeometryDbPromise;
  }
  async function getVerifiedGeometry(key) {
    if (!key || !/^(?:[A-Z]{2})\|(?:CAR|CODE):/.test(key)) return null;
    try {
      const db = await openVerifiedGeometryDb();
      const tx = db.transaction(VERIFIED_GEOMETRY_STORE, 'readonly');
      const entry = await requestPromise(tx.objectStore(VERIFIED_GEOMETRY_STORE).get(key));
      if (!entry || Date.now() - entry.savedAt > VERIFIED_GEOMETRY_TTL) return null;
      return entry.feature?.geometry ? entry.feature : null;
    } catch { return null; }
  }
  async function putVerifiedGeometry(key, feature) {
    if (!key || !/^(?:[A-Z]{2})\|(?:CAR|CODE):/.test(key) || !feature?.geometry) return false;
    // Não persistir feições gigantes que poderiam esgotar a cota do navegador.
    try {
      if (JSON.stringify(feature).length > 600000) return false;
      const db = await openVerifiedGeometryDb();
      const tx = db.transaction(VERIFIED_GEOMETRY_STORE, 'readwrite');
      const store = tx.objectStore(VERIFIED_GEOMETRY_STORE);
      store.put({ key, savedAt: Date.now(), feature });
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        const surplus = Number(countRequest.result || 0) - 120;
        if (surplus <= 0) return;
        let deleted = 0;
        const cursor = store.index('savedAt').openCursor();
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item || deleted >= surplus) return;
          item.delete(); deleted += 1; item.continue();
        };
      };
      return await new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      });
    } catch { return false; }
  }
  const PROPERTY_STORE = 'properties';
  const MANIFEST_STORE = 'manifests';
  const VALID_STATES = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);

  const NAME_FIELDS = [
    'nom_imovel','nome_imovel','nm_imovel','nome_area','nom_area','nomearea','nome_sitio','nom_sitio',
    'nome_fazenda','nom_fazenda','nome_propriedade','nom_propriedade','nm_propriedade','nome_prop',
    'nom_proprie','nm_proprie','denominacao','denominaca','denom_imovel','denominacao_imovel','nome'
  ];
  const CAR_FIELDS = ['cod_imovel','codigo_imovel','codigoimovel','num_sicar','numero_sicar','numero_car','registro_car','cod_car','nr_car','car'];
  const CODE_FIELDS = ['ide_imovel','id_imovel','codigo_imo','codigo_incra','cod_incra','cod_imovel','codigo_imovel','codigoimovel','objectid','fid','id'];
  const MUNICIPALITY_NAME_FIELDS = ['municipio','nome_municipio','municipio_imovel','nm_municipio','munic','nome_munic'];
  const MUNICIPALITY_CODE_FIELDS = ['cod_municipio_ibge','codigo_municipio','cod_municipio','codigo_ibge','ibge'];
  const AREA_FIELDS = ['area','area_ha','area_ha_calc','area_hectares','area_imovel','num_area','qtd_area','area_total'];

  function normalizeState(value = '') {
    const state = String(value || '').trim().toUpperCase();
    return VALID_STATES.has(state) ? state : '';
  }

  function normalizeText(value = '') {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactCode(value = '') {
    return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function normalizedKey(value = '') {
    return normalizeText(value).replace(/ /g, '');
  }

  function scalarEntry(properties = {}, aliases = []) {
    const entries = Object.entries(properties || {});
    const wanted = new Set(aliases.map(normalizedKey));
    for (const [key, value] of entries) {
      if (value === undefined || value === null || typeof value === 'object' || String(value).trim() === '') continue;
      if (wanted.has(normalizedKey(key))) return { key, value: String(value).trim() };
    }
    return { key: '', value: '' };
  }

  function municipalityDescriptor(municipality = null) {
    if (!municipality) return null;
    const id = String(municipality.id || municipality.code || '').replace(/\D/g, '');
    const name = String(municipality.name || '').trim();
    const nameNorm = normalizeText(name);
    if (!id && !nameNorm) return null;
    return { id, name, nameNorm };
  }

  function scopeKey(stateCode, municipality = null) {
    const state = normalizeState(stateCode);
    const city = municipalityDescriptor(municipality);
    if (!state || !city) return '';
    return `${state}|${city.id || city.nameNorm}`;
  }

  function stableIdentity(record = {}) {
    const source = [record.sk, record.n, record.c, record.d, record.f].join('|');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `s${(hash >>> 0).toString(16)}`;
  }

  function textTokens(value = '') {
    const words = normalizeText(value).split(' ').filter((token) => token.length >= 3);
    return [...new Set(words)].slice(0, 12);
  }

  function featureRecord(feature, stateCode, municipality, generation) {
    const props = feature?.properties || {};
    const city = municipalityDescriptor(municipality);
    const sk = scopeKey(stateCode, municipality);
    const name = scalarEntry(props, NAME_FIELDS).value;
    const car = compactCode(scalarEntry(props, CAR_FIELDS).value);
    const code = compactCode(scalarEntry(props, CODE_FIELDS).value);
    const area = scalarEntry(props, AREA_FIELDS).value;
    const sourceFeatureId = String(feature?.id || '').trim();
    const identity = sourceFeatureId || car || code || stableIdentity({ sk, n: name, c: car, d: code, f: sourceFeatureId });
    const sg = `${sk}|${generation}`;
    const tokenSet = new Set(textTokens(name));
    if (car) tokenSet.add(car);
    if (code) tokenSet.add(code);

    return {
      k: `${sg}|${identity}`,
      sg,
      sk,
      i: String(identity).slice(0, 512),
      f: sourceFeatureId.slice(0, 512),
      n: name,
      nn: normalizeText(name),
      c: car,
      d: code,
      a: area,
      tk: [...tokenSet].slice(0, 14).map((token) => `${sg}|${token}`),
      ck: car ? `${sg}|${car}` : '',
      dk: code ? `${sg}|${code}` : '',
      mn: city?.name || '',
      mi: city?.id || '',
      // Campos oficiais distintos da cidade escolhida ao fazer download.
      om: scalarEntry(props, MUNICIPALITY_NAME_FIELDS).value,
      oi: scalarEntry(props, MUNICIPALITY_CODE_FIELDS).value
    };
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Falha no IndexedDB.'));
    });
  }

  let dbPromise = null;
  function openDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('Este navegador não oferece IndexedDB.'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        let properties;
        if (!db.objectStoreNames.contains(PROPERTY_STORE)) properties = db.createObjectStore(PROPERTY_STORE, { keyPath: 'k' });
        else properties = request.transaction.objectStore(PROPERTY_STORE);
        if (!properties.indexNames.contains('scopeGeneration')) properties.createIndex('scopeGeneration', 'sg', { unique: false });
        if (!properties.indexNames.contains('tokenKeys')) properties.createIndex('tokenKeys', 'tk', { unique: false, multiEntry: true });
        if (!properties.indexNames.contains('carKey')) properties.createIndex('carKey', 'ck', { unique: false });
        if (!properties.indexNames.contains('codeKey')) properties.createIndex('codeKey', 'dk', { unique: false });
        if (!db.objectStoreNames.contains(MANIFEST_STORE)) db.createObjectStore(MANIFEST_STORE, { keyPath: 'scopeKey' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { dbPromise = null; reject(request.error || new Error('Não foi possível abrir o índice local.')); };
    });
    return dbPromise;
  }

  async function getManifest(stateCode, municipality = null) {
    const key = scopeKey(stateCode, municipality);
    if (!key) return null;
    const db = await openDb();
    const tx = db.transaction(MANIFEST_STORE, 'readonly');
    return (await requestPromise(tx.objectStore(MANIFEST_STORE).get(key))) || null;
  }

  async function listStateManifests(stateCode) {
    const state = normalizeState(stateCode);
    if (!state) return [];
    const db = await openDb();
    const tx = db.transaction(MANIFEST_STORE, 'readonly');
    const all = await requestPromise(tx.objectStore(MANIFEST_STORE).getAll());
    return (all || []).filter((item) => item?.stateCode === state && item?.status === 'installed');
  }

  async function putManifest(manifest) {
    const db = await openDb();
    const tx = db.transaction(MANIFEST_STORE, 'readwrite');
    tx.objectStore(MANIFEST_STORE).put(manifest);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  }

  async function putRecords(records = []) {
    if (!records.length) return;
    const db = await openDb();
    const tx = db.transaction(PROPERTY_STORE, 'readwrite');
    const store = tx.objectStore(PROPERTY_STORE);
    records.forEach((record) => store.put(record));
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  }

  async function deleteGeneration(scopeGeneration) {
    if (!scopeGeneration) return;
    const db = await openDb();
    const tx = db.transaction(PROPERTY_STORE, 'readwrite');
    const store = tx.objectStore(PROPERTY_STORE);
    const index = store.index('scopeGeneration');
    const request = index.openKeyCursor(IDBKeyRange.only(scopeGeneration));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  }

  async function removeMunicipality(stateCode, municipality) {
    const manifest = await getManifest(stateCode, municipality);
    if (!manifest) return;
    if (manifest.scopeGeneration) await deleteGeneration(manifest.scopeGeneration);
    const db = await openDb();
    const tx = db.transaction(MANIFEST_STORE, 'readwrite');
    tx.objectStore(MANIFEST_STORE).delete(manifest.scopeKey);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  }

  async function removeState(stateCode) {
    const manifests = await listStateManifests(stateCode);
    for (const manifest of manifests) await removeMunicipality(stateCode, { id: manifest.municipalityCode, name: manifest.municipalityName });
  }

  async function installMunicipality({ stateCode, municipality, fetchPage, onProgress = () => {}, pageSize = 400 }) {
    const state = normalizeState(stateCode);
    const city = municipalityDescriptor(municipality);
    const sk = scopeKey(state, city);
    if (!state || !city || !sk) throw new Error('Município inválido para o índice local.');
    if (typeof fetchPage !== 'function') throw new Error('Fonte de dados local não configurada.');
    const previous = await getManifest(state, city);
    const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sg = `${sk}|${generation}`;
    let startIndex = 0;
    let count = 0;
    let estimatedTotal = 0;
    let sizeBytes = 0;
    let page = 0;
    const seen = new Set();
    try {
      onProgress({ stateCode: state, municipality: city, count: 0, total: 0, progress: 1, sizeBytes: 0, page: 0, stage: 'preparing' });
      while (startIndex <= 500_000) {
        onProgress({ stateCode: state, municipality: city, count, total: estimatedTotal, progress: estimatedTotal > 0 ? Math.min(99, Math.round((count / estimatedTotal) * 100)) : Math.min(94, Math.max(2, page * 3 + 2)), sizeBytes, page, stage: page === 0 ? 'connecting' : 'downloading' });
        page += 1;
        const payload = await fetchPage({ startIndex, pageSize, page, municipality: city });
        const features = Array.isArray(payload?.features) ? payload.features.filter((feature) => feature?.properties && Object.keys(feature.properties).length) : [];
        const totalRaw = Number(payload?.totalFeatures ?? payload?.numberMatched ?? payload?.totalFeatureCount ?? 0);
        if (Number.isFinite(totalRaw) && totalRaw > 0) estimatedTotal = Math.max(estimatedTotal, totalRaw);
        if (!features.length) break;
        const records = [];
        for (const feature of features) {
          const record = featureRecord(feature, state, city, generation);
          if (!record.i || seen.has(record.i)) continue;
          seen.add(record.i);
          records.push(record);
        }
        if (!records.length) {
          if (estimatedTotal > count || features.length >= pageSize) throw new Error('A fonte oficial repetiu a mesma página e não permitiu concluir o índice municipal.');
          break;
        }
        await putRecords(records);
        count += records.length;
        try { sizeBytes += records.reduce((sum, record) => sum + new Blob([JSON.stringify(record)]).size, 0); }
        catch { sizeBytes += records.reduce((sum, record) => sum + JSON.stringify(record).length, 0); }
        const progress = estimatedTotal > 0 ? Math.min(99, Math.round((count / estimatedTotal) * 100)) : Math.min(95, page * 8);
        onProgress({ stateCode: state, municipality: city, count, total: estimatedTotal, progress, sizeBytes, page, stage: 'downloading' });
        if (estimatedTotal > 0 && count >= estimatedTotal) break;
        if (!(estimatedTotal > 0) && features.length < pageSize) break;
        startIndex += features.length;
      }
      if (!count) throw new Error(`A fonte oficial não retornou imóveis para ${city.name || city.id}.`);
      if (estimatedTotal > 0 && count < estimatedTotal) throw new Error(`Índice municipal incompleto: ${count} de ${estimatedTotal} imóveis recebidos.`);
      const manifest = {
        scopeKey: sk,
        scopeGeneration: sg,
        stateCode: state,
        municipalityCode: city.id,
        municipalityName: city.name,
        generation,
        count,
        sizeBytes,
        installedAt: new Date().toISOString(),
        sourceVersion: new Date().toISOString().slice(0, 10),
        status: 'installed',
        mode: 'municipality-search-index-only',
        storageFormat: 'compact-municipality-property-index',
        mimeType: 'application/json',
        geometryStored: false,
        fullAttributesStored: false,
        fieldsMode: 'essential-search-only'
      };
      await putManifest(manifest);
      onProgress({ stateCode: state, municipality: city, count, total: estimatedTotal || count, progress: 100, sizeBytes, page, stage: 'complete' });
      if (previous?.scopeGeneration && previous.scopeGeneration !== sg) deleteGeneration(previous.scopeGeneration).catch(() => {});
      return manifest;
    } catch (error) {
      await deleteGeneration(sg).catch(() => {});
      if (previous) await putManifest(previous).catch(() => {});
      throw error;
    }
  }

  // O escopo em IndexedDB representa o município escolhido no DOWNLOAD,
  // e não prova o município de cada imóvel. CAR completo traz código IBGE.
  function recordBelongsToMunicipality(record, city) {
    const target = String(city?.id || '').replace(/\D/g, '');
    if (!target) return false;
    const car = String(record?.c || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const match = car.match(/^[A-Z]{2}(\d{7})[A-Z0-9]+$/);
    if (match) return match[1] === target;
    // `oi` é extraído dos atributos originais, diferentemente de `mi` que
    // identifica apenas a pasta do download. Índices antigos não têm `oi`.
    const officialCode = String(record?.oi || '').replace(/\D/g, '');
    return Boolean(officialCode && officialCode === target);
  }

  // Os nomes genéricos (Sítio, Fazenda...) não substituem os termos que
  // individualizam o imóvel. "Sítio Riu Bahia" não deve retornar "Sítio Bahia".
  const GENERIC_PROPERTY_NAME_WORDS = new Set([
    'SITIO','FAZENDA','CHACARA','GRANJA','GLEBA','PROPRIEDADE','IMOVEL',
    'RURAL','ESTANCIA','HARAS','LOTE','TERRENO'
  ]);

  function propertySearchWords(value) {
    const words = normalizeText(value).split(' ').filter(Boolean);
    const meaningful = words.filter((word) => !GENERIC_PROPERTY_NAME_WORDS.has(word));
    return meaningful.length ? meaningful : words;
  }

  function recordScore(record, queryNorm, compactQuery) {
    if (!record) return -1;
    if (compactQuery && (record.c === compactQuery || record.d === compactQuery)) return 20000;
    const name = record.nn || '';
    if (!name || !queryNorm) return -1;
    // Busca somente pelo tipo (ex.: "Sítio") continua listando sítios.
    const literalWords = queryNorm.split(' ').filter(Boolean);
    if (literalWords.length && literalWords.every((word) => GENERIC_PROPERTY_NAME_WORDS.has(word))) {
      return literalWords.every((word) => name.split(' ').includes(word)) ? 7000 : -1;
    }
    const requested = propertySearchWords(queryNorm);
    const candidate = propertySearchWords(name);
    if (!requested.length || !requested.every((word) => candidate.some((part) =>
      part === word || part.startsWith(word) || (word.length >= 4 && word.startsWith(part) && part.length >= 4)
    ))) return -1;
    const filteredQuery = requested.join(' ');
    const filteredName = candidate.join(' ');
    if (filteredName === filteredQuery) return 15000;
    if (filteredName.startsWith(filteredQuery)) return 13000;
    if (filteredName.includes(filteredQuery)) return 12000;
    const extraPenalty = Math.max(0, candidate.length - requested.length) * 25;
    return 8000 - extraPenalty;
  }

  async function getAllByIndex(indexName, key, count = 1000) {
    const db = await openDb();
    const tx = db.transaction(PROPERTY_STORE, 'readonly');
    return requestPromise(tx.objectStore(PROPERTY_STORE).index(indexName).getAll(key, count));
  }

  async function scanScope(scopeGeneration, predicate, maxResults = 12000) {
    const db = await openDb();
    const tx = db.transaction(PROPERTY_STORE, 'readonly');
    return new Promise((resolve, reject) => {
      const output = [];
      const request = tx.objectStore(PROPERTY_STORE).index('scopeGeneration').openCursor(IDBKeyRange.only(scopeGeneration));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || output.length >= maxResults) return resolve(output);
        const record = cursor.value;
        if (predicate(record)) output.push(record);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  function compactFeatureProperties(record, manifest) {
    const props = {};
    if (record.n) props.nome_imovel = record.n;
    if (record.om) props.municipio = record.om;
    if (record.oi) props.cod_municipio_ibge = record.oi;
    if (record.c) props.cod_imovel = record.c;
    if (record.d && record.d !== record.c) props.id_imovel = record.d;
    if (record.a) props.area_ha = record.a;
    props._surveyor_local_cache = manifest?.stateCode || '';
    props._surveyor_local_identity = record.i || '';
    props._surveyor_local_attributes_only = true;
    props._surveyor_local_municipality = manifest?.scopeKey || '';
    return props;
  }

  async function search({ stateCode, query, municipality = null, limit = 1000 } = {}) {
    const state = normalizeState(stateCode);
    const queryNorm = normalizeText(query);
    const compactQuery = compactCode(query);
    const city = municipalityDescriptor(municipality);
    if (!state || !city || (!queryNorm && !compactQuery)) return [];
    const manifest = await getManifest(state, city);
    if (!manifest?.generation || manifest.status !== 'installed') return [];
    const sg = manifest.scopeGeneration;
    let candidates = [];

    if (compactQuery.length >= 6) {
      const [carHits, codeHits] = await Promise.all([
        getAllByIndex('carKey', `${sg}|${compactQuery}`, 200),
        getAllByIndex('codeKey', `${sg}|${compactQuery}`, 200)
      ]);
      candidates = [...carHits, ...codeHits];
    }

    if (!candidates.length) {
      const words = queryNorm.split(' ').filter((token) => token.length >= 3).sort((a, b) => b.length - a.length).slice(0, 3);
      const sets = [];
      for (const token of words) {
        const hits = await getAllByIndex('tokenKeys', `${sg}|${token}`, 12000);
        if (hits.length) sets.push(hits);
      }
      if (sets.length) {
        sets.sort((a, b) => a.length - b.length);
        const base = sets[0];
        if (sets.length === 1) candidates = base;
        else {
          const otherKeys = sets.slice(1).map((list) => new Set(list.map((item) => item.k)));
          candidates = base.filter((item) => otherKeys.every((keys) => keys.has(item.k)));
        }
      }
    }

    if (!candidates.length) {
      candidates = await scanScope(sg, (record) =>
        String(record.nn || '').includes(queryNorm) || (compactQuery && (record.c.includes(compactQuery) || record.d.includes(compactQuery))), 12000);
    }

    const unique = new Map();
    for (const record of candidates) {
      if (!record || !recordBelongsToMunicipality(record, city)) continue;
      const score = recordScore(record, queryNorm, compactQuery);
      if (score < 0) continue;
      const previous = unique.get(record.k);
      if (!previous || score > previous.score) unique.set(record.k, { record, score });
    }
    return [...unique.values()]
      .sort((a, b) => b.score - a.score || String(a.record.n || '').localeCompare(String(b.record.n || ''), 'pt-BR'))
      .slice(0, Math.max(1, Math.min(1000, Number(limit) || 1000)))
      .map(({ record }) => ({
        type: 'Feature',
        id: record.f || undefined,
        properties: compactFeatureProperties(record, manifest),
        geometry: null
      }));
  }

  function weakDeviceAssessment() {
    const memory = Number(navigator.deviceMemory || 0);
    const cores = Number(navigator.hardwareConcurrency || 0);
    const weak = (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
    return { weak, memory, cores };
  }

  async function storageEstimate() {
    try {
      const estimate = await navigator.storage?.estimate?.();
      return { quota: Number(estimate?.quota || 0), usage: Number(estimate?.usage || 0) };
    } catch { return { quota: 0, usage: 0 }; }
  }

  function cleanupLegacyDatabases() {
    if (!('indexedDB' in window)) return;
    for (const name of LEGACY_DB_NAMES) {
      try { indexedDB.deleteDatabase(name); } catch {}
    }
  }

  cleanupLegacyDatabases();

  window.SurveyorPropertyLocalCache = Object.freeze({
    available: () => 'indexedDB' in window,
    getManifest,
    listStateManifests,
    installMunicipality,
    removeMunicipality,
    removeState,
    search,
    weakDeviceAssessment,
    storageEstimate,
    normalizeText,
    compactCode,
    scopeKey,
    getVerifiedGeometry,
    putVerifiedGeometry
  });
})();
