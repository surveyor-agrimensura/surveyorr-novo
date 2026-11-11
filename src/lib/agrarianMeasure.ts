/** Conversões regionais de uso tradicional, NÃO substituem as áreas oficiais em m²/ha. */
export const TAREFA_PRESETS: Readonly<Record<string, number>> = { BA: 4356, CE: 3630, SE: 3025, AL: 3025 };
export function tarefaValueForState(state: string, override?: number): number | null {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) return override;
  return TAREFA_PRESETS[state.trim().toUpperCase()] ?? null;
}
export function tarefaCaption(areaM2: number, state: string, override?: number): string {
  const equivalent = tarefaValueForState(state, override);
  if (equivalent === null || !Number.isFinite(areaM2) || areaM2 < 0) return '';
  return `${(areaM2 / equivalent).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} tarefas`;
}
export function tarefaUnitForState(state: string, override?: number): string {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) return 'tarefas (configuração local)';
  const labels: Readonly<Record<string, string>> = {
    BA: 'tarefas baianas',
    CE: 'tarefas cearenses',
    SE: 'tarefas sergipanas',
    AL: 'tarefas alagoanas',
  };
  return labels[state.trim().toUpperCase()] || '';
}
