# Project Context — Surveyor

## Produto
Surveyor é uma plataforma web de georreferenciamento e agrimensura. A base de produção preservada é a linha 21.11.5 em HTML/CSS/JavaScript, com autenticação e APIs remotas.

## Arquitetura atual
- Frontend estático: HTML, CSS e JavaScript, publicado no domínio oficial do Surveyor.
- Autenticação e backend: Appwrite/Auth + Functions do Surveyor.
- Geosserviços: Worker Cloudflare dedicado.
- Consulta Pública CAR: frontend em `/consulta-car/`, consultando SICAR/CAR oficial por WFS e enriquecendo, quando publicado, com CEFIR/INEMA oficial. Não há base cadastral JSON/JSONL embarcada na release.
- Persistência de projetos e documentos: integrações próprias do Surveyor já existentes na 21.11.5.

## Regras de preservação
1. Não introduzir código, executáveis, instaladores ou infraestrutura de outros produtos neste repositório.
2. Não migrar a base de produção para Electron nem para o frontend React legado sem decisão explícita.
3. Preservar autenticação, sessão, APIs, projetos, geometrias, documentos, permissões e integrações existentes.
4. Alterações visuais não podem quebrar as rotas ou permissões.
5. Administração pertence ao Surveyor e deve gerenciar usuários, planos, permissões, camadas, avisos e recursos administrativos do produto.

## UI atual
- Topbar global do Surveyor.
- Menu Ferramentas em painel horizontal agrupado, com quatro colunas, evitando lista vertical longa.
- Página inicial permanece normal quando não há card ativo; quando há card administrativo, uma faixa de destaque aparece e o bloco de boas-vindas se redimensiona.
- Cards da página inicial são criados, ocultados, reativados e apagados no painel administrativo.

## Qualidade
Use `coordenador-tecnico-geral` como orquestrador, com revisão de frontend, backend, segurança, geoespacial, QA, performance e release antes de publicar.
