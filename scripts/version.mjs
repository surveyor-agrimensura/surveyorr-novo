import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const packagePath = path.join(root, 'package.json');
const rootPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = String(rootPackage.version || '').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`Versão inválida: ${version}`);

const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const syncPackage = (file) => {
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.version = version;
  data.surveyorRelease = version;
  writeJson(file, data);
  const lockFile = path.join(path.dirname(file), 'package-lock.json');
  if (fs.existsSync(lockFile)) {
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    lock.version = version;
    if (lock.packages?.['']) {
      lock.packages[''].version = version;
      lock.packages[''].surveyorRelease = version;
    }
    writeJson(lockFile, lock);
  }
};

fs.writeFileSync(path.join(root, 'VERSION'), `${version}\n`, 'utf8');
rootPackage.surveyorRelease = version;
writeJson(packagePath, rootPackage);

// O lockfile da raiz também pertence à release. Mantê-lo sincronizado evita
// reinstalações exibindo a antiga linha 21.x depois da consolidação 1.0.
const rootLockPath = path.join(root, 'package-lock.json');
if (fs.existsSync(rootLockPath)) {
  const lock = JSON.parse(fs.readFileSync(rootLockPath, 'utf8'));
  lock.version = version;
  if (lock.packages?.['']) {
    lock.packages[''].version = version;
    lock.packages[''].surveyorRelease = version;
  }
  writeJson(rootLockPath, lock);
}

const functionsDir = path.join(root, 'functions');
if (fs.existsSync(functionsDir)) {
  for (const name of fs.readdirSync(functionsDir)) syncPackage(path.join(functionsDir, name, 'package.json'));
}
syncPackage(path.join(root, 'deploy', 'cloudflare-geoservices', 'package.json'));

const manifestPath = path.join(root, 'RELEASE_MANIFEST.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.release = version;
  manifest.frontend = { ...(manifest.frontend || {}), version };
  for (const key of ['api', 'support', 'geoservices', 'geoservicesAppwriteFallback']) {
    if (manifest[key]) manifest[key].version = version;
  }
  if (manifest.api) manifest.api.bundledSourceVersion = version;
  manifest.releaseChannel = version.includes('-') ? 'candidate' : 'stable';
  writeJson(manifestPath, manifest);
}

const runtimeVersionFiles = [
  [path.join(root, 'assets/js/core/api.js'), /const appVersion = '[^']*';/, `const appVersion = '${version}';`],
  [path.join(root, 'assets/js/features/mapa/bootstrap.js'), /globalThis\.__GEORURAL_BUILD__ = '[^']*';/, `globalThis.__GEORURAL_BUILD__ = '${version}';`],
  [path.join(root, 'assets/js/core/document-scope.js'), /const VERSION = '[^']*';/, `const VERSION = '${version}';`],
  [path.join(root, 'assets/js/features/mapa/shapefile.js'), /const VERSION = '[^']*';/, `const VERSION = '${version}';`],
  [path.join(root, 'functions/surveyor-api/src/main.js'), /const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`],
  [path.join(root, 'functions/surveyor-save/src/main.js'), /const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`],
  [path.join(root, 'functions/surveyor-support/src/main.js'), /const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`],
  [path.join(root, 'functions/surveyor-geoservices/src/main.js'), /const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`],
  [path.join(root, 'deploy/cloudflare-geoservices/src/worker.js'), /const VERSION = '[^']*';/, `const VERSION = '${version}';`]
];
for (const [file, pattern, replacement] of runtimeVersionFiles) {
  if (!fs.existsSync(file)) continue;
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(pattern, replacement), 'utf8');
}

const swPath = path.join(root, 'sw.js');
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8').replace(/const SURVEYOR_SW_VERSION = '[^']*';/, `const SURVEYOR_SW_VERSION = '${version}';`);
  fs.writeFileSync(swPath, sw, 'utf8');
}

// A versão dos assets é centralizada no package.json. HTML deixa de carregar
// dezenas de cache-busters históricos independentes.
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['dist', 'node_modules', '.git', 'docs', 'tests'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.isFile() || !/\.(?:html|js|mjs|cjs)$/i.test(entry.name)) continue;
    let content = fs.readFileSync(full, 'utf8');
    if (entry.name.endsWith('.html')) {
      content = content.replace(/((?:src|href)=["'](?:\/|\.\.\/|\.\/)*assets\/[^"'?]+)(?:\?v=[^"']+)?(["'])/g, `$1?v=${version}$2`);
    }
    content = content.replace(/((?:\/|\.\.\/|\.\/)?(?:assets\/|manifest\.webmanifest|earth-3d\/)[^"'`\s?]*\?v=)[^&"'`\s]+/g, `$1${version}`);
    fs.writeFileSync(full, content, 'utf8');
  }
}
walk(root);
console.log(`OK: versão ${version} sincronizada em packages, manifesto, PWA e assets HTML.`);
