# Contribuindo com o SURVEYOR

## Preparar o ambiente

```bash
nvm use            # Node 22 (.nvmrc)
npm ci
npm run dev
```

## Fluxo de trabalho

1. Crie uma branch a partir da `main` (`feat/...`, `fix/...`, `docs/...`).
2. Faça mudanças pequenas e focadas. Um assunto por PR.
3. Rode `npm run verify` antes de abrir o PR. A CI roda o mesmo comando.
4. Abra o PR para a `main`. Só é mesclado com a CI verde.
5. Registre mudanças visíveis ao usuário em `CHANGELOG.md`.

## Padrões

- **TypeScript estrito** (`strict`, `noUnusedLocals`, `noUnusedParameters`). O build falha com variável ou import sem uso. Remova em vez de silenciar.
- **Sem `any`, `@ts-ignore` ou `console.log`** no código do frontend (hoje o projeto tem zero ocorrências; mantenha assim).
- Estilo: `.editorconfig` e `.prettierrc.json` definem indentação (2 espaços), aspas simples e largura de linha de 120.
- Textos da interface em **português do Brasil**.
- **Geometria e dados do usuário nunca mudam em silêncio.** Operações que alteram vértices, áreas ou confrontantes exigem confirmação explícita e precisam de teste.
- **Nunca marque algo como "salvo na nuvem" sem releitura de confirmação.** Se a API falhar, preserve o rascunho local e mostre o erro.
- **Segredos:** nunca versione chaves, tokens ou `.env`. Veja `SECURITY.md`.
- Novas rotas devem usar `React.lazy` para não aumentar o bundle inicial.
- Novos hosts externos precisam ser incluídos em `public/_headers` (CSP) e, se forem serviços WFS, na lista do Worker de geoserviços.

## Testes

- Testes unitários: `src/**/*.test.ts` (Vitest). Rodam com `npm test`.
- Testes de regressão: `tests/*.cjs` e `tests/*.mjs` (Node). Rodam com `npm run check:release`.
- Ao corrigir um bug, adicione um teste que falhava antes da correção.

## Checklist de PR

- [ ] `npm run verify` passou localmente
- [ ] Sem segredos ou dados reais de clientes no diff
- [ ] Mudança de backend? Indique a ordem de publicação (Function antes do frontend)
- [ ] `CHANGELOG.md` atualizado
- [ ] Teste manual descrito (telas e fluxos conferidos)
