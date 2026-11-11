import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { AlertCircle, CheckCircle2, FileUp, LoaderCircle, RotateCcw, X } from 'lucide-react';
import './FileDropzone.css';

export type FileUploadProgress = (loaded?: number, total?: number) => void;
export type FileUploadContext = { signal: AbortSignal; reportBytes: FileUploadProgress };
export type FileUploadHandler = (file: File, context: FileUploadContext) => void | Promise<void>;

type UploadStatus = 'queued' | 'processing' | 'success' | 'error' | 'cancelled';
type UploadEntry = {
  id: number;
  file: File;
  status: UploadStatus;
  error?: string;
  retryable?: boolean;
  loaded?: number;
  total?: number;
};

export type FileDropzoneProps = {
  label: string;
  accept: string;
  maxBytes: number;
  maxFiles?: number;
  description?: string;
  buttonLabel?: string;
  disabled?: boolean;
  cancellable?: boolean;
  className?: string;
  onFile: FileUploadHandler;
};

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Tamanho desconhecido';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function acceptedByToken(file: File, token: string): boolean {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('.')) return file.name.toLowerCase().endsWith(normalized);
  if (normalized.endsWith('/*')) return file.type.toLowerCase().startsWith(normalized.slice(0, -1));
  return file.type.toLowerCase() === normalized;
}

export function validateUploadFile(file: File, accept: string, maxBytes: number): string | null {
  const acceptedTypes = accept.split(',').map(value => value.trim()).filter(Boolean);
  if (acceptedTypes.length && !acceptedTypes.some(token => acceptedByToken(file, token))) {
    return `Formato não aceito. Tipos permitidos: ${acceptedTypes.join(', ')}.`;
  }
  if (!Number.isFinite(maxBytes) || maxBytes < 0) return 'Limite de tamanho inválido para este campo.';
  if (file.size > maxBytes) return `O arquivo excede o limite de ${formatFileSize(maxBytes)}.`;
  return null;
}

export function throwIfUploadAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error('Processamento cancelado.');
  error.name = 'AbortError';
  throw error;
}

type FileReaderMode = 'text' | 'arrayBuffer' | 'dataUrl';
function readFile<T extends string | ArrayBuffer>(file: File, mode: FileReaderMode, signal: AbortSignal, reportBytes?: FileUploadProgress): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      callback();
    };
    const abort = () => {
      if (reader.readyState === FileReader.LOADING) reader.abort();
      else finish(() => reject(abortError()));
    };
    const onProgress = (event: ProgressEvent<FileReader>) => {
      if (event.lengthComputable && event.total > 0) reportBytes?.(event.loaded, event.total);
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    reader.onprogress = onProgress;
    reader.onload = () => finish(() => {
      reportBytes?.();
      resolve(reader.result as T);
    });
    reader.onerror = () => finish(() => reject(reader.error || new Error('Falha ao ler o arquivo.')));
    reader.onabort = () => finish(() => reject(abortError()));
    if (mode === 'text') reader.readAsText(file);
    else if (mode === 'arrayBuffer') reader.readAsArrayBuffer(file);
    else reader.readAsDataURL(file);
  });
}

function abortError(): Error {
  const error = new Error('Processamento cancelado.');
  error.name = 'AbortError';
  return error;
}

export const readFileAsText = (file: File, signal: AbortSignal, reportBytes?: FileUploadProgress) => readFile<string>(file, 'text', signal, reportBytes);
export const readFileAsArrayBuffer = (file: File, signal: AbortSignal, reportBytes?: FileUploadProgress) => readFile<ArrayBuffer>(file, 'arrayBuffer', signal, reportBytes);
export const readFileAsDataUrl = (file: File, signal: AbortSignal, reportBytes?: FileUploadProgress) => readFile<string>(file, 'dataUrl', signal, reportBytes);

const statusText: Record<UploadStatus, string> = {
  queued: 'Aguardando processamento',
  processing: 'Processando arquivo',
  success: 'Processamento concluído',
  error: 'Falha no processamento',
  cancelled: 'Processamento cancelado'
};

export function FileDropzone({
  label,
  accept,
  maxBytes,
  maxFiles = 1,
  description,
  buttonLabel = 'Selecionar arquivo(s)',
  disabled = false,
  cancellable = false,
  className = '',
  onFile
}: FileDropzoneProps) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const batchId = useRef(0);
  const controllers = useRef(new Map<number, AbortController>());
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = entries.some(entry => entry.status === 'processing');
  const safeMaxFiles = Number.isInteger(maxFiles) && maxFiles > 0 ? maxFiles : 1;

  useEffect(() => () => {
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
  }, []);

  const updateEntry = (id: number, update: (entry: UploadEntry) => UploadEntry) => {
    setEntries(current => current.map(entry => entry.id === id ? update(entry) : entry));
  };

  const runFile = async (entry: UploadEntry, currentBatch: number): Promise<'success' | 'error' | 'cancelled'> => {
    const controller = new AbortController();
    controllers.current.set(entry.id, controller);
    updateEntry(entry.id, current => ({ ...current, status: 'processing', error: undefined, loaded: undefined, total: undefined }));
    const reportBytes: FileUploadProgress = (loaded, total) => {
      if (controller.signal.aborted || currentBatch !== batchId.current) return;
      if (Number.isFinite(loaded) && Number.isFinite(total) && total! > 0 && loaded! >= 0 && loaded! <= total!) {
        updateEntry(entry.id, current => current.status === 'processing' ? { ...current, loaded, total } : current);
      } else {
        updateEntry(entry.id, current => current.status === 'processing' ? { ...current, loaded: undefined, total: undefined } : current);
      }
    };
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(abortError()), { once: true });
    });
    try {
      await Promise.race([Promise.resolve().then(() => onFile(entry.file, { signal: controller.signal, reportBytes })), aborted]);
      throwIfUploadAborted(controller.signal);
      if (currentBatch === batchId.current) updateEntry(entry.id, current => ({ ...current, status: 'success', error: undefined, loaded: undefined, total: undefined }));
      return 'success';
    } catch (error) {
      if (currentBatch === batchId.current) {
        const cancelled = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
        updateEntry(entry.id, current => ({ ...current, status: cancelled ? 'cancelled' : 'error', error: cancelled ? undefined : error instanceof Error ? error.message : 'Não foi possível processar o arquivo.', retryable: true, loaded: undefined, total: undefined }));
        return cancelled ? 'cancelled' : 'error';
      }
      return 'cancelled';
    } finally {
      controllers.current.delete(entry.id);
    }
  };

  const processEntries = async (validEntries: UploadEntry[]) => {
    const currentBatch = ++batchId.current;
    for (let index = 0; index < validEntries.length; index++) {
      if (currentBatch !== batchId.current) return;
      const entry = validEntries[index];
      const status = await runFile(entry, currentBatch);
      if (status === 'cancelled') {
        const remaining = new Set(validEntries.slice(index + 1).map(item => item.id));
        setEntries(current => current.map(item => remaining.has(item.id) && item.status === 'queued' ? { ...item, status: 'cancelled', retryable: true } : item));
        return;
      }
    }
  };

  const acceptFiles = (files: File[]) => {
    if (disabled || busy || !files.length) return;
    const candidates = files.map((file, index) => {
      const id = ++nextId.current;
      const validationError = validateUploadFile(file, accept, maxBytes);
      const countError = index >= safeMaxFiles ? `Selecione no máximo ${safeMaxFiles} arquivo(s) por vez.` : undefined;
      const error = countError || validationError || undefined;
      return { id, file, status: error ? 'error' as const : 'queued' as const, error, retryable: false };
    });
    setEntries(candidates);
    void processEntries(candidates.filter(entry => entry.status === 'queued'));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const retry = async (entry: UploadEntry) => {
    if (disabled || busy || !entry.retryable) return;
    const currentBatch = ++batchId.current;
    await runFile(entry, currentBatch);
  };

  const cancel = (entry: UploadEntry) => {
    controllers.current.get(entry.id)?.abort();
  };

  const describedBy = `${generatedId}-description ${generatedId}-limits`;
  return (
    <section className={`file-dropzone ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()} onDragEnter={event => { event.preventDefault(); if (!disabled && !busy) setDragging(true); }} onDragOver={event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = disabled || busy ? 'none' : 'copy'; }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={handleDrop} aria-labelledby={`${generatedId}-label`}>
      <div className="file-dropzone-prompt">
        <FileUp size={19} aria-hidden="true" />
        <div className="file-dropzone-copy">
          <strong id={`${generatedId}-label`}>{label}</strong>
          {description && <span id={`${generatedId}-description`}>{description}</span>}
          <span id={`${generatedId}-limits`}>Formatos: {accept} · Até {formatFileSize(maxBytes)} · Máximo {safeMaxFiles} arquivo(s) por seleção</span>
        </div>
        <button type="button" className="file-dropzone-select" disabled={disabled || busy} aria-describedby={describedBy} onKeyDown={handleKeyDown} onClick={() => inputRef.current?.click()}>
          {busy ? 'Aguarde…' : buttonLabel}
        </button>
        <input ref={inputRef} className="file-dropzone-input" type="file" accept={accept} multiple={safeMaxFiles > 1} tabIndex={-1} aria-hidden="true" disabled={disabled || busy} onChange={event => { acceptFiles(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} />
      </div>
      {entries.length > 0 && <ul className="file-dropzone-list" aria-live="polite" aria-relevant="additions text">
        {entries.map(entry => {
          const hasByteProgress = entry.status === 'processing' && Number.isFinite(entry.loaded) && Number.isFinite(entry.total) && (entry.total || 0) > 0;
          const percent = hasByteProgress ? Math.floor((entry.loaded! / entry.total!) * 100) : null;
          return <li key={entry.id} className={`file-dropzone-item status-${entry.status}`}>
            <div className="file-dropzone-file"><span className="file-dropzone-name" title={entry.file.name}>{entry.file.name}</span><span className="file-dropzone-size">{formatFileSize(entry.file.size)}</span></div>
            <div className="file-dropzone-status" role={entry.status === 'error' ? 'alert' : 'status'}>
              {entry.status === 'processing' ? <LoaderCircle size={15} className="file-dropzone-spinner" aria-hidden="true"/> : entry.status === 'success' ? <CheckCircle2 size={15} aria-hidden="true"/> : entry.status === 'error' ? <AlertCircle size={15} aria-hidden="true"/> : entry.status === 'cancelled' ? <X size={15} aria-hidden="true"/> : null}
              <span>{entry.error || statusText[entry.status]}{percent !== null && ` · ${percent}% dos bytes lidos`}</span>
              {entry.status === 'processing' && (percent === null ? <progress aria-label={`Processando ${entry.file.name}`} /> : <progress aria-label={`Leitura de ${entry.file.name}`} value={entry.loaded} max={entry.total} />)}
            </div>
            {entry.status === 'processing' && cancellable && <button type="button" className="file-dropzone-action" onClick={() => cancel(entry)} aria-label={`Cancelar ${entry.file.name}`}>Cancelar</button>}
            {entry.retryable && (entry.status === 'error' || entry.status === 'cancelled') && <button type="button" className="file-dropzone-action" onClick={() => void retry(entry)} disabled={busy || disabled} aria-label={`Tentar novamente ${entry.file.name}`}><RotateCcw size={14} aria-hidden="true"/> Tentar novamente</button>}
          </li>;
        })}
      </ul>}
    </section>
  );
}
