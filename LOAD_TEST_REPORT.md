# Relatório de carga local — status corrigido

## Status

Os números que estavam nesta página foram retirados: não havia artefatos reproduzíveis que comprovassem as medições. Eles não devem ser usados como resultado, limite de capacidade ou evidência de desempenho.

Ainda não há medições válidas neste relatório. O script `loadtest.mjs` foi ajustado para testar apenas rotas existentes do frontend local e recusa hosts que não sejam loopback. Ele mede requisições HTTP, tempos de resposta e corpos recebidos; não mede execução/renderização React, cálculos GIS, backend, banco de dados, memória ou capacidade de produção. O servidor de desenvolvimento também não representa o Cloudflare Pages.

## Como reproduzir

Os scripts nao seguem redirecionamentos para outras origens; respostas 3xx sao marcadas como falha e nao contatam o destino indicado.

Inicie o frontend local na porta 5500 e, em outro terminal, rode:

```bash
node loadtest.mjs 10 100 http://127.0.0.1:5500
node high-concurrency-test.mjs http://127.0.0.1:5500
```

O segundo comando executa três ensaios locais pequenos (10, 25 e 50 requisições concorrentes). Os scripts não enviam tráfego a hosts externos. Um status HTTP bem-sucedido comprova apenas que o servidor respondeu; não comprova que uma rota protegida autenticou ou que seus dados foram renderizados.

## Evidência pendente

Para publicar números aqui, arquive a saída integral do comando, a revisão/estado do servidor e a data do ensaio. Para medir comportamento funcional, use testes de navegador com sessão de teste e dados fictícios; para persistência, confirme salvar, recarregar e comparar os mesmos valores. Para testes de capacidade de produção, use um ambiente de homologação autorizado e metodologia específica, fora destes scripts locais.
