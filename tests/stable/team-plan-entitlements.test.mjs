import assert from 'node:assert/strict';
import { createAuthorization } from '../../functions/surveyor-api/src/domain/permissions.js';

const statusError = (status, message, details = {}) => Object.assign(new Error(message), { status, details, code: details.code });
const permissionCandidates = (permission) => [String(permission || '').trim().toLowerCase()].filter(Boolean);
const authz = createAuthorization({ statusError, permissionCandidates });

const memberAuth = {
  user: {
    role: 'user',
    isSubuser: true,
    planSlug: 'pro_annual',
    // Simula snapshot antigo: effectivePermissions/permissions não carregavam
    // company:settings, mas planPermissions já representava o plano do titular.
    permissions: ['map:access'],
    effectivePermissions: ['map:access'],
    planPermissions: [
      'map:access',
      'company:settings',
      'projects:export',
      'geometry:advanced',
      'documents:pranchas',
      'layers:official'
    ]
  }
};

for (const permission of ['company:settings','projects:export','geometry:advanced','documents:pranchas','layers:official']) {
  assert.equal(authz.hasPermission(memberAuth, permission), true, `Membro deve herdar ${permission} do plano do titular.`);
  assert.doesNotThrow(() => authz.requirePermission(memberAuth, permission));
}

assert.equal(authz.hasPermission(memberAuth, 'admin:dashboard'), false, 'Herança comercial não deve transformar membro em administrador global.');

console.log('PASS team-plan-entitlements: planPermissions do titular são autoridade comercial para membros sem conceder admin global.');
