import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiConfig = fs.readFileSync('assets/js/core/api.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const login = [fs.readFileSync('login/index.html', 'utf8'), fs.readFileSync('assets/js/core/login.js', 'utf8'), fs.readFileSync('assets/js/core/login-support.js', 'utf8')].join('\n');
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const support = fs.readFileSync('functions/surveyor-support/src/main.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.match(apiConfig, /21\.11\.5-map-ui/);
assert.match(api, /function isLocalDevelopmentOrigin\(origin\)/);
assert.match(api, /hostname === 'localhost'/);
assert.match(api, /allowed\.includes\(origin\) \|\| isLocalDevelopmentOrigin\(origin\)/);
assert.match(support, /function isLocalDevelopmentOrigin\(origin\)/);
assert.match(support, /allowed\.includes\(origin\) \|\| isLocalDevelopmentOrigin\(origin\)/);
assert.doesNotMatch(api, /origin === 'null'/);
assert.doesNotMatch(support, /origin === 'null'/);
assert.match(auth, /LOCAL_FILE_PROTOCOL/);
assert.match(auth, /cache: 'no-store'/);
assert.match(login, /\.login-support-launcher[\s\S]*?width: 56px;[\s\S]*?height: 56px;/);
assert.match(login, /\.login-support-lottie[\s\S]*?width: 30px;[\s\S]*?height: 30px;/);
assert.match(login, /bottom: 88px;/);
assert.match(login, /scripts\/windows\/INICIAR_SURVEYOR_LOCAL\.bat/);
assert.equal(pkg.scripts['dev:local'], 'node scripts/dev.mjs');
assert.ok(fs.existsSync('scripts/windows/INICIAR_SURVEYOR_LOCAL.bat'));
assert.ok(fs.existsSync('scripts/dev.mjs'));
console.log('OK: acesso local seguro e botão de suporte compacto v21.9.422.');
