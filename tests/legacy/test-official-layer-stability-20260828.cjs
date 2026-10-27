const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const ok = (condition, message) => { if (!condition) throw new Error(message); };

const map = read('assets/js/features/mapa/app.js');
const car = read('assets/js/features/consulta-car/app.js');
const api = read('functions/surveyor-api/src/main.js');
const worker = read('deploy/cloudflare-geoservices/src/worker.js');
const mapaHtml = read('mapa/index.html');
const carHtml = read('consulta-car/index.html');

ok(/const VERSION = '2\.\d+\.\d+[^']*'/.test(worker) && (worker.includes('layer-source-matrix') || worker.includes('sicar-national-r21')), 'Worker deve usar versão SemVer atual da matriz de fontes oficiais');
ok(worker.includes('isIncraAcervoOgc') && worker.includes('allowAutomaticIncraHttp'), 'Worker deve permitir fallback HTTP server-to-server apenas para o OGC oficial do INCRA');
ok(worker.includes('isInemaPublicGeoService'), 'fallback oficial INEMA deve ser preservado');

ok(map.includes('OFFICIAL_LAYER_SOURCE_ENDPOINTS') && map.includes('officialLayerSourceCandidates'), 'catálogo deve resolver fontes de forma isolada por camada');
ok(map.includes('geoserver.car.gov.br/geoserver/sicar/ows'), 'fallback SICAR oficial ausente');
ok(map.includes('portal.iphan.gov.br/geoserver/SICG/ows'), 'endpoint oficial SICG/IPHAN ausente');
ok(map.includes('geoserver.funai.gov.br/geoserver/Funai/ows'), 'endpoint oficial FUNAI ausente');
ok(map.includes('geoservicos.inde.gov.br/geoserver/ICMBio/ows'), 'endpoint oficial ICMBio/INDE ausente');
ok(map.includes('geoservicos.ibge.gov.br/geoserver/ows'), 'endpoint oficial IBGE ausente');
ok(map.includes('geoservicos.inde.gov.br/geoserver/DNIT/ows'), 'endpoint oficial DNIT/INDE ausente');
ok(map.includes('www.snirh.gov.br/arcgis/services/INDE/Camadas/MapServer/WMSServer'), 'endpoint oficial ANA/SNIRH ausente');
ok(map.includes('uc_inema_2023') && map.includes('trecho_massa_dagua_50k_inema'), 'aliases de camadas INEMA renomeadas devem ser preservados');
ok(worker.includes('proxyCacheTtlSeconds') && worker.includes("headers.set('x-georural-cache', 'HIT')"), 'Worker deve cachear respostas oficiais para reduzir indisponibilidade intermitente');
ok(worker.includes("'geoserver.funai.gov.br'") && worker.includes("'geoservicos.inde.gov.br'") && worker.includes("'geoservicos.ibge.gov.br'") && worker.includes("'portal.iphan.gov.br'") && worker.includes("'www.snirh.gov.br'"), 'allowlist do Worker deve cobrir fontes oficiais alternativas');
ok(worker.includes("url.searchParams.get('minScore')"), 'resolver deve exigir score mínimo e evitar mapear camada semelhante incorreta');

ok(map.includes('WMS-first para o catálogo GeoBahia/INEMA') && map.includes('GEOBAHIA_WFS_MAX_FEATURES = 50'), 'GeoBahia deve usar WMS como padrão e limitar WFS a 50 feições');
ok(map.includes("{ version: '1.1.0', typeKey: 'TYPENAME', output: 'application/json'"), 'GeoBahia deve testar WFS 1.1.0 além de 1.0.0');
ok(map.includes('resolveGeobahiaCatalogLayer'), 'cada camada deve continuar resolvendo o nome técnico via capabilities');
ok(map.includes('buildGeobahiaPropertyBoundaryWmsLayer') && map.includes('buildSicarPropertyBoundaryWmsLayer'), 'Limites de Propriedade devem usar CEFIR/INEMA na BA e SICAR nas demais UFs');
ok(map.includes('SEI_TERRITORY_IDENTITY_CURRENT_FEATURE_URL') && map.includes('REGIONALIZACAO_VIGENTE/FeatureServer/0/query'), 'Território de Identidade deve ter fonte SEI vigente independente');
ok(api.includes('preferWfs: item.preferWfs === true') && api.includes("serviceType: 'wms'"), 'catálogo da API deve semear WMS como renderização padrão e só sinalizar WFS quando a camada pedir explicitamente');

ok(map.includes('fetchCarWfsEnrichment(latlng, carCode') && map.includes("'numero_sicar'") && map.includes("'registro_car'"), 'mapa deve enriquecer CEFIR pelo código CAR usando aliases de schema');
ok(map.includes('registryFeatureMatchesCar'), 'mapa deve validar o CAR retornado pelo CEFIR');
ok(map.includes('fetchIncraRegistryGetFeatureInfoResult') && map.includes("const format = 'text/html'") && !map.includes('async function fetchIncraRegistryWfsResult'), 'SIGEF deve usar GetFeatureInfo text/html sem fallback WFS vetorial no enriquecimento');

ok(car.includes('fetchOfficialCefirProperties') && car.includes('officialFeatureMatchesCar'), 'Consulta CAR deve validar o CEFIR pelo código CAR');
ok(car.includes('fetchOfficialSigefProperties') && car.includes('certificada_sigef_particular_ba'), 'Consulta CAR deve tentar vínculo SIGEF/INCRA oficial pela geometria');
ok(car.includes('semanticOfficialValue') && car.includes('nome_sitio') && car.includes('nom_sitio'), 'Consulta CAR deve reconhecer aliases de nome do imóvel e proprietário');
ok(car.includes('Vínculo fundiário oficial — SIGEF/INCRA'), 'Consulta CAR deve exibir os atributos SIGEF quando houver parcela certificada');

ok(/app-v21\.9\.0\.js\?v=[A-Za-z0-9._-]+/.test(mapaHtml), 'mapa deve manter cache-bust versionado atual');
ok(/consulta-car-v21\.11\.5\.js\?v=[A-Za-z0-9._-]+/.test(carHtml), 'Consulta CAR deve manter cache-bust versionado da correção oficial de CAR/SIGEF');

const jsonlDir = path.join(root, 'dados', 'car');
ok(!fs.existsSync(jsonlDir), 'release não pode reintroduzir JSON/JSONL cadastral pesado');
console.log('PASS: CAR/SICAR nacional para limites, SIGEF/INCRA e camadas GeoBahia restantes estabilizados sem base local pesada.');
