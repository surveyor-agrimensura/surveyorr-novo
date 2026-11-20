export type UndoRedoAction = 'undo' | 'redo';

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'target'>;

/** Resolve editor shortcuts without stealing native undo from text fields or dialogs. */
export function resolveUndoRedoAction(event: ShortcutEvent): UndoRedoAction | null {
  const target = event.target as { closest?: (selector: string) => unknown } | null;
  const isProtectedTarget = target?.closest?.(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="dialog"], [aria-modal="true"]'
  );
  if (isProtectedTarget || (!event.ctrlKey && !event.metaKey)) return null;

  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  return null;
}
