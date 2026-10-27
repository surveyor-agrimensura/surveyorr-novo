const fs = require('fs');
const assert = require('assert');

const read = (p) => fs.readFileSync(p, 'utf8');
const maps = read('assets/js/features/mapas/app.js');
const preview = read('assets/js/core/pdf-preview.js');
const plani = read('assets/js/features/planialtimetria/app.js');
const peri = read('assets/js/features/perimetros/app.js');
const memo = read('assets/js/features/memorial/app.js');
const workspace = read('assets/css/core/documents.css');

assert(maps.includes('generationToken += 1;'), 'Troca de projeto precisa invalidar a geração anterior.');
assert(maps.includes("SurveyorPdfPreview?.reset?.('mapPreview')"), 'Troca de projeto precisa limpar o estado do PDF anterior.');
assert(preview.includes('_surveyorPdfRequestId'), 'Preview precisa versionar requisições concorrentes.');
assert(preview.includes('superseded: true'), 'Renderização antiga precisa ser descartada quando uma nova a substitui.');
assert(preview.includes('reset(target)'), 'Preview precisa oferecer reset explícito.');

for (const [name, src] of [['mapas', maps], ['planialtimetria', plani], ['perimetros', peri], ['memorial', memo]]) {
  assert(!/r="31" fill="#ffffff" stroke="#111827"/.test(src), `${name}: rosa dos ventos não pode manter disco branco.`);
  assert(/r="31" fill="none" stroke="#111827"/.test(src), `${name}: rosa dos ventos precisa ter fundo transparente.`);
}

assert(plani.includes('function svgTechnicalLabel'), 'Planialtimetria precisa usar rótulo técnico sem caixa.');
assert(!plani.includes('function svgLabelWithBackground'), 'Helper antigo com fundo branco deve ser removido da planialtimetria.');
assert(plani.includes('fontSize: 7.2'), 'Cotas altimétricas devem ser menores.');
assert(plani.includes('fontSize: 4.8'), 'Rótulos de vértices da planialtimetria devem ser compactos.');

assert(peri.includes('function svgTechnicalLabel'), 'Perímetros precisam usar rótulo técnico sem caixa.');
assert(!peri.includes('function svgLabelWithBackground'), 'Helper antigo com fundo branco deve ser removido de perímetros.');
assert(peri.includes('const offset = 13;'), 'Rótulos de azimute/distância devem ficar afastados da linha.');
assert(peri.includes('fontSize: 6.6'), 'Rótulos de azimute/distância devem ser menores.');
assert(!peri.includes('fill="#ffffff" fill-opacity="0.96" stroke="#64748b"'), 'Caixa branca antiga de rótulos deve ter sido removida.');

assert(workspace.includes('grid-template-columns:minmax(360px,410px) minmax(0,1fr);'), 'Coluna de configuração deve ganhar largura útil.');
assert(workspace.includes('gap:15px 18px!important;'), 'Campos devem ter espaçamento real entre linhas/colunas.');
assert(!workspace.includes('gap:11px 14px!important;'), 'Regra antiga apertada não deve continuar ativa.');

console.log('PASS R20: geração repetida, preview concorrente, rosa transparente, rótulos técnicos e espaçamento de formulários validados.');
