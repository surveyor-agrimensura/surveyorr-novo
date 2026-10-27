const GLOBAL_ADMIN_PERMISSION_PATTERN = /^(?:admin:|backup:|billing:|white-label:|security:(?:monitoring|login-attempts|ip-history|access-history))/i;

export function parsePermissions(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => enabled !== false)
      .map(([key]) => key === 'all' ? 'admin:all' : key);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  try { return parsePermissions(JSON.parse(raw)); } catch {}
  return raw.split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean);
}

export function sanitizeCommercialPermissions(value) {
  return [...new Set(parsePermissions(value).map((item) => String(item || '').trim()).filter(Boolean))]
    .filter((permission) => {
      const normalized = permission.toLowerCase();
      if (['admin:all', '*', 'all'].includes(normalized)) return false;
      if (normalized.startsWith('company:') && normalized !== 'company:settings') return false;
      return !GLOBAL_ADMIN_PERMISSION_PATTERN.test(normalized);
    });
}

const DOCUMENT_CATEGORY_PERMISSION = new Map([
  ['memorial', 'documents:memorial'], ['memorial-descritivo', 'documents:memorial'],
  ['ods', 'documents:ods'], ['confrontacao', 'documents:confrontacao'], ['confrontação', 'documents:confrontacao'],
  ['mapas', 'documents:mapas'], ['mapa', 'documents:mapas'], ['pranchas', 'documents:pranchas'], ['prancha', 'documents:pranchas'],
  ['perimetros', 'documents:perimetros'], ['perímetros', 'documents:perimetros'], ['perimetro', 'documents:perimetros'],
  ['planialtimetria', 'documents:planialtimetria']
]);

export function createAuthorization({ statusError, permissionCandidates }) {
  function isGlobalAdminAccess(auth = {}) {
    const role = String(auth?.user?.role || '').trim().toLowerCase();
    return role === 'admin' && auth?.user?.isSubuser !== true;
  }

  function requireAdminAccess(auth) {
    if (isGlobalAdminAccess(auth)) return true;
    throw statusError(403, 'Acesso administrativo global necessário.', { code: 'ADMIN_ROLE_REQUIRED' });
  }

  function effectivePermissionSet(auth = {}) {
    const role = String(auth?.user?.role || '').toLowerCase();
    if (role === 'admin') return new Set(['admin:all']);
    const user = auth?.user && typeof auth.user === 'object' ? auth.user : {};
    const source = user.isSubuser === true
      ? [
          ...parsePermissions(user.planPermissions),
          ...parsePermissions(user.effectivePermissions),
          ...parsePermissions(user.permissions)
        ]
      : (Array.isArray(user.effectivePermissions) ? user.effectivePermissions : parsePermissions(user.permissions));
    return new Set(sanitizeCommercialPermissions(source).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean));
  }

  function hasPermission(auth = {}, permission = '') {
    const role = String(auth?.user?.role || '').toLowerCase();
    if (role === 'admin') return true;
    const required = String(permission || '').trim().toLowerCase();
    if (!required) return true;
    const granted = effectivePermissionSet(auth);
    return permissionCandidates(required).some((candidate) => granted.has(candidate));
  }

  function requirePermission(auth = {}, permission = '', message = '') {
    if (hasPermission(auth, permission)) return true;
    throw statusError(403, message || 'Seu plano ou perfil não possui permissão para esta operação.', {
      code: 'PLAN_PERMISSION_REQUIRED', field: String(permission || '')
    });
  }

  function documentCategoryPermission(input = {}) {
    const raw = String(input?.type || input?.category || input?.generationFeature || '').trim().toLowerCase();
    if (!raw) return '';
    const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return DOCUMENT_CATEGORY_PERMISSION.get(raw) || DOCUMENT_CATEGORY_PERMISSION.get(normalized) || '';
  }

  function canAccessDocumentCategory(auth = {}, input = {}) {
    const permission = documentCategoryPermission(input);
    return !permission || hasPermission(auth, permission);
  }

  function requireDocumentCategoryPermission(auth = {}, input = {}) {
    const permission = documentCategoryPermission(input);
    if (permission) requirePermission(auth, permission, 'Seu plano não possui acesso a este tipo de documento.');
  }

  return {
    isGlobalAdminAccess,
    requireAdminAccess,
    effectivePermissionSet,
    hasPermission,
    requirePermission,
    documentCategoryPermission,
    canAccessDocumentCategory,
    requireDocumentCategoryPermission
  };
}
