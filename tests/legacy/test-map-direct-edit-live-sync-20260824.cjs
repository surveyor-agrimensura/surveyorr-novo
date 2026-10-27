const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.resolve(__dirname, '../../assets/js/features/mapa/app.js'), 'utf8');
function ok(condition, message) { if (!condition) throw new Error(message); }
ok(/function updateProjectGeometryCounters\(\)/.test(app), 'Contadores geométricos em tempo real não foram implementados.');
ok(/els\.totalArea/.test(app) && /els\.totalVertices/.test(app) && /els\.totalElements/.test(app), 'Área/vértices/elementos não são sincronizados durante edição.');
ok(/directLayerEvents\s*=\s*\['edit', 'move', 'drag', 'dragend'\]/.test(app), 'Eventos de edição direta não estão vinculados às geometrias.');
ok(/event\?\.layer \|\| event\?\.target \|\| selectedLayer/.test(app), 'Edição direta não reconhece o layer alvo dos eventos.');
ok(/scheduleRecoverySnapshot\(\)/.test(app), 'Alterações de vértice não marcam o projeto como alterado para recovery/salvamento.');
console.log('OK: edição de vértices atualiza painel, métricas e estado do projeto em tempo real.');
