# SURVEYOR Technical Engine

Núcleo técnico compartilhado das gerações cartográficas do SURVEYOR.

A partir da RC20/V70, a fase experimental `/pranchas-v2/` foi encerrada. O editor técnico oficial é carregado nas gerações existentes e persiste o estado visual no projeto.

O diretório `src/` mantém os módulos TypeScript de geometria, cena, layout e renderização vetorial para a evolução da engine. O runtime oficial de edição documental está em `/assets/js/core/technical-document-editor.js`, integrado aos geradores oficiais sem duplicar a rota de geração.
