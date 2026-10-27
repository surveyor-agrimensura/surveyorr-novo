(() => {
  'use strict';
  // Contexto efêmero e somente de leitura para o renderer OFICIAL de documentos.
  // A Central de Lotes não cria projeto remoto nem troca geometrias do usuário.
  const params = new URLSearchParams(location.search);
  const token = params.get('svBatch');
  if (!token || window.parent === window || !/^[a-f0-9-]{16,100}$/i.test(token)) return;
  // A geometria viaja somente em memória na janela-mãe; nenhum dado do projeto
  // precisa ser colocado no sessionStorage/IndexedDB ou salvo na nuvem.
  let payload;
  try {
    if (window.parent.location.origin !== location.origin) return;
    payload = window.parent.SurveyorBatchDocumentProvider?.get?.(token);
  } catch { return; }
  if (!payload?.project?.geojson?.features?.length || !payload.project.id) return;
  const expected = String(params.get('project') || '');
  if (expected !== String(payload.project.id)) return;
  const virtual = payload.project;
  const store = window.GeoRuralProjects;
  if (!store?.get || !store?.list) return;
  const original = { get: store.get, list: store.list };
  store.get = async (id, refresh) => String(id) === String(virtual.id)
    ? JSON.parse(JSON.stringify(virtual)) : original.get(id, refresh);
  store.list = async () => [{ ...virtual, featureCount: virtual.geojson.features.length }];
  for (const method of ['saveLegacy', 'updateMetadata', 'invalidate']) {
    if (typeof store[method] === 'function') store[method] = async () => { throw new Error('O modo de geração em lote não permite alterar projetos.'); };
  }
  // Nunca publicamos a geometria isolada ou alteramos a preferência de escopo da conta.
  window.SurveyorBatchDocumentContext = Object.freeze({ active: true, projectId: virtual.id, token });
})();
