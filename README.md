# SURVEYOR

Plataforma web/PWA para agrimensura, georreferenciamento, cadastro rural, desenho e edição de geometrias, consulta a fontes oficiais e geração de documentos técnicos.

> **Linha atual de consolidação:** `1.0.0-rc.2`  
> **Meta de produção:** `1.0.0 Stable` após a bateria final de testes e correções de regressão.

## Princípios da base 1.0

- Código novo substitui a implementação antiga; não são aceitos hotfixes permanentes empilhados.
- Arquivos de produção usam nomes curtos por responsabilidade, sem versão no nome.
- A versão do produto vem de `package.json` e é sincronizada por `npm run version`.
- `assets/` é a fonte do frontend; `dist/` é gerado e nunca editado manualmente.
- Plano, permissão, owner, quota e autorização são decididos no backend; o frontend apenas apresenta o estado permitido.
- Projeto em nuvem guarda o estado necessário para reconstruir o trabalho do mapa. Documentos derivados são gerados sob demanda e não são arquivados automaticamente.

## Arquitetura

```text
Navegador / PWA
  ├─ surveyor-api        → identidade, planos, administração, dados e regras centrais
  ├─ surveyor-save       → salvamento dedicado de projetos
  ├─ surveyor-support    → suporte/e-mail
  └─ GeoServices         → proxy controlado para fontes geográficas oficiais
                              ↓
                    Appwrite Auth / Database / Storage
```

### Frontend

```text
assets/js/core/          autenticação, API, layout, documentos e serviços compartilhados
assets/js/admin/         painel administrativo
assets/js/features/      módulos de negócio
assets/css/core/         layout e estilos compartilhados
assets/css/features/     estilos por módulo
```

A Fase 2 separou algoritmos geométricos, coordenadas, exportação, cotas/vértices/confrontantes, acesso Appwrite, token, planos e regras comerciais em módulos próprios. Fluxos fortemente acoplados ao Leaflet/API principal só serão extraídos novamente quando estiverem cobertos pelos testes E2E, evitando refatoração cega em produção.

## Persistência e armazenamento

A nuvem do projeto guarda somente dados necessários para reabrir/reconstruir o trabalho técnico, como projeto, geometria, polígonos, glebas, vértices, confrontantes, estilos e metadados necessários.

Não são armazenados automaticamente como parte do projeto:

- PDF/DOCX de Memorial Descritivo;
- Mapas e Croquis gerados;
- Pranchas Técnicas;
- Cartas de confrontação;
- Planilhas e relatórios derivados;
- ZIP/KML/DXF/GeoJSON de exportação;
- previews temporários.

Esses artefatos são gerados sob demanda. Preferências locais podem usar `localStorage`; sessão e estados transitórios devem usar `sessionStorage`; dados oficiais de projeto não podem depender do navegador como fonte única.

## Planos comerciais oficiais

Novas contratações são exclusivamente anuais. Projetos são ilimitados; o limite prático é o armazenamento disponível.

| Plano | Incluído | Expansão máxima | Downloads/dia | Exportações/dia |
|---|---:|---:|---:|---:|
| Básico | 200 MB | 2 GB | 5 | 5 |
| Plus | 500 MB | 5 GB | 20 | 20 |
| Pro | 1 GB | 10 GB | Ilimitado | Ilimitado |

Armazenamento adicional: **R$ 15,00 por bloco de 500 MB**, respeitando o teto do plano.

## Desenvolvimento

Requer Node.js 22+.

```bash
npm run dev
npm test
npm run test:functions
npm run test:security
npm run build
npm run verify:dist
```

Antes de publicar uma versão candidata ou estável:

```bash
npm run verify
```

## Release

- `VERSION` contém a versão legível.
- `package.json` é a fonte de verdade da versão.
- `scripts/version.mjs` sincroniza Functions, manifesto, Service Worker e cache-busters dos assets.
- `scripts/build.mjs` recria `dist/surveyor-frontend` a partir da fonte limpa.

## Documentação

- `AGENTS.md` — regras obrigatórias para qualquer agente/desenvolvedor.
- `DEPLOY.md` — publicação e verificação.
- `SECURITY.md` — princípios e operação de segurança.
- `CHANGELOG.md` — evolução consolidada.
- `docs/history/README.md` — histórico completo anterior à linha 1.0.
- `docs/architecture/` — decisões atuais de arquitetura.

## Situação da 1.0

As Fases 1 e 2 estruturais foram concluídas na `1.0.0-rc.2`. A próxima etapa é exclusivamente validação pesada/E2E de login → projeto → desenho → edição → glebas → salvar → reabrir → gerar/exportar, seguida das correções necessárias para o selo `1.0.0 Stable`.
