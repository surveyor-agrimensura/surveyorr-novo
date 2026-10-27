const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const ok = (condition, message) => { if (!condition) throw new Error(message); };

const car = read('assets/js/features/consulta-car/app.js');
const map = read('assets/js/features/mapa/app.js');
const worker = read('deploy/cloudflare-geoservices/src/worker.js');

ok(car.includes("const SICAR_WFS = 'https://geoserver.car.gov.br/geoserver/sicar/ows'"), 'Consulta CAR deve usar o WFS oficial do SICAR');
ok(car.includes("const CEFIR_WFS = 'https://geoserver.inema.ba.gov.br/geoserver/ows'"), 'Consulta CAR deve enriquecer pela fonte oficial CEFIR/INEMA');
ok(car.includes('cod_municipio_ibge') && car.includes('m_fiscal') && car.includes('status_imovel') && car.includes('data_atualizacao'), 'aliases reais do WFS público do SICAR não foram mapeados');
ok(car.includes('fetchOfficialCefirProperties') && car.includes('fetchOfficialSigefProperties') && car.includes('semanticOfficialValue') && car.includes('proprietario') && car.includes('nomeImovel'), 'enriquecimento oficial CEFIR/SIGEF de nome/detentor não foi implementado');
ok(car.includes('Todos os atributos publicados pelo serviço oficial'), 'consulta detalhada deve expor todos os atributos públicos retornados');
ok(!car.includes('readJsonl(') && !car.includes('findByCarLocalFallback') && !car.includes("jsonl-fallback"), 'JSONL cadastral local ainda participa da consulta');
ok(car.includes('servicodados.ibge.gov.br/api/v1/localidades/estados/BA/municipios'), 'lista municipal deve vir do IBGE oficial');

ok(map.includes('fetchSicarCarWfsResult'), 'mapa deve consultar SICAR WFS por ponto');
ok(map.includes('fetchIncraRegistryGetFeatureInfoResult') && map.includes("const format = 'text/html'"), 'mapa deve consultar SIGEF/SNCI pontualmente por WMS GetFeatureInfo text/html oficial do INCRA');
ok(map.includes('acervofundiario.incra.gov.br/i3geo/ogc.php'), 'endpoint oficial do Acervo Fundiário ausente');
ok(map.includes('certificada_sigef_particular_') && map.includes('certificada_sigef_publico_'), 'camadas oficiais SIGEF por UF ausentes');
ok(map.includes('Somente fontes primárias oficiais'), 'regra de fontes primárias oficiais não está documentada no runtime');
ok(!map.includes('AREA_IMOVEL_CAR_AC_BA_GO_MT_PE_RO/FeatureServer/17/query'), 'espelho Infra S.A. ainda está ativo na consulta cadastral');
ok(!map.includes('/api/geoservices/car-bahia/features'), 'fallback cadastral legado do Appwrite ainda participa do mapa');
ok(!map.includes('lim_imovel_sigef_publico_a/FeatureServer/10/query') && !map.includes('lim_imovel_sigef_privado_a/MapServer/9/query'), 'espelho IBAMA/PAMGIA ainda está ativo para SIGEF');
ok(!map.includes('.slice(0, owner ? 21 : 22)'), 'painel ainda limita artificialmente os atributos oficiais');
ok(map.includes('detentornome') && map.includes('nomearea') && map.includes('dataaprovacao'), 'aliases públicos do SIGEF não estão contemplados');

ok(/const VERSION = '2\.\d+\.\d+[^']*'/.test(worker) && (worker.includes('layer-source-matrix') || worker.includes('sicar-national-r21')), 'Worker deve usar versão SemVer atual com a matriz de fontes oficiais');
ok(worker.includes("'geoserver.car.gov.br'") && worker.includes("'acervofundiario.incra.gov.br'") && worker.includes("'geoserver.inema.ba.gov.br'"), 'Worker não autoriza todas as fontes primárias oficiais necessárias');

const jsonlDir = path.join(root, 'dados', 'car', 'BA');
if (fs.existsSync(jsonlDir)) {
  const jsonl = fs.readdirSync(jsonlDir).filter((name) => name.endsWith('.jsonl'));
  ok(jsonl.length === 0, `release ainda contém ${jsonl.length} JSONL cadastrais pesados`);
}

console.log('PASS: CAR/SIGEF passam a usar fontes primárias oficiais online, sem JSONL cadastral local.');
