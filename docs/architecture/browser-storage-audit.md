# Armazenamento do navegador — estado após Fase 2

## Fonte oficial

Dados necessários para reconstruir um projeto pertencem ao backend/Appwrite. O navegador nunca é a única fonte de verdade de projeto, geometria, owner, plano, quota ou permissão.

## `sessionStorage`

Uso permitido para dados transitórios:

- sessão/autenticação da aba;
- handoff Mapa → Earth 3D;
- rascunho temporário de Loteamentos/REURB;
- assinatura e posição temporárias no editor administrativo antes de `Salvar na conta`;
- estados temporários de fluxo.

## `localStorage`

Uso permitido apenas para preferências/cache:

- preferência de Snap;
- opções visuais/edição do mapa;
- caches de municípios/centros;
- onboarding concluído;
- template preferido do Memorial;
- cache/mirror descartável da Personalização;
- overrides locais de desenvolvimento permitidos somente em localhost.

## Removido como fonte de verdade

- projeto oficial de Loteamentos/REURB;
- lixeira local de projeto;
- contador falso de versões;
- fila local sem processamento real;
- armazenamento persistente da assinatura temporária;
- payload persistente de Earth 3D;
- arquivamento automático de PDF/DOCX/KML/DXF/ZIP gerado.

## Regra comercial

O armazenamento do plano contabiliza dados oficiais armazenados para o usuário/workspace. Artefatos regeneráveis não devem consumir quota automaticamente.
