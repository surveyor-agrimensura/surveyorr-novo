import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'assets/js/core/car-menu.js',
  'consulta-car/index.html',
  'admin/index.html',
  'index.html'
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Arquivo ausente: ${rel}`);
}

const hotfix = fs.readFileSync(path.join(root, required[0]), 'utf8');
if (!hotfix.includes('Consulta Pública CAR')) throw new Error('Hotfix não contém o item Consulta Pública CAR');
if (!hotfix.includes('/consulta-car/')) throw new Error('Hotfix não aponta para /consulta-car/');
if (!hotfix.includes('MutationObserver')) throw new Error('Hotfix não protege contra reconstrução assíncrona do menu');

for (const rel of ['index.html','admin/index.html','consulta-car/index.html']) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  if (!html.includes('car-menu.js')) {
    throw new Error(`Hotfix não carregado em ${rel}`);
  }
}

const layout = fs.readFileSync(path.join(root, 'assets/js/core/layout.js'), 'utf8');
if (!layout.includes("routeUrl('/consulta-car/')")) throw new Error('Layout principal perdeu Consulta CAR');

console.log('OK: Consulta Pública CAR está protegida no menu Ferramentas e a rota existe.');
