const fs = require('fs');
const assert = require('assert');
const read = (p) => fs.readFileSync(p, 'utf8');

const page = read('planos/index.html');
const admin = read('assets/js/admin/app.js');
const docs = read('assets/js/admin/documents.js');
const api = read('functions/surveyor-api/src/main.js');
const login = read('login/index.html');
const terms = read('termos/index.html');
const privacy = read('privacidade/index.html');
const manifest = JSON.parse(read('RELEASE_MANIFEST.json'));

const prices = {
  basic_monthly: 3990,
  plus_monthly: 6990,
  pro_monthly: 11990,
  basic_annual: 39900,
  plus_annual: 69900,
  pro_annual: 119900,
};

for (const [slug, cents] of Object.entries(prices)) {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`slug:\\s*['\"]${escaped}['\"][\\s\\S]{0,180}priceCents:\\s*${cents}`).test(api), `API sem preço oficial de ${slug}`);
  assert(new RegExp(`['\"]${escaped}['\"]\\s*:\\s*\\{[\\s\\S]{0,220}['\"]priceCents['\"]:\\s*${cents}`).test(admin), `Admin sem preço oficial de ${slug}`);
  assert(new RegExp(`${escaped}\\s*:\\s*\\{[\\s\\S]{0,180}priceCents:\\s*${cents}`).test(docs), `Documentos sem preço oficial de ${slug}`);
}

['R$ 39,90','R$ 69,90','R$ 119,90','R$ 399,00','R$ 699,00','R$ 1.199,00'].forEach((label) => {
  assert(page.includes(label), `Página pública sem ${label}`);
});

assert(page.includes('Até 2 acessos: titular + 1 membro'), 'Plus precisa explicar acessos incluídos');
assert(page.includes('Até 4 acessos: titular + 3 membros'), 'Pro precisa explicar acessos incluídos');
assert(!admin.includes('usuários simultâneos na mesma conta'), 'Admin não deve incentivar compartilhamento de credencial');
assert(!api.includes('usuários simultâneos na mesma conta'), 'API não deve descrever equipe como compartilhamento de conta');
assert(login.includes('href="/planos/"'), 'Login precisa expor Planos e preços');
assert(terms.includes('href="/planos/"'), 'Termos precisam apontar para Planos');
assert(privacy.includes('href="/planos/"'), 'Privacidade precisa apontar para Planos');
assert.equal(manifest.commercial.publicPlansPage, '/planos/');
assert.equal(manifest.commercial.officialPrices.pro.annualCents, 119900);
assert.equal(manifest.commercial.addons.proAdditionalUserMonthlyCents, 6000);

console.log('OK R14: página comercial, preços oficiais, acessos por equipe e integrações públicas validados.');
