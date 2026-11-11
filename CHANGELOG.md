# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). O histórico detalhado de etapas anteriores está em [`docs/HISTORICO_DE_ETAPAS.md`](docs/HISTORICO_DE_ETAPAS.md).

## [Não publicado]

### Corrigido
- **Build de produção estava quebrado:** `npm run build` falhava no `tsc -b` com 22 erros de TypeScript. Agora o typecheck passa sem erros.
  - `TechnicalSheetsPage.tsx`: o ícone `Map` do `lucide-react` escondia o `Map` nativo do JavaScript (`new Map<string, …>()`); o ícone passou a se chamar `MapIcon`. Tipagem de `NeighborDetails` ajustada.
  - Funções de projeção (`sheetProjection`, `mercator`, `plot`) agora aceitam coordenadas `readonly [number, number]`, compatíveis com `GeoPoint`.
  - `croquiRenderer.ts`: cores de preenchimento e borda convertidas com segurança para `string`.
- Removido código morto que o compilador já apontava como não utilizado (`uploadPhoto` no Croqui, bloco de sincronização de croqui não usado no Memorial, `linePath`, `roadPath`, imports sem uso). Nenhuma mudança de comportamento.

### Adicionado
- Cabeçalhos de segurança em `public/_headers` (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS) e CSP em modo somente relatório.
- CI reestruturada (`pages.yml`): `npm ci`, typecheck, testes e build rodam também em Pull Requests; a publicação só ocorre na `main` e depende da verificação.
- Dependabot semanal para o frontend e as Functions.
- `.editorconfig`, `.prettierrc.json`, `.nvmrc`, `.gitattributes`; campo `engines` e script `npm run verify` no `package.json`.
- Documentação: novo `README.md`, `docs/DEPLOY.md`, `docs/ARQUITETURA.md`, `SECURITY.md`, `CONTRIBUTING.md`.

### Alterado
- `advancedTerrainTools.tsx` dividido: a lógica geométrica pura (buffer, inversão de anel, DXF, classificação de lados, consulta de elevação) foi para `terrainTools.ts`; o componente mantém reexportações, então os imports existentes continuam válidos.
- README anterior movido para `docs/HISTORICO_DE_ETAPAS.md`; relatórios e guia de implantação movidos para `docs/`.
- Cache de `manifest.webmanifest` passa a revalidar sempre.
