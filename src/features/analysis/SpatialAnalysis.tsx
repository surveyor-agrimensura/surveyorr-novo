import {useMemo,useState} from 'react';
import {compareParcels,parcelFromFeature,validateParcel, type Parcel} from './topology';
import './spatialAnalysis.css';
type FeatureInput={id?:string|number;geometry:{type:string;coordinates?:unknown};properties?:Record<string,unknown>|null};
export function SpatialAnalysis({features,onClose,onFocus,onOverlay,onClear,onOpenGleba}:{features:FeatureInput[];onClose:()=>void;onFocus:(id:string)=>void;onOverlay:(a:string,b:string)=>void;onClear:()=>void;onOpenGleba?:(id:string)=>void}){
 const parcels=useMemo(()=>features.map((f,i)=>parcelFromFeature(f,i)).filter((p):p is Parcel=>p!==null),[features]);
 const [first,setFirst]=useState(''),[second,setSecond]=useState('');
 const a=parcels.find(p=>p.id===(first||parcels[0]?.id));
 const b=parcels.find(p=>p.id===(second||parcels.find(p=>p.id!==a?.id)?.id));
 const issues=useMemo(()=>parcels.flatMap(validateParcel),[parcels]);
 const comparison=useMemo(()=>{try{return {report:a&&b&&a.id!==b.id?compareParcels(a,b):null,error:''};}catch(error){return {report:null,error:error instanceof Error?error.message:'Falha ao comparar geometrias.'};}},[a,b]);
 const {report}=comparison;
 const unit=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
 return <div className="map-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="surveyor-spatial-dialog" role="dialog" aria-modal="true" aria-label="Análise espacial e comparação de levantamentos">
  <header><div><strong>Análise espacial de perímetros</strong><small>Comparação, possíveis sobreposições e frestas — somente leitura</small></div><button onClick={onClose} aria-label="Fechar">✕</button></header>
  <div className="surveyor-spatial-content">
   <p>Geometrias carregadas: <strong>{parcels.length}</strong>. Os cálculos abaixo são indicativos; nenhum vértice será alterado.</p>
   {parcels.length>0&&onOpenGleba&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 12px',background:'#f8fafc',border:'1px solid #cbd5e1',borderRadius:8,marginBottom:10}}><div><strong style={{display:'block',fontSize:13}}>Divisão de Glebas e Partilha de Áreas</strong><small style={{color:'#475569'}}>Divida qualquer perímetro selecionado em áreas iguais, áreas em ha, ângulo de corte ou linha guia no mapa.</small></div><button type="button" className="button primary" onClick={()=>onOpenGleba(a?.id||parcels[0].id)}>Abrir Divisão de Glebas no Mapa</button></div>}
   <div className="surveyor-spatial-summary"><b>{issues.filter(x=>x.kind==='error').length} erro(s)</b><b>{issues.filter(x=>x.kind==='warning').length} alerta(s)</b></div>
   <h3>Verificação técnica</h3>
   {issues.length===0?<p>Não foram identificados duplicados, abertura ou cruzamentos nos perímetros analisados. A conferência profissional permanece necessária.</p>:<ul>{issues.slice(0,35).map((issue,i)=><li key={i}><strong>{issue.title}</strong> — {issue.detail} <button onClick={()=>onFocus(issue.parcelId)}>Localizar</button></li>)}</ul>}
   <h3>Comparar levantamentos / analisar sobreposição</h3>
   {parcels.length<2?<p>Desenhe ou importe pelo menos dois polígonos para comparar. O levantamento original não será alterado.</p>:<>
   <div className="surveyor-spatial-controls"><label>Levantamento A<select value={a?.id||''} onChange={e=>setFirst(e.target.value)}>{parcels.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Levantamento B<select value={b?.id||''} onChange={e=>setSecond(e.target.value)}>{parcels.filter(p=>p.id!==a?.id).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div>
   {comparison.error&&<p role="alert">{comparison.error}</p>}
   {report&&<div className="surveyor-spatial-results"><div>Área A <strong>{unit(report.areaA)} m²</strong></div><div>Área B <strong>{unit(report.areaB)} m²</strong></div><div>Diferença B − A <strong>{unit(report.deltaArea)} m²</strong></div><div>Interseção estimada <strong>{unit(report.overlapM2)} m²</strong></div><div>Sobreposição estimada* <strong>{unit(report.overlapPercent)}%</strong></div><div>Possíveis ajustes de borda (até 20 cm) <strong>{report.gapCandidates}</strong></div><div>Menor afastamento suspeito <strong>{report.closestGap===null?'Não identificado':`${unit(report.closestGap)} m`}</strong></div><small>*Percentual relativo à menor das duas áreas. Estimativa numérica por amostragem; pequenas interseções podem escapar da detecção. Não usar para certificação ou regularização.</small></div>}
   <div className="surveyor-spatial-actions"><button onClick={()=>a&&b&&onOverlay(a.id,b.id)}>Sobrepor A e B no mapa</button><button onClick={onClear}>Remover sobreposição visual</button><button onClick={()=>a&&onFocus(a.id)}>Localizar A</button><button onClick={()=>b&&onFocus(b.id)}>Localizar B</button></div>
   </>}
   <p className="surveyor-spatial-warning">Snap automático desativado por segurança. Uma possível fresta não autoriza deslocar marcos ou substituir coordenadas medidas. Verifique o SRC e o datum dos levantamentos.</p>
  </div>
 </section></div>;
}
