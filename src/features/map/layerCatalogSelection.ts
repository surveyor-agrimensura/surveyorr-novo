export function toggleSelectedLayer(selectedIds: readonly string[], layerId: string): string[] {
  return selectedIds.includes(layerId)
    ? selectedIds.filter(id => id !== layerId)
    : [...selectedIds, layerId];
}
