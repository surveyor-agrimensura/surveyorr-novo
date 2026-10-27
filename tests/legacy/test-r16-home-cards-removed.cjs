const fs = require('fs');
const path = require('path');
const assert = require('assert');

const home = fs.readFileSync('index.html', 'utf8');
const admin = fs.readFileSync('admin/index.html', 'utf8');
const onboarding = fs.readFileSync('assets/js/core/onboarding.js', 'utf8');
const runtime = fs.readFileSync('assets/js/core/ui.js', 'utf8');
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');

assert(!home.includes('homeCardsRegion'));
assert(!admin.includes('tab-home-cards'));
assert(!admin.includes('Cards da Página Inicial'));
assert(!onboarding.includes("title: 'Cards da Página Inicial'"));
assert(!runtime.includes('enhanceAdminHomeCardsLink'));
assert(!api.includes('/api/admin/home-card-images'));
assert(!api.includes('/api/home-card-images/'));
assert(!api.includes('normalizeHomeCardImageDataUrl'));
assert(!api.includes('safeHomeCardImageFileId'));
assert(!fs.existsSync(path.join('assets','js','features','home-cards')));
assert(!fs.existsSync(path.join('assets','css','features','home-cards')));
assert(!fs.existsSync(path.join('assets','home-cards')));

console.log('PASS R16: recurso de Cards da Página Inicial removido da Home, Admin, onboarding e assets.');
