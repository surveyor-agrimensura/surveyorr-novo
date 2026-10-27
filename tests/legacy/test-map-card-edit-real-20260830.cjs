const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.resolve(__dirname, '../../assets/js/features/mapa/app.js'), 'utf8');
const html = fs.readFileSync(path.resolve(__dirname, '../../mapa/index.html'), 'utf8');
function ok(condition, message) { if (!condition) throw new Error(message); }
ok(/edit\.textContent = 'Editar(?: geometria)?';[\s\S]{0,900}edit\.onclick = \(\) => \{[\s\S]{0,500}select\(layer\);[\s\S]{0,300}beginDirectEditMode\(/.test(app), 'Botão Editar do card não ativa o editor real do Leaflet.');
ok(!/edit\.onclick = \(\) => \{ select\(layer\); document\.querySelector\('\[data-side-tab="project"\]'\)\?\.click\(\); \};/.test(app), 'Fluxo antigo do botão Editar ainda está presente.');
ok(/function beginDirectEditMode\(/.test(app) && /editHandler\.enable\(\)/.test(app), 'Editor direto de vértices não está disponível.');
ok(/surveyor-direct-editing/.test(app), 'Modo visual de edição direta não é ativado.');
ok(/app\.js\?v=[^"']+/.test(html), 'Mapa deve manter cache-bust versionado sem prender o teste a um sufixo antigo.');
console.log('PASS: botão Editar do card seleciona o elemento e ativa a edição real de vértices.');
