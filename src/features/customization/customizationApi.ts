import { ApiError } from '../../lib/api';
import { authenticatedRequest } from '../../lib/authenticatedRequest';
import type { SurveyorSession } from '../auth/authService';

export type DocumentCustomizationResult = { customization?: Record<string, unknown> };

/** O backend persiste opções das gerações dentro de `documentOptions`.
 * As telas antigas liam `options.croquiDraftsByFeature`, etc. diretamente.
 * A visão combinada preserva chaves antigas e dá precedência à versão
 * persistida em documentOptions, sem modificar o conteúdo no servidor.
 */
export function normalizeDocumentCustomization(result:DocumentCustomizationResult):DocumentCustomizationResult{
 const customization=result.customization;
 if(!customization||typeof customization!=='object')return result;
 const options=customization.options;
 if(!options||typeof options!=='object'||Array.isArray(options))return result;
 const outer=options as Record<string,unknown>;
 const nested=outer.documentOptions;
 if(!nested||typeof nested!=='object'||Array.isArray(nested))return result;
 // O backend lê `documentOptions`, mas escreve o PUT em `options`.
 // Não repassar a cópia aninhada: ela é um snapshot anterior e pode
 // sobrescrever o croqui, as assinaturas e a prancha recém-gravados.
 const { documentOptions: _obsolete, ...flat } = outer;
 void _obsolete;
 return { ...result,customization:{...customization,options:{...flat,...(nested as Record<string,unknown>)}} };
}


/** Retorna exclusivamente a personalização confirmada na conta autenticada. */
async function authenticatedCustomization(session:SurveyorSession,method:'GET'|'PUT'|'POST',payload?:Record<string,unknown>,path='/api/customization/document'):Promise<DocumentCustomizationResult>{
 const cleanPayload=payload ? ('options' in payload ? {
  ...payload,
  options:Object.fromEntries(Object.entries((payload.options&&typeof payload.options==='object'&&!Array.isArray(payload.options))?payload.options as Record<string,unknown>:{}).filter(([key])=>key!=='documentOptions'))
 } : payload) : undefined;
 const call=()=>authenticatedRequest<DocumentCustomizationResult>(path,{
  method,accessToken:session.accessToken,...(cleanPayload?{body:cleanPayload}:{}),timeoutMs:path.endsWith('/draft')?90000:30000,
  ...(method!=='GET'?{idempotencyKey:`surveyor-customization-${crypto.randomUUID()}`}:{})
 });
 return normalizeDocumentCustomization(await call());
}
export const getDocumentCustomization=(session:SurveyorSession)=>authenticatedCustomization(session,'GET');

/** Grava na API. O chamador deve reler o documento para verificar a persistência. */
/** Grava com renovação de sessão em caso de 401; a leitura posterior confirma a persistência. */
export const saveDocumentCustomization=(session:SurveyorSession,payload:Record<string,unknown>)=>authenticatedCustomization(session,'PUT',payload);


/** Operações de personalização serializadas nesta aba: cada edição recebe o
 * estado mais recente antes de montar o patch. Evita que salvar uma prancha
 * e um croqui quase ao mesmo tempo reintroduza snapshots anteriores.
 * Não é transação entre navegadores: a releitura confirma o resultado. */
let documentWriteQueue:Promise<unknown>=Promise.resolve();
function enqueueDocumentWrite<T>(work:()=>Promise<T>):Promise<T>{
 const operation=documentWriteQueue.catch(()=>undefined).then(work);
 documentWriteQueue=operation.then(()=>undefined,()=>undefined);
 return operation;
}
/** Endpoint pontual: envia apenas a prancha/documento alterado, sem snapshot de outras glebas. */
export function saveScopedDocumentCustomization(session:SurveyorSession,payload:Record<string,unknown>):Promise<DocumentCustomizationResult>{
 return enqueueDocumentWrite(async()=>{
  try{return await authenticatedCustomization(session,'POST',payload,'/api/customization/document/draft');}
  catch(error){
   if(error instanceof ApiError&&(error.status===404||error.status===405))throw new Error('A API publicada ainda não aceita salvar documentos individualmente. Atualize a Function surveyor-api no Appwrite; seu rascunho local continua preservado.');
   throw error;
  }
 });
}

export function updateDocumentCustomization(
 session:SurveyorSession,
 build:(current:Record<string,unknown>)=>Record<string,unknown>
):Promise<{saved:DocumentCustomizationResult;current:Record<string,unknown>}>{
 return enqueueDocumentWrite(async()=>{
  const before=await getDocumentCustomization(session);
  const current=before.customization||{};
  const changes=build(current);
  const saved=await saveDocumentCustomization(session,changes);
  return {saved,current};
 });
}
