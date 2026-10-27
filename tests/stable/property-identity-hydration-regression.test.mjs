import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const cache = fs.readFileSync('assets/js/features/mapa/property-local-cache.js','utf8');
const begin = app.indexOf('  function sameRuralPropertyIdentity(');
const end = app.indexOf('\n  async function hydrateLocalPropertyGeometry(',begin);
assert.ok(begin >= 0 && end > begin,'Comparador de identidade deve existir.');
const compare = vm.runInNewContext(`${app.slice(begin,end)}
; sameRuralPropertyIdentity`,{
  propertyCarFromFeature: feature => feature?.properties?.cod_imovel || ''
});
const selected = {id:'boundary.42',properties:{cod_imovel:'BA-2901007-AAAA'}};
const same = {id:'boundary.91',geometry:{type:'Point',coordinates:[0,0]},properties:{cod_imovel:'BA2901007AAAA'}};
const wrong = {id:'boundary.42',geometry:{type:'Point',coordinates:[1,1]},properties:{cod_imovel:'BA-2905206-BBBB'}};
assert.equal(compare(selected,same),true,'Mesmo CAR, ainda que FID diferente, autoriza a geometria.');
assert.equal(compare(selected,wrong),false,'CAR diferente deve bloquear inclusive FID aparentemente igual.');
assert.equal(compare(selected,{geometry:same.geometry,properties:{nome_imovel:'Fazenda Jericó'}}),false,'Não usar primeira geometria sem identidade.');
assert.match(app,/\.find\(\(item\) => sameRuralPropertyIdentity\(selected, item\)\)/,'Consulta WFS deve comparar identidade antes da seleção.');
assert.match(app,/cached\?\.geometry && sameRuralPropertyIdentity\(feature, cached\)/,'Cache de geometrias precisa ser revalidado.');
assert.doesNotMatch(app,/hydrated\.properties = \{ \.\.\.\(feature\.properties/,'Não misturar atributos de dois imóveis.');
assert.doesNotMatch(cache,/if \(manifest\?\.municipalityName\) props\.municipio = manifest\.municipalityName/,'Município do download não deve virar atributo oficial.');
console.log('PASS property-identity-hydration-regression: CAR/FID, cache e procedência protegidos.');
