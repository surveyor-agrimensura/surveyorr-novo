import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(app,/function memorialSourceLabel\(selector,text\)\{[\s\S]*document\.querySelector\(selector\)/,'Personalização do Memorial deve localizar os controles reais por seletor CSS.');
assert.doesNotMatch(app,/function memorialSourceLabel\(selector,text\)\{[\s\S]{0,120}const source=\$\(selector\)/,'Fallback da Personalização não pode tratar #id como ID literal.');
assert.match(app,/includeMapControl&&!includeMapControl\.dataset\.defaultApplied\)\{includeMapControl\.value='1'/,'Mapa deve iniciar incluído no Memorial, podendo ser desligado explicitamente na Personalização.');
assert.match(app,/async function buildAgroExactDocument\(item,theme,data,mapVisual,includeMap\)[\s\S]*if\(includeMap\)[\s\S]*customTemplateMapBody\(mapVisual\)[\s\S]*customTemplatePage\(item,theme,mapBody,'map'\)/,'Modelo Agro+ deve manter página cartográfica vetorial quando o mapa estiver habilitado.');

assert.match(css,/body\.sv-document-compact-model\.sv-document-workspace-page \.sv-doc-workspace:not\(\.sv-beta-personalization-active\)/,'Layout compacto normal não pode sobrescrever a grade da Personalização ativa.');
assert.match(css,/body\.sv-document-inline-personalization\.sv-document-workspace-page \.sv-doc-workspace\.sv-beta-personalization-active\{[\s\S]*grid-template-columns:1fr;[\s\S]*width:100%;height:100%/,'Personalização ativa deve ocupar integralmente a bancada documental.');
assert.match(css,/body\[data-page="memorial\.html"\] \.memorial-live-scroll\{[\s\S]*overflow-y:scroll;/,'Prévia viva do Memorial deve manter um viewport interno com rolagem vertical real.');

const memorialWorkspaceRules = (css.match(/body\.sv-document-inline-personalization \.memorial-sign-modal\.is-inline-personalization \.memorial-sign-workspace\{/g)||[]).length;
const memorialLiveHostRules = (css.match(/body\[data-page="memorial\.html"\]\.sv-document-workspace-page #memorialOutput\.memorial-live-preview-host\{/g)||[]).length;
assert.equal(memorialWorkspaceRules,1,'Workspace inline do Memorial deve ter uma única regra canônica em documents.css.');
assert.equal(memorialLiveHostRules,1,'Prévia viva do Memorial deve ter uma única regra canônica em documents.css.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

assert.match(app,/data-memorial-live-workspace/,'Personalização do Memorial deve reutilizar a prévia viva completa, em vez de comprimir o documento dentro da página de assinatura.');
assert.match(app,/data-memorial-signature-workspace hidden/,'Workspace de assinatura deve ficar isolado e abrir somente na aba Assinatura.');
assert.doesNotMatch(app,/technicalMapEditor/,'Memorial não deve manter editor técnico paralelo para o mapa.');
console.log('PASS memorial-inline-personalization: prévia viva integral, scroll, assinatura isolada e CSS canônico validados.');
