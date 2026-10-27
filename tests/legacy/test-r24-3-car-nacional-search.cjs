const fs=require('fs'); const path=require('path'); const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'assets/js/features/mapa/app.js'),'utf8');
const ws=fs.readFileSync(path.join(root,'assets/js/features/mapa/workspace.js'),'utf8');
const checks=[
  [app,"const SICAR_STATE_CODES = new Set(['AC'",'lista nacional no smart search'],
  [app,'function isCompleteCarDraft(value)','validador CAR nacional'],
  [app,'CAR de ${carStateCode || selectedStateCode} detectado','mensagem por UF'],
  [ws,'function selectedSicarStateCode()','estado SICAR da conta'],
  [ws,'sicar:sicar_imoveis_${code.toLowerCase()}','typename por UF'],
  [ws,'Este CAR pertence a ${carUf}. Selecione ${carUf}','bloqueio coerente por UF']
];
for(const [txt,needle,label] of checks){if(!txt.includes(needle)){console.error('FALHA R24.3:',label);process.exit(1)}}
if(ws.includes("function isCar(value) { return /^BA-")){console.error('FALHA R24.3: ainda restrito a BA');process.exit(1)}
console.log('PASS R24.3: busca CAR acompanha a UF selecionada e usa sicar_imoveis_<uf>.');
