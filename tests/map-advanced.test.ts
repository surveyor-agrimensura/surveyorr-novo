import {describe,expect,it} from 'vitest';
import {parseMapCoordinates} from '../src/features/map/coordinateParser';
import {splitPolygonByGuide,splitPolygonIntoLots} from '../src/features/map/glebaGeometry';
import {polygonMeasures} from '../src/features/map/geoServices';
import {measureMapGeometry} from '../src/features/map/geometryMetrics';
import {getPolygons} from '../src/features/memorial/memorialEngine';
import {readProjectDivisions} from '../src/features/croqui/projectDivisions';
import {defaultSheetForPolygon,renderTechnicalSheet} from '../src/features/documents/technicalSheet';

const perimeter={type:'Feature' as const,id:'demo',properties:{name:'Exemplo'},geometry:{type:'Polygon' as const,coordinates:[[[-39.7,-13.1],[-39.6,-13.1],[-39.6,-13.0],[-39.7,-13.0],[-39.7,-13.1]]]}};
const concavePerimeter={type:'Feature' as const,id:'concavo',properties:{name:'Fazenda em L'},geometry:{type:'Polygon' as const,coordinates:[[[-39.7,-13.1],[-39.6,-13.1],[-39.6,-13.05],[-39.65,-13.05],[-39.65,-13.0],[-39.7,-13.0],[-39.7,-13.1]]]}};
const cut={type:'Feature' as const,id:'corte',properties:{},geometry:{type:'LineString' as const,coordinates:[[ -39.65,-13.12],[-39.65,-12.99]]}};
describe('Busca coordenadas',()=>{
 it('interpreta DD e hemisférios',()=>{expect(parseMapCoordinates('-13.0312, -39.6059','DD')).toEqual([-13.0312,-39.6059]);expect(parseMapCoordinates('13° 1\' 52" S; 39° 36\' 21" W','DMS')[0]).toBeCloseTo(-13.03111,4);});
 it('interpreta UTM WGS 84',()=>{const [lat,lon]=parseMapCoordinates('24S 428507 8562755','UTM');expect(lat).toBeCloseTo(-13,1);expect(lon).toBeCloseTo(-39.659,2);});
 it('rejeita coordenadas DD inválidas',()=>expect(()=>parseMapCoordinates('92, -250','DD')).toThrow());
 it('rejeita minutos e segundos fora do intervalo em DMS e DDM',()=>{
  expect(()=>parseMapCoordinates('13°99\'00"S; 39°36\'21"W','DMS')).toThrow();
  expect(()=>parseMapCoordinates('13°01\'60"S; 39°36\'21"W','DMS')).toThrow();
  expect(()=>parseMapCoordinates('13°60.1\'S; 39°36.2\'W','DDM')).toThrow();
 });
 it('rejeita hemisfério de latitude usado na longitude e vice-versa',()=>{
  expect(()=>parseMapCoordinates('13°01\'52"E; 39°36\'21"N','DMS')).toThrow(/Hemisfério incompatível/);
  expect(()=>parseMapCoordinates('13°01.8\'S; 39°36.2\'N','DDM')).toThrow(/Hemisfério incompatível/);
 });
 it('rejeita sinais conflitantes e sinais em minutos ou segundos',()=>{
  expect(()=>parseMapCoordinates('-13°01\'52"N; 39°36\'21"W','DMS')).toThrow(/incompatível/);
  expect(()=>parseMapCoordinates('13°-01\'52"S; 39°36\'21"W','DMS')).toThrow(/Sinal negativo/);
  expect(()=>parseMapCoordinates('13°01\'-52"S; 39°36\'21"W','DMS')).toThrow(/Sinal negativo/);
 });
});
describe('Divisão de glebas preliminares e avançadas',()=>{
 it('gera quatro glebas equivalentes com cores próprias',()=>{const lots=splitPolygonIntoLots(perimeter,4,0);expect(lots).toHaveLength(4);const areas=lots.map(f=>Number(f.properties?.estimatedAreaHa));expect(Math.max(...areas)-Math.min(...areas)).toBeLessThan(.01);expect(lots[0].properties?.fillColor).toBeTruthy();expect(lots[1].properties?.fillColor).not.toBe(lots[0].properties?.fillColor);});
 it('divide polígono côncavo (formato em L) sem erro e preservando área total',()=>{
	  const parentArea=measureMapGeometry(concavePerimeter.geometry).areaM2/10000;
  const lots=splitPolygonIntoLots(concavePerimeter,3,0,{angleDeg:45});
  expect(lots).toHaveLength(3);
  const sumAreas=lots.reduce((acc,f)=>acc+Number(f.properties?.estimatedAreaHa||0),0);
  expect(sumAreas).toBeCloseTo(parentArea,1);
 });
 it('suporta áreas personalizadas por gleba',()=>{
  const lots=splitPolygonIntoLots(perimeter,3,0,{targetAreasHa:[20,30,50]});
  expect(lots).toHaveLength(3);
  const a0=Number(lots[0].properties?.estimatedAreaHa);
  const a1=Number(lots[1].properties?.estimatedAreaHa);
  const a2=Number(lots[2].properties?.estimatedAreaHa);
  expect(a1/a0).toBeCloseTo(1.5,2);
  expect(a2/a0).toBeCloseTo(2.5,2);
 });
 it('divide por linha que atravessa polígono e suporta corte exato na linha',()=>{
  const lots=splitPolygonByGuide(perimeter,cut);
  expect(lots).toHaveLength(2);
  expect(Number(lots[0].properties?.estimatedAreaHa)).toBeGreaterThan(0);
  const areas=lots.map(f=>polygonMeasures((f.geometry as {coordinates:number[][][]}).coordinates[0]).area);
  expect(Math.abs(areas[0]-areas[1])/((areas[0]+areas[1])/2)).toBeLessThan(1e-6);
  const asymmetricCut={type:'Feature' as const,id:'corte-assim',properties:{},geometry:{type:'LineString' as const,coordinates:[[-39.68,-13.12],[-39.68,-12.99]]}};
  const directLots=splitPolygonByGuide(perimeter,asymmetricCut,{directCut:true,count:2});
  expect(directLots).toHaveLength(2);
  const d0=Number(directLots[0].properties?.estimatedAreaHa);
  const d1=Number(directLots[1].properties?.estimatedAreaHa);
  expect(Math.abs(d0-d1)).toBeGreaterThan(100);
 });
 it('impede polígono com furos',()=>{const holes={...perimeter,geometry:{...perimeter.geometry,coordinates:[...perimeter.geometry.coordinates,[[-39.65,-13.05],[-39.66,-13.05],[-39.65,-13.04],[-39.65,-13.05]]]}};expect(()=>splitPolygonIntoLots(holes,2,0)).toThrow();});
});
describe('Integração de glebas coloridas com Pranchas, Croqui e Memorial',()=>{
 it('ignora polígono-mãe oculto e herda cores individuais nas pranchas técnicas',()=>{
  const lots=splitPolygonIntoLots(perimeter,4,0);
  const projectFeatures=[
   {id:'parent',name:'Fazenda Total',properties:{name:'Fazenda Total',hidden:true},geometry:perimeter.geometry},
   ...lots.map((l,idx)=>({id:`gleba-${idx+1}`,name:String(l.properties?.name||`Gleba ${idx+1}`),properties:l.properties as Record<string,unknown>,geometry:l.geometry as {type:string;coordinates:unknown}}))
  ];
  const polys=getPolygons(projectFeatures);
  const divisions=readProjectDivisions(projectFeatures);
  expect(polys).toHaveLength(4);
  expect(divisions).toHaveLength(4);
  const sheet0=defaultSheetForPolygon(polys[0],'Eng. Teste');
  const sheet1=defaultSheetForPolygon(polys[1],'Eng. Teste');
  expect(sheet0.polygonFill).toBe(lots[0].properties?.fillColor);
  expect(sheet1.polygonFill).toBe(lots[1].properties?.fillColor);
  const singleSvg=renderTechnicalSheet(polys[0],sheet0,{company:'Surveyor',municipality:'Jequié / BA',owner:'João',owners:['João'],date:'28/10/2026',publicUrl:'https://surveyor.example/publico',projectTitle:'Fazenda Total — Gleba 01'});
  expect(singleSvg).toContain(sheet0.polygonFill);
  expect(singleSvg).toContain('Fazenda Total — Gleba 01');
  const compositeSvg=renderTechnicalSheet(polys[0],sheet0,{company:'Surveyor',municipality:'Jequié / BA',owner:'João',owners:['João'],date:'28/10/2026',publicUrl:'https://surveyor.example/publico',projectTitle:'Fazenda Total',divisions,composite:true});
  expect(compositeSvg).toContain('Gleba 01');
  expect(compositeSvg).toContain('Gleba 04');
 });
 it('avisa quando o link extenso não cabe no QR da Prancha Técnica',()=>{
  const polygon=getPolygons([{...perimeter,properties:{name:'Exemplo'}}])[0];
  const sheet=defaultSheetForPolygon(polygon,'Eng. Teste');
  const svg=renderTechnicalSheet(polygon,sheet,{company:'Surveyor',municipality:'Jequié / BA',owner:'João',owners:['João'],date:'28/10/2026',publicUrl:`https://surveyor.example/publico/imovel/?dados=${'x'.repeat(2500)}`,projectTitle:'Fazenda Total'});
  expect(svg).toContain('QR indisponível para este link.');
  expect(svg).toContain('Copie o link completo no SURVEYOR.');
 });
});
