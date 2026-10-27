    // Compatibilidade com arquivos antigos eventualmente mantidos em cache.
    // A implementação atual usa um Set local, mas esta proteção impede que
    // uma cópia antiga de app.js interrompa toda a inicialização do mapa.
    globalThis.loadedWindows = globalThis.loadedWindows instanceof Set
      ? globalThis.loadedWindows
      : new Set();
    globalThis.__GEORURAL_BUILD__ = '1.0.0-rc.185.74';
    document.documentElement.dataset.georuralBuild = globalThis.__GEORURAL_BUILD__;
    console.info('[Surveyor] build carregado:', globalThis.__GEORURAL_BUILD__);
  
