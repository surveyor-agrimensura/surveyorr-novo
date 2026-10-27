import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('assets/home-hero.css','utf8');
const cardsCss = fs.readFileSync('assets/css/features/home-cards/home-cards-v21.11.5.css','utf8');
const js = fs.readFileSync('assets/home-hero.js','utf8');
const cardsJs = fs.readFileSync('assets/js/features/home-cards/home-cards-v21.11.5.js','utf8');

assert.match(html,/SURVEYOR/);
assert.match(html,/Georreferenciamento, agrimensura e gestão técnica/);
assert.match(html,/Começar novo projeto no mapa/);
assert.match(html,/Abrir último trabalho/);
assert.match(js,/listProjects/);
assert.match(js,/\/mapa\/\?project=/);
assert.match(css,/home-hero/);

// A faixa existe somente como região vazia/oculta. Nenhum card é embarcado no HTML.
assert.match(html,/id="homeCardsRegion"[^>]*hidden/);
assert.match(html,/home-cards-v21\.11\.5\.js/);
assert.doesNotMatch(html,/Nova atualização disponível|Aviso de manutenção|Comunicado importante/i);

// O hero só reduz quando um card ativo vindo do admin é carregado.
assert.match(cardsCss,/\.has-home-cards \.home-hero/);
assert.match(cardsJs,/classList\.add\('has-home-cards'\)/);
assert.match(cardsJs,/classList\.remove\('has-home-cards'\)/);
assert.match(cardsJs,/metadata\.kind === 'home_card'/);

console.log('Teste da tela inicial + cards administráveis aprovado.');
