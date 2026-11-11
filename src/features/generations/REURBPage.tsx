import {useEffect,useState} from 'react';
import {GenerationWorkspace,Switch,useGenerationData,type GenerativeOptions} from './GenerationLayout';
import {projectShapes,featureVertices,bounds,polygonArea,polygonPerimeter,subdividePolygon,saveText,xmlEscape,type XY,type GeoPolygon} from './geometry';
import {docxBytes,downloadBytes,downloadDocx,makeZip} from './exportOffice';
import type {ProjectFeature} from '../projects/projectsApi';
import {projectOwners} from '../projects/projectOwners';
import {FileUploadField,type UploadProgressReporter} from '../../components/FileUploadField';

function readUploadText(file:File,reportProgress:UploadProgressReporter):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onprogress=event=>{if(event.lengthComputable&&event.total>0)reportProgress(file,event.loaded,event.total);};reader.onerror=()=>reject(reader.error||new Error('Falha ao ler as camadas.'));reader.onabort=()=>reject(new Error('Leitura das camadas cancelada.'));reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('As camadas não puderam ser lidas como texto.'));reader.readAsText(file);});}

type Category='gleba'|'quadra'|'lote'|'rua'|'verde'|'institucional'|'app';
type Occupant={name:string;cpf:string;rg:string;marital:string;spouse:string;income:string};
type Lot={id:string;quadra:string;number:string;points:XY[];usage:string;taxCode:string;front:string;back:string;left:string;right:string;occupant:Occupant};
const emptyOccupant=():Occupant=>({name:'',cpf:'',rg:'',marital:'',spouse:'',income:''});
function featureOccupant(properties:Record<string,unknown>):Occupant{
 const normalize=(value:string)=>value.normalize('NFD').split('').filter(char=>char.charCodeAt(0)<768||char.charCodeAt(0)>879).join('').toLowerCase().replaceAll('_','').replaceAll('-','').replaceAll(' ','');
 const value=(...aliases:string[])=>{
  const wanted=aliases.map(normalize);
  const raw=Object.entries(properties).find(([key])=>wanted.includes(normalize(key)))?.[1];
  if(typeof raw==='string'||typeof raw==='number')return String(raw).trim();
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
   const record=raw as Record<string,unknown>;
   for(const key of ['name','nome','ownerName','owner','proprietario','beneficiario'])if(typeof record[key]==='string')return record[key].trim();
  }
  return '';
 };
 return {
  name:value('ownerName','owner','proprietario','nomeProprietario','beneficiaryName','beneficiary','beneficiario','occupantName','ocupante','nomeOcupante'),
  cpf:value('ownerCpf','cpfProprietario','proprietarioCpf','beneficiaryCpf','cpfBeneficiario','occupantCpf','cpfOcupante','cpf'),
  rg:value('ownerRg','rgProprietario','proprietarioRg','beneficiaryRg','rgBeneficiario','occupantRg','rgOcupante','rg'),
  marital:value('maritalStatus','estadoCivil','estado_civil'),
  spouse:value('spouse','conjuge','nomeConjuge'),
  income:value('familyIncome','rendaFamiliar','renda')
 };
}
const fmt=(n:number,d=2)=>n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const colors:Record<Category,string>={gleba:'#d7e8f9',quadra:'#dae6f5',lote:'#9fd1b6',rua:'#c3cbd6',verde:'#69b385',institucional:'#9d96d2',app:'#edd17a'};
const categories:[Category,string][]=[['lote','Área de lotes'],['rua','Sistema viário'],['verde','Áreas verdes'],['institucional','Áreas institucionais'],['app','Áreas APP']];
function classify(input:string):Category{const t=input.toLowerCase();if(/lote\b|lot\b/.test(t))return'lote';if(/quadra|block/.test(t))return'quadra';if(/rua|avenida|via|travessa|circula/.test(t))return'rua';if(/institucional|equipamento/.test(t))return'institucional';if(/verde|praça|praca|parque/.test(t))return'verde';if(/\bapp\b|preserva/.test(t))return'app';return'gleba';}
function fromGeoJson(raw:string):ProjectFeature[]{const json=JSON.parse(raw);const list=json.type==='FeatureCollection'?json.features:json.type==='Feature'?[json]:[{geometry:json}];return list.filter((f:Record<string,unknown>)=>f.geometry).map((f:Record<string,unknown>,i:number)=>({id:String(f.id||`imp-${i+1}`),name:String((f.properties as Record<string,unknown>)?.name||`Importação ${i+1}`),geoJson:f.geometry as ProjectFeature['geometry'],properties:(f.properties||{}) as Record<string,unknown>}));}
function parsePolygons(file:string,name:string):ProjectFeature[]{const ext=name.split('.').pop()?.toLowerCase();if(ext==='geojson'||ext==='json')return fromGeoJson(file);if(ext==='kml'){const doc=new DOMParser().parseFromString(file,'application/xml');if(doc.querySelector('parsererror'))throw new Error('KML inválido.');const folders=Array.from(doc.getElementsByTagName('Placemark'));return folders.flatMap((el,i)=>{const c=el.getElementsByTagName('coordinates')[0]?.textContent?.trim();if(!c)return [];const ring=c.split(/\s+/).map(s=>s.split(',').map(Number)).filter(p=>p.length>=2&&p.slice(0,2).every(Number.isFinite));const title=el.getElementsByTagName('name')[0]?.textContent||`Feição ${i+1}`;return ring.length>=3?[{id:`kml-${i}`,name:title,geoJson:{type:'Polygon',coordinates:[ring]},properties:{name:title,category:classify(title)}}]:[];});}throw new Error('Importação de camadas: use GeoJSON ou KML. DXF precisa ser convertido em GeoJSON com SRC identificado antes da importação.');}
function pointCanvas(points:XY[]){const b=bounds(points);const sc=Math.min(810/b.width,450/b.height)*.85;return (p:XY)=>({x:510+(p.x-(b.minX+b.maxX)/2)*sc,y:348-(p.y-(b.minY+b.maxY)/2)*sc});}
function simpleSvg(lot:Lot,nui:string,tech:string){const b=bounds(lot.points),s=Math.min(750/b.width,445/b.height)*.8,coords=lot.points.map(p=>`${480+(p.x-(b.minX+b.maxX)/2)*s},${318-(p.y-(b.minY+b.maxY)/2)*s}`).join(' ');return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 750" width="1000" height="750"><rect width="1000" height="750" fill="white"/><rect x="25" y="25" width="950" height="700" fill="none" stroke="#234766" stroke-width="2"/><text x="48" y="70" font-family="Arial" font-size="26" font-weight="bold">${xmlEscape(nui||'PROJETO REURB')}</text><text x="48" y="98" font-family="Arial" font-size="17">Quadra ${xmlEscape(lot.quadra)} · Lote ${xmlEscape(lot.number)} · Área ${fmt(polygonArea(lot.points))} m²</text><polygon points="${coords}" stroke="#145da8" stroke-width="3" fill="#b8dbca" fill-opacity=".6"/>${lot.points.map((p,i)=>{const x=480+(p.x-(b.minX+b.maxX)/2)*s,y=318-(p.y-(b.minY+b.maxY)/2)*s;return `<circle cx="${x}" cy="${y}" r="4" fill="red"/><text x="${x+7}" y="${y-7}" font-family="Arial" font-size="12">V-${i+1}</text>`}).join('')}<text x="45" y="598" font-family="Arial" font-size="14">Ocupante: ${xmlEscape(lot.occupant.name||'Não cadastrado')} · CPF: ${xmlEscape(lot.occupant.cpf||'Não informado')}</text><text x="45" y="625" font-family="Arial" font-size="14">Confrontações: frente ${xmlEscape(lot.front||'a informar')}; fundo ${xmlEscape(lot.back||'a informar')}; esquerda ${xmlEscape(lot.left||'a informar')}; direita ${xmlEscape(lot.right||'a informar')}</text><line x1="550" y1="677" x2="935" y2="677" stroke="#344b60"/><text x="570" y="698" font-family="Arial" font-size="12">${xmlEscape(tech||'Responsável técnico')}</text><text x="47" y="698" font-family="Arial" font-size="11">SURVEYOR · Peça preliminar sujeita à conferência técnica</text></svg>`;}
function lotMemo(lot:Lot,nui:string,city:string,tech:string){const p=lot.points,area=polygonArea(p),perim=polygonPerimeter(p),lines=[`MEMORIAL DESCRITIVO DO LOTE ${lot.number} • QUADRA ${lot.quadra}`,`Núcleo: ${nui||'Não informado'}`,`Município: ${city||'Não informado'}`,`Ocupante / beneficiário: ${lot.occupant.name||'Não cadastrado'}`,`CPF: ${lot.occupant.cpf||'Não cadastrado'}`,`Área: ${fmt(area,4)} m². Perímetro: ${fmt(perim,3)} m.`,`Confrontações: frente ${lot.front||'a definir'}; fundo ${lot.back||'a definir'}; lado direito ${lot.right||'a definir'}; lado esquerdo ${lot.left||'a definir'}.`];if(!p.length)return lines;lines.push(`Inicia-se a descrição no vértice V-01, de coordenadas planas E ${fmt(p[0].x,3)} e N ${fmt(p[0].y,3)}. Prossegue-se pelos seguintes lados:`);for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],len=Math.hypot(b.x-a.x,b.y-a.y),az=(Math.atan2(b.x-a.x,b.y-a.y)*180/Math.PI+360)%360;lines.push(`V-${String(i+1).padStart(2,'0')} a V-${String((i+1)%p.length+1).padStart(2,'0')}: ${fmt(len,3)} m, azimute ${fmt(az,6)}°, encerrando em E ${fmt(b.x,3)}, N ${fmt(b.y,3)}.`)}lines.push('','Memorial preliminar; coordenadas locais necessitam referência geodésica verificada. Assinatura e validação do responsável técnico obrigatórias para uso oficial.',`Responsável técnico: ${tech||'Não informado'}`);return lines;}
function dxf(shapes:{points:XY[];name:string}[]){const header=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','0','ENDSEC','0','SECTION','2','ENTITIES'];for(const f of shapes){header.push('0','LWPOLYLINE','8',f.name.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,60),'90',String(f.points.length),'70','1');for(const p of f.points)header.push('10',String(p.x),'20',String(p.y));}header.push('0','ENDSEC','0','EOF');return header.join('\n');}
function reurbModelSvg(items:{id:string;name:string;category:Category;points:XY[]}[],lots:Lot[],nui:string,mode:string,town:string,origin:string,totalArea:number,areaByCategory:{category:Category;label:string;area:number}[],projectName:string,ownerNames:string[],opts:GenerativeOptions){
 const esc=xmlEscape,all=items.flatMap(item=>item.points),boundsBox=all.length?bounds(all):{minX:0,minY:0,maxX:1,maxY:1,width:1,height:1};
 const width=Math.max(1,boundsBox.maxX-boundsBox.minX),height=Math.max(1,boundsBox.maxY-boundsBox.minY),scale=Math.min(2970/width,1120/height),centerX=(boundsBox.minX+boundsBox.maxX)/2,centerY=(boundsBox.minY+boundsBox.maxY)/2;
 const project=(point:XY)=>({x:1754+(point.x-centerX)*scale,y:865-(point.y-centerY)*scale});
 const grid=opts.showGrid?Array.from({length:9},(_,index)=>{
  const x=185+index*393,y=285+index*145,east=boundsBox.minX+width*index/8,north=boundsBox.maxY-height*index/8;
  return [
   '<line x1="',x,'" y1="280" x2="',x,'" y2="285" stroke="#0f2147" stroke-width="4"/>',
   '<line x1="',x,'" y1="285" x2="',x,'" y2="1445" stroke="#d8e1e8" stroke-width="2"/>',
   '<line x1="',x,'" y1="1445" x2="',x,'" y2="1450" stroke="#0f2147" stroke-width="4"/>',
   '<text x="',x,'" y="250" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" fill="#263b54">',fmt(east,1),'</text>',
   '<text x="',x,'" y="1638" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" fill="#263b54">',fmt(east,1),'</text>',
   '<line x1="140" y1="',y,'" x2="3323" y2="',y,'" stroke="#d8e1e8" stroke-width="2"/>',
   '<text x="96" y="',y+8,'" text-anchor="end" font-family="Arial,sans-serif" font-size="22" fill="#263b54">',fmt(north,1),'</text>',
   '<text x="3404" y="',y+8,'" text-anchor="end" font-family="Arial,sans-serif" font-size="22" fill="#263b54">',fmt(north,1),'</text>'
  ].join('');
 }).join(''):'';
 const perimeterColor=opts.lineColor==='#125cb1'?'#e42cd2':opts.lineColor;
 const categoryFill:Record<Category,string>={gleba:'none',quadra:'#dce9d6',lote:'url(#parcelFill)',rua:'#f4f5f2',verde:'#b7d9b0',institucional:'#d9c9e4',app:'#f0d49c'};
 const categoryStroke:Record<Category,string>={gleba:perimeterColor,quadra:'#ff9900',lote:'#263238',rua:'#ff9900',verde:'#648d47',institucional:'#756494',app:'#c59b34'};
 const order:Record<Category,number>={rua:0,gleba:1,quadra:2,verde:3,app:4,institucional:5,lote:6};
 const sorted=[...items].sort((a,b)=>order[a.category]-order[b.category]);
 const vertexCount=all.length;
 const shapes=sorted.map(item=>{
  const points=item.points.map(point=>{const mapped=project(point);return mapped.x.toFixed(1)+','+mapped.y.toFixed(1)}).join(' ');
  const center=item.points.reduce((sum,point)=>({x:sum.x+point.x/item.points.length,y:sum.y+point.y/item.points.length}),{x:0,y:0});
  const labelPoint=project(center),lot=lots.find(candidate=>candidate.id===item.id);
  const label=item.category==='lote'?(lot?lot.quadra+'-'+lot.number:item.name):item.name;
  const showItemLabel=opts.showLabels&&(item.category!=='lote'||lots.length<=150);
  const ownerLabel=lot?.occupant.name||'';
  const markers=opts.showVertices&&vertexCount<=2500?item.points.map(point=>{const mapped=project(point);return '<circle cx="'+mapped.x.toFixed(1)+'" cy="'+mapped.y.toFixed(1)+'" r="7" fill="#fff" stroke="#173a5c" stroke-width="3"/>'}).join(''):'';
  const strokeWidth=item.category==='gleba'?Math.max(6,opts.lineWidth*4):item.category==='quadra'?8:item.category==='rua'?12:item.category==='lote'?3:4;
  const fillOpacity=item.category==='gleba'?'0.08':item.category==='rua'?String(opts.opacity/100):String(opts.opacity/100*0.82);
  const numberMarkup=showItemLabel?'<text x="'+labelPoint.x.toFixed(1)+'" y="'+labelPoint.y.toFixed(1)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="'+(item.category==='lote'?24:30)+'" font-weight="700" fill="#17334d">'+esc(label).slice(0,42)+'</text>':'';
  const ownerFit=ownerLabel.length>24?' textLength="250" lengthAdjust="spacingAndGlyphs"':'';
  const ownerMarkup=opts.showLabels&&item.category==='lote'&&ownerLabel?'<text x="'+labelPoint.x.toFixed(1)+'" y="'+(labelPoint.y+22).toFixed(1)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#263238"'+ownerFit+'>'+esc(ownerLabel)+'</text>':'';
  const labelMarkup=numberMarkup+ownerMarkup;
  const title=item.category==='lote'?'<title>Quadra '+esc(lot?.quadra||'')+' · Lote '+esc(lot?.number||'')+' · Proprietário: '+esc(ownerLabel||'Não cadastrado')+'</title>':'<title>'+esc(item.name)+'</title>';
  return '<g>'+title+'<polygon points="'+points+'" fill="'+categoryFill[item.category]+'" fill-opacity="'+fillOpacity+'" stroke="'+esc(categoryStroke[item.category])+'" stroke-width="'+strokeWidth+'" stroke-linejoin="round"/>'+markers+labelMarkup+'</g>';
 }).join('');
 const legendItems:[string,string][]=[[perimeterColor,'Limite do perímetro'],['#ff9900','Quadras'],['#fffdf4','Lotes'],['#d4d7db','Sistema viário'],['#b7d9b0','Áreas verdes'],['#d9c9e4','Institucional'],['#f0d49c','Área APP'],['#173a5c','Vértices']];
 const legend=opts.showLegend?'<g><rect x="2340" y="1140" width="960" height="400" rx="18" fill="#fff" fill-opacity=".96" stroke="#0f2147" stroke-width="4"/><text x="2376" y="1208" font-family="Arial,sans-serif" font-size="60" font-weight="800" fill="#0b1737">LEGENDA</text>'+legendItems.map((item,index)=>{
  const x=index%2===0?2374:2860,y=1260+Math.floor(index/2)*68;
  const symbol=item[1]==='Vértices'?'<circle cx="'+(x+24)+'" cy="'+(y+18)+'" r="10" fill="#fff" stroke="'+item[0]+'" stroke-width="4"/>':'<rect x="'+x+'" y="'+y+'" width="48" height="32" fill="'+item[0]+'" stroke="'+(item[1]==='Limite do perímetro'?'none':'#34485d')+'" stroke-width="2"/>';
  return symbol+'<text x="'+(x+68)+'" y="'+(y+25)+'" font-family="Arial,sans-serif" font-size="28" fill="#111">'+esc(item[1])+'</text>';
 }).join('')+'</g>':'';
 const projectOwnersList=ownerNames.length?ownerNames:opts.owner?[opts.owner]:[];
 const ownerLines=projectOwnersList.length?projectOwnersList:['Não informado no cadastro do projeto'];
 const ownerStep=Math.min(30,220/Math.max(ownerLines.length,1)),ownerFont=Math.max(10,Math.min(21,ownerStep*0.72));
 const ownersMarkup=ownerLines.map((owner,index)=>'<text x="100" y="'+(2160+index*ownerStep).toFixed(1)+'" font-family="Arial,sans-serif" font-size="'+ownerFont.toFixed(1)+'" fill="#111">'+esc(owner)+'</text>').join('');
 const categoriesSummary=areaByCategory.map((item,index)=>'<text x="1810" y="'+(2083+index*36)+'" font-family="Arial,sans-serif" font-size="24" fill="#173a5c">'+esc(item.label)+': '+fmt(item.area,1)+' m²</text>').join('');
 const ownerText=projectOwnersList.length?'Proprietários / titulares cadastrados':'Titularidade não informada no cadastro';
 const headerTitle=opts.title||'PLANTA DE LOTEAMENTO REURB';
 const subtitle=[nui||projectName||'Núcleo urbano',mode,town||'Município não informado',opts.date].filter(Boolean).map(esc).join(' · ');
 const mapNote='Coordenadas e sistema de referência conforme projeto de origem; conferir SRC e unidades.';
 const northArrow=opts.showNorth?'<g transform="translate(2670 2135)" fill="#0f2147" stroke="#0f2147"><circle r="66" fill="#fff" stroke-width="4"/><path d="M0,-54 L18,0 L0,-12 L-18,0 Z" fill="#0f2147"/><path d="M0,54 L18,0 L0,12 L-18,0 Z" fill="#fff"/><path d="M-54,0 L0,-18 L-12,0 L0,18 Z" fill="#fff"/><path d="M54,0 L0,-18 L12,0 L0,18 Z" fill="#fff"/><text x="0" y="-77" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="800" fill="#0f2147" stroke="none">N</text><text x="0" y="96" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#0f2147" stroke="none">S</text><text x="81" y="8" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#0f2147" stroke="none">L</text><text x="-81" y="8" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#0f2147" stroke="none">O</text></g>':'';
 const logo=opts.logo?'<image href="'+esc(opts.logo)+'" x="2825" y="1960" width="180" height="150" preserveAspectRatio="xMidYMid meet"/>':'';
 const areaTotal=areaByCategory.reduce((sum,item)=>sum+item.area,0);
 return [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="3508" height="2480" viewBox="0 0 3508 2480" font-family="Segoe UI,Arial,Helvetica,sans-serif">',
  '<defs><linearGradient id="parcelFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f0f4d0"/><stop offset="100%" stop-color="#dee7b6"/></linearGradient></defs>',
  '<rect x="16" y="16" width="3476" height="2448" fill="#fff" stroke="#0f2147" stroke-width="8"/><rect x="38" y="38" width="3432" height="2404" fill="none" stroke="#0f2147" stroke-width="2"/>',
  '<line x1="60" y1="90" x2="420" y2="90" stroke="#0f2147" stroke-width="6"/><line x1="3088" y1="90" x2="3448" y2="90" stroke="#0f2147" stroke-width="6"/>',
  opts.showTitle?'<text x="1754" y="118" text-anchor="middle" font-size="82" font-weight="800" fill="#0b1737">'+esc(headerTitle)+'</text><text x="1754" y="165" text-anchor="middle" font-size="27" fill="#536d82">'+subtitle+'</text>':'',
  '<rect x="74" y="190" width="3360" height="1700" rx="8" fill="#fff" stroke="#0f2147" stroke-width="3"/>',
  '<rect x="140" y="280" width="3220" height="1300" fill="#b6cfa2" stroke="#0f2147" stroke-width="4"/>',
  grid,
  '<rect x="185" y="285" width="3138" height="1160" fill="none" stroke="#193b59" stroke-width="2"/>',
  shapes,
  '<text x="1754" y="1515" text-anchor="middle" font-size="23" fill="#34485d">'+mapNote+'</text>',
  legend,
  '<rect x="74" y="1915" width="3360" height="470" fill="#fff" stroke="#0f2147" stroke-width="3"/>',
  '<line x1="900" y1="1915" x2="900" y2="2385" stroke="#193b59" stroke-width="3"/><line x1="1760" y1="1915" x2="1760" y2="2385" stroke="#193b59" stroke-width="3"/><line x1="2540" y1="1915" x2="2540" y2="2385" stroke="#193b59" stroke-width="3"/><line x1="2800" y1="1915" x2="2800" y2="2385" stroke="#193b59" stroke-width="3"/>',
  '<text x="100" y="1987" font-size="38" font-weight="800" fill="#0b1737">DADOS DO PROJETO</text>',
  '<text x="100" y="2043" font-size="23" fill="#111">Projeto: '+esc(projectName||'Não informado')+'</text>',
  '<text x="100" y="2088" font-size="23" fill="#111">Núcleo: '+esc(nui||'Não informado')+' · '+esc(town||'Município não informado')+'</text>',
  '<text x="100" y="2135" font-size="23" font-weight="700" fill="#173a5c">'+ownerText+'</text>',
  ownersMarkup,
  '<text x="930" y="1987" font-size="38" font-weight="800" fill="#0b1737">INFORMAÇÕES CARTOGRÁFICAS</text>',
  '<text x="930" y="2043" font-size="23" fill="#111">Coordenadas indicadas: '+(opts.coord==='geo'?'geográficas (Lat/Lon)':'planas (m)')+'</text>',
  '<text x="930" y="2089" font-size="23" fill="#111">Datum indicado: '+esc(opts.datum)+'</text>',
  '<text x="930" y="2135" font-size="23" fill="#111">Origem: '+esc(origin||'Não informada')+'</text>',
  '<text x="930" y="2181" font-size="22" fill="#536d82">Sem transformação de coordenadas.</text>',
  '<text x="930" y="2227" font-size="22" fill="#536d82">Conferir SRC e unidades na fonte do projeto.</text>',
  '<text x="1810" y="1987" font-size="38" font-weight="800" fill="#0b1737">QUADRO DE ÁREAS</text>',
  '<text x="1810" y="2043" font-size="24" fill="#173a5c">Gleba: '+fmt(totalArea,1)+' m²</text>',
  categoriesSummary,
  '<text x="1810" y="2280" font-size="23" font-weight="700" fill="#173a5c">Lotes: '+lots.length+' · Quadras: '+items.filter(item=>item.category==='quadra').length+'</text>',
  '<text x="1810" y="2322" font-size="22" fill="#536d82">Saldo contabilizado: '+fmt(totalArea-areaTotal,1)+' m²</text>',
  northArrow,
  logo,
  '<text x="3020" y="2010" font-size="58" font-weight="800" fill="#0b1737">'+esc(opts.company||'Surveyorr')+'</text>',
  '<text x="3020" y="2073" font-size="35" font-style="italic" fill="#222">Agrimensura</text>',
  '<line x1="2840" y1="2110" x2="3405" y2="2110" stroke="#193b59" stroke-width="2"/>',
  '<text x="2840" y="2170" font-size="21" fill="#111">Levantamentos | Georreferenciamento</text>',
  '<text x="2840" y="2215" font-size="21" fill="#111">Regularização Fundiária | Licenciamento</text>',
  '<text x="1754" y="2417" text-anchor="middle" font-size="21" fill="#718197">SURVEYOR · Planta preliminar; validar geometria, titularidade e referência cartográfica antes do uso oficial.</text>',
  '</svg>'
 ].join('');
}
export function REURBPage(){
 const data=useGenerationData();
 const ownerNames=projectOwners(data.project?.project).map(owner=>owner.name);
 const wizardSteps=['Projeto','Identificação','Camadas e quadras','Lotes e beneficiários','Revisão e exportação'];
 const [currentStep,setCurrentStep]=useState(0),[completed,setCompleted]=useState(false);
 const [nui,setNui]=useState(''),[mode,setMode]=useState('REURB-S'),[town,setTown]=useState(''),[origin,setOrigin]=useState('');
 const [shapes,setShapes]=useState<(GeoPolygon&{category:Category})[]>([]),[lots,setLots]=useState<Lot[]>([]);
 const [selected,setSelected]=useState(''),[quadra,setQuadra]=useState(''),[testada,setTestada]=useState(10),[axis,setAxis]=useState<'x'|'y'>('x');
 const [clockwise,setClockwise]=useState(true),[showArea,setShowArea]=useState(true),[coloring,setColoring]=useState(true),[error,setError]=useState('');

 useEffect(()=>{
  if(!data.project)return;
  const project=data.project.project;
  setNui(String(project?.propertyName||project?.name||''));
  setTown([project?.municipality||project?.city,project?.stateCode||project?.uf].filter(Boolean).join('/'));
  const imported=projectShapes(data.project.features).map(shape=>({...shape,category:classify([shape.type,shape.name].join(' '))}));
  setShapes(imported);
  setLots(imported.filter(shape=>shape.category==='lote').map((shape,index)=>({
   id:shape.id,
   quadra:String(shape.properties.quadra||shape.properties.block||'01'),
   number:String(shape.properties.lote||shape.properties.number||index+1).padStart(2,'0'),
   points:shape.points,
   usage:String(shape.properties.uso||'Residencial'),
   taxCode:String(shape.properties.inscricao||''),
   front:'',back:'',left:'',right:'',occupant:featureOccupant(shape.properties)
  })));
  setSelected('');
  setQuadra(imported.find(shape=>shape.category==='quadra')?.id||'');
  setCurrentStep(0);
  setCompleted(false);
  setError('');
 },[data.project]);

 const inputImport=async(file:File,reportProgress:UploadProgressReporter)=>{
  try{
   const imported=parsePolygons(await readUploadText(file,reportProgress),file.name);
   const anchor=data.project?.features.flatMap(feature=>featureVertices(feature))[0];
   const newShapes=projectShapes(imported,anchor).map(shape=>({...shape,category:classify([shape.type,shape.name].join(' '))}));
   if(!newShapes.length)throw new Error('Não foram encontrados polígonos geográficos válidos.');
   setShapes(current=>[...current,...newShapes]);
   setLots(current=>[...current,...newShapes.filter(shape=>shape.category==='lote').map((shape,index)=>({
    id:shape.id,quadra:String(shape.properties.quadra||'01'),number:String(shape.properties.lote||shape.properties.number||current.length+index+1).padStart(2,'0'),
    points:shape.points,usage:'Residencial',taxCode:'',front:'',back:'',left:'',right:'',occupant:featureOccupant(shape.properties)
   }))]);
   setError('Camadas importadas em coordenadas geográficas. Confira o alinhamento se houver outro projeto carregado.');
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível importar.');throw err;}
 };

 const selectedLot=lots.find(lot=>lot.id===selected);
 const selectedQuadra=shapes.find(shape=>shape.id===quadra);
 const gleba=shapes.find(shape=>shape.category==='gleba')||shapes.find(shape=>shape.category==='quadra');
 const allGeom=[...shapes.filter(shape=>shape.category!=='lote'),...lots.map(lot=>({...lot,category:'lote' as Category,name:`Lote ${lot.number}`,type:'lote',properties:{}}))];
 const points=allGeom.flatMap(shape=>shape.points);
 const byCategory=categories.map(([category,label])=>({category,label,area:category==='lote'?lots.reduce((sum,lot)=>sum+polygonArea(lot.points),0):shapes.filter(shape=>shape.category===category).reduce((sum,shape)=>sum+polygonArea(shape.points),0)}));
 const total=gleba?polygonArea(gleba.points):0;
 const sum=byCategory.reduce((value,item)=>value+item.area,0);

 const split=()=>{
  if(!selectedQuadra){setError('Selecione uma quadra cadastrada para subdividir.');return;}
  if(!(testada>0)){setError('Testada deve ser positiva.');return;}
  try{
   const cuts=subdividePolygon(selectedQuadra.points,testada,axis);
   const prefix=`${selectedQuadra.id}-${Date.now()}`;
   setLots(current=>[...current,...cuts.map((polygon,index)=>({
    id:`${prefix}-${index}`,quadra:selectedQuadra.name.replace(/quadra\s*/i,'')||'01',number:String(index+1).padStart(2,'0'),points:polygon,
    usage:'Residencial',taxCode:'',front:'',back:'',left:'',right:'',occupant:emptyOccupant()
   }))]);
   setError(`Criados ${cuts.length} polígonos por faixas ${axis.toUpperCase()} de ${testada} m. Confira testadas, sobreposições e confrontações. A divisão automática é geométrica, não valida parcelamento legal.`);
  }catch(err){setError(err instanceof Error?err.message:'Divisão inválida.');}
 };
 const updateLot=(key:keyof Lot,value:string)=>setLots(current=>current.map(lot=>lot.id===selected?{...lot,[key]:value}:lot));
 const updateOccupant=(key:keyof Occupant,value:string)=>setLots(current=>current.map(lot=>lot.id===selected?{...lot,occupant:{...lot.occupant,[key]:value}}:lot));
 const renumber=()=>{
  const number=selectedLot?.quadra||selectedQuadra?.name.replace(/quadra\s*/i,'')||'01';
  const group=lots.filter(lot=>lot.quadra===number);
  if(!group.length){setError('Nenhum lote da quadra selecionada para numerar.');return;}
  const centers=group.map(lot=>({id:lot.id,x:lot.points.reduce((sum,point)=>sum+point.x,0)/lot.points.length,y:lot.points.reduce((sum,point)=>sum+point.y,0)/lot.points.length}));
  const mx=centers.reduce((sum,point)=>sum+point.x,0)/centers.length;
  const my=centers.reduce((sum,point)=>sum+point.y,0)/centers.length;
  const ordered=centers.sort((a,b)=>(clockwise?-1:1)*(Math.atan2(b.y-my,b.x-mx)-Math.atan2(a.y-my,a.x-mx)));
  setLots(current=>current.map(lot=>{const index=ordered.findIndex(point=>point.id===lot.id);return index<0?lot:{...lot,number:String(index+1).padStart(2,'0')}}));
 };
 const exportLote=()=>{if(!selectedLot){setError('Selecione um lote para exportar.');return;}downloadDocx(lotMemo(selectedLot,nui,town,''),`memorial-quadra-${selectedLot.quadra}-lote-${selectedLot.number}.docx`);};
 const exportMass=()=>{
  if(!lots.length){setError('Cadastre lotes antes da exportação em massa.');return;}
  const files:{name:string;content:string|Uint8Array}[]=[];
  for(const lot of lots){
   const prefix=`Quadra-${lot.quadra.replace(/[^\w-]/g,'_')}_Lote-${lot.number.replace(/[^\w-]/g,'_')}`;
   files.push({name:`memoriais/${prefix}.docx`,content:docxBytes(lotMemo(lot,nui,town,''))},{name:`croquis/${prefix}.svg`,content:simpleSvg(lot,nui,'')});
  }
  files.push({name:'LEIA-ME.txt',content:`SURVEYOR • REURB\nModalidade: ${mode}\nOrigem: ${origin||'Não informada'}\nArquivos preliminares, sem assinatura ou certificação digital. Coordenadas são locais em metros, relativas à origem do mapa/projeto. Conferir sistema de referência, perímetro, restrições legais e cadastro dos beneficiários antes de uso registral.`});
  downloadBytes(makeZip(files),'surveyor-reurb-lotes-e-memoriais.zip','application/zip');
 };
 const printLots=()=>{
  if(!lots.length){setError('Não há lotes para imprimir.');return;}
  const popup=window.open('','_blank');
  if(!popup){setError('Habilite pop-ups para imprimir todos os croquis.');return;}
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Croquis REURB</title><style>@page{size:A4 landscape;margin:0}html,body{padding:0;margin:0}svg{display:block;width:297mm;height:210mm;page-break-after:always;break-after:page}</style></head><body>${lots.map(lot=>simpleSvg(lot,nui,'').replace('<?xml version="1.0" encoding="UTF-8"?>','')).join('')}</body></html>`);
  popup.document.close();popup.focus();setTimeout(()=>popup.print(),500);
 };
 const exportDxf=()=>{if(!allGeom.length){setError('Importe ou gere geometrias antes de exportar o DXF.');return;}saveText(dxf(allGeom.map(shape=>({points:shape.points,name:shape.category+'_'+shape.name}))),`surveyor-reurb-local.dxf`,'application/dxf');};
 const draw=(opts:GenerativeOptions)=>{
  if(!points.length)return <text x="333" y="342" fontSize="14" fill="#8498ac">Carregue uma gleba, quadras ou lotes</text>;
  const toCanvas=pointCanvas(points);
  return <g>{allGeom.map(item=>{
   const fill=coloring?colors[item.category]:'#d8e8f7';
   const polygonPoints=item.points.map(point=>{const projected=toCanvas(point);return `${projected.x},${projected.y}`}).join(' ');
   const center=item.points.reduce((value,point)=>({x:value.x+point.x/item.points.length,y:value.y+point.y/item.points.length}),{x:0,y:0});
   const labelPoint=toCanvas(center);
   return <g key={item.id} onClick={()=>{if(item.category==='lote')setSelected(item.id)}} style={{cursor:item.category==='lote'?'pointer':'default'}}>
    <polygon points={polygonPoints} fill={item.id===selected?'#f9d67b':fill} fillOpacity={opts.opacity/100} stroke={item.id===selected?'#a66010':opts.lineColor} strokeWidth={item.category==='gleba'?3.5:item.id===selected?3:1.3}/>
    {opts.showLabels&&<text x={labelPoint.x} y={labelPoint.y} fontSize="11" fontWeight="bold" textAnchor="middle" fill="#183c5d">{xmlEscape(item.category==='lote'?`${(item as Lot).number}${showArea?` · ${fmt(polygonArea(item.points),0)}m²`:''}`:item.name).slice(0,35)}</text>}
   </g>;
  })}</g>;
 };
 const statistics:[string,string][]=[['Lotes',String(lots.length)],['Quadras',String(shapes.filter(shape=>shape.category==='quadra').length)],['Gleba',`${fmt(total/10000,3)} ha`],['Área lotes',`${fmt(byCategory[0].area)} m²`],['Saldo contábil',`${fmt(total-sum)} m²`]];
 const changeStep=(requested:number)=>{
  const next=Math.max(0,Math.min(wizardSteps.length-1,currentStep+1,requested));
  if(next>0&&!data.project){setError('Selecione e aguarde o carregamento do projeto antes de continuar.');setCurrentStep(0);return;}
  setCurrentStep(next);setCompleted(false);
 };
 const nextStep=()=>{
  if(currentStep===0&&!data.project){setError('Selecione e aguarde o carregamento do projeto antes de continuar.');return;}
  if(currentStep===wizardSteps.length-1){setCompleted(true);return;}
  changeStep(currentStep+1);
 };
 const previousStep=()=>{setCurrentStep(step=>Math.max(0,step-1));setCompleted(false);};

 return <GenerationWorkspace kind="reurb" heading="Loteamento / REURB" data={data} modelAsset={{url:'/models/planta-loteamento-reurb.svg',fileName:'PLANTA_LOTEAMENTO_REURB_SURVEYOR.svg',createSvg:options=>reurbModelSvg(allGeom,lots,nui,mode,town,origin,total,byCategory,String(data.project?.project?.propertyName||data.project?.project?.name||data.projectId||'Projeto REURB'),ownerNames,options)}} points={points} draw={draw} stats={statistics}
  wizard={{steps:wizardSteps,currentStep,canContinue:Boolean(data.project&&!data.busy),completed,onStepChange:changeStep,onNext:nextStep,onPrevious:previousStep}}
  exportActions={currentStep===wizardSteps.length-1?<><button onClick={exportMass}>ZIP de croquis + memoriais DOCX</button><button onClick={printLots}>PDF dos croquis</button><button onClick={exportDxf}>DXF local</button></>:null}>
  {currentStep===1&&<>
   <h3>Identificação do núcleo urbano</h3>
   <label className="gen-control"><span>Nome do núcleo / loteamento</span><input value={nui} onChange={event=>setNui(event.target.value)}/></label>
   <label className="gen-control"><span>Modalidade</span><select value={mode} onChange={event=>setMode(event.target.value)}><option value="REURB-S">REURB-S • Interesse social</option><option value="REURB-E">REURB-E • Interesse específico</option></select></label>
   <label className="gen-control"><span>Município / UF</span><input value={town} onChange={event=>setTown(event.target.value)}/></label>
   <label className="gen-control"><span>Matrícula / transcrição de origem</span><input value={origin} onChange={event=>setOrigin(event.target.value)}/></label>
  </>}
  {currentStep===2&&<>
   <h3>Camadas do parcelamento</h3>
   <FileUploadField label="Importar polígonos classificados (GeoJSON ou KML)" accept=".geojson,.json,.kml" maxBytes={50*1024*1024} description="Camadas vetoriais, até 50 MB; arquivos lidos localmente." onFile={inputImport}/>
   <div className="gen-summary"><span>Polígonos: <b>{shapes.length}</b></span><span>Lotes: <b>{lots.length}</b></span><span>Quadras: <b>{shapes.filter(shape=>shape.category==='quadra').length}</b></span><span>Sistema viário: <b>{shapes.filter(shape=>shape.category==='rua').length}</b></span></div>
   <div className="gen-scroll-table"><table className="gen-table"><thead><tr><th>Camada</th><th>Tipo</th></tr></thead><tbody>{shapes.map(shape=><tr key={shape.id}><td>{shape.name}</td><td><select value={shape.category} onChange={event=>{const category=event.target.value as Category;setShapes(current=>current.map(item=>item.id===shape.id?{...item,category}:item));if(category==='lote'&&!lots.some(lot=>lot.id===shape.id))setLots(current=>[...current,{id:shape.id,quadra:String(shape.properties.quadra||shape.properties.block||'01'),number:String(shape.properties.lote||shape.properties.number||current.length+1).padStart(2,'0'),points:shape.points,usage:String(shape.properties.uso||'Residencial'),taxCode:String(shape.properties.inscricao||''),front:'',back:'',left:'',right:'',occupant:featureOccupant(shape.properties)}]);}}>{['gleba','quadra','lote','rua','verde','institucional','app'].map(category=><option key={category} value={category}>{category}</option>)}</select></td></tr>)}</tbody></table></div>
   <h3>Subdivisão de quadra</h3>
   <label className="gen-control"><span>Quadra a subdividir</span><select value={quadra} onChange={event=>setQuadra(event.target.value)}><option value="">Selecionar quadra</option>{shapes.filter(shape=>shape.category==='quadra').map(shape=><option key={shape.id} value={shape.id}>{shape.name}</option>)}</select></label>
   <div className="gen-multi-input"><label className="gen-control"><span>Faixa / testada-alvo (m)</span><input type="number" value={testada} min="1" step=".5" onChange={event=>setTestada(Number(event.target.value)||1)}/></label><label className="gen-control"><span>Eixo de corte</span><select value={axis} onChange={event=>setAxis(event.target.value as 'x'|'y')}><option value="x">Vertical (E)</option><option value="y">Horizontal (N)</option></select></label></div>
   <label className="gen-control"><span>Sentido da numeração</span><select value={clockwise?'horario':'antihorario'} onChange={event=>setClockwise(event.target.value==='horario')}><option value="horario">Horário</option><option value="antihorario">Anti-horário</option></select></label>
   <div className="gen-action-row"><button type="button" onClick={split}>Dividir quadra</button><button type="button" onClick={renumber}>Numerar lotes em sequência</button></div>
  </>}
  {currentStep===3&&<>
   <h3>Cadastro de lotes e beneficiários</h3>
   <label className="gen-control"><span>Lote selecionado (ou clique na prancha)</span><select value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Selecione um lote</option>{lots.map(lot=><option key={lot.id} value={lot.id}>Quadra {lot.quadra} • Lote {lot.number} • {fmt(polygonArea(lot.points))} m²</option>)}</select></label>
   {selectedLot&&<>
    <div className="gen-summary"><span>Área: <b>{fmt(polygonArea(selectedLot.points))} m²</b></span><span>Perímetro: <b>{fmt(polygonPerimeter(selectedLot.points))} m</b></span></div>
    {([['quadra','Quadra'],['number','Número do lote'],['usage','Uso'],['taxCode','Inscrição imobiliária'],['front','Confrontante da frente'],['back','Confrontante do fundo'],['left','Lado esquerdo'],['right','Lado direito']] as [keyof Lot,string][]).map(([key,label])=><label key={key} className="gen-control"><span>{label}</span><input value={String(selectedLot[key])} onChange={event=>updateLot(key,event.target.value)}/></label>)}
    <h3>Beneficiário</h3>
    {([['name','Nome completo'],['cpf','CPF'],['rg','RG'],['marital','Estado civil'],['spouse','Nome do cônjuge'],['income','Renda familiar (R$)']] as [keyof Occupant,string][]).map(([key,label])=><label key={key} className="gen-control"><span>{label}</span><input value={selectedLot.occupant[key]} onChange={event=>updateOccupant(key,event.target.value)}/></label>)}
    <button type="button" onClick={exportLote}>Baixar memorial deste lote (.docx)</button>
    <button type="button" onClick={()=>{if(confirm('Remover este lote do rascunho atual?')){setLots(current=>current.filter(lot=>lot.id!==selectedLot.id));setSelected('');}}}>Remover lote</button>
    <p className="gen-note">Os dados do beneficiário permanecem nesta sessão e não são enviados à API por este módulo.</p>
   </>}
  </>}
  {currentStep===4&&<>
   <h3>Conferência final</h3>
   <div className="gen-summary"><span>Modalidade: <b>{mode}</b></span><span>Núcleo: <b>{nui||'Não informado'}</b></span><span>Lotes: <b>{lots.length}</b></span><span>Quadras: <b>{shapes.filter(shape=>shape.category==='quadra').length}</b></span></div>
   <h3>Quadro de áreas</h3>
   <table className="gen-table"><thead><tr><th>Classe</th><th>Área (m²)</th><th>% da gleba</th></tr></thead><tbody>{byCategory.map(item=><tr key={item.category}><td>{item.label}</td><td>{fmt(item.area)}</td><td>{total?fmt(item.area/total*100):'—'}%</td></tr>)}<tr><th>Total contabilizado</th><th>{fmt(sum)}</th><th>{total?fmt(sum/total*100):'—'}%</th></tr><tr><th>Gleba</th><th>{fmt(total)}</th><th>{total?'100%':'—'}</th></tr></tbody></table>
   {total>0&&sum>total*1.0001&&<p className="gen-error">A soma das áreas supera a gleba. Existem possíveis sobreposições ou categorias duplicadas; revise antes da emissão.</p>}
   <Switch label="Cores por classe de uso" value={coloring} onChange={setColoring}/><Switch label="Exibir áreas dos lotes" value={showArea} onChange={setShowArea}/>
  </>}
  {error&&<p className="gen-error" role="status">{error}</p>}
 </GenerationWorkspace>;
}
