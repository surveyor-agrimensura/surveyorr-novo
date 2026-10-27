# SURVEYOR 1.0.0-rc.5 — Recuperação funcional

Esta candidata corrige regressões observadas após a refatoração estrutural da linha 1.0.

## Documentos
- Pranchas Técnicas voltaram a carregar explicitamente os módulos de cotas, confrontantes e vértices antes do renderer compartilhado.
- `document-assets.js` centraliza atualização da personalização, incorporação da logomarca e criação do link/QR público.
- Memorial, Mapas/Croquis e Pranchas atualizam a personalização no momento da geração e incorporam imagens em Data URL para evitar referências quebradas no SVG/PDF.
- Perímetros e Planialtimetria usam a mesma origem de personalização/logomarca; Planialtimetria usa o link/QR público oficial quando o projeto possui ID.
- Preview de Mapas/Croquis e Pranchas possui timeout com fallback para o SVG técnico.
- O workspace documental encerra o overlay ao detectar uma mensagem de erro em vez de permanecer aparentando geração infinita.

## Limites de Propriedade
- Cor padrão do limite cadastral: amarelo forte `#FFD400`.
- Cor e espessura podem ser ajustadas no card da camada e são persistidas nas preferências do usuário.
- WMS de Limites de Propriedade mantém buffer maior e atualiza ao final do zoom para reduzir desaparecimento/flicker.
- Tiles com falha recebem tentativas controladas de redraw.
- Na Bahia o badge identifica `CEFIR/INEMA`; nas demais UFs, `CAR/SICAR`.

## Validação automatizada
`npm run verify` passa integralmente nesta versão, incluindo nova regressão para dependências documentais, QR/logomarca e Limites de Propriedade.

A aprovação final continua dependendo de reteste manual/web com projetos e contas reais de QA, especialmente geração de Memorial/Prancha e navegação/zoom de camadas oficiais.
