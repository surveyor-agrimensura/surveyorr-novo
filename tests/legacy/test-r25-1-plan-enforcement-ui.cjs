const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const api=read('functions/surveyor-api/src/main.js');
const auth=read('assets/js/core/auth.js');
const layout=read('assets/js/core/layout.js');
const portal=read('assets/js/core/portal.js');
const map=read('assets/js/features/mapa/app.js');
const cloud=read('assets/js/features/cloud/app.js');
const nuvem=read('nuvem/index.html');
const must=(txt,needle,label)=>{if(!txt.includes(needle)){console.error('FALHA R25.1:',label);process.exit(1)}};
must(api,"if (path === '/api/storage/status'",'endpoint storage status');
must(api,"requirePermission(auth, 'layers:official', 'Seu plano não possui acesso às camadas oficiais.')",'camada oficial protegida no backend');
must(api,'permissions: canonical.permissions','plano oficial não reabre permissões antigas do banco');
must(auth,'async function loadUsageStatus()','status de franquia frontend');
must(auth,'async function loadStorageStatus()','status de armazenamento frontend');
must(layout,'svPlanUsageFooter','rodapé de franquias');
must(portal,"['/consulta-car/', 'consulta-car', 'Consulta Pública CAR', 'car:access']",'consulta CAR protegida');
must(map,'function canUseOfficialPropertySearch()','busca fundiária protegida');
must(map,"catálogo de camadas oficiais está disponível nos planos Plus e Pro",'catálogo bloqueado no básico');
must(cloud,"`${formatSize(used)} de ${formatSize(limit)}`",'uso/total na página projetos');
must(nuvem,'Comprar armazenamento','cta armazenamento');
const basicBlock=api.match(/id: 'basic_annual'[\s\S]*?permissions: \[(.*?)\]\n  \}/)?.[1]||'';
if(basicBlock.includes('layers:official')||basicBlock.includes('car:access')){console.error('FALHA R25.1: Básico ainda contém camada/CAR premium');process.exit(1)}
const plusBlock=api.match(/id: 'plus_annual'[\s\S]*?permissions: \[(.*?)\]\n  \}/)?.[1]||'';
if(!plusBlock.includes('layers:official')||!plusBlock.includes('car:access')){console.error('FALHA R25.1: Plus sem camada/CAR');process.exit(1)}
console.log('PASS R25.1: matriz de planos aplicada no backend, mapa e UI de franquias/armazenamento.');
