import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const rendererSource = read('assets/js/features/mapas/confrontantes.js');
const editor = read('assets/js/core/technical-document-editor.js');
const mapas = read('assets/js/features/mapas/app.js');
const memorial = read('assets/js/features/memorial/app.js');
const css = read('assets/css/core/documents.css');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(rendererSource, context);
const engine = context.window.SurveyorDocumentConfrontantes.create({ escape: (value) => String(value ?? '') });
const coords = [[0,0],[4,0],[4,2],[0,2],[0,0]];
const projectA = ([x,y]) => [100 + x * 100, 120 + y * 100];
const mapBoxA = { x:50, y:50, w:700, h:420 };
const feature = { properties: {
  confrontanteTrechos: [{ id:'t1', nome:'TESTE', startVertex:1, endVertex:3 }],
  confrontanteVisualLayout: { version:6, segments:[{
    id:'t1', nome:'TESTE', startVertex:1, endVertex:3,
    vertices:[1,2,3], segmentIndexes:[0,1],
    // N e G propositalmente diferentes: o resultado deve reproduzir N, que é
    // o referencial exato do quadro onde o usuário desenhou.
    extraLines:[{ id:'l1', x1N:.10, y1N:.20, x2N:.30, y2N:.40, x1G:.75, y1G:.75, x2G:.90, y2G:.90 }],
    manualLinesOnly:true, labelScale:.7, labelRotation:0
  }] }
} };
const svg = engine.smartConfrontanteLabels(feature, coords, projectA, mapBoxA, { placement:'boundary', fontSize:10 });
assert.ok(svg.includes('sv-confrontante-manual-guide'), 'Layout v6 deve ser aplicado à geração.');
assert.ok(svg.includes('sv-confrontante-extra-line'), 'Linha desenhada e salva deve reaparecer no SVG final.');
assert.ok(!svg.includes('data-guide-line="1"') && !svg.includes('data-guide-line="2"'), 'Ao existir linha manual, chamadas automáticas antigas não podem reaparecer nem bagunçar o desenho.');
assert.ok(svg.includes('stroke-dasharray="6 4"'), 'Linhas finais devem ser pontilhadas.');
assert.ok(svg.includes('x1="120.00"') && svg.includes('y1="134.00"'), 'Linha deve sair exatamente no ponto normalizado do quadro desenhado (N), sem ser redimensionada pelo bbox da geometria.');
assert.ok(editor.includes('PROJECT_LAYOUT_PREFIX') && editor.includes('readProjectSegments'), 'Editor deve manter uma cópia normalizada WYSIWYG do layout do projeto.');
assert.ok(editor.includes('Desenhar linha') && editor.includes("stage:'technical-line-drag'") && editor.includes('setPointerCapture'), 'Cada comando deve desenhar uma linha técnica por pressionar, arrastar e soltar.');
assert.ok(css.includes('stroke-dasharray:6 4'), 'Editor deve exibir as linhas pontilhadas.');
assert.ok(mapas.includes('GeoRuralProjects?.get?.(id, true)'), 'Prancha/Croqui devem forçar recarga do projeto salvo antes de regenerar.');
assert.ok(mapas.includes("if (!publicUrl) publicUrl = String(p?.publicUrl || p?.shareUrl || '').trim() || await shareUrl(p.id);"), 'Mapas devem recuperar link público/QR por fallback.');
assert.ok(memorial.includes("if(url&&!qr&&qrLib?.toDataURL)"), 'Memorial deve reconstruir QR localmente quando o módulo central não devolver a imagem.');
console.log('PASS V55 WYSIWYG: linhas persistem no quadro exato, não ressurgem automáticas, ficam pontilhadas e QR possui fallback.');
