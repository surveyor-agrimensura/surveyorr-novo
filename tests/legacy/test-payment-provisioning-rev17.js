import assert from 'node:assert/strict';

process.env.APPWRITE_ENDPOINT = 'https://mock.appwrite/v1';
process.env.APPWRITE_PROJECT_ID = 'surveyor-test';
process.env.APPWRITE_DATABASE_ID = 'surveyor_db';
process.env.APPWRITE_API_KEY = 'test-appwrite-key';
process.env.PAYMENT_INTERNAL_SECRET = 'rev17-payment-secret-abcdefghijklmnopqrstuvwxyz-123456';
process.env.PAYMENT_REQUIRE_FULL_PRICE = 'true';
process.env.ALLOW_PAYMENT_PROVISION_ADMIN = 'false';
process.env.APPWRITE_COLLECTION_USERS_PROFILE = 'users_profile';
process.env.APPWRITE_COLLECTION_PLANS = 'plans';
process.env.APPWRITE_COLLECTION_SECURITY_EVENTS = 'security_events';

const users = new Map();
const profiles = new Map();
let userCreates = 0;
let profileCreates = 0;
let failProfileCreateOnce = false;

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json' }
});

function bodyOf(options = {}) {
  if (!options.body) return {};
  return typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
}

function listProfilesForUrl(url) {
  const decoded = decodeURIComponent(url);
  let result = [...profiles.values()];
  const userMatch = decoded.match(/"attribute":"userId","values":\["([^"]+)"\]/);
  const emailMatch = decoded.match(/"attribute":"email","values":\["([^"]+)"\]/);
  if (userMatch) result = result.filter((row) => row.userId === userMatch[1]);
  if (emailMatch) result = result.filter((row) => row.email === emailMatch[1]);
  return result;
}

global.fetch = async (input, options = {}) => {
  const url = String(input);
  const method = String(options.method || 'GET').toUpperCase();
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/^\/v1/, '');

  if (path === '/users' && method === 'GET') {
    const search = String(parsed.searchParams.get('search') || '').toLowerCase();
    const matches = [...users.values()].filter((user) => !search || user.email.toLowerCase() === search);
    return jsonResponse({ total: matches.length, users: matches });
  }

  if (path === '/users' && method === 'POST') {
    const data = bodyOf(options);
    if ([...users.values()].some((u) => u.email === data.email)) {
      return jsonResponse({ message: 'A user with the same email already exists.' }, 409);
    }
    userCreates += 1;
    const user = { $id: data.userId, id: data.userId, email: data.email, name: data.name, status: true, emailVerification: false, prefs: {} };
    users.set(user.$id, user);
    return jsonResponse(user, 201);
  }

  const userPrefsMatch = path.match(/^\/users\/([^/]+)\/prefs$/);
  if (userPrefsMatch && method === 'PATCH') {
    const user = users.get(decodeURIComponent(userPrefsMatch[1]));
    if (!user) return jsonResponse({ message: 'User not found' }, 404);
    user.prefs = bodyOf(options).prefs || {};
    return jsonResponse({ prefs: user.prefs });
  }

  const userNameMatch = path.match(/^\/users\/([^/]+)\/name$/);
  if (userNameMatch && method === 'PATCH') {
    const user = users.get(decodeURIComponent(userNameMatch[1]));
    if (!user) return jsonResponse({ message: 'User not found' }, 404);
    user.name = bodyOf(options).name || user.name;
    return jsonResponse(user);
  }

  const userMatch = path.match(/^\/users\/([^/]+)$/);
  if (userMatch && method === 'GET') {
    const user = users.get(decodeURIComponent(userMatch[1]));
    return user ? jsonResponse(user) : jsonResponse({ message: 'User not found' }, 404);
  }
  if (userMatch && method === 'DELETE') {
    users.delete(decodeURIComponent(userMatch[1]));
    return new Response('', { status: 204 });
  }

  if (path.includes('/collections/plans/documents') && method === 'GET') {
    return jsonResponse({ total: 0, documents: [] });
  }

  if (path.includes('/collections/users_profile/documents') && method === 'GET') {
    const docs = listProfilesForUrl(url);
    return jsonResponse({ total: docs.length, documents: docs });
  }
  if (path.endsWith('/collections/users_profile/documents') && method === 'POST') {
    if (failProfileCreateOnce) {
      failProfileCreateOnce = false;
      return jsonResponse({ message: 'Mock profile storage failure' }, 500);
    }
    const request = bodyOf(options);
    const id = request.documentId || `profile-${profiles.size + 1}`;
    const row = { $id: id, ...request.data };
    profiles.set(id, row);
    profileCreates += 1;
    return jsonResponse(row, 201);
  }
  const profilePatchMatch = path.match(/\/collections\/users_profile\/documents\/([^/]+)$/);
  if (profilePatchMatch && method === 'PATCH') {
    const id = decodeURIComponent(profilePatchMatch[1]);
    const current = profiles.get(id);
    if (!current) return jsonResponse({ message: 'Profile not found' }, 404);
    const data = bodyOf(options).data || {};
    const row = { ...current, ...data, $id: id };
    profiles.set(id, row);
    return jsonResponse(row);
  }

  if (path.includes('/collections/security_events/documents') && method === 'POST') {
    const request = bodyOf(options);
    return jsonResponse({ $id: request.documentId || 'event', ...request.data }, 201);
  }

  // Fallback para consultas de collections opcionais.
  if (/\/collections\/[^/]+\/documents$/.test(path) && method === 'GET') {
    return jsonResponse({ total: 0, documents: [] });
  }

  return jsonResponse({ message: `Mock endpoint not implemented: ${method} ${path}` }, 404);
};

const { default: apiMain } = await import(`../functions/surveyor-api/src/main.js?rev17test=${Date.now()}`);

async function callProvision(payload, extraHeaders = {}) {
  let result = null;
  const req = {
    method: 'POST',
    path: '/api/integrations/payments/provision',
    headers: {
      'content-type': 'application/json',
      'x-surveyor-payment-secret': process.env.PAYMENT_INTERNAL_SECRET,
      origin: 'https://pagamento.surveyorr.com.br',
      ...extraHeaders
    },
    bodyJson: payload
  };
  const res = {
    json(payloadOut, status = 200, headers = {}) {
      result = { payload: payloadOut, status, headers, kind: 'json' };
      return result;
    },
    send(text, status = 200, headers = {}) {
      result = { payload: text, status, headers, kind: 'text' };
      return result;
    }
  };
  await apiMain({ req, res, log() {}, error() {} });
  return result;
}

// 1) Compra normal Pro anual: cria Auth + perfil + plano e exige troca da senha temporária.
const normal = {
  paymentId: 'pay_rev17_normal_001', orderId: 'order_rev17_001', name: 'Cliente Pro', email: 'cliente.pro@example.com',
  phone: '(75) 99999-1234', plan: 'Surveyor Pro Anual', amountCents: 119900, paymentMethod: 'pix'
};
const first = await callProvision(normal);
assert.equal(first.kind, 'json');
assert.equal(first.status, 201);
assert.equal(first.payload.ok, true);
assert.equal(first.payload.account.planSlug, 'pro_annual');
assert.equal(first.payload.account.mustChangePassword, true);
assert.equal(first.payload.firstAccessRequired, true);
assert.equal(userCreates, 1);
assert.equal(profileCreates, 1);
const firstExpiry = first.payload.account.expiresAt;
const firstUserId = first.payload.account.userId;
assert.equal(profiles.get([...profiles.keys()][0]).plan, 'pro_annual');
assert.ok(users.get(firstUserId).prefs.surveyor.processedPaymentIds.includes(normal.paymentId));

// 2) "Verificar novamente": mesma contratação não cria conta nem estende vencimento.
const retry = await callProvision(normal, { 'idempotency-key': normal.paymentId });
assert.equal(retry.status, 200);
assert.equal(retry.payload.ok, true);
assert.equal(retry.payload.alreadyProcessed, true);
assert.equal(retry.payload.account.userId, firstUserId);
assert.equal(retry.payload.account.expiresAt, firstExpiry);
assert.equal(userCreates, 1);
assert.equal(profileCreates, 1);

// 3) Cupom 100%: pagamento R$ 0,00 continua provisionando o plano comprado.
const free = await callProvision({
  paymentId: 'pay_rev17_free_001', name: 'Cliente Cupom', email: 'cupom@example.com', phone: '75999998888',
  planSlug: 'plus_annual', amountCents: 0, couponCode: 'GRATIS100', couponPercent: 100, paymentMethod: 'coupon'
});
assert.equal(free.status, 201);
assert.equal(free.payload.ok, true);
assert.equal(free.payload.account.planSlug, 'plus_annual');
assert.equal(free.payload.billing.paidAmountCents, 0);
assert.equal(free.payload.billing.listPriceCents, 69900);

// 4) Falha parcial depois do Auth: retorna JSON por etapa e retry reaproveita a mesma conta/mesmo período.
failProfileCreateOnce = true;
const partialPayload = {
  paymentId: 'pay_rev17_partial_001', name: 'Cliente Parcial', email: 'parcial@example.com', phone: '75999997777',
  planSlug: 'basic_monthly', amountCents: 3990, paymentMethod: 'card'
};
const beforePartialCreates = userCreates;
const partialFail = await callProvision(partialPayload);
assert.equal(partialFail.kind, 'json');
assert.equal(partialFail.payload.ok, false);
assert.equal(partialFail.payload.stage, 'profile');
assert.match(partialFail.payload.error, /profile|provision/i);
assert.ok(partialFail.payload.requestId);
assert.equal(userCreates, beforePartialCreates + 1);
const partialUser = [...users.values()].find((u) => u.email === partialPayload.email);
assert.ok(partialUser);
const pendingExpiry = partialUser.prefs.surveyor.paymentProvisioning.expiresAt;
assert.equal(partialUser.prefs.surveyor.paymentProvisioning.state, 'pending');

const partialRetry = await callProvision(partialPayload);
assert.equal(partialRetry.status, 201);
assert.equal(partialRetry.payload.ok, true);
assert.equal(partialRetry.payload.account.userId, partialUser.$id);
assert.equal(partialRetry.payload.account.expiresAt, pendingExpiry);
assert.equal(userCreates, beforePartialCreates + 1, 'retry não pode duplicar Auth');

// 5) Segredo inválido sempre devolve JSON, nunca HTML.
const unauthorized = await callProvision(normal, { 'x-surveyor-payment-secret': 'segredo-incorreto' });
assert.equal(unauthorized.kind, 'json');
assert.equal(unauthorized.status, 403);
assert.equal(unauthorized.payload.ok, false);
assert.equal(unauthorized.payload.error, 'payment_secret_invalid');

console.log('OK v21.10.0 REV17: provisionamento por pagamento, idempotência, retry parcial, cupom 100% e erros JSON validados.');
