# AGENTS.md — contrato de engenharia do SURVEYOR

Estas regras valem para Codex, ChatGPT e qualquer desenvolvedor que altere este repositório.

## Regra principal

Não empilhe remendos. Ao substituir uma implementação, remova/incorpore a anterior e mantenha uma única fonte de verdade.

## Estrutura e nomes

- Não criar arquivos com `hotfix`, `repair`, `current`, `final`, datas ou versão no nome.
- Nomear o arquivo pela responsabilidade: `login.js`, `layout.js`, `bootstrap.js`, `history.js`, `app.js`.
- Não editar `dist/` manualmente. Alterar a fonte e executar `npm run build`.
- Não duplicar lógica de plano/permissão em novos módulos sem motivo documentado.

## Segurança

- Nunca confiar no frontend para autorizar plano, quota, owner, role ou escrita.
- Nunca inserir segredo/API key em frontend, testes públicos ou documentação.
- JWT deve permanecer compacto; dados de perfil que podem ser consultados no backend não devem ser duplicados desnecessariamente no token.
- O salvamento dedicado deve preservar validação de sessão, owner, geometria e quotas.

## Dados

- Nuvem do projeto: guardar estado necessário para reconstruir o mapa/projeto.
- Não armazenar automaticamente documentos gerados (PDF, DOCX, croquis, pranchas, relatórios, ZIPs de exportação).
- `localStorage`: apenas preferências/cache descartável.
- `sessionStorage`: sessão e estado transitório.
- Dados oficiais não podem existir somente no armazenamento do navegador.

## Comercial

- Novas contratações: anual.
- Projetos: ilimitados, limitados pelo armazenamento.
- Básico: 200 MB incluídos, até 2 GB; 5 downloads e 5 exportações/dia.
- Plus: 500 MB incluídos, até 5 GB; 20 downloads e 20 exportações/dia.
- Pro: 1 GB incluído, até 10 GB; downloads/exportações ilimitados; Personalização habilitada.
- Expansão: R$ 15,00 por 500 MB.

## Processo obrigatório

1. Entender o fluxo afetado e procurar implementação existente.
2. Fazer a menor mudança estrutural correta, removendo a versão antiga quando substituída.
3. Atualizar/criar teste que valide comportamento, não número de versão histórico.
4. Executar `npm run verify` quando a mudança afetar release.
5. Conferir que fonte e `dist` são idênticos após o build.
6. Registrar alteração em `CHANGELOG.md` quando for relevante à release.

## Estado da 1.0

A estrutura da Fase 2 foi consolidada na `1.0.0-rc.2`. Até o selo Stable, não introduzir nova feature sem necessidade de correção. Prioridade absoluta: testes E2E de mapa/desenho/edição/glebas/Undo-Redo/salvamento, planos e administração; qualquer regressão deve ser corrigida na implementação definitiva, sem arquivos paralelos de hotfix.
