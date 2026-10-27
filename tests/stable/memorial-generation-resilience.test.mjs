import fs from 'node:fs';
import assert from 'node:assert/strict';

const memorial = fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const documents = fs.readFileSync('assets/js/core/documents.js','utf8');

assert.ok(memorial.includes('async function loadGenerationCustomization()'), 'Memorial deve ter uma única etapa resiliente de personalização para a geração.');
assert.ok(memorial.includes("SurveyorDocumentAssets.loadCustomization({ forceRefresh:false, maxAgeMs:60_000 })"), 'Geração não deve forçar múltiplos refreshes remotos de personalização.');
assert.ok(memorial.includes("boundedStep('Inicialização do tema documental'"), 'Tema documental deve ter limite de espera.');
assert.ok(memorial.includes("boundedStep('Carregamento do projeto'"), 'Projeto deve ter limite de espera.');
assert.ok(memorial.includes("window.GeoRuralProjects.get(id,false)"), 'Memorial deve priorizar o projeto completo já carregado em cache.');
assert.ok(memorial.includes("boundedStep('Montagem do modelo padrão'"), 'Modelo padrão deve ter limite de processamento.');
assert.ok(memorial.includes("boundedStep('Montagem do modelo personalizado'"), 'Modelo personalizado deve ter limite de processamento.');
assert.ok(memorial.includes("boundedStep('Carregamento das fontes do memorial'"), 'Fontes não podem manter a geração presa indefinidamente.');
assert.ok(memorial.includes('previewError(error);'), 'Qualquer falha de geração deve ser materializada na área de pré-visualização.');
assert.ok(memorial.includes("surveyor:document-generation-finished"), 'Memorial deve sinalizar o fim da geração inclusive em erro.');
assert.ok(documents.includes("window.addEventListener('surveyor:document-generation-finished'"), 'Workspace documental deve encerrar o overlay quando o gerador sinaliza conclusão.');
assert.ok(documents.includes("attributeFilter:['aria-busy','disabled']"), 'Overlay também deve acompanhar o estado real do botão de geração.');

console.log('PASS memorial-generation-resilience: geração do Memorial não depende de refresh remoto duplicado e não deixa loading preso.');
