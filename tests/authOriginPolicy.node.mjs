import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  corsHeadersForOrigin,
  corsOriginForRequest,
  hostRefreshCookieHeader,
  isOfficialWebOrigin,
  legacyRefreshCookieClearHeader,
  refreshCredentialFromRequest,
  refreshTokenDelivery
} from '../functions/surveyor-api/src/auth/origin-policy.js';

const officialOrigins = [
  'https://surveyorr.com.br',
  'https://www.surveyorr.com.br'
];

test('permite somente os origins raiz/www para autenticação por cookie', () => {
  for (const origin of officialOrigins) assert.equal(isOfficialWebOrigin(origin), true, origin);
  for (const origin of [
    'https://evil.surveyorr.com.br',
    'https://surveyorr.com.br.attacker.example',
    'http://www.surveyorr.com.br',
    'https://www.surveyorr.com.br:8443',
    'https://admin.surveyorr.com.br',
    'https://loja.surveyorr.com.br',
    'https://pagamento.surveyorr.com.br',
    'https://surveyoragrimensura.tech'
  ]) assert.equal(isOfficialWebOrigin(origin), false, origin);
});

test('CORS respeita origins extras somente quando configurados exatamente', () => {
  const policy = { configuredOrigins: ['https://qa.surveyorr.pages.dev', 'https://admin.surveyorr.com.br'] };
  assert.equal(corsOriginForRequest('https://qa.surveyorr.pages.dev', policy), 'https://qa.surveyorr.pages.dev');
  assert.equal(isOfficialWebOrigin('https://qa.surveyorr.pages.dev'), false);
  assert.equal(corsOriginForRequest('https://admin.surveyorr.com.br', policy), 'https://admin.surveyorr.com.br');
  assert.equal(isOfficialWebOrigin('https://admin.surveyorr.com.br'), false);
  assert.equal(corsOriginForRequest('https://evil.surveyorr.com.br', policy), '');
  assert.equal(corsOriginForRequest('http://localhost:5500', {
    isLocalDevelopmentOrigin: (origin) => origin === 'http://localhost:5500'
  }), 'http://localhost:5500');
});

test('preflight devolve CORS com credenciais apenas ao origin permitido', () => {
  const allowed = corsHeadersForOrigin('https://www.surveyorr.com.br');
  assert.equal(allowed['Access-Control-Allow-Origin'], 'https://www.surveyorr.com.br');
  assert.equal(allowed['Access-Control-Allow-Credentials'], 'true');
  assert.match(allowed['Access-Control-Allow-Methods'], /OPTIONS/);
  assert.equal(allowed.Vary, 'Origin');

  const rejected = corsHeadersForOrigin('https://evil.surveyorr.com.br');
  assert.equal(Object.hasOwn(rejected, 'Access-Control-Allow-Origin'), false);
  assert.equal(Object.hasOwn(rejected, 'Access-Control-Allow-Credentials'), false);
});

test('a rota OPTIONS real responde 204 e não reflete um subdomínio não confiável', () => {
  const mainUrl = new URL('../functions/surveyor-api/src/main.js', import.meta.url).href;
  const origins = [
    'https://www.surveyorr.com.br',
    'https://evil.surveyorr.com.br',
    'https://admin.surveyorr.com.br',
    'https://loja.surveyorr.com.br',
    'https://pagamento.surveyorr.com.br'
  ];
  const source = `
    import main from ${JSON.stringify(mainUrl)};
    const results = [];
    const res = {
      send(body, status, headers) { results.push({ body, status, headers }); },
      json(body, status, headers) { results.push({ body, status, headers }); }
    };
    for (const origin of ${JSON.stringify(origins)}) {
      await main({ req: { method: 'OPTIONS', path: '/api/health', headers: { origin } }, res, error() {} });
    }
    process.stdout.write(JSON.stringify(results));
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH || '',
      SystemRoot: process.env.SystemRoot || '',
      APPWRITE_PROJECT_ID: 'preflight-test-project',
      APPWRITE_API_KEY: 'preflight-test-key',
      SURVEYOR_CRYPTO_REQUIRED: 'false'
    }
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const [allowed, rejected, admin, store, payment] = JSON.parse(child.stdout);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], origins[0]);
  assert.equal(allowed.headers['Access-Control-Allow-Credentials'], 'true');
  assert.equal(rejected.status, 204);
  assert.equal(Object.hasOwn(rejected.headers, 'Access-Control-Allow-Origin'), false);
  assert.equal(Object.hasOwn(rejected.headers, 'Access-Control-Allow-Credentials'), false);
  assert.equal(admin.headers['Access-Control-Allow-Origin'], origins[2]);
  assert.equal(store.headers['Access-Control-Allow-Origin'], origins[3]);
  assert.equal(payment.headers['Access-Control-Allow-Origin'], origins[4]);
});

test('refresh cookie usa prefixo Host e expira o cookie Domain legado', () => {
  const hostCookie = hostRefreshCookieHeader('refresh.jwt');
  const legacyClear = legacyRefreshCookieClearHeader();
  assert.match(hostCookie, /^__Host-surveyor_refresh=refresh\.jwt;/);
  assert.match(hostCookie, /(?:^|; )Path=\//);
  assert.match(hostCookie, /(?:^|; )HttpOnly(?:;|$)/);
  assert.match(hostCookie, /(?:^|; )Secure(?:;|$)/);
  assert.match(hostCookie, /(?:^|; )SameSite=Strict(?:;|$)/);
  assert.match(hostCookie, /(?:^|; )Max-Age=1209600(?:;|$)/);
  assert.doesNotMatch(hostCookie, /(?:^|; )Domain=/i);
  assert.match(legacyClear, /^__Secure-surveyor_refresh=;/);
  assert.match(legacyClear, /Domain=\.surveyorr\.com\.br/);
  assert.match(legacyClear, /Max-Age=0/);

  const hostClear = hostRefreshCookieHeader('', { clear: true });
  const legacyClearAgain = legacyRefreshCookieClearHeader();
  assert.match(hostClear, /Max-Age=0/);
  assert.match(legacyClearAgain, /Max-Age=0/);
});

test('origin oficial recebe refresh token somente no cookie HttpOnly', () => {
  const delivery = refreshTokenDelivery('https://www.surveyorr.com.br', 'sensitive-refresh-token');
  assert.deepEqual(delivery.payload, { refreshCookie: true });
  assert.match(delivery.headers['Set-Cookie'], /^__Host-surveyor_refresh=/);
  assert.doesNotMatch(JSON.stringify(delivery.payload), /sensitive-refresh-token/);
});

test('ambiente não oficial recebe token no payload, sem tentar usar cookie oficial', () => {
  const delivery = refreshTokenDelivery('http://localhost:5500', 'local-refresh-token');
  assert.deepEqual(delivery.payload, { refreshToken: 'local-refresh-token', refreshCookie: false });
  assert.deepEqual(delivery.headers, {});
});

test('migra sessões oficiais do cookie Domain legado para o cookie host-only', () => {
  assert.equal(refreshCredentialFromRequest('https://www.surveyorr.com.br', {
    '__Secure-surveyor_refresh': 'legacy-refresh-token'
  }, 'body-token-must-not-be-used'), 'legacy-refresh-token');
  assert.equal(refreshCredentialFromRequest('https://surveyorr.com.br', {
    '__Host-surveyor_refresh': 'host-refresh-token',
    '__Secure-surveyor_refresh': 'legacy-refresh-token'
  }), 'host-refresh-token');
  assert.equal(refreshCredentialFromRequest('https://surveyorr.com.br', {}, 'body-token-must-not-be-used'), '');
  assert.equal(refreshCredentialFromRequest('http://localhost:5500', {}, 'local-refresh-token'), 'local-refresh-token');
});
