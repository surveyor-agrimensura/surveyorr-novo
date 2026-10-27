import assert from 'node:assert/strict';
import main from '../functions/surveyor-api/src/main.js';

process.env.APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || 'surveyor-test';
process.env.APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || 'appwrite-test-key';
process.env.CONECTA_PLUS_API_KEY = 'conecta-plus-runtime-test-key-1234567890-abcdef';

function responseRecorder() {
  return {
    json(payload, status = 200, headers = {}) {
      return { payload, status, headers };
    },
    send(body, status = 200, headers = {}) {
      return { body, status, headers };
    },
    binary(buffer, status = 200, headers = {}) {
      return { buffer, status, headers };
    }
  };
}

async function call(path, headers = {}) {
  return main({
    req: { method: 'GET', path, headers },
    res: responseRecorder(),
    log() {},
    error() {}
  });
}

const publicHealth = await call('/api/health');
assert.equal(publicHealth.status, 200);
assert.equal(publicHealth.payload.version, '2.23.1-map-ux-21.11.2');
assert.equal(publicHealth.payload.readinessEndpoint, '/api/ready');
assert.equal(publicHealth.payload.integrations, undefined, 'health publico nao deve expor configuracao das integracoes');

const denied = await call('/api/integrations/conecta-plus/health');
assert.equal(denied.status, 403);
assert.equal(denied.payload.ok, false);

const deniedWrongKey = await call('/api/integrations/conecta-plus/health', {
  Authorization: 'Bearer chave-incorreta'
});
assert.equal(deniedWrongKey.status, 403);

const authorized = await call('/api/integrations/conecta-plus/health', {
  Authorization: `Bearer ${process.env.CONECTA_PLUS_API_KEY}`
});
assert.equal(authorized.status, 200);
assert.equal(authorized.payload.integration, 'Conecta+');
assert.equal(authorized.payload.version, '2.23.1-map-ux-21.11.2');
assert.deepEqual(authorized.payload.reminderDays, [7, 1]);
assert.ok(authorized.payload.capabilities.includes('users:expiring'));
assert.ok(authorized.payload.capabilities.includes('notifications:mark-sent'));

assert.match(authorized.headers['Access-Control-Allow-Headers'], /X-Conecta-Plus-Key/);
assert.match(authorized.headers['Access-Control-Allow-Headers'], /X-API-Key/);

console.log('OK v21.9.404 runtime: health público e autenticação da API Conecta+ validados.');
