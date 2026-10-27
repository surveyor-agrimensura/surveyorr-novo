import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('assets/js/core/ui.js', 'utf8');
const workspaceCss = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8').replace(/!important/g,'');

assert.match(ui, /const closeQuickDrawer=\(\)=>\{/, 'Toolbar deve possuir uma única rotina para fechar a bandeja de ferramentas.');
assert.match(ui, /center\.querySelectorAll\('details\[open\]'\)\.forEach/, 'Abrir Ferramentas deve fechar menus verticais já abertos.');
assert.match(ui, /basemap\.addEventListener\('toggle',[\s\S]*closeQuickDrawer\(\)/, 'Abrir Mapa deve fechar Ferramentas e impedir sobreposição.');
assert.match(ui, /const drawingGroup=more\.closest\('\.sv-map-toolbar-group'\)/, 'Ferramentas devem ser posicionadas a partir do grupo de Desenho.');
assert.match(ui, /const layout=calculateMapQuickDrawerLayout\(leftEdge,rightEdge,document\.documentElement\.clientWidth \|\| window\.innerWidth\)/, 'Bandeja deve medir as divisas reais da barra e usar proporções responsivas.');
assert.match(ui, /const startDivider=drawingGroup\?\.previousElementSibling/, 'A bandeja deve iniciar na divisória Camadas e Desenho.');
assert.match(ui, /const endDivider=verifyGroup\?\.nextElementSibling/, 'A bandeja deve terminar na divisória após Verificar.');
assert.match(ui, /setProperty\('transform','none','important'\)/, 'Posicionamento calculado não pode ser deslocado por translate legado.');
assert.doesNotMatch(workspaceCss, /left:calc\(50% \+ 86px\)/, 'CSS legado não deve competir com o posicionamento único da bandeja.');

console.log('PASS map-toolbar-panel-organization: Ferramentas e Mapa possuem abertura exclusiva e posicionamento independente.');
