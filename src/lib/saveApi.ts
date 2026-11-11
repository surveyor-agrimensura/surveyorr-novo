import { ApiError } from './api';
import { SAVE_API_BASE_URL } from './config';

/** Contrato de transporte da Function surveyor-save (RC185.74).
 * É deliberadamente uma requisição CORS simples: POST + text/plain, sem
 * Authorization/If-Match nem cookies; assim não depende de preflight OPTIONS.
 * O JWT só vai no corpo JSON por HTTPS e nunca em query string ou logs.
 */
type SaveOptions = {
  accessToken: string;
  expectedRevision?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
};

type SaveReply = { ok?: boolean; project?: { id?: string }; features?: unknown[]; error?: string; message?: string; details?: { code?: string }; code?: string };

export async function saveFunctionRequest<T>(path: string, payload: Record<string, unknown>, options: SaveOptions): Promise<T> {
  if (!options.accessToken.trim()) throw new ApiError('Entre novamente para salvar o projeto.', 401, 'SAVE_AUTH_TOKEN_MISSING');
  if (!/^\/api\/projects(?:\/[^/]+\/bundle)?$/.test(path)) throw new ApiError('Rota de salvamento inválida.', 400);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
  const requestId = crypto.randomUUID();
  const envelope = {
    ...payload,
    __surveyorSaveTransport: {
      version: 1,
      accessToken: options.accessToken,
      idempotencyKey: (options.idempotencyKey || requestId).slice(0, 120),
      expectedRevision: options.expectedRevision || '',
      requestId
    }
  };
  try {
    const response = await fetch(`${SAVE_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
      body: JSON.stringify(envelope),
      credentials: 'omit', cache: 'no-store', signal: controller.signal
    });
    const raw = await response.text();
    let result: SaveReply;
    try { result = JSON.parse(raw) as SaveReply; }
    catch { throw new ApiError('A Function surveyor-save retornou uma resposta inválida. Confira a implantação no Appwrite.', response.status, 'SAVE_INVALID_RESPONSE'); }
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ApiError('A Function surveyor-save devolveu uma resposta inesperada.', response.status, 'SAVE_INVALID_RESPONSE');
    if (!response.ok || result.ok !== true) throw new ApiError(String(result.error || result.message || 'A Function não confirmou o salvamento.'), response.status, String(result.details?.code || result.code || 'SAVE_REJECTED'));
    if (!result.project?.id) throw new ApiError('A Function respondeu, mas não confirmou o identificador do projeto.', 502, 'SAVE_PROJECT_ID_MISSING');
    return result as unknown as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('A Function surveyor-save demorou demais para responder. O estado da gravação é incerto; confira o projeto na nuvem antes de tentar novamente.', 0, 'SAVE_TIMEOUT');
    throw new ApiError('Não foi possível acessar a Function surveyor-save. Confira a implantação, as origens CORS autorizadas (inclusive localhost:5500 nos testes) e sua conexão.', 0, 'SAVE_CONNECTION');
  } finally { clearTimeout(timeout); }
}

/** Apenas disponibilidade e CORS; nunca testa credenciais nem permissões de escrita. */
export async function checkSaveFunctionHealth(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${SAVE_API_BASE_URL}/api/live`, { method: 'GET', credentials: 'omit', cache: 'no-store', signal: controller.signal });
    if (!response.ok) return `Function Save: HTTP ${response.status}. Confira deployment, variáveis da Function e CORS.`;
    const body = await response.json() as { ok?: boolean; service?: string };
    return body?.ok === true ? 'Function Save: online. Disponibilidade confirmada, gravação ainda não testada.' : 'Function Save: respondeu sem confirmar disponibilidade.';
  } catch {
    return 'Function Save: não acessível. Confira deployment e CORS; em localhost:5500 a origem precisa ser autorizada no Appwrite.';
  } finally { clearTimeout(timeout); }
}
