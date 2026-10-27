const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');

assert.match(html, /id="editMidpointsToggleBtn"[\s\S]*aria-pressed="false"/, 'Menu CAD deve expor a opção de pontos automáticos desligada por padrão.');
assert.match(app, /EDIT_MIDPOINTS_STORAGE_KEY\s*=\s*'surveyor\.editMidpointsEnabled'/, 'Preferência dos pontos intermediários deve ser persistida por usuário/navegador.');
assert.match(app, /let editMidpointsEnabled\s*=\s*false/, 'Pontos automáticos devem iniciar ocultos quando não há preferência salva.');
assert.match(app, /realVertices\.has\(marker\)[\s\S]*surveyor-edit-midpoint-handle/, 'Editor deve continuar distinguindo vértices reais de pontos intermediários.');
assert.match(app, /classList\.toggle\('surveyor-edit-midpoints-enabled', enabled\)/, 'Alternância deve controlar a visibilidade sem remover a funcionalidade do Leaflet.Draw.');
assert.match(css, /surveyor-direct-editing:not\(\.surveyor-edit-midpoints-enabled\)[\s\S]*surveyor-edit-midpoint-handle[\s\S]*display:none!important;[\s\S]*pointer-events:none!important;/, 'Pontos automáticos devem ficar invisíveis e sem clique quando a opção está desligada.');
assert.match(app, /Pontos automáticos estão ocultos; você pode ativá-los no menu CAD/, 'Mensagem do modo de edição deve explicar como reativar os pontos automáticos.');

console.log('PASS: pontos automáticos da edição ficam ocultos por padrão e podem ser reativados no menu CAD.');
