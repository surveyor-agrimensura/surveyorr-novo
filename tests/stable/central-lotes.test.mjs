import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ring = [[-39.6,-13.0],[-39.59,-13.0],[-39.59,-12.99],[-39.6,-12.99],[-39.6,-13.0]];
const feature = (name, category) => ({type:'Feature',properties:{name,category},geometry:{type:'Polygon',coordinates:[ring]}});
const turf = {
  kinks: () => ({type:'FeatureCollection',features:[]}),
  area: () => 10000,
  point: (coord) => ({geometry:{coordinates:coord}}),
  distance: () => 0.9,
  bearing: () => 90,
  polygonToLine: (f) => f,
  length: () => 1.3
};
const window = {turf};
const context = vm.createContext({window,globalThis:window,document:{querySelector:()=>null,getElementById:()=>null},setInterval:()=>1,clearInterval:()=>{},console});
vm.runInContext(fs.readFileSync('assets/js/features/central-lotes/core.js','utf8'), context);
const core = window.SurveyorLotCenterCore;
assert.ok(core);
const project = {id:'project-1',title:'Loteamento Fictício',owner:'Teste',geojson:{features:[feature('Perímetro Geral','perimetro'),feature('Lote Um','gleba'),feature('Lote Dois','gleba')]}};
const lots = core.lots(project);
assert.equal(lots.length,3,'Todos os polígonos devem continuar disponíveis');
assert.deepEqual(lots.map(x=>x.selectedByDefault),[false,true,true],'Com subdivisões não selecionar automaticamente o perímetro de origem');
project.geojson.features[1].properties.confrontanteTrechos=[{nome:'Vizinho de Teste',startVertex:1,endVertex:3,propriedade:'Sítio Sul'}];
const isolated = core.isolate(project,lots[1]);
assert.equal(isolated.featureCollection.features.length,1,'Nunca misturar outros lotes');
assert.equal(isolated.featureCollection.features[0].properties.name,'Lote Um');
assert.equal(project.geojson.features.length,3,'O projeto original permanece intacto');
const official = core.officialProject(project,lots[1]);
assert.equal(official.geojson.features.length,1,'Geradores oficiais recebem apenas o lote escolhido');
assert.equal(official.geojson.features[0].properties.category,'perimetro','Lote se apresenta como perímetro na fonte oficial');
assert.equal(official.geojson.features[0].properties.confrontanteTrechos[0].nome,'Vizinho de Teste','Preservar confrontantes do lote');
assert.equal(project.geojson.features[1].properties.category,'gleba','Não alterar geometria original');
assert.equal(official.id,project.id,'Conservar id para aplicar as configurações oficiais da conta');
assert.equal(core.validate(lots[1].feature,turf),'');
const invalid = JSON.parse(JSON.stringify(lots[1].feature));invalid.geometry.coordinates[0].pop();
assert.match(core.validate(invalid,turf),/fechado/);
assert.match(core.validate(lots[1].feature,{...turf,kinks:()=>({features:[{}]})}),/Auto-interseção/);
assert.equal(core.lotFolder(lots[1],0),'01-Lote-Um');

class FakePdf {
  constructor(){this.internal={pageSize:{getWidth:()=>297,getHeight:()=>210}};this.lines=[];}
  setFont(){return this;}setFontSize(){return this;}setDrawColor(){return this;}setLineWidth(){return this;}
  line(){return this;}rect(){return this;}addPage(){return this;}
  splitTextToSize(s){return [String(s)];}
  text(s){this.lines.push(String(s));return this;}
  output(){return new Blob([this.lines.join('\n')],{type:'application/pdf'});}
}
window.jspdf={jsPDF:FakePdf};
context.Blob = Blob;
window.XLSX={utils:{book_new:()=>({sheets:[]}),aoa_to_sheet:(rows)=>rows,book_append_sheet:(book,sheet,name)=>book.sheets.push({name,sheet})},write:()=>new Uint8Array([80,75,3,4])};
vm.runInContext(fs.readFileSync('assets/js/features/mapa/dossier.js','utf8'),context);
const docs = await window.SurveyorProjectDossier.lotDocuments(isolated,['memorial','prancha','croqui','confrontantes','ods','coordenadas','geojson','kml']);
assert.equal(Object.keys(docs).length,8);
assert.equal(docs['Planilha tecnica.ods'][0],80);
assert.ok(docs['Prancha preliminar.pdf'] instanceof Blob);
assert.match(await docs['Memorial - Quadro de vertices.pdf'].text(),/Lote Um/);
assert.match(await docs['Confrontantes.pdf'].text(),/Vizinho de Teste/);
assert.match(await docs['Confrontantes.pdf'].text(),/V-01/);
assert.match(docs['Coordenadas.csv'],/Lote Um/);
assert.equal(JSON.parse(docs['Geometria.geojson']).features.length,1);
assert.ok(!docs['Geometria.geojson'].includes('Lote Dois'),'Nunca incorporar gleba diferente');
assert.match(await docs['Prancha preliminar.pdf'].text(),/PRELIMINAR/);

const html=fs.readFileSync('central-lotes/index.html','utf8');
const layout=fs.readFileSync('assets/js/core/layout.js','utf8');
assert.match(html,/data-page="central-lotes\.html"/);
assert.match(html,/core\/auth-guard\.js/);
assert.match(layout,/routeUrl\('\/central-lotes\/'\).*permission: 'projects:export-zip'/);
const app=fs.readFileSync('assets/js/features/central-lotes/app.js','utf8');
assert.match(app,/GeoRuralProjects\.get\(id, true\)/,'Central deve buscar geometria salva');
assert.match(app,/if \(!auth\.hasPermission\?\.\('projects:export-zip'\)\)/,'Proteger o menu também ao navegar diretamente');
assert.match(app,/RELATORIO_GERACAO\.json/);
const cloud = fs.readFileSync('assets/js/features/cloud/app.js','utf8');
assert.match(cloud, /data-action=\"batch\"/,'Projetos devem oferecer acesso direto à central');
assert.match(cloud, /central-lotes\/\?project=/,'Projeto selecionado deve chegar por URL contextual');
console.log('PASS central-lotes: seleção, isolamento, geometrias inválidas, oito arquivos, permissões e integração.');
