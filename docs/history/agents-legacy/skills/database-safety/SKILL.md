---
name: database-safety
description: "Planeja alterações de banco e migrações sem perda de dados, com compatibilidade e rollback."
---

# Database Safety

# Database safety
Avalie schema atual, volume, constraints, índices, locks e versões. Migração deve ser testável, observável e recuperável. Preserve IDs/relacionamentos. Teste upgrade com snapshot realista e restauração.


## Evidência
Nunca registre etapa como concluída sem evidência observável. Declare explicitamente itens não executados ou não verificáveis.
