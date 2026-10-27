const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const auth = fs.readFileSync(path.join(root, 'assets/js/core/auth.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
function ok(v, m){ if(!v){ console.error('FAIL:',m); process.exit(1);} console.log('OK:',m); }
ok(auth.includes("if (isMunicipalSei) return false;"), 'frontend força Divisão Político Administrativa - SEI a iniciar desligada');
ok(api.includes("if (isMunicipalSei) return false;"), 'API não injeta a camada SEI como padrão');
ok(api.includes('defaultEnabled: false,'), 'seed GeoBahia não marca municip_sei_2019 como default');
ok(app.includes('enabled: layer?.defaultEnabled === true'), 'catálogo respeita somente defaultEnabled explícito');
ok(api.includes("forceWmsOnly: String(item.layer || '').split(':').pop() === 'municip_sei_2019'"), 'camada SEI continua disponível em WMS quando usuário ativar');
console.log('PASS: Divisão Político Administrativa - SEI disponível, porém DESATIVADA por padrão.');
