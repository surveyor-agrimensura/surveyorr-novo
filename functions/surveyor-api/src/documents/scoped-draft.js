/** Writes one document draft, never a client-supplied snapshot of all projects.
 * Pure logic so a missing or older Appwrite deployment cannot silently drop data.
 */
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
export const DRAFT_KINDS = new Set(['technicalSheets', 'memorial', 'confrontationLetters']);
export function validateScopedDraftInput(input) {
  const kind = String(input?.kind || '');
  const projectId = String(input?.projectId || '');
  const featureId = String(input?.featureId || '');
  if (!DRAFT_KINDS.has(kind)) throw new Error('Tipo de documento inválido.');
  if (!projectId || projectId.length > 256 || /[\u0000-\u001f]/.test(projectId)) throw new Error('Projeto inválido.');
  if (featureId.length > 256 || /[\u0000-\u001f]/.test(featureId)) throw new Error('Identificador da gleba inválido.');
  if (kind === 'technicalSheets' && !featureId) throw new Error('Selecione a gleba para salvar o documento.');
  if (kind === 'confrontationLetters' && featureId) throw new Error('Cartas não aceitam identificador de gleba.');
  if (!input?.data || typeof input.data !== 'object' || Array.isArray(input.data)) throw new Error('Documento inválido.');
  if (own(input, 'mapAppearance') && (!input.mapAppearance || typeof input.mapAppearance !== 'object' || Array.isArray(input.mapAppearance))) throw new Error('Estilo do mapa inválido.');
  // An authorization/Storage failure must never turn into an empty success.
  return {kind, projectId, featureId, data: input.data, mapAppearance:object(input.mapAppearance)};
}
export function makeScopedDraftPatch(existingOptions, rawInput) {
  const {kind,projectId,featureId,data,mapAppearance}=validateScopedDraftInput(rawInput);
  const opts=object(existingOptions);
  // The newer documentOptions takes precedence, preserving legacy top-level data.
  const flat={...opts,...object(opts.documentOptions)};
  const identityFields=kind==='memorial'?object(data.fields):data;
  const identityKeys=kind==='memorial'
    ? ['reference','incra','cib','district','owner','ownerDocument','ownerRg']
    : kind==='technicalSheets'?['reference','incra','cib','district']:[];
  const existingIdentity=object(flat.documentIdentityByProject);
  const oldIdentity=object(existingIdentity[projectId]);
  const nextIdentity={...oldIdentity};
  for(const key of identityKeys) if(typeof identityFields[key]==='string') nextIdentity[key]=identityFields[key].trim();
  const patch={documentIdentityByProject:{...existingIdentity,[projectId]:nextIdentity}};
  if(featureId){
    const drafts=object(flat.generatedDocumentDraftsByFeature);
    const category=object(drafts[kind]);
    const project=object(category[projectId]);
    patch.generatedDocumentDraftsByFeature={...drafts,[kind]:{...category,[projectId]:{...project,[featureId]:data}}};
  }else{
    const drafts=object(flat.generatedDocumentDrafts);
    const category=object(drafts[kind]);
    patch.generatedDocumentDrafts={...drafts,[kind]:{...category,[projectId]:data}};
  }
  if(kind==='technicalSheets'&&featureId){
    const maps=object(flat.mapAppearanceByFeature);
    const project=object(maps[projectId]);
    const old=object(project[featureId]);
    const newStyle={...old};
    for(const key of ['polygonFill','polygonStroke','polygonStrokeWidth','featureStyles','mapNames']){
      if(own(mapAppearance,key)) newStyle[key]=mapAppearance[key];
    }
    if(own(mapAppearance,'divisionColors')) newStyle.divisionColors={...object(old.divisionColors),...object(mapAppearance.divisionColors)};
    patch.mapAppearanceByFeature={...maps,[projectId]:{...project,[featureId]:newStyle}};
  }
  return patch;
}
/** Removes only byte-for-byte equivalent redundant root keys, never diverging data. */
export function compactMirroredDocumentOptions(options) {
  const result={...object(options)};
  const nested=object(result.documentOptions);
  for(const key of Object.keys(nested)) {
    if(key!=='documentOptions' && own(result,key) && JSON.stringify(result[key])===JSON.stringify(nested[key])) delete result[key];
  }
  return result;
}
