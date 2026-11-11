import type {SurveyorSession} from '../auth/authService';
import {getDocumentCustomization,updateDocumentCustomization} from '../customization/customizationApi';
import {record} from '../memorial/memorialEngine';
import type {NeighborDetails} from '../memorial/croquiRenderer';
import {neighborText,readConfrontation} from '../croqui/croquiGeometry';

export type ConfrontantEntry={neighbors:string[];details:Record<string,NeighborDetails>};
export const blankConfrontants=():ConfrontantEntry=>({neighbors:[],details:{}});
export function readConfrontants(options:unknown,projectId:string,featureId:string):ConfrontantEntry|null {
 const raw=record(record(record(options).confrontantRegistry)[projectId])[featureId];
 const v=record(raw);
 if(!Object.keys(v).length)return null;
 return {neighbors:Array.isArray(v.neighbors)?v.neighbors.map(neighborText):[],details:record(v.details) as ConfrontantEntry['details']};
}
/** Cada projeto e imóvel compartilham os confrontantes da última edição salva na nuvem.
 * Não grava enquanto o usuário digita, apenas após confirmar o botão Salvar.
 */
export async function saveConfrontants(session:SurveyorSession,projectId:string,featureId:string,entry:ConfrontantEntry):Promise<void>{
 const saved={neighbors:[...entry.neighbors],details:{...entry.details}};
 await updateDocumentCustomization(session,(current)=>{
  const options=record(current.options),registry=record(options.confrontantRegistry),project=record(registry[projectId]);
  return {options:{confrontantRegistry:{...registry,[projectId]:{...project,[featureId]:saved}}}};
 });
 const remote=record((await getDocumentCustomization(session)).customization);
 const verify=readConfrontants(remote.options,projectId,featureId);
 if(JSON.stringify(verify)!==JSON.stringify(saved))throw new Error('A nuvem não confirmou o cadastro dos confrontantes.');
}
/** Reaproveita o que já está na geometria do projeto, mesmo que não haja cópia na personalização. */
export function fromProject(props:Record<string,unknown>,count:number):ConfrontantEntry {
 return {neighbors:Array.from({length:count},(_,i)=>readConfrontation(props,i,count)),details:record(props.confrontantDetails) as ConfrontantEntry['details']};
}
/** Exibe o cadastro editado em qualquer gerador, sem alterar automaticamente a geometria. */
export function mergeConfrontantsIntoProperties(props:Record<string,unknown>,count:number,entry:ConfrontantEntry|null):Record<string,unknown>{
 if(!entry)return props;
 const mapped={...record(props.confrontants)};
 for(let i=0;i<Math.min(count,entry.neighbors.length);i++){
  const next=(i+1)%count;
  mapped[`${Math.min(i,next)}-${Math.max(i,next)}`]=entry.neighbors[i];
 }
 return {...props,confrontants:mapped,confrontantDetails:{...record(props.confrontantDetails),...entry.details}};
}
