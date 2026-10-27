import fs from 'node:fs';
import assert from 'node:assert/strict';

const downloads = fs.readFileSync('assets/js/core/downloads.js', 'utf8');
const mapsApp = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const pranchasHtml = fs.readFileSync('pranchas/index.html', 'utf8');
const mapasHtml = fs.readFileSync('mapas/index.html', 'utf8');

assert.match(downloads, /async function isolatedMapPdf\(\)/, 'Exportação PDF de mapa/prancha deve usar a rotina dedicada de PDF.');
assert.match(downloads, /page === 'mapas\.html' \|\| page === 'pranchas\.html'\) replaceButtonAction\('printPreviewV19', isolatedMapPdf\)/, 'Mapas e Pranchas devem usar a mesma ação oficial de PDF.');
assert.match(downloads, /const filename = `\$\{slug\(projectName\)\}-\$\{suffix\}\.pdf`;/, 'Nome do arquivo deve corresponder ao projeto e ao tipo do documento.');
assert.match(downloads, /download\(filename, state\.blob, 'application\/pdf'\)/, 'PDF deve baixar o Blob real da pré-visualização, não o HTML da página.');
assert.match(downloads, /SurveyorPdfPreview\.renderHtml\(preview, sourceHtml,[\s\S]*orientation: 'landscape'/, 'Se o Blob ainda não existir, a rotina deve gerar o PDF oficial a partir da prancha antes do download.');
assert.doesNotMatch(mapsApp, /printPreviewV19['"]?\)?\.addEventListener\('click',[\s\S]{0,120}window\.print\(\)/, 'O módulo de mapas não deve mais controlar o PDF com window.print().');
assert.match(pranchasHtml, /data-click-target="printPreviewV19">Baixar PDF<\/button>/, 'Menu da Prancha deve indicar download real de PDF.');
assert.match(mapasHtml, /data-click-target="printPreviewV19">Baixar PDF<\/button>/, 'Menu de Mapas deve indicar download real de PDF.');
assert.match(pranchasHtml, /data-click-target="downloadSvgV19">SVG vetorial<\/button>/, 'Exportação SVG da Prancha deve permanecer disponível.');
assert.match(pranchasHtml, /data-click-target="downloadMapWordV197">Word editável<\/button>/, 'Exportação Word da Prancha deve permanecer disponível.');

console.log('PASS prancha-pdf-download: PDF baixa o documento técnico real e preserva SVG/Word.');
