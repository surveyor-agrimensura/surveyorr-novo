/** Edição CAD de anel externo WGS84, sem mutação. O fechamento é sempre único.
 * A ativação de subpontos é apenas uma opção visual; inserir ocorre só após arrastar.
 */
export type Vertex = number[];
export function openRing(coordinates: Vertex[]): Vertex[] {
  if (!Array.isArray(coordinates) || !coordinates.length) return [];
  const points = coordinates.map(p => p.slice());
  const first = points[0], last = points.at(-1)!;
  if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop();
  return points;
}
export function closeRing(points: Vertex[]): Vertex[] {
  if (points.length < 3) throw new Error('O perímetro exige pelo menos três vértices.');
  if (points.some(p => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90))
    throw new Error('Coordenadas inválidas no perímetro.');
  return [...points.map(p => p.slice()), points[0].slice()];
}
export function insertVertexOnEdge(ring: Vertex[], edge: number, next: Vertex): Vertex[] {
  if (!Number.isInteger(edge) || edge < 0 || edge >= ring.length) throw new Error('Trecho não encontrado.');
  return closeRing([...ring.slice(0, edge + 1), next, ...ring.slice(edge + 1)]);
}
export function removeVertexAt(ring: Vertex[], index: number): Vertex[] {
  if (ring.length <= 3) throw new Error('Não é possível remover vértice de um triângulo.');
  if (!Number.isInteger(index) || index < 0 || index >= ring.length) throw new Error('Vértice não encontrado.');
  return closeRing(ring.filter((_, i) => i !== index));
}

/** Substitui apenas o anel externo. Buracos e atributos não podem desaparecer
 * quando o usuário arrasta um vértice ou adiciona um subponto na borda. */
export function replaceExteriorRing(polygonRings: Vertex[][], exterior: Vertex[]): Vertex[][] {
  if (!polygonRings.length) throw new Error('Polígono sem anel externo.');
  return [closeRing(openRing(exterior)), ...polygonRings.slice(1).map(hole => hole.map(p => p.slice()))];
}

/** Confrontantes são vinculados ao trecho entre V-i e V-(i+1).
 * Reindexar os segmentos é obrigatório ao inserir/remover vértices.
 */
export function edgeKey(index:number,count:number):string{
 const next=(index+1)%count;
 return `${Math.min(index,next)}-${Math.max(index,next)}`;
}
type Attributes=Record<string,unknown>;
const attributes=(value:unknown):Attributes=>value&&typeof value==='object'&&!Array.isArray(value)?value as Attributes:{};
function edgeData(properties:Attributes,index:number,count:number){
 const labels=attributes(properties.confrontants),details=attributes(properties.confrontantDetails);
 return {label:labels[edgeKey(index,count)],details:details[String(index)]};
}
/** Inserção no segmento k: os dois novos segmentos herdam sua confrontação. */
export function segmentMetadataAfterInsert(properties:Attributes,edge:number,count:number):Attributes{
 if(!Number.isInteger(edge)||edge<0||edge>=count||count<3)throw new Error('Segmento de origem inválido.');
 const hasLabels=Object.prototype.hasOwnProperty.call(properties,'confrontants');
 const hasDetails=Object.prototype.hasOwnProperty.call(properties,'confrontantDetails');
 if(!hasLabels&&!hasDetails)return properties;
 const labels:Attributes={},details:Attributes={};
 for(let i=0;i<count+1;i++){
  const old=i<=edge?i:i===edge+1?edge:i-1;
  const source=edgeData(properties,old,count);
  if(source.label!==undefined)labels[edgeKey(i,count+1)]=source.label;
  if(source.details!==undefined)details[String(i)]=source.details;
 }
 return {...properties,...(hasLabels?{confrontants:labels}:{}),...(hasDetails?{confrontantDetails:details}:{})};
}
/** Remoção mescla dois trechos. Se confrontações diferirem, sinaliza revisão
 * e guarda o cadastro anterior, em vez de atribuir um vizinho incorreto. */
export function segmentMetadataAfterRemove(properties:Attributes,vertex:number,count:number):Attributes{
 if(!Number.isInteger(vertex)||vertex<0||vertex>=count||count<=3)throw new Error('Vértice inválido para remoção.');
 const hasLabels=Object.prototype.hasOwnProperty.call(properties,'confrontants');
 const hasDetails=Object.prototype.hasOwnProperty.call(properties,'confrontantDetails');
 if(!hasLabels&&!hasDetails)return properties;
 const remaining=Array.from({length:count},(_,i)=>i).filter(i=>i!==vertex);
 const labels:Attributes={},details:Attributes={};let review=false;
 for(let i=0;i<remaining.length;i++){
  const start=remaining[i],end=remaining[(i+1)%remaining.length];
  const first=edgeData(properties,start,count);
  let source=first;
  if((start+1)%count!==end){
   const second=edgeData(properties,(start+1)%count,count);
   if(JSON.stringify(first)!==JSON.stringify(second)){
    // A borda nova não pode receber automaticamente o confrontante errado.
    source={label:undefined,details:undefined};review=true;
   }
  }
  if(source.label!==undefined)labels[edgeKey(i,remaining.length)]=source.label;
  if(source.details!==undefined)details[String(i)]=source.details;
 }
 return {...properties,...(hasLabels?{confrontants:labels}:{}),...(hasDetails?{confrontantDetails:details}:{}),
  ...(review?{confrontantRevisaoPendente:true,confrontantCadastroAnterior:{vertexRemoved:vertex,vertexCount:count,confrontants:properties.confrontants,confrontantDetails:properties.confrontantDetails}}:{})};
}
