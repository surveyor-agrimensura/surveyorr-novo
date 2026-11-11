# SURVEYOR: Auditoria e otimização de desempenho

**Data:** 30/10/2026  
**Origem:** `SURVEYOR_COMPLETO_APPWRITE_SYNC_2026-10-30.zip`  
**Estado da entrega:** alterações de código aplicadas, testes locais aprovados, build de produção e homologação no navegador pendentes.

## Métricas antes/depois (medidas reais)

| Indicador | Original | Nova versão | Diferença |
|---|---:|---:|---:|
| Módulos locais alcançados por importações estáticas iniciais | 118 | 17 | -101 |
| Soma dos bytes de código-fonte nessa cadeia de imports | 1,439,082 | 90,567 | -1,348,515 |
| Imagens de modelo (cinco PNG/WebP) | 1.739.145 B | 445.850 B | -1.293.295 B (-74,4%) |
| Soma dos arquivos de projeto (sem node_modules) | 8,763,289 B | 7,480,827 B | -1,282,462 B (-14.6%) |
| Rotas introduzidas como `React.lazy` | 0 no App anterior | 23 | +23 |

**Atenção à interpretação:** os números de importação referem-se ao grafo estático dos arquivos locais, **não** ao tamanho final dos bundles JS/CSS de produção. Não há, neste ambiente, métricas comparáveis e confiáveis de LCP, TTI, consumo de RAM, número de requisições de uma sessão real ou renderizações do React. Não se declara redução nesses indicadores.

## Registro das 12 tarefas

| Tarefa | Resultado comprovado | Limite ou pendência |
|---|---|---|
| 1. Skeleton loading | Nova lista de skeletons para cartões de Projetos, fallback para carregamento de módulos | Outras tabelas e formulários assíncronos não receberam skeletons específicos |
| 2. Cache de consultas | Cache por objeto de sessão, duração de 8s para projetos/15s para armazenamento, deduplicação de chamadas simultâneas e invalidação em criação/salvamento/exclusão | Cache de outras consultas caras no backend não realizado |
| 3. Paginação | Lista de Projetos mostra 25 por página, respeitando a busca e a ordenação existentes | É paginação da interface. A API ainda recupera todos os registros; paginação no servidor permanece pendente para preservar pesquisa multiatributo e compatibilidade com registros legados |
| 4. Compressão API | Verificado que a infraestrutura Appwrite aplica compressão automática às respostas elegíveis; Cloudflare Pages também oferece Gzip/Brotli | Não foi alterado o tráfego binário de Appwrite Functions; cabe confirmar via cabeçalho HTTP real no ambiente publicado |
| 5. Dependências | Auditoria de imports estáticos/dinâmicos confirmou uso das principais dependências do frontend, inclusive Konva, Shapefile e leitura Excel | Nenhuma biblioteca foi excluída sem prova de inutilidade. Instalação das dependências não concluiu neste ambiente |
| 6. Lazy loading | 23 rotas carregadas sob demanda; CSS do Leaflet e do editor de mapa retirados da carga inicial; imagens de modelos usam lazy/async decoding | Não há medição de velocidade em navegador |
| 7. Cache de respostas/recursos | `public/_headers` adiciona cache imutável somente para assets versionados e revalidação do HTML/Service Worker; Service Worker passa de v55 para v56 | Nenhuma resposta privada foi adicionada ao cache HTTP compartilhado |
| 8. Modularização | Novo componente isolado `ProjectListSkeleton`; as rotas passaram a módulos carregados separadamente | Refatoração geral dos arquivos gigantes de Mapa/API não realizada, por risco de regressão |
| 9. WebP | 5 prévias de modelos PNG convertidas para WebP, referências ajustadas. Dimensões de cada imagem preservadas. Logos e SVG de documentos não foram modificados | A conversão é com perdas controladas, portanto não é equivalente pixel a pixel ao PNG |
| 10. Renderizações | `ProjectMiniMap` protegido por `React.memo` mantendo `useMemo` do cálculo interno | Perfil de React DevTools e análise de renderizações por interação pendentes |
| 11. JS/TS e bundles | Code splitting das rotas e opções explícitas de minificação ESBuild, `cssCodeSplit` e `sourcemap:false` no Vite | Bundle de produção não pode ser medido sem uma compilação concluída; não houve remoção arriscada de código |
| 12. Auditoria/regressões | Métricas estáticas antes/depois + novos testes de cache, arquivos de imagem, lazy loading e política de cache; testes Node existentes passaram | Faltam build completo, Vitest, navegação autenticada, impressão e validação de Appwrite real |

## Arquivos alterados

- **13 modificados**: `package.json`, `public/sw.js`, `src/app/App.tsx`, `src/features/admin/AdminPage.tsx`, `src/features/customization/CustomizationPage.tsx`, `src/features/map/OperationalMap.tsx`, `src/features/map/TerritorialNavigator.tsx`, `src/features/projects/ProjectMiniMap.tsx`, `src/features/projects/ProjectsPage.tsx`, `src/features/projects/projectsApi.ts`, `src/main.tsx`, `src/styles/workspace.css`, `vite.config.ts`.
- **8 criados**: `public/_headers`, `public/admin-models/01_Dourado.webp`, `public/admin-models/02_Ciano.webp`, `public/admin-models/03_Verde.webp`, `public/admin-models/04_Amarelo.webp`, `public/admin-models/05_AgroMais.webp`, `src/features/projects/ProjectListSkeleton.tsx`, `tests/performance.node.cjs`.
- **5 PNGs de prévia substituídos** por imagens WebP equivalentes em dimensões: `public/admin-models/01_Dourado.png`, `public/admin-models/02_Ciano.png`, `public/admin-models/03_Verde.png`, `public/admin-models/04_Amarelo.png`, `public/admin-models/05_AgroMais.png`.
- O backend Appwrite e seus contratos de persistência não foram alterados nesta etapa.

## Testes efetuados e aprovados

- `npm run test:deploy` (estrutura de publicação)
- `npm run test:smoke` (15 verificações mais fluxo de salvamento/PWA)
- `npm run test:zoom` (zoom e alinhamento)
- `npm run test:stability` (etapas 72 a 75, armazenamento e exportações do Croqui)
- `npm run test:functions` (sintaxe das quatro Appwrite Functions)
- `npm run test:performance` (23 rotas sob demanda, imagens, cache, isolamento entre sessões, invalidação e proteção contra corrida)
- Leitura sintática TypeScript/TSX (115 fontes sem erros, ignorando arquivos de declaração `.d.ts`)

## Limitações importantes e próximos testes de homologação

1. A instalação `npm ci` excedeu o tempo disponível nesta máquina, que não tinha o conjunto de dependências do frontend instalado. Portanto, não foi possível concluir `npm run build`, `npm run test` (Vitest), análise de bundle nem testes visuais no navegador. **Não publicar como versão homologada sem essas verificações.**
2. O Appwrite real não foi conectado e não houve gravação remota nesta rodada. O comportamento da sincronização existente é preservado pelo código, mas não foi revalidado contra o serviço publicado.
3. A API lista todos os projetos antes de enviá-los. A paginação criada melhora a quantidade de elementos DOM exibidos, mas **não reduz o número de registros baixados da API**. Paginação no servidor com pesquisa, filtros e ordenação equivalentes ainda demanda desenvolvimento e validação dos índices Appwrite.
4. O cache em memória é por objeto de sessão e temporário. O botão Atualizar força uma consulta nova; alterações nesta aba invalidam o cache. Uma alteração feita em outra aba pode permanecer exibida durante no máximo o TTL antes da próxima consulta, caso o usuário não atualize manualmente.
5. Os arquivos WebP substituem somente imagens de visualização de modelos. Se alguma integração externa depender do endereço antigo dos PNGs, ela precisará usar o endereço WebP; nenhum uso externo foi possível verificar.
6. Antes da publicação, executar `npm ci`, `npm run check:release`, navegar pelas telas Login/Projetos/Mapa/Croqui/Memorial/Prancha, verificar exportação/impressão e comparar os dados salvos no Appwrite.

## Documentação oficial conferida

- Appwrite, compressão: https://appwrite.io/docs/products/network/compression (para conteúdo elegível, automática por padrão)
- Cloudflare Pages, headers: https://developers.cloudflare.com/pages/configuration/headers/
- Cloudflare Pages, Gzip/Brotli: https://developers.cloudflare.com/pages/configuration/serving-pages/

## Publicação

Este pacote inclui frontend, todas as Functions, configurações, testes e recursos necessários existentes no ZIP anterior. Nenhuma variável secreta foi adicionada. A modificação é predominantemente do **frontend**. Atualizar os arquivos do site após passar pelos testes de produção; não é necessário alterar a Function `surveyor-api` **por causa destas otimizações**.
