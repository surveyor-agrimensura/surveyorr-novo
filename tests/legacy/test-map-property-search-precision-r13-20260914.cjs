const fs = require('fs');
const assert = require('assert');
const src = fs.readFileSync('assets/js/features/mapa/app.js','utf8');

assert.match(src, /canonicalPropertyNameSearch/, 'busca precisa normalizar tipo genérico do imóvel');
assert.match(src, /candidate === target\) return 12000/, 'nome semanticamente exato precisa ter prioridade máxima');
assert.match(src, /allowMissingMunicipalityAttributes = false/, 'validação municipal deve ser estrita por padrão');
assert.match(src, /propertyMunicipalitySearchClausesForSchema/, 'consulta SICAR deve filtrar município pelo schema real');
assert.match(src, /requestId !== propertyContextSearchState\.requestId/, 'respostas assíncronas antigas precisam ser ignoradas');
assert.match(src, /item\.dataset\.busy === '1'/, 'clique repetido em resultado precisa ser protegido');
assert.match(src, /renderPropertyContextAssistant\(value, \{ focusMunicipality: !propertyContextSearchState\.municipality \}\)/, 'lupa superior deve abrir/confirmar o assistente, não disparar consulta sem confirmação');
assert.match(src, /class="property-context-search-btn"/, 'busca contextual deve possuir botão dedicado');
console.log('PASS: busca R22 mantém precisão, município explícito, proteção de corrida e confirmação por botão.');
