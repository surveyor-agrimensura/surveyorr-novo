import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const helper = read('assets/js/core/document-identity.js');
const runtime = read('assets/js/core/ui.js');
const memorial = read('assets/js/features/memorial/app.js');
const lot = read('assets/js/features/loteamentos-reurb/app.js');
const memorialHtml = read('memorial/index.html');

for (const id of ['memTechnician','mapTechnician','odsTechnician','odsArt','environmentAnalyst','techName']) {
  assert.match(helper, new RegExp(id), `Helper central precisa tratar ${id}.`);
}
assert.match(helper, /responsibleTechnician/, 'Helper deve usar o responsável técnico da Personalização.');
assert.match(helper, /professionalRegistry/, 'Helper deve usar o registro profissional da Personalização.');
assert.match(helper, /moveFieldHostToVault\('memorialTemplateSelect'\)/, 'Seletor do Memorial deve ser removido da interface de geração.');
assert.match(helper, /lotPanel\.hidden = true/, 'Painel legado de responsável técnico do Loteamentos deve ficar oculto.');

const pages = ['memorial','ods','mapas','pranchas','planialtimetria','perimetros','ambiental','confrontacao','car','loteamentos-reurb','glebas'];
for (const page of pages) {
  const html = read(`${page}/index.html`);
  assert.match(html, /document-identity-auto-v21\.11\.5\.js/, `${page} deve carregar identidade técnica centralizada.`);
}

assert.doesNotMatch(runtime, /\['Responsável técnico',\['memTechnician'\]\]/, 'Memorial não deve criar seção editável de responsável técnico.');
assert.doesNotMatch(runtime, /\['Configurações do memorial',\['memorialTemplateSelect'\]\]/, 'Memorial não deve criar seção editável de modelo.');
assert.match(runtime, /\['Mapa do memorial',\['memMapZoom','memMapBackground'\]\]/, 'Memorial deve manter apenas configurações próprias do mapa.');
assert.doesNotMatch(runtime, /\['Responsável técnico',\['odsTechnician','odsArt'\]\]/, 'ODS não deve perguntar responsável técnico.');
assert.doesNotMatch(runtime, /\['Responsável técnico',\['mapTechnician'\]\]/, 'Mapas/Pranchas não devem perguntar responsável técnico.');
assert.doesNotMatch(runtime, /\['Responsável pela análise',\['environmentAnalyst'\]\]/, 'Relatório ambiental não deve pedir novamente o responsável configurado na conta.');

assert.match(memorialHtml, /id="memMapZoom"/, 'Memorial deve manter zoom como opção própria do documento.');
assert.match(memorialHtml, /id="memMapBackground"/, 'Memorial deve manter mapa de fundo como opção própria do documento.');
assert.match(memorial, /remotePreference\?\.\(loadedCustomization\)/, 'Memorial deve carregar o modelo definido na Personalização da conta.');
assert.match(memorial, /definido em Personalização/, 'Memorial deve indicar que o modelo vem da Personalização.');
assert.match(lot, /function technicalIdentity\(/, 'Loteamentos deve usar identidade técnica central.');
assert.match(lot, /t=technicalIdentity\(m\.tech\|\|\{\}\)/, 'Relatórios de loteamento devem priorizar a identidade centralizada.');

console.log('v21.11.5: identidade técnica centralizada e modelo do Memorial controlado pela Personalização — OK');
