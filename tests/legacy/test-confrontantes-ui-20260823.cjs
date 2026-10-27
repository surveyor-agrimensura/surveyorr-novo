const fs = require('fs');
const assert = require('assert');

const js = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(js, /function vertexLabel\(index\)[\s\S]*V-\$\{String\(index \+ 1\)\.padStart\(2, '0'\)\}/, 'Padrão V-XX deve continuar ativo.');
assert.match(js, /badge\.textContent = 'Trecho'/, 'Badge numérico 1→2 não deve mais ser usado.');
assert.match(js, /segmentTitle\.textContent = `\$\{item\.from\} → \$\{item\.to\}`/, 'Card deve exibir V-XX → V-XX.');
assert.match(js, /L\.circleMarker\(latlng, \{[\s\S]*radius: 1\.6/, 'Marcador técnico deve manter um ponto discreto ancorado na coordenada.');
assert.match(js, /className: `vertex-label-tooltip\$\{filledClass\}`/, 'Rótulo técnico deve exibir V-XX sem botão colorido.');
assert.match(js, /function highlightConfrontanteSegment/, 'Trecho selecionado deve ser destacado no mapa.');
assert.match(js, /setActiveConfrontanteRow\(index\)/, 'Card selecionado deve ser destacado.');
assert.match(css, /\.confrontante-row\.active\{/, 'CSS de card ativo ausente.');
assert.match(css, /\.confrontante-row-main\{[\s\S]*display:grid/, 'Conteúdo do card deve ter layout próprio.');
assert.match(css, /\.details \.confrontantes-list,[\s\S]*max-height:320px/, 'Lista deve ter rolagem interna para muitos vértices.');
assert.match(css, /\.confrontante-dialog>\.close\{[\s\S]*right:14px/, 'Fechar do modal deve ficar no canto superior direito.');
assert.match(html, /padrão técnico V-XX/, 'Ajuda da seção deve explicar o padrão técnico.');
assert.match(html, /app-v21\.9\.0\.js\?v=[^\"']+/, 'Mapa deve carregar JS principal versionado.');
assert.match(html, /surveyor-map-current-v21\.11\.5\.css\?v=[^\"']+/, 'Mapa deve carregar CSS principal versionado.');

console.log('OK: confrontantes/vértices UI corrigidos e padronizados.');
