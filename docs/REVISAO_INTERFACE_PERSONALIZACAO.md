# Revisão da interface de edição e personalização

**Base:** RC185.19. **Entrega:** RC185.20. **Natureza:** correções direcionadas na implementação de apresentação e acessibilidade.

## Problemas concretos detectados no código

1. **Regra responsiva anulada:** o editor integrado tinha `@media(max-width:900px)` definindo uma coluna, mas a folha declarava uma nova regra de duas colunas depois desse `@media` com a mesma especificidade. Resultado CSS: a regra posterior podia vencer e manter duas colunas em janela estreita.
2. **Rótulos de ferramentas não eram elementos reais:** no modo integrado, `font-size:0`, ícone oculto e `::after {content:attr(title)}` tornavam os rótulos dependentes de texto gerado por CSS, inclusive a 7,4 px em uma faixa de tela.
3. **Controles operacionais de 8–9 px:** tamanho pouco legível em campos, rótulos, botões e algumas opções de confrontantes no editor integrado e no projeto vivo. Isso não altera a tipografia da prancha exportada.

## Alterações

- O `assets/js/core/technical-document-editor.js` monta um `<span class="sv-editor-tool-caption">` para cada ferramenta do modo integrado depois de criar as ferramentas dinâmicas, preservando os títulos e `aria-label` existentes.
- Em `assets/css/core/documents.css`, os textos dos botões agora são conteúdo normal do DOM, com fonte legível, quebra em duas linhas quando necessário e foco de teclado visível.
- Na personalização, os campos, rótulos e botões do painel foram ampliados de forma localizada para 10–11 px. Os dados técnicos e os documentos finais não tiveram fontes modificadas.
- A regra responsiva de uma coluna para largura até 900 px foi colocada após a definição canônica desktop e acompanhada de ajustes locais do painel, prévia e rodapé.
- Criado o teste `tests/stable/document-inline-responsive-accessible.test.mjs` que primeiro falhou na base e passou depois da alteração.

## Validação executada

- `npm run verify` concluído com exit code 0, incluindo `npm run test:css`, `npm test`, build e `verify:dist`.
- **173 grupos de testes estáveis aprovados**; `dist` sincronizado e fonte sem novos `!important`.
- Teste CSS/JS estático: ele confere contrato de rótulos e precedência do estilo, não comprova renderização de pixels.

## Limites e homologação

- Não foi possível validar fluxos autenticados nem gerar capturas reproduzíveis da personalização real em navegador. Homologação visual recomendada em 1920×1080, 1366×768, 1024×768 e 768×1024.
- Não foram alterados serviços externos WFS, cache CAR, geometrias, modelos de memorial, geração de PDFs, mapa ou regras comerciais.
- A inspeção de CSS duplicado ainda exige revisão visual por módulo; não se eliminaram regras automaticamente por serem repetidas.

## Casos sugeridos para homologação

- Pranchas técnicas e Mapas/Croquis: alternar de Projeto para Personalização, conferir rótulos, formulários, prévia, scroll e rodapé.
- Memorial, Planialtimetria e Loteamentos: conferir possíveis efeitos de CSS compartilhado e que os documentos permaneçam com as fontes e estrutura aprovadas.
- Em 768–900 px, verificar que o painel fica acima da prévia, com zoom e rodapé acessíveis.

## Complemento da RC185.21

- Novo achado confirmado pela comparação de especificidade: a regra desktop da bancada compacta `.sv-doc-workspace:not(.sv-beta-personalization-active)` tinha especificidade maior que o seletor da regra para larguras até 900 px. O `@media` ficava escrito depois, mas não conseguia prevalecer. Alinhados os seletores para manter a coluna única e a ordem Configuração → Prévia → Rodapé.
- Os tamanhos operacionais de 8,5–9 px restantes no formulário e na navegação do modelo compacto passaram a 11 px. O ajuste também contempla os botões de rascunho e o menu de download da Prancha.
- Adicionado `tests/stable/document-compact-breakpoint-legibility.test.mjs`; ele falhou inicialmente com a base RC185.20 e passou após os ajustes. Trata-se de verificação estática da cascata, não de comprovação por captura ou interação autenticada.
- Continua pendente a homologação visual em Chrome real para todos os formatos, além da avaliação manual de regras duplicadas que dependem de media queries, estados e contexto. Não foram removidas regras do CSS por repetição de seletor isolada.

### Adendo Memorial na RC185.21

A personalização integrada do Memorial usava um `grid-template-columns` de duas colunas sem um `@media` equivalente; a media query do modal legado se aplicava somente à janela **não integrada**. Agora o modo integrado empilha ferramentas e prévia até 900 px, limita a altura do painel de ferramentas, preserva o scroll da prévia e dispõe as ações/zoom em linhas próprias em telas menores. As abas e os campos de edição passam a 11 px. Teste: `tests/stable/memorial-inline-mobile-layout.test.mjs`, também falhou antes e passou após o ajuste. Ainda depende de conferência visual autenticada no navegador.
