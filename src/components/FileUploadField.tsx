import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { AlertCircle, CheckCircle2, File, LoaderCircle, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react';
import { formatFileSize, validateUploadFiles } from './fileUploadValidation';
import './FileUploadField.css';

export type UploadProgressReporter = (file: File, loadedBytes: number, totalBytes: number) => void;
export type FileUploadHandler = (file: File, reportProgress: UploadProgressReporter, signal: AbortSignal) => void | Promise<void>;

export interface FileUploadFieldProps {
  label: string;
  accept?: string;
  description?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxBytes?: number;
  disabled?: boolean;
  cancellable?: boolean;
  className?: string;
  onFile: FileUploadHandler;
  onRemove?: (file: File) => void;
}

type ItemStatus = 'processing' | 'success' | 'error' | 'cancelled';
interface UploadItem { id: number; file: File; status: ItemStatus; progress: number | null; message?: string }
let nextUploadId = 1;

export function FileUploadField({
  label, accept, description, multiple = false, maxFiles, maxBytes, disabled = false, cancellable = false, className = '', onFile, onRemove
}: FileUploadFieldProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<number, AbortController>());
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState('');

  useEffect(() => () => { controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); }, []);

  const progress: UploadProgressReporter = (file, loaded, total) => {
    const percent = Number.isFinite(loaded) && Number.isFinite(total) && total > 0
      ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100)))
      : null;
    setItems((current) => current.map((item) => item.file === file && item.status === 'processing'
      ? { ...item, progress: percent } : item));
  };

  const process = async (item: UploadItem) => {
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    setItems((current) => current.map((entry) => entry.id === item.id
      ? { ...entry, status: 'processing', progress: null, message: undefined } : entry));
    try {
      await onFile(item.file, progress, controller.signal);
      if (controller.signal.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
      setItems((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, status: 'success', progress: null, message: undefined } : entry));
    } catch (error) {
      setItems((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, status: controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError') ? 'cancelled' : 'error', progress: null, message: controller.signal.aborted ? 'Envio cancelado.' : error instanceof Error ? error.message : 'Não foi possível processar este arquivo.' } : entry));
    } finally {
      if (controllers.current.get(item.id) === controller) controllers.current.delete(item.id);
    }
  };

  const addFiles = (fileList: FileList | File[]) => {
    if (disabled) return;
    const incoming = Array.from(fileList);
    setSelectionError('');
    if (!incoming.length) return;
    const limit = maxFiles ?? (multiple ? Infinity : 1);
    const existingCount = multiple ? items.filter((item) => item.status !== 'error').length : 0;
    const issues = validateUploadFiles(incoming, { accept, multiple, maxFiles: Math.max(0, limit - existingCount), maxBytes });
    const invalid = new Map(issues.map((issue) => [issue.file, issue.message]));
    if (issues.length) setSelectionError(issues.map(({ file, message }) => `${file.name}: ${message}`).join(' '));
    const candidates = incoming.map((file) => ({ id: nextUploadId++, file, status: 'processing' as const, progress: null, message: undefined }));
    const valid = candidates.filter((item) => !invalid.has(item.file));
    const rejected = candidates.filter((item) => invalid.has(item.file)).map((item) => ({
      ...item, status: 'error' as const, message: invalid.get(item.file)
    }));
    if (!multiple) {
      setItems((current) => {
        current.filter((item) => item.status !== 'error').forEach((item) => { controllers.current.get(item.id)?.abort(); onRemove?.(item.file); });
        return [...rejected, ...valid];
      });
    } else {
      setItems((current) => [...current, ...rejected, ...valid]);
    }
    for (const item of valid) void process(item);
    if (input.current) input.current.value = '';
  };

  const remove = (item: UploadItem) => {
    if (item.status === 'processing') return;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    onRemove?.(item.file);
  };

  const cancel = (item: UploadItem) => {
    controllers.current.get(item.id)?.abort();
    setItems((current) => current.map((entry) => entry.id === item.id
      ? { ...entry, status: 'cancelled', progress: null, message: 'Envio cancelado.' } : entry));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.target === input.current) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.current?.click(); }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  return <div className={`file-upload-field ${className}`.trim()}>
    <label
      className={`file-upload-dropzone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      htmlFor={inputId}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={handleDrop}
      aria-disabled={disabled}
    >
      <UploadCloud size={19} aria-hidden="true" />
      <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
      <input ref={input} id={inputId} type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={(event) => addFiles(event.currentTarget.files || [])} />
    </label>
    {selectionError && <p className="file-upload-message is-error" role="alert"><AlertCircle size={15}/>{selectionError}</p>}
    {items.length > 0 && <ul className="file-upload-list" aria-label="Arquivos selecionados">
      {items.map((item) => <li className={`file-upload-item is-${item.status}`} key={item.id}>
        <File size={18} className="file-upload-item-icon" aria-hidden="true" />
        <span className="file-upload-item-copy"><strong title={item.file.name}>{item.file.name}</strong><small>{formatFileSize(item.file.size)}</small>
          {item.status === 'processing' && <span className="file-upload-progress" role="status">
            {item.progress === null ? <><LoaderCircle size={13} className="is-spinning"/> Processando…</> : <><span className="file-upload-progress-track"><span style={{ width: `${item.progress}%` }}/></span>{item.progress}%</>}
          </span>}
          {item.status === 'success' && <small className="file-upload-status"><CheckCircle2 size={13}/> Processado</small>}
          {(item.status === 'error' || item.status === 'cancelled') && <small className={item.status === 'error' ? 'file-upload-error' : 'file-upload-cancelled'} role={item.status === 'error' ? 'alert' : 'status'}><AlertCircle size={13}/> {item.message || 'Falha no processamento.'}</small>}
        </span>
        {cancellable && item.status === 'processing' && <button type="button" className="file-upload-action" aria-label={`Cancelar envio: ${item.file.name}`} onClick={() => cancel(item)}><X size={15}/></button>}
        {(item.status === 'error' || item.status === 'cancelled') && <button type="button" className="file-upload-action" aria-label={`Tentar novamente: ${item.file.name}`} onClick={() => void process(item)}><RotateCcw size={15}/></button>}
        {item.status !== 'processing' && <button type="button" className="file-upload-action" aria-label={`Remover ${item.file.name}`} onClick={() => remove(item)}><Trash2 size={15}/></button>}
      </li>)}
    </ul>}
  </div>;
}
