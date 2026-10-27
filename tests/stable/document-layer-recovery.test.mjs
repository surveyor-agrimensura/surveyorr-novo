import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=(p)=>fs.readFileSync(p,'utf8');

for(const page of ['memorial','mapas','pranchas','planialtimetria','perimetros','ambiental','confrontacao','ods','car']){
  const html=read(`${page}/index.html`);
  assert.ok(html.includes('/assets/js/core/document-assets.js'),`${page} deve carregar document-assets.js`);
  const theme=html.indexOf('/assets/js/core/document-theme.js');
  const assets=html.indexOf('/assets/js/core/document-assets.js');
  assert.ok(theme>=0 && assets>theme,`${page}: document-assets deve carregar depois do tema`);
}

const pranchas=read('pranchas/index.html');
const appIndex=pranchas.indexOf('/assets/js/features/mapas/app.js');
for(const mod of ['dimensions.js','confrontantes.js','vertices.js']){
  const i=pranchas.indexOf(`/assets/js/features/mapas/${mod}`);
  assert.ok(i>=0 && i<appIndex,`Pranchas deve carregar ${mod} antes de mapas/app.js`);
}

const docAssets=read('assets/js/core/document-assets.js');
assert.ok(docAssets.includes('loadCustomization'),'assets documentais devem atualizar personalização');
assert.ok(docAssets.includes('publicProjectAccess'),'assets documentais devem centralizar link público/QR');
assert.ok(docAssets.includes('resolveLogo'),'assets documentais devem incorporar logo');

const memorial=read('assets/js/features/memorial/app.js');
assert.ok(memorial.includes('loadGenerationCustomization') && memorial.includes('SurveyorDocumentAssets.loadCustomization({ forceRefresh:false, maxAgeMs:60_000 })'),'Memorial deve usar personalização documental centralizada sem bloquear a geração em refresh remoto duplicado');
assert.ok(memorial.includes('SurveyorDocumentAssets.resolveLogo'),'Memorial deve incorporar logo antes de renderizar');
assert.ok(memorial.includes('SurveyorDocumentAssets.publicProjectAccess'),'Memorial deve usar QR/link público centralizado');

const mapas=read('assets/js/features/mapas/app.js');
const technicalEditor=read('assets/js/core/technical-document-editor.js');
assert.ok(mapas.includes('documentAssets.loadCustomization({ forceRefresh: true })'),'Mapas/Pranchas devem atualizar personalização na geração');
assert.ok(mapas.includes('documentAssets.publicProjectAccess'),'Mapas/Pranchas devem gerar QR pelo módulo documental');
assert.ok(mapas.includes('documentAssets.resolveLogo'),'Mapas/Pranchas devem incorporar a logo');
assert.ok(technicalEditor.includes('async function rasterize(svg)'),'Editor técnico formal deve rasterizar o fundo da prancha em alta definição');
assert.ok(technicalEditor.includes('sv-confrontante-editor-overlay'),'Editor técnico formal deve manter a camada SVG editável');
assert.ok(technicalEditor.includes('EDITABLE_OVERLAY_SELECTOR') && technicalEditor.includes('[data-document-signature]') && technicalEditor.includes('editableOverlayRoots(background).forEach((node) => node.remove())'),'Fundo do editor não deve duplicar os elementos técnicos editáveis e a assinatura precisa permanecer na camada editável');
assert.ok(!mapas.includes('lastSvg = new XMLSerializer().serializeToString(svg)'),'Editor não pode substituir a prancha completa pela camada de edição');
const mapa=read('assets/js/features/mapa/app.js');
assert.ok(mapa.includes('updateWhenZooming: false'),'Limites cadastrais devem preservar a grade durante a animação de zoom para evitar sumiços');
assert.ok(mapa.includes('keepBuffer: propertyBoundary ? 5 : 6'),'Limites cadastrais devem manter buffer maior para preservar continuidade em pan/zoom');
assert.ok(mapa.includes('setBoundaryStyle'),'Limites de propriedade devem aceitar estilo sem recriar a camada');
assert.ok(mapa.includes('showColor: false'),'camadas oficiais devem preservar a cor publicada pela fonte');
assert.ok(mapa.includes('showWeight: false'),'camadas oficiais não devem permitir alterar espessura');
assert.ok(mapa.includes("GEOBAHIA_BOUNDARY_UI_COLOR = '#D0D000'"),'GeoBahia deve expor referência visual fina/amarelo-oliva no controle');
assert.ok(mapa.includes('clientRasterRecolor: false'),'CEFIR/INEMA deve usar diretamente a simbologia oficial do GeoBahia');
assert.ok(mapa.includes("styleMode: 'official'"),'limites oficiais devem permanecer no modo oficial, com apenas opacidade editável');

const auth=read('assets/js/core/auth.js');
const api=read('functions/surveyor-api/src/main.js');
for(const src of [auth,api]){
  assert.ok(src.includes("item.color") || src.includes("pref.color"),'preferências de camada devem aceitar cor');
  assert.ok(src.includes('weight'),'preferências de camada devem aceitar espessura');
  assert.ok(src.includes('styleMode'),'preferências de camada devem preservar modo oficial/custom');
  assert.ok(src.includes('propertyStyleRevision'),'preferências devem preservar a revisão do estilo cadastral');
  assert.ok(src.includes('userStyled'),'preferências devem registrar personalização explícita do usuário');
}

const docs=read('assets/js/core/documents.js');
assert.ok(docs.includes('generationErrorText'),'workspace documental deve detectar erro de geração');
assert.ok(docs.includes("finishGeneration();"),'erro documental deve encerrar overlay de geração');

console.log('PASS document-layer-recovery: documentos, QR/logo, prancha e Limites de Propriedade protegidos contra regressão.');
