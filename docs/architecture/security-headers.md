# Headers de segurança do frontend

A diretiva CSP `frame-ancestors` não funciona em `<meta http-equiv>`. Ela deve ser enviada como header HTTP.

Antes de promover `1.0.0` para Stable, confirmar na resposta de `https://surveyorr.com.br/` e das páginas protegidas pelo menos:

```text
Content-Security-Policy: ...; frame-ancestors 'self';
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Como o frontend pode ser publicado via GitHub Pages atrás de domínio/CDN, configure o header na camada que realmente responde pelo domínio (por exemplo, regra/Worker Cloudflare). Não mantenha uma diretiva ineficaz em `<meta>` apenas para silenciar a auditoria.
