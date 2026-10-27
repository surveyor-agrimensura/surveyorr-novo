import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const controls = fs.readFileSync('assets/js/features/mapa/controls.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(html, /gpsImportPointsInput[^>]+accept="[^"]*\.txt[^"]*text\/plain/i, 'Marcar pontos deve aceitar TXT/text/plain no seletor de arquivo.');
assert.match(html, /Importar pontos de TXT, ZIP com KMLs, KML, CSV ou XLSX/, 'Tooltip da importação deve informar TXT.');
assert.match(controls, /if \(ext === 'txt'\) return parseTxtPoints\(await file\.text\(\), name\);/, 'TXT deve passar pelo parser oficial do painel.');
assert.match(controls, /1ª coordenada = Longitude; 2ª = Latitude/, 'Interface deve declarar a convenção sem cabeçalho.');
assert.match(controls, /headerDetected: Boolean\(headerColumns\)/, 'Parser deve registrar quando reconheceu Longitude/Latitude pelo cabeçalho.');

const start = controls.indexOf('  function normalizeHeader');
const end = controls.indexOf('  function parseCsv', start);
assert.ok(start >= 0 && end > start, 'Bloco puro do parser TXT deve permanecer localizável para regressão comportamental.');
const parserBlock = controls.slice(start, end);
const context = {};
vm.createContext(context);
vm.runInContext(`${parserBlock}\n` + `
  plain = parseTxtPoints('-39.6059600 -13.0312240\\n-39.6061000 -13.0315000', 'pontos.txt');
  semicolon = parseTxtPoints('P-01;-39,6059600;-13,0312240\\nP-02;-39,6061000;-13,0315000', 'marcos.txt');
  header = parseTxtPoints('nome;longitude;latitude\\nMarco 1;-39,6059600;-13,0312240', 'cabecalho.txt');
  explicitOrder = parseTxtPoints('Latitude,Longitude,Nome\\n-13.0312240,-39.6059600,Marco A', 'ordem.csv.txt');
  withId = parseTxtPoints('1\\t-39.7000000\\t-13.2000000', 'ids.txt');
`, context);

assert.equal(context.plain.length, 2);
assert.equal(context.plain[0].lng, -39.60596, 'Sem cabeçalho, a primeira coordenada deve ser Longitude.');
assert.equal(context.plain[0].lat, -13.031224, 'Sem cabeçalho, a segunda coordenada deve ser Latitude.');
assert.equal(context.plain.importMeta.order, 'longitude-latitude');

assert.equal(context.semicolon[0].name, 'P-01', 'Nome/identificador antes das coordenadas deve ser preservado.');
assert.equal(context.semicolon[0].lng, -39.60596, 'Decimal com vírgula deve ser reconhecido como Longitude.');
assert.equal(context.semicolon[0].lat, -13.031224, 'Decimal com vírgula deve ser reconhecido como Latitude.');

assert.equal(context.header[0].name, 'Marco 1');
assert.equal(context.header.importMeta.headerDetected, true, 'Cabeçalho explícito deve ser detectado.');
assert.equal(context.explicitOrder[0].lat, -13.031224, 'Cabeçalho explícito deve prevalecer mesmo quando Latitude vier antes.');
assert.equal(context.explicitOrder[0].lng, -39.60596, 'Longitude indicada pelo cabeçalho deve ser respeitada.');

assert.equal(context.withId[0].name, '1', 'Coluna/identificador extra antes do par deve ser usada como nome quando possível.');
assert.equal(context.withId[0].lng, -39.7);
assert.equal(context.withId[0].lat, -13.2);

console.log('PASS map-point-txt-import: TXT reconhece Longitude→Latitude, cabeçalhos, separadores e identificadores.');
