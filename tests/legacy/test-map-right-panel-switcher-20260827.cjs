const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'assets/js/features/mapa/controls.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');
const mapa = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');

function ok(value, message) {
  if (!value) {
    console.error('FAIL:', message);
    process.exit(1);
  }
  console.log('OK:', message);
}

ok(
  mapa.includes('id="svRightPanelSwitcher"') && mapa.includes('data-panel-switch-glyph'),
  'mapa possui seta lateral dedicada para alternar os dois painéis direitos'
);
ok(
  app.includes("let rightPanelActive = null") &&
  app.includes('function syncRightPanelStack') &&
  app.includes('function activateRightPanel') &&
  app.includes('function switchRightPanel'),
  'gerenciador preserva um painel ativo e alterna sem fechar o outro'
);
ok(
  app.includes("markRightPanelState('details', { open: true, parked: resolved !== 'details' })") &&
  app.includes("markRightPanelState('rural', { open: true, parked: resolved !== 'rural' })"),
  'quando os dois estão abertos somente um fica visível e o outro permanece recuado'
);
ok(
  app.includes("activate: true") &&
  app.includes("setRuralInfoPanel({") &&
  app.includes("activateRightPanel('details')"),
  'o painel aberto por último assume a frente tanto na consulta quanto na seleção do perímetro'
);
ok(
  app.includes("syncRightPanelStack('details')") && app.includes("syncRightPanelStack('rural')"),
  'fechar de verdade um painel revela automaticamente o outro ainda aberto'
);
ok(
  app.includes("panel.classList.contains('sv-right-panel-parked')") &&
  app.includes("document.getElementById('ruralInfoArrow')?.classList.remove('active')"),
  'seta de ligação CAR não fica desenhada quando o painel fundiário está recuado'
);
ok(
  runtime.includes("window.SurveyorRightPanelStack?.sync?.('rural')"),
  'fechamentos transitórios do painel de detalhes também sincronizam o alternador'
);
ok(
  css.includes('.sv-right-panel-switcher') &&
  css.includes('.details.sv-right-panel-parked') &&
  css.includes('.rural-info-panel.sv-right-panel-parked'),
  'CSS implementa a seta lateral e o estado recuado dos dois painéis'
);
ok(
  /surveyor-map-current-v21\.11\.5\.css\?v=[^"']+/.test(mapa) &&
  /app-v21\.9\.0\.js\?v=[^"']+/.test(mapa),
  'mapa mantém cache-busting atualizado sem exigir um sufixo CSS antigo literal'
);

console.log('PASS: alternância entre Perímetro do imóvel e Informações CAR/SIGEF validada.');
