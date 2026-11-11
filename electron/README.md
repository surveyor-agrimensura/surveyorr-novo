# SURVEYOR para Windows

O aplicativo desktop reutiliza as telas e os fluxos existentes do SURVEYOR Web. Mapa, desenho e edição de geometrias, divisão de glebas, Croqui, Prancha Técnica e Memorial são carregados do build local da interface.

## Gerar

- `npm run desktop:win`: cria o instalador Windows e o executável portátil em `release/`.
- `npm run desktop:dir`: gera a pasta executável sem instalador.
- `npm run desktop:dev`: compila e abre em modo desktop para desenvolvimento.

## Requisitos de uso

É necessário acesso à internet para autenticação, projetos sincronizados, salvamento na nuvem, mapas base e serviços geográficos remotos. Exportações e edições locais da interface rodam no aplicativo. O programa inicia um servidor local em `localhost:5500`, porta já utilizada pelo SURVEYOR Web em desenvolvimento; feche o servidor web antes de abrir o desktop.

O executável não publica funções nem altera configuração ou dados de produção durante a compilação. Os endpoints continuam sendo os públicos já configurados no frontend.
