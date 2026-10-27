import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(app, /const liveElementScene = fastPreview && \['mapas\.html','pranchas\.html'\]\.includes\(renderPage\)/, 'A cena rápida deve manter todas as camadas controláveis tanto em Mapas quanto em Pranchas.');
assert.match(app, /const renderGlebaCotas = liveElementScene \|\| showGlebaCotas/, 'Cotas da gleba precisam existir na cena rápida mesmo quando começam desmarcadas.');
assert.match(app, /tagLiveElementNodes\(glebaMarksRaw,'glebaCotas',showGlebaCotas/, 'Cotas da gleba devem receber marcador de visibilidade para ligar e desligar sem regenerar a tela.');
assert.match(app, /const renderVertices = liveElementScene \|\| showVertices/, 'Vértices precisam permanecer disponíveis na cena rápida para alternância imediata.');
assert.match(app, /const renderConfrontantes = liveElementScene \|\| showConfrontantes/, 'Confrontantes precisam permanecer disponíveis na cena rápida para alternância imediata.');
assert.match(app, /function patchDocumentLiveElements\(\) \{[\s\S]*\['pranchas\.html','mapas\.html'\]\.includes\(page\)[\s\S]*editor\?\.patchLiveElements\?\.\(values,\{persist:true\}\)/, 'O patch visual deve atingir explicitamente o editor inline de Mapas e de Pranchas.');
assert.doesNotMatch(app, /function patchDocumentLiveElements\(\) \{[\s\S]{0,180}page !== 'pranchas\.html'/, 'O patch não pode continuar bloqueando Mapas/Croquis.');
assert.match(app, /const hasPreparedScene = Boolean\(lastSvg && lastSvgProjectId === selectedProjectId\)/, 'Personalização de Mapas reutiliza a cena SVG já preparada.');
assert.match(app, /if \(!hasPreparedScene\) await generateSelected\(\{ silent:true, inlineOnly:true, fastPreview:true, preferCache:false \}\)/, 'Regeneração ao entrar na Personalização deve ocorrer somente quando não existir cena preparada para o projeto atual.');
assert.match(app, /if\(page==='pranchas\.html' \|\| page==='mapas\.html'\) patchDocumentLiveElements\(\);/, 'Checkboxes de Elementos devem aplicar o estado instantaneamente nas duas páginas.');

console.log('PASS mapas-inline-elements-live: elementos de Mapa alternam diretamente no editor inline, inclusive cotas da gleba inicialmente ocultas.');
