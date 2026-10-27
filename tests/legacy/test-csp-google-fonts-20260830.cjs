const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const htmlFiles = [];
function walk(dir){
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (['node_modules','.git','dist'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(root);

const cspFiles = htmlFiles.filter((file) => /Content-Security-Policy/i.test(fs.readFileSync(file,'utf8')));
if (!cspFiles.length) throw new Error('Nenhuma página com CSP encontrada.');
for (const file of cspFiles) {
  const text = fs.readFileSync(file,'utf8');
  if (!/style-src[^;]*https:\/\/fonts\.googleapis\.com/i.test(text)) {
    throw new Error(`CSP sem fonts.googleapis.com em style-src: ${path.relative(root,file)}`);
  }
  if (!/font-src[^;]*https:\/\/fonts\.gstatic\.com/i.test(text)) {
    throw new Error(`CSP sem fonts.gstatic.com em font-src: ${path.relative(root,file)}`);
  }
}
console.log(`PASS: Google Fonts liberado explicitamente na CSP de ${cspFiles.length} páginas.`);
