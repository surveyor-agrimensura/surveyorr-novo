import { API_BASE_URL } from './config';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  revision?: string;
  body?: unknown;
  accessToken?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (options.revision) headers['If-Match'] = `"${options.revision}"`;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal
    });
    const raw = await response.text();
    let body: Record<string, unknown> = {};
    if (raw) {
      try { body = JSON.parse(raw) as Record<string, unknown>; }
      catch { throw new ApiError('A API retornou uma resposta inesperada.', response.status); }
    }
    if (!response.ok) {
      // A API fornece mensagens específicas para bloqueio e limite de tentativas.
      const details = body.details as Record<string, unknown> | undefined;
      const reason = body.message || body.error || 'Não foi possível concluir a solicitação.';
      throw new ApiError(String(reason), response.status, String(body.code || details?.code || ''));
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('A API demorou demais para responder. Confirme a disponibilidade do servidor antes de tentar novamente.', 0, 'API_TIMEOUT');
    const host = new URL(API_BASE_URL).hostname;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new ApiError(offline ? 'Seu dispositivo está sem internet. A nuvem não foi acessada.' : `Não foi possível conectar à API (${host}). Confira o DNS deste endereço, a implantação da Function no Appwrite e a permissão CORS do domínio do site.`, 0, 'API_CONNECTION');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

/** Diagnóstico público: não envia senha, cookies ou token. Não confirma permissões de gravação. */
export async function checkApiHealth(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET', credentials: 'omit', cache: 'no-store', signal: controller.signal });
    if (!response.ok) return `A API respondeu HTTP ${response.status}. Confira a Function e sua implantação.`;
    const result = await response.json() as {ok?:boolean;customizationStorage?:string;documentDraftTransport?:string;privacyPreferences?:string;version?:string};
    if(result.ok!==true)return 'A API respondeu, mas não confirmou estar pronta.';
    if(result.customizationStorage!=='storage-v2')return 'A API respondeu, mas ainda não anuncia suporte ao armazenamento de croquis grandes. Publique a versão atualizada da Function surveyor-api e confira /api/health.';
    if(result.documentDraftTransport!=='scoped-v1')return 'A API ainda não anunciou o salvamento individual da Prancha. Publique a versão atualizada da Function surveyor-api.';
    if(result.privacyPreferences!=='account-v1')return 'A API ainda não sincroniza as preferências de cookies com a conta. Publique a versão atualizada da Function surveyor-api.';
    return 'A API suporta salvamento individual de documentos. Salve e reabra a Prancha para conferir a persistência.';
  } catch {
    return `A API (${new URL(API_BASE_URL).hostname}) não respondeu. Confira o DNS, a Function no Appwrite e o CORS do domínio atual.`;
  } finally { clearTimeout(timer); }
}
