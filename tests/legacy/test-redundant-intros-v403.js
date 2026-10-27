import fs from 'node:fs';
import assert from 'node:assert/strict';

const pages = {
  'memorial/index.html': ['Gerador de memorial descritivo','Usa o perímetro principal do projeto salvo'],
  'ambiental/index.html': ['Relatório ambiental automático','Resume as áreas ambientais classificadas'],
  'confrontacao/index.html': ['Carta de confrontação','Preencha os dados do confrontante e gere a carta'],
  'mapas/index.html': ['Croqui técnico do imóvel','Escolha o mapa de fundo e o nível de zoom'],
  'perimetros/index.html': ['Gerar perímetro por azimutes e distâncias','Selecione um projeto salvo para converter'],
  'pranchas/index.html': ['Gerador de planta georreferenciada','Gere a prancha no modelo técnico lateral'],
  'planialtimetria/index.html': ['Levantamento planialtimétrico e ponderação MDT','Selecione um projeto salvo para carregar seus vértices'],
  'glebas/index.html': ['Gerador automático de glebas','Selecione um projeto salvo ou importe um polígono'],
  'loteamentos-reurb/index.html': ['Projeto de loteamento','Crie o projeto, cadastre o responsável técnico']
};
for (const [page, snippets] of Object.entries(pages)) {
  const html = fs.readFileSync(page, 'utf8');
  for (const snippet of snippets) assert.equal(html.includes(snippet), false, `${page} ainda contém introdução redundante: ${snippet}`);
}
const car = fs.readFileSync('car/index.html', 'utf8');
assert.doesNotMatch(car, /<h2>Dados do projeto e do cadastrante<\/h2>/);
assert.doesNotMatch(car, /Confira no mapa as geometrias que já estão salvas neste projeto/);
assert.match(car, /id="openCarMap"/);
const lot = fs.readFileSync('loteamentos-reurb/index.html', 'utf8');
assert.match(lot, /id="lotSaveProject"/);
assert.match(lot, /id="lotNewProject"/);
assert.match(lot, /id="lotCopyShare"/);

console.log('OK v21.9.403: introduções redundantes removidas sem apagar ações principais.');
