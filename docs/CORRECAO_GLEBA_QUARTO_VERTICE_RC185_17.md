# Correção do vértice final da gleba manual | RC185.17

## Falha reproduzida

Na RC185.16, o último ponto iniciado pelo primeiro clique de um duplo clique permanecia na espera de 190 ms. O evento `dblclick` cancelava o timer e fechava a área com o penúltimo vértice. Exemplo: três vértices regulares e quarto marcado por duplo clique produziam triângulo em vez de quadrilátero.

## Correção

`assets/js/features/mapa/app.js`, em `startManualGlebaDrawing()`:

- mantém referência ao clique pendente;
- confirma o vértice final antes de fechar a gleba;
- não duplica um vértice já marcado quando o usuário dá duplo clique sobre ele;
- se o vértice final estiver fora da área-base, não conclui indevidamente o desenho com vértices anteriores;
- não altera a operação de recorte, a divisão de áreas ou o botão de finalização.

## Verificação

O teste de regressão `tests/stable/gleba-manual-dblclick-last-vertex-rc18517.test.mjs` executa os handlers reais de `click` e `dblclick` e simula: (1) quarto vértice marcado com dois cliques; (2) fechamento sobre último vértice existente; (3) fechamento sobre o primeiro vértice; (4) recusa de ponto terminal inválido.

Ainda é necessária validação visual do fluxo completo no navegador com geometrias de projeto reais.
