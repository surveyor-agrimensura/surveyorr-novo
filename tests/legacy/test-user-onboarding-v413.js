import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('admin/index.html');
const admin = read('assets/js/admin/app.js');
const docs = read('assets/js/admin/documents.js');
const auth = read('assets/js/core/auth.js');
const api = read('functions/surveyor-api/src/main.js');
const support = read('functions/surveyor-support/src/main.js');

for (const id of [
  'userWizardProgress', 'userWizardBack', 'userWizardNext', 'userSaveButton',
  'userCalculatedAmount', 'userCalculatedStart', 'userCalculatedExpiry',
  'userSendWelcomeEmail', 'userOnboardingSignatureZone', 'userOnboardingReview',
  'userWorkspacePlanRule', 'userAddWorkspaceMember', 'userWorkspaceMemberDrafts'
]) assert.match(html, new RegExp(`id="${id}"`), `Elemento ${id} ausente no assistente de usuário.`);

assert.match(html, /ETAPA 1 DE 5[\s\S]*Nome completo[\s\S]*E-mail[\s\S]*WhatsApp[\s\S]*Senha inicial/);
assert.match(html, /ETAPA 2 DE 5[\s\S]*Perfil[\s\S]*Plano[\s\S]*Status/);
assert.match(html, /Comprovante de Contratação, Ativação e Ciência do Termo de Adesão/);
assert.match(html, /a senha inicial será enviada somente no e-mail de criação da conta e não será gravada em texto puro nem incluída no PDF/i);
assert.match(html, /class="user-edit-only">Vencimento/);

assert.match(admin, /function addCalendarCycle\(dateValue, cycle\)/);
assert.match(admin, /durationDays = cycle === 'mensal' \? 30 : \(cycle === 'anual' \? 365 : 0\)/);
const calendarSource = admin.match(/function addCalendarCycle\(dateValue, cycle\) \{[\s\S]*?\n  \}(?=\n\n  function formatUserDate)/)?.[0];
assert.ok(calendarSource, 'Não foi possível extrair a função de calendário.');
const calendarContext = {};
vm.runInNewContext(`${calendarSource}; this.addCalendarCycle = addCalendarCycle;`, calendarContext);
assert.equal(calendarContext.addCalendarCycle('2026-07-31', 'mensal'), '2026-08-30');
assert.equal(calendarContext.addCalendarCycle('2026-01-31', 'mensal'), '2026-03-02');
assert.equal(calendarContext.addCalendarCycle('2028-02-29', 'anual'), '2029-02-28');
assert.match(admin, /common\.expiresAt = calculated\.endDate \? `\$\{calculated\.endDate\}T23:59:59-03:00`/);
assert.match(admin, /documentApi\.createOnboardingPdf/);
assert.match(admin, /payload\.onboardingDocument = \{/);
assert.match(admin, /signatureDataUrl: userOnboardingState\.signatureDataUrl/);
assert.match(admin, /signaturePosition: userOnboardingState\.signaturePosition/);
assert.match(admin, /if \(result\?\.onboardingEmail\?\.sent\)/);

assert.match(docs, /async function createOnboardingPdf\(input = \{\}\)/);
assert.match(docs, /temporaryPassword: ''/);
assert.match(docs, /COMPROVANTE DE CONTRATAÇÃO, ATIVAÇÃO E CIÊNCIA/);
assert.match(docs, /data\.signaturePosition \|\| state\.signaturePosition/);
assert.match(docs, /window\.SurveyorPlanDocuments = Object\.freeze/);
assert.match(docs, /Comprovante_Contratacao_Ativacao_Ciencia/);

assert.match(auth, /async function createUser\(payload\)[\s\S]*return data;/);
assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/);
assert.match(api, /async function dispatchPlanDocumentEmail\(input = \{\}\)/);
assert.match(api, /if \(input\.onboardingDocument\?\.sendEmail === true\)/);
assert.match(api, /welcomeEmail: true/);
assert.match(api, /user_onboarding_email_sent/);
assert.match(api, /user_onboarding_email_failed/);
assert.match(api, /workspaceSetup/);
assert.match(api, /prepareOnboardingWorkspaceMembers/);
assert.match(api, /subscriptionStartedAt: input\.subscriptionStartedAt \|\| null/);
assert.match(api, /paymentAmountCents/);

assert.match(support, /const APP_VERSION = '1\.1\.0'/);
assert.match(support, /const welcomeEmail = payload\.welcomeEmail === true/);
assert.match(support, /Bem-vindo ao Surveyor/);
assert.match(support, /Senha inicial:/);
assert.match(support, /A senha acima foi enviada somente nesta mensagem de criação da conta/);
assert.match(support, /Acessar o Surveyor/);

console.log('OK v21.9.420: cadastro guiado, vigência automática, comprovante assinado e e-mail de boas-vindas validados.');
