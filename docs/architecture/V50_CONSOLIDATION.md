# V50 — Consolidação técnica

A V50 consolida as etapas que seriam separadas em V50/V51/V52, mantendo a release interna `1.0.0-rc.10`.

## Objetivos

- reduzir duplicação real de runtime sem retirar funcionalidades;
- reduzir cascata CSS redundante preservando a ordem efetiva;
- iniciar a decomposição segura do runtime do mapa;
- manter `dist/` como artefato gerado;
- proteger a limpeza com testes de regressão.

## Mudanças estruturais

1. `core/ui.js`: segunda cópia do runtime moderno removida.
2. `core/ui.css` e `features/mapa/app.css`: regras idênticas e declarações do mesmo seletor/propriedade comprovadamente sobrescritas foram eliminadas.
3. `features/mapa/city-search.js`: novo módulo responsável pelo cache municipal, normalização, ranking, fallback e hidratação IBGE.
4. `mapa/index.html`: o módulo municipal é carregado antes de `app.js`.
5. `tests/stable/technical-consolidation-v50.test.mjs`: limites de regressão para duplicação e cascata.

## Regra de segurança da refatoração

Nenhuma função de produto foi removida. A limpeza só elimina código duplicado/redundante ou move uma responsabilidade para um módulo com o mesmo contrato.
