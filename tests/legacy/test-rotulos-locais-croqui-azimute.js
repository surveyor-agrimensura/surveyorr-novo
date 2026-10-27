import fs from 'node:fs';
import assert from 'node:assert/strict';

const maps = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const perimetros = fs.readFileSync('assets/js/features/perimetros/app.js', 'utf8');
const mapasHtml = fs.readFileSync('mapas/index.html', 'utf8');
const pranchasHtml = fs.readFileSync('pranchas/index.html', 'utf8');

assert.match(maps, /function croquiVertexMarks\(/, 'Croqui deve ter posicionador local próprio');
assert.match(maps, /const vertexMarks = croquiVertexMarks\(coords, project, mapBox/, 'Croqui deve usar posicionador local');
assert.match(maps, /function smartVertexMarks\(/, 'Prancha continua com o posicionador técnico original');
assert.match(maps, /preferredSidesForDir/, 'Croqui deve orientar caixas de nomes conforme o lado livre');
assert.match(maps, /text-anchor=\"\$\{text\.anchor\}\"/, 'Croqui deve renderizar o texto ancorado ao lado correto da caixa');
assert.match(maps, /const vertexMarks = smartVertexMarks\(coords, project, mapBox, \{ fontSize: 5\.1, offset: 11/, 'Prancha georreferenciada deve continuar usando lógica original');
assert.doesNotMatch(maps, /const groups = \{ left: \[\], right: \[\] \}/, 'Não deve haver distribuição forçada até as bordas');
assert.match(perimetros, /angleCandidates = \[0, 18, -18, 34, -34, 50, -50, 68, -68\]/, 'Azimute deve usar chamadas locais ao redor do perímetro');
assert.match(perimetros, /maxDistance/, 'Azimute deve limitar a distância máxima dos rótulos');
assert.match(mapasHtml, /rotulos-auto-colisao-v7-0822/, 'Mapas deve forçar cache novo para os nomes de confrontantes');
assert.doesNotMatch(pranchasHtml, /rotulos-auto-colisao-v7-0822/, 'Pranchas não deve receber alteração desta rodada');
console.log('OK: rótulos locais de Croqui e Perímetro por Azimute validados.');
