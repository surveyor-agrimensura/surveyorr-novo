# Estado do SURVEYOR

## Telas de geração

Atualizado em 22/11/2026.

- Memorial, Croqui, Prancha Técnica, Carta de Confrontação, Planilha ODS, Relatório Ambiental, Central de Lotes e os fluxos de `GenerationWorkspace` (Planialtimetria/MDT, Perímetro por Azimute e REURB) compartilham cabeçalhos, títulos laterais, barra de prévia, estados vazios e navegação de etapas.
- Os fluxos baseados em documentos usam uma moldura única de painel lateral e área principal, com rolagem interna; os controles especializados de cada ferramenta foram preservados.
- As prévias vazias de Memorial, Croqui, Prancha, Confrontação, ODS, Relatório Ambiental, Central de Lotes e `GenerationWorkspace` usam o mesmo cartão centralizado.
- Foram removidas do Croqui e da Prancha Técnica as duas explicações apontadas pelo usuário.
- Prancha Técnica e `GenerationWorkspace` usam os mesmos breakpoints principais de empilhamento do Memorial; a Prancha remove a moldura interna redundante.

## Verificação desta atualização

- `npm run typecheck`: executado após a ampliação; resultado final registrado no log de execução.
- `git diff --check`: executado; sem erros de whitespace (Git emitiu somente avisos de conversão CRLF/LF em arquivos preexistentes modificados).
- Não foi feita verificação visual pós-alteração em navegador. As capturas fornecidas serviram para identificar diferenças anteriores.
- Alterações locais preexistentes em `public/_headers`, `vite.config.ts`, `.claude/` e scripts de carga foram preservadas.
