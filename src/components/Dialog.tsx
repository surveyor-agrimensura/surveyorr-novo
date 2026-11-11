import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import './feedback.css';

export function Dialog({ open = true, title, description, onClose, children, footer, closeOnEscape = true, closeOnBackdrop = false, className = '', backdropClassName = '', showClose = true }: {
  open?: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
  closeOnEscape?: boolean; closeOnBackdrop?: boolean; className?: string; backdropClassName?: string; showClose?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const titleId = useRef(`surveyor-dialog-${Math.random().toString(36).slice(2)}`);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement;
    const frame = requestAnimationFrame(() => {
      const target = dialog.current?.querySelector<HTMLElement>('[autofocus],input:not([type="hidden"]),select,textarea,button:not(:disabled),a[href]');
      target?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeOnEscape) { event.preventDefault(); closeRef.current(); }
        else event.preventDefault();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]'));
      if (!focusable.length) { event.preventDefault(); dialog.current.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKeyDown); returnFocus.current?.focus(); };
  }, [open, closeOnEscape]);

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  };
  if (!open) return null;

  return createPortal(<div className={`surveyor-dialog-backdrop ${backdropClassName}`.trim()} onMouseDown={handleBackdrop}>
    <section className={`surveyor-dialog ${className}`.trim()} ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId.current} aria-describedby={description ? `${titleId.current}-description` : undefined} tabIndex={-1}>
      <header className="surveyor-dialog-header"><div><h2 id={titleId.current}>{title}</h2>{description && <p id={`${titleId.current}-description`}>{description}</p>}</div>{showClose && <button type="button" className="surveyor-dialog-close" aria-label="Fechar janela" onClick={onClose}><X size={19}/></button>}</header>
      <div className="surveyor-dialog-body">{children}</div>
      {footer && <footer className="surveyor-dialog-footer">{footer}</footer>}
    </section>
  </div>, document.body);
}
