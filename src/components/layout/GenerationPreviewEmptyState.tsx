import { FileText } from 'lucide-react';

export function GenerationPreviewEmptyState({
  message = 'Selecione um projeto para começar.',
  title = 'A prévia será exibida aqui',
  className = '',
}: {
  message?: string;
  title?: string;
  className?: string;
}) {
  return (
    <div className={`generation-preview-empty-state ${className}`.trim()}>
      <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}
