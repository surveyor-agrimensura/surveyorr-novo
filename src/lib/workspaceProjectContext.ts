const CONTEXT_PREFIX = 'surveyor-workspace-project-v1:';

const normalize = (value: string | null | undefined) => value?.trim() || '';

/** Tab-scoped context: sessionStorage is isolated per tab and the key per account. */
export function workspaceProjectContextKey(accountId: string): string {
  return `${CONTEXT_PREFIX}${encodeURIComponent(normalize(accountId) || 'anonymous')}`;
}

export function readWorkspaceProjectContext(accountId: string): string {
  try { return normalize(sessionStorage.getItem(workspaceProjectContextKey(accountId))); }
  catch { return ''; }
}

export function writeWorkspaceProjectContext(accountId: string, projectId: string): void {
  try {
    const key = workspaceProjectContextKey(accountId);
    const id = normalize(projectId);
    if (id) sessionStorage.setItem(key, id);
    else sessionStorage.removeItem(key);
  } catch { /* URL remains the explicit fallback when storage is unavailable. */ }
}

export function projectIdFromSearch(search: string): string {
  return normalize(new URLSearchParams(search).get('project'));
}

export function withProjectSearch(path: string, projectId: string): string {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const id = normalize(projectId);
  if (id) params.set('project', id);
  else params.delete('project');
  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
