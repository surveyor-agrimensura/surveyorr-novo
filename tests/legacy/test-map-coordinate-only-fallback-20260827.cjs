const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');
const mapa = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');
function ok(v,m){ if(!v){ console.error('FAIL:',m); process.exit(1); } console.log('OK:',m); }

ok(mapa.includes('id="ruralInfoCarSection"') && mapa.includes('id="ruralInfoSigefSection"'), 'CAR e SIGEF possuem seções ocultáveis individualmente');
ok(mapa.includes('id="ruralInfoPanelEyebrow"') && mapa.includes('id="ruralInfoPanelTitle"'), 'cabeçalho do painel pode distinguir imóvel de ponto sem cadastro');
ok(app.includes("const neutralAccent = '#64748B'"), 'ponto sem cadastro usa acento/seta cinza');
ok(app.includes("loading: true") && app.includes("showCar: true") && app.includes("showSigef: true") && app.includes("coordinatesOnly: !sourceFeature"), 'consulta abre CAR e SIGEF imediatamente em estado de carregamento, mesmo sem feição confirmada');
ok(app.includes("const hasRegisteredProperty = carFound || sigefFound"), 'resultado final distingue cadastro encontrado de ponto apenas com coordenadas');
ok(app.includes("coordinatesOnly: !hasRegisteredProperty") && app.includes("showCar: true") && app.includes("showSigef: true"), 'sem cadastro, CAR/SIGEF continuam visíveis com mensagem de ausência e coordenadas permanecem disponíveis');
ok(app.includes("Nenhum cadastro CAR/SIGEF encontrado neste ponto. Coordenadas disponíveis."), 'usuário recebe retorno claro quando só há coordenadas');
ok(!app.includes("if (!entries.length && !forceRural) return false;"), 'interrogação não depende de camada fundiária estar ligada');
ok(app.includes("await identifyRuralRegistriesAt(targetLatLng, liveEntries"), 'interrogação consulta cadastros/coordenadas mesmo sem camada visível');
ok(app.includes("map-layer-info-help-coordinate-only"), 'interrogação em ponto sem feição ganha estado visual neutro');
ok(css.includes('.rural-info-panel.rural-info-coordinates-only') && css.includes('.map-layer-info-help.map-layer-info-help-coordinate-only'), 'CSS deixa painel somente-coordenadas compacto e marcador neutro');
ok(/surveyor-map-current-v21\.11\.5\.css\?v=[^"']+/.test(mapa) && /app-v21\.9\.0\.js\?v=[^"']+/.test(mapa), 'cache-bust mantém frontend versionado sem prender o teste a uma release específica');
console.log('PASS: consulta sem cadastro preserva coordenadas, usa cinza e funciona com Limites de Propriedade desligada.');
