const fs = require('fs');
const assert = require('assert');
const read = (p) => fs.readFileSync(p, 'utf8');

const page = read('planos/index.html');
const adminHtml = read('admin/index.html');
const admin = read('assets/js/admin/app.js');
const docs = read('assets/js/admin/documents.js');
const auth = read('assets/js/core/auth.js');
const api = read('functions/surveyor-api/src/main.js');
const support = read('functions/surveyor-support/src/main.js');
const geo = read('functions/surveyor-geoservices/src/main.js');
const build = read('scripts/build.mjs');
const manifest = JSON.parse(read('RELEASE_MANIFEST.json'));
const deployPkg = JSON.parse(read('deploy/cloudflare-geoservices/package.json'));

const annual = { basic_annual: 39900, plus_annual: 69900, pro_annual: 119900 };
for (const [slug, cents] of Object.entries(annual)) {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`slug:\\s*['\"]${escaped}['\"][\\s\\S]{0,180}priceCents:\\s*${cents}`).test(api), `API sem plano anual ${slug}`);
  assert(new RegExp(`['\"]${escaped}['\"]\\s*:\\s*\\{[\\s\\S]{0,250}['\"]priceCents['\"]:\\s*${cents}`).test(admin), `Admin sem preset anual ${slug}`);
  assert(new RegExp(`${escaped}\\s*:\\s*\\{[\\s\\S]{0,200}priceCents:\\s*${cents}`).test(docs), `Documentos sem plano anual ${slug}`);
}

// Monthly plans stay only as inactive compatibility records; never public/checkout defaults.
for (const slug of ['basic_monthly','plus_monthly','pro_monthly']) {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`slug:\\s*['\"]${escaped}['\"][\\s\\S]{0,240}active:\\s*false`).test(api), `${slug} precisa estar inativo/legado`);
}
assert(page.includes('CONTRATAÇÃO ANUAL'));
assert(page.includes('Não há modalidade mensal para novas contratações.'));
assert(!page.includes('/mês'), 'Página pública não pode anunciar cobrança mensal');
assert(!/R\$\s*(39,90|69,90|119,90)/.test(page), 'Página pública não deve exibir preços mensais legados');
assert(!adminHtml.includes('<option value="mensal">Mensal</option>'), 'Admin não pode oferecer criação de plano mensal');
assert(!adminHtml.includes('planPresetBasicMonthly'), 'Presets mensais não podem ser oferecidos no Admin');
assert(api.includes("PAYMENT_MONTHLY_PLAN_DISABLED"), 'Checkout precisa recusar slugs mensais legados');
assert(api.includes("PAYMENT_REQUIRE_FULL_PRICE', 'true'"), 'Preço integral deve ser exigido por padrão');
assert(auth.includes("basic: 'basic_annual'"), 'Alias Básico deve apontar para anual');
assert(auth.includes("plus: 'plus_annual'"), 'Alias Plus deve apontar para anual');
assert(auth.includes("pro: 'pro_annual'"), 'Alias Pro deve apontar para anual');

// First access: no commercial password is returned or mailed.
assert(!api.includes('temporaryPassword: provisioned.temporaryPassword'), 'Provisionamento não pode retornar senha temporária');
assert(!api.includes('initialPassword: input.welcomeEmail'), 'Documento comercial não pode transmitir senha inicial');
assert(api.includes('buildFirstAccessInvitation'), 'API precisa gerar convite de primeiro acesso');
assert(support.includes('Criar minha senha'), 'E-mail precisa orientar criação segura da senha');
assert(!adminHtml.includes('ela será enviada ao cliente junto com o e-mail'), 'Admin não pode instruir envio de senha por e-mail');
assert(!admin.includes('initialPassword: payload.password'), 'Admin não pode anexar senha inicial ao documento comercial');
for (const slug of ['basic_monthly','plus_monthly','pro_monthly']) {
  const start = admin.indexOf(`"${slug}": {`);
  assert(start >= 0, `${slug} ausente do Admin`);
  const block = admin.slice(start, start + 700);
  assert(block.includes('"isActive": false'), `${slug} também precisa ficar inativo no Admin`);
}
assert(api.includes("workspacePreviousPlanSlug: 'basic_annual'"), 'Novos membros devem usar plano anual como referência anterior padrão');
assert(api.includes("plan: 'basic_annual' }).catch(() => null);"), 'Auto-reparo de perfil deve usar o plano anual padrão');

// GeoServices internal import must fail closed.
assert(geo.includes('GEOSERVICES_INTERNAL_TOKEN_REQUIRED'));
assert(geo.includes('timingSafeEqual'));

// Public build hardening and repository hygiene.
assert(build.includes('assertNoSensitiveFiles'));
assert(build.includes("security.mjs"));
assert(build.includes("lower.startsWith('.env.')"));
assert(fs.existsSync('.gitignore'));
assert(read('.gitignore').includes('node_modules/'));
assert(read('.gitignore').includes('.env'));
assert.equal(deployPkg.devDependencies.wrangler, '4.131.1');
const apiEnvExample = read('functions/surveyor-api/.env.example');
assert(apiEnvExample.includes('PAYMENT_REQUIRE_FULL_PRICE=true'), 'Exemplo de produção deve exigir preço integral por padrão');
assert(!apiEnvExample.includes('RENEWAL_MONTHLY_DISCOUNT_PERCENT='), 'Configuração nova não deve anunciar renovação mensal');
for (const filename of fs.readdirSync('assets/plan-documents')) {
  assert(!/mensal/i.test(filename), `Documento mensal legado não pode permanecer nos assets públicos: ${filename}`);
}

// Manifest must describe current behavior, not the old R14 password/monthly policy.
assert.equal(manifest.commercialPlans.billingPolicy, 'annual-only');
assert.equal(manifest.onboarding.passwordSentByEmail, false);
assert.equal(manifest.onboarding.secureFirstAccessLink, true);
assert.equal(manifest.securityHardening.backupEncryption, 'AES-256-GCM-required-by-default');
assert.equal(manifest.geobahiaCatalog.bahiaOfficialTechnicalLayers, 82);
assert.equal(manifest.geobahiaCatalog.sicarStatePropertyLayers, 27);
assert.equal(manifest.geobahiaCatalog.propertyBoundarySource, 'CAR / SICAR oficial por UF');

console.log('OK R15/R16: contratação anual, primeiro acesso seguro, GeoServices fail-closed, release hardening e catálogo estável validados.');
