import fs from 'node:fs';
import assert from 'node:assert/strict';
const custom=fs.readFileSync('customizacao/index.html','utf8');
const customJs=fs.readFileSync('assets/js/features/customizacao/app.js','utf8');
const memorial=fs.readFileSync('memorial/index.html','utf8');
const memorialJs=fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const api=fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
assert(!custom.includes('Adicionar modelo personalizado'),'Importação própria ainda aparece.');
assert(custom.includes('memorial-template-gallery'),'Galeria de modelos ausente.');
assert(customJs.includes('memorialTemplateId'),'Seleção não é salva nas opções.');
assert(memorial.includes('memorialTemplateSelect'),'Seletor no gerador ausente.');
assert(memorialJs.includes('SurveyorMemorialTemplates.createDocx'),'DOCX personalizado não integrado.');
assert(api.includes("const APP_VERSION = '2.23.1-map-ux-21.11.2'"),'Function com versão incorreta.');
for(const name of ['01_Dourado','02_Ciano','03_Verde','04_Amarelo']){
 assert(fs.existsSync(`assets/memorial-templates/${name}.docx`),`Template ausente: ${name}`);
 assert(fs.existsSync(`assets/memorial-template-previews/${name}.png`),`Prévia ausente: ${name}`);
}
assert.equal(fs.readdirSync('assets/memorial-templates').filter((name)=>name.endsWith('.docx')).length,4,'Devem existir somente quatro templates personalizados.');
console.log('v21.9.405: quatro templates personalizados oficiais, seleção persistente e geração DOCX aprovados.');
