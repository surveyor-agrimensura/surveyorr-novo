# Triagem do QA Web da RC2

Relatório recebido em 21/09/2026 e executado contra `1.0.0-rc.2`.

- BUG-001 (mapa não inicializa): corrigido na RC3, com teste de bootstrap.
- BUG-002 (F5 exige novo login): comportamento deliberado definido pelo produto; não é regressão enquanto essa política permanecer oficial.
- BUG-003 (croqui trava quando Esri falha): corrigido na RC4. O gerador tenta host alternativo e, se o provedor continuar indisponível, gera o documento sem o fundo remoto em vez de reinjetar uma URL quebrada no SVG.
- BUG-004 (ODS inclui fechamento como vértice extra): corrigido na RC4 usando tolerância numérica para identificar o fechamento do anel.
- BUG-005 (módulo de cotas ausente): corrigido/confirmado na RC3; `dimensions.js` é carregado antes de `mapas/app.js` e possui gate de regressão.
- BUG-006 (headers HTTP de defesa): pendência de infraestrutura/CDN. Não pode ser resolvida apenas pelo HTML quando a hospedagem não permite headers customizados.
- BUG-007 (contador de projetos ignora filtro): corrigido na RC4.
- BUG-008 (login sem mostrar/ocultar senha): corrigido na RC4 com controle acessível.
- BUG-009 (REURB sem validação ao salvar vazio): corrigido na RC4 para nome, proprietário e município.
- BUG-010 (credencial inválida lenta): otimizado na RC4 paralelizando registros independentes de rate-limit/bloqueio. Requer novo teste de produção para medir o ganho real, pois o tempo também depende do Appwrite/rede.

A RC4 deve ser submetida novamente ao mesmo roteiro web antes da promoção para Stable.
