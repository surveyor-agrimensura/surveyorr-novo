const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');
const mapa = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');
function ok(value, message){
  if(!value){ console.error(`FAIL: ${message}`); process.exit(1); }
  console.log(`OK: ${message}`);
}
ok(css.includes('centralização óptica/geométrica da interrogação de consulta'), 'hotfix de centralização está documentado no CSS');
ok(/\.map-layer-info-help\{[\s\S]*?display:flex!important;[\s\S]*?align-items:center!important;[\s\S]*?justify-content:center!important;/.test(css), 'interrogação usa flexbox centralizado');
ok(/\.map-layer-info-help::before,[\s\S]*?\.map-layer-info-help::after\{[\s\S]*?content:none!important;/.test(css), 'pseudo-elementos antigos não deslocam o caractere');
ok(css.includes('box-sizing:border-box!important;'), 'caixa do botão preserva dimensão externa com a borda');
ok(/map-workspace-clean-v21\.11\.5\.css\?v=[^"']+/.test(mapa), 'cache-bust carrega o CSS centralizado');
console.log('PASS: marcador de interrogação centralizado');
