import {readMapAppearance} from './sharedMapAppearance';
import {writeOfflineDraft,removeOfflineDraft} from '../../lib/offlineDraftStore';
/**
 * Fonte comum de croqui para Mapas e Croquis e Memorial Descritivo.
 * A versão nova é indexada por projeto E polígono para evitar misturar imóveis.
 * O campo antigo `croquiDrafts[projectId]` só é migrado automaticamente
 * quando o projeto tem um único polígono; com vários não dá para identificar
 * com segurança a qual imóvel a configuração antiga pertencia.
 */
import { record } from '../memorial/memorialEngine';
import { defaultCroquiSettings, normalizeCroquiSettings, type CroquiSettings } from '../memorial/croquiRenderer';
import { readConfrontants, type ConfrontantEntry } from '../documents/confrontantRegistry';
import { resolveSegmentConfrontants } from './croquiGeometry';
import type { SurveyPolygon } from '../memorial/memorialEngine';

export const localCroquiKey = (userId: string, projectId: string, featureId: string) =>
  `surveyor-croqui-draft-v2:${userId}:${projectId}:${featureId}`;
export const pendingCroquiKey=(userId:string,projectId:string,featureId:string)=>
  `${localCroquiKey(userId,projectId,featureId)}:pending`;
export function hasPendingCroquiDraft(userId:string,projectId:string,featureId:string):boolean{
 try{return typeof localStorage!=='undefined'&&localStorage.getItem(pendingCroquiKey(userId,projectId,featureId))==='1';}
 catch{return false;}
}
export function writePendingCroquiDraft(userId:string,projectId:string,featureId:string,settings:CroquiSettings):boolean{
 try{
  if(typeof localStorage==='undefined')return false;
  localStorage.setItem(localCroquiKey(userId,projectId,featureId),JSON.stringify(settings));
  localStorage.setItem(pendingCroquiKey(userId,projectId,featureId),'1');
  void writeOfflineDraft(localCroquiKey(userId,projectId,featureId),settings);
  void writeOfflineDraft(pendingCroquiKey(userId,projectId,featureId),'1');
  return true;
 }catch{return false;}
}
const legacyLocalCroquiKey = (userId: string, projectId: string) =>
  `surveyor-croqui-draft-v1:${userId}:${projectId}`;

function nonempty(value: unknown): boolean {
  return Object.keys(record(value)).length > 0;
}

function parseLocal(key: string): unknown {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as unknown : null;
  } catch { return null; }
}

export function cloudCroquiDraft(options: unknown, projectId: string, featureId: string): Record<string, unknown> {
  return record(record(record(record(options).croquiDraftsByFeature)[projectId])[featureId]);
}

export function croquiDraftMatches(expectedOptions: unknown, receivedOptions: unknown, projectId: string, featureId: string): boolean {
  return JSON.stringify(cloudCroquiDraft(expectedOptions, projectId, featureId)) ===
    JSON.stringify(cloudCroquiDraft(receivedOptions, projectId, featureId));
}

/** Marca uma edição feita no navegador. A mesma revisão segue para o cache e para a API.
 * Nunca depende de nomes iguais de confrontantes, ordem visual ou horário do servidor.
 */
export function stampCroquiRevision(settings: CroquiSettings, now = Date.now()): CroquiSettings {
 const previous = revisionOf(settings);
 return { ...settings, syncRevision: Math.max(1, previous + 1, Math.floor(now)) } as CroquiSettings;
}
function revisionOf(value: unknown): number {
 const n = Number(record(value).syncRevision);
 return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
export type CroquiSyncSource = 'local-pending' | 'local-newer' | 'cloud' | 'legacy-cloud' | 'local' | 'legacy-local' | 'none';
export type CroquiSyncResult = { settings: CroquiSettings | null; source: CroquiSyncSource };
/** A edição com revisão mais recente vence; versões antigas sem revisão seguem
 * priorizando a API. Uma edição NÃO confirmada é sempre preservada localmente.
 * Isso impede que o Memorial use um snapshot antigo depois de salvar no Croqui.
 */
export function resolveSharedCroquiSettings(
 options: unknown, projectId: string, featureId: string, userId: string,
 technician = '', allowLegacyProjectDraft = false
): CroquiSyncResult {
 if (!projectId || !featureId) return { settings: null, source: 'none' };
 const local = parseLocal(localCroquiKey(userId, projectId, featureId));
 if (hasPendingCroquiDraft(userId, projectId, featureId) && nonempty(local)) {
  return { settings: normalizeCroquiSettings(local, technician), source: 'local-pending' };
 }
 const cloud = cloudCroquiDraft(options, projectId, featureId);
 if (nonempty(cloud)) {
  if (nonempty(local) && revisionOf(local) > revisionOf(cloud)) {
   return { settings: normalizeCroquiSettings(local, technician), source: 'local-newer' };
  }
  return { settings: normalizeCroquiSettings(cloud, technician), source: 'cloud' };
 }
 if (nonempty(local)) return { settings: normalizeCroquiSettings(local, technician), source: 'local' };
 if (allowLegacyProjectDraft) {
  const legacyCloud = record(record(options).croquiDrafts)[projectId];
  if (nonempty(legacyCloud)) return { settings: normalizeCroquiSettings(legacyCloud, technician), source: 'legacy-cloud' };
  const legacyLocal = parseLocal(legacyLocalCroquiKey(userId, projectId));
  if (nonempty(legacyLocal)) return { settings: normalizeCroquiSettings(legacyLocal, technician), source: 'legacy-local' };
 }
 return { settings: null, source: 'none' };
}
/** Compatível com todos os módulos que esperam apenas as configurações. */
export function readSharedCroquiSettings(
 options: unknown, projectId: string, featureId: string, userId: string,
 technician = '', allowLegacyProjectDraft = false
): CroquiSettings | null {
 const resolved=resolveSharedCroquiSettings(options, projectId, featureId, userId, technician, allowLegacyProjectDraft).settings;
 const common=readMapAppearance(options,projectId,featureId);
 return resolved?{...resolved,...common}:(Object.keys(common).length?{...defaultCroquiSettings(technician),...common}:null);
}

export function clearPendingCroquiDraft(userId:string,projectId:string,featureId:string):void{
 try{localStorage.removeItem(pendingCroquiKey(userId,projectId,featureId));}catch{/* IndexedDB copy is cleared below */}
 void removeOfflineDraft(pendingCroquiKey(userId,projectId,featureId));
}

/** Mantém a mesma precedência do editor ao montar a prancha do imóvel completo. */
export function readCroquiSettingsForDocument(
 options: unknown, projectId: string, featureId: string, userId: string,
 technician = '', composite = false, allowLegacyProjectDraft = false
): CroquiSettings | null {
 const primary = readSharedCroquiSettings(
  options, projectId, composite ? '__imovel_completo__' : featureId,
  userId, technician, allowLegacyProjectDraft
 );
 return primary || (composite
  ? readSharedCroquiSettings(options, projectId, featureId, userId, technician, false)
  : null);
}

/** O cadastro comum, inclusive o gerado pelo mapa, prevalece sobre dados antigos do croqui. */
export function readSharedConfrontants(options: unknown, projectId: string, featureId: string): ConfrontantEntry | null {
  return readConfrontants(options, projectId, featureId);
}

/** Mesma regra de confrontação para Editor, Memorial e Prancha.
 * Nunca muta o objeto remoto: o texto e os rótulos usam os mesmos segmentos.
 */
export function combineCroquiConfrontants(
 polygon: SurveyPolygon, settings: CroquiSettings,
 common: ConfrontantEntry | null, preferLocal = false
): CroquiSettings {
 const neighbors = resolveSegmentConfrontants(
  polygon.properties, polygon.vertices.length,
  preferLocal ? settings.neighbors : common?.neighbors || [],
  preferLocal ? common?.neighbors || [] : settings.neighbors
 );
 const neighborDetails = common
  ? preferLocal ? { ...common.details, ...settings.neighborDetails } : { ...settings.neighborDetails, ...common.details }
  : { ...settings.neighborDetails };
 return { ...settings, neighbors, neighborDetails };
}

/** Um único PUT atualiza croqui e confrontantes, sem duas gravações concorrentes. */
export function withSavedCroquiSettings(
  customization: Record<string, unknown>, projectId: string, featureId: string, settings: CroquiSettings
): Record<string, unknown> {
  if (!projectId || !featureId) throw new Error('Selecione um projeto e um polígono.');
  const options = record(customization.options);
  const allDrafts = record(options.croquiDraftsByFeature);
  const projectDrafts = record(allDrafts[projectId]);
  const allConfrontants = record(options.confrontantRegistry);
  const projectConfrontants = record(allConfrontants[projectId]);
  // A assinatura importada pertence ao navegador. Não é enviada no documento compartilhado.
  const cloudData = { ...settings, signature: '' };
  const commonEntry = { neighbors: [...settings.neighbors], details: { ...settings.neighborDetails } };
  // Enviar apenas opções evita reprocessar logotipos, modelos e assinaturas da conta.
  const { documentOptions: _ignored, ...restOptions } = options;
  void _ignored;
  return {
    options: {
      ...restOptions,
      croquiDraftsByFeature: {
        ...allDrafts, [projectId]: { ...projectDrafts, [featureId]: cloudData }
      },
      confrontantRegistry: {
        ...allConfrontants, [projectId]: { ...projectConfrontants, [featureId]: commonEntry }
      }
    }
  };
}

