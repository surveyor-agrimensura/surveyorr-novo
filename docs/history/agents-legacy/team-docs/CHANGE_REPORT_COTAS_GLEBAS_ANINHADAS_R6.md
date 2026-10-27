# Relatório de mudança — Cotas de glebas aninhadas R6

## Requisito/bug
Projetos podem conter uma gleba-mãe novamente subdividida em glebas/lotes filhos. A geração documental estava cotando simultaneamente a gleba-mãe e suas filhas, causando números sobrepostos no interior do imóvel.

## Comportamento anterior
- `Cotas da gleba` percorria todas as feições `gleba` do projeto.
- Uma gleba que servia apenas como agrupador/pai continuava gerando cotas mesmo após ser subdividida.
- Em loteamentos hierárquicos, cotas de níveis diferentes podiam ocupar o mesmo trecho/região visual.

## Comportamento novo
- A cotagem de glebas usa somente glebas terminais (folhas da hierarquia).
- A hierarquia explícita `parentLayerId/sourceLayerId` criada pelo divisor é priorizada.
- Para projetos antigos/importados sem vínculo de pai, há fallback por contenção geométrica.
- A deduplicação de segmentos compartilhados permanece ativa.
- Cotas do perímetro geral continuam externas; cotas das glebas terminais continuam internas.

## Arquivos alterados
- `assets/js/features/mapas/app.js`
- `mapas/index.html`
- `pranchas/index.html`
- `tests/test-map-gleba-nested-dimensions-20260913.cjs`
- `package.json`

## Impacto em dados/APIs
Nenhuma migração, alteração de dados persistidos, API ou Cloudflare Worker.

## Segurança
Mudança local de renderização/seleção geométrica. Autenticação, autorização, dados pessoais e integrações externas não foram alterados.

## Testes executados
- `node --check assets/js/features/mapas/app.js`
- `node tests/test-map-gleba-dimension-placement-20260913.cjs`
- `node tests/test-map-gleba-nested-dimensions-20260913.cjs`
- `node tests/test-mapas-croquis-generation.js`
- `node tests/test-document-generator-workspace-20260913.cjs`
- `npm test`
- `npm run lint:integrity`
- `npm run release:clean`

Todos concluíram com sucesso.

## Risco residual
A hierarquia é determinada preferencialmente pelos IDs de pai gravados pelo próprio módulo de divisão. Em arquivos antigos sem esses metadados, o fallback geométrico utiliza contenção espacial; geometrias inválidas ou sobrepostas de forma não hierárquica podem exigir normalização cartográfica prévia.
