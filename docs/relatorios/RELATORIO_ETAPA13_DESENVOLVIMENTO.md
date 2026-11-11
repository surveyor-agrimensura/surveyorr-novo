# SURVEYOR: atualização dos 13 requisitos (30/10/2026)

## Base e preservação
Base: `SURVEYOR_OTIMIZADO_PERFORMANCE_2026-10-30.zip` (267 arquivos de projeto). As mudanças são incrementais, sem recriar geometrias ou apagar registros existentes. A versão anterior não foi sobrescrita. A pasta do Windows não foi alterada.

## Resultados por tarefa

| # | Implementação no código | Estado de validação |
|---|---|---|
| 1 | Controles de zoom do Croqui: ±5 p.p.; slider aproxima a múltiplos de 5, conservando limites e o enquadramento. Prancha mantém ±10 na barra inferior. | Testes locais de zoom passaram; interação real pendente. |
| 2 | Removidos textos explicativos redundantes identificados no Croqui e menus duplicados, preservando orientações técnicas. | **Parcial**: não foi feita revisão visual completa de todas as telas. |
| 3 | Painel de inclusão de foto sobreposta removido; leitura/renderização de fotos antigas mantidos para não modificar documentos existentes. | Inspeção estática e regressão do SVG antigo passaram. |
| 4 | Removida seção lateral redundante de área em tarefas do Croqui, sem alterar métricas, cálculos nem exportação. | Inspeção estática; teste no navegador pendente. |
| 5 | Servidões passam a usar polígono fechado com extremidades retas no Croqui e na Prancha. | Código SVG e testes de regressão do Croqui conferidos; visualização real pendente. |
| 6 | Removida a seção lateral de exportação individual do Croqui e duplicação de exportação na Prancha. Downloads existentes nos menus inferiores preservados. | Inspeção de código e testes locais. |
| 7 | `Nome no Mapa`: texto livre com posição geográfica, cor, tamanho e rotação. Croqui com arraste; Prancha com arraste e coordenadas; Memorial lê estilos compartilhados e imprime via renderizador do Croqui. | Testes de normalização/registro compartilhado e inspeção SVG passaram; validação real pendente. |
| 8 | Adicionada deduplicação de React/React DOM no Vite, por causa do risco de instâncias múltiplas com React Konva. | **Pendente**: não havia stack trace, sessão de reprodução nem compilação completa para identificar e comprovar a causa do `useRef`. |
| 9 | Criado `sharedMapAppearance.ts`: fonte por projeto/feição para cores, bordas, espessura e nomes geográficos. Croqui e Prancha gravam no mesmo registro de personalização; Memorial lê o registro. Compatibilidade de chaves de partes de glebas incluída. Rascunhos locais ainda não sincronizados têm prioridade. | 27 verificações novas, incluindo isolamento de projetos/glebas e conversão bidirecional, passaram; gravação/reabertura no Appwrite real pendentes. |
| 10 | Painel `Estado do croqui` removido do Memorial sem remover a verificação interna. | Inspeção estática, regressões gerais passaram. |
| 11 | Leitores de geometria atualizados para `Polygon`, `MultiPolygon`, `Feature`, `FeatureCollection`, `GeometryCollection` e JSON em string, sem substituir dados reais por amostras fictícias. | Testes com dados GeoJSON reais simulados passaram; **não confirmado** no projeto chamado `Perimeter Browse Multi`, que não foi identificado no código. |
| 12 | A prévia usa os polígonos extraídos do projeto, com partes multipoligonais preservadas e enquadramento existente. | **Parcial**: sem amostra do projeto específico, não foi possível aferir fidelidade visual da prévia/exportação. |
| 13 | Painel `Detalhes` de uma feição recebe `Baixar polígono` em GeoJSON, KML, DXF e Shapefile, passando apenas `[feição selecionada]` aos exportadores. | Teste estrutural aprovado; exportação efetiva no navegador pendente. |

## Arquivos de código principais

- `src/features/croqui/CroquiPage.tsx`
- `src/features/croqui/sharedMapAppearance.ts` (novo)
- `src/features/croqui/projectGeojsonGeometry.ts` (novo)
- `src/features/croqui/projectDivisions.ts`
- `src/features/croqui/sharedCroquiSettings.ts`
- `src/features/memorial/croquiRenderer.ts`
- `src/features/memorial/memorialEngine.ts`
- `src/features/memorial/MemorialPage.tsx`
- `src/features/documents/technicalSheet.ts`
- `src/features/documents/TechnicalSheetsPage.tsx`
- `src/features/documents/cloudDraft.ts`
- `src/features/map/MapWorkPanels.tsx`
- `vite.config.ts`
- `tests/etapa13-mapas.node.cjs` (novo)
- Testes regressivos existentes ajustados aos novos módulos, sem eliminar verificações anteriores.

## Testes executados

- `npm run test:maps:etapa13`: aprovado (27 verificações sobre GeoJSON, 3 polígonos, estilos, nomes, zoom e exportação estrutural).
- `npm run test:zoom`: aprovado, incluindo faixa completa de 1 a 100 e alinhamento de raster/vértices.
- `npm run test:stability`: aprovado (regressões 72-75, armazenamento e SVG do Croqui).
- `npm run test:deploy`: aprovado.
- `npm run test:smoke`: aprovado, 15 verificações rápidas.
- `npm run test:performance`: aprovado.
- `npm run test:functions`: aprovado, sintaxe de 4 Functions.
- Parser TypeScript: 119 arquivos TS/TSX sem erros de **sintaxe**.
- `npm run build`: **não concluído**. Faltam `vite/client` e `vitest/globals` no ambiente; não há um build funcional homologado. Não foi possível executar o Vitest completo nem testes visuais e de duração prolongada.

## Limitações importantes

1. As correções são disponibilizadas em uma **versão de desenvolvimento**, não pronta para produção sem homologação.
2. O erro intermitente `useRef` não foi reproduzido e sua causa definitiva não foi demonstrada. A deduplicação do React é uma medida preventiva, não uma garantia de correção.
3. A identificação exata do recurso/projeto `Perimeter Browse Multi` permanece incerta. Melhorias de leitura de GeoJSON podem sanar casos de prévia vazia, mas só uma amostra real confirma.
4. A sincronização bidirecional foi testada em funções puras e código de integração, não contra uma conta Appwrite autenticada, com dois navegadores.
5. A redução de textos explicativos foi direcionada aos pontos identificados. Uma revisão integral da experiência visual exige abrir todas as telas com dados reais.

## Validação necessária antes da produção

1. Instalar as dependências com `npm ci` e executar `npm run check:release` e `npm run test:maps:etapa13`.
2. Abrir o Croqui por longo período, usar Konva, alternar projetos e capturar a stack completa em eventual erro `useRef`.
3. Salvar uma cor e um nome livre no Croqui, reabrir a Prancha e o Memorial, modificar na Prancha e reabrir o Croqui. Testar em conta real e comparar SVG/PDF.
4. Selecionar um polígono de projeto com múltiplas feições, exportá-lo nos quatro formatos e verificar que os demais não foram incluídos.
5. Usar a amostra `Perimeter Browse Multi` para comparar visualização e saída com as geometrias originais.
6. Homologar layout, zoom, servidões e impressões em telas diferentes.

Nenhuma dessas validações pendentes deve ser tratada como aprovada apenas pela leitura de código ou pelos testes isolados.
