import { useMemo, useState } from 'react';
import {Dialog} from './Dialog';
import {requestConfirmation} from './ConfirmDialogHost';
import { directions, parseConfrontantText, suggestEdgeDirections, type Cardinal } from '../lib/confrontantPaste';
import './confrontant-import.css';

type Neighbor = {side:Cardinal;name:string;document:string};
type ImportedDetails={property:string;owner:string;cpf:string;rg:string;showProperty:boolean;showOwner:boolean;showCpf:boolean;showRg:boolean};
type Props = {
  vertices: number[][];
  names: string[];
  existing: string[];
  edgeLabels?:string[];
  edgeSides?:Cardinal[];
  onClose:()=>void;
  onApply:(result:{neighbors:string[];details:Record<string,ImportedDetails>})=>void;
};
export function ConfrontantImportDialog({vertices,names,existing,edgeLabels,edgeSides,onClose,onApply}:Props){
  const [raw,setRaw]=useState('');
  const parsed=useMemo(()=>parseConfrontantText(raw),[raw]);
  const [overrides,setOverrides]=useState<Record<number,Cardinal|'NONE'>>({});
  const [edits,setEdits]=useState<Record<Cardinal,Neighbor>>({} as Record<Cardinal,Neighbor>);
  const suggestions=useMemo(()=>edgeSides||suggestEdgeDirections(vertices),[vertices,edgeSides]);
  const bySide=Object.fromEntries(parsed.records.map(row=>[row.side,row])) as Partial<Record<Cardinal,Neighbor>>;
  const rows=directions.map(side=>edits[side]||bySide[side]).filter((v):v is Neighbor=>Boolean(v));
  const assignments=suggestions.map((direction,index)=>overrides[index]||direction);
  const previewCount=assignments.filter(side=>side!=='NONE'&&rows.some(v=>v.side===side)).length;
  const apply=async()=>{
    if(!rows.length||!previewCount)return;
    const neighbors=[...existing];const details:Record<string,ImportedDetails>={};
    for(let i=0;i<assignments.length;i++){
      const side=assignments[i];const match=rows.find(v=>v.side===side);
      if(!match)continue;
      neighbors[i]=match.name;
      details[String(i)]={property:match.name,owner:'',cpf:match.document,rg:'',showProperty:true,showOwner:false,showCpf:Boolean(match.document),showRg:false};
    }
    const changes=neighbors.filter((v,i)=>v!==existing[i]).length;
    if(!await requestConfirmation({title:'Aplicar confrontantes?',message:`Aplicar ${previewCount} segmento(s), com ${changes} substituição(ões) de nome? As posições dos rótulos e os vértices serão mantidos. Confira os lados antes de confirmar.`,confirmLabel:'Aplicar',destructive:false}))return;
    onApply({neighbors,details});
  };
  return <Dialog title="Importar confrontantes" description="Confira os nomes e os trechos antes de aplicar ao rascunho." onClose={onClose} className="sv-import-dialog" footer={<div className="sv-import-actions"><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="sv-import-primary" onClick={apply} disabled={!previewCount}>Aplicar ao rascunho</button></div>}>
      <label>Colar texto<textarea autoFocus value={raw} onChange={e=>{setRaw(e.target.value);setEdits({} as Record<Cardinal,Neighbor>);}} rows={5} maxLength={30000} placeholder={'NORTE - Nome completo - CPF\nSUL - Nome completo - CPF\nLESTE - Nome completo - CPF\nOESTE - Nome completo - CPF'}/></label>
      {parsed.warnings.length>0&&<div className="sv-import-warnings" role="status">{parsed.warnings.map((warn,i)=><div key={i}>{warn}</div>)}</div>}
      {rows.length>0&&<><strong>Dados reconhecidos</strong><div className="sv-import-cardinals">{rows.map(row=><div key={row.side} className="sv-import-cardinal"><b>{row.side}</b><input aria-label={`Nome ${row.side}`} value={row.name} onChange={e=>setEdits(prev=>({...prev,[row.side]:{...row,name:e.target.value}}))}/><input aria-label={`CPF ou CNPJ ${row.side}`} value={row.document} onChange={e=>setEdits(prev=>({...prev,[row.side]:{...row,document:e.target.value}}))}/></div>)}</div>
      <strong>Conferir trechos ({previewCount})</strong><div className="sv-import-edges">{assignments.map((side,index)=><label key={index}><span>{edgeLabels?.[index]||`${names[index]||`V-${index+1}`} → ${names[(index+1)%names.length]||`V-${(index+1)%names.length+1}`}`}</span><select aria-label={`Lado do trecho ${index+1}`} value={side} onChange={e=>setOverrides(prev=>({...prev,[index]:e.target.value as Cardinal|'NONE'}))}><option value="NONE">Não alterar</option>{directions.map(d=><option value={d} key={d}>{d}</option>)}</select></label>)}</div>
      </>}
  </Dialog>;
}
