# Deploy

## 1. Verificar

```bash
npm ci
npm run verify
```

`npm run verify` executa segurança, integridade, sintaxe das Functions, testes estáveis, build e comparação fonte/dist.

## 2. Frontend — GitHub Pages

O deploy oficial está em `.github/workflows/pages.yml` e publica **somente**:

```text
dist/surveyor-frontend/
```

O workflow precisa destas permissões, mantidas explicitamente no YAML:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

A permissão `id-token: write` é obrigatória para `actions/deploy-pages@v5`. Sem ela o job encerra com `Failed to get ID Token`.

No GitHub, configure uma única vez em **Settings > Pages > Build and deployment > Source**:

```text
GitHub Actions
```

Depois disso, todo `push` na `main` dispara build e deploy. Também é possível executar manualmente por **Actions > Deploy SURVEYOR to GitHub Pages > Run workflow**.

O workflow executa **build → upload do artefato → deploy no mesmo job**. O artefato recebe um nome único por `run_id` + `run_attempt`, evitando que uma reexecução do job de deploy procure um `github-pages` que só existia em outra tentativa do workflow ou encontre artefatos duplicados de tentativas anteriores.

Nunca publicar a raiz do repositório no Pages e nunca editar `dist/` manualmente.

## 3. Functions

Quando houver mudança correspondente, publicar os diretórios configurados em `appwrite.config.json`:

```text
functions/surveyor-api
functions/surveyor-save
functions/surveyor-support
```

GeoServices segue o processo específico do Worker/Function configurado para produção.

## 4. Pós-deploy

Validar login, plano, criação/edição/salvamento de projeto, reabertura, geração de documento e consulta de propriedade. Conferir console e Network sem 401/403 inesperado.
