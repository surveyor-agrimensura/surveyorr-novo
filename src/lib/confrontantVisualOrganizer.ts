/** Sugestão assistida: nunca modifica o cadastro sem confirmação explícita. */
export type ScreenPoint={x:number;y:number};
export type CandidateLabel={source:number;caption:string;position:ScreenPoint};
export type ConfrontantSuggestion={source:number;targets:number[];cardinal:'Norte'|'Sul'|'Leste'|'Oeste';caption:string;confidence:number};
const squared=(a:ScreenPoint,b:ScreenPoint)=>((a.x-b.x)**2+(a.y-b.y)**2);
/** Identidade visual não depende do índice da divisa. Não usar CPF como chave de exibição. */
export const confrontantPinKey=(name:string,prefix='')=>`${prefix}|${name.trim().normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('pt-BR')}`;
export type ConfrontantPins=Record<string,ScreenPoint>;
/** Um nome é desenhado só uma vez por gleba, mesmo que seus segmentos não sejam contíguos. */
export function uniqueConfrontantLabels<T extends {label:string}>(groups:readonly T[]):T[]{
 const seen=new Set<string>();return groups.filter(group=>{const key=confrontantPinKey(group.label);if(seen.has(key))return false;seen.add(key);return true;});
}
/** Congela a posição renderizada antes de reassociar a divisa, sem criar outro rótulo. */
export function captureConfrontantPins(svg:string,kind:'sheet'|'croqui',raw:readonly string[],prefix='',previous:ConfrontantPins={}):ConfrontantPins{
 const result={...previous};const captured=new Set<string>();
 for(const label of readConfrontantLabelPositions(svg,kind,prefix)){
  const value=raw[label.source]?.trim();if(!value)continue;
  const key=confrontantPinKey(value,prefix);if(!captured.has(key)){result[key]={...label.position};captured.add(key);}
 }
 return result;
}
/** Preserva cor, rotação e tamanho por nome quando a posição na barra é alterada. */
export function transferConfrontantAppearance(
 oldNames:readonly string[],newNames:readonly string[],prefix:string,
 source:Readonly<Record<string,number|string>>,defaultValue?:number|string
):Record<string,number|string>{
 const old=new Map<string,number|string>();
 oldNames.forEach((name,i)=>{const v=source[`${prefix}neighbor:${i}`];if(name?.trim()&&v!==undefined&&!old.has(confrontantPinKey(name,prefix)))old.set(confrontantPinKey(name,prefix),v);});
 const clean=Object.fromEntries(Object.entries(source).filter(([k])=>!new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}neighbor:\\d+$`).test(k)));
 const seen=new Set<string>();
 newNames.forEach((name,i)=>{const key=confrontantPinKey(name,prefix);if(!name?.trim()||seen.has(key))return;seen.add(key);const value=old.get(key);if(value!==undefined&&value!==defaultValue)clean[`${prefix}neighbor:${i}`]=value;});
 return clean;
}

/** Se um nome foi ocultado antes da organização, não volta a aparecer. */
export function transferHiddenConfrontantLabels(oldNames:readonly string[],newNames:readonly string[],prefix:string,hidden:readonly string[]):string[]{
 const hiddenIdentities=new Set(oldNames.map((name,i)=>hidden.includes(`${prefix}neighbor:${i}`)?confrontantPinKey(name,prefix):'').filter(Boolean));
 const result=hidden.filter(key=>!key.startsWith(`${prefix}neighbor:`));
 const seen=new Set<string>();
 newNames.forEach((name,i)=>{const id=confrontantPinKey(name,prefix);if(!name?.trim()||seen.has(id))return;seen.add(id);if(hiddenIdentities.has(id))result.push(`${prefix}neighbor:${i}`);});
 return result;
}
/** Usa a posição visual editada do rótulo como referência, não sua posição original no cadastro. */
export function suggestConfrontantByPosition(vertices:readonly ScreenPoint[],labels:readonly CandidateLabel[]):ConfrontantSuggestion[]{
 if(vertices.length<3)return [];
 const n=vertices.length,c={x:vertices.reduce((s,p)=>s+p.x,0)/n,y:vertices.reduce((s,p)=>s+p.y,0)/n};
 const segments=vertices.map((p,i)=>{const q=vertices[(i+1)%n],middle={x:(p.x+q.x)/2,y:(p.y+q.y)/2};return {i,middle};});
 const ordered=[...labels].filter(l=>l.caption.trim()).sort((a,b)=>a.source-b.source);
 const candidates=ordered.map(label=>{
  const v={x:label.position.x-c.x,y:label.position.y-c.y};
  const cardinal:ConfrontantSuggestion['cardinal']=Math.abs(v.x)>Math.abs(v.y)?(v.x>0?'Leste':'Oeste'):(v.y>0?'Sul':'Norte');
  const magnitude=Math.hypot(v.x,v.y)||1;
  return {...label,cardinal,vector:{x:v.x/magnitude,y:v.y/magnitude}};
 });
 const signed=vertices.reduce((sum,v,i)=>{const w=vertices[(i+1)%n];return sum+v.x*w.y-w.x*v.y;},0);
 const sign=signed>=0?1:-1;
 const group=new Map<number,{targets:number[];scores:number[]}>();
 candidates.forEach(label=>group.set(label.source,{targets:[],scores:[]}));
 const max=Math.max(40,Math.hypot(Math.max(...vertices.map(p=>p.x))-Math.min(...vertices.map(p=>p.x)),Math.max(...vertices.map(p=>p.y))-Math.min(...vertices.map(p=>p.y))));
 for(let i=0;i<n;i++){
  const p=vertices[i],q=vertices[(i+1)%n],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
  const normal={x:sign*dy/len,y:-sign*dx/len},middle=segments[i].middle;
  let winner:typeof candidates[number]|null=null,best=-Infinity;
  for(const label of candidates){
   const alignment=normal.x*label.vector.x+normal.y*label.vector.y;
   if(alignment<.55)continue;
   const proximity=Math.sqrt(squared(label.position,middle))/max;
   const score=alignment*2-proximity;
   if(score>best){best=score;winner=label;}
  }
  if(winner){const item=group.get(winner.source)!;item.targets.push(i);item.scores.push(Math.min(1,Math.max(0,(best+.5)/2)));}
 }
 return candidates.map(label=>{
  const {targets,scores}=group.get(label.source)!;
  return {source:label.source,targets,cardinal:label.cardinal,caption:label.caption,confidence:scores.length?scores.reduce((s,n)=>s+n,0)/scores.length:0};
 });
}
/** Retém todos os campos do cadastro (CPF, RG, proprietário, tipo de divisa). */
export function applyConfrontantSuggestions<T>(neighbors:readonly string[],details:Readonly<Record<string,T>>,suggestions:readonly ConfrontantSuggestion[],n:number):{neighbors:string[];details:Record<string,T>}{
 const result=Array.from({length:n},(_,i)=>neighbors[i]||'');
 const nextDetails={...details};
 const moved=suggestions.filter(s=>s.targets.some(i=>i>=0&&i<n)&&Boolean(neighbors[s.source]||s.caption));
 const movingNames=new Set(moved.map(s=>confrontantPinKey(neighbors[s.source]||s.caption)));
 const sourceValues=moved.map(s=>{
  const text=neighbors[s.source]||s.caption;
  // Um CPF preenchido em qualquer aresta do mesmo confrontante não pode sumir
  // apenas porque a primeira aresta do intervalo não tinha cadastro completo.
  const matching=Array.from({length:n},(_,i)=>i).filter(i=>confrontantPinKey(neighbors[i]||'')===confrontantPinKey(text));
  const records=[s.source,...matching.filter(i=>i!==s.source)].map(i=>details[String(i)]).filter((v):v is T=>v!==undefined);
  let detail: T|undefined=records[0];
  if(records.length>1&&records.every(v=>v&&typeof v==='object'&&!Array.isArray(v))){
   const merged:Record<string,unknown>={};
   for(const item of records)for(const [key,value] of Object.entries(item as object)){
    if(merged[key]===undefined||merged[key]===''||merged[key]===null)merged[key]=value;
   }
   detail=merged as T;
  }
  return {suggestion:s,text,detail};
 });
 // Limpa TODAS as arestas anteriormente associadas às pessoas movidas.
 // A operação anterior deixava nomes antigos em arestas intermediárias, duplicando-os.
 for(let i=0;i<n;i++)if(movingNames.has(confrontantPinKey(result[i]))){result[i]='';delete nextDetails[String(i)];}
 // Os campos auxiliares são levados junto com cada pessoa, nunca herdados da aresta anterior.
 for(const {suggestion,text,detail} of sourceValues){
  for(const target of new Set(suggestion.targets)){
   if(!Number.isInteger(target)||target<0||target>=n)continue;
   result[target]=text;
   if(detail!==undefined)nextDetails[String(target)]=detail;
   else delete nextDetails[String(target)];
  }
 }
 return {neighbors:result,details:nextDetails};
}
/** Recupera a posição efetivamente desenhada no SVG, inclusive após arraste. */
export function readConfrontantLabelPositions(svg:string,kind:'sheet'|'croqui',prefix=''):CandidateLabel[]{
 const tag=kind==='sheet'?'data-sheet-label':'data-croqui-label';
 const escaped=prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(`<text\\b(?=[^>]*${tag}="${escaped}neighbor:(\\d+)")[^>]*>`, 'g');
 const results:CandidateLabel[]=[];let match:RegExpExecArray|null;
 while((match=pattern.exec(svg))){const header=match[0],x=Number(/\sx="([+-]?[\d.]+)"/.exec(header)?.[1]),y=Number(/\bdata-(?:sheet|croqui)-visual-y="([+-]?[\d.]+)"/.exec(header)?.[1]??/\sy="([+-]?[\d.]+)"/.exec(header)?.[1]);if(!Number.isFinite(x)||!Number.isFinite(y))continue;
  results.push({source:Number(match[1]),caption:'',position:{x,y}});
 }
 return results;
}
