import {useState} from 'react';
import type {Feature,Geometry,GeoJsonProperties} from 'geojson';
import {splitPolygonByGuide,splitPolygonIntoLots} from './glebaGeometry';
import {measureMapGeometry} from './geometryMetrics';
import {toKml,toCsv,downloadText} from './mapFormats';
import {toShapefileZip,downloadBytes,zipFiles} from './shapefileExport';
import {X,Divide,Download,Trash2,CheckCircle2} from 'lucide-react';
import {requestConfirmation} from '../../components/ConfirmDialogHost';

type F=Feature<Geometry,GeoJsonProperties>;
const defaultPalette=['#2075db','#15a876','#a855f7','#ef8b25','#d84588','#17a9bf','#83a530','#c15e3c'];

export function GlebaPanel({
 features,
 selected,
 onClose,
 onCreate,
 onExtractManual,
 onChoose,
 onDraw,
 onStyleFeature,
 onRemoveFeature
}:{
 features:F[];
 selected:string|null;
 onClose:()=>void;
 onCreate:(children:F[],parentId:string,replaceParent?:boolean)=>void;
 onExtractManual:(parentId:string,childId:string)=>void;
 onChoose:(id:string)=>void;
 onDraw:(kind:'polygon'|'line',parentId:string)=>void;
 onStyleFeature?:(id:string,patch:Record<string,string|number|boolean>)=>void;
 onRemoveFeature?:(id:string)=>void;
}){
 const polygons=features.filter(f=>f.geometry.type==='Polygon');
 const [choice,setChoice]=useState(selected&&polygons.some(p=>String(p.id)===selected)?selected:String(polygons[0]?.id||''));
 const [guideId,setGuideId]=useState('');
 const [manualId,setManualId]=useState('');
 const manualGlebas=features.filter(f=>f.geometry.type==='Polygon'&&f.properties?.name==='Gleba manual'&&String(f.properties?.parentFeatureId||'')===choice);
 const extractableManualGlebas=manualGlebas.filter(f=>f.properties?.extractedFromParent!==true);
 const guides=features.filter(f=>f.geometry.type==='LineString'&&(f.properties?.category==='Linha guia (gleba)'||f.properties?.name!=='Medição'));
 const [count,setCount]=useState(2);
 const [mode,setMode]=useState<'equal'|'custom'|'cutline'>('equal');
 const [direction,setDirection]=useState<'0'|'1'|'angle'>('0');
 const [angleDeg,setAngleDeg]=useState(0);
 const [customAreas,setCustomAreas]=useState<string>('50, 50');
 const [hideParent,setHideParent]=useState(true);
 const [message,setMessage]=useState('');

 const selectedPoly=polygons.find(x=>String(x.id)===choice)||null;
 const selectedAreaHa=selectedPoly?measureMapGeometry(selectedPoly.geometry).areaM2/10000:0;

 const parseCustomTargets=(n:number):number[]|undefined=>{
  if(mode!=='custom')return undefined;
  const values=customAreas.split(/[;,\s]+/).map(s=>Number(s.replace(',','.'))).filter(v=>Number.isFinite(v)&&v>0);
  if(values.length!==n)throw new Error(`Informe ${n} valores de área ou proporção separados por vírgula (ex.: ${Array.from({length:n},()=>Math.max(1,Number((selectedAreaHa/n||10).toFixed(2)))).join(', ')}).`);
  return values;
 };

 const run=()=>{
  const f=polygons.find(x=>String(x.id)===choice);
  if(!f){setMessage('Selecione um polígono de origem.');return;}
  try{
   const targets=parseCustomTargets(count);
   const axis:0|1=direction==='1'?1:0;
   const lots=splitPolygonIntoLots(f,count,axis,{
    axis,
    angleDeg:direction==='angle'?angleDeg:undefined,
    targetAreasHa:targets
   });
   onCreate(lots,String(f.id),hideParent);
   setMessage(`${lots.length} glebas geradas e coloridas individualmente no mapa. Salve o projeto para usar nas Pranchas, Croquis e Memorial.`);
  }catch(error){
   setMessage(error instanceof Error?error.message:'Falha ao dividir gleba.');
  }
 };

 const runCut=()=>{
  const f=polygons.find(x=>String(x.id)===choice);
  const line=guides.find(x=>String(x.id)===guideId)||guides.at(-1);
  if(!f||!line){setMessage('Escolha o polígono e desenhe uma linha guia primeiro.');return;}
  try{
   const targets=mode==='custom'?parseCustomTargets(count):undefined;
   const lots=splitPolygonByGuide(f,line,{
    count:mode==='cutline'?2:count,
    directCut:mode==='cutline',
    targetAreasHa:targets
   });
   onCreate(lots,String(f.id),hideParent);
   setMessage(mode==='cutline'
    ?'Polígono dividido diretamente sobre a linha de corte.'
    :mode==='custom'
     ?`${lots.length} glebas geradas paralelas à orientação da linha guia, conforme as proporções de área informadas.`
     :`${lots.length} glebas de áreas iguais geradas com os cortes paralelos à linha guia.`);
  }catch(e){
   setMessage(e instanceof Error?e.message:'Recorte inválido.');
  }
 };

 const glebas=features.filter(f=>(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon')&&(f.properties?.category==='Gleba'||polygons.length>1));

 const exportGlebaGeoJson=(f:F)=>{
  const name=String(f.properties?.name||'gleba').toLowerCase().replace(/[^a-z0-9-_]+/gi,'-');
  downloadText(`${name}.geojson`,JSON.stringify({type:'FeatureCollection',features:[f]},null,2),'application/geo+json');
 };

 const exportGlebaZip=(f:F)=>{
  const name=String(f.properties?.name||'gleba').toLowerCase().replace(/[^a-z0-9-_]+/gi,'-');
  const areaHa=(measureMapGeometry(f.geometry).areaM2/10000).toFixed(4);
  downloadBytes(`${name}-perimetro.zip`,zipFiles({
   'dados.txt':`Nome: ${String(f.properties?.name||'Gleba')}\nÁrea estimada: ${areaHa} ha\n`,
   [`${name}.geojson`]:JSON.stringify({type:'FeatureCollection',features:[f]},null,2),
   [`${name}.kml`]:toKml([f]),
   [`${name}.csv`]:toCsv([f]),
   [`${name}-shapefile.zip`]:toShapefileZip([f])
  }));
 };

 const exportAllGlebasZip=()=>{
  const list=features.filter(f=>(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon')&&f.properties?.hidden!==true);
  if(!list.length){setMessage('Nenhuma área visível para exportar.');return;}
  const files:Record<string,string|Uint8Array>={
   'todas-as-glebas.geojson':JSON.stringify({type:'FeatureCollection',features:list},null,2),
   'todas-as-glebas.kml':toKml(list),
   'todas-as-glebas.csv':toCsv(list)
  };
  list.forEach((f,i)=>{
   const slug=String(f.properties?.name||`gleba-${i+1}`).toLowerCase().replace(/[^a-z0-9-_]+/gi,'-');
   files[`perimetros/${String(i+1).padStart(2,'0')}-${slug}.geojson`]=JSON.stringify({type:'FeatureCollection',features:[f]},null,2);
   files[`perimetros/${String(i+1).padStart(2,'0')}-${slug}.kml`]=toKml([f]);
  });
  downloadBytes('surveyor-glebas-individuais.zip',zipFiles(files));
  setMessage(`${list.length} perímetros exportados individualmente no pacote ZIP.`);
 };

 return <aside className="map-work-sidebar map-gleba-sidebar" aria-label="Definição de glebas">
  <header className="map-sidebar-title"><span className="map-sidebar-title-icon"><Divide size={20}/></span><strong>Gleba · Divisão e Extração</strong><button onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
  <div className="map-work-scroll">
   <section className="map-work-card map-gleba-form">
    <strong className="map-card-label">Definição da gleba</strong>
    <label>Polígono base
     <select value={choice} onChange={e=>{setChoice(e.target.value);onChoose(e.target.value);}}>
      <option value="">Selecione um polígono</option>
      {polygons.map((f,i)=><option key={String(f.id)} value={String(f.id)}>{String(f.properties?.name||`Polígono ${i+1}`)} ({(measureMapGeometry(f.geometry).areaM2/10000).toFixed(4)} ha)</option>)}
     </select>
    </label>
    <label>Modo de divisão
     <select value={mode} onChange={e=>setMode(e.target.value as 'equal'|'custom'|'cutline')}>
      <option value="equal">Áreas iguais (automático)</option>
      <option value="custom">Áreas personalizadas por gleba (ha ou %)</option>
      <option value="cutline">Corte exato sobre a linha desenhada</option>
     </select>
    </label>
    {mode!=='cutline'&&<label>Quantidade de glebas
     <input type="number" min={2} max={30} value={count} onChange={e=>setCount(Math.max(2,Math.min(30,Number(e.target.value)||2)))}/>
    </label>}
    {mode==='custom'&&<label>Áreas / proporções desejadas ({count} valores)
     <input value={customAreas} onChange={e=>setCustomAreas(e.target.value)} placeholder="Ex.: 12.5, 12.5, 25"/>
    </label>}
    <label>Eixo de avanço das faixas automáticas
     <select value={direction} onChange={e=>setDirection(e.target.value as '0'|'1'|'angle')}>
      <option value="0">Avanço Oeste → Leste · cortes verticais</option>
      <option value="1">Avanço Sul → Norte · cortes horizontais</option>
      <option value="angle">Ângulo do eixo de avanço (0°–360°)</option>
     </select>
    </label>
    {direction==='angle'&&<label>Ângulo do eixo de avanço ({angleDeg}°)
     <input type="range" min={0} max={360} step={1} value={angleDeg} onChange={e=>setAngleDeg(Number(e.target.value))}/>
    </label>}
    <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer'}}>
     <input type="checkbox" checked={hideParent} onChange={e=>setHideParent(e.target.checked)}/>
     Ocultar polígono-mãe após dividir (evitar sobreposição nas pranchas)
    </label>
    <button className="map-primary" disabled={!choice} onClick={run}>Gerar glebas por faixas</button>
    <div className="map-gleba-actions">
     <button type="button" onClick={()=>onDraw('line',choice)}>Desenhar linha de corte</button>
     <button type="button" onClick={()=>onDraw('polygon',choice)}>Desenhar gleba manual</button>
    </div>
    {extractableManualGlebas.length>0&&<div className="map-gleba-actions"><label>Gleba desenhada
     <select value={manualId} onChange={e=>setManualId(e.target.value)}><option value="">Última gleba manual</option>{extractableManualGlebas.map(f=><option key={String(f.id)} value={String(f.id)}>{String(f.properties?.name||f.id)}</option>)}</select>
    </label><button type="button" onClick={()=>{try{const childId=manualId||String(extractableManualGlebas.at(-1)?.id||'');const child=extractableManualGlebas.find(f=>String(f.id)===childId);if(!child){setMessage('Esta gleba já foi extraída do imóvel.');return;}onExtractManual(choice,childId);setMessage('Gleba extraída. A área original agora contém o recorte; salve o projeto.');}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível realizar o recorte.');}}}>Extrair gleba do imóvel</button></div>}
    <label>Linha guia / linha de corte
     <select value={guideId} onChange={e=>setGuideId(e.target.value)}>
      <option value="">{guides.length?'Última linha desenhada':'Nenhuma linha ainda'}</option>
      {guides.map((f,i)=><option key={String(f.id)} value={String(f.id)}>{String(f.properties?.name||`Linha de corte ${i+1}`)}</option>)}
     </select>
    </label>
    <button className="map-primary" disabled={!choice||!guides.length} onClick={runCut}>Aplicar corte pela linha guia</button>
    <p className="map-note">A linha guia define a orientação dos cortes paralelos. No modo automático, as áreas são equalizadas; os perímetros podem ter medidas diferentes. Perímetros côncavos compatíveis são preservados. Cada gleba recebe cor própria e pode ser emitida individualmente ou em conjunto nas Pranchas Técnicas, Mapas/Croquis e Memorial Descritivo.</p>
    {message&&<p className="map-gleba-feedback" role="status">{message}</p>}
   </section>
   <section className="map-work-card">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
     <strong className="map-card-label" style={{margin:0}}>Áreas e Glebas do Projeto ({glebas.length})</strong>
     {glebas.length>1&&<button type="button" className="map-outline" style={{fontSize:11,padding:'4px 8px'}} onClick={exportAllGlebasZip} title="Baixar cada perímetro separado em ZIP"><Download size={13}/> Extrair todas (.zip)</button>}
    </div>
    {glebas.length?glebas.map((f,idx)=>{
     const id=String(f.id);
     const color=String(f.properties?.fillColor||f.properties?.lotColor||defaultPalette[idx%defaultPalette.length]);
     const areaHa=measureMapGeometry(f.geometry).areaM2/10000;
     const isGleba=f.properties?.category==='Gleba';
     return <div key={id} className="map-gleba-item" style={{border:'1px solid #e2e8f0',borderRadius:8,padding:8,marginBottom:8,background:selected===id?'#f0f7ff':'#fff'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
       <input type="color" aria-label={`Cor de ${String(f.properties?.name||`Área ${idx+1}`)}`} value={/^#[0-9a-f]{6}$/i.test(color)?color:'#2075db'} onChange={e=>onStyleFeature?.(id,{fillColor:e.target.value,strokeColor:e.target.value,lotColor:e.target.value})} style={{width:24,height:24,padding:0,border:'none',cursor:'pointer',background:'transparent'}}/>
       <input value={String(f.properties?.name||`Área ${idx+1}`)} onChange={e=>onStyleFeature?.(id,{name:e.target.value})} style={{flex:1,fontSize:12,padding:'3px 6px',border:'1px solid #cbd5e1',borderRadius:5}}/>
       <button type="button" onClick={()=>onChoose(id)} title="Selecionar no mapa" style={{fontSize:11,padding:'3px 6px'}}>Focar</button>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,color:'#475569'}}>
       <span>{areaHa.toFixed(4)} ha {f.properties?.hidden?'(oculta)':''}</span>
       <div style={{display:'flex',gap:4}}>
        {isGleba&&onStyleFeature&&<button type="button" title="Converter em perímetro principal independente" onClick={()=>{onStyleFeature(id,{category:'Perímetro'});setMessage(`"${String(f.properties?.name||'Gleba')}" convertida em Perímetro independente.`);}} style={{padding:'2px 6px',fontSize:11}}><CheckCircle2 size={12}/> Perímetro</button>}
        <button type="button" title="Baixar GeoJSON deste perímetro" onClick={()=>exportGlebaGeoJson(f)} style={{padding:'2px 6px',fontSize:11}}>GeoJSON</button>
        <button type="button" title="Baixar pacote ZIP (GeoJSON, KML, CSV, SHP)" onClick={()=>exportGlebaZip(f)} style={{padding:'2px 6px',fontSize:11}}><Download size={12}/> ZIP</button>
        {onRemoveFeature&&<button type="button" title="Excluir esta área" onClick={()=>{const name=String(f.properties?.name||'esta área');void requestConfirmation({title:'Remover área?',message:`A área “${name}” será removida do projeto.`,confirmLabel:'Remover',destructive:true}).then(confirmed=>{if(confirmed)onRemoveFeature(id)});}} style={{padding:'2px 6px',color:'#dc2626'}}><Trash2 size={12}/></button>}
       </div>
      </div>
     </div>;
    }):<p className="map-note">Nenhuma gleba gerada ainda. Selecione um polígono acima e clique em Gerar glebas.</p>}
   </section>
  </div>
 </aside>;
}
