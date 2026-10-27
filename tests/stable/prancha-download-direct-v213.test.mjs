import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const mapApp = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const downloads = fs.readFileSync('assets/js/core/downloads.js','utf8');
const onboarding = fs.readFileSync('assets/js/core/onboarding.js','utf8');

assert.match(documents,/if \(page === 'pranchas\.html'\) return;[\s\S]*const generate = \$\(cfg\.generate\);/,'Pranchas não deve entrar no consentimento de geração.');
assert.match(documents,/if \(page === 'pranchas\.html'\) \{ hideGenerationOverlay\(\); downloadAction\?\.setReady\?\.\(true\); return; \}/,'Pranchas não deve usar watcher/loading de geração para baixar.');
assert.match(documents,/hideManualGenerate:true, noFinalStep:true/,'Pranchas não deve possuir etapa final de download.');
assert.match(documents,/function makePranchaFooterDownload\(\)/,'Download deve estar disponível no rodapé da bancada.');
assert.match(mapApp,/window\.SurveyorPranchaExportSource = \(\) => currentPranchaExportSvg\(\)/,'App deve expor a cena vetorial corrente para exportação.');
assert.match(mapApp,/technicalDocumentEditor\?\.commitPreviewState\?\.\(\)/,'Cena atual deve ser consolidada antes do download.');
assert.match(downloads,/window\.SurveyorPranchaExportSource/,'Exportadores devem consumir a cena atual da prancha.');
assert.doesNotMatch(downloads,/page === 'pranchas\.html' \? 'Gere a prancha primeiro\.'/,'Pranchas não deve pedir geração manual antes de baixar.');
assert.match(onboarding,/Use o menu inferior para baixar PDF, SVG ou Word diretamente da cena documental atual\./,'Onboarding deve refletir o fluxo direto pelo rodapé.');

console.log('PASS prancha-download-direct-v213: menu inferior exporta a cena atual sem geração intermediária.');
