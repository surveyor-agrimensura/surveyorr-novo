/** Escopo obrigatório por conta para evitar que duas pessoas no mesmo navegador
 * carreguem ou sincronizem rascunhos e revisões uma da outra.
 * Os dados v1 permanecem no navegador para recuperação explícita/assistida.
 */
export function mapDraftKeys(accountId: string, workspaceId: string) {
  const user = encodeURIComponent(accountId.trim() || 'visitante');
  const workspace = encodeURIComponent(workspaceId.trim() || 'workspace');
  const base = `surveyor-map-draft-v2:${user}:${workspace}`;
  return {
    draft: base,
    versions: `${base}:versions`,
    metadata: `surveyor-project-meta-v2:${user}:${workspace}`,
    sync: `surveyor-map-cloud-sync-v2:${user}:${workspace}`,
    legacyDraft: `surveyor-map-draft-v1:${workspaceId}`,
    legacyMetadata: `surveyor-project-meta:${workspaceId}`
  };
}

/** Persists to IndexedDB first, then mirrors to localStorage for synchronous recovery.
 * A full localStorage quota must not prevent the larger IndexedDB copy from saving.
 */
export async function writeMapDraftSnapshot(
  storage: Pick<Storage, 'setItem'>,
  draftKey: string,
  metadataKey: string,
  features: unknown,
  projectData: unknown
): Promise<boolean> {
  const indexedDbResults = await Promise.all([
    writeOfflineDraft(draftKey, features),
    writeOfflineDraft(metadataKey, projectData)
  ]);
  let mirrored = false;
  try {
    storage.setItem(draftKey, JSON.stringify(features));
    storage.setItem(metadataKey, JSON.stringify(projectData));
    mirrored = true;
  } catch { /* IndexedDB pode continuar oferecendo recuperação */ }
  return indexedDbResults.every(Boolean) || mirrored;
}
import { writeOfflineDraft } from '../../lib/offlineDraftStore';
