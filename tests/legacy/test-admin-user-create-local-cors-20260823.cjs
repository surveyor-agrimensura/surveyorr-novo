const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const auth = fs.readFileSync(path.join(root, 'assets/js/core/auth.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin/index.html'), 'utf8');
function ok(v, m){ if(!v) throw new Error(m); }
const start = auth.indexOf('async function createUser(payload)');
const end = auth.indexOf('async function updateRemoteUser', start);
const block = auth.slice(start, end);
ok(start > -1 && end > start, 'createUser não localizado');
ok(!/idempotencyKey\s*:/.test(block), 'createUser ainda envia Idempotency-Key');
ok(/timeoutMs:\s*60000/.test(block), 'timeout de criação não foi ampliado');
ok(/recoveredAfterNetworkError/.test(block), 'recuperação pós-falha de rede ausente');
ok(/creationRequestId/.test(block), 'comentário/garantia de creationRequestId ausente');
ok(/parsed\.port === '5500'/.test(api), 'localhost:5500 não está liberado no CORS da API');
ok(/Access-Control-Allow-Headers[^\n]*Authorization/.test(api), 'Authorization ausente no CORS');
ok(/assets\/js\/core\/auth\.js\?v=[^\"']+/.test(admin), 'admin não versiona o carregamento do auth');
console.log('OK: criação de usuário local/CORS endurecida e sem preflight extra de Idempotency-Key.');
