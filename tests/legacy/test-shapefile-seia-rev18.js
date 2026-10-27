import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
class MockZip {
  static last = null;
  constructor() { this.files = new Map(); MockZip.last = this; }
  file(name, data) { this.files.set(name, data); return this; }
  async generateAsync() { return new Blob(['zip-mock'], { type: 'application/zip' }); }
}
globalThis.JSZip = MockZip;
await import(`${pathToFileURL(path.join(root, 'assets/js/features/mapa/shapefile.js')).href}?rev18=${Date.now()}`);
const exp = globalThis.SurveyorShapefileExport;
assert.equal(exp.BUILD, 'REV18-SEIA-STRICT');
const fc = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'APP', category: 'app' }, geometry: { type: 'Polygon', coordinates: [[[-39.615,-13.028],[-39.614,-13.028],[-39.614,-13.027],[-39.615,-13.027],[-39.615,-13.028]]] } },
    { type: 'Feature', properties: { name: 'Limite do imóvel', category: 'property', municipality: 'Amargosa', stateCode: 'BA' }, geometry: { type: 'Polygon', coordinates: [[[-39.62,-13.03],[-39.61,-13.03],[-39.61,-13.02],[-39.62,-13.02],[-39.62,-13.03]]] } }
  ]
};
const result = await exp.exportWithProfile({ featureCollection: fc, baseName: 'qualquer-nome', context: { municipality: 'Amargosa', stateCode: 'BA' }, download: false }, 'seia-cefir-ba');
assert.equal(result.filename, 'shapeImovelRural-SEIA-CEFIR.zip');
assert.equal(result.baseName, 'shapeImovelRural');
assert.equal(result.featureCount, 1, 'SEIA deve receber apenas o limite principal.');
const names = [...MockZip.last.files.keys()].sort();
assert.deepEqual(names, ['shapeImovelRural.dbf','shapeImovelRural.prj','shapeImovelRural.shp','shapeImovelRural.shx']);
assert.equal(names.some((n) => n.endsWith('.cpg')), false);
assert.equal(names.some((n) => n.includes('/')), false);
const shp = MockZip.last.files.get('shapeImovelRural.shp');
const shx = MockZip.last.files.get('shapeImovelRural.shx');
const dbf = MockZip.last.files.get('shapeImovelRural.dbf');
const prj = MockZip.last.files.get('shapeImovelRural.prj');
assert.ok(shp.byteLength > 100 && shx.byteLength > 100 && dbf.byteLength > 32);
assert.match(prj, /SIRGAS 2000/);
assert.equal(new DataView(shp).getInt32(0, false), 9994);
assert.equal(new DataView(shp).getInt32(28, true), 1000);
assert.equal(new DataView(shp).getInt32(32, true), 5);
assert.equal(new DataView(shx).getInt32(32, true), 5);
assert.equal(new DataView(dbf).getUint32(4, true), 1);
exp.validateBinaryShapeSet({ shp, shx, dbf, prj }, 'polygon', exp.profileById('seia-cefir-ba'));
const map = fs.readFileSync(path.join(root,'mapa/index.html'),'utf8');
const cloud = fs.readFileSync(path.join(root,'nuvem/index.html'),'utf8');
assert.match(map,/rev18-seia-strict/);
assert.match(cloud,/rev18-seia-strict/);
console.log('OK v21.10.0 REV18: pacote SEIA estrito com SHP/SHX/DBF/PRJ, nome oficial, polígono único e validação binária.');
