import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { distance } from '../memorial/memorialEngine';
import {parsePublicMapData,publicMapVertexCount} from './publicMapData';
import { RoundLogo } from '../../components/Brand';
import './public-map.css';
export function PublicMapPage() {
  const [params] = useSearchParams();
  const data = useMemo(() => parsePublicMapData(params.get('dados')), [params]);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const [street, setStreet] = useState(false);
  useEffect(() => {
    if (!data || !mapEl.current) return;
    const map = L.map(mapEl.current, {zoomControl: true, attributionControl: true, preferCanvas: true});
    const tiles = street
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    L.tileLayer(tiles, {maxZoom: 22, maxNativeZoom: 19, referrerPolicy:'strict-origin', attribution: street ? '© OpenStreetMap contributors' : 'Imagens © Esri e parceiros'}).addTo(map);
    const polygons = data.parts.map(rings=>L.polygon(rings.map(ring=>ring.map(([lng,lat])=>[lat,lng] as L.LatLngExpression)), {color:'#ed2222',weight:3,fillColor:'#ed2222',fillOpacity:.22}).addTo(map));
    const shapes=L.featureGroup(polygons);
    L.control.scale({metric:true,imperial:false}).addTo(map);
    map.fitBounds(shapes.getBounds(), {padding:[40,40], maxZoom:18});
    return () => {map.remove();};
  }, [data, street]);
  if (!data) return <main className="public-invalid"><h1>Mapa público indisponível</h1><p>Este endereço não contém as coordenadas válidas de um imóvel.</p></main>;
  const vertices=publicMapVertexCount(data.parts);
  const perimeter = data.parts.length===1?data.parts[0].reduce((sum,ring)=>sum+ring.reduce((ringSum,p,i)=>ringSum+distance(p,ring[(i+1)%ring.length]),0),0):null;
  return <main className="public-map-page">
    <header className="public-head"><div className="public-brand"><RoundLogo/><span className="public-brand-copy"><strong>SURVEYOR</strong><small>Georreferenciamento e Agrimensura</small></span></div><span className="public-page-label">Visualização pública do imóvel</span></header>
    <section className="public-content"><div className="public-heading"><div><h1>{data.n}</h1><p>Localização cartográfica do perímetro informado no SURVEYOR.</p></div><div className="public-switch"><button className={!street?'active':''} onClick={()=>setStreet(false)}>Satélite</button><button className={street?'active':''} onClick={()=>setStreet(true)}>Ruas</button></div></div>
    <div className="public-map" ref={mapEl} aria-label="Mapa geográfico público do imóvel"/>
    <div className="public-meta"><b>{data.parts.length} contorno(s) · {vertices} vértices</b>{perimeter!==null&&<b>{perimeter.toLocaleString('pt-BR',{maximumFractionDigits:2})} m de perímetro aproximado</b>}<span>Representação cartográfica informativa. Não substitui levantamento certificado.</span></div></section>
  </main>;
}
