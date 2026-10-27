# Relatório da Fase 1 — SURVEYOR 1.0.0

## Resultado

A R26.3.73 foi congelada como última base histórica. A base refatorada passou a `1.0.0-rc.1`, candidata interna à `1.0.0 Stable`.

## Limpeza concluída

- Arquivos JS/CSS de produção: **104**.
- Arquivos de produção com `vXX`, `RXX`, `hotfix`, `repair` ou `current` no nome: **0**.
- HTMLs de aplicação verificados: **32**.
- Cache-busters locais fora da versão central: **0**.
- Testes históricos preservados: **227**.
- Grupos de testes estáveis novos: **7**.
- Fonte e `dist` são comparados por hash após o build.
- `frame-ancestors` foi removido dos meta CSP porque navegadores ignoram essa diretiva em meta; aplicação por header HTTP fica para a infraestrutura da Fase 2.

## Decisões

- `package.json` é a fonte de verdade da versão.
- `assets/` é a fonte do frontend.
- `dist/` é somente build gerado.
- Documentação R19–R26.3 foi consolidada em `docs/history/README.md`.
- Handoff Mapa → Earth 3D migrou de `localStorage` para `sessionStorage`.
- Manifesto comercial foi alinhado às regras oficiais atuais.

## Deliberadamente deixado para a Fase 2

- Modularizar `assets/js/features/mapa/app.js` (~812 KiB).
- Modularizar `functions/surveyor-api/src/main.js` (11881 linhas).
- Migrar projeto local de Loteamentos/REURB e revisar lixeira/versões/fila locais.
- E2E completo em navegador para Admin/Básico/Plus/Pro.
- Aplicar CSP `frame-ancestors` via header HTTP.
- Remover pontes de compatibilidade somente após prova E2E de que não há consumidor.
