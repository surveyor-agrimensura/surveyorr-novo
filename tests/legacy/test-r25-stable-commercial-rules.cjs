const fs=require('fs'); const path=require('path');
const root=path.resolve(__dirname,'../..');
const api=fs.readFileSync(path.join(root,'functions/surveyor-api/src/main.js'),'utf8');
const save=fs.readFileSync(path.join(root,'functions/surveyor-save/src/main.js'),'utf8');
const auth=fs.readFileSync(path.join(root,'assets/js/core/auth.js'),'utf8');
const plans=fs.readFileSync(path.join(root,'planos/index.html'),'utf8');
const required=[
 [api,"SURVEYOR_STORE_URL = 'https://loja.surveyorr.com.br'",'loja oficial'],
 [api,'storageBaseBytes: 200 * MB_BYTES','Básico 200MB'],
 [api,'storageBaseBytes: 500 * MB_BYTES','Plus 500MB'],
 [api,'storageBaseBytes: 1 * GB_BYTES','Pro 1GB'],
 [api,'storageMaxBytes: 10 * GB_BYTES','Pro máximo 10GB'],
 [api,'downloadDailyLimit: 5','download Básico 5/dia'],
 [api,'downloadDailyLimit: 20','download Plus 20/dia'],
 [api,"path === '/api/usage/consume'",'consumo server-side'],
 [api,"await consumeDailyUsage(auth, 'download'",'download API contabilizado'],
 [api,"await consumeDailyUsage(auth, 'export'",'export API contabilizado'],
 [auth,'installDownloadQuotaGate','gate de downloads locais'],
 [auth,"window.open('https://loja.surveyorr.com.br'",'redirect loja'],
 [plans,'200 MB incluídos · expansível até 2 GB','pricing Básico'],
 [plans,'500 MB incluídos · expansível até 5 GB','pricing Plus'],
 [plans,'1 GB incluído · expansível até 10 GB','pricing Pro']
];
for(const [txt,needle,label] of required){if(!txt.includes(needle)){console.error('FALHA R25:',label);process.exit(1)}}
if(api.includes('projectLimit: 20,')||api.includes('projectLimit: 100,')){console.error('FALHA R25: limites numéricos de projeto ainda ativos');process.exit(1)}
if(!/async function assertProjectCapacity\(user, ownerId\) \{[\s\S]*?return;/.test(save)){console.error('FALHA R25: Save ainda limita número de projetos');process.exit(1)}
console.log('PASS R25: regras comerciais estáveis aplicadas no backend, Save, frontend e loja.');
