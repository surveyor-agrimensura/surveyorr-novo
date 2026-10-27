# Política de persistência

## Backend/nuvem

Persistir somente o estado oficial necessário para reconstruir o projeto: metadados essenciais, geometrias, glebas, confrontantes, estilos e configurações técnicas necessárias.

## Gerado sob demanda

Memorial, croqui, prancha, carta, planilha, relatório, KML/DXF/ZIP e previews não são arquivados automaticamente no projeto.

## Navegador

- `localStorage`: preferência/cache descartável.
- `sessionStorage`: sessão/estado transitório.
- Nenhum dado oficial pode depender exclusivamente desses storages.

## Dívida conhecida para a Fase 2

O módulo Loteamentos/REURB ainda possui persistência local própria e deve migrar para o serviço oficial de projetos antes de ser considerado fonte oficial em nuvem.
