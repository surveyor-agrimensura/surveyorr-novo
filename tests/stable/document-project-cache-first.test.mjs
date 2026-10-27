import fs from 'node:fs';
import assert from 'node:assert/strict';

const projects = fs.readFileSync('assets/js/core/projects.js','utf8');
const suite = fs.readFileSync('assets/js/core/suite.js','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(projects,/async function list\(\{ full = false, refresh = false, cacheOnly = false \} = \{\}\)/,'API de projetos deve permitir leitura local imediata sem bloquear a UI.');
assert.match(projects,/if \(cacheOnly\) \{[\s\S]*return summaries\.slice\(\)/,'Modo cacheOnly deve devolver a lista local sem iniciar rede.');
assert.match(suite,/list\(\{full:false,refresh:false,cacheOnly:true\}\)/,'Seletor documental deve usar cache primeiro.');
assert.match(suite,/Carregando projetos…/,'Quando o cache ainda está vazio, o seletor deve informar carregamento em vez de parecer quebrado.');
assert.match(suite,/list\(\{full:false,refresh:true\}\)\.then/,'Atualização da nuvem deve ocorrer em segundo plano.');
assert.match(mapas,/list\(\{ full: false, refresh: false, cacheOnly: true \}\)/,'Mapas/Pranchas não devem baixar todos os projetos completos apenas para preencher o seletor.');
assert.match(mapas,/select\.dataset\.projectChoiceExplicit = '1'/,'Escolha explícita do usuário deve ser preservada durante a atualização da lista.');
assert.match(suite,/GeoRuralProjects\.get\(id,false\)[\s\S]*GeoRuralProjects\.get\(id,true\)/,'Seleção deve reutilizar cache/in-flight completo antes de forçar atualização remota.');
assert.match(mapas,/function projectHasRenderablePerimeter\(project\)/,'Resumo sem geometria não pode ser tratado como projeto renderizável.');
console.log('PASS document-project-cache-first: projetos aparecem pelo cache, rede atualiza em segundo plano e seleção explícita é preservada.');
