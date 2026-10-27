# Change Report — R10 — seta compacta do imóvel selecionado

## Requisito
Reduzir significativamente o tamanho visual da seta que liga o painel de informações rurais ao imóvel selecionado, preservando sua ancoragem, atualização em pan/zoom e comportamento de consulta.

## Arquivos alterados
- `assets/js/features/mapa/app.js`
- `assets/css/features/mapa/app.css`
- `mapa/index.html`
- `tests/test-map-rural-arrow-mini-20260913.cjs`
- `package.json`

## Comportamento anterior
A cabeça da seta tinha 15 px de comprimento e 6.5 px de meia-largura, linha com 3 px e âncora de raio 4 px.

## Comportamento novo
Cabeça reduzida para 8 px x 3.2 px, linha para 1.4 px e âncora para raio 2 px. A geometria de ligação, posição do painel e atualização durante pan/zoom permanecem inalteradas.

## Risco
Baixo. Mudança visual localizada no SVG de ligação rural e CSS correspondente; sem alteração em APIs, persistência ou segurança.
