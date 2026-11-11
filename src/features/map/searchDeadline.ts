/** Limite explícito para buscas externas: a interface não depende de um WFS responder. */
export const SEARCH_LIMIT_MS = 25_000;
export const SEARCH_TIMEOUT_MESSAGE = 'A consulta aos serviços oficiais ultrapassou 25 segundos. Tente novamente ou consulte os registros locais do município.';

export async function withSearchDeadline<T>(
 work: (signal: AbortSignal) => Promise<T>,
 timeoutMs = SEARCH_LIMIT_MS,
 externalSignal?: AbortSignal,
): Promise<T> {
 const controller = new AbortController();
 let timer: ReturnType<typeof setTimeout> | undefined;
 let rejectTimeout: (error: Error) => void = () => {};
 const timeout = new Promise<never>((_, reject) => { rejectTimeout = reject; });
 const abort = () => {
  controller.abort();
  rejectTimeout(new Error('Consulta cancelada.'));
 };
 if (externalSignal?.aborted) throw new Error('Consulta cancelada.');
 externalSignal?.addEventListener('abort', abort, {once:true});
 timer = setTimeout(() => {
  controller.abort();
  rejectTimeout(new Error(timeoutMs === SEARCH_LIMIT_MS ? SEARCH_TIMEOUT_MESSAGE : `A consulta ultrapassou ${Math.ceil(timeoutMs/1000)} segundos. Tente novamente.`));
 }, timeoutMs);
 try { return await Promise.race([Promise.resolve().then(() => work(controller.signal)), timeout]); }
 finally {
  clearTimeout(timer);
  externalSignal?.removeEventListener('abort', abort);
 }
}
