import {mapAppearancePatch} from '../croqui/sharedMapAppearance';
import { saveScopedDocumentCustomization } from '../customization/customizationApi';
import type { SurveyorSession } from '../auth/authService';
import { record } from '../memorial/memorialEngine';

export type DocumentKind = 'technicalSheets' | 'confrontationLetters' | 'memorial';
export function readProjectDocumentIdentity(options:unknown,projectId:string):Record<string,unknown>{
 return record(record(record(options).documentIdentityByProject)[projectId]);
}
/** Rascunhos antigos sem ID de feição só são recuperados automaticamente
 * quando há um único imóvel: em projetos com múltiplos polígonos seria
 * impossível atribuir a edição de forma segura ao terreno correto.
 */
export function readDocumentDraft(options:unknown,kind:DocumentKind,projectId:string,featureId='',allowLegacy=true): Record<string,unknown> {
 const opts=record(options);
 if((kind==='technicalSheets'||kind==='memorial')&&featureId){
  const item=record(record(record(record(opts.generatedDocumentDraftsByFeature)[kind])[projectId])[featureId]);
  if(Object.keys(item).length)return item;
  if(!allowLegacy)return {};
 }
 return record(record(record(opts.generatedDocumentDrafts)[kind])[projectId]);
}
/** Salva por projeto e por polígono para Croqui técnico/Memorial. A leitura posterior
 * comprova a versão que foi persistida, sem confundir rascunho local e nuvem.
 */
export async function saveDocumentDraft(session:SurveyorSession,kind:DocumentKind,projectId:string,data:Record<string,unknown>,featureId=''):Promise<void>{
 const payload:Record<string,unknown>={kind,projectId,featureId,data};
 if(kind==='technicalSheets'&&featureId){
  // Uma única aparência da gleba, não o mapa de todos os projetos do usuário.
  const mapSource={polygonFill:typeof data.polygonFill==='string'?data.polygonFill:undefined,
   polygonStroke:typeof data.polygonStroke==='string'?data.polygonStroke:undefined,
   polygonStrokeWidth:typeof data.polygonStrokeWidth==='number'?data.polygonStrokeWidth:undefined,
   divisionColors:record(data.divisionColors) as Record<string,string>,
   mapNames:Array.isArray(data.mapNames)?data.mapNames as import('../croqui/sharedMapAppearance').MapName[]:undefined};
  const patch=mapAppearancePatch({},projectId,featureId,mapSource);
  payload.mapAppearance=record(record(record(patch.mapAppearanceByFeature)[projectId])[featureId]);
 }
 // A Function reabre o registro do Appwrite antes de responder 200.
 // O editor faz somente uma releitura ao final, sem baixar todas as preferencias duas vezes.
 await saveScopedDocumentCustomization(session,payload);
}

