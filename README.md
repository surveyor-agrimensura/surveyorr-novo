# SURVEYOR

Plataforma web de **agrimensura e georreferenciamento**: mapa operacional, croquis, memorial descritivo, pranchas técnicas, análise espacial e gestão de projetos, com backend serverless no Appwrite.

- Site: <https://www.surveyorr.com.br>
- Versão do frontend: ver `package.json`
- Requisitos: **Node.js 22+** (`.nvmrc`) e npm

> **Aviso técnico.** Azimutes, rumos, áreas e distâncias calculados no navegador são aproximados (WGS84) e não substituem levantamento topográfico, planilha normativa ou conferência do responsável técnico. A pré-conferência SIGEF **não** é o modelo oficial do INCRA.

## Início rápido

```bash
npm ci               # instala exatamente o que está no package-lock.json
npm run dev          # http://localhost:5500/login/
```

No Windows, também é possível dar dois cliques em `INICIAR_SURVEYOR.bat`.

Copie `.env.example` para `.env.local` apenas se quiser apontar para outros endpoints. Ele contém somente URLs públicas; **segredos ficam nas variáveis de cada Function no Appwrite**, nunca no frontend.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (porta 5500) |
| `npm run typecheck` | Verificação de tipos TypeScript (`tsc -b`) |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:functions` | Verifica a sintaxe das 4 Appwrite Functions |
| `npm run check:release` | Bateria completa de testes de regressão + build de produção |
| `npm run verify` | `test:functions` + `check:release` (o mesmo que a CI executa) |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm run preview` | Serve o build local (porta 5501) |

**Regra de ouro:** não publique se `npm run verify` falhar.

## Arquitetura

```
Navegador (React 19 + TypeScript + Vite)
   │  Cloudflare Pages / GitHub Pages  → www.surveyorr.com.br
   │
   ├── api.surveyorr.com.br ........ Appwrite Function  surveyor-api       (leitura, autenticação, personalização, planos)
   ├── *.appwrite.run .............. Appwrite Function  surveyor-save      (gravação de projetos e geometrias)
   ├── *.appwrite.run .............. Appwrite Function  surveyor-support   (e-mails e suporte)
   └── *.workers.dev ............... Cloudflare Worker  geoservices        (proxy de WFS: SICAR/CAR, CEFIR/INEMA, INCRA)
```

| Pasta | Conteúdo |
| --- | --- |
| `src/app` | Rotas e carregamento sob demanda (`React.lazy`) |
| `src/features/map` | Mapa operacional (Leaflet), busca por CAR/nome, importação e edição de geometrias |
| `src/features/croqui` | Editor de croqui (Konva), numeração de vértices, confrontantes |
| `src/features/memorial` | Memorial descritivo e renderização do croqui em SVG |
| `src/features/documents` | Pranchas técnicas, planilhas, assinatura digital, relatório ambiental |
| `src/features/generations` | Gerações: MDT, REURB, divisão de glebas, centro de lotes, azimutes |
| `src/features/analysis` | Verificação topológica e comparação espacial de polígonos |
| `src/features/auth`, `admin`, `customization`, `projects` | Conta, painel administrativo, personalização e projetos |
| `src/lib` | Utilitários compartilhados (documentos, zoom, automação cartográfica) |
| `functions/` | Código das Appwrite Functions (`surveyor-api`, `-save`, `-support`, `-geoservices`) |
| `deploy/cloudflare-geoservices` | Worker de proxy geográfico (publicado à parte) |
| `public/` | PWA, ícones, logos oficiais, miniaturas de mapas, `_headers` |
| `tests/` | Testes de regressão (Node) e unitários (Vitest) |
| `docs/` | Documentação operacional e histórico de etapas |

## Publicação

1. `npm ci && npm run verify`
2. Se a mudança envolve backend, publique **primeiro** a Function (ver [`docs/DEPLOY.md`](docs/DEPLOY.md)), depois o frontend.
3. `git push origin main`: a CI (`.github/workflows/pages.yml`) roda typecheck, testes e build; somente se tudo passar, o site é publicado.

Detalhes, variáveis de ambiente e checklist pós-publicação: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Segurança

Resumo das práticas e como reportar vulnerabilidades: [`SECURITY.md`](SECURITY.md). Os cabeçalhos HTTP do site estão em `public/_headers`.

## Contribuindo

Fluxo de trabalho, padrões de código e checklist de PR: [`CONTRIBUTING.md`](CONTRIBUTING.md). Alterações relevantes ficam registradas em [`CHANGELOG.md`](CHANGELOG.md).

## Documentação adicional

- [`docs/DEPLOY.md`](docs/DEPLOY.md): publicação, variáveis e checklist
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md): decisões técnicas e pontos de atenção
- [`docs/IMPLANTACAO_APPWRITE_CROQUIS.md`](docs/IMPLANTACAO_APPWRITE_CROQUIS.md): atualização manual da `surveyor-api`
- [`docs/HISTORICO_DE_ETAPAS.md`](docs/HISTORICO_DE_ETAPAS.md): roteiros de teste e notas de cada etapa (README anterior)
- [`docs/relatorios/`](docs/relatorios): relatórios de auditoria e otimização
