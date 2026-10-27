import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = fs.readFileSync(new URL('../../assets/js/core/documents.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../assets/css/core/documents.css', import.meta.url), 'utf8');

assert.match(docs, /'loteamentos-reurb\.html'[\s\S]*?previewTitle:'Pré-visualização \/ croqui'[\s\S]*?compactModel:true/, 'Loteamentos deve usar a bancada compacta com croqui vivo à direita.');
assert.match(docs, /title:'Projeto'[\s\S]*?title:'Feições e lotes'[\s\S]*?title:'Personalização'/, 'Loteamentos deve organizar os controles em Projeto, Feições e lotes e Personalização.');
assert.ok(docs.includes("const panels = $$('.main > section.panel');"), 'Loteamentos deve capturar todos os painéis sem desmontar o workspace.');
assert.ok(!docs.includes("const panels = $('.main > section.panel');"), 'Loteamentos não pode voltar a capturar apenas um painel.');
assert.ok(docs.includes("const lotsBlock = lastPanel?.children?.[0] || null;"), 'Loteamentos deve separar o bloco de lotes da prévia.');
assert.ok(docs.includes("const previewBlock = lastPanel?.children?.[1] || null;"), 'Loteamentos deve separar controles da área de croqui.');
assert.ok(docs.includes("lotsStep.appendChild(host);"), 'Tabela e comandos dos lotes devem ficar na coluna esquerda.');
assert.ok(docs.includes("personalizationStep.appendChild(controls);"), 'Controles do croqui devem integrar a etapa Personalização, em vez de uma etapa final separada.');
assert.ok(docs.includes("rightBody.appendChild(preview);"), 'A prévia deve ser anexada diretamente à coluna direita.');
assert.match(css, /body\[data-page="loteamentos-reurb\.html"\][\s\S]*?> \.sv-doc-preview-body > :not\(#lotPreview\)[\s\S]*?display:none/, 'A coluna direita de Loteamentos deve ocultar qualquer elemento que não seja a prévia.');
assert.match(css, /#lotPreview\{[\s\S]*?flex:1 1 100%[\s\S]*?height:100%/, 'A prévia deve ocupar a área disponível da coluna direita.');
console.log('PASS V50: Loteamentos/REURB consolidado no modelo Projeto + Feições + Personalização, com direita exclusiva para croqui.');
