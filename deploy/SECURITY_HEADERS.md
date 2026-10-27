# Headers HTTP obrigatórios em produção

A CSP definida em `<meta>` não pode aplicar `frame-ancestors`. Configure estes headers no proxy/CDN que entrega `surveyorr.com.br` (por exemplo, Cloudflare Transform Rules/Worker ou outro host que permita headers):

```text
Content-Security-Policy: frame-ancestors 'self'; object-src 'none'; base-uri 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
```

Opcionalmente, para navegadores legados, mantenha também:

```text
X-Frame-Options: SAMEORIGIN
```

HSTS deve continuar habilitado no domínio HTTPS. Depois do deploy, valide os headers diretamente na resposta HTTP; não aceite a presença apenas no HTML como evidência.
