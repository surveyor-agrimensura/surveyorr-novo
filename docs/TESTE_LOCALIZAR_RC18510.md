# SURVEYOR RC185.10 | Teste de localização de imóveis

## Mudanças

- Índice municipal de pesquisa preservado.
- A recuperação de geometrias WFS consulta no máximo dois gateways simultaneamente por campo de CAR, em vez de aguardar cada gateway em sequência.
- Geometrias que tenham passado pela comparação de CAR/código cadastral são reutilizadas de um IndexedDB separado (`surveyor-property-verified-geometry-v1`). Nenhuma alteração é feita nos índices municipais baixados.
- O cache de geometrias tem limite de 120 registros, prazo de 90 dias e limite de 600 mil caracteres por feição. Sempre se verifica a identidade do imóvel antes de renderizar uma geometria retornada do cache.
- Consultas com até três imóveis antecipam a primeira geometria, enquanto os resultados grandes não iniciam consultas em massa.
- O console registra `[Surveyor] Localizar: geometria e enquadramento` com o tempo total em milissegundos e a indicação de sucesso.

## Teste manual no Chrome

1. Abra `mapa/` servindo os arquivos da RC185.10. Confirme que o `app.js` da página utiliza `?v=1.0.0-rc.185.10`.
2. Pesquise por nome de imóvel com município definido e clique em **Localizar**. O primeiro acesso poderá depender do WFS oficial; registre `elapsedMs` no Console.
3. Clique em outro imóvel e volte ao primeiro: a geometria anteriormente verificada deverá vir da memória.
4. Recarregue a página e localize novamente o primeiro imóvel: a geometria deverá vir do IndexedDB sem refazer a consulta WFS, desde que o navegador permita persistência e o registro não tenha sido expulso.
5. Não apague os dados do site entre o primeiro e o segundo teste. Veja no DevTools > Application > IndexedDB > `surveyor-property-verified-geometry-v1` o cache, se desejar.

## Limites

- Não é possível garantir tempo fixo na primeira localização, porque a geometria pode não existir no dispositivo e depender da resposta dos serviços externos.
- Este ajuste não garante que imagens de satélite carreguem imediatamente após a mudança de centro/zoom.
- Não desabilite a verificação oficial de identidade: sem correspondência de CAR/código, o sistema não pode associar o polígono a um resultado local.

## Testes automatizados

`node tests/stable/property-location-latency-rc18510.test.mjs`

`npm run verify`
