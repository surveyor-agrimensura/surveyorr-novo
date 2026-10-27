import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync
} from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const distRoot = join(root, 'dist');
const dist = join(distRoot, 'surveyor-frontend');

const excludedRootDirs = new Set([
  '.git',
  '.github',
  '.agents',
  '.vscode',
  'functions',
  'tests',
  'scripts',
  'deploy',
  'docs',
  'node_modules',
  'dist',
  'legacy',
  'migration',
  'validation',
  'backups',
  'backup',
  '.wrangler'
]);

const excludedRootFiles = new Set([
  'package.json',
  'package-lock.json',
  'appwrite.config.json',
  '.env',
  '.env.example',
  '.dev.vars',
  '.gitignore',
  '.node-version',
  '.npmrc',
  'RELEASE_MANIFEST.json',
  'README.md',
  'audit-v208.html'
]);

const excludedExtensions = new Set(['.bat', '.ps1', '.log', '.zip', '.pem', '.key', '.p12', '.pfx', '.md']);
const sensitiveNames = new Set(['.env', '.dev.vars', 'credentials.json', 'service-account.json', 'secrets.json']);

function shouldExclude(name, isDirectory, level) {
  const lower = String(name || '').toLowerCase();
  if (level === 0) {
    if (isDirectory && excludedRootDirs.has(name)) return true;
    if (!isDirectory && excludedRootFiles.has(name)) return true;
  }
  if (!isDirectory) {
    // R15: documentos de contratação mensal são legado interno e nunca entram no release público.
    if (lower.includes('_mensal.') || lower.includes('-mensal.')) return true;
    for (const ext of excludedExtensions) if (lower.endsWith(ext)) return true;
    if (sensitiveNames.has(lower) || lower === '.env.example') return true;
    if (lower.startsWith('.env.') && !lower.endsWith('.example')) return true;
    if (lower.startsWith('.dev.vars')) return true;
    if (/^(credentials|service-account|secrets)(?:[._-].*)?\.json$/i.test(lower)) return true;
  }
  return false;
}

function copyDirectory(source, destination, level = 0) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const src = join(source, entry.name);
    const dst = join(destination, entry.name);
    if (shouldExclude(entry.name, entry.isDirectory(), level)) continue;
    if (entry.isDirectory()) copyDirectory(src, dst, level + 1);
    else if (entry.isFile()) cpSync(src, dst);
  }
}

if (existsSync(distRoot)) rmSync(distRoot, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
copyDirectory(root, dist, 0);

function pruneEmptyDirectories(directory, keepRoot = true) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const target = join(directory, entry.name);
    pruneEmptyDirectories(target, false);
  }
  if (!keepRoot && readdirSync(directory).length === 0) rmSync(directory, { recursive: true, force: true });
}
pruneEmptyDirectories(dist);

const required = [
  'VERSION',
  'index.html',
  'assets'
];
for (const requiredPath of required) {
  const target = join(dist, requiredPath);
  if (!existsSync(target)) throw new Error(`Release inválida: ${requiredPath} não foi incluído em dist/surveyor-frontend.`);
}

const forbidden = [
  '.git', '.github', '.agents', 'functions', 'tests', 'scripts', 'deploy', 'node_modules',
  'package.json', 'package-lock.json', '.env'
];
for (const forbiddenPath of forbidden) {
  const target = join(dist, forbiddenPath);
  if (existsSync(target)) throw new Error(`Release inválida: ${forbiddenPath} não deveria existir em dist/surveyor-frontend.`);
}

function assertNoSensitiveFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) { assertNoSensitiveFiles(target); continue; }
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    const extension = extname(lower);
    if (sensitiveNames.has(lower)
      || (lower.startsWith('.env.') && !lower.endsWith('.example'))
      || lower.startsWith('.dev.vars')
      || ['.pem', '.key', '.p12', '.pfx'].includes(extension)
      || /^(credentials|service-account|secrets)(?:[._-].*)?\.json$/i.test(lower)) {
      throw new Error(`Release inválida: arquivo sensível encontrado em ${target.replace(root, '.')}.`);
    }
    if (statSync(target).size > 80 * 1024 * 1024) throw new Error(`Release inválida: arquivo individual excessivamente grande em ${target.replace(root, '.')}.`);
  }
}
assertNoSensitiveFiles(dist);

const secretScan = spawnSync(process.execPath, [join(root, 'scripts', 'security.mjs'), '--root', dist], { cwd: root, stdio: 'inherit' });
if (secretScan.status !== 0) throw new Error('Release inválida: scanner de segredos encontrou conteúdo sensível no dist público.');

console.log('OK: release pública limpa gerada em dist/surveyor-frontend/');
console.log('OK: arquivos internos e de infraestrutura removidos.');
console.log('OK: release sem o recurso legado de Cards da Página Inicial.');
