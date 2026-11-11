import {GlobalLoading} from '../../components/GlobalLoading';
import {useEffect,useRef,useState} from 'react';
import * as L from 'leaflet';
import type {Feature,Geometry} from 'geojson';
import 'leaflet/dist/leaflet.css';
import {Search, ShieldCheck, MapPinned, ExternalLink, Layers3, Download} from 'lucide-react';
import {GEOSERVICES_BASE} from '../map/geoServices';
import {toKml, downloadText} from '../map/mapFormats';
import './documents.css';

type Municipio={id:number;nome:string};
type CarFeature=Feature<Geometry,Record<string,unknown>>;
const SICAR_WFS='https://geoserver.car.gov.br/geoserver/sicar/ows';
const publicPortal='https://consultapublica.car.gov.br/publico/';
const trim=(value:unknown)=>typeof value==='string'||typeof value==='number'?String(value):'';
function carQuery(query:string){const params=new URLSearchParams({service:'WFS',version:'1.0.0',request:'GetFeature',typeName:'sicar:sicar_imoveis_ba',outputFormat:'application/json',srsName:'EPSG:4326',maxFeatures:'30'});params.set('CQL_FILTER',query);return `${SICAR_WFS}?${params}`;}
function escapeCql(s:string){return s.replace(/'/g,"''");}
export function PublicCarPage(){
 const [mode,setMode]=useState<'car'|'city'>('car'),[car,setCar]=useState(''),[city,setCity]=useState(''),[cities,setCities]=useState<Municipio[]>([]),[found,setFound]=useState<CarFeature[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(-1);
 const dom=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),polys=useRef<L.GeoJSON|null>(null);
 useEffect(()=>{let ok=true;fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/BA/municipios').then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(ok&&Array.isArray(data))setCities(data.map((x:{id:number;nome:string})=>({id:Number(x.id),nome:String(x.nome)})).filter(x=>x.id&&x.nome));}).catch(()=>{});return()=>{ok=false;};},[]);
 useEffect(()=>{if(!dom.current||map.current)return;const m=L.map(dom.current,{center:[-12.8,-41.7],zoom:7,zoomControl:false,attributionControl:true});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m);L.control.zoom({position:'topleft'}).addTo(m);map.current=m;return()=>{m.remove();map.current=null;};},[]);
 const showFeatures=(items:CarFeature[])=>{const m=map.current;if(!m)return;polys.current?.remove();polys.current=L.geoJSON(items as unknown as GeoJSON.GeoJsonObject,{style:()=>({color:'#dbb000',weight:2.5,fillColor:'#f0bf20',fillOpacity:.21})}).addTo(m);const bounds=polys.current.getBounds();if(bounds.isValid())m.fitBounds(bounds,{maxZoom:16,padding:[24,24]});};
 const search=async()=>{setFound([]);setSelected(-1);setError('');let cql='';if(mode==='car'){
  const reg=car.trim().toUpperCase();if(!/^[A-Z]{2}-\d{7}-[A-F0-9]{32}$/.test(reg)){setError('Informe um número CAR no formato UF-0000000-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.');return;}if(!reg.startsWith('BA-')){setError('Nesta versão, a consulta está configurada para o SICAR da Bahia.');return;}cql=`cod_imovel='${escapeCql(reg)}'`;
 }else{
  const municipality=cities.find(c=>c.nome.toLowerCase()===city.trim().toLowerCase());if(!municipality){setError('Selecione um município da lista do IBGE.');return;}cql=`cod_imovel LIKE 'BA-${municipality.id}-%'`;
 }
 setLoading(true);
 try{
  const controller=new AbortController();const t=setTimeout(()=>controller.abort(),18000);
  const upstream=carQuery(cql);
  const bytes=new TextEncoder().encode(upstream);
  const encoded=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
  const proxy=`${GEOSERVICES_BASE}/wfs-url/${encoded}`;
  let response:Response;
  try{
   try{response=await fetch(proxy,{signal:controller.signal});if(!response.ok)throw new Error('Proxy indisponível');}
   catch{response=await fetch(upstream,{signal:controller.signal});}
  }finally{clearTimeout(t);}
  if(!response.ok)throw new Error(`Serviço SICAR respondeu HTTP ${response.status}.`);
  const value=await response.json();if(!Array.isArray(value?.features))throw new Error('Resposta do serviço não contém dados cartográficos válidos.');
  const features=value.features.filter((item:CarFeature)=>item?.geometry&&item?.type==='Feature').slice(0,30) as CarFeature[];
  setFound(features);showFeatures(features);if(!features.length)setError('Nenhum imóvel encontrado no serviço público para estes critérios.');
 }catch(e){setError(e instanceof Error?`Consulta oficial indisponível: ${e.message}`:'Consulta oficial indisponível. Use o portal CAR.');}finally{setLoading(false);}
 };
 const select=(index:number)=>{setSelected(index);const item=found[index];if(item)showFeatures([item]);};
 return <main className="workspace-main doc-root car-root"><GlobalLoading active={loading} /><div className="workspace-container car-shell"><section className="car-search-panel"><div className="car-section-title"><ShieldCheck size={22}/><div><strong>Consulta Pública CAR</strong><span>Dados oficiais SICAR • Bahia</span></div></div><div className="car-modes"><button className={mode==='car'?'active':''} onClick={()=>setMode('car')}>Número do CAR</button><button className={mode==='city'?'active':''} onClick={()=>setMode('city')}>Município</button></div><div className="car-filters"><label>UF<select value="BA" disabled><option value="BA">BA — Bahia</option></select></label>{mode==='city'?<label>Município<input value={city} onChange={e=>setCity(e.target.value)} list="car-municipios" placeholder="Selecione ou digite o município"/><datalist id="car-municipios">{cities.map(c=><option key={c.id} value={c.nome}/>)}</datalist></label>:<label>Número de registro no CAR<input value={car} onChange={e=>setCar(e.target.value)} placeholder="BA-0000000-..." onKeyDown={e=>{if(e.key==='Enter')void search();}}/></label>}<button className="doc-primary" onClick={()=>void search()} disabled={loading}><Search size={16}/>{loading?'Pesquisando...':'Buscar CAR'}</button></div>{error&&<p className="car-message" role="status">{error} <a href={publicPortal} target="_blank" rel="noopener noreferrer">Abrir portal oficial <ExternalLink size={12}/></a></p>}</section><section className="car-results"><div className="car-section-title"><MapPinned size={20}/><div><strong>Imóveis cadastrados</strong><span>{found.length?`${found.length} registros retornados pelo SICAR`:'Nenhum registro carregado'}</span></div></div><div className="car-results-items">{found.map((f,i)=>{const p=f.properties||{};return <button key={i} className={selected===i?'active':''} onClick={()=>select(i)}><strong>{trim(p.nom_imovel||p.nome_imovel||p.cod_imovel||p.codigo)||`Imóvel ${i+1}`}</strong><span>{trim(p.cod_imovel||p.num_car||p.registro)||'Registro sem identificação pública'}</span></button>;})}{!found.length&&<a href={publicPortal} target="_blank" rel="noopener noreferrer">Consulta pública oficial do CAR <ExternalLink size={13}/></a>}</div></section><section className="car-map-panel"><div className="car-map-heading" style={{justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:8}}><Layers3 size={17}/> Geometria do imóvel <span>Mapa interativo</span></div>{found.length>0&&<div style={{display:'flex',gap:8}}><button type="button" className="doc-outline" style={{padding:'4px 10px',fontSize:12}} onClick={()=>{const items=selected>=0&&found[selected]?[found[selected]]:found;downloadText('sicar-imoveis.geojson',JSON.stringify({type:'FeatureCollection',features:items},null,2),'application/geo+json');}}><Download size={13}/> GeoJSON</button><button type="button" className="doc-outline" style={{padding:'4px 10px',fontSize:12}} onClick={()=>{const items=selected>=0&&found[selected]?[found[selected]]:found;downloadText('sicar-imoveis.kml',toKml(items),'application/vnd.google-earth.kml+xml');}}><Download size={13}/> KML</button></div>}</div><div ref={dom} className="car-leaflet"/></section></div></main>;
}
