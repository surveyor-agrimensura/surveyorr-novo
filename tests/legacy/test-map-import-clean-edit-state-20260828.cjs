const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');
const ok = (condition, message) => { if (!condition) throw new Error(message); };

const resetMatch = app.match(/function resetInteractionModes\(options\s*=\s*\{\}\)\s*\{([\s\S]*?)\n\s*\}/);
ok(resetMatch, 'resetInteractionModes não encontrado');
const resetBody = resetMatch[1];
ok(resetBody.indexOf('disableActiveHandler();') >= 0, 'reset não desliga o handler Leaflet ativo');
ok(resetBody.indexOf('endDirectEditMode({ apply: true });') >= 0, 'reset não encerra o estado de edição direta');
ok(
  resetBody.indexOf('disableActiveHandler();') < resetBody.indexOf('endDirectEditMode({ apply: true });'),
  'handler do Leaflet precisa ser desligado antes de limpar directEditMode para não deixar editor fantasma'
);

ok(
  /els\.triggerProjectImport\?\.addEventListener\('click',[\s\S]*?resetInteractionModes\(\);[\s\S]*?vertexMarkers\.clearLayers\(\);[\s\S]*?els\.importFile\?\.click\(\)/.test(app),
  'abrir importação de projeto deve cancelar ferramentas/edição e limpar vértices'
);
ok(
  /els\.importFile\.onchange\s*=\s*async[\s\S]*?resetInteractionModes\(\);[\s\S]*?vertexMarkers\.clearLayers\(\);/.test(app),
  'onchange da importação precisa repetir o reset defensivo'
);

const advanced = app.match(/loadCollection\(result\.geojson\);([\s\S]*?)toast\('Arquivo geoespacial importado como área do projeto\.'/);
ok(advanced && /clearSelection\(\);/.test(advanced[1]), 'Shapefile importado deve terminar sem seleção automática');
ok(advanced && /vertexMarkers\.clearLayers\(\);/.test(advanced[1]), 'Shapefile importado deve terminar sem marcadores de vértice');

ok(
  /body\.georural-map-page:not\(\.surveyor-direct-editing\) \.leaflet-editing-icon[\s\S]*?display:none!important;[\s\S]*?pointer-events:none!important;/.test(css),
  'CSS precisa esconder/desativar handles do Leaflet fora do modo Editar'
);

console.log('PASS: importação limpa — editor Leaflet é encerrado antes do reset e polígonos importados não ficam cobertos por alças de vértice.');
