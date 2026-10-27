# Análise da demora ao localizar imóvel: RC185.9

Fonte: vídeo de 39,27 segundos enviado pelo usuário. Foram observadas três trocas consecutivas de imóveis na pesquisa por Sítio em Amargosa.

## Linha do tempo visível

- 9,97 a 10,23s: fundo cinza enquanto se muda o enquadramento para outro imóvel (aproximadamente 0,27s).
- 21,70 a 22,77s: fundo cinza mais prolongado, aproximadamente 1,07s.
- 37,50 a 37,77s: fundo cinza, aproximadamente 0,27s.

Esses intervalos indicam espera pelas imagens de satélite (tiles) depois da mudança do mapa. Não comprovam duração da consulta WFS antes da mudança de enquadramento.

## Correção aplicada

1. Pré-carregar sob demanda ao passar o cursor sobre um resultado por ao menos 250ms. Restrição de quatro tentativas por lista, uma de cada vez.
2. Reutilizar a requisição pendente no clique em vez de repetir o WFS.
3. Informar imediatamente o estado Localizando… e restaurar o botão mesmo se houver falha.
4. Eliminar a animação dos saltos de posição distantes, mantendo o mesmo polígono e validação pelo CAR.

## Testes

- `node tests/stable/property-navigation-video-rc1859.test.mjs` cobre a deduplicação e regressões estruturais da navegação.
- `npm run verify` passou com 161 grupos, build e source/dist sincronizados.

## Como conferir

Abra Mapa > IMÓVEL, pesquise Sítio em Amargosa, mantenha o ponteiro sobre um resultado por um segundo e clique em Localizar. Compare com um resultado clicado imediatamente. A informação Localizando… deve aparecer enquanto o WFS responde; as transições de câmera não devem depender de animação. Carregamento de imagens satelitais externas poderá continuar visível em alguns deslocamentos.

Nenhum teste local pode garantir uma velocidade específica de servidores públicos ou do provedor de tiles.
