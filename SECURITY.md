# Segurança

## Princípios

- Backend é autoridade de autenticação, plano, permissão, owner e quota.
- Segredos nunca pertencem ao frontend.
- Tokens de acesso são temporários e compactos; refresh/logout devem preservar rotação e revogação existentes.
- Escritas de projeto devem validar owner, sessão, geometria e limites no servidor.
- Dados sensíveis em logs devem permanecer redigidos.

## Verificação local

```bash
npm run test:security
npm run test:functions
npm run test:integrity
```

## CSP

`frame-ancestors` não produz efeito quando enviado por `<meta>`. A proteção contra framing deve ser aplicada como header HTTP na camada de hospedagem/proxy. Enquanto a hospedagem estática não oferecer esse header diretamente, o meta CSP continua protegendo as demais diretivas suportadas, mas não deve ser tratado como proteção de `frame-ancestors`.

## Reporte

Use o contato publicado em `/.well-known/security.txt`.
