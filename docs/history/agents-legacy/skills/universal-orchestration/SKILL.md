---
name: universal-orchestration
description: "Orquestra tarefas de engenharia multiagente, seleciona especialistas, gates e rework. Use para qualquer tarefa que envolva mudança ou auditoria de software."
---

# Universal Orchestration

# Objetivo
Converter uma solicitação em execução multiagente controlada.

## Classificação
1. Tipo: bug, feature, refactor, migration, incident, audit, release.
2. Risco: low/medium/high/critical.
3. Superfícies: UI, backend, data, auth, filesystem, external API, infra, build etc.
4. Participação: marque agentes relevantes ACTIVE e demais críticos N/A com motivo.

## Gates
Nunca pule critérios de aceite, implementação, revisão independente, testes proporcionais, segurança proporcional, relatório e release. Se REJECT, volte à etapa apropriada e reteste.


## Evidência
Nunca registre etapa como concluída sem evidência observável. Declare explicitamente itens não executados ou não verificáveis.
