# Dados, Migrações e Recuperação

- Nunca apague/recrie banco para resolver migração de cliente existente.
- Toda mudança de schema deve avaliar compatibilidade, constraints, índices, transações e rollback/recuperação.
- Antes de operação destrutiva, deve existir cópia/verificação proporcional ao risco.
- Backups só são considerados válidos quando restauração foi testada.
- Atualizações devem preservar IDs, relações, configurações e arquivos do usuário.
- Importações devem relatar registros inválidos; não descartar silenciosamente.
- Migrações longas devem considerar retomada, atomicidade e falha parcial.
- Dados reais não devem ser copiados para teste sem necessidade e proteção.
