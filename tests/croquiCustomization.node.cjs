/* Regressões do botão Ocultar, foto quadrada e tags dos vértices no SVG exportável. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps = {}) {
 const module = {exports:{}};
 const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code, {module,exports:module.exports,require(id){if(id in deps)return deps[id];throw Error(`Dependência não definida: ${id}`);},Math,Number,Object,Array,Map,Set,RegExp,Date,JSON,String,structuredClone,console});
 return module.exports;
}
const geom={
 readConfrontation:()=>'',neighborText:value=>String(value??''),
 smoothRoadCenterline:points=>points,
 roadBoundaries(points,width){return {left:points.map(p=>({x:p.x,y:p.y-width/2})),right:points.map(p=>({x:p.x,y:p.y+width/2}))};},
 svgPoints:points=>points.map(p=>`${p.x},${p.y}`).join(' '),
 groupConfrontations:()=>[],polylineMidpoint:()=>null,openRoadEdgesSvg:(left,right,color)=>`<polyline stroke="${color}"/><polyline stroke="${color}"/>`
};
const projectGeo=load('src/features/croqui/projectGeojsonGeometry.ts');
const geoRings=load('src/lib/geoJsonRings.ts');
const utmCore=load('src/lib/wgs84Utm.ts');
const sphericalGeodesy=load('src/lib/sphericalGeodesy.ts');
const engine=load('src/features/memorial/memorialEngine.ts',{'../../lib/wgs84Utm':utmCore,'../../lib/sphericalGeodesy':sphericalGeodesy,'../croqui/projectGeojsonGeometry':projectGeo,'../../lib/geoJsonRings':geoRings,'../croqui/croquiGeometry':geom});
const zoom=load('src/lib/percentZoom.ts');
const contrast=load('src/lib/svgTextContrast.ts');
const cartographic=load('src/lib/cartographicAutomation.ts');
const mapOverlay=load('src/lib/mapOverlayCoordinates.ts');
const divisionPerimeter=load('src/features/croqui/divisionPerimeter.ts',{'../memorial/memorialEngine':engine});
const compositeMeasures=load('src/features/croqui/compositeMeasures.ts',{'../../lib/cartographicAutomation':cartographic});
const renderer=load('src/features/memorial/croquiRenderer.ts',{
 './official-croqui-template.svg?raw':fs.readFileSync('src/features/memorial/official-croqui-template.svg','utf8'),
 '../../lib/agrarianMeasure':{tarefaCaption:()=>''},
 '../../lib/customCotas':{drawCustomCotas:()=>'',normalizedCustomCotas:()=>[]},
 '../../lib/cartographicAutomation':cartographic,
 './memorialEngine':engine,
 '../croqui/divisionPerimeter':divisionPerimeter,
 '../croqui/compositeMeasures':compositeMeasures,
 '../croqui/croquiGeometry':geom,
 '../croqui/labelLayout':{placeCompactCroquiLabels:labels=>({visible:labels.map(label=>({...label,position:label.preferred})),hidden:[]})},
 '../croqui/confrontantCaption':{confrontantCaption:t=>({text:String(t),cpf:false})},
 '../croqui/projectDivisions':{divisionBounds:()=>[]},
 '../../lib/percentZoom':zoom,
 '../croqui/sharedMapAppearance':{normalizeMapNames:value=>Array.isArray(value)?value:[]},
 '../../lib/svgTextContrast':contrast,
 '../../lib/mapOverlayCoordinates':mapOverlay,
 '../../lib/confrontantVisualOrganizer':load('src/lib/confrontantVisualOrganizer.ts')
});
const poly={id:'area1',name:'Sítio Exemplo',properties:{},vertices:[[-39.51,-13.11],[-39.508,-13.11],[-39.508,-13.109],[-39.51,-13.109]],areaM2:25000,perimeterM:1000};
const info={company:'AGR',mapLink:'',municipality:'Bahia'};
const base=renderer.defaultCroquiSettings();base.background='none';
const visibleRoad={id:'road-1',points:[{x:200,y:200},{x:340,y:200}],width:18,color:'#2563eb'};
const visible=renderer.renderCroqui(poly,{...base,easements:[visibleRoad]},info);
assert.match(visible,/data-croqui-road="0"/,'servidão visível na exportação');
const hiddenSettings=renderer.normalizeCroquiSettings({...base,easements:[{...visibleRoad,visible:false}]});
assert.equal(hiddenSettings.easements.length,1,'servidão permanece no estado salvo');
assert.equal(hiddenSettings.easements[0].visible,false,'visibilidade persiste após normalização');
const hidden=renderer.renderCroqui(poly,hiddenSettings,info);
assert.doesNotMatch(hidden,/data-croqui-road="0"/,'servidão oculta não aparece no SVG final');
assert.doesNotMatch(hidden,/data-croqui-road-handle=/,'servidão oculta não cria alças');
const shownAgain=renderer.renderCroqui(poly,{...hiddenSettings,easements:[{...hiddenSettings.easements[0],visible:true}]},info);
assert.match(shownAgain,/data-croqui-road="0"/,'servidão volta sem recriar os pontos');
const photo={src:'data:image/png;base64,aGVsbG8=',x:750,y:120,size:110,visible:true};
const photoSettings=renderer.normalizeCroquiSettings({...base,photoOverlay:photo});
assert.equal(photoSettings.photoOverlay.size,110);
const photoPreview=renderer.renderCroqui(poly,photoSettings,{...info,editing:true});
assert.match(photoPreview,/data-croqui-photo-body="true"/,'foto aparece na planta');
assert.match(photoPreview,/preserveAspectRatio="xMidYMid slice"/,'imagem não pode ser distorcida');
assert.equal((photoPreview.match(/data-croqui-photo-corner="/g)||[]).length,4,'quatro alças no editor');
const photoPrint=renderer.renderCroqui(poly,photoSettings,info);
assert.match(photoPrint,/data-croqui-photo-body="true"/,'foto incluída na impressão');
assert.doesNotMatch(photoPrint,/data-croqui-photo-corner="/,'alças não vão ao PDF');
const photoHidden=renderer.renderCroqui(poly,{...photoSettings,photoOverlay:{...photoSettings.photoOverlay,visible:false}},info);
assert.doesNotMatch(photoHidden,/data-croqui-photo-body="true"/,'foto oculta excluída da impressão');
assert.match(photoPrint,/data-croqui-vertex="0"/,'marcadores circulares de vértice permanecem');
assert.doesNotMatch(photoPrint,/<rect[^>]*rx="3"[^>]*fill="#000000"/,'rótulos não têm caixas pretas');
// A cor escolhida controla sozinha o preenchimento do nome e dos vertices.
const pure=renderer.renderCroqui(poly,{...base,labelColors:{'area:polygon':'#0000ff','area:metrics':'#ff9900','vertex:0':'#008800'}},info);
const pTitle=pure.match(/<text data-croqui-label="area:polygon"[^>]*>/)?.[0];
const pMetrics=pure.match(/<text data-croqui-label="area:metrics"[^>]*>/)?.[0];
const pVertex=pure.match(/<text data-croqui-label="vertex:0"[^>]*>/)?.[0];
assert(pTitle&&pMetrics&&pVertex,'texto principal, métricas e vértices devem existir');
assert.match(pTitle,/fill="#0000ff"/,'nome recebe somente o azul escolhido');
assert.match(pMetrics,/fill="#ff9900"/,'métricas recebem somente o laranja escolhido');
assert.match(pVertex,/fill="#008800"/,'vértice recebe somente o verde escolhido');
for (const label of [pTitle,pMetrics,pVertex]) {
 assert.doesNotMatch(label,/(?:\s+stroke=|paint-order=|stroke-width=)/,'texto sem contornos e halos');
}
const restored=renderer.normalizeCroquiSettings({...base,labelColors:{'area:polygon':'#0000ff','vertex:0':'#008800'}});
assert.equal(restored.labelColors['area:polygon'],'#0000ff','cor salva permanece na normalização');
assert.equal(restored.labelColors['vertex:0'],'#008800','cor do vértice persiste');
const toolbar=fs.readFileSync('src/features/croqui/CroquiPage.tsx','utf8');
assert.match(toolbar,/className="cq-bottom" role="toolbar"/,'barra inferior semântica');
assert.match(toolbar,/cq-toolbar-left/,'ações no bloco esquerdo');
assert.match(toolbar,/cq-toolbar-middle/,'zoom central');
assert.match(toolbar,/cq-toolbar-right/,'salvar/exportar no bloco direito');
const sheetSource=fs.readFileSync('src/features/documents/technicalSheet.ts','utf8');
assert.match(sheetSource,/road\.visible!==false/,'prancha respeita visibilidade das servidões do croqui');
const pageSource=fs.readFileSync('src/features/croqui/CroquiPage.tsx','utf8');
assert.match(pageSource,/aria-pressed=\{road\.visible===false\}/,'botão Ocultar tem estado acessível');
assert.match(pageSource,/kind:'photo-resize'/,'foto tem gesto de redimensionamento por canto');
assert.match(photoPrint,/data-croqui-label="area:polygon"/,'título do imóvel presente');
assert.doesNotMatch(photoPrint,/stroke="#ffffff" stroke-width="4"/,'nome do imóvel sem halo branco');
// Revisão das 13 observações do teste em navegador, outubro/2026.
const opacitySettings=renderer.normalizeCroquiSettings({...base,polygonFillOpacity:.37});
assert.equal(opacitySettings.polygonFillOpacity,.37,'opacidade mantém valor ao salvar/reabrir');
const opacitySvg=renderer.renderCroqui(poly,opacitySettings,info);
assert.match(opacitySvg,/data-croqui-polygon="true"[^>]+fill-opacity="0.37"/,'SVG preserva opacidade selecionada');
const malformedStyle='0.4" onload="alert(1)';
const sanitizedStyles=renderer.normalizeCroquiSettings({...base,featureStyles:{'gleba-b':{fillOpacity:malformedStyle,strokeWidth:malformedStyle,fillColor:'#ffffff" onload="alert(1)'}}});
assert.equal(Object.keys(sanitizedStyles.featureStyles['gleba-b']).length,0,'estilos persistidos aceitam somente números limitados e cores hexadecimais');
const unsafePrimary=renderer.renderCroqui(poly,{...base,polygonFillOpacity:malformedStyle,polygonStrokeWidth:malformedStyle},info);
assert.doesNotMatch(unsafePrimary,/onload=|alert\(1\)/,'configuração adulterada não injeta atributos no polígono principal');
assert.match(unsafePrimary,/data-croqui-polygon="true"[^>]+fill-opacity="0\.24"[^>]+stroke-width="2\.4"/,'atributos principais inválidos usam valores seguros');
const a3Svg=renderer.renderCroqui(poly,{...base,paper:'A3'},info);
assert.match(a3Svg,/viewBox="-90 0 1380 970"/,'A3 expande a área da folha sem deformar coordenadas');
const a4Svg=renderer.renderCroqui(poly,{...base,paper:'A4'},info);
assert.match(a4Svg,/viewBox="0 0 1200 970"/,'A4 preserva modelo histórico');
const geoRoad={id:'geo',points:[{x:200,y:250},{x:350,y:250}],geoPoints:[poly.vertices[0],poly.vertices[1]],color:'#16a34a',width:15,widthMeters:20};
const geoAtZoom=zoomValue=>renderer.renderCroqui(poly,{...base,zoom:zoomValue,easements:[geoRoad]},info);
function renderedRoadThickness(svg){
 const match=svg.match(/<g class="croqui-road"[^>]*><polygon points="([^"]+)"/);
 assert(match,'faixa de servidão georreferenciada presente');
 const coords=match[1].split(' ').map(v=>v.split(',').map(Number));
 return Math.abs(coords[coords.length-1][1]-coords[0][1]);
}
assert(renderedRoadThickness(geoAtZoom(20))>renderedRoadThickness(geoAtZoom(12)),
 'a largura visual da servidão acompanha o aumento do zoom cartográfico');
assert.equal(renderer.normalizeCroquiSettings({...base,easements:[geoRoad]}).easements[0].widthMeters,20,
 'largura métrica é persistida');
const revisedPage=fs.readFileSync('src/features/croqui/CroquiPage.tsx','utf8');
assert.match(revisedPage,/Opacidade do preenchimento/,'menu de contexto permite opacidade');
assert.doesNotMatch(revisedPage,/Copiar link para o QR Code/,'cópia manual redundante removida');
const memorialPage=fs.readFileSync('src/features/memorial/MemorialPage.tsx','utf8');
assert.match(memorialPage,/unifiedCroqui/,'croqui é fonte da apresentação no Memorial');
assert.doesNotMatch(memorialPage,/As preferências salvas são aplicadas automaticamente à geração/,'texto redundante removido');
const sidebar=fs.readFileSync('src/features/map/MapWorkPanels.tsx','utf8');
assert.doesNotMatch(sidebar,/Confira os dados abaixo e pressione/,'texto redundante do mapa removido');
console.log('SURVEYOR Croqui: regressões existentes e 12 verificações da revisão anotada aprovadas.');
