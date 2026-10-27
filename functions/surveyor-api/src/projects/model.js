const PROJECT_DESTRUCTIVE_STATUSES = new Set(['deleted', 'delete', 'trash', 'trashed', 'removed', 'removido', 'excluido', 'excluído']);
const PROJECT_SERVER_METADATA_KEYS = new Set([
  'createdbyuserid', 'createdbyname', 'migratedfromstandaloneuserid',
  'storageowneruserid', 'workspaceowneruserid',
  'lastsavedbyuserid', 'lastsavedbyname', 'lastsavedat',
  'updatedbyuserid', 'updatedbyname',
  'versions', 'secureshares',
  'projectlocked', 'projectlockedat', 'lockedbyuserid', 'lockedat',
  'restoredfromversionid', 'restoredat', 'restoredbyuserid',
  'duplicatedfrom', 'duplicatedat', 'duplicatedbyuserid',
  'clientrequestid'
]);
const PROJECT_SERVER_TOP_LEVEL_KEYS = new Set([
  'id', 'userid', 'owneruserid', 'workspaceowneruserid', 'storageowneruserid',
  'createdbyuserid', 'createdbyname', 'lastsavedbyuserid', 'lastsavedbyname',
  'geojsonfileid', 'fileid', 'revision', 'expectedrevision', 'expectedupdatedat'
]);

export function createProjectModel({ safeJson, headerValue, statusError, appwriteId }) {
  function sanitizeProjectStatus(value, fallback = 'draft') {
    const raw = String(value ?? '').trim();
    if (!raw) return String(fallback || 'draft').slice(0, 40);
    if (PROJECT_DESTRUCTIVE_STATUSES.has(raw.toLowerCase())) return String(fallback || 'draft').slice(0, 40);
    return raw.slice(0, 40);
  }

  function sanitizeProjectClientMetadata(value = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const clean = {};
    for (const [key, entry] of Object.entries(source)) {
      if (PROJECT_SERVER_METADATA_KEYS.has(String(key || '').toLowerCase())) continue;
      clean[key] = entry;
    }
    return clean;
  }

  function sanitizeProjectClientInput(value = {}, fallbackStatus = 'draft') {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const clean = {};
    for (const [key, entry] of Object.entries(source)) {
      if (PROJECT_SERVER_TOP_LEVEL_KEYS.has(String(key || '').toLowerCase())) continue;
      clean[key] = entry;
    }
    clean.metadata = sanitizeProjectClientMetadata(source.metadata);
    clean.status = sanitizeProjectStatus(source.status, fallbackStatus);
    delete clean.force;
    return clean;
  }

  function projectData(input, userId, now, fileId = '', current = null) {
    const metadata = safeJson(input.metadata, {});
    const currentStatus = String(current?.status || 'draft');
    return {
      userId,
      name: String(input.name || input.projectName || current?.name || 'Projeto sem nome').slice(0, 240),
      propertyName: String(input.propertyName || current?.propertyName || '').slice(0, 240),
      ownerName: String(input.ownerName || current?.ownerName || '').slice(0, 240),
      city: String(input.municipality || input.city || metadata.municipality || metadata.city || current?.city || '').slice(0, 120),
      uf: String(input.stateCode || input.uf || metadata.stateCode || metadata.uf || current?.uf || '').slice(0, 2).toUpperCase(),
      areaHa: Number(metadata.areaHa || metadata.areaHectares || current?.areaHa || 0) || 0,
      perimeterM: Number(metadata.perimeterM || metadata.perimeterMeters || current?.perimeterM || 0) || 0,
      folderId: String(metadata.folderId || current?.folderId || '').slice(0, 120),
      folderName: String(metadata.folderName || metadata.folder || current?.folderName || '').slice(0, 240),
      geojsonFileId: fileId || String(current?.geojsonFileId || ''),
      previewImageId: String(metadata.previewImageId || current?.previewImageId || '').slice(0, 120),
      status: sanitizeProjectStatus(input.status, currentStatus),
      createdAt: current?.createdAt || current?.$createdAt || now,
      updatedAt: now
    };
  }

  function canonicalUpdatedAt(value) {
    if (value == null || value === '') return '';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : String(value);
  }

  function expectedUpdatedAt(request, input = {}) {
    const ifMatch = String(headerValue(request, 'if-match') || '').trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
    return canonicalUpdatedAt(ifMatch || headerValue(request, 'x-expected-updated-at') || input.expectedUpdatedAt || input.expectedRevision || input.revision || '');
  }

  function assertRevisionMatches(row, request, input = {}, requireExpected = false) {
    const expected = expectedUpdatedAt(request, input);
    if (!expected) {
      if (requireExpected) throw statusError(428, 'A revisão do projeto é obrigatória. Reabra o projeto antes de salvar.', { code: 'PROJECT_REVISION_REQUIRED', field: 'updatedAt' });
      return;
    }
    const current = canonicalUpdatedAt(row?.updatedAt || row?.$updatedAt || '');
    if (current && expected !== current) {
      throw statusError(409, 'Este registro foi alterado em outra sessão. Recarregue a versão mais recente antes de salvar novamente.', {
        code: 'EDIT_CONFLICT',
        field: 'updatedAt',
        currentUpdatedAt: current,
        expectedUpdatedAt: expected
      });
    }
  }

  function mapFeature(feature = {}, projectId, userId) {
    return {
      id: feature.id || appwriteId(),
      projectId,
      ownerUserId: userId,
      name: feature.name || 'Elemento',
      category: feature.category || 'outros',
      geometryType: feature.geometryType || feature.geoJson?.type || 'Polygon',
      geoJson: feature.geoJson || {},
      areaHectares: feature.areaHectares ?? null,
      perimeterMeters: feature.perimeterMeters ?? null,
      vertexCount: feature.vertexCount || 0,
      style: feature.style || {},
      properties: feature.properties || {},
      sortOrder: feature.sortOrder || 0,
      isVisible: feature.isVisible !== false,
      createdAt: feature.createdAt || null,
      updatedAt: feature.updatedAt || null
    };
  }

  return {
    sanitizeProjectStatus,
    sanitizeProjectClientMetadata,
    sanitizeProjectClientInput,
    projectData,
    canonicalUpdatedAt,
    expectedUpdatedAt,
    assertRevisionMatches,
    mapFeature
  };
}
