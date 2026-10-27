import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
const permissions = fs.readFileSync('functions/surveyor-api/src/domain/permissions.js','utf8');
const auth = fs.readFileSync('assets/js/core/auth.js','utf8');
const pref = fs.readFileSync('assets/js/features/memorial/preference.js','utf8');

assert.match(api, /const effectivePermissions = String\(role \|\| ''\).*?expandPlanPermissions/s, 'Membro deve receber a matriz comercial completa do plano do titular.');
assert.ok(!api.includes("memberRole === 'collaborator' && /^(projects:export|geometry:advanced"), 'Papel da equipe não pode reduzir recursos comerciais do plano compartilhado.');
assert.match(api, /return String\(action \|\| ''\).*?!== 'workspace:manage'/s, 'Ações operacionais de projeto/documento devem ficar disponíveis aos membros ativos.');
assert.match(permissions, /\.\.\.parsePermissions\(user\.planPermissions\)/, 'Backend deve considerar planPermissions do plano compartilhado na autorização do membro.');
assert.match(api, /'customization:company'/, 'Fluxo de personalização compartilhada deve continuar autorizado para membros.');
assert.match(api, /const customizationOwnerUserId = resourceOwnerId\(auth\)/, 'Personalização deve usar o titular do workspace como fonte de verdade.');
assert.match(api, /findCustomizationForUser\(customizationOwnerUserId\)/, 'Leitura deve buscar a personalização do titular.');
assert.match(api, /saveDocumentCustomizationForUser\(customizationOwnerUserId, input\)/, 'Gravação por membro deve atualizar a personalização compartilhada da equipe.');
assert.match(api, /const templateOwnerUserId = resourceOwnerId\(auth\)/, 'Autorização do modelo memorial deve seguir o titular da equipe.');
assert.ok(auth.includes('set = new Set(officialSet);'), 'Frontend deve usar a matriz oficial do plano herdado para membros também.');
assert.match(auth, /permissionDeniedForMember[\s\S]*PLAN_PERMISSION_REQUIRED[\s\S]*refreshSession\(\)/, 'Token antigo de membro deve ser renovado automaticamente após divergência de permissão.');
assert.ok(auth.includes('user.ownerUserId || user.workspaceOwnerUserId || user.id'), 'Espelho local descartável deve ser escopado pelo titular da equipe.');
assert.ok(pref.includes('user.ownerUserId || user.workspaceOwnerUserId || user.id'), 'Preferência de modelo deve compartilhar o escopo do titular.');
assert.match(pref, /if \(remote\.id\)/, 'Preferência salva na nuvem deve prevalecer sobre cache local obsoleto.');

console.log('PASS team-customization-shared: membro herda integralmente o plano do titular e usa a mesma personalização na nuvem.');
