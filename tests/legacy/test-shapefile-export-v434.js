import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

class MockZip {
  static last = null;
  constructor() { this.files = new Map(); MockZip.last = this; }
  file(name, data) { this.files.set(name, data); return this; }
  async generateAsync() { return new Blob(['zip-mock'], { type: 'application/zip' }); }
}

globalThis.JSZip = MockZip;
await import(`${pathToFileURL(path.join(root, 'assets/js/features/mapa/shapefile.js')).href}?test=${Date.now()}`);
const exporter = globalThis.SurveyorShapefileExport;
assert.ok(exporter, 'Exportador global não foi registrado.');
assert.equal(exporter.VERSION, '21.10.0');

const polygon = {
  type: 'FeatureCollection',
  properties: { propertyName: 'Fazenda Teste' },
  features: [{
    type: 'Feature',
    properties: { name: 'Área principal', category: 'property', municipality: 'Amargosa', stateCode: 'BA' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[-39.62, -13.03], [-39.61, -13.03], [-39.61, -13.02], [-39.62, -13.02], [-39.62, -13.02], [-39.62, -13.03]]]
    }
  }]
};

const result = await exporter.exportWithProfile({
  featureCollection: polygon,
  baseName: 'Fazenda Teste',
  context: { propertyName: 'Fazenda Teste', municipality: 'Amargosa', stateCode: 'BA' },
  download: false
}, 'seia-cefir-ba');
assert.equal(result.filename, 'shapeImovelRural-SEIA-CEFIR.zip');
assert.equal(result.featureCount, 1);
const names = [...MockZip.last.files.keys()].sort();
assert.deepEqual(names, ['shapeImovelRural.dbf', 'shapeImovelRural.prj', 'shapeImovelRural.shp', 'shapeImovelRural.shx']);
assert.equal(names.some((name) => name.includes('/')), false, 'Arquivos do SHP não podem ficar em subpastas.');
assert.match(MockZip.last.files.get('shapeImovelRural.prj'), /SIRGAS 2000/);
assert.match(MockZip.last.files.get('shapeImovelRural.prj'), /4674/);
const shpView = new DataView(MockZip.last.files.get('shapeImovelRural.shp'));
assert.equal(shpView.getInt32(0, false), 9994);
assert.equal(shpView.getInt32(28, true), 1000);
assert.equal(shpView.getInt32(32, true), 5);
const dbfView = new DataView(MockZip.last.files.get('shapeImovelRural.dbf'));
assert.equal(dbfView.getUint32(4, true), 1);
assert.equal(dbfView.getUint8(29), 0x57);

const mixed = {
  type: 'FeatureCollection',
  features: [
    polygon.features[0],
    { type: 'Feature', properties: { name: 'Linha' }, geometry: { type: 'LineString', coordinates: [[-39.62, -13.03], [-39.60, -13.01]] } },
    { type: 'Feature', properties: { name: 'Marco' }, geometry: { type: 'Point', coordinates: [-39.61, -13.02] } }
  ]
};
await exporter.exportWithProfile({ featureCollection: mixed, baseName: 'Projeto Misto', download: false }, 'qgis-arcgis');
const mixedNames = [...MockZip.last.files.keys()];
assert.equal(mixedNames.length, 15);
assert.equal(mixedNames.some((name) => name.includes('/')), false);
assert.ok(mixedNames.includes('projeto-misto_poligonos.shp'));
assert.ok(mixedNames.includes('projeto-misto_linhas.shp'));
assert.ok(mixedNames.includes('projeto-misto_pontos.shp'));

const invalid = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { name: 'Laço inválido' }, geometry: { type: 'Polygon', coordinates: [[[-39.62,-13.03],[-39.60,-13.01],[-39.62,-13.01],[-39.60,-13.03],[-39.62,-13.03]]] } }]
};
await assert.rejects(
  exporter.exportWithProfile({ featureCollection: invalid, baseName: 'Invalido', download: false }, 'seia-cefir-ba'),
  /auto-interseção/
);

const mapHtml = read('mapa/index.html');
assert.doesNotMatch(mapHtml, />DXF(?:\s|<)/);
assert.doesNotMatch(mapHtml, /DXF Planialt/);
assert.doesNotMatch(mapHtml, /KML Pontos/);
assert.match(mapHtml, /id="kmlBtn"[^>]*>KML</);
assert.match(mapHtml, /id="txtBtn"[^>]*>TXT</);
assert.match(mapHtml, /id="geojsonBtn"[^>]*>GeoJSON</);
assert.match(mapHtml, /id="csvBtn"[^>]*>CSV</);
assert.match(mapHtml, /id="shpBtn"[^>]*>Shapefile</);
assert.match(mapHtml, /data-selected-download="shp">Shapefile</);
assert.match(mapHtml, /shapefile-export-v21\.10\.0\.js/);

const cloud = read('assets/js/features/cloud/app.js');
const cloudHtml = read('nuvem/index.html');
assert.match(cloud, /data-format="shp">Shapefile</);
assert.match(cloud, /data-format="txt">TXT</);
assert.doesNotMatch(cloud, /Backup JSON/);
assert.doesNotMatch(cloud, /data-format="json"/);
assert.match(cloudHtml, /shapefile-export-v21\.10\.0\.js/);
assert.match(cloudHtml, /cloud-v21\.9\.120\.js/);

console.log('OK v21.10.0: Shapefile por destino, SIRGAS 2000, ZIP sem subpastas e downloads limpos validados.');
