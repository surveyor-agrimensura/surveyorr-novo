/** Importação assistida de confrontações. Não altera feições, coordenadas ou rótulos posicionados. */
export type Cardinal = 'NORTE' | 'SUL' | 'LESTE' | 'OESTE';
export type ImportedConfrontant = { side: Cardinal; name: string; document: string };
export type ImportResult = { records: ImportedConfrontant[]; warnings: string[] };
const cardinals: Record<string,Cardinal> = {
  N:'NORTE',NORTE:'NORTE',NORTH:'NORTE',S:'SUL',SUL:'SUL',SOUTH:'SUL',
  L:'LESTE',E:'LESTE',LESTE:'LESTE',ESTE:'LESTE',EAST:'LESTE',NASCENTE:'LESTE',
  O:'OESTE',W:'OESTE',OESTE:'OESTE',WEST:'OESTE',POENTE:'OESTE'
};
const heading = /(?:^|[\n;|])\s*(?:[-•]\s*)?\*{0,2}(NORTE|SUL|LESTE|OESTE|NASCENTE|POENTE|NORTH|SOUTH|EAST|WEST|N|S|L|O|E|W)\*{0,2}\s*(?:[:=\-–—.]\s*|\n\s*)/gim;
const identity = /\b(?:(?:CPF|CNPJ)\s*(?:n[º°o.]\s*)?[:\-]?\s*)?(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}|\d{11}|\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/]?\d{4}[-\s]?\d{2}|\d{14})\b/i;
export const directions: Cardinal[] = ['NORTE','SUL','LESTE','OESTE'];
export function parseConfrontantText(input: string):ImportResult {
  const warnings:string[]=[];
  if(input.length>30000)return {records:[],warnings:['Texto muito extenso (máximo: 30.000 caracteres).']};
  const cleaned=input.replace(/\r/g,'').replace(/[\t]+/g,' ');
  const matches=[...cleaned.matchAll(heading)];
  const bySide=new Map<Cardinal, ImportedConfrontant>();
  for(let i=0;i<matches.length;i++){
    const side=cardinals[matches[i][1].toUpperCase()];
    const content=cleaned.slice((matches[i].index||0)+matches[i][0].length, i+1<matches.length?(matches[i+1].index||0):cleaned.length)
      .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g,'').replace(/\s+/g,' ').trim();
    if(!content){warnings.push(`${side}: faltam os dados do confrontante.`);continue;}
    const found=content.match(identity);
    const document=found?.[1]||'';
    const name=content.replace(identity,'').replace(/\b(?:CPF|CNPJ)\s*(?:n[º°o.]\s*)?[:\-]?/gi,'').replace(/\(\s*\)/g,'').replace(/^[\s\-–—:]+|[\s\-–—:,]+$/g,'').trim();
    if(!name){warnings.push(`${side}: nome não identificado.`);continue;}
    if(bySide.has(side))warnings.push(`${side} repetido: verifique o registro que será utilizado.`);
    if(!document)warnings.push(`${side}: documento não identificado; você pode preencher depois.`);
    bySide.set(side,{side,name:name.slice(0,180),document});
  }
  if(!matches.length&&cleaned.trim())warnings.push('Nenhum lado reconhecido. Use NORTE, SUL, LESTE ou OESTE antes dos nomes.');
  return {records:directions.flatMap(side=>bySide.get(side)?[bySide.get(side)!]:[]),warnings};
}

/** Normal exterior do anel: mantém os segmentos reais e não confunde índices dos vértices com orientação. */
export function suggestEdgeDirections(vertices: readonly (readonly number[])[]):Cardinal[] {
  if(vertices.length<3)return [];
  const ring=vertices.length>3&&vertices[0][0]===vertices[vertices.length-1][0]&&vertices[0][1]===vertices[vertices.length-1][1]
    ?vertices.slice(0,-1):vertices;
  const latitude=ring.reduce((s,p)=>s+(p[1]||0),0)/ring.length;
  const xFactor=Math.cos(latitude*Math.PI/180);
  const xy=ring.map(p=>[p[0]*xFactor,p[1]]);
  let area=0;
  for(let i=0;i<xy.length;i++){const a=xy[i],b=xy[(i+1)%xy.length];area+=a[0]*b[1]-b[0]*a[1];}
  return xy.map((a,i)=>{
    const b=xy[(i+1)%xy.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const outwardX=area>=0?dy:-dy, outwardY=area>=0?-dx:dx;
    return Math.abs(outwardX)>Math.abs(outwardY)?outwardX>=0?'LESTE':'OESTE':outwardY>=0?'NORTE':'SUL';
  });
}
