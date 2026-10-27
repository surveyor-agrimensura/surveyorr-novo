# Pesquisa de imóveis: diagnóstico da recuperação geométrica (RC185.6)

## O que foi comprovado

O índice local (IndexedDB) guarda CAR, nome, IDs e atributos essenciais, mas **não guarda o polígono** (`geometryStored: false`). A pesquisa textual pode ser instantânea sem acesso ao serviço externo. Porém, o clique **Localizar** precisa recuperar uma geometria confiável pela identidade oficial.

A RC185.5 abortava a recuperação após qualquer falha da primeira consulta WFS (`FEATUREID`) e não testava o caminho alternativo exato pelo CAR. Um teste de execução controlado reproduziu a regressão. A RC185.6 permite no máximo duas consultas com chaves oficiais, sem escolher o primeiro polígono indiscriminadamente.

A interface não informa mais `Visualizando` antes do polígono ser obtido com sucesso.

## O que esta atualização não prova

Se **todos** os caminhos de WFS responderem HTTP 502 ou não devolverem geometria, não há coordenadas suficientes no índice local para desenhar um polígono autêntico. Nenhuma implementação de frontend pode criar a geometria oficial a partir do nome ou do CAR sozinho. A recuperação exige que pelo menos uma fonte de geometria responda, ou que uma geometria oficial tenha sido armazenada previamente com identidade verificável.

HTTP 502 é uma resposta dos gateways e precisa ser investigada pelo corpo da resposta e logs da Function `surveyor-geoservices` ou do Cloudflare Worker. Um 502 não comprova, por si só, que o filtro municipal está errado. Também não comprova que o servidor upstream está fora do ar, pois a requisição enviada pode ser inválida.

## Verificação reproduzível sem rede

Executar `node tests/stable/property-geometry-retry-runtime-v186.test.mjs` na raiz. O teste usa o **código real** da função de hidratação e simula: (1) primeira rota indisponível e segundo caminho CAR válido; (2) CAR diferente; (3) indisponibilidade total. Não depende de um serviço remoto.

## Verificação real de integração

No navegador, verificar em Network o corpo JSON do HTTP 502 de `/wfs-url/…`. O campo `detail` costuma esclarecer se ocorreu timeout, TLS, resposta OGC/XML ou falha de upstream. Se todas as fontes falharem, a solução exige intervenção no proxy/serviço e posterior implantação dessas mudanças no servidor remoto; editar apenas o ZIP do frontend não altera Functions já publicadas.
