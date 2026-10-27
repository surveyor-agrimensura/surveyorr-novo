# Change Report — Cotas Rollback Estável R9

## Bug observado
A regra experimental R8 que tentava manter cotas em ambos os lados de limites irmãos e calcular cobertura parcial entre pai/filho passou a renderizar cotas em excesso em projetos com muitas subdivisões, poluindo e quebrando a leitura do croqui.

## Decisão
Foi feito rollback cirúrgico somente da lógica experimental R8, restaurando a estratégia estável R7 para cotas de glebas. Nenhuma outra funcionalidade do SURVEYOR foi revertida.

## Comportamento restaurado
- cotas do perímetro geral permanecem fora do polígono;
- cotas de glebas permanecem dentro do polígono proprietário;
- segmentos físicos compartilhados são deduplicados;
- rótulos usam controle de colisão;
- glebas mais profundas/menores têm prioridade quando compartilham exatamente o mesmo segmento;
- foram removidos o modelo experimental `buildGlebaDimensionModel`, `segmentCoverageInterval` e cobertura parcial de descendentes introduzidos no R8.

## Arquivos alterados
- `assets/js/features/mapas/app.js`
- `mapas/index.html`
- `pranchas/index.html`
- `tests/test-document-generator-workspace-20260913.cjs`
- `tests/test-map-gleba-rollback-r9-20260913.cjs`

## Validação
- sintaxe JS: OK
- testes específicos de cotas dentro/fora: OK
- teste de cotas hierárquicas: OK
- teste de rollback R9: OK
- Mapas e Croquis: OK
- workspace de documentos: OK
- `npm test`: OK
- `npm run lint:integrity`: OK
- `npm run release:clean`: OK
