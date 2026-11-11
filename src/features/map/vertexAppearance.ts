/** Configurações exclusivamente visuais por vértice: não alteram coordenadas,
 * comprimento, área nem a precisão do levantamento. Persistem no GeoJSON. */
export type VertexAppearance = { color: string; size: number };
export type VertexAppearancePatch = Partial<VertexAppearance>;
export const VERTEX_DEFAULT_APPEARANCE: VertexAppearance = { color: '#0c62ea', size: 14 };
const colorIsValid = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const limitSize = (value: unknown): number => {
 const number = Number(value);
 return Number.isFinite(number) ? Math.max(8, Math.min(28, Math.round(number))) : VERTEX_DEFAULT_APPEARANCE.size;
};
export function getVertexAppearance(properties: Record<string, unknown> | null | undefined, index: number): VertexAppearance {
 const entry = asRecord(asRecord(properties?.vertexAppearance)[String(index)]);
 return {
  color: colorIsValid(entry.color) ? entry.color : VERTEX_DEFAULT_APPEARANCE.color,
  size: limitSize(entry.size)
 };
}
export function updateVertexAppearance(properties: Record<string, unknown> | null | undefined, index: number, patch: VertexAppearancePatch | null): Record<string, unknown> {
 const input = asRecord(properties);
 const visuals = { ...asRecord(input.vertexAppearance) };
 if (patch === null) delete visuals[String(index)];
 else {
  const current = getVertexAppearance(input, index);
  visuals[String(index)] = {
   color: colorIsValid(patch.color) ? patch.color : current.color,
   size: patch.size === undefined ? current.size : limitSize(patch.size)
  };
 }
 if (!Object.keys(visuals).length) {
  const { vertexAppearance: _removed, ...rest } = input;
  void _removed;
  return rest;
 }
 return { ...input, vertexAppearance: visuals };
}
/** Reindexação obrigatória ao incluir/remover vértices: o estilo segue o seu ponto. */
export function shiftVertexAppearance(properties: Record<string, unknown> | null | undefined, mode: 'insert' | 'remove', index: number): Record<string, unknown> {
 const input = asRecord(properties);
 const entries = asRecord(input.vertexAppearance);
 if (!Object.keys(entries).length) return input;
 const target = mode === 'insert' ? index + 1 : index;
 const shifted: Record<string, unknown> = {};
 Object.entries(entries).forEach(([key, appearance]) => {
  const oldIndex = Number(key);
  if (!Number.isSafeInteger(oldIndex) || oldIndex < 0) return;
  if (mode === 'remove' && oldIndex === target) return;
  const newIndex = mode === 'insert' && oldIndex >= target ? oldIndex + 1 : mode === 'remove' && oldIndex > target ? oldIndex - 1 : oldIndex;
  shifted[String(newIndex)] = appearance;
 });
 return { ...input, vertexAppearance: shifted };
}

/** Mantém as personalizações no mesmo ponto quando a ordem geométrica muda. */
export function reorderVertexAppearance(properties: Record<string, unknown> | null | undefined, oldToNew: (index: number) => number, count: number): Record<string, unknown> {
 const input = asRecord(properties);
 const entries = asRecord(input.vertexAppearance);
 if (!Object.keys(entries).length) return input;
 const updated: Record<string, unknown> = {};
 Object.entries(entries).forEach(([key, value]) => {
  const original = Number(key);
  if (!Number.isSafeInteger(original) || original < 0 || original >= count) return;
  const next = oldToNew(original);
  if (Number.isSafeInteger(next) && next >= 0 && next < count) updated[String(next)] = value;
 });
 return { ...input, vertexAppearance: updated };
}
export function copyVertexAppearanceToAll(properties: Record<string, unknown> | null | undefined, sourceIndex: number, count: number): Record<string, unknown> {
 let updated = asRecord(properties);
 const appearance = getVertexAppearance(updated, sourceIndex);
 for (let index = 0; index < count; index++) updated = updateVertexAppearance(updated, index, appearance);
 return updated;
}
