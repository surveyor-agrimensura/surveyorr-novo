/** Distribuição determinística de rótulos técnicos no sistema de coordenadas do SVG.
 * Todos os elementos mantêm sua geometria original. Somente os textos são distribuídos.
 */
export type LabelPoint={x:number;y:number};
export type TechnicalLabel={
 key:string; text:string; anchor:LabelPoint; preferred:LabelPoint;
 normal:LabelPoint; tangent:LabelPoint; size:number; angle:number;
 priority:number; manual?:boolean;
};
export type PlacedLabel=TechnicalLabel & {position:LabelPoint; displaced:boolean};
export type LayoutResult={visible:PlacedLabel[];hidden:string[]};
export type LayoutBounds={left:number;top:number;right:number;bottom:number};

type Box={left:number;top:number;right:number;bottom:number};
const intersects=(a:Box,b:Box,pad=2)=>a.left<b.right+pad&&a.right+pad>b.left&&a.top<b.bottom+pad&&a.bottom+pad>b.top;
const inside=(a:Box,b:LayoutBounds)=>a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;
const boxFor=(text:string,point:LabelPoint,size:number,angle:number):Box=>{
 // Nomes usam caracteres variáveis; maior margem para texto técnico legível.
 const rows=text.split('\n');
 const width=Math.max(size*1.3,...rows.map(row=>row.length*size*.63+2));
 const height=size*(rows.length>1?1.36*rows.length:1.37);
 const radians=angle*Math.PI/180;
 const w=Math.abs(width*Math.cos(radians))+Math.abs(height*Math.sin(radians));
 const h=Math.abs(width*Math.sin(radians))+Math.abs(height*Math.cos(radians));
 return {left:point.x-w/2,right:point.x+w/2,top:point.y-h/2,bottom:point.y+h/2};
};
const norm=(v:LabelPoint)=>{const len=Math.hypot(v.x,v.y);return len<1e-5?{x:0,y:-1}:{x:v.x/len,y:v.y/len};};
/**
 * Rótulos livres são posicionados primeiro por relevância visual.
 * Em áreas densas, tenta até 105 posições externas antes de omitir SOMENTE o texto.
 * O traço da cota, os pontos e os valores do projeto nunca são eliminados.
 * Deslocamentos manuais são respeitados (mesmo quando se cruzam).
 */
export function placeTechnicalLabels(labels:TechnicalLabel[],bounds:LayoutBounds,adaptive=true):LayoutResult{
 const visible:PlacedLabel[]=[],hidden:string[]=[],occupied:Box[]=[];
 const order=[...labels].sort((a,b)=>Number(Boolean(b.manual))-Number(Boolean(a.manual))||b.priority-a.priority||a.key.localeCompare(b.key));
 for(const label of order){
  const n=norm(label.normal),t=norm(label.tangent);
  const candidates:LabelPoint[]=[label.preferred];
  if(adaptive&&!label.manual){
   const across=[0,-12,12,-25,25,-39,39,-55,55,-75,75];
   // Posições em bandas progressivas no exterior do terreno.
   const bands=label.key.startsWith('cota:')?[9,18,28,39,50]:label.key.startsWith('vertex:')?[9,19,29,42,56]:[12,24,38,54,68];
   const shifts=label.key.startsWith('cota:')?across.slice(0,5):across;
   for(const outward of bands)for(const side of shifts){
    candidates.push({x:label.preferred.x+n.x*outward+t.x*side,y:label.preferred.y+n.y*outward+t.y*side});
   }
  }
  let found:LabelPoint|null=null,area:Box|null=null;
  for(const p of candidates){
   const box=boxFor(label.text,p,label.size,label.angle);
   if(!adaptive||label.manual||inside(box,bounds)&&!occupied.some(old=>intersects(box,old,2.5))){found=p;area=box;break;}
  }
  if(!found||!area){hidden.push(label.key);continue;}
  visible.push({...label,position:found,displaced:Math.hypot(found.x-label.preferred.x,found.y-label.preferred.y)>24});
  occupied.push(area);
 }
 return {visible,hidden};
}

/**
 * Apresentação compacta do croqui, sem linhas-guia nem deslocamento automático.
 * Mantém TODOS os rótulos nas posições originais (inclusive os arrastados à mão)
 * e reduz apenas a fonte dos textos automáticos quando há colisões próximas.
 * Cotas e coordenadas não são modificadas nem removidas.
 */
export function placeCompactCroquiLabels(labels:TechnicalLabel[],compact=true,cullDense=false):LayoutResult {
 const placed=labels.map(label=>({...label,position:{...label.preferred},displaced:false,size:label.size}));
 if(compact){
  const minSize=(label:TechnicalLabel)=>label.key.startsWith('cota:')?3.3:label.key.startsWith('vertex:')?4.4:5;
  // Respeita totalmente textos que o usuário já posicionou manualmente.
  for(let pass=0;pass<16;pass++){
   let changed=false;
   for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
    const a=placed[i],b=placed[j];
    if(!intersects(boxFor(a.text,a.position,a.size,a.angle),boxFor(b.text,b.position,b.size,b.angle),1))continue;
    // Se ambos forem manuais, as posições e fontes escolhidas prevalecem.
    if(a.manual&&b.manual)continue;
    const first=a.manual?b:b.manual?a:a.priority<=b.priority?a:b;
    const second=first===a?b:a;
    const chosen=first.size>minSize(first)+.01?first:second.manual?null:second.size>minSize(second)+.01?second:null;
    if(chosen){chosen.size=Math.max(minSize(chosen),chosen.size*.89);changed=true;}
   }
   if(!changed)break;
  }
  // Em polígonos densos, se após reduzir a fonte ainda houver sobreposição severa,
  // tenta primeiro deslocar suavemente ao longo da normal/tangente e oculta apenas
  // cotas/vértices intermediários automáticos que continuem colidindo.
  if(cullDense&&placed.length>28){
   const order=[...placed].sort((a,b)=>Number(Boolean(b.manual))-Number(Boolean(a.manual))||b.priority-a.priority||a.key.localeCompare(b.key));
   const visible:PlacedLabel[]=[],hidden:string[]=[],occupied:Box[]=[];
   for(const item of order){
    const isNeighbor=item.key.startsWith('neighbor:')||item.key.startsWith('cpf:');
    if(item.manual||isNeighbor){
     const box=boxFor(item.text,item.position,item.size,item.angle);
     visible.push(item);occupied.push(box);continue;
    }
    const n=norm(item.normal),t=norm(item.tangent);
    const shifts=item.key.startsWith('cota:')?[[0,0],[5,0],[11,0],[6,-8],[6,8],[14,-10],[14,10]]:[[0,0],[6,0],[12,0],[8,-9],[8,9],[16,-12],[16,12],[22,0]];
    let chosenPos:LabelPoint|null=null,chosenBox:Box|null=null;
    for(const [outward,side] of shifts){
     const cand={x:item.position.x+n.x*outward+t.x*side,y:item.position.y+n.y*outward+t.y*side};
     const box=boxFor(item.text,cand,item.size,item.angle);
     if(!occupied.some(old=>intersects(box,old,1.4))){chosenPos=cand;chosenBox=box;break;}
    }
    if(!chosenPos||!chosenBox){hidden.push(item.key);continue;}
    visible.push({...item,position:chosenPos,displaced:Math.hypot(chosenPos.x-item.preferred.x,chosenPos.y-item.preferred.y)>18});
    occupied.push(chosenBox);
   }
   return {visible,hidden};
  }
 }
 return {visible:placed,hidden:[]};
}
