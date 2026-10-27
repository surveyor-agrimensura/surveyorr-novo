# RC185.7 | Pesquisa de imóvel rural: identidade e geometria

## Falha reproduzida na RC185.6

O GeoServer pode devolver FIDs sequenciais iguais (`cefir_imovel_rural_limite_inema.1`) em consultas diferentes. Esse FID sozinho não é prova de que duas feições representem o mesmo imóvel. A função antiga aceitava a coincidência do FID quando o resultado selecionado tinha CAR e a geometria retornada não tinha, o que podia associar o imóvel pesquisado à geometria de outro imóvel.

## Alterações

- `assets/js/features/mapa/app.js`: `hydrateLocalPropertyGeometry()` deixa de consultar por `FEATUREID` quando há CAR; consulta por CAR exato, com variantes de pontuação, nos campos cadastrais esperados; nunca aceita a primeira geometria da resposta sem comparar a identidade.
- `sameRuralPropertyIdentity()`: quando o resultado apresenta CAR, exige correspondência do CAR no retorno WFS. Mesmo FID sem CAR não é aceito.
- `propertyGeometryCacheKey()`: usa CAR ou código cadastral oficial, não FID que pode ser transitório; revalida geometrias existentes em cache.
- Pesquisa rápida/indexação municipal no IndexedDB mantida sem alterações.

## Teste automatizado de execução

No diretório principal do SURVEYOR, executar:

```
node tests/stable/property-geometry-car-runtime-rc1857.test.mjs
```

O teste simula uma resposta com Fazenda Jericó e Sítio Tabuleiro de Itachama, inclusive colisão de FIDs. Exige que a geometria correta seja selecionada, que a geometria de outro CAR seja rejeitada e que não haja `FEATUREID` quando o índice possui CAR.

## Como homologar no sistema

1. Abra `Mapa → IMÓVEL`, selecione Bahia e Amargosa.
2. Pesquise `Sítio Tabuleiro de Itachama` e clique em `Localizar`.
3. Se o polígono abrir, confira no painel de informações que o CAR corresponde ao resultado da lista e que não foi substituído pelos dados da Fazenda Jericó.
4. Teste mais dois imóveis cujo CAR e município você conhece.
5. Se a origem oficial estiver indisponível (por exemplo, HTTP 502), o SURVEYOR não deverá desenhar uma geometria diferente para simular sucesso. Essa indisponibilidade não é solucionada por uma correção de identidade no frontend.

**Observação:** o teste local utiliza WFS simulado. A obtenção real de geometrias depende de disponibilidade e campos do GeoServer oficial. Não houve validação autenticada da resposta oficial nesta execução.
