import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const assets = fs.readFileSync('assets/js/core/document-assets.js','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const memorial = fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const memorialHtml = fs.readFileSync('memorial/index.html','utf8');
const memorialCss = fs.readFileSync('assets/css/features/memorial/signature.css','utf8').replace(/!important/g,'');

assert.match(assets, /getDocumentCustomization\(\{ forceRefresh, noCache: forceRefresh \}\)/, 'assinatura central deve consultar a mesma personalização de conta usada pelo Memorial');
assert.match(editor, /signatureX/, 'editor técnico deve persistir posição horizontal da assinatura');
assert.match(editor, /signatureY/, 'editor técnico deve persistir posição vertical da assinatura');
assert.match(editor, /function attachStableSignatureDrag\(/, 'assinatura técnica deve ser arrastável diretamente no SVG');
assert.match(editor, /reset-signature-position/, 'editor técnico deve permitir restaurar a posição da assinatura');
assert.match(editor, /arraste-a diretamente sobre a prancha/, 'painel de assinatura deve explicar a interação direta');
assert.match(bridge, /signatureX/, 'ponte documental deve normalizar posição da assinatura');
assert.match(mapas, /function documentSignatureMarkup\(/, 'mapas e pranchas devem compartilhar um único renderizador da assinatura');
assert.ok((mapas.match(/documentSignatureMarkup\(\{/g) || []).length >= 4, 'assinatura deve existir nos layouts de croqui e prancha suportados');
assert.match(mapas, /signatureX/, 'geração deve reaplicar a posição persistida da assinatura');
assert.ok(!memorialHtml.includes('memorialEditDialog'), 'modal simples antigo do Memorial deve ser removido');
assert.match(memorial, /function ensureMemorialEditorModal\(/, 'Memorial deve usar editor visual em tela própria');
assert.match(memorial, /memorialSignatureOverlay/, 'editor do Memorial deve possuir assinatura móvel sobre a página');
assert.match(memorial, /signaturePageIndex/, 'posição da assinatura no Memorial deve persistir por página');
assert.match(memorial, /placedSignatureData/, 'PDF final do Memorial deve aplicar a assinatura na posição escolhida');
assert.match(memorialCss, /\.memorial-sign-workspace/, 'editor visual do Memorial deve possuir workspace de página');

console.log('PASS signature-visual-editor: assinatura unificada, móvel e persistente em Memorial, Mapas e Pranchas.');
