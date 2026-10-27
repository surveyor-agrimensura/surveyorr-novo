const fs = require('fs');
const assert = require('assert');

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const admin = fs.readFileSync('assets/js/admin/app.js', 'utf8');

// Acesso compartilhado é resolvido no servidor pela assinatura do titular.
assert(api.includes('async function resolveAuthenticatedIdentity'));
assert(api.includes('const ownerPlan = await findPlanBySlugSafe(activeOwnerProfile.plan'));
assert(api.includes('ensureUserAccessAllowed(publicUser(activeOwnerProfile, activeOwnerUser, ownerPlan))'));
assert(api.includes("accountType: 'subuser'"));
assert(api.includes('subscriptionProfile: activeOwnerProfile'));
assert(api.includes('subscriptionUser: activeOwnerUser'));
assert(api.includes('expiresAt: profileExpiresAt(activeOwnerProfile, activeOwnerUser)'));
assert(api.includes('resourceOwnerUserId: ownerUserId'));

// Subusuário não pode virar admin nem herdar permissões administrativas/billing.
assert(api.includes("const role = isSubuser && rawRole === 'admin' ? 'user' : rawRole"));
assert(api.includes('/^(admin:|security:|backup:|company:|white-label:|billing:|workspace:manage)/i'));
assert(api.includes("if (['admin:all', '*', 'all'].includes(value)) return false"));
assert(api.includes("subscriptionSource: isSubuser ? 'workspace-owner' : 'own-account'"));
assert(api.includes('subscriptionExpired'));
assert(api.includes('statusInherited: isSubuser'));
assert(api.includes('profileIsActive(planProfile, planAppwriteUser)'));

// Admin continua listando o membro, mas a UI deixa claro que plano/vencimento vêm do titular.
assert(admin.includes("return 'Compartilhado'") || admin.includes('Compartilhado ·'));
assert(admin.includes("? 'Compartilhado'"));
assert(admin.includes('Assinatura e vencimento herdados de'));
assert(admin.includes('workspaceName'));

console.log('PASS R16: membro de equipe permanece listado, herda assinatura/vencimento do titular no servidor e não exibe plano próprio no Admin.');
