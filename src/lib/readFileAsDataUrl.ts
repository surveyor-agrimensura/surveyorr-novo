export type FileReadProgress = (file: File, loadedBytes: number, totalBytes: number) => void;

export function readFileAsDataUrl(file: File, reportProgress: FileReadProgress, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      action();
    };
    const abortError = () => { const error = new Error('Envio cancelado.'); error.name = 'AbortError'; return error; };
    const abort = () => { try { reader.abort(); } catch { finish(() => reject(abortError())); } };
    if (signal.aborted) { reject(abortError()); return; }
    signal.addEventListener('abort', abort, { once: true });
    reader.onprogress = event => { if (event.lengthComputable) reportProgress(file, event.loaded, event.total); };
    reader.onload = () => finish(() => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível carregar a imagem.')));
    reader.onerror = () => finish(() => reject(new Error('Falha ao ler o arquivo selecionado.')));
    reader.onabort = () => finish(() => reject(abortError()));
    reader.readAsDataURL(file);
  });
}
