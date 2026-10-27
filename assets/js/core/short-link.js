(() => {
  'use strict';
  const normalize = (value = '') => String(value || '')
    .toUpperCase()
    .replace(/[O]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, '');
  const path = String(location.pathname || '');
  const match = path.match(/\/p\/([0-9A-Za-z-]{10,11})\/?$/);
  const params = new URLSearchParams(location.search);
  const projectCode = normalize(match?.[1] || params.get('code') || params.get('c') || '');
  const locationCode = normalize(params.get('location') || params.get('loc') || params.get('l') || '');
  if (/^[0-9A-HJKMNP-TV-Z]{10}$/.test(projectCode)) {
    location.replace(`/public-project/#code=${encodeURIComponent(projectCode)}`);
    return;
  }
  if (/^[0-9A-HJKMNP-TV-Z]{10}$/.test(locationCode)) {
    location.replace(`/public-project/#loc=${encodeURIComponent(locationCode)}`);
    return;
  }
  document.querySelector('main').innerHTML = '<h1>Link inválido</h1><p>Confira o código curto informado.</p>';
})();
