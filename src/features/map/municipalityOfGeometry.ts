import type {Feature,Geometry,GeoJsonProperties} from 'geojson';
type MapFeature=Feature<Geometry,GeoJsonProperties>;
/** Amostragem interior do primeiro polígono desenhado. Evita usar o centro atual da tela/município de entrada. */
export function locationForDrawnPolygon(features:readonly MapFeature[]):{lat:number;lon:number}|null {
 const polygons=features.filter(f=>f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon');
 if(polygons.length!==1)return null; // Não inferir município de dois imóveis distintos.
 const geom=polygons[0].geometry;
 const polygon=geom.type==='Polygon'?geom.coordinates:geom.type==='MultiPolygon'?geom.coordinates[0]:[];
 const ring=(polygon[0]||[]).filter(v=>v.length>=2&&Number.isFinite(v[0])&&Number.isFinite(v[1]));
 if(ring.length<3)return null;
 // O maior intervalo interior no scanline central, respeitando a concavidade.
 const lat=(Math.min(...ring.map(p=>p[1]))+Math.max(...ring.map(p=>p[1])))/2;
 const crossings:number[]=[];
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  if((a[1]>lat)!==(b[1]>lat))crossings.push(a[0]+(lat-a[1])*(b[0]-a[0])/(b[1]-a[1]));
 }
 crossings.sort((a,b)=>a-b);
 let best:{a:number;b:number}|null=null;
 for(let i=0;i+1<crossings.length;i+=2){
  const a=crossings[i],b=crossings[i+1];if(!best||b-a>best.b-best.a)best={a,b};
 }
 if(best)return {lat,lon:(best.a+best.b)/2};
 return {lat:ring[0][1],lon:ring[0][0]};
}
export type MunicipalityResult={city:string;uf:string;source:'perimeter-reverse-geocoding'};
/** Consulta pela geometria, nunca pela cidade escolhida para abrir o mapa. */
export async function municipalityAtLocation(location:{lat:number;lon:number},signal?:AbortSignal):Promise<MunicipalityResult> {
 const cacheKey=`surveyor-municipality-reverse:${location.lat.toFixed(5)}:${location.lon.toFixed(5)}`;
 try{const hit=JSON.parse(sessionStorage.getItem(cacheKey)||'null') as {value:MunicipalityResult;until:number}|null;
  if(hit&&hit.until>Date.now()&&hit.value.city&&hit.value.uf)return hit.value;
 }catch{/* armazenamento opcional */}
 const url=new URL('https://nominatim.openstreetmap.org/reverse');
 url.searchParams.set('lat',String(location.lat));url.searchParams.set('lon',String(location.lon));
 url.searchParams.set('format','jsonv2');url.searchParams.set('addressdetails','1');url.searchParams.set('zoom','10');url.searchParams.set('accept-language','pt-BR');
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),9000);
 signal?.addEventListener('abort',()=>ctrl.abort(),{once:true});
 try{
  const response=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`Consulta municipal retornou HTTP ${response.status}.`);
  const body=await response.json() as {address?:Record<string,string>};
  const a=body.address||{};
  const city=String(a.municipality||a.city||a.town||a.village||a.county||'').trim();
  const code=String(a['ISO3166-2-lvl4']||'').toUpperCase();
  const states:Record<string,string>={'ACRE':'AC','ALAGOAS':'AL','AMAPA':'AP','AMAPÁ':'AP','AMAZONAS':'AM','BAHIA':'BA','CEARA':'CE','CEARÁ':'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES','ESPÍRITO SANTO':'ES','GOIAS':'GO','GOIÁS':'GO','MARANHAO':'MA','MARANHÃO':'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG','PARA':'PA','PARÁ':'PA','PARAIBA':'PB','PARAÍBA':'PB','PARANA':'PR','PARANÁ':'PR','PERNAMBUCO':'PE','PIAUI':'PI','PIAUÍ':'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS','RONDONIA':'RO','RONDÔNIA':'RO','RORAIMA':'RR','SANTA CATARINA':'SC','SAO PAULO':'SP','SÃO PAULO':'SP','SERGIPE':'SE','TOCANTINS':'TO'};
  const stateCode=String(a.state_code||'').toUpperCase();
  const uf=/^BR-[A-Z]{2}$/.test(code)?code.slice(3):/^[A-Z]{2}$/.test(stateCode)?stateCode:states[String(a.state||'').trim().toUpperCase()]||'';
  if(a.country_code!=='br'||!city||!uf)throw new Error('O serviço não confirmou município e UF brasileiros para o perímetro.');
  const value:MunicipalityResult={city,uf,source:'perimeter-reverse-geocoding'};
  try{sessionStorage.setItem(cacheKey,JSON.stringify({value,until:Date.now()+24*60*60*1000}));}catch{/* armazenamento opcional */}
  return value;
 } finally {clearTimeout(timer);}
}
