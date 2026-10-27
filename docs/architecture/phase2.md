# SURVEYOR 1.0 — Fase 2 concluída (estrutura)

A Fase 2 reorganiza a base sem alterar o contrato comercial ou transformar `dist/` em fonte de código. A validação funcional pesada/E2E é a etapa seguinte e é obrigatória antes do selo `1.0.0 Stable`.

## Frontend do mapa

O antigo runtime monolítico começou a ser dividido por responsabilidade real. A página do mapa carrega módulos independentes antes do coordenador `features/mapa/app.js`:

- `bootstrap.js` — identificação do build;
- `draw.js` — configuração do Leaflet Draw;
- `crs.js` — projeções e CRS;
- `import.js` / `shapefile.js` — importação;
- `gleba-geometry.js` — algoritmos de glebas;
- `geometry-math.js` — operações geométricas puras;
- `coordinates.js` — parsing/formatação DD, DMS, UTM e EPSG;
- `property-export.js` — pacote de download de imóvel;
- `history.js`, `snap.js`, `dossier.js`, `audit.js`, `save-status.js` — responsabilidades isoladas do workspace.

O coordenador principal ainda concentra fluxos de UI fortemente acoplados ao Leaflet. Eles não foram duplicados em arquivos `new/fix/hotfix`; a separação seguinte deve acontecer somente acompanhada pelos testes E2E da etapa de validação.

## Mapas e Croquis

O gerador foi separado em:

- `features/mapas/app.js` — composição e orquestração;
- `dimensions.js` — cotas;
- `vertices.js` — vértices;
- `confrontantes.js` — confrontantes.

Assim, as três áreas que mais sofreram correções durante a linha R26 não ficam mais misturadas no mesmo bloco.

## Backend

`surveyor-api/src/main.js` deixou de conter todas as regras auxiliares. Foram criados módulos internos:

```text
src/
  appwrite/client.js
  auth/tokens.js
  config/catalogs.js
  config/plans.js
  domain/commercial.js
  domain/permissions.js
  integrations/google-drive.js
  projects/model.js
  security/crypto.js
```

`appwrite/client.js` concentra acesso REST ao Appwrite (database/tables, storage, users e sessões). `main.js` permanece como roteador/controlador principal enquanto rotas altamente acopladas serão extraídas somente com cobertura E2E ativa.

## Administração

O fluxo de criação de usuários agora expõe a senha já na criação:

- administrador pode digitar a senha temporária;
- pode gerar uma senha criptograficamente aleatória;
- pode copiar a senha;
- criação exige no mínimo 12 caracteres;
- edição permite deixar o campo vazio para manter a senha atual.

O backend já exige a senha forte e grava a conta no Appwrite, marcando a credencial como temporária/recomendada para troca.

## Armazenamento do navegador

A regra final é:

- `localStorage`: preferências e caches descartáveis;
- `sessionStorage`: autenticação da aba, handoffs e rascunhos transitórios;
- Appwrite/backend: estado oficial do projeto e configurações oficiais.

Migrações desta fase:

- Loteamentos/REURB deixou de usar `localStorage` como banco e usa somente rascunho da sessão;
- Earth 3D limpa chaves legadas persistentes e usa handoff temporário;
- assinatura/imagem temporária administrativa usa sessão; dados oficiais são salvos em Personalização no backend;
- lixeira/versões/fila falsas locais foram removidas/substituídas pelos serviços oficiais;
- documentos gerados não são arquivados automaticamente no armazenamento do projeto.

## Nomenclatura

Arquivos de produção não carregam versão, data, `hotfix`, `repair`, `current` ou `final` no nome. Scripts Windows da raiz também seguem nomes curtos:

- `dev.bat`
- `test.bat`
- `deploy-geoservices.bat`

## Segurança HTTP

`frame-ancestors` foi removido de `<meta>` porque navegadores ignoram essa diretiva nesse formato. O header precisa ser aplicado na camada HTTP/CDN que entrega `surveyorr.com.br`. O repositório documenta essa exigência em `SECURITY.md`; ela será confirmada no checklist de deploy antes do Stable.

## Próxima etapa obrigatória

Não adicionar novas features antes da bateria de validação. A próxima etapa é exclusivamente teste e correção de regressões:

Admin/Básico/Plus/Pro → login → projeto → desenho → vértice → aresta → glebas → Undo/Redo → salvar → reabrir → documentos/exportações.
