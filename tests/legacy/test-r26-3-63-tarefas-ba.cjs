const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const distHtml = fs.readFileSync(path.join(root, 'dist/surveyor-frontend/mapa/index.html'), 'utf8');
const distJs = fs.readFileSync(path.join(root, 'dist/surveyor-frontend/assets/js/features/mapa/app.js'), 'utf8');
function ok(v,m){ if(!v){ console.error('FAIL:',m); process.exit(1); } }
ok(html.includes('<span>Tarefas</span><b id="detailTasks">—</b>'), 'Painel deve exibir Tarefas');
ok(!html.includes('<span>Arestas</span><b id="detailEdges">—</b>'), 'Painel não deve exibir Arestas');
ok(js.includes('const BAHIA_TASK_M2 = 4356;'), 'Constante de tarefa baiana');
ok(js.includes('value / BAHIA_TASK_M2'), 'Cálculo de tarefas');
ok(js.includes("els.detailTasks.textContent"), 'Valor de tarefas atualizado no painel');
ok(html === distHtml, 'HTML fonte/dist em paridade');
ok(js === distJs, 'JS fonte/dist em paridade');
console.log('PASS R26.3.63 — tarefas baianas');
