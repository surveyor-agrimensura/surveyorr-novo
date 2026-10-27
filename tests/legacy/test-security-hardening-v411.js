import fs from 'node:fs';
import assert from 'node:assert/strict';

const apiConfig = fs.readFileSync('assets/js/core/api.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const support = fs.readFileSync('functions/surveyor-support/src/main.js', 'utf8');
const geoFallback = fs.readFileSync('functions/surveyor-geoservices/src/main.js', 'utf8');

assert.match(apiConfig, /if \(!isLocalDevelopment\)/, 'Overrides precisam ser removidos em produção.');
assert.match(apiConfig, /allowedHosts/, 'Overrides locais precisam usar allowlist.');
assert.doesNotMatch(apiConfig, /localStorage\.setItem\('GEORURAL_API_URL_OVERRIDE'/, 'Override antigo da API ainda pode ser persistido.');
assert.doesNotMatch(apiConfig, /normalizeUrl\(apiOverride \|\| defaultApiBaseUrl\)/, 'Resolução insegura antiga da API ainda existe.');

assert.match(auth, /Authorization.*Bearer/, 'Frontend deve enviar o access token pelo cabeçalho Authorization.');
assert.doesNotMatch(auth, /headers\.set\('X-Surveyor-Token'/, 'Frontend ainda duplica o token em cabeçalho legado.');
assert.doesNotMatch(auth, /georural-pro\.onrender\.com/, 'Endpoint legado do Render ainda existe no cliente de autenticação.');

assert.match(api, /verifyJwtType\(token, 'access'/, 'Rotas protegidas precisam exigir token do tipo access.');
assert.match(api, /const suppliedRefreshToken = refreshTokenFromRequest\(request, input\);[\s\S]*verifyJwtType\(suppliedRefreshToken, 'refresh'/, 'Renovação precisa exigir token do tipo refresh, inclusive quando armazenado em cookie HttpOnly.');
assert.match(api, /type: 'access', sub: user\.id/, 'Access tokens precisam carregar type=access.');
assert.doesNotMatch(api, /queryValue\(request, 'accessToken'\)/, 'Access token ainda é aceito pela URL.');
assert.doesNotMatch(api, /queryValue\(request, 'token'\)/, 'Token de sessão genérico ainda é aceito pela URL.');
assert.match(api, /filter\(\(item\) => item && item !== '\*'\)/, 'CORS precisa remover wildcard da configuração.');
assert.doesNotMatch(api, /github\\\.io\$\/i/, 'CORS ainda libera qualquer subdomínio github.io.');
assert.match(api, /APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/, 'Versão segura da API não foi aplicada.');


assert.match(support, /APP_VERSION = '1\.1\.0'/, 'Function de suporte não foi versionada após o hardening.');
assert.doesNotMatch(support, /origin \|\| '\*'/, 'Suporte ainda reflete qualquer Origin.');
assert.match(support, /allowed\.includes\(origin\)/, 'Suporte precisa validar a origem pela allowlist.');
assert.match(geoFallback, /APP_VERSION = '2\.19\.202-security-hardening'/, 'Fallback GeoServices não foi versionado após o hardening.');
assert.doesNotMatch(geoFallback, /configured\.includes\('\*'\)/, 'Fallback GeoServices ainda aceita wildcard de CORS.');
assert.doesNotMatch(geoFallback, /\.github\\.io\$\//, 'Fallback GeoServices ainda libera qualquer GitHub Pages.');

console.log('OK v21.9.420: endpoints fixos, JWTs tipados, tokens fora da URL e CORS por allowlist.');
