# Mosaico satélite padrão do SURVEYORR

O modo `sat` nas gerações de Mapas/Croquis e Pranchas utiliza o mosaico EOX Sentinel-2 cloudless de 2016/2017 em WMTS. É uma composição histórica de resolução menor que ortofotos de alta definição, pensada para reduzir nuvens, não para substituir medições topográficas nem certificar limites. Não garante 100% de ausência de nuvens em todas as regiões.

- Fonte: https://s2maps.eu e https://cloudless.eox.at
- WMTS: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg`, com z<=13. A montagem interna envia linha (`y`) antes de coluna (`x`).
- Licença da edição 2016/2017: CC BY 4.0, permite uso comercial **com atribuição**. As edições 2018-2025 não devem ser usadas no SURVEYORR comercial sem licença apropriada.
- Crédito obrigatório: `Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017)`
- O crédito abreviado é impresso na prancha; ao publicar imagens e entregar documentos, manter o crédito completo junto das informações sobre as fontes.
- O modo `satOriginal` permite optar pelo World Imagery atual com maior nível de detalhe e possível presença de nuvens.
- Não existe substituição automática pela base nublada em caso de indisponibilidade da EOX: exibe mensagem de fundo indisponível e mantém geometria e cotas do imóvel.

**Homologação pendente:** confirmar disponibilidade real e nitidez no terreno do usuário, além de verificar o crédito no layout exportado.
