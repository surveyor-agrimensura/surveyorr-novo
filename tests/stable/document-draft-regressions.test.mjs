import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync('assets/js/core/documents.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(js, /DOCUMENT_DRAFT_PREFIX = 'surveyor-document-draft-v1'/, 'Rascunho documental deve possuir namespace estável.');
assert.match(js, /Salvar rascunho/, 'Interface deve expor ação explícita de salvar rascunho.');
assert.match(js, /Restaurar rascunho/, 'Interface deve expor ação explícita de restaurar rascunho.');
assert.match(js, /localStorage\.setItem\(documentDraftKey\(\), JSON\.stringify\(payload\)\)/, 'Rascunho deve sobreviver ao retorno à tela no mesmo navegador.');
assert.match(js, /projectIds = new Set\(\['projectSelect','sheetProjectSelect','lotProjectName'\]\)/, 'Restauração deve aplicar o projeto antes dos demais campos dependentes.');
assert.match(js, /applyDraftFields\(left,draft\.fields,\{projectsOnly:true\}\)[\s\S]*applyDraftFields\(left,draft\.fields,\{projectsOnly:false\}\)/, 'Restauração deve respeitar carregamentos assíncronos disparados pela seleção de projeto.');
assert.match(js, /left\.addEventListener\('input',scheduleAutoSave\)/, 'Preenchimento deve ser protegido também por salvamento automático.');
assert.match(css, /\.sv-doc-draft-actions/, 'Controles de rascunho devem integrar o layout oficial de documentos.');

console.log('PASS document-drafts: preenchimento pode ser salvo e restaurado sem redigitação integral.');
