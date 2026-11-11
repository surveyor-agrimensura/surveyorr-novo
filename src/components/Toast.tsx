import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, type AlertVariant } from './Alert';

type ToastInput = string | { message: string; variant?: AlertVariant; durationMs?: number };
type ToastNotifier = ((input: ToastInput, variant?: AlertVariant) => void) & {
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: () => void;
};
type ToastMessage = { id: number; message: string; variant: AlertVariant; durationMs: number };
let nextToastId = 1;
const ToastContext = createContext<ToastNotifier>(Object.assign(() => {}, {
  success: () => {}, warning: () => {}, error: () => {}, info: () => {}, dismiss: () => {}
}));

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const notifyBase = useCallback((input: ToastInput, variant: AlertVariant = 'info') => {
    const options = typeof input === 'string' ? { message: input, variant } : input;
    setToast({ id: nextToastId++, message: options.message, variant: options.variant || 'info', durationMs: options.durationMs ?? (options.variant === 'error' ? 8000 : 5000) });
  }, []);
  const notify = useMemo<ToastNotifier>(() => Object.assign(notifyBase, {
    success: (message: string) => notifyBase({ message, variant: 'success' }),
    warning: (message: string) => notifyBase({ message, variant: 'warning', durationMs: 7000 }),
    error: (message: string) => notifyBase({ message, variant: 'error', durationMs: 8000 }),
    info: (message: string) => notifyBase({ message, variant: 'info' }),
    dismiss
  }), [notifyBase, dismiss]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return <ToastContext.Provider value={notify}>{children}{toast && <div className={`surveyor-toast is-${toast.variant}`}><Alert variant={toast.variant} onDismiss={dismiss}>{toast.message}</Alert></div>}</ToastContext.Provider>;
}

export function useToast() { return useContext(ToastContext); }
