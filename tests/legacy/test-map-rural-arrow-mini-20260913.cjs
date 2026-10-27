const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');
const mapa = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');
function ok(value, message) { if (!value) { console.error('FAIL:', message); process.exit(1); } console.log('OK:', message); }
ok(app.includes('const backX = tx - ux * 8') && app.includes('const px = -uy * 3.2'), 'cabeça da seta rural foi reduzida sem alterar a ancoragem');
ok(css.includes('rural-info-arrow line{stroke:var(--rural-info-arrow-color,#FFD400);stroke-width:1.4'), 'linha da seta rural usa espessura compacta');
ok(mapa.includes('id="ruralInfoArrowAnchor" cx="0" cy="0" r="2"'), 'âncora visual da seta foi reduzida');
ok(/surveyor-map-current-v21\.11\.5\.css\?v=[^"']+/.test(mapa), 'mapa usa cache-busting versionado para a seta compacta');
console.log('PASS: seta do painel de informações rurais compactada sem alterar o fluxo de consulta.');
