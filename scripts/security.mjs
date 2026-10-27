import fs from 'node:fs';
import path from 'node:path';

const rootArgIndex = process.argv.findIndex((arg) => arg === '--root' || arg === '--path');
const rootArg = rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : '';
const root = path.resolve(rootArg || process.cwd());
const customRoot = Boolean(rootArg);
const ignoredDirs = new Set(['.git', 'node_modules', 'backups', '.cache', 'coverage', ...(customRoot ? [] : ['dist'])]);
const textExtensions = new Set(['.js','.mjs','.cjs','.json','.html','.css','.md','.txt','.yml','.yaml','.toml','.ini','.conf','.example','.ps1','.bat','.sh']);
const explicitNames = new Set(['.env.example','.gitignore','.npmrc','CNAME']);
const findings = [];
const placeholder = /(COLE_|SUA_|SEU_|troque_|gere_|example|exemplo|changeme|your[_-]|<[^>]+>|\.\.\.)/i;
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['openai-openrouter-key', /\b(?:sk-|sk-or-v1-)[A-Za-z0-9_-]{24,}\b/g],
  ['brevo-key', /\bxkeysib-[A-Za-z0-9_-]{20,}\b/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g]
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    if (!textExtensions.has(ext) && !explicitNames.has(entry.name)) continue;
    const stat = fs.statSync(full);
    if (stat.size > 2_000_000) continue;
    let text;
    try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
    for (const [kind, re] of patterns) {
      re.lastIndex = 0;
      for (const match of text.matchAll(re)) {
        const value = match[1] || match[0];
        if (placeholder.test(value)) continue;
        const before = text.slice(0, match.index || 0);
        const line = before.split('\n').length;
        findings.push(`${path.relative(root, full)}:${line} ${kind}`);
      }
    }
  }
}
walk(root);
if (findings.length) {
  console.error('Possíveis segredos reais encontrados:');
  findings.slice(0, 50).forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log('OK: nenhum padrão de segredo real conhecido foi encontrado nos arquivos de texto do repositório.');
