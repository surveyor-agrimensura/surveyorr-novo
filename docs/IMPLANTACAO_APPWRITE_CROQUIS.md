# SURVEYOR | Implantação manual da API de sincronização de croquis

Data: 30/10/2026. Revisão de código: `1.0.0-rc.185.75-appwrite-sync`.

## 1. Qual Function atualizar

- **Function existente:** `surveyor-api` (não criar outra).
- **Runtime:** `Node.js 22` (`node-22`).
- **Entrypoint:** `src/main.js`.
- **Comando de build:** `npm install --omit=dev` (ou `npm ci --omit=dev`).
- **Root directory:** raiz do arquivo TAR; nela estão `src/`, `assets/`, `package.json` e `package-lock.json`.
- **Tempo máximo existente:** 120 segundos. Mantenha os demais campos e permissões já configurados.
- **Arquivo pronto:** `SURVEYOR_API_APPWRITE_DEPLOY_2026-10-30.tar.gz`.

A atualização é necessária para que o endpoint `/api/customization/document` utilize a serialização nova. A Function `surveyor-save` salva **geometrias/projetos**, não as opções do Croqui, e **não precisa** ser atualizada especificamente para este erro.

## 2. Publicar pelo Appwrite Console

1. **Guarde um backup do deployment ativo** e das configurações do Appwrite. Não apague registros nem altere a chave de criptografia já usada.
2. Appwrite Console → projeto `surveyor-georural-pro` → **Functions** → Function existente **`surveyor-api`**.
3. Abra **Deployments** → **Create deployment** → **Manual**.
4. Em **Entrypoint**, informe `src/main.js`. No build, configure `npm install --omit=dev` (verifique em **Settings → Configuration → Build settings**). Runtime da Function: `node-22`.
5. Envie o arquivo `.tar.gz` entregue, sem descompactar. Marque **Activate deployment after build**. Se preferir testar primeiro, deixe desmarcado e ative após a validação em ambiente de teste.
6. Execute a criação; confirme que o **build terminou com sucesso** e que o novo deployment ficou ativo. Confira os logs, caso falhe.
7. Abra `https://api.surveyorr.com.br/api/health` no navegador. O JSON da API nova deve incluir `"customizationStorage":"storage-v2"` e a versão `1.0.0-rc.185.75-appwrite-sync`. Caso apareça outra versão, pode haver um deployment antigo ativo ou o DNS/proxy apontar para outro backend. O endpoint de Function, se houver, também pode ser usado para comparação.

Documentação oficial de upload: https://appwrite.io/docs/products/functions/deploy-manually

## 3. Variáveis de ambiente

**Preserve as variáveis já configuradas na Function**, particularmente as de autenticação, autorização, criptografia e integrações. Os valores abaixo são **nomes**, não credenciais. Não cole segredos no frontend ou no pacote.

Essenciais para esta correção:

| Nome | Uso |
| --- | --- |
| `APPWRITE_ENDPOINT` | Endpoint Appwrite, exemplo `https://nyc.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | ID do projeto |
| `APPWRITE_DATABASE_ID` | ID do banco, no projeto `surveyor_db` |
| `APPWRITE_API_KEY` ou `APPWRITE_FUNCTION_API_KEY` | Chave privada da Function com permissões já existentes |
| `APPWRITE_COLLECTION_CUSTOMIZATION` | `customization` |
| `APPWRITE_BUCKET_USER_ASSETS` | `user_assets` |
| `SURVEYOR_CRYPTO_ACTIVE_KEY` | Versão da chave, geralmente `v1` |
| `SURVEYOR_DATA_KEY_V1` | **Mesma chave já utilizada pelo sistema**; indispensável para cifrar/decifrar arquivos grandes |
| `JWT_SECRET` | Mesmo segredo já empregado para autenticar o usuário |
| `CORS_ORIGINS` | Domínios autorizados, incluindo o site de produção e a origem de teste, se aplicável |

Para projetos que já possuem dados cifrados, **não gire nem substitua `SURVEYOR_DATA_KEY_V1` sem planejamento de migração e manutenção das chaves antigas**. O novo código lê o JSON inline legado e o ponteiro cifrado para o Storage. Se a chave estiver ausente, a gravação grande falha com segurança, sem gravar plaintext silenciosamente.

**Permissões:** a chave da Function deve conservar os scopes necessários para ler/gravar documentos da coleção `customization` e ler/criar/apagar arquivos no bucket `user_assets`, além dos demais scopes que a API já usa. Verifique `documents.read`, `documents.write`, `files.read`, `files.write` conforme os serviços disponíveis no seu projeto; não reduza os scopes existentes sem auditoria. O bucket deve estar habilitado e permitir `.json` (ou sem restrição de extensões), com tamanho máximo suficiente para as configurações, fotos e assinaturas. A Function usa chave de servidor; **não torne esse bucket público para contornar permissões**.

## 4. Banco de dados e Storage

- Banco: `surveyor_db`.
- Coleção/Tabela: `customization`.
- Campo: `options` precisa ser **String, máximo 65535** (Appwrite reporta esse limite). `userId` deve permanecer disponível.
- Storage: bucket `user_assets`, já referenciado pelo código existente.
- **Não mudar `options` para objeto JSON, não remover o atributo, não zerar dados e não criar coleção paralela**. Se o campo não for String, ajuste-o cuidadosamente com backup e conferência de compatibilidade.
- Quando `JSON.stringify(options)` cabe em **até 60000 bytes UTF-8**, é guardado no próprio campo. Acima disso, o JSON completo é criptografado no Storage e o campo recebe uma string JSON pequena com a referência ao arquivo e o SHA-256. A API verifica a integridade na leitura. Isso preserva croquis anteriores.

O diagnóstico de esquema está incluído no ZIP completo em `scripts/check-appwrite-customization-schema.mjs`. Ele é apenas leitura e requer `APPWRITE_API_KEY` e demais identificadores em variáveis de ambiente **no terminal local**. Não o execute com a chave exibida em prints, logs públicos ou repositórios.

## 5. Testar a sincronização real (obrigatório)

1. No navegador, faça login e abra um projeto que tenha um Croqui com cores, deslocamentos, rótulos, vértices e uma foto ou assinatura, se utilizada.
2. Altere a cor de um texto, mova um rótulo, ajuste uma servidão e clique **Salvar alterações**.
3. Confirme que a mensagem diz **Croqui confirmado na nuvem**. Uma mensagem apenas de rascunho local **não é confirmação**.
4. Recarregue a página, feche e reabra o projeto. Compare as propriedades editadas.
5. Repita em uma janela anônima ou outro navegador, na mesma conta (com autorização), para excluir a possibilidade de leitura do cache local.
6. Faça o mesmo com um croqui grande, com opções acima de 65535 bytes. Confira foto, SVG, textos, cores, offsets, rotação, servidões e documentos exportados.
7. Confira os logs da Function e a criação de um arquivo no bucket `user_assets`. O registro `customization.options` deve continuar sendo uma **string curta** no caso do croqui grande.
8. Se falhar, **não limpe cache nem rascunhos locais**: preserve-os, capture o request ID mostrado pelo servidor e o log sem credenciais. Reative o deployment anterior apenas após avaliar se a versão anterior sabe ler os ponteiros novos.

## 6. Limites da validação neste pacote

Testados localmente: código JavaScript, fluxos simulados REST Appwrite de banco e Storage, criptografia AES-GCM real, leitura de JSON inline legado, persistência/releitura de documentos com aproximadamente 195 KB, integridade SHA-256, proteção contra tipos errados e payloads maiores que o limite. Os testes locais não substituem a confirmação de uma gravação na conta Appwrite real. O endpoint público de saúde da produção não pôde ser consultado por este ambiente, logo não há confirmação do deployment em uso.

## 7. Entregáveis

- `SURVEYOR_API_APPWRITE_DEPLOY_2026-10-30.tar.gz` : **somente a Function `surveyor-api`**, pronta para upload manual.
- `SURVEYOR_COMPLETO_APPWRITE_SYNC_2026-10-30.zip` : frontend e backend com a mesma revisão, testes, utilitário de esquema e este guia.
- `RELATORIO_APPWRITE_SURVEYOR_2026-10-30.md` : registro das modificações e testes.
