import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import type { ReactNode } from 'react';
import './feedback.css';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';
const icons = { success: CheckCircle2, warning: TriangleAlert, error: AlertCircle, info: Info };

export function Alert({ variant, children, onDismiss, className = '', role }: {
  variant: AlertVariant; children: ReactNode; onDismiss?: () => void; className?: string; role?: 'alert' | 'status';
}) {
  const Icon = icons[variant];
  return <div className={`surveyor-alert is-${variant} ${className}`.trim()} role={role || (variant === 'error' || variant === 'warning' ? 'alert' : 'status')}>
    <Icon size={19} aria-hidden="true"/><div className="surveyor-alert-content">{children}</div>
    {onDismiss && <button type="button" className="surveyor-alert-close" aria-label="Fechar mensagem" onClick={onDismiss}><X size={17}/></button>}
  </div>;
}
