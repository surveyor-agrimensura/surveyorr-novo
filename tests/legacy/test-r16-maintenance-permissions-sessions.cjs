const fs = require('fs');
const assert = require('assert');

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const portal = fs.readFileSync('assets/js/core/portal.js', 'utf8');
const adminOrg = fs.readFileSync('assets/js/admin/organization.js', 'utf8');
const adminHtml = fs.readFileSync('admin/index.html', 'utf8');

// Aviso respeita janela startsAt/endsAt e bloqueio é aplicado no servidor.
assert(api.includes('const start = notice.startsAt ? new Date(notice.startsAt).getTime() : NaN'));
assert(api.includes('if (Number.isFinite(start) && start > now) return false'));
assert(api.includes('async function enforceServerMaintenanceLock'));
assert(api.includes("code: 'SYSTEM_MAINTENANCE'"));
assert(api.includes("if (String(auth?.user?.role || '').toLowerCase() === 'admin') return"));
assert(api.includes("'/api/notices', '/api/system/notices', '/api/notifications', '/api/auth/presence'"));
const authPos = api.indexOf('const auth = await authFromRequest(request)');
const lockPos = api.indexOf('await enforceServerMaintenanceLock(auth, path)', authPos);
assert(authPos >= 0 && lockPos > authPos, 'Maintenance lock precisa ser aplicado após autenticação e antes das rotas protegidas');
assert(portal.includes('system-maintenance-lock'));

// Permissões administrativas são verificadas no backend, não no payload/frontend.
assert(api.includes('function requirePermission'));
assert(api.includes('function requireAdminAccess'));
assert(api.includes('function isGlobalAdminAccess'));
assert(api.includes('function effectivePermissionSet'));
assert(/\/api\/admin\/sessions[\s\S]{0,180}requireAdminAccess\(auth\)/.test(api));
assert(api.includes("if (isSubuser)"));
assert(api.includes("if (['admin:all', '*', 'all'].includes(value)) return false"));


// Camadas administrativas também não dependem de controles do navegador.
assert(/path === '\/api\/admin\/layers'[^\n]*[\s\S]{0,180}requireAdminAccess\(auth\)/.test(api) || api.includes("(path === '/api/admin/layers' || path === '/api/admin/layers/') && httpMethod === 'POST'"));
assert(api.includes('const adminLayerMatch = path.match('));
assert(/if \(adminLayerMatch\) \{[\s\S]{0,100}requireAdminAccess\(auth\)/.test(api));
assert(api.includes("path === '/api/layers'"));
assert(api.includes("requirePermission(auth, 'layers:official')"));

// Sessões/auditoria: login, atividade, logout e último projeto ficam disponíveis ao Admin.
assert(api.includes('lastLoginAt, lastSeenAt: lastActivityAt'));
assert(api.includes('const lastSessionCreatedAt = activeRefreshSessions'));
assert(api.includes('const realActivity = recentActivity.find'));
assert(api.includes('lastSeenAt'));
assert(api.includes('lastLogoutAt:'));
assert(api.includes('lastProjectAt:'));
assert(api.includes('lastProjectName:'));
assert(api.includes("action: 'remote_logout'"));
assert(adminOrg.includes("project_created:'Criou um projeto'"));
assert(adminOrg.includes('session.lastLogoutAt'));
assert(adminOrg.includes('session.lastProjectName'));
assert(adminHtml.includes('<th>Última saída</th>'));
assert(adminHtml.includes('<th>Último projeto</th>'));

console.log('PASS R16: manutenção é server-side, permissões sensíveis são verificadas no backend e sessões exibem login/atividade/logout/projeto.');
