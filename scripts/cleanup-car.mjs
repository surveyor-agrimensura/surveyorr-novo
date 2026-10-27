import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve('.');
const legacyRoot = join(root, 'dados', 'car');
const legacyBa = join(legacyRoot, 'BA');

let jsonlCount = 0;
if (existsSync(legacyBa)) {
  jsonlCount = readdirSync(legacyBa, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl'))
    .length;
}

let gitHandled = false;
try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['rm', '-r', '--ignore-unmatch', 'dados/car/BA'], { cwd: root, stdio: 'inherit' });
  gitHandled = true;
} catch {
  // ZIP/pasta sem .git: a limpeza física abaixo continua suficiente.
}

if (existsSync(legacyBa)) rmSync(legacyBa, { recursive: true, force: true });
if (existsSync(legacyRoot)) {
  const rest = readdirSync(legacyRoot);
  if (rest.length === 0) rmSync(legacyRoot, { recursive: true, force: true });
}

console.log(`OK: removidos ${jsonlCount} JSONL cadastrais legados de dados/car/BA.`);
console.log(gitHandled
  ? 'OK: exclusões também foram registradas no índice do Git. Faça git add -A/commit normalmente.'
  : 'INFO: pasta sem repositório Git; limpeza física concluída.');
