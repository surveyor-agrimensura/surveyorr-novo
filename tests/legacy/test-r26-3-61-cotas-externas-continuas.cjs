const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const files = [
  path.join(root, 'assets/js/features/mapas/app.js'),
  path.join(root, 'dist/surveyor-frontend/assets/js/features/mapas/app.js')
];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('lockNormalOffset = false')) throw new Error(`faltou parâmetro de estabilização em ${file}`);
  if (!src.includes("lockNormalOffset: options.lockNormalOffset === true && placement === 'outside'")) throw new Error(`faltou lock no motor CAD em ${file}`);
  const count = (src.match(/lockNormalOffset: true/g) || []).length;
  if (count < 4) throw new Error(`esperava ao menos 4 composições estabilizadas; encontrei ${count} em ${file}`);
  if (!src.includes('? [[0, 0], [t1, 0], [-t1, 0], [t2, 0], [-t2, 0], [t3, 0], [-t3, 0]]')) throw new Error(`anti-colisão tangencial não encontrado em ${file}`);
}
const a = fs.readFileSync(files[0]);
const b = fs.readFileSync(files[1]);
if (!a.equals(b)) throw new Error('fonte e dist do maps estão divergentes');
console.log('OK R26.3.61: cotas externas mantêm faixa normal estável e fonte/dist estão sincronizados.');
