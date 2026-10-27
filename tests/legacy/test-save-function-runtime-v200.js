import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import main from '../functions/surveyor-save/src/main.js';

process.env.APPWRITE_PROJECT_ID = 'surveyor-georural-pro';
process.env.APPWRITE_DATABASE_ID = 'surveyor_db';
process.env.SURVEYOR_SAVE_APPWRITE_API_KEY = 'test-save-key';
process.env.JWT_SECRET = 'r19-test-jwt-secret-0123456789-abcdef';
process.env.SURVEYOR_DATA_KEY_V1 = Buffer.alloc(32, 7).toString('base64');
process.env.ALLOW_LOCAL_DEV_ORIGINS = 'true';

const uploaded = new Map();
const calls = [];
const originalFetch = global.fetch;

global.fetch = async (url, options = {}) => {
  const u = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  calls.push({ u, method, headers: options.headers || {} });

  if (u.includes('/storage/buckets/project_files/files') && method === 'POST') {
    const form = options.body;
    const fileId = String(form.get('fileId'));
    const blob = form.get('file');
    uploaded.set(fileId, await blob.text());
    return new Response(JSON.stringify({ $id:fileId }), { status: 201, headers: { 'content-type':'application/json' } });
  }
  const view = u.match(/\/storage\/buckets\/project_files\/files\/([^/]+)\/view$/);
  if (view && method === 'GET') return new Response(uploaded.get(decodeURIComponent(view[1])) || '', { status: 200, headers: { 'content-type':'application/json' } });
  const del = u.match(/\/storage\/buckets\/project_files\/files\/([^/]+)$/);
  if (del && method === 'DELETE') { uploaded.delete(decodeURIComponent(del[1])); return new Response('', { status: 204 }); }

  // Listagens para limite de projetos/armazenamento: banco vazio.
  if ((u.includes('/collections/projects/documents?') || u.includes('/collections/documents/documents?')) && method === 'GET') {
    return new Response(JSON.stringify({ documents: [], total: 0 }), { status: 200, headers: { 'content-type':'application/json' } });
  }

  // Consulta idempotente pelo ID: ainda não existe.
  if (u.includes('/collections/projects/documents/') && method === 'GET') {
    return new Response(JSON.stringify({ message:'not found', type:'document_not_found' }), { status: 404, headers: { 'content-type':'application/json' } });
  }
  if (u.includes('/tablesdb/surveyor_db/tables/projects/rows/') && method === 'GET') {
    return new Response(JSON.stringify({ message:'not found', type:'row_not_found' }), { status: 404, headers: { 'content-type':'application/json' } });
  }

  // Criação da linha do projeto no endpoint legado suportado.
  if (u.endsWith('/databases/surveyor_db/collections/projects/documents') && method === 'POST') {
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify({ $id: body.documentId, ...body.data }), { status: 201, headers: { 'content-type':'application/json' } });
  }

  throw new Error(`Mock não implementado: ${method} ${u}`);
};

function b64url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

function signAccessToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg:'HS256', typ:'JWT' };
  const payload = {
    iss:'surveyor-appwrite-function', type:'access', sub:'user-1', email:'teste@surveyor.local',
    iat:now, exp:now + 900,
    user:{
      id:'user-1', email:'teste@surveyor.local', name:'Usuário Teste', role:'user', status:'active', isActive:true,
      isSubuser:false, plan:'basic_annual', planSlug:'basic_annual', expiresAt:new Date(Date.now()+86400000).toISOString(),
      planLimits:{ projectLimit:null, storageLimitBytes:209715200, storageBaseBytes:209715200, storageMaxBytes:2147483648, downloadDailyLimit:5, exportDailyLimit:5 }, permissions:['projects:create','projects:edit-own','projects:view-own']
    },
    ...overrides
  };
  const a=b64url(header), b=b64url(payload);
  const sig=crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${a}.${b}`).digest('base64url');
  return `${a}.${b}.${sig}`;
}

function resRecorder() {
  return {
    json(payload, status=200, headers={}) { return { payload, status, headers }; },
    send(body, status=200, headers={}) { return { body, status, headers }; }
  };
}

try {
  const malicious = {
    project: {
      name: 'Projeto Teste',
      userId: 'attacker-owner',
      metadata: { createdByUserId:'attacker', workspaceOwnerUserId:'attacker' }
    },
    features: [],
    __surveyorSaveTransport: { version:1, accessToken:signAccessToken(), idempotencyKey:'runtime-create-001', requestId:'runtime-create-001' }
  };
  const created = await main({
    req: { method:'POST', path:'/api/projects', headers:{ origin:'http://localhost:5500', 'content-type':'text/plain;charset=UTF-8' }, body: JSON.stringify(malicious) },
    res: resRecorder(), log() {}, error() {}
  });
  assert.equal(created.status, 201);
  assert.equal(created.payload.ok, true);
  assert.equal(created.payload.project.ownerUserId, 'user-1', 'owner deve vir da sessão, não do browser');
  assert.ok(!calls.some(c => c.u.includes('/api/auth/me')), 'Save Function não deve consultar /api/auth/me a cada salvamento');
  assert.ok(uploaded.size >= 1, 'payload deve ser gravado no Storage');
  const storedPayload = [...uploaded.values()][0];
  assert.ok(String(storedPayload || '').length > 20, 'payload protegido deve existir no Storage');

  const blockedOrigin = await main({
    req: { method:'POST', path:'/api/projects', headers:{ origin:'https://evil.example', 'content-type':'text/plain' }, body: JSON.stringify(malicious) },
    res: resRecorder(), log() {}, error() {}
  });
  assert.equal(blockedOrigin.status, 403);

  const invalidTokenPayload = JSON.parse(JSON.stringify(malicious));
  invalidTokenPayload.__surveyorSaveTransport.accessToken = 'invalid-token';
  const invalid = await main({
    req: { method:'POST', path:'/api/projects', headers:{ origin:'http://localhost:5500', 'content-type':'text/plain' }, body: JSON.stringify(invalidTokenPayload) },
    res: resRecorder(), log() {}, error() {}
  });
  assert.equal(invalid.status, 401);
  console.log('OK R19: surveyor-save valida JWT localmente, força owner server-side e rejeita origem externa.');
} finally {
  global.fetch = originalFetch;
}
