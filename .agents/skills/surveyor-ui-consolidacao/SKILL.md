---
name: surveyor-ui-consolidacao
description: Inventaria botões e menus do SURVEYOR, decide o que consertar, remover, unificar ou reposicionar e valida equivalência funcional e acessibilidade.
---
# SURVEYOR UI CONSOLIDAÇÃO

## Quando usar
Menus inchados, funções duplicadas, opções que nada fazem, descrições excessivas, controles com contexto inadequado ou organização divergente entre mapa/croqui/prancha.

## Método por controle
1. Registrar tela, seletor, rótulo, estado, handler/ação, dependências e uso pelo usuário.
2. Classificar: útil e funciona; útil com bug; redundante; incompleto; sem utilidade comprovada; não validado.
3. Antes de excluir, localizar referências no código e funcionalidades equivalentes em outros módulos. Se houver alguma capacidade exclusiva, consolidá-la em vez de descartá-la.
4. Decidir: manter, corrigir, mover, agrupar, substituir por ferramenta contextual ou remover. Justificar em uma linha.
5. Implementar sem redesenhar home antiga/barra superior e sem eliminar avisos importantes para segurança, operação, persistência ou limites técnicos.
6. Testar teclado, foco, toque, responsividade, texto curto, ação funcional, mensagens e acessibilidade básica. Conferir fluxos de Croqui/Prancha.
7. Registrar tabela de mapeamento 'controle anterior => novo local/ação' e testes de paridade.

## Critério de nova função
Só incluir se resolver um problema de uso profissional real, com entradas/saídas claras, valor superior ao custo de manutenção e um fluxo testável. Preferir usar as ferramentas já existentes quando atendem à necessidade.

## Resultado obrigatório
Inventário, planilha de decisão, comparação antes/depois, evidência de que função relevante não desapareceu e itens não verificados.
