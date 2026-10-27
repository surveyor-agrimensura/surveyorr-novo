import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const memorial = read('assets/js/features/memorial/app.js');
const suite = read('assets/js/core/suite.js');
const uiRepair = read('assets/js/core/ui.js');
const customization = read('assets/js/features/customizacao/app.js');
const preference = read('assets/js/features/memorial/preference.js');
const auth = read('assets/js/core/auth.js');
const api = read('functions/surveyor-api/src/main.js');
const memorialHtml = read('memorial/index.html');

assert.match(memorial, /const auth = window\.SurveyorAuth \|\| window\.GeoRuralAuth;/, 'Memorial precisa declarar o cliente de autenticação.');
assert.match(memorial, /SurveyorMemorialPreference/, 'Memorial deve usar o resolvedor centralizado de preferência.');
assert.match(memorial, /currentMemorialTemplateId=validTemplateId\(select\?\.value\)\?select\.value:'standard';/, 'Geração deve ler o seletor atual.');
assert.match(memorial, /const immediate=readLocalTemplatePreference\(\);/, 'Carregamento deve preservar a escolha explícita local.');
assert.doesNotMatch(memorial, /const savedTemplateId=await resolveSavedMemorialTemplate\(\{forceRemote:true\}\);/, 'Geração não pode reconsultar e sobrescrever a escolha imediatamente antes de gerar.');
assert.match(memorial, /dataset\.memorialTemplate/, 'Saída precisa marcar o modelo aplicado.');
assert.match(memorial, /definido em Personalização/, 'Status precisa confirmar que o modelo ativo vem da Personalização da conta.');

assert.match(suite, /function initMemorial\(\)\{if\(document\.body\?\.dataset\?\.page==='memorial\.html'\)return;/, 'assets/js/core/suite.js não pode instalar o gerador legado na página Memorial.');
assert.match(suite, /if\(document\.body\?\.dataset\?\.page!=='memorial\.html'\)document\.querySelectorAll\('#printOutput,#printPreview'\)/, 'assets/js/core/suite.js não pode sobrescrever a impressão dedicada.');
assert.match(uiRepair, /if \(page === 'memorial\.html'\) return;/, 'UI Repair não pode substituir o handler de impressão do Memorial.');
assert.match(customization, /preferenceApi\(\)\?\.resolve\?\.\(value\)/, 'Personalização deve resolver a preferência pelo módulo centralizado.');
assert.match(preference, /if \(local\.id && local\.explicit\) return/, 'A escolha explícita local deve prevalecer sobre divergência remota.');
assert.match(auth, /Object\.keys\(options\)\.length/, 'Espelho local precisa considerar personalização apenas por opções.');
assert.match(api, /findCustomizationRowsForUser/, 'API deve localizar todas as linhas do usuário.');
assert.match(api, /cleanupDuplicateCustomizationRows/, 'API deve remover duplicatas antigas.');
assert.match(api, /APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/, 'Function precisa anunciar a versão 2.22.8.');
assert.match(memorialHtml, /memorial-preference-v21\.9\.398/, 'Página precisa carregar o resolvedor centralizado sem cache antigo.');
assert.match(memorialHtml, /id="memorialTemplateStatus"/, 'Página deve mostrar o modelo ativo para diagnóstico.');

const requiredAssets = ['01_Dourado','02_Ciano','03_Verde','04_Amarelo'];
for (const stem of requiredAssets) {
  for (const suffix of ['header.png','footer.png']) {
    assert.ok(fs.existsSync(path.join(root, 'assets/memorial-template-backgrounds', `${stem}-${suffix}`)), `Falta ${stem}-${suffix}`);
  }
  assert.ok(fs.existsSync(path.join(root, 'assets/memorial-templates', `${stem}.docx`)), `Falta template ${stem}.docx`);
}

assert.equal(fs.readdirSync(path.join(root, 'assets/memorial-templates')).filter((name)=>name.endsWith('.docx')).length,4,'A biblioteca deve conter somente quatro modelos personalizados.');
console.log('Auditoria v21.9.405 aprovada: quatro modelos novos, escolha explícita, geração, handlers e assets sem conflitos conhecidos.');
