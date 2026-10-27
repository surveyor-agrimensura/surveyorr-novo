(() => {
  'use strict';
  const routes = new Set(["acervos", "admin", "admin-cards", "ambiental", "car", "consulta-car", "confrontacao", "customizacao", "earth-3d", "glebas", "login", "loteamentos-reurb", "mapa", "mapas", "memorial", "nuvem", "ods", "perimetros", "planialtimetria", "pranchas", "public-project", "sobre", "suporte"]);
  const path = String(window.location.pathname || '/');
  const shortMatch = path.match(/\/p\/([0-9A-Fa-f]{16})\/?$/);
  if (shortMatch) {
    window.location.replace(`/public-project/#code=${encodeURIComponent(shortMatch[1].toUpperCase())}`);
    return;
  }
  if (/\/projetos\/?$/i.test(path)) {
    window.location.replace(`/nuvem/${window.location.search || ''}${window.location.hash || ''}`);
    return;
  }
  const match = path.match(/\/([^/]+)\.html$/i);
  if (!match) return;
  const route = String(match[1] || '').toLowerCase();
  if (!routes.has(route)) return;
  const target = `/${route}/${window.location.search || ''}${window.location.hash || ''}`;
  window.location.replace(target);
})();
