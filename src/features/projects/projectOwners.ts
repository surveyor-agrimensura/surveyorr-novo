import { formatBrazilianDocument, formatBrazilianRg } from '../../lib/documentIdentity';

type OwnerRecord = {name:string;cpf:string;rg:string};
type ProjectLike = {owner?:string;ownerName?:string;metadata?:Record<string,unknown>} | null | undefined;
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v).trim():'';
const parse=(v:unknown):OwnerRecord=>{
 const p=obj(v);
 return {name:str(typeof v==='string'?v:p.name||p.ownerName||p.owner||p.nome),cpf:str(p.cpf||p.ownerCpf||p.document),rg:str(p.rg||p.ownerRg)};
};
/** Reads both current additionalOwners and old second-owner fields. Never invents an owner. */
export function projectOwners(project:ProjectLike, fallbackOwner=''):OwnerRecord[]{
 const meta=obj(project?.metadata), rawProject=obj(project);
 const first:OwnerRecord={name:str(fallbackOwner||project?.ownerName||project?.owner||meta.ownerName||meta.owner),cpf:str(meta.ownerCpf||rawProject.ownerCpf),rg:str(meta.ownerRg||rawProject.ownerRg)};
 const inputs:unknown[]=[];
 for(const collection of [meta.additionalOwners,rawProject.additionalOwners,meta.coOwners]){
  if(Array.isArray(collection))inputs.push(...collection);
 }
 // Old SURVEYOR could store a second holder separately.
 const legacy=str(meta.owner2||meta.secondOwnerName||meta.secondOwner||rawProject.owner2||rawProject.secondOwnerName);
 if(legacy)inputs.push({name:legacy,cpf:meta.owner2Cpf||meta.secondOwnerCpf,rg:meta.owner2Rg});
 const result:OwnerRecord[]=[];
 for(const entry of [first,...inputs.map(parse)]){
  const owner={...entry,cpf:entry.cpf?formatBrazilianDocument(entry.cpf):'',rg:entry.rg?formatBrazilianRg(entry.rg):''};
  if(!owner.name)continue;
  const key=owner.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const previous=result.find(item=>item.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()===key);
  if(previous){if(!previous.cpf)previous.cpf=owner.cpf;if(!previous.rg)previous.rg=owner.rg;continue;}
  result.push(owner);
 }
 return result;
}
export function additionalProjectOwners(project:ProjectLike):OwnerRecord[]{
 return projectOwners(project).slice(1);
}
