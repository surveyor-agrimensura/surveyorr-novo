import fs from 'node:fs';

const budgets = new Map([
  ['assets/css/core/ui.css', 12],
  ['assets/css/features/mapa/app.css', 30],
  ['assets/css/core/documents.css', 0]
]);

let failed = false;
for (const [file, maxImportant] of budgets) {
  const css = fs.readFileSync(file, 'utf8');
  const important = (css.match(/!important/g) || []).length;
  if (important > maxImportant) {
    console.error(`CSS: ${file} voltou a acumular !important (${important} > ${maxImportant}).`);
    failed = true;
  }
  if (/\b(?:HOTFIX|PATCH\s+20\d\d|assets\/css\/.*\.css\s*=+)/i.test(css)) {
    console.error(`CSS: ${file} contém bloco legado/patch incorporado na folha canônica.`);
    failed = true;
  }
  console.log(`CSS: ${file} — ${important} !important (limite ${maxImportant}).`);
}

if (fs.existsSync('assets/css/features/mapa/workspace.css')) {
  console.error('CSS: workspace.css reapareceu; o mapa deve usar apenas app.css como folha canônica consolidada.');
  failed = true;
}
const mapHtml = fs.readFileSync('mapa/index.html', 'utf8');
if (/workspace\.css/i.test(mapHtml)) {
  console.error('CSS: mapa/index.html ainda referencia workspace.css.');
  failed = true;
}


// Registro de declarações da base oficial: além de contar, detecta a troca
// silenciosa de um !important antigo por outro dentro do mesmo orçamento.
// Remoções são permitidas; adições exigem revisão e atualização explícita da base.
const baseline = JSON.parse(fs.readFileSync('scripts/css-important-baseline.json', 'utf8'));
function cssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? cssFiles(path) : entry.isFile() && path.endsWith('.css') ? [path] : [];
  });
}
function importantLines(css) {
  return css.split(/\r?\n/).filter(line => line.includes('!important'))
    .map(line => line.trim());
}
// Inclui folhas CSS fora de assets/css, usadas na página inicial.
const actualFiles = cssFiles('assets').sort();
// Uma folha nova deve ser revisada mesmo que ainda não contenha !important.
// Isso evita que estilos concorrentes escapem do inventário de cascata.
for (const file of actualFiles) {
  if (!Object.hasOwn(baseline, file)) {
    console.error(`CSS: folha sem registro na auditoria: ${file}. Atualize o inventário após revisão.`);
    failed = true;
  }
}
let occurrences = 0;
for (const file of actualFiles) {
  const css = fs.readFileSync(file, 'utf8');
  const lines = importantLines(css);
  occurrences += (css.match(/!important/g) || []).length;
  const allowed = new Map(Object.entries(baseline[file] || {}));
  for (const line of lines) {
    const count = allowed.get(line) || 0;
    if (count === 0) {
      console.error(`CSS: nova declaração !important não autorizada em ${file}: ${line.slice(0, 140)}`);
      failed = true;
    } else allowed.set(line, count - 1);
  }
}
const baselineFiles = Object.keys(baseline);
for (const file of baselineFiles) {
  if (!actualFiles.includes(file)) {
    console.log(`CSS: folha antiga removida: ${file}.`);
  }
}
console.log(`CSS: ${actualFiles.length} folhas auditadas, ${occurrences} ocorrências de !important.`);

if (failed) process.exit(1);
console.log('PASS css-integrity: cascata canônica dentro dos limites de especificidade forçada.');
