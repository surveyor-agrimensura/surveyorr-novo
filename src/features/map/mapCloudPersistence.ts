import type { Feature, Geometry, GeoJsonProperties } from 'geojson';

/** IDs do frontend são estáveis mesmo quando a API atribui outros IDs às feições.
 * A chave fica dentro das propriedades GeoJSON, que já são armazenadas pela API. */
export type MapCloudFeature = Feature<Geometry, GeoJsonProperties>;
export type CloudGeometry = Geometry | { type: string; coordinates: unknown };
export type CloudFeatureInput = { id?: string; name?: string; geometry?: CloudGeometry; geoJson?: CloudGeometry; properties?: Record<string, unknown> };
export const CLIENT_ID_PROPERTY = 'surveyorFeatureId';
export const SYNC_PREFIX = 'surveyor-map-cloud-sync-v1:';

export function serializeMapFeature(feature: MapCloudFeature) {
  const stableId = String(feature.id ?? '');
  if (!stableId) throw new Error('Uma feição do mapa está sem identificador e não pode ser salva com segurança.');
  return {
    ...feature.properties,
    [CLIENT_ID_PROPERTY]: stableId
  } as Record<string, unknown>;
}

/** Reconstrói vínculos originais entre pontos e perímetros após leitura da nuvem.
 * Funciona para projetos novos e para projetos da API antiga (sem ID cliente). */
export function restoreMapFeatures(items: CloudFeatureInput[]): MapCloudFeature[] {
  const seen = new Set<string>();
  const remap = new Map<string, string>();
  const features = items.flatMap((entry, index) => {
    const geometry = entry.geoJson || entry.geometry;
    if (!geometry?.type || !('coordinates' in geometry) || !Array.isArray(geometry.coordinates)) return [];
    const properties = { ...(entry.properties || {}) };
    const fromCloud = String(entry.id || '');
    const stable = String(properties[CLIENT_ID_PROPERTY] || fromCloud || `surveyor-legado-${index}`);
    const id = !seen.has(stable) ? stable : `${stable}-duplicado-${index}`;
    seen.add(id);
    if (fromCloud) remap.set(fromCloud, id);
    remap.set(stable, id);
    return [{ type: 'Feature' as const, id, geometry: geometry as Geometry, properties }];
  });
  return features.map(item => {
    const props = { ...item.properties };
    const linked = String(props.pointPolygonId ?? '');
    if (linked && remap.has(linked)) props.pointPolygonId = remap.get(linked);
    // Migração de projetos antigos: o backend podia atribuir IDs novos sem
    // salvar o ID original. Só reativa o vínculo quando a geometria aponta
    // inequivocamente para um único perímetro gerado desses pontos.
    else if (linked && item.geometry.type === 'Point') {
      const point = item.geometry.coordinates;
      const candidates = features.filter(f =>
        f.geometry.type === 'Polygon' && f.properties?.generatedFromPoints === true &&
        f.geometry.coordinates[0].some(coord => Math.abs(coord[0]-point[0])<=1e-10 && Math.abs(coord[1]-point[1])<=1e-10)
      );
      if (candidates.length === 1) props.pointPolygonId = String(candidates[0].id);
    }
    if (Array.isArray(props.sourcePointIds)) props.sourcePointIds = props.sourcePointIds.map(value => remap.get(String(value)) || String(value));
    return { ...item, properties: props };
  });
}

/** Comparação de rascunho local sem depender da ordem das propriedades do objeto. */
export function mapFingerprint(features: MapCloudFeature[]): string {
  return JSON.stringify(features.map(f => ({
    id: String(f.id || ''), geometry: f.geometry,
    properties: Object.fromEntries(Object.entries(f.properties || {}).filter(([key]) => key !== CLIENT_ID_PROPERTY).sort(([a], [b]) => a.localeCompare(b)))
  })));
}

/** Detecta caso em que a API descartou justamente a chave necessária aos vínculos. */
export function hasVerifiedFeatureIds(remote: CloudFeatureInput[], local: MapCloudFeature[]): boolean {
  if (remote.length !== local.length) return false;
  const expected = new Set(local.map(f => String(f.id)));
  const actual = remote.map(f => String(f.properties?.[CLIENT_ID_PROPERTY] || ''));
  if (!actual.every(id => id.length > 0 && expected.has(id)) || new Set(actual).size !== expected.size) return false;
  const confirmed = new Map(remote.map(f => [String(f.properties?.[CLIENT_ID_PROPERTY]), f]));
  return local.every(f => {
    const saved = confirmed.get(String(f.id));
    if (!saved || JSON.stringify(saved.geoJson || saved.geometry) !== JSON.stringify(f.geometry)) return false;
    const original = f.properties || {};
    const props = saved.properties || {};
    return (original.pointPolygonId === undefined || original.pointPolygonId === props.pointPolygonId) &&
      (original.sourcePointIds === undefined || JSON.stringify(original.sourcePointIds) === JSON.stringify(props.sourcePointIds));
  });
}


/** Confere também o conteúdo de edição e a aparência das feições, não só os IDs.
 * Um projeto com três glebas jamais pode ser dado por confirmado se uma borda,
 * cor, nome ou cadastro de confrontante for descartado no transporte. */
export function hasVerifiedMapEdits(remote:CloudFeatureInput[],local:MapCloudFeature[]):boolean{
 if(!hasVerifiedFeatureIds(remote,local))return false;
 const saved=new Map(remote.map(f=>[String(f.properties?.[CLIENT_ID_PROPERTY]||''),f]));
 // O backend da RC185 guarda o objeto properties integralmente. Conferir
 // somente cor/nome não basta: RG, donos, rótulos e metadados de edição
 // também precisam voltar byte a byte no conteúdo JSON persistido.
 return local.every(f=>{
  const entry=saved.get(String(f.id));if(!entry)return false;
  const props=entry.properties||{},original=f.properties||{};
  return Object.keys(original).every(key=>{
   if(key===CLIENT_ID_PROPERTY||original[key]===undefined)return true;
   if(!Object.prototype.hasOwnProperty.call(props,key))return false;
   return JSON.stringify(original[key])===JSON.stringify(props[key]);
  });
 });
}
