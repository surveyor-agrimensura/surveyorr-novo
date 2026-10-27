const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');
function ok(cond, msg){ if(!cond){ console.error('FALHA:', msg); process.exit(1); } }
ok(app.includes('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'), 'endpoint NASA GIBS ausente');
ok(app.includes('HLS_S30_Nadir_BRDF_Adjusted_Reflectance'), 'camada HLS Sentinel-2 ausente');
ok(app.includes('HLS_L30_Nadir_BRDF_Adjusted_Reflectance'), 'camada HLS Landsat ausente');
ok(!app.includes("lyrs=s&x={x}&y={y}&z={z}"), 'Google Satellite legado ainda presente');
ok(!app.includes("lyrs=y&x={x}&y={y}&z={z}"), 'Google Hybrid legado ainda presente');
ok(html.includes('Satélite recente · NASA HLS'), 'rótulo do satélite recente ausente');
ok(html.includes('Satélite recente + nomes'), 'rótulo do híbrido recente ausente');
console.log('OK: satélite gratuito atualizado via NASA HLS configurado no Surveyor.');
