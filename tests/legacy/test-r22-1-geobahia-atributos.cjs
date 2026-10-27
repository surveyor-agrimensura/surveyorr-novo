const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');

const required = [
  "numero_car: 'Número CAR'",
  "area_regis: 'Área registrada (ha)'",
  "{ aliases: ['ide_imovel', 'id_imovel'], label: 'ID do imóvel' }",
  "{ aliases: ['numero_car', 'num_sicar', 'registro_car', 'cod_car'], label: 'Número CAR' }",
  "{ aliases: ['area_regis'], label: 'Área registrada (ha)' }",
  "{ aliases: ['qtd_modfis'], label: 'Qtd. módulos fiscais' }"
];

for (const item of required) {
  if (!app.includes(item)) {
    console.error('FALHA R22.1: campo ausente:', item);
    process.exit(1);
  }
}
console.log('PASS R22.1: atributos oficiais GeoBahia/CEFIR entram no painel do imóvel.');
