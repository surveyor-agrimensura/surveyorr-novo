import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(app,/const PRANCHA_SVG_CACHE_PREFIX = 'surveyor:prancha-live-svg:v3:';/,'Cache da cena deve ser invalidado para a nova cena editor-ready.');
assert.match(app,/fastPreview: \['mapas\.html','pranchas\.html'\]\.includes\(document\.body\?\.dataset\?\.page \|\| ''\)/,'Carga inicial de Mapas/Croquis deve preparar a mesma cena técnica usada na Personalização.');
assert.match(app,/generateSelected\(\{ silent:true, livePreview:true, fastPreview:true, preferCache:false \}\)/,'Troca efetiva de projeto deve reconstruir a cena editor-ready dentro do único loading da troca.');
assert.match(app,/function ruralReferenceSheet\([\s\S]*liveElementScene = false[\s\S]*renderConfrontantes = liveElementScene \|\| showConfrontantes[\s\S]*renderVertices = liveElementScene \|\| showVertices/,'Modelo rural deve manter elementos editáveis na cena rápida mesmo quando começam ocultos.');
assert.match(app,/const hasPreparedScene = Boolean\(lastSvg && lastSvgProjectId === selectedProjectId\);/,'Reutilizar SVG válido do projeto, sem exigir marca opcional de edição.');
assert.doesNotMatch(app,/mountPranchaPreparingShell\(workspace,\{ noun:'croqui'[\s\S]{0,250}const hasPreparedScene/,'A Personalização não pode abrir um segundo shell de preparação antes de verificar se a cena atual já está pronta.');
assert.match(app,/if \(!hasPreparedScene\) \{[\s\S]*mountPranchaPreparingShell\(workspace,[\s\S]*\}/,'Shell de preparação deve ser reservado exclusivamente ao fallback em que a cena ainda não existe.');
assert.match(app,/if \(!hasPreparedScene\) await generateSelected\(\{ silent:true, inlineOnly:true, fastPreview:true, preferCache:false \}\);/,'Mesmo projeto não deve ser regenerado ao clicar em Próximo; somente ausência da cena permite nova geração.');
assert.match(app,/refreshMapasLivePreview\(\)[\s\S]*generateSelected\(\{silent:true,livePreview:true,fastPreview:true,preferCache:false\}\)/,'Atualizações vivas no Projeto devem preservar a cena editor-ready para a transição sem reload.');

console.log('PASS V263: Projeto → Personalização reutiliza a mesma cena; novo loading/regeneração só ocorre ao trocar projeto ou faltar cena.');
