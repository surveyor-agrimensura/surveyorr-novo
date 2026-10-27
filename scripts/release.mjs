import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'dist', 'surveyor-frontend');
const excludedRoots = new Set([
  '.git', '.github', '.vscode', 'deploy', 'dist', 'docs', 'functions', 'node_modules',
  'scripts', 'tests', 'config'
]);
const excludedFiles = new Set([
  '.env', '.env.example', '.gitignore', '.npmrc', '.node-version',
  'package.json', 'package-lock.json', '.gitattributes', 'appwrite.config.json', 'RELEASE_MANIFEST.json'
]);
const excludedExtensions = new Set(['.zip', '.log', '.ps1']);

fs.rmSync(output, { recursive: true, force: true });

function copyDirectory(source, destination, depth = 0) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (depth === 0 && excludedRoots.has(entry.name)) continue;
    if (excludedFiles.has(entry.name)) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.wrangler' || entry.name === '.git') continue;
      copyDirectory(sourcePath, destinationPath, depth + 1);
      continue;
    }
    if (excludedExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

copyDirectory(root, output);
console.log(`Release pública criada em: ${output}`);
