import fs from 'node:fs';
import assert from 'node:assert/strict';

const templates = fs.readFileSync('assets/js/features/memorial/templates.js', 'utf8');
const app = fs.readFileSync('assets/js/features/memorial/app.js', 'utf8');

for (const id of ['dourado','ciano','verde','amarelo']) {
  assert.match(templates, new RegExp(`id:'${id}'[^\\n]+layout:'agroExact'`), `${id} deve continuar usando a mesma família textual do Agro+.`);
}
assert.match(templates, /id:'agro-mais'[^\n]+layout:'agroExact'/, 'Agro+ deve permanecer no renderer agroExact original.');
assert.match(app, /if\(String\(item\.layout\|\|''\)==='agroExact'\) return buildAgroExactDocument/, 'Todos os templates agroExact devem continuar usando um único renderer.');

// A estrutura visual do Agro+ permanece a aprovada, sem reintroduzir o cartão/título da RC128.
assert.match(app, /function agroIdentification\(data\)[\s\S]*?identityHtmlLine\('PROPRIEDADE:',data\.title\)[\s\S]*?identityHtmlLine\('CÓDIGO INCRA:',data\.incra\)[\s\S]*?identityHtmlLine\('Número CIB:',data\.cnib\)/, 'Identificação Agro deve preservar duas colunas, omitir vazios e suportar Número CIB.');
assert.doesNotMatch(app, /<h1 class="agro-title">MEMORIAL DESCRITIVO<\/h1>/, 'Agro+ não deve receber o título/cartão introduzido pela reorganização RC128.');
assert.doesNotMatch(app, /\.agro-ident\{[^}]*background:#f8fafc[^}]*border-radius:2\.5mm/, 'Agro+ não deve receber o cartão cinza introduzido na RC128.');
assert.match(app, /\.agro-flow\{[^}]*left:18mm[^}]*right:18mm[^}]*top:31mm[^}]*bottom:41mm/, 'Área textual Agro deve preservar o enquadramento aprovado anteriormente.');

// O estilo da descrição possui uma única fonte: um parágrafo corrido, plenamente justificado,
// com recuo apenas na primeira linha da primeira página, reproduzindo o padrão documental aprovado.
assert.match(app, /function runningMemorialDescriptionCss\(\)/, 'A formatação da descrição deve possuir uma única fonte de verdade.');
assert.match(app, /\.memorial-running-text\{[^}]*text-align:justify[^}]*text-align-last:left[^}]*white-space:normal[^}]*word-break:normal/, 'Descrição corrida deve usar justificação integral e quebra natural de linhas.');
assert.match(app, /standard-memorial-page-first \.memorial-running-text,\.agro-first \.memorial-running-text,\.memorial-word-template \.memorial-running-text\{text-indent:38mm\}/, 'Primeira linha deve ter o recuo documental do modelo de referência.');
assert.match(app, /standard-memorial-page-continuation \.memorial-running-text,\.agro-continuation \.memorial-running-text\{text-indent:0\}/, 'Continuação entre páginas não deve criar um novo recuo artificial.');
assert.doesNotMatch(app, /standard-running-text|agro-running-text/, 'Seletores paralelos de descrição por modelo não devem voltar.');
assert.match(app, /standard-template-description"><p class="memorial-running-text">/, 'Modelo padrão deve usar a classe textual compartilhada.');
assert.match(app, /agro-description"><p class="memorial-running-text">/, 'Agro+ e modelos coloridos devem usar a mesma classe textual compartilhada.');
assert.match(app, /memorial-paragraph memorial-running-text/, 'Word padrão deve reutilizar a mesma regra de alinhamento.');

// Uma única política de escrita corrida alimenta Agro+, coloridos e modelo padrão.
assert.match(app, /function runningMemorialText\(data=\{\}\)/, 'A escrita corrida deve possuir uma única fonte de texto.');
assert.match(app, /async function paginateRunningWords\(text,renderBody,overflows\)/, 'A paginação por palavras deve ser compartilhada, não duplicada por modelo.');
assert.match(app, /async function paginateStandardNarrative\(theme,data\)[\s\S]*paginateRunningWords\([\s\S]*runningMemorialText\(data\)/, 'Modelo padrão deve reutilizar a mesma escrita corrida do Agro+.');
assert.match(app, /async function buildAgroNarrativePages\(item,theme,data\)[\s\S]*paginateRunningWords\([\s\S]*runningMemorialText\(data\)/, 'Agro+ e coloridos devem reutilizar a política compartilhada.');
assert.match(app, /DESCRIÇÃO:\s*`\$\{narrativeText\} \$\{closingText\}`/, 'DOCX personalizado deve receber a descrição como um único texto corrido.');

// O ajuste de fonte é medido no mesmo CSS que será renderizado e não é duplicado no documento final padrão.
assert.match(app, /standardTemplateBodyOverflows[\s\S]*standardPageCss\(\)\}\$\{memorialFontOverrideCss\(\)\}/, 'Paginação do modelo padrão deve medir a fonte efetiva.');
assert.match(app, /agroBodyOverflows[\s\S]*documentCss\(\)\}\$\{memorialFontOverrideCss\(\)\}/, 'Paginação do Agro+ deve medir a fonte efetiva.');
assert.match(app, /data-standard-memorial-css>\$\{standardPageCss\(\)\}<\/style>/, 'Documento padrão final deve carregar o CSS estrutural uma única vez.');

// O workaround antigo de padding não volta; o construtor da página continua sendo a autoridade estrutural.
assert.match(app, /const fullPageLayout=layout==='docxExact'\|\|layout==='agroExact'/, 'O construtor da página deve continuar controlando o padding dos layouts de página inteira.');
assert.doesNotMatch(app, /\.agro-memorial-document \.custom-template-page-body\{padding:0\}/, 'O override legado de padding não deve voltar.');

const runningFn = app.match(/function runningMemorialText\(data=\{\}\)\{[\s\S]*?\n  \}/)?.[0];
const paginatorFn = app.match(/async function paginateRunningWords\(text,renderBody,overflows\)\{[\s\S]*?\n  \}/)?.[0];
assert.ok(runningFn && paginatorFn, 'Funções compartilhadas de escrita/paginação devem ser extraíveis para teste comportamental.');
const runtime = new Function(`${runningFn};${paginatorFn};return {runningMemorialText,paginateRunningWords};`)();
assert.equal(runtime.runningMemorialText({narrativeText:'Trecho 1.   Trecho 2.',closingText:'Conclusão.'}), 'Trecho 1. Trecho 2. Conclusão.', 'Texto corrido deve normalizar espaços sem alterar a ordem narrativa.');
const paged = await runtime.paginateRunningWords('um dois três quatro cinco seis sete', (chunk,meta)=>({chunk,...meta}), async(body)=>body.chunk.split(/\s+/).filter(Boolean).length>3);
assert.deepEqual(paged.map((page)=>page.text), ['um dois três','quatro cinco seis','sete'], 'Paginação compartilhada deve preservar todas as palavras na ordem sem duplicar ou perder conteúdo.');
assert.equal(paged.at(-1)?.isLast, true, 'Última página deve ser marcada corretamente para data/fechamento do Agro+.');

console.log('PASS memorial-colored-template-layout: descrição corrida e justificada compartilhada por padrão, Agro+ e coloridos.');
