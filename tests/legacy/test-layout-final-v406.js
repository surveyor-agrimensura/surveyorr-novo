import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(name)=>fs.readFileSync(name,'utf8');
const memorial=read('assets/js/features/memorial/app.js');
const downloads=read('assets/js/core/downloads.js');
const memorialHtml=read('memorial/index.html');
const odsHtml=read('ods/index.html');

assert.match(memorial,/data-memorial-pdf-render-css/,'O PDF do Memorial precisa injetar o CSS completo no host de renderização.');
assert.match(memorial,/Página \$\{index\+1\} de \$\{fixedPages\.length\}/,'O Memorial precisa numerar as páginas no PDF.');
assert.match(memorial,/--custom-header-height/,'O Memorial precisa respeitar a altura de cabeçalho de cada DOCX.');
assert.match(memorial,/--custom-footer-height/,'O Memorial precisa respeitar a altura de rodapé de cada DOCX.');
assert.match(downloads,/function isolatedSheetPdf\(\)/,'A planilha precisa de PDF isolado.');
assert.match(downloads,/@page\{size:A4 landscape/,'O PDF da planilha deve ser A4 paisagem.');
assert.doesNotMatch(downloads,/\$\('sheetDownloadPdf'\)\?\.addEventListener\('click', \(\) => window\.print\(\)\)/,'A planilha não pode imprimir a interface inteira.');
assert.match(memorialHtml,/fix=21\.9\.407-continuacao-rodape-word/,'O navegador precisa carregar a correção nova do Memorial.');
assert.match(odsHtml,/21\.9\.406-planilha-pdf/,'O navegador precisa carregar o PDF novo da planilha.');

assert.doesNotMatch(memorial,/DESCRIÇÃO — CONTINUAÇÃO/,'As páginas seguintes não podem exibir o título redundante DESCRIÇÃO — CONTINUAÇÃO.');
assert.match(memorial,/custom-docx-description-title-continuation/,'A continuação deve manter apenas o título DESCRIÇÃO no posicionamento correto.');
assert.match(memorial,/custom-footer-line-phones/,'O rodapé precisa usar a estrutura do Word para WhatsApp e telefone.');
assert.match(memorial,/customContactPhone/,'O rodapé não pode aceitar texto inválido como número de WhatsApp ou telefone.');
assert.match(memorial,/Dados de contato da empresa/,'A área de dados deve ser um bloco próprio do rodapé.');

for(const name of ['01_Dourado','02_Ciano','03_Verde','04_Amarelo']){
  const file=`assets/memorial-template-backgrounds/${name}-header.png`;
  const buf=fs.readFileSync(file);
  const width=buf.readUInt32BE(16);
  assert.ok(width>=1000 && width<1500,`${file} deve vir da arte original do DOCX, não de página renderizada com placeholders.`);
}
console.log('OK v21.9.407: continuação sem título redundante e rodapé dos dados no padrão Word.');
