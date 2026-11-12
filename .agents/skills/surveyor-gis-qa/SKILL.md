---
name: surveyor-gis-qa
description: Revisão e testes de geometrias, CRS, polígonos, glebas, confrontações, servidões, zoom, Croqui, Prancha e Memorial do SURVEYOR.
---
# SURVEYOR GIS QA

## Quando usar
Revisão de mapa, confrontações, vértices, divisas, áreas, linhas, servidões, rótulos, exportação SVG/PDF/KML/GeoJSON, zoom e consistência entre editores.

## Procedimento
1. Descobrir fonte de verdade de coordenadas e CRS, sem presumir EPSG. Identificar se o projeto usa graus, metros, UTM ou dados mistos.
2. Construir cenários mínimos e mensuráveis: gleba única; 4 glebas adjacentes; Polygon com buraco; MultiPolygon; vértices colineares; lote estreito; servidão tangente/atravessando a borda; nomes com lado irregular.
3. Comparar contorno externo vs arestas compartilhadas. Em imóvel completo, testar que as divisas internas não são confrontações externas, preservando glebas individuais.
4. Verificar que zoom do mapa, zoom da página, unidades métricas e posições SVG estão separados. O imóvel e todos os overlays devem manter proporção e alinhamento.
5. Verificar rótulos: posição manual permanece visualmente constante em termos do elemento correto; mudança de gleba não deve perder dono, CPF nem duplicar nomes.
6. Testar importação de texto de confrontantes: DIREÇÃO - NOME - CPF, variações de hífen, acento, caixa e ordem; prévia antes de aplicar; campo incompleto não deve inventar dados.
7. Comparar croqui, prancha e memorial com uma mesma geometria conhecida. Testar round-trip no armazenamento com dados fictícios.
8. Testar exportação de geometria e documento com leitores independentes quando possível.
9. Registrar tolerâncias adequadas à precisão declarada e as causas de divergência; nunca ajustar coordenadas silenciosamente.

## Resultado obrigatório
Matriz de casos, erros reproduzidos, correção mínima, teste antes/depois, geometrias intactas, limites não verificados. Sem garantia de precisão legal sem dado/fonte técnica verificável.
