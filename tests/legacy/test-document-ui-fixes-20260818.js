import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

const maps = read('assets/js/features/mapas/app.js');
must(maps.includes("const publicShort = publicUrl || custom.websiteUrl || '';"), 'Prancha: link público real não está ligado ao conteúdo da prancha.');
must(maps.includes('Link público:'), 'Prancha: rótulo do link público não foi incluído.');
must(!maps.includes("const publicShort = publicUrl ? 'Acesse pelo QR Code'"), 'Prancha: texto antigo do QR ainda substitui a URL real.');

const planialt = read('assets/js/features/planialtimetria/app.js');
must(planialt.includes('function contourGroupLabel(group, polygon)'), 'Planialtimetria: rotina de rótulo por curva de nível ausente.');
must(planialt.includes('planialt-contour-labels'), 'Planialtimetria: rótulos não foram separados do clip das curvas.');
must(planialt.includes('`${num(group.level, 1)} m`'), 'Planialtimetria: altitude não está identificada em metros.');

const perimetros = read('assets/js/features/perimetros/app.js');
must(perimetros.includes("orientation: 'landscape'"), 'Azimute: preview não está em orientação paisagem.');
must(perimetros.includes('vectorSvg: true'), 'Azimute: preview vetorial não está ativado.');
must(perimetros.includes('`Az ${num(item.az, 2)}° • ${num(item.dist, 1)} m`'), 'Azimute: rótulo técnico azimute + distância ausente.');
must(perimetros.includes('selectedSegments.size >= 12'), 'Azimute: proteção contra excesso de rótulos ausente.');

const pdfPreview = read('assets/js/core/pdf-preview.js');
must(pdfPreview.includes("'ambiental.html': { targets: [{ id: 'environmentOutput'"), 'Ambiental: página não foi cadastrada no preview PDF.');

const suite = read('assets/js/core/suite.js');
must(suite.includes("SurveyorPdfPreview?.getState?.('environmentOutput')"), 'Ambiental: impressão não usa o PDF renderizado.');
must(suite.includes('SurveyorPdfPreview?.renderHtml'), 'Ambiental: geração não chama o renderizador de PDF.');

const ambiental = read('ambiental/index.html');
must(ambiental.includes('html2canvas/1.4.1/html2canvas.min.js'), 'Ambiental: html2canvas ausente.');
must(ambiental.includes('jspdf/2.5.1/jspdf.umd.min.js'), 'Ambiental: jsPDF ausente.');
must(ambiental.includes('pdf-preview.js?v=21.11.5-chrome-native-all-previews-0819'), 'Ambiental: visualizador PDF nativo do Chrome ausente/desatualizado.');

const css = read('assets/css/core/ui.css');
must(css.includes("body[data-page=\"nuvem.html\"] .workspace-page-head>div:first-child:before{background-image:url('/assets/module-icons/projetos.svg')}"), 'Projetos: cabeçalho ainda não usa o novo símbolo.');
must(css.includes('2026-08-18 — correção final da Central de Personalização'), 'Personalização: bloco de correção final ausente.');
must(css.includes('body[data-page="customizacao.html"] .panel.customization-layout{\n  display:block!important;'), 'Personalização: layout ainda pode ser forçado para duas colunas.');
must(css.includes('grid-template-columns:repeat(6,minmax(0,1fr))!important;'), 'Personalização: grade desktop corrigida ausente.');

const projectIcon = path.join(root, 'assets/module-icons/projetos.svg');
must(fs.existsSync(projectIcon), 'Projetos: novo ícone projetos.svg não existe.');
must(read('assets/module-icons/projetos.svg').includes('#1463E8'), 'Projetos: ícone novo não segue a identidade visual atual.');

console.log('OK: correções 18/08 — prancha, planialtimetria, azimute, ambiental, projetos e personalização validadas.');
