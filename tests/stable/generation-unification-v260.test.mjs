import fs from 'node:fs';
import assert from 'node:assert/strict';

const memorial=fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const bridge=fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const mapas=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const vertices=fs.readFileSync('assets/js/features/mapas/vertices.js','utf8');
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.ok(!memorial.includes('data-memorial-personalization-tool=\"appearance\"'),'Memorial não deve recriar aba Aparência vazia.');
assert.ok(memorial.includes('memorialUseImportedSignature')&&memorial.includes('memorialImportSignature')&&memorial.includes('Assinatura da conta'),'Memorial deve usar o cartão unificado de assinatura com conta e importação externa.');
assert.ok(memorial.includes("['memMapZoom','memMapBackground','memShowConfrontantes','memIncludeMap']"),'Controles cartográficos do Memorial devem atualizar a prévia viva.');
assert.ok(memorial.includes('showLoader:true'),'Trocas cartográficas do Memorial devem usar o loading unificado durante a reconstrução.');
assert.ok(!bridge.includes('class=\"sv-area-name-hitbox\"'),'Renderer compartilhado não deve imprimir hitbox/caixa em Nome no mapa.');
assert.ok(!mapas.includes('class=\"sv-area-name-hitbox\" x=\"-120\"'),'Fallback de Mapas não deve imprimir caixa em Nome no mapa.');
assert.ok(editor.includes("hit.setAttribute('class','sv-area-name-hitbox')"),'Hitbox deve existir somente no editor interativo.');
assert.ok(vertices.includes('* 2.15'),'Vértices devem usar escala equilibrada em documentos densos.');
assert.ok(editor.includes('zoomBaseWidth = availableWidth')&&editor.includes('const fitScale = Math.min(1, availableHeight / Math.max(1, zoomBaseWidth / Math.max(.01, aspect)))'),'Zoom deve usar 100% como largura útil e calcular Ajustar à tela por escala, sem transformar margem lateral em base do zoom.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css não pode usar !important.');
console.log('PASS V260: geração unificada, nome sem caixa, assinatura padrão e zoom estável.');
