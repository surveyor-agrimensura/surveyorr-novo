# Publicação (deploy)

## Ordem obrigatória

1. **Verificar localmente:** `npm ci && npm run verify`. Se falhar, não publique.
2. **Backend primeiro, frontend depois** quando a mudança altera contratos de API (veja `docs/IMPLANTACAO_APPWRITE_CROQUIS.md` para o passo a passo da `surveyor-api`).
3. **Frontend:** `git push origin main`. A CI roda `typecheck` → `test:functions` → `check:release` (testes + build) e só então publica.
4. **Pós-publicação:** execute o checklist abaixo.

## Componentes e onde cada um é publicado

| Componente | Onde | Como |
| --- | --- | --- |
| Frontend (`dist/`) | GitHub Pages ou Cloudflare Pages (`surveyor-agrimensura`) | Automático ao dar push na `main` |
| `surveyor-api`, `surveyor-save`, `surveyor-support`, `surveyor-geoservices` | Appwrite Functions (projeto `surveyor-georural-pro`) | Upload manual `.tar.gz` ou integração Git no Console |
| Worker de geoserviços | Cloudflare Workers (`deploy/cloudflare-geoservices`) | `wrangler deploy`. **Subir o arquivo no Git não atualiza o Worker em produção** |

Domínio: `www.surveyorr.com.br` (arquivo `public/CNAME`). Não altere os registros DNS de API, loja, e-mail ou pagamentos.

## Variáveis de ambiente

**Frontend** (`.env.example`): apenas URLs públicas, prefixo `VITE_`.

**Functions:** cada uma tem seu `.env.example` em `functions/<nome>/`. Os valores reais são configurados **no Console do Appwrite**, nunca no Git. Regras importantes:

- `JWT_SECRET` precisa ser **idêntico** em `surveyor-api` e `surveyor-save`.
- `SURVEYOR_DATA_KEY_V1` (criptografia de dados) precisa ser a **mesma** em `surveyor-api` e `surveyor-save`, e **nunca** pode ser trocada sem migração, ou os dados salvos ficam ilegíveis.
- `EMAIL_FUNCTION_SECRET` igual em `surveyor-api` e `surveyor-support`.
- `GEOSERVICES_INTERNAL_TOKEN` igual em `surveyor-api` e `surveyor-geoservices`.
- Em produção mantenha `ALLOW_LOCAL_DEV_ORIGINS=false`, `ENABLE_LEGACY_CORS_ORIGINS=false`, `ENABLE_BOOTSTRAP_ROUTES=false` e `PAYMENT_ALLOW_SANDBOX=false`.
- `CORS_ORIGINS` deve listar exatamente as origens do frontend (inclua `https://surveyor-agrimensura.pages.dev` só se for usar o domínio de teste).

## Checklist pós-publicação

- [ ] `https://api.surveyorr.com.br/api/health` responde com a versão esperada.
- [ ] Login com conta de teste; criar, salvar, fechar e reabrir um projeto em **outro navegador**.
- [ ] Croqui com dados grandes (> 65.535 bytes) salva e relê com todas as propriedades.
- [ ] Memorial, Croqui e Prancha: gerar PDF/SVG e conferir nomes de vértices e confrontantes.
- [ ] Busca por CAR e por nome retorna a geometria correta (e não substitui por imóvel parecido).
- [ ] Console do navegador sem violações novas de CSP (veja abaixo).
- [ ] PWA instala e **não** guarda projetos, tokens ou chamadas à API em cache.

## Content-Security-Policy (CSP)

`public/_headers` envia a CSP em modo **somente relatório** (`Content-Security-Policy-Report-Only`), que **não bloqueia nada**. Para ativá-la com segurança:

1. Publique, abra todas as telas (mapa, croqui, memorial, prancha, impressão, assinatura) com o Console aberto.
2. Anote as violações e ajuste a política (por exemplo, novos hosts em `connect-src` ou `img-src`).
3. Quando não houver mais violações, renomeie o header para `Content-Security-Policy`.

## Reverter

- **Frontend:** reverta o commit (`git revert`) e dê push; a CI republica.
- **Function:** no Console → Functions → Deployments, ative o deployment anterior (guarde sempre o backup do deployment ativo antes de publicar).
