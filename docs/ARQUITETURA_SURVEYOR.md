# Arquitetura visual das telas de geração

Atualizado em 22/11/2026.

## Composição

- O Memorial define o padrão visual de referência: shell de viewport inteira, navegação de etapas no topo, painel lateral de configuração e área de prévia em fundo neutro.
- O Croqui mantém seus componentes e controles geográficos próprios, mas compartilha a proporção do shell, a rolagem interna do painel e o rodapé de etapa fixo.
- Memorial, Croqui e as telas com `DocumentWorkflowBar` usam o mesmo padrão de moldura, painel lateral, barra da prévia e cartões de estado vazio.
- `GenerationPreviewEmptyState` e `generation-workspace.css` fornecem os componentes e estilos comuns. A cobertura inclui Prancha Técnica, Carta de Confrontação, Planilha ODS, Relatório Ambiental, Central de Lotes e `GenerationWorkspace` (Planialtimetria/MDT, Azimute e REURB).
- `DocumentWorkflowBar` importa a folha compartilhada para os fluxos que usam a barra. As páginas no shell `document-workflow` compartilham a altura disponível e rolagem interna, enquanto os controles e editores específicos permanecem próprios de cada ferramenta.
- A Central de Lotes usa o mesmo cabeçalho principal e área vazia centralizada, mantendo a configuração do pacote de documentos em sua etapa específica.

## Limites

Os editores mantêm ferramentas e conteúdo específicos do produto. Esta padronização trata da moldura, ocupação da viewport, comportamento responsivo e posicionamento das ações, sem unificar ou alterar a lógica de geometria, persistência ou exportação.
