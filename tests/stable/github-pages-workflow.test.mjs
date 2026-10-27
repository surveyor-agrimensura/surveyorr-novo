import fs from 'node:fs';
import assert from 'node:assert/strict';

const file = '.github/workflows/pages.yml';
assert.ok(fs.existsSync(file), 'workflow oficial do GitHub Pages ausente');
const yaml = fs.readFileSync(file, 'utf8');

assert.match(yaml, /contents:\s*read/, 'workflow deve limitar contents a read');
assert.match(yaml, /pages:\s*write/, 'workflow precisa de pages: write');
assert.match(yaml, /id-token:\s*write/, 'workflow precisa de id-token: write para actions\/deploy-pages');
assert.match(yaml, /actions\/deploy-pages@v5/, 'deploy deve usar actions/deploy-pages@v5');
assert.match(yaml, /actions\/upload-pages-artifact@v4/, 'workflow deve produzir o artefato Pages antes do deploy');
assert.match(yaml, /path:\s*\.\/dist\/surveyor-frontend/, 'Pages deve publicar somente dist/surveyor-frontend');
assert.doesNotMatch(yaml, /path:\s*\.\/?\s*$/m, 'workflow não pode publicar a raiz privada do repositório');

assert.doesNotMatch(yaml, /^\s{2}build:\s*$/m, 'build e deploy não devem voltar a jobs separados, pois reexecutar apenas o deploy perde o artefato do attempt atual');
assert.match(yaml, /^\s{2}deploy:\s*$/m, 'workflow deve possuir um único job transacional de build + upload + deploy');
assert.match(yaml, /PAGES_ARTIFACT_NAME:\s*github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/, 'artefato Pages deve ser único por run e attempt');
assert.match(yaml, /name:\s*\$\{\{ env\.PAGES_ARTIFACT_NAME \}\}[\s\S]*path:\s*\.\/dist\/surveyor-frontend/, 'upload deve usar o nome transacional do artefato');
assert.match(yaml, /artifact_name:\s*\$\{\{ env\.PAGES_ARTIFACT_NAME \}\}/, 'deploy deve buscar exatamente o artefato criado pelo mesmo job');

const verifyPos = yaml.indexOf('run: npm run verify');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.match(packageJson.scripts.verify, /npm run build/, 'verify deve gerar o build antes de publicar');
assert.match(packageJson.scripts.verify, /npm test/, 'verify deve executar testes antes de publicar');
const uploadPos = yaml.indexOf('uses: actions/upload-pages-artifact@v4');
const deployPos = yaml.indexOf('uses: actions/deploy-pages@v5');
assert.ok(verifyPos >= 0 && uploadPos > verifyPos && deployPos > uploadPos, 'ordem obrigatória deve ser verify (incluindo testes e build) → upload → deploy no mesmo job');

console.log('PASS github pages: verify/build/upload/deploy transacionais, OIDC habilitado e artefato único por attempt.');
