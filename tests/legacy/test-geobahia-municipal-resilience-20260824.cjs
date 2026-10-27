const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'deploy/cloudflare-geoservices/src/worker.js'), 'utf8');
function ok(condition, message) { if (!condition) throw new Error(message); }
ok(/function officialMunicipalBoundaryMatch\(/.test(app), 'Mapa não identifica a camada municipal padrão de forma explícita.');
ok(/officialMunicipalBoundaryMatch\(layer\)\) return false/.test(app), 'Camada municipal ainda pode priorizar WFS.');
ok(/forceWmsOnly:\s*String\(item\.layer/.test(api), 'Seed da API não marca a camada municipal como WMS-only.');
ok(/isInemaPublicGeoService/.test(worker), 'Worker não reconhece fallback restrito ao INEMA.');
ok(/allowOfficialHttpFallback/.test(worker) && /allowAutomaticInemaHttp\s*&&\s*isInemaPublicGeoService/.test(worker), 'Worker não tenta fallback HTTP server-to-server restrito ao GeoServer INEMA com TLS quebrado.');
ok(/capabilityTarget\.protocol\s*=\s*['"]http:['"]/.test(worker), 'Capabilities do INEMA não possuem segunda fase HTTP após falha das versões HTTPS.');
ok(/sem cookies nem cabeçalhos de autorização/.test(worker), 'Worker não documenta a restrição de segurança do fallback INEMA.');
console.log('OK: camada municipal usa WMS e GeoServices possui fallback INEMA restrito e seguro no Worker.');
