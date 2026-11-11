import {normalizeSheet,type SheetSettings} from './technicalSheet';

/** Um rascunho de prancha pertence a uma conta, um projeto e uma geometria. */
export type LocalSheetDraft={settings:SheetSettings;pending:boolean;updatedAt:number};
export function sheetDraftKey(userId:string,projectId:string,featureId:string):string{
 return `surveyor:sheet:v1:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}:${encodeURIComponent(featureId)}`;
}
export function parseLocalSheetDraft(raw:string|null):LocalSheetDraft|null{
 if(!raw)return null;
 try{
  const candidate=JSON.parse(raw) as Record<string,unknown>;
  if(!candidate||typeof candidate!=='object'||!candidate.settings||typeof candidate.settings!=='object')return null;
  return {settings:normalizeSheet(candidate.settings),pending:candidate.pending===true,updatedAt:Number(candidate.updatedAt)||0};
 }catch{return null;}
}
export function sheetDraftMatches(expected:unknown,received:unknown):boolean{
 return JSON.stringify(normalizeSheet(expected))===JSON.stringify(normalizeSheet(received));
}
export function selectSheetDraft(cloud:SheetSettings,local:LocalSheetDraft|null):{settings:SheetSettings;recovered:boolean}{
 if(!local)return {settings:cloud,recovered:false};
 // Rascunhos ainda não confirmados jamais são descartados por uma resposta antiga da API.
 if(local.pending)return {settings:local.settings,recovered:true};
 if(local.settings.revision>cloud.revision)return {settings:local.settings,recovered:true};
 return {settings:cloud,recovered:false};
}
