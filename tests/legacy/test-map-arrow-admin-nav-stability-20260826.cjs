const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');

const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const mapa = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');
const mapCss = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');
const adminCss = fs.readFileSync(path.join(root, 'assets/css/admin/organization.css'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin/index.html'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'assets/js/core/ui.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, 'assets/js/core/portal.js'), 'utf8');

function ok(value, message) {
  if (!value) {
    console.error('FAIL:', message);
    process.exit(1);
  }
  console.log('OK:', message);
}

ok(
  app.includes("const sy = panelRect.top + (panelRect.height * 0.52)") &&
  !app.includes("Math.max(panelRect.top + 68, Math.min(panelRect.bottom - 48, ty))"),
  'origem da seta fica fixa na lateral do painel e não acompanha o Y do imóvel'
);
ok(
  mapa.includes('id="ruralInfoArrowAnchor"') &&
  app.includes("document.getElementById('ruralInfoArrowAnchor')") &&
  mapCss.includes('.rural-info-arrow circle'),
  'âncora visual da ligação permanece presa ao painel'
);
ok(
  app.includes("map.on('move zoom resize', () => requestAnimationFrame(updateRuralInfoArrow))"),
  'seta é recalculada durante pan, zoom e resize do mapa'
);
ok(
  adminCss.includes('body[data-page="admin.html"] .sv-pro-topbar.sv-admin-only-topbar') &&
  adminCss.includes('left:0!important') &&
  adminCss.includes('width:100%!important'),
  'topbar do Admin não herda mais o recuo do sidebar oculto'
);
ok(
  /admin-organization-v21\.11\.5\.css\?v=[^"']+/.test(admin),
  'Admin força carregamento versionado do acabamento corrigido da topbar'
);
ok(
  runtime.includes("a.dataset.svModernNav='1'") &&
  runtime.includes('modernNavObserver') &&
  runtime.includes('window.SurveyorModernizeMapNav'),
  'menu moderno do mapa detecta e corrige retorno do menu legado'
);
ok(
  portal.includes("document.dispatchEvent(new CustomEvent('surveyor:map-nav-source-updated'))") &&
  portal.includes('window.SurveyorModernizeMapNav?.()'),
  'portal avisa o runtime após reconstrução assíncrona da navegação'
);
ok(
  /portal\.js\?v=[^"']+/.test(mapa) &&
  /surveyor-ui-runtime-current-v21\.11\.5\.js\?v=[^"']+/.test(mapa),
  'mapa usa cache-busting da correção do menu'
);

console.log('PASS: seta fixa no painel, topbar Admin e menu lateral estável validados.');
