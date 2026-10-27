const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'assets/js/features/mapa/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/features/mapa/app.css'),'utf8');
const checks=[
  ['canonicalCarProperties',app.includes('function canonicalCarProperties')],
  ['condition removed',!app.includes("{ aliases: ['condicao', 'condicao_i', 'situacao'], label: 'Condição / situação' }")],
  ['cache feature',app.includes('cachedSicarViewportFeatureAt')],
  ['10s debounce',app.includes('scheduleSicarViewportWarmup(10000)')],
  ['cache before point fetch',app.includes("source: 'SICAR/CAR WFS oficial — pré-carregado'")],
  ['aligned labels',css.includes('width:118px!important') && css.includes('text-align:right!important')],
  ['aligned values',css.includes('border-left:1px solid #edf2f7!important')]
];
for(const [name,ok] of checks){if(!ok){console.error('FALHA R23:',name);process.exit(1)}}
console.log('PASS R23: painel CAR deduplicado/alinhado e pré-carga SICAR controlada por viewport.');
