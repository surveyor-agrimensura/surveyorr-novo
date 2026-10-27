const fs = require('fs');
const assert = require('assert');
const api = fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
const save = fs.readFileSync('functions/surveyor-save/src/main.js','utf8');
assert.match(api, /function accessTokenUserSnapshot\(user = \{\}\)/);
assert.match(api, /user: tokenUser/);
assert.doesNotMatch(api.slice(api.indexOf('function issueAccessToken'), api.indexOf('function legacySharePasswordHash')), /paidExtraSeat|seatPriceCents/);
assert.match(save, /const maxAccessTokenChars = 32 \* 1024/);
assert.match(save, /SAVE_AUTH_TOKEN_TOO_LARGE/);
assert.match(save, /SAVE_AUTH_TOKEN_MISSING/);
const match = api.match(/id: 'pro_annual'[\s\S]*?permissions: (\[[^\n]+\])/);
assert.ok(match, 'plano Pro não localizado');
const permissions = JSON.parse(match[1]);
const user = {
  id: 'u'.repeat(36), email: 'cliente.pro@example.com', role: 'user',
  plan: 'pro_annual', planSlug: 'pro_annual', planName: 'Surveyor Pro Anual',
  effectivePermissions: permissions,
  planLimits: {
    projectLimit:null,userLimit:4,storageLimitBytes:1073741824,storageBaseBytes:1073741824,
    storagePurchasedBytes:0,storageMaxBytes:10737418240,downloadDailyLimit:null,exportDailyLimit:null,
    billingCycle:'anual',generationLimit:null,generationUnlimited:true
  },
  status:'active',isActive:true,expiresAt:'2027-09-21T23:59:59.999Z',isSubuser:false,
  workspaceOwnerUserId:'u'.repeat(36),workspaceRole:'owner'
};
const payload = {
  type:'access',sub:user.id,email:user.email,role:user.role,user,sv:'s'.repeat(36),
  resourceOwnerUserId:user.id,workspace:{accountType:'primary',ownerUserId:user.id,memberRole:'owner'},
  jti:'j'.repeat(36),iat:1758480000,exp:1758480900,iss:'surveyor-appwrite-function'
};
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${b64({alg:'HS256',typ:'JWT'})}.${b64(payload)}.${Buffer.alloc(32).toString('base64url')}`;
assert.ok(token.length < 8192, `token Pro compacto ainda excede 8 KiB: ${token.length}`);
console.log(`PASS R26.3.73: Save aceita até 32 KiB e token Pro compacto estimado em ${token.length} caracteres (${permissions.length} permissões).`);
