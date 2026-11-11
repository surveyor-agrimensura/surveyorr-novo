# Arquitetura e pontos de atenção

## Visão geral

Aplicação de página única (SPA) em React 19 + TypeScript + Vite. Não há servidor próprio: o backend são **Appwrite Functions** (Node 22) e um **Cloudflare Worker** para proxy de serviços geográficos. O frontend é estático e publicado em Pages.

Fluxo típico de um projeto: **Mapa** (desenhar/importar geometria) → **Salvar** (`surveyor-save`) → **Croqui / Memorial / Prancha** (leitura via `surveyor-api`, personalização por projeto e polígono) → exportação (PDF, SVG, DOCX, ODS, Shapefile).

## Decisões que valem preservar

- **Rotas sob demanda.** Todas as telas usam `React.lazy` (23 rotas), mantendo pequeno o bundle inicial. Leaflet e o editor de mapa só carregam ao abrir o mapa.
- **Fonte única de verdade para rótulos.** Nomes de vértices e confrontantes vêm do metadado salvo do projeto e são compartilhados por Mapa, Croqui, Memorial e Prancha (`sharedCroquiSettings`, `sharedMapAppearance`). Não duplique essa lógica por tela.
- **Rascunho local + confirmação na nuvem.** Alterações são mantidas localmente por conta/projeto/polígono e só são tratadas como sincronizadas após releitura confirmada. Falha de API nunca exibe sucesso.
- **Personalização grande vai para o Storage.** Acima de 60.000 bytes, `customization.options` é gravado criptografado no bucket `user_assets`, com hash SHA-256 e referência curta no campo.
- **PWA conservador.** O Service Worker (`public/sw.js`) só faz cache de `/assets/*` (versionados) e da página offline. Nunca guarda API, autenticação ou projetos.
- **Geometria nunca muda em silêncio.** Numeração de vértices, organização de confrontantes e análise espacial alteram rótulos ou apenas leem; mudanças em coordenadas exigem ação explícita.

## Pontos de atenção (dívida técnica)

| Item | Situação | Sugestão |
| --- | --- | --- |
| Arquivos muito grandes | `functions/surveyor-api/src/main.js` (~540 KB, ~8.000 linhas), `OperationalMap.tsx` (1.228), `advancedTerrainTools.tsx` (1.118), `MemorialPage.tsx` (~1.080), `CroquiPage.tsx` (~920) | Dividir por responsabilidade, **um arquivo por vez**, cada passo com `typecheck` + testes + conferência manual da tela |
| Estilo de código denso | Muitos arquivos têm linhas com centenas de caracteres e JSX/SVG em uma linha só | Aplicar Prettier por arquivo, em commits separados da lógica, para o diff continuar legível |
| Paginação só no cliente | A API devolve todos os projetos; a interface mostra 25 por página | Paginação no servidor exige validar índices do Appwrite e a busca multiatributo |
| Testes de interface | Os testes de regressão leem o código-fonte e rodam lógica em Node; não há teste automatizado de tela | Adicionar testes de componente (Vitest + Testing Library) e um fluxo E2E (Playwright) para login → salvar → reabrir |
| Serviços de terceiros no navegador | QR (`api.qrserver.com`), fonte Inter (Google Fonts), Nominatim | Gerar QR localmente e hospedar a fonte; reduz vazamento de dados e dependência externa |
| CSP em modo relatório | Ainda não bloqueia | Ver `docs/DEPLOY.md` para ativar |
| Dependência de versões | `package.json` usa `^` | O `package-lock.json` + `npm ci` garantem reprodutibilidade; Dependabot sugere atualizações |

## Homologação que a automação não cobre

Os testes automatizados não substituem: integração real com o Appwrite (gravação e releitura), navegação autenticada, impressão/PDF, comportamento do PWA instalado e a disponibilidade dos serviços públicos (SICAR, INEMA, INCRA). Mantenha o roteiro de `docs/HISTORICO_DE_ETAPAS.md` e o checklist de `docs/DEPLOY.md`.
