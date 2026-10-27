import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('mapa/index.html', 'utf8');
const controls = fs.readFileSync('assets/js/features/mapa/controls.js', 'utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');

assert.match(html, /data-point-type-badge>P-01 · Ponto</, 'Painel de inserção deve iniciar com P, não V virtual.');
assert.match(html, /id="gpsPointTypeSelect"[^>]*class="gps-point-type-select"/, 'P e M devem ser selecionáveis na entrada manual.');
assert.match(html, /id="gpsPointHasMark"[^>]*class="gps-point-has-mark"/, 'Painel deve oferecer checkbox de marco para pontos importados.');
assert.match(controls, /const POINT_TYPE_META = Object\.freeze\(\{[\s\S]*V:[\s\S]*Virtual[\s\S]*P:[\s\S]*Ponto[\s\S]*M:[\s\S]*Marco/, 'V/P/M devem ter uma classificação única no controlador.');
assert.match(controls, /const selector = row\.querySelector\('\.gps-point-type-select'\);[\s\S]*normalizePointType\(selector\.value \|\| 'P'\)/, 'Classificação manual e importada deve ser lida do seletor explícito P/M.');
assert.match(controls, /source = imported \? String\(row\.dataset\.importSource \|\| 'file-import'\) : 'manual-map-point'/, 'Origem manual/importada deve permanecer explícita.');
assert.match(controls, /vertexLabel: code,[\s\S]*surveyPointType: type,[\s\S]*hasPhysicalMark: type === 'M'/, 'Classificação deve acompanhar o ponto até o rótulo técnico.');
assert.match(controls, /row\.dataset\.imported = '1';[\s\S]*explicitType === 'M'/, 'Importação deve armar a linha como P e permitir promovê-la para M.');
assert.match(controls, /Use Tipo do ponto para selecionar P \(ponto\) ou M \(marco\)/, 'Feedback deve explicar o seletor P/M.');
assert.match(app, /surveyPointType,[\s\S]*pointCode:[\s\S]*hasPhysicalMark:/, 'Ponto salvo no projeto deve persistir tipo, código e marco físico.');
assert.match(app, /importedPointTypes: normalizedTypes,[\s\S]*importedSourcePointNames:/, 'Polígono criado dos pontos deve persistir tipos e nomes de origem.');
assert.match(app, /surveyor-gps-pin-\$\{pointType\.toLowerCase\(\)\}/, 'Ícone do ponto deve carregar o tipo V/P/M.');
assert.match(app, /<text[^>]*>\$\{pointType\}<\/text>/, 'Marcador deve identificar visualmente V/P/M.');
assert.match(css, /\.gps-point-type-badge\{/, 'Classificação V/P/M deve possuir apresentação compacta própria.');
assert.match(css, /\.gps-point-card \.gps-point-mark-option\.hidden\{display:none;\}/, 'Checkbox de marco deve ficar oculto para ponto virtual.');

console.log('PASS map-point-types-vpm: entrada manual P/M, V legado preservado, marca física e tipos persistentes.');
