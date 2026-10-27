import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8').replace(/!important/g,'');

assert.ok(app.includes('ring.splice(vertexIndex, 1)'), 'Excluir vértice deve remover a coordenada real da geometria.');
assert.ok(app.includes('Os pontos vizinhos foram conectados automaticamente'), 'UX deve informar a reconexão dos vértices vizinhos.');
assert.ok(!app.includes('Vértice excluído. Ele saiu do mapa e da lista de coordenadas, mantendo o desenho preservado.'), 'Não pode permanecer a antiga exclusão não destrutiva.');
assert.ok(app.includes('function ruralPropertyNameHit(properties = {})'), 'Nome do imóvel deve ter detector robusto de aliases.');
assert.ok(app.includes("source: 'Pesquisa rápida local (JSON)'"), 'Painel cadastral deve poder enriquecer o nome via JSON local.');
assert.ok(app.includes('async function fetchLocalitySuggestions(query)'), 'Busca de localidade dentro do município deve existir.');
assert.ok(app.includes('selectedCitySearchContext = { city: { ...city }, center };'), 'Seleção de município deve criar contexto para pesquisa interna.');
assert.ok(app.includes("setSmartSearchModeBadge('locality'"), 'Busca deve indicar visualmente o município ativo.');
assert.ok(css.includes('.sv-locality-search-head'), 'Painel de localidade deve ter estilo próprio.');

console.log('PASS V50 mapa: exclusão real de vértice, nome do imóvel e busca de localidade por município.');
