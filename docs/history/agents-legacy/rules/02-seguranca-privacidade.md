# Segurança e Privacidade por Padrão

- Validar entradas nas fronteiras de confiança.
- Autorização deve ser aplicada no lado confiável/servidor, não apenas na interface.
- Aplicar menor privilégio a filesystem, IPC, banco, cloud, APIs e tokens.
- Segredos ficam fora do código e de repositórios; logs devem mascará-los.
- Dados pessoais devem seguir minimização, finalidade, retenção e acesso necessários.
- Operações críticas devem considerar replay, concorrência, idempotência e auditoria.
- Integrações externas exigem timeout, tratamento de rate limit, autenticação e fallback.
- Dependências devem ser revisadas quanto a vulnerabilidade, manutenção e licença.
- Pentest só em escopo autorizado e seguro.
- Mudanças em autenticação, autorização, pagamento, upload, filesystem, IPC, criptografia ou dados sensíveis exigem revisão do Especialista em Segurança.
