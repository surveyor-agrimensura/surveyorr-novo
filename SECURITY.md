# Política de segurança

## Como reportar uma vulnerabilidade

Envie os detalhes para **suporte@surveyorr.com.br** com o assunto "Segurança". Não abra issue pública com detalhes exploráveis. Descreva o impacto, os passos para reproduzir e, se possível, a versão afetada. Responderemos para confirmar o recebimento e combinar a correção.

## Práticas adotadas

- **Segredos fora do Git.** `.env*` está no `.gitignore`; só os `*.example` são versionados. Chaves do Appwrite, `JWT_SECRET` e chaves de criptografia ficam nas variáveis de cada Function.
- **Dados criptografados** no backend (criptografia de aplicação com chave versionada e índice cego).
- **CORS restritivo** nas Functions e no Worker, com lista explícita de origens e fallbacks inseguros desligados por padrão.
- **Proxy geográfico com lista de hosts permitidos** e parâmetros internos filtrados.
- **PWA sem dados sensíveis em cache:** o Service Worker só guarda arquivos públicos versionados; projetos, autenticação e chamadas à API nunca entram no cache.
- **Cabeçalhos HTTP** em `public/_headers`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS e CSP em modo relatório (ver `docs/DEPLOY.md` para ativar o bloqueio).
- **CI reprodutível:** `npm ci` a partir do `package-lock.json`, typecheck e testes antes de qualquer publicação; Dependabot semanal para dependências.

## Pontos de atenção conhecidos

- O frontend usa `dangerouslySetInnerHTML` para exibir SVGs gerados internamente (croqui, prancha). Esses SVGs escapam textos de usuário (`esc()`), mas qualquer novo ponto que insira texto livre no SVG deve passar pelo mesmo escape.
- QR Codes são gerados por serviço externo (`api.qrserver.com`), que recebe o link público do projeto. Para evitar esse envio a terceiros, gere o QR localmente.
- A fonte Inter é carregada do Google Fonts. Para eliminar essa requisição externa, hospede a fonte localmente.
- O Nominatim público (OpenStreetMap) tem limite de 1 consulta por segundo; em produção com tráfego relevante, use geocodificação própria ou contratada.
