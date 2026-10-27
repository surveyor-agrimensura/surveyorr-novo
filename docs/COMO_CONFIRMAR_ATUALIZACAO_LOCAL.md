# Como confirmar a atualização local

1. Extraia o ZIP em uma pasta nova e abra essa pasta no VS Code. Não mantenha duas cópias sendo servidas simultaneamente na porta 5500.
2. Execute `node scripts/check-local-release.mjs` na raiz do projeto para conferir fonte e dist.
3. Abra `/mapa/` e confira no DevTools > Network se `assets/js/features/mapa/app.js?v=1.0.0-rc.185.1` foi servido, não o `rc.185` anterior.
4. Se continuar aparecendo `rc.185`, confirme a pasta raiz usada pelo Live Server/Atualizador. Recarregue ignorando o cache e avalie a atualização do service worker, sem apagar dados da aplicação.
5. No console, `window.SurveyorPropertySearchLastRejection` só é preenchida quando a execução alcança a condição que registra a rejeição. Se aparecer `undefined`, isso por si só não demonstra que a busca esteja correta.

A mudança desta revisão garante versão única dos arquivos, mas não confirma por si só o comportamento online do serviço de imóveis.
