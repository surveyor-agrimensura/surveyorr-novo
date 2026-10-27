import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(app,/let lastSvgProjectId = '';/,'Prévia deve registrar explicitamente a qual projeto o SVG pertence.');
assert.match(app,/let editorSessionProjectId = '';/,'Editor inline deve ter identidade de projeto própria durante a sessão.');
assert.match(app,/getSvg: \(\) => lastSvgProjectId === String\(select\?\.value \|\| ''\) \? lastSvg : ''/,'Editor não pode reutilizar SVG pertencente ao projeto anterior.');
assert.match(app,/if \(!editorSessionProjectId \|\| editorSessionProjectId !== currentProjectId\) return;/,'Callback do editor antigo não pode gravar sobre o novo projeto selecionado.');
assert.match(app,/pranchaLiveQueuedProjectSwitch = pranchaLiveQueuedProjectSwitch \|\| options\.projectSwitch === true/,'Fila de atualização deve preservar a informação de troca de projeto.');
assert.match(app,/refreshPranchaLivePreview\(\{projectSwitch:queuedProjectSwitch,projectId:queuedProjectId\}\)/,'Atualização enfileirada deve manter o id do projeto e o modo de troca.');
assert.match(app,/closeConfrontanteEditor\(\);[\s\S]*lastSvg=''[\s\S]*lastNativeDocument=null[\s\S]*refreshPranchaLivePreview\(\{projectSwitch:true,projectId:selectedProjectId\}\)/,'Troca de projeto deve desmontar a sessão anterior antes de gerar a nova cena.');
assert.match(app,/lastSvgProjectId = selectedId;/,'SVG novo deve ser marcado com o id capturado no início da geração.');

console.log('PASS troca de projeto: editor, SVG e fila ao vivo permanecem isolados pelo id selecionado.');
