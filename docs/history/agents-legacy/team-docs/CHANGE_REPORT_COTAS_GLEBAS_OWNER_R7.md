# Relatório de mudança — Cotas por polígono proprietário R7

## Requisito/bug
Projetos podem ter perímetro geral, glebas grandes e novas subdivisões/lotes dentro dessas glebas. As cotas de níveis distintos estavam sendo suprimidas ou podiam se sobrepor porque a seleção era baseada apenas em glebas terminais.

## Comportamento novo
- Cotas do perímetro geral continuam sempre externas ao imóvel.
- Cada cota de gleba usa o próprio polígono da gleba como referência espacial e permanece dentro dele.
- Glebas-pai continuam podendo exibir segmentos exclusivos; não são mais descartadas apenas por terem filhos.
- Glebas-filhas/menores têm prioridade em segmentos exatamente compartilhados.
- O mesmo segmento físico é cotado uma única vez.
- Rótulos de cotas de diferentes níveis compartilham detecção de colisão e procuram posições alternativas dentro do polígono proprietário.
- Cada rótulo mantém `data-owner` para rastreabilidade técnica.

## Arquivos alterados
- `assets/js/features/mapas/app.js`
- `mapas/index.html`
- `pranchas/index.html`
- `tests/test-map-gleba-nested-dimensions-20260913.cjs`
- `.agents/team-docs/CHANGE_REPORT_COTAS_GLEBAS_OWNER_R7.md`

## Impacto
Somente frontend/renderização documental. Sem migração, alteração de APIs ou Cloudflare Worker.
