# Histórico consolidado do SURVEYOR

Este arquivo preserva o histórico técnico anterior à consolidação 1.0.0. Ele não define o comportamento atual do produto; para isso, use o README da raiz e o código/testes da versão corrente.

---

## README histórico anterior à 1.0.0

# Surveyor 21.11.5

Plataforma web/PWA de agrimensura, topografia, georreferenciamento, regularização fundiária e gestão técnica de projetos rurais.

Este arquivo é a **documentação única do projeto**. Relatórios de hotfix, auditorias, READMEs antigos e arquivos de anotações foram consolidados aqui para manter o repositório limpo.

> **Base organizada:** Surveyor 21.11.5 / R19 — 15/09/2026  
> **Frontend:** 21.11.5  
> **surveyor-api:** `2.26.9-security-safe-r3-r4`  
> **surveyor-save:** `2.2.2-security-safe-r2`  
> **surveyor-support:** `1.1.0`  
> **Cloudflare GeoServices Worker:** `2.24.0-layer-source-matrix-auth-r19`
> **Security Safe R1:** segurança incremental sem novas ENV/collections/scopes obrigatórias; login público do Appwrite sem API key administrativa; 3 erros de senha bloqueiam por 5h; autorização de plano reforçada no backend.
> **Security Safe R2:** autorização profunda/IDOR; role admin estrito; payloads de projetos/documentos blindados; lock sem `force`; Google Drive vinculado ao workspace; permissões de categoria verificadas também em leitura/edição/download. O fluxo de login homologado na R1 não foi reescrito.
> **Security Safe R3+R4:** preserva o login homologado e acrescenta mensagens progressivas de tentativas (2 restantes, 1 restante, bloqueio após a 3ª falha por 5h), tokens transitórios de verificação/primeiro acesso/reset em cookies HttpOnly no domínio oficial, proteção de origem em mutações autenticadas, no-store/CSP em APIs sensíveis, auditoria com redação e integridade HMAC usando segredo já existente e consolidação do painel de Segurança e sessões. Sem novas ENV, collections ou scopes obrigatórios.

---

## 1. O que existe no Surveyor

O Surveyor reúne, em uma única aplicação:

- desenho e edição de pontos, linhas e polígonos;
- cálculo de área, perímetro, vértices e coordenadas;
- confrontantes por trecho;
- importação de SHP/ZIP, KML, GeoJSON, CSV e planilhas compatíveis;
- exportação técnica e Shapefile;
- mapa base, satélite, localização e bússola;
- CAR/SICAR, CEFIR/INEMA e SIGEF/INCRA;
- catálogo GeoBahia/INEMA com 83 camadas técnicas da última base estável para a Bahia;
- WMS, WFS e GetFeatureInfo com proxies/fallbacks controlados;
- Memorial Descritivo, ODS, Mapas e Croquis, Pranchas, Planialtimetria e módulos técnicos;
- Projetos em nuvem;
- equipes/subusuários com plano, projetos e armazenamento compartilhados;
- autoria de projetos por usuário da equipe;
- administração de usuários, planos e permissões;
- PWA instalável;
- autenticação, recuperação de acesso e suporte;
- segurança, criptografia de dados sensíveis, testes automatizados e rotinas de backup.

---


## Comercialização e planos oficiais

O Surveyor possui três níveis comerciais para novas contratações — Básico, Plus e Pro — todos com **contratação exclusivamente anual**, além da página pública `/planos/`. Slugs mensais antigos permanecem apenas como compatibilidade técnica inativa para registros legados e não são oferecidos no checkout, no Admin nem na página pública.

| Plano | Contratação anual | Usuários incluídos | Projetos | Armazenamento |
|---|---:|---:|---:|---:|
| Básico | R$ 399,00/ano | 1 | 20 | 2 GB |
| Plus | R$ 699,00/ano | 2 | 100 | 20 GB |
| Pro | R$ 1.199,00/ano | 4 | Ilimitados | 100 GB |

Novas contratações são exclusivamente anuais. Adicionais e implantação white label são definidos em proposta comercial. A contratação e a ativação são acompanhadas pelo atendimento oficial, com geração de comprovante pelo painel administrativo.

> Antes de venda em escala, mantenha a revisão jurídica das páginas de Termos e Privacidade, a auditoria de permissões de produção e o teste periódico de backup/restauração previstos no `RELEASE_MANIFEST.json`.

> **R16 — estabilidade comercial:** mantém o hardening comercial da R15 e o monitoramento New Relic, mas restaura o módulo de camadas à última base estável anterior à expansão do catálogo: 83 camadas GeoBahia/INEMA, sem seletor de UF experimental. Também reforça assinatura compartilhada por equipe, publicação de camadas em schemas Appwrite legados, manutenção server-side, permissões e auditoria de sessões.

> **R19 — segurança/cota/limpeza:** login e refresh fazem a validação completa no Appwrite; requisições normais usam snapshot JWT assinado por até 15 minutos, limitado ao vencimento do plano. A Save Function valida esse JWT localmente e o GeoServices Worker exige token curto próprio. Runtimes/estilos legados sem uso e resíduos de releases anteriores foram removidos de forma conservadora.

---

## 2. Arquitetura geral

Fluxo principal:

```text
Navegador / PWA
       |
       +--> surveyor-api ------> Appwrite Auth / Database / Storage
       |
       +--> surveyor-save -----> valida JWT assinado localmente -> Appwrite
       |
       +--> surveyor-support --> e-mails / suporte / códigos
       |
       +--> GeoServices Worker Cloudflare --token curto--> INEMA / SICAR / INCRA / fontes oficiais
```

### Fronteiras de confiança

- O **navegador não é autoridade** para plano, role, owner, workspace ou limites.
- A **surveyor-api** é a autoridade central de identidade, plano, workspace e administração; login/refresh revalidam o Appwrite e emitem snapshot JWT assinado.
- A **surveyor-save** é especializada no salvamento de projetos e valida o JWT localmente com o mesmo `JWT_SECRET`, sem chamar `/api/auth/me` a cada gravação.
- O **Appwrite** mantém Auth, Database e Storage.
- O **Cloudflare GeoServices Worker** atua como proxy controlado para WMS/WFS/GetFeatureInfo externos e exige token curto `geoservices:proxy` nas rotas de dados; `/health` permanece público.
- Segredos nunca devem ficar em JavaScript público.

---

## 3. Estrutura principal de pastas

```text
Surveyor/
├── .github/                     # GitHub Actions
├── .well-known/
│   └── security.txt             # contato padronizado de segurança
├── assets/
│   ├── css/                     # estilos compartilhados e por módulo
│   ├── js/
│   │   ├── core/                # auth, API, projeto, layout, PWA etc.
│   │   ├── admin/               # administração
│   │   └── features/            # módulos funcionais
│   └── ...                      # imagens, ícones e recursos
├── functions/
│   ├── surveyor-api/            # API principal Appwrite
│   ├── surveyor-save/           # salvamento dedicado
│   ├── surveyor-support/        # suporte/e-mails
│   └── surveyor-geoservices/    # GeoServices Appwrite auxiliar
├── deploy/
│   └── cloudflare-geoservices/  # Worker WMS/WFS/GetFeatureInfo
├── scripts/                     # ferramentas locais, release, backup e auditoria
├── tests/                       # testes automatizados
├── admin/                       # painel administrativo
├── login/                       # login
├── mapa/                        # mapa principal
├── nuvem/                       # lista de projetos
├── consulta-car/                # Consulta Pública CAR
├── acervos/                     # acervos oficiais
├── memorial/
├── mapas/
├── planialtimetria/
├── pranchas/
├── ambiental/
├── ods/
├── assinatura-digital/
├── ...                          # demais módulos
├── index.html
├── 404.html
├── manifest.webmanifest
├── sw.js
├── package.json
├── package-lock.json
├── VERSION
├── RELEASE_MANIFEST.json
└── README.md                    # documentação única
```

### Arquivos de texto que permanecem de propósito

Apesar de a documentação estar concentrada neste README, dois arquivos `.txt` continuam necessários:

- **`VERSION`**: versão usada por código/testes/release. Não é documentação duplicada.
- **`.well-known/security.txt`**: padrão público para informar como reportar vulnerabilidades. Deve continuar acessível em `/.well-known/security.txt`.

---

## 4. Mapa do código frontend

### Core

| Responsabilidade | Arquivo principal |
|---|---|
| configuração de endpoints | `assets/js/core/api.js` |
| autenticação/sessão | `assets/js/core/auth.js` |
| persistência/nuvem | `assets/js/core/projects.js` |
| layout principal | `assets/js/core/layout.js` |
| PWA/onboarding | `assets/js/core/onboarding.js` e runtime compartilhado |
| identidade/preview de documentos | arquivos `document-*` em `assets/js/core/` |

### Mapa

O arquivo central da **árvore de camadas e grande parte do runtime geográfico** é:

```text
assets/js/features/mapa/app.js
```

Ele concentra, entre outras coisas:

- `syncCatalogLayers()`;
- `refresh()` da árvore de camadas;
- preferências de camada;
- adicionar/remover camada;
- transparência;
- WMS/WFS;
- SICAR/CAR;
- CEFIR;
- enriquecimento fundiário;
- SIGEF/INCRA;
- consulta pontual;
- painéis CAR/SIGEF/coordenadas.

Outros arquivos importantes do mapa:

| Arquivo | Função |
|---|---|
| `workspace.js` | geometria do projeto, desenho, seleção, edição e estado de ferramentas |
| `import.js` | importação de camadas/arquivos |
| `shapefile.js` | exportação Shapefile |
| `crs.js` | CRS e transformações geográficas |
| `bootstrap.js` | inicialização e correções de runtime |
| `friendly-ui.js` | UX/controles amigáveis |
| `panel.js` | estrutura dos painéis do mapa |
| `controls.js` | controles de navegação |

### Administração

| Arquivo | Função |
|---|---|
| `assets/js/admin/app.js` | administração principal |
| `team.js` | equipes/subusuários e compatibilidade |
| `organization.js` | organização do painel |
| `documents.js` | documentos administrativos de plano |
| `ai.js` | recursos administrativos de IA |

---

## 5. Camadas geográficas

O catálogo ativo foi restaurado para a **base estável de 83 camadas GeoBahia/INEMA** da Bahia. A expansão nacional/localidade fica fora desta release até ser reintroduzida sobre uma base validada em produção.

### Regra atual de renderização

Para evitar sobrecarga nos servidores públicos:

```text
Visualização de camada pesada -> WMS primeiro
Consulta pontual/atributos      -> GetFeatureInfo ou WFS pequeno
```

Regras atuais:

- GeoBahia/INEMA: **WMS-first**;
- WFS genérico no frontend: no máximo **50 feições**;
- WFS pesado só deve ocorrer em zoom próximo (regra atual: zoom 15+ quando habilitado);
- SICAR/CEFIR pontual: timeouts do frontend alinhados para **45 s**;
- Proxy GeoServices: timeout de até **90 s**;
- nada de baixar milhares de polígonos apenas para pintar a tela;
- Limites de Propriedade têm tratamento próprio para não serem afetados por alterações globais do catálogo.
- camadas densas de escala estadual (`Vegetação`, `Solos`, `Geologia 2004`, `Geomorfologia 2004`, `Bacias Ottocodificadas` e `Bacias Otto Nível 4`) só iniciam o WMS a partir do **zoom 12**; abaixo disso o card informa que é necessário aproximar o mapa, em vez de ficar preso em carregamento parcial;
- o resolvedor de nomes técnicos consulta `GetCapabilities` e mantém aliases de versões anteriores. A UC estadual usa `uc_inema_2025` como referência atual, com compatibilidade 2024/2023/2021; a servidão ferroviária possui aliases de `faixa_servidao` e `faixa_dominio`.

### Limites de Propriedade / CAR

- fonte cadastral principal: SICAR/CAR oficial;
- renderização foi migrada para estratégia leve WMS;
- seleção cadastral continua estrita: um clique não pode retornar imóvel vizinho apenas por proximidade;
- consulta sem cadastro ainda devolve DD, DMS e UTM;
- marcador de interrogação funciona mesmo com a camada visual desligada.

### SIGEF / INCRA

O enriquecimento fundiário evita WFS massivo.

Fluxo atual:

```text
ponto consultado
   -> GetFeatureInfo WMS
   -> INFO_FORMAT=text/html
   -> parser da tabela retornada pelo i3geo
```

O sistema reconhece, quando publicados pelo serviço oficial, campos como:

- nome do imóvel/parcela;
- detentor/proprietário;
- código da parcela;
- matrícula;
- CNS;
- área;
- situação;
- datas e atributos associados.

O acesso ao INCRA tenta conexão direta no navegador e possui fallback pelo Worker quando aplicável. Erros CORS, 522 ou indisponibilidade do órgão devem ser tratados como indisponibilidade externa, não como queda total do Surveyor.

### Worker GeoServices

Fonte:

```text
deploy/cloudflare-geoservices/src/worker.js
```

Rotas principais:

```text
/health
/resolve
/wms?target=<url>
/wfs?target=<url>
/info?target=<url>
/wms-url/<payload>
/wfs-url/<payload>
/info-url/<payload>
```

O Worker possui allowlist de hosts e não deve virar um proxy aberto para qualquer URL.

---

## 6. Projetos e equipes

### Projetos

O mesmo projeto pode conter várias áreas/feições. Várias glebas dentro de um projeto **não contam como vários projetos**.

A nuvem preserva:

- nome do projeto;
- proprietário/possuidor;
- município/UF;
- geometria e elementos;
- histórico/versões quando aplicável;
- autoria do projeto.

### Autoria em equipe

Projetos compartilhados dentro da mesma equipe mostram quem criou cada projeto:

```text
Feito por: Nome do usuário
```

Editar posteriormente não deve trocar indevidamente o autor original.

### Equipes/subusuários

O titular continua sendo o owner da assinatura. Os membros compartilham:

- plano;
- projetos;
- documentos;
- franquia de armazenamento.

O backend usa `workspace_members` como armazenamento principal e possui fallback controlado por preferências do usuário para compatibilidade com schemas antigos.

---

## 7. Backend Appwrite

### surveyor-api

Pasta:

```text
functions/surveyor-api
```

Responsabilidades:

- autenticação e sessão;
- perfis;
- planos;
- usuários/admin;
- equipes/workspaces;
- projetos/listagens;
- permissões;
- integrações;
- regras centrais de autorização;
- criptografia e segurança.

Configuração recomendada no Appwrite:

```text
Root directory: functions/surveyor-api
Runtime: Node.js 22
Entrypoint: src/main.js
Build command: npm install --omit=dev
Production branch: main
```

Health:

```text
https://api.surveyorr.com.br/api/health
```

### surveyor-save

Pasta:

```text
functions/surveyor-save
```

Responsabilidade: superfície dedicada para criação e atualização dos bundles de projeto.

Configuração:

```text
Root directory: functions/surveyor-save
Runtime: Node.js 22
Entrypoint: src/main.js
Build command: npm install --omit=dev
Production branch: main
```

A Function valida o token server-to-server na `surveyor-api` antes de gravar.

### surveyor-support

Pasta:

```text
functions/surveyor-support
```

Responsabilidades:

- formulário de suporte;
- envio de e-mails;
- códigos de verificação;
- mensagens de boas-vindas;
- comunicações administrativas autorizadas.

Configuração:

```text
Root directory: functions/surveyor-support
Runtime: Node.js 22
Entrypoint: src/main.js
Build command: npm install --omit=dev
Production branch: main
```

### surveyor-geoservices

Pasta:

```text
functions/surveyor-geoservices
```

Function Appwrite auxiliar para WMS/WFS/GetFeatureInfo e importações controladas quando necessário.

Configuração:

```text
Root directory: functions/surveyor-geoservices
Runtime: Node.js 22
Entrypoint: src/main.js
Build command: npm install
```

---

## 8. Variáveis de ambiente

Nunca grave valores reais no repositório. Use os `.env.example` apenas como referência de nomes.

### API principal

Principais grupos:

- Appwrite endpoint/project/database/API key;
- collections de projetos, documentos, usuários, planos e workspace;
- buckets;
- JWT e parâmetros de sessão;
- chaves de criptografia;
- CORS;
- limites geométricos;
- GeoServices;
- Google Drive quando habilitado;
- Function de e-mail;
- pagamentos;
- integrações opcionais.

Arquivo de referência:

```text
functions/surveyor-api/.env.example
```

### Save

Arquivo:

```text
functions/surveyor-save/.env.example
```

Use uma API key exclusiva para o serviço de Save e mantenha `ALLOW_DYNAMIC_APPWRITE_KEY=false` em produção.

### Support

Arquivo:

```text
functions/surveyor-support/.env.example
```

Contém configurações de e-mail/suporte, CORS e segredo interno entre Functions.

### GeoServices

Arquivo:

```text
functions/surveyor-geoservices/.env.example
```

HTTP inseguro/TLS inválido deve permanecer desligado em produção salvo diagnóstico temporário e consciente.

---

## 9. Rodar localmente

Pré-requisitos:

- Node.js compatível com `.node-version`;
- npm.

Instale dependências:

```bash
npm install
```

Suba o servidor local:

```bash
npm run dev:local
```

Endereço padrão:

```text
http://localhost:5500/login/
```

Porta customizada:

```bash
SURVEYOR_LOCAL_PORT=5600 npm run dev:local
```

No Windows também existe:

```text
DEV.bat
```

O frontend local continua apontando para os endpoints definidos em `assets/js/core/api.js`, respeitando as regras de desenvolvimento permitidas pelo projeto.

---

## 10. Testes

Antes de qualquer ZIP/deploy, prefira o gate unificado:

```bash
npm run integrity:local
```

No Windows, o mesmo fluxo pode ser executado por duplo clique em:

```text
TESTAR.bat
```

O gate sincroniza a versão, valida integridade/sintaxe, verifica as Functions, executa `npm test` e gera a release pública limpa. Para rodar somente a suíte de regressão:

```bash
npm test
```

A suíte principal cobre, entre outros:

- scan de segredos;
- criação/admin;
- confrontantes;
- 83 camadas técnicas GeoBahia/INEMA da base estável na Bahia;
- busca inteligente;
- máscaras DD/DMS/DDM/UTM;
- remoção e readição de camadas;
- importação grande local;
- mapas/croquis;
- PWA;
- persistência de projetos;
- autoria em equipe;
- limite de projetos;
- edição de vértices;
- importação sem alças fantasmas;
- GeoBahia/WMS-first;
- Limites de Propriedade;
- SIGEF/INCRA;
- timeouts SICAR/CEFIR;
- painéis CAR/SIGEF/coordenadas;
- criptografia;
- equipes/subusuários;
- hardening de Support/GeoServices/Save/API;
- sincronização WMS/MVT durante zoom;
- preview real do catálogo de camadas;
- cotas topográficas em estilo CAD.

Comandos úteis:

```bash
npm run version:sync
npm run lint:integrity
npm run test:functions
npm run security:scan
npm run test:consulta-car
npm run test:home-cards
npm run cleanup:legacy-car-jsonl
npm run release:clean
```

---

## 11. Backup e restauração

Nunca considere um backup válido sem verificação.

Backup lógico:

```bash
npm run backup:production -- <destino>
```

Verificação:

```bash
npm run backup:verify -- <pasta-do-backup>
```

Restauração deve começar em **dry-run** e, para `--apply`, deve usar um projeto de recuperação autorizado e confirmação explícita do project ID.

Princípios:

1. guardar backup fora do mesmo caminho lógico de falha da produção;
2. verificar checksums;
3. testar restauração em ambiente vazio;
4. nunca reconstruir senhas do Appwrite Auth de forma insegura;
5. manter registro de testes de restauração.

---

## 12. Segurança

Princípios obrigatórios:

- sem segredos no repositório;
- CORS restrito às origens permitidas;
- authorization server-side;
- validação geométrica também no backend;
- rotas de bootstrap desabilitadas por padrão;
- TLS válido em produção;
- imports com limites de bytes, feições e vértices;
- sessão/refresh token tratados pela API;
- criptografia para dados configurados como sensíveis;
- logs/auditoria para operações administrativas críticas.

Contato público para segurança:

```text
https://surveyorr.com.br/.well-known/security.txt
```

---

## 13. PWA

Arquivos principais:

```text
manifest.webmanifest
sw.js
```

O Surveyor pode ser instalado como PWA. Alterações em assets/cache devem manter cache-busting/versionamento para evitar que o navegador execute JS/CSS antigo depois de uma atualização.

---

## 14. Deploy do frontend

O frontend é estático e pode ser publicado pelo GitHub Pages/Actions.

Fluxo recomendado:

```bash
npm test
git status
git add -A
git commit -m "descricao da alteracao"
git push origin main
```

Use `git add -A` quando houver exclusão de arquivos, pois ele registra arquivos removidos também.

O domínio de produção usa `CNAME` e `.nojekyll`, que não devem ser removidos.

---

## 15. Deploy do Cloudflare GeoServices

Pasta:

```text
deploy/cloudflare-geoservices
```

Comandos:

```bash
cd deploy/cloudflare-geoservices
npm install
npx wrangler login
npx wrangler deploy
```

Teste depois do deploy:

```text
https://<worker>.workers.dev/health
```

Confirme a versão retornada antes de publicar um frontend que dependa de uma alteração do Worker.

### Regra de deploy

Se a alteração mexer somente em HTML/CSS/JS do frontend, normalmente não precisa republicar o Worker.

Se mexer em:

```text
deploy/cloudflare-geoservices/src/worker.js
```

publique o Worker novamente.

---

## 16. Como saber o que precisa ser publicado

| Arquivo alterado | Deploy necessário |
|---|---|
| `assets/**`, HTML, CSS, JS frontend | frontend/GitHub Pages |
| `functions/surveyor-api/**` | Function `surveyor-api` |
| `functions/surveyor-save/**` | Function `surveyor-save` |
| `functions/surveyor-support/**` | Function `surveyor-support` |
| `functions/surveyor-geoservices/**` | Function Appwrite GeoServices |
| `deploy/cloudflare-geoservices/**` | Cloudflare Worker |
| schema/collections Appwrite | aplicar alteração no Appwrite + backend compatível |

Nunca considere uma correção de backend publicada apenas porque o frontend foi enviado ao GitHub Pages.

---

## 17. Regras para novas alterações

1. Partir sempre da última base homologada.
2. Não adicionar JS/CSS solto na raiz.
3. Código compartilhado vai em `assets/js/core/`.
4. Código de módulo vai em `assets/js/features/<modulo>/`.
5. Não criar novos relatórios `.md/.txt` na raiz; registrar documentação neste `README.md`.
6. Se for necessário histórico técnico muito detalhado, use Git/commits/issues, não dezenas de arquivos soltos.
7. Toda mudança deve informar quais serviços precisam de deploy.
8. Rodar `npm run integrity:local` antes do ZIP.
9. Preservar funcionalidades homologadas enquanto corrige outra área.
10. Camada externa deve ter comportamento isolado; falha de uma fonte não deve mudar globalmente o restante do catálogo.

---

## 18. Estado técnico atual das áreas críticas

### Homologado/estável na base

- PWA e navegação principal;
- persistência de projetos e recovery local;
- edição real de vértices pelo card;
- importação sem alças fantasmas;
- alternância dos painéis direitos;
- consulta de coordenadas sem cadastro;
- busca inteligente CAR/coordenadas;
- scroll individual CAR/SIGEF;
- remoção/readição de camadas;
- autoria de projetos em equipes;
- limite `0` de projetos tratado como não-bloqueante;
- segurança/scan automatizado.

### Dependente de serviços externos

- disponibilidade individual das camadas INEMA/GeoBahia;
- CAR/SICAR;
- SIGEF/INCRA;
- fontes oficiais que podem oscilar, mudar schema, aplicar firewall ou ficar fora do ar.

O Surveyor deve distinguir **indisponibilidade do órgão externo** de **indisponibilidade da API principal do produto**.

---

## 19. Workflow técnico modular do mapa — 2026-09-04

As melhorias de fluxo do mapa são carregadas em módulos independentes, sem reescrever o núcleo legado:

- `save-status.js`: estado Salvo / Alterações pendentes / Salvando / recuperação local offline;
- `snap.js`: snap ao vivo opcional para vértices, segmentos/perpendicular e prolongamentos;
- `audit.js`: comando **Verificar Projeto**, nota técnica e ações de correção;
- `history.js`: histórico descritivo da sessão integrado ao ↶/↷ e às versões da nuvem;
- `dossier.js`: geração do Dossiê Técnico ZIP com PDFs, coordenadas, GeoJSON, KML, Shapefile e metadados;
- `enhancements.css`: apresentação das melhorias acima.

O núcleo `app.js` continua sendo a fonte de verdade para geometria e persistência, expondo apenas pontes de runtime para os módulos novos. A modularização deve continuar **progressivamente**, extraindo responsabilidades estáveis sem reescrever o mapa ou alterar contratos da API em uma única entrega.

A recuperação de rascunho usa o mesmo `attach(layer)` do fluxo normal, e o pipeline de release exige `VERSION`, evitando uma release aparentemente válida sem o marcador de versão.

---

## 20. Histórico resumido da linha 21.11.5

A 21.11.5 passou por uma consolidação extensa com foco em:

- refinamento comercial de UI;
- mapa e ferramentas;
- CAR/SIGEF e camadas oficiais;
- WMS-first para camadas densas;
- busca inteligente;
- painéis CAR/SIGEF/coordenadas;
- equipes e compartilhamento;
- autoria de projetos;
- criptografia e persistência;
- PWA/onboarding;
- correções de Admin;
- importação/exportação;
- estabilidade e testes de regressão.

O histórico detalhado continua disponível no Git. Este README documenta **o estado atual**, não cada tentativa intermediária.

---

## 21. Checklist antes de entregar uma versão

```text
[ ] Partiu da última base oficial
[ ] npm run integrity:local passou
[ ] npm test passou
[ ] security:scan passou
[ ] nenhum segredo real foi incluído
[ ] VERSION continua correto
[ ] alterações de frontend receberam cache-bust quando necessário
[ ] Functions alteradas foram publicadas
[ ] Worker alterado foi publicado
[ ] /health dos serviços alterados foi conferido
[ ] login foi testado
[ ] abrir/salvar projeto foi testado
[ ] mapa, desenho e edição foram testados
[ ] camadas críticas foram testadas
[ ] CAR/SIGEF foram testados quando a fonte externa estava disponível
[ ] ZIP foi validado antes da entrega
```

---

## 22. Contato e produção

Site:

```text
https://surveyorr.com.br/
```

API:

```text
https://api.surveyorr.com.br/
```

Suporte e segurança usam os contatos configurados no ambiente de produção e no `security.txt` público.

---

**Importante:** este README substitui os antigos relatórios, runbooks e arquivos de documentação espalhados. Ao alterar arquitetura, deploy, segurança, Functions, Worker ou regras centrais do Surveyor, atualize este arquivo na mesma alteração.


---

## Documento histórico: `R19_SEGURANCA_COTA_LIMPEZA.md`

# Surveyor R19 — Segurança, economia de cota e limpeza técnica

> **Nota R21.1:** a exigência de `GEOSERVICES_TOKEN_SECRET` descrita abaixo foi descontinuada. O Worker atual usa allowlist rígida de hosts oficiais e não exige token secret. Esta seção permanece apenas como histórico da R19.


Data: 15/09/2026

## Objetivo

A R19 endurece a autorização sem transformar o Appwrite em uma consulta por clique. O login e o refresh continuam sendo os pontos de revalidação completa da conta, plano, vencimento, equipe e bloqueio. Entre esses pontos, as rotas protegidas usam um snapshot de autorização dentro de um JWT HS256 assinado pelo backend.

## Sessão e assinatura

- Login/2FA/refresh resolvem o usuário real, plano efetivo, equipe, permissões, estado da conta e expiração no backend.
- O access token carrega o snapshot assinado do usuário, owner efetivo e workspace.
- O access token tem TTL máximo de 15 minutos e nunca pode ultrapassar a data de expiração da assinatura.
- Requisições normais validam assinatura/expiração do JWT localmente e não fazem leitura Appwrite de autenticação a cada ação.
- O refresh reconsulta Appwrite, detecta bloqueio/revogação, recalcula equipe/plano/permissões e rotaciona o refresh token.
- O frontend deixou de consultar `/api/auth/me` em polling frequente. O watch local é 60 s com a aba visível e 5 min oculta, renovando apenas próximo da expiração.
- Presence/auditoria periódica foi reduzida para 5 minutos para diminuir consumo sem perder rastreabilidade operacional.

### Consequência intencional

Bloqueio, troca de plano ou alteração de permissão feita enquanto o usuário já está com uma sessão válida pode levar até o TTL do access token (máximo aproximado de 15 min) para valer em todas as requisições normais. O refresh aplica a mudança imediatamente. Esse é o compromisso escolhido para não consultar Appwrite a cada clique. A expiração contratual não pode ser ultrapassada pelo token porque o TTL é limitado ao vencimento.

## Save Function

A `surveyor-save` não chama mais `/api/auth/me` em cada salvamento. Ela valida localmente o access token HS256 com o mesmo `JWT_SECRET` da API e continua impondo owner/workspace e permissões no servidor. Tokens inválidos, expirados, contas bloqueadas no snapshot e plano expirado são rejeitados.

## GeoServices Cloudflare

O Worker passou para `2.24.0-layer-source-matrix-auth-r19`.

- `/health` permanece público para monitoramento.
- Rotas de proxy/resolução WMS/WFS exigem token curto com escopo `geoservices:proxy`.
- O token é emitido somente após login/refresh válido.
- O Worker valida HMAC no próprio edge, sem consultar Appwrite.
- Sem `GEOSERVICES_TOKEN_SECRET`, as rotas protegidas falham fechadas (503).
- Token ausente/inválido é rejeitado (401/403).
- A allowlist de hosts oficiais continua ativa; o Worker não vira proxy arbitrário.

Isso reduz o risco de terceiros usarem diretamente o endpoint público do Worker para consumir sua cota.

## Planos e permissões

Os planos comerciais ativos continuam sendo somente:

- `basic_annual`
- `plus_annual`
- `pro_annual`

Os slugs mensais permanecem apenas como compatibilidade de contas antigas e estão `active: false`. Autorizações sensíveis continuam sendo decididas no servidor; `role`, `ownerId`, plano ou permissões enviados pelo browser não são fonte de autoridade.

## Limpeza técnica

Foi feita uma limpeza conservadora, baseada em referências reais e testes, sem apagar arquivo apenas por parecer antigo. Foram removidos runtimes antigos de Mapas/UX que já não eram carregados, testes correspondentes obsoletos e documentos/scripts de releases R15/R16/R18 que estavam apenas como resíduo de pacote. Uma varredura pós-limpeza não encontrou JS/CSS órfão entre os assets de produção.

O catálogo estável de 83 camadas GeoBahia/INEMA foi preservado, assim como New Relic e as correções R16–R18.

## Segredos obrigatórios antes do deploy R19

Nunca coloque estes valores no Git ou no frontend.

### surveyor-api (Appwrite Function)

- `JWT_SECRET`: manter o valor atual de produção.
- `GEOSERVICES_TOKEN_SECRET`: gerar segredo independente com pelo menos 32 caracteres.

### surveyor-save (Appwrite Function)

- `JWT_SECRET`: **mesmo valor exato** usado na `surveyor-api`.

### Cloudflare Worker

No diretório `deploy/cloudflare-geoservices`:

```powershell
npx wrangler secret put GEOSERVICES_TOKEN_SECRET
npx wrangler deploy
```

Ao solicitar o valor do segredo, informe exatamente o mesmo `GEOSERVICES_TOKEN_SECRET` configurado na `surveyor-api`.

Se o Worker R19 for publicado sem esse segredo, `/health` responderá, mas as rotas de camadas retornarão 503 por segurança.

## Ordem recomendada de publicação

1. Configurar os segredos da API e Save no Appwrite.
2. Republicar `surveyor-api` e `surveyor-save`.
3. Configurar `GEOSERVICES_TOKEN_SECRET` no Cloudflare e publicar o Worker.
4. Publicar o frontend/dist da R19.
5. Fazer login novamente para receber access token e GeoServices token no formato novo.
6. Validar mapa/camadas, criação e salvamento de projeto, membro de equipe e Admin.

## Proteção contra abuso de API

O R19 remove uma superfície importante de abuso do GeoServices e mantém rate limits de aplicação. Para proteção distribuída contra tráfego volumétrico, o rate limiting em memória de Functions é apenas defesa adicional; o controle forte deve ficar também no edge (Cloudflare/WAF/rate limiting) e nos limites da plataforma. Isso é configuração de infraestrutura e não deve ser simulada como garantia dentro do código.

## Validação

A release possui teste específico `test-r19-session-proxy-cleanup.cjs`, testes do Worker autenticado e todo o gate já existente. Uma release só deve ser publicada se `npm run integrity:local` concluir sem falhas.


---

## Documento histórico: `R20_GERACAO_REPETIDA_ROTULOS_LAYOUT.md`

# Surveyor R20 — geração repetida, rótulos técnicos e layout de formulários

## Escopo

A R20 parte da base R19 e corrige problemas funcionais/visuais apontados durante testes reais dos módulos técnicos.

## Correções

### Mapas e croquis / Pranchas técnicas
- Troca de projeto invalida imediatamente qualquer geração anterior ainda em andamento.
- Estado do visualizador PDF anterior é descartado ao selecionar outro imóvel.
- O visualizador PDF agora versiona requisições de renderização; uma renderização antiga não pode sobrescrever a mais nova.
- Gerações novas deixam de ser ignoradas quando uma renderização anterior ainda está ocupada.
- Mantido fallback para SVG se a pré-visualização PDF falhar.

### Rosa dos ventos
- Removido o disco branco de fundo.
- Rosa dos ventos agora é transparente sobre o mapa.
- Aplicado no gerador de Mapas/Croquis, Pranchas, Planialtimetria, Perímetros e Memorial.

### Planialtimetria
- Removidas caixas brancas dos rótulos altimétricos/vértices.
- Textos ficaram menores, pretos e técnicos.
- Mantido halo tipográfico mínimo apenas para legibilidade sobre grade/cores, sem retângulo de fundo.

### Perímetro por azimute
- Rótulos de azimute + distância deixaram de usar caixa branca.
- Redução de tamanho e mudança para preto.
- Rótulos passam a ser deslocados perpendicularmente para fora da linha, evitando ficarem colados ao segmento.
- Identificação de vértices também deixa de usar caixa branca e fica mais compacta.

### Formulários dos módulos técnicos
- Regra canônica do workspace foi editada, não sobrescrita com remendo adicional.
- Coluna de configuração ganhou largura útil.
- Aumentado espaçamento horizontal e vertical entre campos.
- Melhor separação visual entre label, input e campos adjacentes.

## Política de implementação

Nesta release as regras existentes foram substituídas nos pontos responsáveis pelos comportamentos antigos. Não foi criado um bloco de CSS no fim do arquivo apenas para sobrepor regras anteriores, e helpers antigos de rótulos com caixas brancas foram removidos/substituídos onde eram a causa do problema.

## Validação

- `node --check` nos runtimes modificados: PASS
- `tests/test-r20-repeat-generation-labels-layout.cjs`: PASS
- `npm test`: PASS
- `npm run release:clean`: PASS
- Build público em `dist/surveyor-frontend` confirmado com as alterações R20.

## Commit limpo padrão

```powershell
git status
git add -A
$tree = git write-tree
$commit = "release: R20 base limpa definitiva do Surveyor" | git commit-tree $tree
$commit
git push origin "$commit`:refs/heads/main" --force
```


---

## Documento histórico: `R21_1_GEOSERVICES_SEM_TOKEN_SECRET.md`

# R21.1 — GeoServices sem token secret

Correção do Worker Cloudflare para restaurar o fluxo operacional sem `GEOSERVICES_TOKEN_SECRET`.

## Alterações
- removida a autenticação HMAC obrigatória do Worker GeoServices;
- removida a emissão e o transporte de `geoservicesToken`;
- mantida a allowlist rígida de hosts oficiais;
- mantidos somente métodos GET/HEAD/OPTIONS;
- mantida validação do destino antes do proxy;
- SICAR nacional continua disponível em `geoserver.car.gov.br`;
- `/health` continua público.

O Worker não deve mais responder `503 GEOSERVICES_AUTH_NOT_CONFIGURED` pela ausência de secret.


---

## Documento histórico: `R21_SICAR_NACIONAL_ADMIN.md`

# SURVEYOR R21 — SICAR nacional, estado por conta e Administração

## Escopo

A R21 migra a camada visual **Imóvel Rural - Limites de Propriedade** da dependência específica GeoBahia/INEMA para o **CAR/SICAR oficial por UF**, mantendo o catálogo GeoBahia para os demais temas oficiais da Bahia. Também consolida a seleção de estado por usuário, corrige a organização de membros de equipe no Admin, melhora a atualidade dos logs/sessões, valida os modos de aviso/manutenção e corrige o espaço branco causado pelo redimensionamento do painel lateral do mapa.

## Limites de propriedade — CAR/SICAR nacional

O catálogo passa a expor uma camada SICAR de limites de imóveis rurais para cada uma das 27 UFs. A nomenclatura técnica usada é `sicar:sicar_imoveis_<uf>`, em minúsculas, com os serviços oficiais do GeoServer CAR/SICAR.

- WMS base: `https://geoserver.car.gov.br/geoserver/sicar/wms`
- OWS/WFS base: `https://geoserver.car.gov.br/geoserver/sicar/ows`
- UFs: AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE e TO.
- A camada visual de limites é renderizada por WMS; consultas vetoriais por viewport usam WFS quando necessário.
- A antiga camada de limites de propriedade do GeoBahia não é mais a fonte visual deste item.
- As demais camadas oficiais GeoBahia continuam disponíveis para a Bahia. O conjunto específico GeoBahia passa de 83 para 82 entradas, pois somente a antiga entrada de limites foi substituída pela fonte nacional SICAR.

## Estado do catálogo por conta

Ao abrir **Adicionar camada**, uma conta sem estado configurado recebe a etapa de seleção de UF. A escolha é persistida nas preferências da conta pelo backend. Depois disso:

- o estado atual aparece no topo direito do catálogo;
- clicar no estado permite trocar a UF;
- somente camadas compatíveis com a UF selecionada são exibidas;
- ao entrar novamente, o usuário reaproveita sua UF salva sem precisar escolher de novo;
- não existe opção genérica “Todas as localidades”.

## GeoServices / Cloudflare

O Worker continua protegido pelo token curto introduzido na R19 e mantém `geoserver.car.gov.br` na allowlist. A versão R21 é:

`2.25.0-sicar-national-r21`

O Worker deve ser republicado junto da R21 para manter versão, diagnóstico e runtime sincronizados.

## Painel lateral do mapa

Foi corrigido o espaço branco que aparecia entre o painel lateral e o mapa ao redimensionar o painel. A largura visual do painel e a variável CSS que define a coluna do grid agora são atualizadas em conjunto. As regras antigas com `!important` que impediam a variável dinâmica de assumir a largura real foram corrigidas na regra canônica, sem adicionar remendo posterior.

## Administração — equipes e assinatura compartilhada

Membros vinculados a uma equipe continuam aparecendo em **Usuários**, mas agora a Administração trata corretamente o vínculo mesmo quando ele precisou ser reconstruído pelas preferências do Appwrite.

Para membros de equipe:

- aparece o nome da equipe no card;
- o plano é exibido como **Compartilhado**;
- o vencimento aparece como compartilhado/herdado do titular;
- o perfil usa o papel real do workspace: Colaborador, Técnico ou Gestor;
- a tela de detalhes continua exibindo estado online/offline, último projeto e histórico de atividade.

A autoridade de assinatura/permissão continua no backend; a apresentação do card não cria plano próprio para o membro.

## Segurança e sessões / logs

A leitura de eventos administrativos foi ampliada para até 2.000 eventos com paginação real em blocos de 500, eliminando o antigo limite interno que fazia o Admin parar nos 500 mais recentes. O cálculo de atividade também usa o `accessedAt`/`$accessedAt` do usuário Appwrite como fallback de atualização.

Isso melhora a exibição de:

- último login;
- última atividade;
- logout;
- último projeto;
- online/offline;
- eventos recentes do usuário.

## Avisos e manutenção

Foram preservados e validados os modos existentes:

- notificação no sino;
- pop-up;
- faixa fixa;
- manutenção/bloqueio;
- aviso de login/vencimento;
- novidades da versão.

Quando um aviso possui bloqueio de aplicação, o bloqueio não depende somente do frontend: usuários comuns recebem `503 SYSTEM_MAINTENANCE` nas rotas protegidas enquanto a manutenção estiver ativa. Administradores mantêm acesso operacional para administração da ocorrência.

## Validação local

Foram executados com sucesso:

- verificações de sintaxe dos runtimes alterados;
- testes específicos SICAR nacional / estado por conta / Administração R21;
- testes de limites de propriedade por WMS/WFS;
- testes de segurança R1/R2/R3+R4;
- testes R16, R18, R19 e R20;
- New Relic Browser Monitoring;
- `npm test` completo;
- `npm run integrity:local`;
- `release:clean` e scanner de segredos.

O gate local confirmou **82/82 camadas GeoBahia específicas da Bahia + 27 camadas SICAR estaduais de limites de propriedade**.

## Limite da validação

O ambiente usado para montar a release não possui acesso externo confiável para validar visualmente, em produção, todas as respostas do GeoServer CAR/SICAR. Portanto, a integração estrutural, nomes técnicos, roteamento, filtros, autenticação e testes locais estão validados, mas a renderização efetiva de cada UF deve ser confirmada no site após os deploys.

## Ordem de publicação

1. Publicar `surveyor-api` — catálogo SICAR, preferência de estado, equipes e logs.
2. Republicar o Worker `deploy/cloudflare-geoservices`.
3. Publicar o frontend gerado em `dist/surveyor-frontend`.
4. Fazer logout/login novamente ou `Ctrl+F5` antes dos testes de produção.

## Teste recomendado em produção

Selecionar Bahia no catálogo, ativar **Imóvel Rural - Limites de Propriedade**, confirmar visualização; trocar a UF pelo seletor superior para outro estado e confirmar que o catálogo apresenta somente a camada SICAR da nova UF. Fechar e reabrir a sessão e confirmar que a UF permanece salva na conta.


---

## Documento histórico: `R22_1_ATRIBUTOS_GEOBahia_PAINEL.md`

# R22.1 — Atributos GeoBahia/CEFIR no painel do imóvel

Correção focada no painel **Informações do imóvel**.

## Problema
O GeoBahia expõe campos públicos como `ide_imovel`, `denominaca`, `area_regis`, `qtd_modfis`, `municipio`, `status` e `numero_car`. O Surveyor já conhecia parte desses aliases, mas alguns não tinham rótulo canônico nem faziam parte do enriquecimento/ordenação principal do painel.

## Correção
- `numero_car` → **Número CAR**
- `area_regis` → **Área registrada (ha)**
- `ide_imovel` → **ID do imóvel**
- `qtd_modfis` → **Qtd. módulos fiscais**
- `denominaca` continua mapeado como nome/denominação do imóvel.
- Esses campos agora entram também no enriquecimento CEFIR/GeoBahia quando disponíveis.
- A ordenação do painel foi ajustada para trazer identificação, denominação, área, módulos, município, status e CAR de forma técnica.

## Observação
A fonte nacional SICAR não necessariamente publica os mesmos nomes de atributos do GeoBahia. O Surveyor mostra o equivalente disponível sem inventar dados ausentes. Para Bahia, quando o enriquecimento GeoBahia/CEFIR devolver esses atributos, eles passam a aparecer no painel.


---

## Documento histórico: `R22_BUSCA_IMOVEL_SICAR_NOME_RAPIDO.md`

# R22 — Busca de imóvel SICAR e nome imediato

## Diagnóstico
O painel de identificação rural mostrava primeiro os campos básicos do CAR e só adicionava `Nome do imóvel` depois de aguardar o bloco assíncrono que incluía SIGEF e, depois, CEFIR. Como SIGEF pode levar dezenas de segundos, o nome aparecia tarde mesmo quando a fonte CAR/SICAR já tinha atributos suficientes ou o CEFIR por CAR podia ser consultado em paralelo.

A busca superior por nome de imóvel também permanecia ligada ao CEFIR/GeoBahia da Bahia e a lupa superior podia disparar a consulta logo após o município ter sido selecionado. Isso divergia do novo catálogo nacional SICAR e do fluxo desejado com confirmação explícita.

## Correções
- SICAR/CAR passou a ser a fonte primária da busca nominal de imóvel.
- A camada consultada é `sicar:sicar_imoveis_<uf>` conforme a UF persistida na conta/catálogo.
- `DescribeFeatureType` do SICAR é usado para descobrir os campos reais de nome e município antes de montar o CQL.
- Município continua obrigatório na busca contextual para reduzir falsos positivos.
- A lupa superior abre/confirma o assistente; a consulta começa no botão `Buscar imóvel`.
- A lista de municípios acompanha a UF selecionada, não apenas Bahia.
- No clique do imóvel, SICAR e CEFIR não aguardam mais SIGEF para preencher CAR.
- SICAR atualiza a seção CAR primeiro; CEFIR entra apenas como enriquecimento complementar; SIGEF segue em paralelo.
- Proteções contra respostas assíncronas antigas foram preservadas.

## Validação
`npm test` completo passou, incluindo o novo teste `test-map-property-sicar-fast-name-r22-20260915.cjs`.


---

## Documento histórico: `R23_PAINEL_CAR_PREFETCH.md`

# R23 — Painel CAR organizado e pré-carga SICAR

- Tabela CAR alinhada em duas colunas técnicas fixas.
- Campos duplicados são consolidados antes da renderização.
- Código do imóvel não é repetido quando é igual ao Número CAR.
- Área registrada tem prioridade sobre a área genérica.
- Qtd. módulos fiscais / módulo fiscal viram uma única linha **Módulos fiscais**.
- Campo técnico Condição foi removido; o painel exibe **Status do cadastro: Cadastrado** quando existe registro CAR.
- Município, UF, datas, código IBGE e tipo permanecem.
- Ao ativar Limites de Propriedade, o Surveyor pré-carrega uma viewport SICAR depois que o WMS termina.
- Depois de pan/zoom, nova pré-carga só ocorre após 10 segundos sem movimento.
- Clique usa primeiro o cache da viewport; se o imóvel não estiver no cache, mantém a consulta pontual existente.
- Nenhuma alteração no Worker Cloudflare é necessária nesta versão.


---

## Documento histórico: `R24_1_CRONOLOGIA_ADMIN_CORRIGIDA.md`

# R24.1 — Cronologia administrativa corrigida

## Problema real encontrado
A R24 ainda misturava fontes diferentes no resumo de sessões. O campo de login podia usar dados de refresh/Appwrite e a atividade real podia vir de preferências sem existir na mesma linha do tempo exibida. Isso permitia cartões e histórico divergirem.

## Correção
- `Último login/acesso` agora usa apenas `login_success`, `surveyor.lastLoginAt` e, para compatibilidade histórica, o `createdAt` original da família de refresh. Rotação de refresh, heartbeat e `session_resumed` não contam como login.
- Todo login bem-sucedido grava `lastLoginAt` nas preferências seguras do usuário.
- Logout normal grava `lastLogoutAt`, limpa presença e invalida/limpa as refresh sessions.
- Logout remoto grava também `lastLogoutAt` do usuário alvo.
- `Última atividade real` passa a ser calculada da mesma timeline mostrada no modal e exclui login/logout/refresh/presença.
- Último projeto salvo pelas prefs é inserido na timeline como evento sintético quando o evento de auditoria correspondente não estiver presente.
- Uma saída anterior ao último login não é exibida como saída da sessão atual.
- O alvo de logout remoto é reconhecido na timeline administrativa do usuário.

## Resultado esperado
Os cartões de Login, Atividade, Saída, Último projeto e a lista de atividades passam a usar uma cronologia coerente e a mesma fonte lógica.

## Observação sobre dados históricos
Registros antigos incorretos não podem ser inventados. Após a R24.1, novos logins/logouts/projetos passam a ser gravados corretamente; para sessões já existentes, o backend tenta recuperar a data de início pela família de refresh. Se não houver evidência confiável, é preferível mostrar `—` a exibir uma data falsa.


---

## Documento histórico: `R24_2_BUSCA_NOME_CEFIR_SICAR.md`

# R24.2 — Busca nominal Bahia reconciliada entre GeoBahia/CEFIR e SICAR

## Diagnóstico
A camada visual de Limites de Propriedade usa o CAR/SICAR nacional. Porém, na Bahia, o nome/denominação do imóvel pode estar publicado no GeoBahia/CEFIR (campo como `denominaca`) e não estar disponível como atributo pesquisável na camada nacional do SICAR.

Por isso o clique funcionava: o Surveyor identificava a geometria SICAR e depois enriquecia o painel com dados do CEFIR/GeoBahia. Já a busca por nome usava apenas o SICAR e podia retornar nenhum resultado mesmo para um imóvel existente e nomeado no GeoBahia.

## Correção
- Para a Bahia, a busca nominal consulta primeiro GeoBahia/CEFIR.
- O resultado é filtrado pelo município selecionado, quando informado.
- Quando o CEFIR retorna o Número CAR, o Surveyor consulta o SICAR pelo `cod_imovel` e usa a geometria SICAR que está efetivamente visível no mapa.
- Os atributos CEFIR são mesclados ao resultado SICAR para preservar a denominação/nome do imóvel.
- Se o CEFIR não localizar, a busca cai para o SICAR nacional como fallback.
- Para outras UFs, a busca continua usando a camada SICAR da respectiva UF.

## Resultado esperado
Na Bahia, um imóvel cujo nome apareça ao clicar e seja publicado no GeoBahia/CEFIR também passa a ser localizável pela barra de pesquisa por nome, sem trocar a fonte visual principal do mapa.

## Infraestrutura
Nenhuma alteração no Cloudflare Worker. Não exige novo deploy do GeoServices.


---

## Documento histórico: `R24_3_BUSCA_CAR_NACIONAL.md`

# R24.3 — Busca CAR nacional por UF selecionada

A busca por número CAR deixou de ser restrita à Bahia.

- Reconhece prefixos das 27 UFs.
- Usa a UF persistida no catálogo da conta.
- PI selecionado -> `sicar:sicar_imoveis_pi`; AC -> `sicar:sicar_imoveis_ac`; etc.
- Só executa automaticamente quando o prefixo do CAR coincide com a UF selecionada, evitando consultar a camada errada.
- Quando diverge, o usuário recebe instrução para trocar a UF no catálogo.
- O popup do resultado também deixa de fixar `/ BA` e usa a UF real.

Nenhuma alteração no Cloudflare Worker é necessária: o mesmo proxy WFS/WMS já encaminha o GeoServer oficial do SICAR.


---

## Documento histórico: `R24_ARMAZENAMENTO_SESSOES_ADMIN.md`

# R24 — Armazenamento compartilhado e sessões administrativas

## Armazenamento da equipe
O card de armazenamento da equipe não depende mais de `projects.sizeBytes`, porque projetos antigos podem não ter esse campo preenchido. O Admin consulta apenas os metadados do arquivo atual no Appwrite Storage (`sizeOriginal`/`size`) para cada projeto ativo e soma os documentos da equipe. Há cache curto de 2 minutos para não repetir essas consultas enquanto o Admin permanece aberto. O payload do projeto não é baixado para medir tamanho.

## Sessões e atividade
- O heartbeat de presença serve somente para Online/Offline; ele não é tratado como atividade real.
- Se uma sessão volta após 30 minutos de inatividade, a API registra `session_resumed` uma única vez, não em cada heartbeat.
- Último login/acesso usa login explícito, retomada de sessão e rotação autenticada como fallback.
- Última saída só aparece quando o logout registrado ocorreu depois do último acesso autenticado; um logout antigo deixa de parecer o encerramento de uma sessão mais nova.
- A Save Function grava nas preferências do usuário `lastActivityAt`, `lastProjectId`, `lastProjectName` e `lastProjectAt` quando cria/salva um projeto. Assim o Admin não precisa baixar todos os projetos para descobrir qual foi o último projeto do colaborador.
- O histórico do modal combina auditoria e a atividade recente consolidada da sessão em ordem cronológica.

## Compatibilidade
Projetos e eventos antigos continuam usando os logs existentes como fallback. À medida que os usuários salvarem projetos após a R24, os campos administrativos passam a refletir a nova fonte de atividade de forma imediata.


---

## Documento histórico: `R25_1_PLANOS_APLICADOS_UI_BACKEND.md`

# R25.1 — Planos aplicados de ponta a ponta

Correção consolidada após validação real da R25.

## Corrigido
- Página Projetos volta a exibir armazenamento real usado / total, espaço disponível e botão de compra.
- Endpoint autenticado `/api/storage/status` calcula armazenamento compartilhado real no backend.
- Rodapé global mostra downloads e exportações restantes no dia; atualiza após cada consumo.
- Básico deixa de receber permissões de CAR/SICAR, consulta fundiária e catálogo oficial.
- Plus/Pro recebem explicitamente as permissões de CAR e camadas oficiais.
- `/consulta-car/` exige `car:access`.
- Dados de camadas oficiais `/api/layers/:id/data...` exigem `layers:official` no backend.
- Busca por nome de imóvel e por CAR no mapa é bloqueada no Básico; coordenadas/cidades continuam funcionando.
- Catálogo oficial e WMS/WFS ficam bloqueados no Básico; importação de camada própria continua permitida.
- Planos oficiais do backend não podem ter permissões comerciais antigas reabertas por registros desatualizados da coleção `plans`.

## Matriz mantida
- Todos: projetos ilimitados pelo armazenamento; histórico/restauração; geração técnica.
- Básico: 200 MB, expansão até 2 GB, 5 downloads/dia, 5 exportações/dia.
- Plus: 500 MB, expansão até 5 GB, 20 downloads/dia, 20 exportações/dia, CAR/SICAR/camadas/equipe.
- Pro: 1 GB, expansão até 10 GB, downloads/exportações ilimitados e recursos Pro.
- Loja: https://loja.surveyorr.com.br


---

## Documento histórico: `R25_ESTAVEL_REGRAS_COMERCIAIS.md`

# R25 — Versão estável consolidada

## Regras comerciais aplicadas no backend
- Todos os planos: projetos ilimitados; o limite real é o armazenamento da conta/equipe.
- Básico: 200 MB incluídos, expansão total até 2 GB, 5 downloads/dia, 5 exportações/dia.
- Plus: 500 MB incluídos, expansão total até 5 GB, 20 downloads/dia, 20 exportações/dia.
- Pro: 1 GB incluído, expansão total até 10 GB, downloads/exportações ilimitados.
- Armazenamento de equipes é compartilhado pelo titular e membros.
- O backend aceita `prefs.surveyor.storagePurchasedBytes` ou `storageEntitlementBytes`, sempre limitado ao teto do plano, deixando a infraestrutura pronta para a futura loja.
- Loja oficial: https://loja.surveyorr.com.br

## Contabilização
Downloads de arquivos servidos pela API e exportações de projeto são contabilizados diretamente no backend. Downloads gerados localmente pelo navegador passam pelo gate central do frontend, que consome a franquia no backend antes de liberar o arquivo.

## Segurança e limite técnico
Como alguns documentos são construídos integralmente no navegador, um usuário que deliberadamente altere o JavaScript local pode contornar apenas a trava de um arquivo já presente na memória do próprio navegador. Bloqueio criptograficamente incontornável para esses documentos exigiria mover toda a geração/entrega para o servidor. As operações e arquivos servidos pela API permanecem protegidos server-side.


---

## Documento histórico: `R26_1_INTEGRACAO_PAGAMENTOS_STORAGE.md`

# R26.1 — integração Loja/Pagamentos R27.1

Atualização aplicada sobre a base estável R26 sem alterar a arquitetura do Surveyor Oficial.

## Function `surveyor-api`

- incorporada a rota `POST /api/integrations/payments/storage` recebida no pacote R27;
- a compra de armazenamento é idempotente por `paymentId`;
- o benefício é aplicado ao titular do workspace e respeita o teto do plano;
- compras que não aumentariam a capacidade atual são recusadas (`STORAGE_NO_UPGRADE`), evitando cobrança sem ganho de armazenamento;
- os planos mensais continuam apenas como compatibilidade interna legada e permanecem indisponíveis para novas contratações;
- as novas contratações seguem os planos anuais já definidos no R26.

## Integração esperada

O Worker do Pagamentos deve usar o mesmo segredo configurado como `PAYMENT_INTERNAL_SECRET` na API oficial e chamar:

- `/api/integrations/payments/provision` para plano anual;
- `/api/integrations/payments/storage` para armazenamento.


---

## Documento histórico: `R26_2_RENOVACAO_INTELIGENTE.md`

# R26.2 — renovação inteligente e checkout de novo cliente

## Renovação
- Aviso automático no sininho entre 7 e 1 dias antes do vencimento.
- O aviso possui o botão **Renovar plano**.
- O botão cria um handoff assinado com validade curta e abre o Pagamentos no mesmo plano atual.
- O Pagamentos valida o handoff e preenche a conta sem pedir login novamente.
- Existe login exclusivo de renovação para quem acessar o Pagamentos manualmente, inclusive quando o perfil estiver expirado/bloqueado por assinatura.

## Nova contratação
- A API interna de pagamentos pode consultar se um e-mail já pertence a uma conta Surveyor.
- Novo cliente pode pagar sem conta prévia.
- Após a confirmação do Pix, o provisionamento já existente cria a conta e emite o primeiro acesso.
- Um e-mail já cadastrado não pode usar o fluxo de nova assinatura sem autenticação; deve renovar a conta existente.

## Segurança
- O handoff de renovação é assinado pelo JWT da API, tem validade de 15 minutos e não carrega a senha do usuário.
- O token é removido da URL pelo frontend do Pagamentos após a validação.
- A consulta interna de existência de conta exige `PAYMENT_INTERNAL_SECRET`/`OFFICIAL_API_TOKEN`.


---

## Documento histórico: `R26_3_19_MODELO_AGRO_MAIS_E_CAMADAS.md`

# R26.3.19 — Modelo Agro+ e Limites de Propriedade

## Limites de Propriedade — Bahia
- A camada visual de Limites de Propriedade na Bahia volta a usar a fonte oficial CEFIR/INEMA (GeoBahia) pelo proxy seguro do Surveyor.
- As demais UFs continuam usando o SICAR nacional por UF.
- O objetivo é manter a geometria visual do imóvel coerente com o cadastro CEFIR retornado ao clicar/pesquisar imóveis na Bahia.

## Memorial Agro+
- Novo modelo restrito `agro-mais` com identidade visual Agro+.
- Campos automáticos: propriedade, documento, INCRA, proprietário, CPF/CNPJ, RG, cidade, comarca, área, perímetro, descrição, responsável técnico e confrontantes.
- Página de assinaturas com proprietário e até quatro confrontantes.
- O DOCX restrito não fica publicado nos assets do frontend; é entregue pela API somente a usuários liberados.

## Administração > Modelos
- Nova aba `Modelos` no painel administrativo.
- Modelos globais aparecem como disponíveis para todos.
- O modelo Agro+ possui liberação individual por usuário titular.
- A permissão fica armazenada nas preferências do usuário Appwrite (`surveyor.memorialTemplateAccess`).


---

## Documento histórico: `R26_3_21_MEMORIAL_PAGINACAO_PREVIEW.md`

# R26.3.21 — Memorial Agro+ e pré-visualização

- Memorial Agro+ agora pagina a descrição dinamicamente, sem invadir o rodapé.
- Descrição do perímetro no Agro+ é exibida como texto corrido, com quebra apenas pela largura da página.
- Se necessário, o texto ocupa páginas adicionais; a página de assinaturas permanece ao final.
- A área útil reserva margem segura acima do rodapé Agro+.
- Pré-visualizações documentais usam toda a altura disponível e possuem rolagem interna até o final do PDF.
- Correção aplicada ao CSS compartilhado das telas documentais.


---

## Documento histórico: `R26_3_58_LAYOUT_EXTREMOS_CONFRONTANTES.md`

# R26.3.58 — Layout automático por extremidades

- mantém o editor cartográfico manual removido;
- perímetro principal usa uma única cor técnica amarela;
- confrontantes são posicionados automaticamente no exterior do polígono, usando as extremidades do desenho;
- chamadas de confrontantes usam linha técnica e bloco de texto discreto, com nome e CPF/CNPJ quando disponível;
- o mesmo padrão de confrontantes foi aplicado às Pranchas Técnicas;
- motor de densidade reduz vértices e cotas em trechos críticos e aumenta espaçamento automático;
- confrontantes, cotas e vértices compartilham áreas reservadas para reduzir sobreposições.


---

## Documento histórico: `R26_3_59_DOWNLOAD_PROPRIEDADE_BUSCA_CONFRONTANTES.md`

# SURVEYOR R26.3.59 — Download de propriedade, busca CEFIR e confrontantes limpos

## Escopo

Esta revisão consolida três ajustes no fluxo de mapa e documentos cartográficos.

### 1. Confrontantes em Mapas e Croquis / Pranchas
- Mantém o posicionamento externo inteligente e a reserva de espaço contra colisões.
- Remove a linha de chamada do confrontante.
- Remove o ponto de origem da chamada.
- Remove a caixa branca atrás do texto.
- Remove o halo/borda branca do texto.
- O resultado passa a exibir somente o texto do confrontante, de forma limpa e técnica.

### 2. Download da propriedade no painel de informações
Ao consultar um imóvel pelo painel lateral do Mapa e cadastro, um novo botão **Baixar propriedade** fica disponível quando existe geometria oficial.

O download é um único ZIP organizado com:

- `01_Informacoes/informacoes-do-imovel.txt`
- `01_Informacoes/metadados.json`
- `02_Poligono/GeoJSON/*.geojson`
- `02_Poligono/KML/*.kml`
- `02_Poligono/CSV/*-vertices.csv`
- `02_Poligono/DXF/*.dxf`
- `02_Poligono/WKT/*.wkt`
- `02_Poligono/Shapefile/*`

O TXT inclui, quando disponibilizados pela fonte oficial, nome do imóvel, número CAR, área, município/UF, código municipal, identificadores, datas e demais atributos retornados.

Na Bahia o Shapefile usa o perfil SEIA/CEFIR existente. Nas demais UFs usa o perfil SICAR/CAR.

### 3. Busca por nome do imóvel
- A busca da Bahia passa a priorizar a mesma fonte da camada visual **Limites de Propriedade**: CEFIR/INEMA (GeoBahia).
- SICAR é utilizado como contingência apenas quando o CEFIR não devolve resultado.
- Foram adicionados aliases adicionais de nome e município.
- Foi adicionado fallback tolerante a diferenças de acentuação, mantendo validação final normalizada no navegador.
- Quando o filtro municipal por atributo não encontra uma correspondência forte, a busca utiliza a área/BBOX do município e filtra os resultados pelo nome.
- Ao selecionar um resultado da Bahia, a geometria usada no painel e no download permanece a geometria CEFIR/INEMA exibida no mapa.

## Compatibilidade

A versão interna `21.11.5` foi preservada para não quebrar os vínculos existentes do frontend. A revisão funcional deste pacote é **R26.3.59**.


---

## Documento histórico: `R26_3_60_EDICAO_ARESTAS_MENU_CONTEXTO_CORES.md`

# SURVEYOR R26.3.60 — Edição por arestas, menu rápido e painel compacto

Data: 20/09/2026

## Alterações

- O modo **Editar** continua permitindo arrastar cada vértice individualmente e agora também permite mover uma **aresta inteira**.
- Ao passar o mouse sobre o trecho central de uma aresta editável, ela fica vermelha. O arraste desloca os dois extremos juntos, perpendicularmente ao próprio trecho, preservando a edição ponto a ponto nos vértices.
- Os metadados de vértices automáticos/ocultos são atualizados quando uma aresta que os contém é deslocada.
- O botão direito do navegador é substituído **somente dentro do mapa** por um menu de ações rápidas do Surveyor.
  - desenho do projeto: Editar polígono, Mais informações, Baixar polígono;
  - imóvel oficial CAR/CEFIR: Informações do imóvel, Baixar imóvel (.zip);
  - ponto sem imóvel resolvido: consulta pontual às camadas oficiais visíveis.
- O painel **Detalhes do elemento** ficou menor e mais compacto e passou a mostrar a quantidade de **arestas editáveis**.
- A seleção das cores de linha e preenchimento agora é confirmada em `input`, `change` e `blur`, cobrindo o fechamento do seletor nativo do Chromium/Windows ao clicar fora.
- Fonte e `dist/surveyor-frontend` permanecem sincronizados.

## Compatibilidade

A alteração não remove o arraste de vértices nem os pontos intermediários do Leaflet.Draw. Durante a edição, a camada dos marcadores é mantida acima da faixa de captura das arestas para preservar esses controles.


---

## Documento histórico: `R26_3_61_COTAS_EXTERNAS_CONTINUAS.md`

# SURVEYOR R26.3.61 — Cotas externas contínuas

## Correção
- Corrige o efeito de cotas externas "quebradas" em lados formados por vários segmentos quase colineares.
- O anti-colisão não altera mais a distância normal de cada cota externa do perímetro.
- Quando necessário, o rótulo desliza apenas ao longo da própria aresta.
- Mantém cotas internas de glebas com o comportamento anterior.
- Aplicado às composições de mapa/croqui, referência rural, prancha clássica e planta técnica.

Base: R26.3.60.


---

## Documento histórico: `R26_3_62_ARESTAS_COMPACTAS_DRAG_REAL.md`

# SURVEYOR R26.3.62 — Arestas compactas e arraste real

Data: 20/09/2026

Base: R26.3.61.

## Correções

- Remove o bloco grande **Arestas editáveis** do painel Detalhes do elemento.
- Adiciona **Arestas** como quarta métrica compacta, ao lado de Área, Perímetro e Vértices.
- Reduz discretamente a largura do painel para liberar mais mapa.
- Corrige a captura da aresta no modo Editar: a faixa SVG invisível agora tem 24 px e não é anulada pelas regras antigas do modo de edição.
- Adiciona fallback geométrico por proximidade do cursor, portanto o usuário não precisa acertar exatamente o traço de 1–2 px.
- Ao pairar sobre o centro da aresta, o trecho fica vermelho.
- Clique/arraste move os dois vértices extremos juntos na direção perpendicular à aresta.
- A zona dos vértices continua exclusiva; as bolinhas continuam arrastáveis individualmente.
- O arraste continua mesmo se o mouse sair momentaneamente da faixa da linha.
- Cache-bust do mapa atualizado para `20260920-edge-drag-r62`.
- Fonte e `dist/surveyor-frontend` permanecem sincronizados.


---

## Documento histórico: `R26_3_63_TAREFAS_BAIANAS.md`

# SURVEYOR R26.3.63 — Tarefas baianas no painel de detalhes

## Correção

O quarto indicador do painel **Detalhes do elemento** deixa de exibir a quantidade de arestas e passa a exibir a área convertida para **tarefas baianas**.

- 1 tarefa baiana = **4.356 m²** (30 x 30 braças, considerando 1 braça = 2,20 m).
- Fórmula: `tarefas = área_m² / 4356`.
- O recurso de arraste de aresta introduzido na R26.3.62 continua funcionando, mas não ocupa mais um indicador do painel.
- Fonte e `dist/surveyor-frontend` mantidos em paridade.


---

## Documento histórico: `R26_3_64_LINHA_CONTINUA_VERTICES_LIMPOS.md`

# R26.3.64 — Linha contínua e vértices limpos

## Ajustes desta rodada

- O perímetro principal dos Mapas e Croquis passou a ser desenhado como um contorno contínuo, com junções arredondadas, eliminando o aspecto de linha quebrada.
- Removido o aro branco dos pontos de vértice.
- Removida a caixa branca ao redor dos rótulos dos vértices; os nomes dos vértices permanecem posicionados pelo motor de colisões, mas o render final mostra apenas texto limpo.
- Mantidas as demais correções já incorporadas nas versões anteriores.


---

## Documento histórico: `R26_3_65_COTAS_CONTINUAS_VERTICES_SEM_BRANCO.md`

# R26.3.65 — Cotas contínuas e vértices sem branco

## Correções

- A cadeia de cotas externas do perímetro principal agora compartilha os mesmos pontos de união entre segmentos, evitando o aspecto de linha quebrada nas laterais com vários trechos.
- Segmentos curtos do perímetro principal não usam mais a versão compacta da linha de cota quando a cadeia externa está travada; a cota permanece contínua.
- Os vértices do modelo lateral deixam de usar preenchimento branco e passam a usar ponto técnico escuro, sem aro branco.
- Também foi removido o halo branco dos vértices no modelo de prancha simplificada.
- Mantidas as correções anteriores de confrontantes, buscas, downloads, edição por arestas, tarefas baianas e perímetro contínuo.


---

## Documento histórico: `R26_3_66_COTAS_FINAS_VERTICES_MAIORES.md`

# R26.3.66 — Cotas mais finas e vértices maiores

## Ajustes
- Linhas de cota externas mais finas.
- Removidas as linhas auxiliares duplicadas nas extremidades, eliminando o efeito de estrela em vértices compartilhados.
- Número da distância ligeiramente maior.
- Número do vértice ligeiramente maior, mantendo orientação reta (sem deitar com o polígono).
- Fonte e `dist` sincronizados.


---

## Documento histórico: `R26_3_67_VERTICES_MAIORES_AJUSTE_FINAL.md`

# R26.3.67 — Ajuste final do tamanho dos números dos vértices

## Ajuste desta rodada
- Aumentado mais um pouco o tamanho do texto dos vértices em Mapas e Croquis.
- Mantida a orientação reta/upright dos vértices.
- Mantidas as linhas de cota finas e o restante das correções da R26.3.66.
- Fonte e `dist` sincronizados.


---

## Documento histórico: `R26_3_68_VERTICES_MAIORES_AJUSTE_FINO.md`

# R26.3.68 — Ajuste fino no tamanho do número do vértice

## Ajuste desta rodada
- Aumentado mais um pouco o tamanho do número dos vértices em Mapas e Croquis.
- Mantida a orientação reta/upright dos vértices.
- Mantidas as linhas de cota finas e as demais correções da R26.3.67.
- Fonte e `dist` sincronizados.


---

## Documento histórico: `R26_3_69_SESSAO_CLIENTE_SALVAMENTO.md`

# R26.3.69 — Sessão de cliente e salvamento

## Problema
Uma conta podia autenticar normalmente em uma aba e outra aba já aberta do Surveyor continuar sem o `accessToken`, porque a sessão era mantida apenas no `sessionStorage`, que é isolado por aba. Ao salvar projeto, o frontend então retornava `Sessão ausente` apesar de o usuário ter acabado de entrar.

## Correção
- Sessão corrente agora possui espelho compartilhado no `localStorage` e cópia rápida no `sessionStorage`.
- A sessão mais nova vence ao trocar de conta.
- Login/refresh em uma aba sincroniza as demais abas abertas pelo evento `storage`.
- Logout em uma aba remove a sessão das demais.
- A Save Function continua recebendo o JWT no envelope de transporte e validando-o no backend.
- Fonte e `dist` permanecem sincronizados.


---

## Documento histórico: `R26_3_70_SESSAO_PLANOS_RELOGIN.md`

# R26.3.70 — Sessão, planos e relogin no refresh

## Sessão / salvamento
- Removido o espelho de autenticação em `localStorage` introduzido na R26.3.69.
- Sessão volta a ser efêmera por aba, com cópia em memória para estabilidade durante o uso.
- O salvamento tenta reconstruir o access token pelo refresh HttpOnly quando a sessão da aba desaparece durante o uso, antes de retornar erro de autenticação.
- Cache-bust do `auth.js` e do preflight aplicado em todas as páginas para impedir execução de runtime antigo pelo navegador.

## Refresh
- Recarregar manualmente uma página protegida limpa a sessão cliente e redireciona para Login.
- Navegação normal entre módulos na mesma aba preserva a sessão.

## Matriz oficial de planos
- Básico: mapa/cadastro, projetos, documentos técnicos básicos, nuvem básica e suporte padrão. Removidos CAR/camadas oficiais, Ambiental/REURB, Perímetros, Planialtimetria, versões completas e exportação ZIP.
- Plus: tudo do Básico + CAR, camadas oficiais, WMS/WFS, geometria/SIG/terreno, Ambiental/REURB, Perímetros, Planialtimetria, compartilhamento e equipe. Não recebe recursos exclusivos Pro.
- Pro: tudo do Plus + versões completas, lixeira, travamento, exportação ZIP, recursos avançados e `company:settings` para Personalização.
- A matriz oficial também é aplicada no frontend contra tokens/cache antigos.
- A rota de Personalização passa a exigir `company:settings` no backend.
- Subusuários continuam limitados pelo papel da equipe e não recuperam curingas do plano.


---

## Documento histórico: `R26_3_72_ROLLBACK_SALVAMENTO_FUNCTION.md`

# R26.3.72 — Rollback do caminho global de salvamento

- Reverte somente a alteração global da R26.3.71.
- O botão Salvar volta a usar a Function dedicada de salvamento, como na R26.3.70.
- Mantém as correções da R26.3.70 para planos e autenticação.
- Atualiza o cache-busting do auth.js para garantir que o navegador carregue o rollback.
- O problema de "Sessão ausente" passa a ser tratado como específico da conta afetada, não como falha global do sistema.


---

## Documento histórico: `R26_3_73_TOKEN_COMPACTO_SAVE_32K.md`

# R26.3.73 — Token compacto + Save 32 KiB

## Correção imediata
- `surveyor-save` deixa de rejeitar tokens válidos acima de 8.192 caracteres.
- Limite de transporte do access token elevado para 32 KiB.
- Token ausente (`SAVE_AUTH_TOKEN_MISSING`) e token excessivo (`SAVE_AUTH_TOKEN_TOO_LARGE`) agora são erros distintos.

## Correção estrutural
- O JWT de acesso não carrega mais o objeto completo de perfil do cliente.
- Continuam no token somente os dados necessários para autenticação/autorização durante a sessão curta: identidade, papel, plano, uma única lista efetiva de permissões, limites comerciais usados pelas Functions, status/expiração e contexto mínimo do workspace.
- Foram removidos do JWT dados de contato, `generation`, `subscription`, timestamps de perfil, `planPermissions`, `permissions` duplicado, dados financeiros de assento e outros dados somente de interface.
- A resposta de login/refresh continua enviando o objeto `user` completo ao frontend; a compactação afeta apenas o JWT assinado.

## Compatibilidade
- Tokens antigos permanecem aceitos pela Save Function até 32 KiB durante a transição.
- Novos logins e refreshes recebem token compacto.
- O caminho dedicado `surveyor-save` continua sendo o mecanismo oficial de salvamento.


---

## Documento histórico: `R26_VERSAO_ESTAVEL_AUDITORIA_TOTAL.md`

# Surveyor R26 — versão estável consolidada

Data da consolidação: 2026-09-16.

## Objetivo

Esta release consolida as correções pedidas para publicação estável: regras comerciais por plano no backend, armazenamento, franquias, senha temporária, catálogo administrativo nacional de camadas, login-first e acabamento da página de Projetos.

## Projetos / armazenamento

- Todos os planos continuam com projetos ilimitados pelo espaço disponível.
- Básico: 200 MB incluídos, expansão até 2 GB.
- Plus: 500 MB incluídos, expansão até 5 GB.
- Pro: 1 GB incluído, expansão até 10 GB.
- `GET /api/storage/status` agora mostra a franquia do plano inclusive para administradores. O bypass administrativo de enforcement não mascara mais o total exibido.
- Os cards de armazenamento/projetos usam toda a largura útil do painel, sem a borda azul antiga, com borda neutra e acabamento discreto.
- Loja oficial de expansão: https://loja.surveyorr.com.br.

## Franquias

- Básico: 5 downloads/dia e 5 exportações/dia.
- Plus: 20 downloads/dia e 20 exportações/dia.
- Pro: ilimitado.
- A geração dos documentos continua livre; a franquia é consumida no download/exportação conforme a regra já consolidada.
- O indicador de franquia deixou de ficar sobreposto no centro inferior das páginas comuns; fica integrado ao conteúdo. No mapa permanece compacto e fixo.

## Senha temporária / primeiro login

- O Admin agora grava no Appwrite exatamente a senha temporária gerada/informada no formulário; antes o backend criava outra senha aleatória silenciosamente.
- A senha temporária permite login normal.
- O login não força mais a tela `/primeiro-acesso/` para contas criadas pelo Admin.
- Enquanto `mustChangePassword=true`, o usuário vê uma faixa fixa de segurança em todas as rotas protegidas.
- A faixa direciona para `/alterar-senha/`.
- Nova rota autenticada: `POST /api/auth/change-password`.
- A troca exige confirmação da senha atual e senha nova forte; depois limpa `mustChangePassword` e registra evento de segurança.
- Redefinição administrativa de senha volta a marcar `mustChangePassword=true`, portanto a faixa reaparece até a troca.
- E-mails administrativos de comprovante não empurram mais o fluxo obrigatório de primeiro acesso por link.
- O fluxo antigo de `/primeiro-acesso/` foi preservado para compatibilidade com convites/fluxos legados que ainda possam usá-lo.

## Planos / autorização

A matriz oficial continua sendo autoridade no backend, independentemente de linhas antigas persistidas no Appwrite.

### Básico

Mantém mapa, projetos, desenho/medição, produção dos documentos, histórico/restauração e recursos básicos acordados. Não recebe CAR/SICAR nacional, busca fundiária, catálogo oficial, WMS/WFS oficial, equipe/workspace ou auditoria.

### Plus / Pro

Mantêm CAR/SICAR nacional, consulta por UF, catálogo oficial, WMS/WFS, equipe/workspace e recursos profissionais. O Pro mantém recursos avançados e volume ilimitado de download/exportação.

As rotas de dados de camadas oficiais permanecem protegidas server-side por `layers:official`; não é apenas ocultação de botão.

## Administração de camadas

- `/api/admin/layers` agora entrega inventário administrativo completo: camadas persistidas + camadas virtuais SICAR nacionais + fontes oficiais virtuais INCRA.
- As 27 UFs do SICAR aparecem no Admin.
- `/api/admin/layer-groups` também inclui os grupos oficiais do sistema.
- Camadas virtuais aparecem como `Oficial · Sistema` e em modo somente leitura, evitando ações de editar/publicar/arquivar contra registros que não existem na collection Appwrite.

## Login-first / flash de conteúdo

- O domínio raiz `/` recebeu o mesmo `auth-route-preflight` usado nas demais rotas protegidas.
- O preflight executa antes do runtime visual e antes do agente New Relic, portanto visitante sem sessão é direcionado ao login sem primeiro enxergar a Home protegida.
- A auditoria encontrou zero páginas operacionais protegidas carregando `auth.js`/`portal.js` sem o preflight.
- `earth-3d` também foi alinhada ao gate de autenticação.

## Segurança preservada

- New Relic preservado.
- GeoServices continua sem `GEOSERVICES_TOKEN_SECRET`, conforme decisão do projeto.
- Allowlist de destinos oficiais do GeoServices preservada.
- Sem segredos reais no repositório conforme `security:scan`.
- Autorização das funções premium permanece server-side.

## Validação executada

- `npm test` — PASS, incluindo toda a suíte histórica R16–R25.1 e novo teste R26.
- `npm run security:scan` — PASS.
- `npm run test:functions` — PASS para surveyor-api, surveyor-save, surveyor-geoservices e surveyor-support.
- `npm run release:clean` — PASS.
- Auditoria de rotas protegidas: nenhuma rota operacional autenticada sem auth preflight.
- Catálogo SICAR validado com 27 UFs.

Novo teste: `tests/test-r26-stable-release.cjs`.

## Publicação

Para esta release, os componentes alterados que precisam de redeploy são:

1. `surveyor-api`
2. frontend

`surveyor-save` está incluído no pacote consolidado, mas não recebeu mudança funcional específica nesta rodada. Cloudflare GeoServices não precisa de redeploy.


---

## Documento histórico: `README.md`

# Surveyor 21.11.5

Plataforma web/PWA de agrimensura, topografia, georreferenciamento, regularização fundiária e gestão técnica de projetos rurais.

Este arquivo é a **documentação única do projeto**. Relatórios de hotfix, auditorias, READMEs antigos e arquivos de anotações foram consolidados aqui para manter o repositório limpo.

> **Base organizada:** Surveyor 21.11.5 / R19 — 15/09/2026  
> **Frontend:** 21.11.5  
> **surveyor-api:** `2.26.9-security-safe-r3-r4`  
> **surveyor-save:** `2.2.2-security-safe-r2`  
> **surveyor-support:** `1.1.0`  
> **Cloudflare GeoServices Worker:** `2.24.0-layer-source-matrix-auth-r19`
> **Security Safe R1:** segurança incremental sem novas ENV/collections/scopes obrigatórias; login público do Appwrite sem API key administrativa; 3 erros de senha bloqueiam por 5h; autorização de plano reforçada no backend.
> **Security Safe R2:** autorização profunda/IDOR; role admin estrito; payloads de projetos/documentos blindados; lock sem `force`; Google Drive vinculado ao workspace; permissões de categoria verificadas também em leitura/edição/download. O fluxo de login homologado na R1 não foi reescrito.
> **Security Safe R3+R4:** preserva o login homologado e acrescenta mensagens progressivas de tentativas (2 restantes, 1 restante, bloqueio após a 3ª falha por 5h), tokens transitórios de verificação/primeiro acesso/reset em cookies HttpOnly no domínio oficial, proteção de origem em mutações autenticadas, no-store/CSP em APIs sensíveis, auditoria com redação e integridade HMAC usando segredo já existente e consolidação do painel de Segurança e sessões. Sem novas ENV, collections ou scopes obrigatórios.

---

## 1. O que existe no Surveyor

O Surveyor reúne, em uma única aplicação:

- desenho e edição de pontos, linhas e polígonos;
- cálculo de área, perímetro, vértices e coordenadas;
- confrontantes por trecho;
- importação de SHP/ZIP, KML, GeoJSON, CSV e planilhas compatíveis;
- exportação técnica e Shapefile;
- mapa base, satélite, localização e bússola;
- CAR/SICAR, CEFIR/INEMA e SIGEF/INCRA;
- catálogo GeoBahia/INEMA com 83 camadas técnicas da última base estável para a Bahia;
- WMS, WFS e GetFeatureInfo com proxies/fallbacks controlados;
- Memorial Descritivo, ODS, Mapas e Croquis, Pranchas, Planialtimetria e módulos técnicos;
- Projetos em nuvem;
- equipes/subusuários com plano, projetos e armazenamento compartilhados;
- autoria de projetos por usuário da equipe;
- administração de usuários, planos e permissões;
- PWA instalável;
- autenticação, recuperação de acesso e suporte;
- segurança, criptografia de dados sensíveis, testes automatizados e rotinas de backup.

---


## Comercialização e planos oficiais

O Surveyor possui três níveis comerciais para novas contratações — Básico, Plus e Pro — todos com **contratação exclusivamente anual**, além da página pública `/planos/`. Slugs mensais antigos permanecem apenas como compatibilidade técnica inativa para registros legados e não são oferecidos no checkout, no Admin nem na página pública.

| Plano | Contratação anual | Usuários incluídos | Projetos | Armazenamento |
|---|---:|---:|---:|---:|
| Básico | R$ 399,00/ano | 1 | 20 | 2 GB |
| Plus | R$ 699,00/ano | 2 | 100 | 20 GB |
| Pro | R$ 1.199,00/ano | 4 | Ilimitados | 100 GB |

Novas contratações são exclusivamente anuais. Adicionais e implantação white label são definidos em proposta comercial. A contratação e a ativação são acompanhadas pelo atendimento oficial, com geração de comprovante pelo painel administrativo.

> Antes de venda em escala, mantenha a revisão jurídica das páginas de Termos e Privacidade, a auditoria de permissões de produção e o teste periódico de backup/restauração previstos no `RELEASE_MANIFEST.json`.

> **R16 — estabilidade comercial:** mantém o hardening comercial da R15 e o monitoramento New Relic, mas restaura o módulo de camadas à última base estável anterior à expansão do catálogo: 83 camadas GeoBahia/INEMA, sem seletor de UF experimental. Também reforça assinatura compartilhada por equipe, publicação de camadas em schemas Appwrite legados, manutenção server-side, permissões e auditoria de sessões.

> **R19 — segurança/cota/limpeza:** login e refresh fazem a validação completa no Appwrite; requisições normais usam snapshot JWT assinado por até 15 minutos, limitado ao vencimento do plano. A Save Function valida esse JWT localmente e o GeoServices Worker exige token curto próprio. Runtimes/estilos legados sem uso e resíduos de releases anteriores foram removidos de forma conservadora.

---

## 2. Arquitetura geral

Fluxo principal:

```text
Navegador / PWA
       |
       +--> surveyor-api ------> Appwrite Auth / Database / Storage
       |
       +--> surveyor-save -----> valida JWT assinado localmente -> Appwrite
       |
       +--> surveyor-support --> e-mails / suporte / códigos
       |
       +--> GeoServices Worker Cloudflare --token curto--> INEMA / SICAR / INCRA / fontes oficiais
```

### Fronteiras de confiança

- O **navegador não é autoridade** para plano, role, owner, workspace ou limites.
- A **surveyor-api** é a autoridade central de identidade, plano, workspace e administração; login/refresh revalidam o Appwrite e emitem snapshot JWT assinado.
- A **surveyor-save** é especializada no salvamento de projetos e valida o JWT localmente com o mesmo `JWT_SECRET`, sem chamar `/api/auth/me` a cada gravação.
- O **Appwrite** mantém Auth, Database e Storage.
- O **Cloudflare GeoServices Worker** atua como proxy controlado para WMS/WFS/GetFeatureInfo externos e exige token curto `geoservices:proxy` nas rotas de dados; `/health` permanece público.
- Segredos nunca devem ficar em JavaScript público.

---

## 3. Estrutura principal de pastas

```text
Surveyor/
├── .github/                     # GitHub Actions
├── .well-known/
│   └── security.txt             # contato padronizado de segurança
├── assets/
│   ├── css/                     # estilos compartilhados e por módulo
│   ├── js/
│   │   ├── core/                # auth, API, projeto, layout, PWA etc.
│   │   ├── admin/               # administração
│   │   └── features/            # módulos funcionais
│   └── ...                      # imagens, ícones e recursos
├── functions/
│   ├── surveyor-api/            # API principal Appwrite
│   ├── surveyor-save/           # salvamento dedicado
│   ├── surveyor-support/        # suporte/e-mails
│   └── surveyor-geoservices/    # GeoServices Appwrite auxiliar
├── deploy/
│   └── cloudflare-geoservices/  # Worker WMS/WFS/GetFeatureInfo
├── scripts/                     # ferramentas locais, release, backup e auditoria
├── tests/                       # testes automatizados
├── admin/                       # painel administrativo
├── login/                       # login
├── mapa/                        # mapa principal
├── nuvem/                       # lista de projetos
├── consulta-car/                # Consulta Pública CAR
├── acervos/                     # acervos oficiais
├── memorial/
├── mapas/
├── planialtimetria/
├── pranchas/
├── ambiental/
├── ods/
├── assinatura-digital/
├── ...                          # demais módulos
├── index.html
├── 404.html
├── manifest.webmanifest
├── sw.js
├── package.json
├── package-lock.json
├── VERSION
├── RELEASE_MANIFEST.json
└── README.md                    # documentação única
```

### Arquivos de texto que permanecem de propósito

Apesar de a documentação estar concentrada neste README, dois arquivos `.txt` continuam necessários:

- **`VERSION`**: versão usada por código/testes/release. Não é documentação duplicada.
- **`.well-known/security.txt`**: padrão público para informar como reportar vulnerabilidades. Deve continuar acessível em `/.well-known/security.txt`.

---

## 4. Mapa do código frontend

### Core

| Responsabilidade | Arquivo principal |
|---|---|
| configuração de endpoints | `assets/js/core/api.js` |
| autenticação/sessão | `assets/js/core/auth.js` |
| persistência/nuvem | `assets/js/core/projects.js` |
| layout principal | `assets/js/core/layout.js` |
| PWA/onboarding | `assets/js/core/onboarding.js` e runtime compartilhado |
| identidade/preview de documentos | arquivos `document-*` em `assets/js/core/` |

### Mapa

O arquivo central da **árvore de camadas e grande parte do runtime geográfico** é:

```text
assets/js/features/mapa/app.js
```

Ele concentra, entre outras coisas:

- `syncCatalogLayers()`;
- `refresh()` da árvore de camadas;
- preferências de camada;
- adicionar/remover camada;
- transparência;
- WMS/WFS;
- SICAR/CAR;
- CEFIR;
- enriquecimento fundiário;
- SIGEF/INCRA;
- consulta pontual;
- painéis CAR/SIGEF/coordenadas.

Outros arquivos importantes do mapa:

| Arquivo | Função |
|---|---|
| `workspace.js` | geometria do projeto, desenho, seleção, edição e estado de ferramentas |
| `import.js` | importação de camadas/arquivos |
| `shapefile.js` | exportação Shapefile |
| `crs.js` | CRS e transformações geográficas |
| `bootstrap.js` | inicialização e correções de runtime |
| `friendly-ui.js` | UX/controles amigáveis |
| `panel.js` | estrutura dos painéis do mapa |
| `controls.js` | controles de navegação |

### Administração

| Arquivo | Função |
|---|---|
| `assets/js/admin/app.js` | administração principal |
| `team.js` | equipes/subusuários e compatibilidade |
| `organization.js` | organização do painel |
| `documents.js` | documentos administrativos de plano |
| `ai.js` | recursos administrativos de IA |

---

## 5. Camadas geográficas

O catálogo ativo foi restaurado para a **base estável de 83 camadas GeoBahia/INEMA** da Bahia. A expansão nacional/localidade fica fora desta release até ser reintroduzida sobre uma base validada em produção.

### Regra atual de renderização

Para evitar sobrecarga nos servidores públicos:

```text
Visualização de camada pesada -> WMS primeiro
Consulta pontual/atributos      -> GetFeatureInfo ou WFS pequeno
```

Regras atuais:

- GeoBahia/INEMA: **WMS-first**;
- WFS genérico no frontend: no máximo **50 feições**;
- WFS pesado só deve ocorrer em zoom próximo (regra atual: zoom 15+ quando habilitado);
- SICAR/CEFIR pontual: timeouts do frontend alinhados para **45 s**;
- Proxy GeoServices: timeout de até **90 s**;
- nada de baixar milhares de polígonos apenas para pintar a tela;
- Limites de Propriedade têm tratamento próprio para não serem afetados por alterações globais do catálogo.
- camadas densas de escala estadual (`Vegetação`, `Solos`, `Geologia 2004`, `Geomorfologia 2004`, `Bacias Ottocodificadas` e `Bacias Otto Nível 4`) só iniciam o WMS a partir do **zoom 12**; abaixo disso o card informa que é necessário aproximar o mapa, em vez de ficar preso em carregamento parcial;
- o resolvedor de nomes técnicos consulta `GetCapabilities` e mantém aliases de versões anteriores. A UC estadual usa `uc_inema_2025` como referência atual, com compatibilidade 2024/2023/2021; a servidão ferroviária possui aliases de `faixa_servidao` e `faixa_dominio`.

### Limites de Propriedade / CAR

- fonte cadastral principal: SICAR/CAR oficial;
- renderização foi migrada para estratégia leve WMS;
- seleção cadastral continua estrita: um clique não pode retornar imóvel vizinho apenas por proximidade;
- consulta sem cadastro ainda devolve DD, DMS e UTM;
- marcador de interrogação funciona mesmo com a camada visual desligada.

### SIGEF / INCRA

O enriquecimento fundiário evita WFS massivo.

Fluxo atual:

```text
ponto consultado
   -> GetFeatureInfo WMS
   -> INFO_FORMAT=text/html
   -> parser da tabela retornada pelo i3geo
```

O sistema reconhece, quando publicados pelo serviço oficial, campos como:

- nome do imóvel/parcela;
- detentor/proprietário;
- código da parcela;
- matrícula;
- CNS;
- área;
- situação;
- datas e atributos associados.

O acesso ao INCRA tenta conexão direta no navegador e possui fallback pelo Worker quando aplicável. Erros CORS, 522 ou indisponibilidade do órgão devem ser tratados como indisponibilidade externa, não como queda total do Surveyor.

### Worker GeoServices

Fonte:

```text
deploy/cloudflare-geoservices/src/worker.js
```

Rotas principais:

```text
/health
/resolve
/wms?target=<url>
/wfs?target=<url>
/info?target=<url>
/wms-url/<payload>
/wfs-url/<payload>
/info-url/<payload>
```

O Worker possui allowlist de hosts e não deve virar um proxy aberto para qualquer URL.

---

## 6. Projetos e equipes

### Projetos

O mesmo projeto pode conter várias áreas/feições. Várias glebas dentro de um projeto **não contam como vários projetos**.

A nuvem preserva:

- nome do projeto;
- proprietário/possuidor;
- município/UF;
- geometria e elementos;
- histórico/versões quando aplicável;
- autoria do projeto.

### Autoria em equipe

Projetos compartilhados dentro da mesma equipe mostram quem criou cada projeto:

```text
Feito por: Nome do usuário
```

Editar posteriormente não deve trocar indevidamente o autor original.

### Equipes/subusuários

O titular continua sendo o owner da assinatura. Os membros compartilham:

- plano;
- projetos;
- documentos;
- franquia de armazenamento.

O backend usa `workspace_members` como armazenamento principal e possui fallback controlado por preferências do usuário para compatibilidade com schemas antigos.

---

## 7. Backend Appwrite

### surveyor-api

Pasta:

```text
functions/surveyor-api
```

Responsabilidades:

- autenticação e sessão;
- perfis;
- planos;
- usuários/admin;
- equipes/workspaces;
- projetos/listagens;
- permissões;
- integrações;
- regras centrais de autorização;
- criptografia e segurança.

Configuração recomendada no Appwrite:

```text
Root directory: functions/surveyor-api
Runtime: Node.js 22
Entrypoint: src/main.js
Build command: npm install --omit=dev
Production branch: main
```

Health:

```text
https://api.surveyorr.com.br/api/health
```

### surveyor-save

Pasta:

```text
functions/surveyor-save
```

Responsabilidade: superfície dedicada para criação e atualização dos bundles de projeto.

Configuração:

```text
Root directory: functions/surveyor-save
Runtime: Node.js 22
Entrypoint: src/main.js
Build command: npm install --omit=dev
Production branch: main
```

A Function valida o token server-to-server na `surveyor-api` antes de gravar.

### surveyor-support

Pasta:

```text
functions/surveyor-support
```

Responsabilidades:

- formulário de suporte;
- envio de e-mails;
- códigos de verificação;
- mensagens de boas-vindas;
- comunicações administrativas autorizadas.

Configuração:

```text
Root directory: functions/surveyor-support
Runtime: Node.js 22
Entrypoint: src/main.js
Build command: npm install --omit=dev
Production branch: main
```

### surveyor-geoservices

Pasta:

```text
functions/surveyor-geoservices
```

Function Appwrite auxiliar para WMS/WFS/GetFeatureInfo e importações controladas quando necessário.

Configuração:

```text
Root directory: functions/surveyor-geoservices
Runtime: Node.js 22
Entrypoint: src/main.js
Build command: npm install
```

---

## 8. Variáveis de ambiente

Nunca grave valores reais no repositório. Use os `.env.example` apenas como referência de nomes.

### API principal

Principais grupos:

- Appwrite endpoint/project/database/API key;
- collections de projetos, documentos, usuários, planos e workspace;
- buckets;
- JWT e parâmetros de sessão;
- chaves de criptografia;
- CORS;
- limites geométricos;
- GeoServices;
- Google Drive quando habilitado;
- Function de e-mail;
- pagamentos;
- integrações opcionais.

Arquivo de referência:

```text
functions/surveyor-api/.env.example
```

### Save

Arquivo:

```text
functions/surveyor-save/.env.example
```

Use uma API key exclusiva para o serviço de Save e mantenha `ALLOW_DYNAMIC_APPWRITE_KEY=false` em produção.

### Support

Arquivo:

```text
functions/surveyor-support/.env.example
```

Contém configurações de e-mail/suporte, CORS e segredo interno entre Functions.

### GeoServices

Arquivo:

```text
functions/surveyor-geoservices/.env.example
```

HTTP inseguro/TLS inválido deve permanecer desligado em produção salvo diagnóstico temporário e consciente.

---

## 9. Rodar localmente

Pré-requisitos:

- Node.js compatível com `.node-version`;
- npm.

Instale dependências:

```bash
npm install
```

Suba o servidor local:

```bash
npm run dev:local
```

Endereço padrão:

```text
http://localhost:5500/login/
```

Porta customizada:

```bash
SURVEYOR_LOCAL_PORT=5600 npm run dev:local
```

No Windows também existe:

```text
DEV.bat
```

O frontend local continua apontando para os endpoints definidos em `assets/js/core/api.js`, respeitando as regras de desenvolvimento permitidas pelo projeto.

---

## 10. Testes

Antes de qualquer ZIP/deploy, prefira o gate unificado:

```bash
npm run integrity:local
```

No Windows, o mesmo fluxo pode ser executado por duplo clique em:

```text
TESTAR.bat
```

O gate sincroniza a versão, valida integridade/sintaxe, verifica as Functions, executa `npm test` e gera a release pública limpa. Para rodar somente a suíte de regressão:

```bash
npm test
```

A suíte principal cobre, entre outros:

- scan de segredos;
- criação/admin;
- confrontantes;
- 83 camadas técnicas GeoBahia/INEMA da base estável na Bahia;
- busca inteligente;
- máscaras DD/DMS/DDM/UTM;
- remoção e readição de camadas;
- importação grande local;
- mapas/croquis;
- PWA;
- persistência de projetos;
- autoria em equipe;
- limite de projetos;
- edição de vértices;
- importação sem alças fantasmas;
- GeoBahia/WMS-first;
- Limites de Propriedade;
- SIGEF/INCRA;
- timeouts SICAR/CEFIR;
- painéis CAR/SIGEF/coordenadas;
- criptografia;
- equipes/subusuários;
- hardening de Support/GeoServices/Save/API;
- sincronização WMS/MVT durante zoom;
- preview real do catálogo de camadas;
- cotas topográficas em estilo CAD.

Comandos úteis:

```bash
npm run version:sync
npm run lint:integrity
npm run test:functions
npm run security:scan
npm run test:consulta-car
npm run test:home-cards
npm run cleanup:legacy-car-jsonl
npm run release:clean
```

---

## 11. Backup e restauração

Nunca considere um backup válido sem verificação.

Backup lógico:

```bash
npm run backup:production -- <destino>
```

Verificação:

```bash
npm run backup:verify -- <pasta-do-backup>
```

Restauração deve começar em **dry-run** e, para `--apply`, deve usar um projeto de recuperação autorizado e confirmação explícita do project ID.

Princípios:

1. guardar backup fora do mesmo caminho lógico de falha da produção;
2. verificar checksums;
3. testar restauração em ambiente vazio;
4. nunca reconstruir senhas do Appwrite Auth de forma insegura;
5. manter registro de testes de restauração.

---

## 12. Segurança

Princípios obrigatórios:

- sem segredos no repositório;
- CORS restrito às origens permitidas;
- authorization server-side;
- validação geométrica também no backend;
- rotas de bootstrap desabilitadas por padrão;
- TLS válido em produção;
- imports com limites de bytes, feições e vértices;
- sessão/refresh token tratados pela API;
- criptografia para dados configurados como sensíveis;
- logs/auditoria para operações administrativas críticas.

Contato público para segurança:

```text
https://surveyorr.com.br/.well-known/security.txt
```

---

## 13. PWA

Arquivos principais:

```text
manifest.webmanifest
sw.js
```

O Surveyor pode ser instalado como PWA. Alterações em assets/cache devem manter cache-busting/versionamento para evitar que o navegador execute JS/CSS antigo depois de uma atualização.

---

## 14. Deploy do frontend

O frontend é estático e pode ser publicado pelo GitHub Pages/Actions.

Fluxo recomendado:

```bash
npm test
git status
git add -A
git commit -m "descricao da alteracao"
git push origin main
```

Use `git add -A` quando houver exclusão de arquivos, pois ele registra arquivos removidos também.

O domínio de produção usa `CNAME` e `.nojekyll`, que não devem ser removidos.

---

## 15. Deploy do Cloudflare GeoServices

Pasta:

```text
deploy/cloudflare-geoservices
```

Comandos:

```bash
cd deploy/cloudflare-geoservices
npm install
npx wrangler login
npx wrangler deploy
```

Teste depois do deploy:

```text
https://<worker>.workers.dev/health
```

Confirme a versão retornada antes de publicar um frontend que dependa de uma alteração do Worker.

### Regra de deploy

Se a alteração mexer somente em HTML/CSS/JS do frontend, normalmente não precisa republicar o Worker.

Se mexer em:

```text
deploy/cloudflare-geoservices/src/worker.js
```

publique o Worker novamente.

---

## 16. Como saber o que precisa ser publicado

| Arquivo alterado | Deploy necessário |
|---|---|
| `assets/**`, HTML, CSS, JS frontend | frontend/GitHub Pages |
| `functions/surveyor-api/**` | Function `surveyor-api` |
| `functions/surveyor-save/**` | Function `surveyor-save` |
| `functions/surveyor-support/**` | Function `surveyor-support` |
| `functions/surveyor-geoservices/**` | Function Appwrite GeoServices |
| `deploy/cloudflare-geoservices/**` | Cloudflare Worker |
| schema/collections Appwrite | aplicar alteração no Appwrite + backend compatível |

Nunca considere uma correção de backend publicada apenas porque o frontend foi enviado ao GitHub Pages.

---

## 17. Regras para novas alterações

1. Partir sempre da última base homologada.
2. Não adicionar JS/CSS solto na raiz.
3. Código compartilhado vai em `assets/js/core/`.
4. Código de módulo vai em `assets/js/features/<modulo>/`.
5. Não criar novos relatórios `.md/.txt` na raiz; registrar documentação neste `README.md`.
6. Se for necessário histórico técnico muito detalhado, use Git/commits/issues, não dezenas de arquivos soltos.
7. Toda mudança deve informar quais serviços precisam de deploy.
8. Rodar `npm run integrity:local` antes do ZIP.
9. Preservar funcionalidades homologadas enquanto corrige outra área.
10. Camada externa deve ter comportamento isolado; falha de uma fonte não deve mudar globalmente o restante do catálogo.

---

## 18. Estado técnico atual das áreas críticas

### Homologado/estável na base

- PWA e navegação principal;
- persistência de projetos e recovery local;
- edição real de vértices pelo card;
- importação sem alças fantasmas;
- alternância dos painéis direitos;
- consulta de coordenadas sem cadastro;
- busca inteligente CAR/coordenadas;
- scroll individual CAR/SIGEF;
- remoção/readição de camadas;
- autoria de projetos em equipes;
- limite `0` de projetos tratado como não-bloqueante;
- segurança/scan automatizado.

### Dependente de serviços externos

- disponibilidade individual das camadas INEMA/GeoBahia;
- CAR/SICAR;
- SIGEF/INCRA;
- fontes oficiais que podem oscilar, mudar schema, aplicar firewall ou ficar fora do ar.

O Surveyor deve distinguir **indisponibilidade do órgão externo** de **indisponibilidade da API principal do produto**.

---

## 19. Workflow técnico modular do mapa — 2026-09-04

As melhorias de fluxo do mapa são carregadas em módulos independentes, sem reescrever o núcleo legado:

- `save-status.js`: estado Salvo / Alterações pendentes / Salvando / recuperação local offline;
- `snap.js`: snap ao vivo opcional para vértices, segmentos/perpendicular e prolongamentos;
- `audit.js`: comando **Verificar Projeto**, nota técnica e ações de correção;
- `history.js`: histórico descritivo da sessão integrado ao ↶/↷ e às versões da nuvem;
- `dossier.js`: geração do Dossiê Técnico ZIP com PDFs, coordenadas, GeoJSON, KML, Shapefile e metadados;
- `enhancements.css`: apresentação das melhorias acima.

O núcleo `app.js` continua sendo a fonte de verdade para geometria e persistência, expondo apenas pontes de runtime para os módulos novos. A modularização deve continuar **progressivamente**, extraindo responsabilidades estáveis sem reescrever o mapa ou alterar contratos da API em uma única entrega.

A recuperação de rascunho usa o mesmo `attach(layer)` do fluxo normal, e o pipeline de release exige `VERSION`, evitando uma release aparentemente válida sem o marcador de versão.

---

## 20. Histórico resumido da linha 21.11.5

A 21.11.5 passou por uma consolidação extensa com foco em:

- refinamento comercial de UI;
- mapa e ferramentas;
- CAR/SIGEF e camadas oficiais;
- WMS-first para camadas densas;
- busca inteligente;
- painéis CAR/SIGEF/coordenadas;
- equipes e compartilhamento;
- autoria de projetos;
- criptografia e persistência;
- PWA/onboarding;
- correções de Admin;
- importação/exportação;
- estabilidade e testes de regressão.

O histórico detalhado continua disponível no Git. Este README documenta **o estado atual**, não cada tentativa intermediária.

---

## 21. Checklist antes de entregar uma versão

```text
[ ] Partiu da última base oficial
[ ] npm run integrity:local passou
[ ] npm test passou
[ ] security:scan passou
[ ] nenhum segredo real foi incluído
[ ] VERSION continua correto
[ ] alterações de frontend receberam cache-bust quando necessário
[ ] Functions alteradas foram publicadas
[ ] Worker alterado foi publicado
[ ] /health dos serviços alterados foi conferido
[ ] login foi testado
[ ] abrir/salvar projeto foi testado
[ ] mapa, desenho e edição foram testados
[ ] camadas críticas foram testadas
[ ] CAR/SIGEF foram testados quando a fonte externa estava disponível
[ ] ZIP foi validado antes da entrega
```

---

## 22. Contato e produção

Site:

```text
https://surveyorr.com.br/
```

API:

```text
https://api.surveyorr.com.br/
```

Suporte e segurança usam os contatos configurados no ambiente de produção e no `security.txt` público.

---

**Importante:** este README substitui os antigos relatórios, runbooks e arquivos de documentação espalhados. Ao alterar arquitetura, deploy, segurança, Functions, Worker ou regras centrais do Surveyor, atualize este arquivo na mesma alteração.
