import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const api = read('functions/surveyor-api/src/main.js');
const support = read('functions/surveyor-support/src/main.js');
const auth = read('assets/js/core/auth.js');
const admin = read('assets/js/admin/app.js');
const html = read('admin/index.html');
const manifest = JSON.parse(read('RELEASE_MANIFEST.json'));

assert.match(api, /APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/);
assert.match(api, /APPWRITE_COLLECTION_WORKSPACE_MEMBERS/);
assert.match(api, /const PLUS_EXTRA_SEAT_PRICE_CENTS = 3000/);
assert.match(api, /const PRO_EXTRA_SEAT_PRICE_CENTS = 6000/);
assert.match(api, /const SUBUSER_STORAGE_LIMIT_BYTES = 5 \* 1024 \* 1024 \* 1024/);
assert.match(api, /function workspacePlanAllowsMembers/);
assert.match(api, /WORKSPACE_PLAN_NOT_ALLOWED/);
assert.match(api, /SUBUSER_STORAGE_LIMIT_REACHED/);
assert.match(api, /function assertWorkspaceActionAllowed/);
assert.match(api, /WORKSPACE_ROLE_LIMIT/);
assert.match(api, /function prepareOnboardingWorkspaceMembers/);
assert.match(api, /async function rebalanceWorkspaceSeatLicenses/);
assert.match(api, /WORKSPACE_DOWNGRADE_REQUIRES_MEMBER_REMOVAL/);
assert.match(api, /workspaceSetup = \{ requested:/);
assert.match(api, /storageOwnerUserId: auth\.sub/);
assert.match(api, /Query\.equal\('ownerUserId', ownerId\)/);
assert.match(api, /adminWorkspaceMembersMatch = path\.match/);
assert.match(api, /adminSubuserMatch = path\.match/);
assert.match(api, /EXTRA_SEAT_REQUIRED/);

for (const id of [
  'workspaceTeamDialog','workspaceMembersTable','workspaceSubuserForm','subuserPaidExtra',
  'workspaceTeamStorage','userWorkspacePlanRule','userAddWorkspaceMember','userWorkspaceMemberDrafts','userManageWorkspace'
]) assert.match(html, new RegExp(`id="${id}"`), `${id} ausente no Admin.`);

assert.match(html, /ETAPA 3 DE 5[\s\S]*Equipe e subusuários/);
assert.match(html, /até 5 GB de conteúdo próprio/i);
assert.match(admin, /const extraSeatPriceCents = tier === 'pro' \? 6000 : \(tier === 'plus' \? 3000 : 0\)/);
assert.match(admin, /payload\.workspaceMembers = collectUserWorkspaceDrafts/);
assert.match(admin, /async function openWorkspaceTeam/);
assert.match(admin, /auth\.createSubuser/);
assert.match(admin, /auth\.updateSubuser/);
assert.match(admin, /auth\.deleteSubuser/);
assert.match(admin, /subuserLimitBytes/);
assert.match(auth, /async function loadWorkspaceTeam/);
assert.match(auth, /async function createSubuser/);
assert.match(support, /APP_VERSION = '1\.1\.0'/);
assert.match(support, /\/api\/admin\/send-subuser-welcome/);
assert.match(support, /5 GB de conteúdo próprio/);

assert.equal(manifest.commercialPlans.basic.users, 1);
assert.equal(manifest.commercialPlans.plus.users, 2);
assert.equal(manifest.commercialPlans.pro.users, 4);
assert.equal(manifest.workspaceTeams.adminOnlyManagement, true);
assert.equal(manifest.workspaceTeams.basicAllowsSubusers, false);
assert.equal(manifest.workspaceTeams.plusAdditionalUserMonthlyCents, 3000);
assert.equal(manifest.workspaceTeams.proAdditionalUserMonthlyCents, 6000);
assert.equal(manifest.workspaceTeams.subuserStorageLimitBytes, 5 * 1024 ** 3);
console.log('OK v21.9.420: equipes controladas, preços por plano, 5 GB individual e cadastro conjunto validados.');
