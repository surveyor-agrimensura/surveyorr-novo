import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve('.');
const fail = (message) => { console.error(`ERRO: ${message}`); process.exitCode = 1; };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const pkg = readJson(path.join(root, 'package.json'));
const version = String(pkg.version || '').trim();
const versionFile = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) fail(`versão inválida: ${version}`);
if (versionFile !== version) fail(`VERSION (${versionFile}) diverge de package.json (${version}).`);

for (const name of fs.readdirSync(path.join(root, 'functions'))) {
  const packagePath = path.join(root, 'functions', name, 'package.json');
  if (!fs.existsSync(packagePath)) continue;
  const fp = readJson(packagePath);
  if (fp.version !== version || fp.surveyorRelease !== version) fail(`${name}: versão fora da release.`);
}
const workerPackage = path.join(root, 'deploy/cloudflare-geoservices/package.json');
if (fs.existsSync(workerPackage) && readJson(workerPackage).version !== version) fail('GeoServices Worker fora da versão da release.');

for (const file of ['appwrite.config.json', 'RELEASE_MANIFEST.json', 'manifest.webmanifest']) {
  try { readJson(path.join(root, file)); } catch (error) { fail(`${file}: JSON inválido: ${error.message}`); }
}

const forbiddenName = /(?:-v\d|(?:^|[-_])r\d+(?:[-_.]|$)|hotfix|repair|current)/i;
for (const base of ['assets/js', 'assets/css']) {
  const walkNames = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkNames(full);
      else if (/\.(?:js|css)$/i.test(entry.name) && forbiddenName.test(entry.name)) fail(`nome legado em produção: ${path.relative(root, full)}`);
    }
  };
  walkNames(path.join(root, base));
}
if (fs.readdirSync(root).some((name) => /^R\d.*\.md$/i.test(name))) fail('documentação histórica Rxx voltou para a raiz.');

const conflictPattern = /^(?:<<<<<<<|=======|>>>>>>>)/m;
const tempPattern = /\/mnt\/data\/|tmp-html/i;
const textRoots = ['assets/js', 'assets/css', 'functions', 'scripts', 'mapa'];
const syntax = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|cjs|mjs|css|html|json)$/i.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      if (conflictPattern.test(content)) fail(`${path.relative(root, full)} contém marcador de conflito Git.`);
      if (entry.name !== 'integrity.mjs' && tempPattern.test(content)) fail(`${path.relative(root, full)} contém referência temporária de desenvolvimento.`);
      if (/\.(?:js|cjs|mjs)$/i.test(entry.name) && !full.includes(`${path.sep}vendor${path.sep}`)) syntax.push(full);
    }
  }
}
for (const rel of textRoots) walk(path.join(root, rel));
for (const file of syntax) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) fail(`${path.relative(root, file)}: falha de sintaxe.\n${result.stderr || result.stdout}`);
}
if (process.exitCode) process.exit(process.exitCode);
console.log(`OK: integridade 1.0, ${syntax.length} scripts e release ${version} validados.`);
