/** Serviços públicos identificados no SURVEYOR RC185.72, sem tokens embutidos. */
export const GEOSERVICES_BASE = (import.meta.env.VITE_GEOSERVICES_URL || 'https://tiny-king-d719georural-geoservices.kaualucasfrancasantos.workers.dev').replace(/\/$/, '');
export type OfficialLayer = {id:string;name:string;group:string;source:string;url:string;layers:string;uf?:string; color?:string};
const INEMA = 'https://geoserver.inema.ba.gov.br/geoserver/wms';
const SICAR = 'https://geoserver.car.gov.br/geoserver/sicar/wms';
const src='Vetor_Recortes_Tematicos:';
const officialColors:Record<string,string>={
 'cefir-limite':'#d7ae05','cefir-app':'#41ad57','cefir-reserva':'#159765',
 'cefir-vegetacao':'#198c48','cefir-atividade':'#d88b35','cefir-rppn':'#1b81aa',
 'assentamento-limite':'#965cc5','assentamento-app':'#7bb643',
 'assentamento-reserva':'#3d9f7e','pct-limite':'#bc6795','pct-app':'#54a0a6',
 'arqueologico':'#ca6c39','arqueologico-pol':'#d39635'
};
const item=(id:string,name:string,group:string,layer:string):OfficialLayer=>({id,name,group,source:'INEMA / GeoBahia',url:INEMA,layers:src+layer,uf:'BA',color:officialColors[id]||'#497caf'});
export const BAHIA_LAYERS:OfficialLayer[] = [
 item('cefir-limite','Imóvel Rural – Limites de Propriedade','CAR / SICAR – Limites de Propriedade','cefir_imovel_rural_limite_inema'),
 item('cefir-app','Áreas de Preservação Permanente (APP)','1. CEFIR – Imóveis Rurais','cefir_imovel_rural_app_inema'),
 item('cefir-reserva','Reserva Legal','1. CEFIR – Imóveis Rurais','cefir_imovel_rural_reserva_legal_inema'),
 item('cefir-vegetacao','Vegetação Nativa','1. CEFIR – Imóveis Rurais','cefir_imovel_rural_vegetacao_nativa_inema'),
 item('cefir-atividade','Atividade Desenvolvida','1. CEFIR – Imóveis Rurais','cefir_imovel_rural_atividade_desenvolvida_inema'),
 item('cefir-rppn','Reserva Particular do Patrimônio Natural','1. CEFIR – Imóveis Rurais','cefir_imovel_rural_rppn_inema'),
 item('assentamento-limite','Assentamentos – Limites','2. CEFIR – Assentamentos','cefir_assentamento_limite_inema'),
 item('assentamento-app','Assentamentos – APP','2. CEFIR – Assentamentos','cefir_assentamento_app_inema'),
 item('assentamento-reserva','Assentamentos – Reserva Legal','2. CEFIR – Assentamentos','cefir_assentamento_reserva_legal_inema'),
 item('pct-limite','Povos e Comunidades Tradicionais – Limites','3. CEFIR – PCT','cefir_pct_limite_inema'),
 item('pct-app','Povos e Comunidades Tradicionais – APP','3. CEFIR – PCT','cefir_pct_app_inema'),
 item('arqueologico','Sítios arqueológicos','4. Áreas Protegidas e Culturais','sitios_arqueologicos_iphan_pt'),
 item('arqueologico-pol','Áreas arqueológicas','4. Áreas Protegidas e Culturais','sitios_arqueologicos_iphan_pol'),
];
export const GEO_GROUPS = ['CAR / SICAR – Limites de Propriedade','INCRA / Acervo Fundiário','1. CEFIR – Imóveis Rurais','2. CEFIR – Assentamentos','3. CEFIR – PCT','4. Áreas Protegidas e Culturais','5. Áreas de Restrição','6. Zoneamentos de Unidades de Conservação','7. Biodiversidade e Vegetação','8. Gestão Territorial e Malha','9. Recursos Hídricos','10. Recursos Naturais'];
export function layersForUF(uf:string):OfficialLayer[]{
 if(uf.toUpperCase()==='BA')return BAHIA_LAYERS;
 if(!/^[A-Z]{2}$/.test(uf.toUpperCase()))return [];
 return [{id:`sicar-${uf.toLowerCase()}`,name:`Imóveis rurais – SICAR / ${uf.toUpperCase()}`,group:GEO_GROUPS[0],source:'SICAR / SFB',url:SICAR,layers:`sicar:sicar_imoveis_${uf.toLowerCase()}`,uf,color:'#d0b200'}];
}
/** O Worker permite /wms?target=<endpoint>, com opções WMS na query externa. */
export function layerProxyUrl(layer:OfficialLayer){return `${GEOSERVICES_BASE}/wms?target=${encodeURIComponent(layer.url)}`;}
/** Legenda WMS publicada pela fonte. */
export function officialLayerLegendUrl(layer:OfficialLayer){return `${layerProxyUrl(layer)}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${encodeURIComponent(layer.layers)}&WIDTH=20&HEIGHT=20`;}
export function haversine(a:[number,number],b:[number,number]){
 const rad=Math.PI/180, dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
/** Área esférica aproximada (m²), não substitui cálculo geodésico certificado. */
export function polygonMeasures(coords:number[][]){
 if(coords.length<3)return {area:0,perimeter:0};
 const ring=coords.slice();if(ring.length>1&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1])ring.pop();
 let sum=0,peri=0;for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];peri+=haversine([a[1],a[0]],[b[1],b[0]]);
  const latA=a[1]*Math.PI/180,latB=b[1]*Math.PI/180,u=(latB-latA)/2;
  const sinc=Math.abs(u)<1e-4?1-u*u/6+u*u*u*u/120:Math.sin(u)/u;
  sum+=(b[0]-a[0])*Math.PI/180*Math.sin((latA+latB)/2)*sinc;
 }
 return {area:Math.abs(sum)*6378137**2,perimeter:peri};
}
