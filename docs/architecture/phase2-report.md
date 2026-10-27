# Relatório de consolidação — 1.0.0-rc.2

## Resultado estrutural

- arquivos JS/CSS de produção com versão/hotfix/repair/current no nome: **0**;
- módulos JS de `features/mapa`: **21**;
- módulos JS de `features/mapas`: **4**;
- módulos JS internos da `surveyor-api`: **11**;
- `assets/js/features/mapa/app.js`: aproximadamente **745 KB** após extrações de geometria, coordenadas, exportação e desenho;
- `functions/surveyor-api/src/main.js`: aproximadamente **544 KB** após extrações de token, configuração, regras comerciais, permissões, projeto, Google Drive e cliente Appwrite;
- `dist/` continua sendo gerado exclusivamente da fonte e validado por hash.

## Cadastro administrativo

A criação de usuário deixou de esconder a senha. O fluxo oficial agora é:

1. informar nome/e-mail/telefone;
2. digitar uma senha temporária ou clicar em **Gerar senha**;
3. a senha deve ter no mínimo 12 caracteres;
4. o administrador pode copiar a senha;
5. o backend cria/atualiza a credencial no Appwrite e marca recomendação de troca;
6. editar uma conta existente com o campo vazio preserva a senha atual.

A senha nunca é inserida no PDF/comprovante comercial.

## Estado para validação

A RC2 está estruturalmente preparada. A próxima etapa não é nova refatoração: é executar os testes funcionais/E2E e corrigir qualquer regressão encontrada até obter o selo `1.0.0 Stable`.
