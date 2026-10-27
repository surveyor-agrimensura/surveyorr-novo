import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../customizacao/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../assets/js/features/customizacao/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/features/customizacao/app.css', import.meta.url), 'utf8');

assert.match(html, /data-target="empresa"/);
assert.match(html, /data-target="tecnico"/);
assert.match(html, /Dados da empresa/);
assert.match(html, /Responsável técnico e assinatura/);
assert.match(html, /data-panel="empresa"[\s\S]*id="companyName"[\s\S]*id="logoFile"/);
assert.match(html, /data-panel="tecnico"[\s\S]*id="responsibleTechnician"[\s\S]*id="professionalRegistry"[\s\S]*id="professionalTitle"[\s\S]*id="signatureFile"/);
assert.doesNotMatch(html, /Dados universais da conta/);
assert.doesNotMatch(html, /universal-identity-banner/);
assert.match(html, /Escolha de layout e modelo visual do memorial/);
assert.match(html, /name="mapCroquiTemplate"/);
assert.match(html, /value="rural-reference"/);
assert.match(js, /croquiTemplateId/);
assert.match(html, /data-status-target="empresa"/);
assert.match(html, /data-status-target="loteamento"/);
assert.match(html, /customizationProgressOutput/);
assert.match(html, /logoPreviewWrap/);
assert.match(html, /customization-hub-v21\.10\.0\.css/);

assert.match(js, /function companyCompletion\(/);
assert.match(js, /function technicianCompletion\(/);
assert.match(js, /function updateCustomizationStatuses\(/);
assert.match(js, /function updateLogoPreview\(/);
assert.match(js, /data-open-target/);
assert.match(js, /empresa: 'Dados da empresa'/);
assert.match(js, /tecnico: 'Responsável técnico e assinatura'/);
assert.match(css, /\.custom-target-card\.is-featured/);
assert.match(css, /\.custom-target-status\.is-complete/);
assert.match(css, /\.logo-preview-wrap/);

assert.match(html, /custom-target-step">Primeiro passo/);
assert.match(html, /custom-target-icon[^>]*>EMP</);
assert.match(html, /custom-target-icon[^>]*>RT</);
assert.doesNotMatch(html, /🏢|✍|▤|⌖|▦|⌁|△|♧|▥/);
assert.match(css, /custom-target-card > \.custom-target-icon/);
assert.match(css, /grid-template-areas:[\s\S]*"icon content"[\s\S]*"icon status"/);
assert.match(css, /custom-target-status::before/);


console.log('OK v21.10.0 REV5: central de personalização, identidade separada, progresso e módulos sem dados universais duplicados.');
