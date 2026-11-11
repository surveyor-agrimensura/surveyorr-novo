import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  label?: string;
}

export function Pagination({
  page, pageSize, totalItems, onPageChange, onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100], label = 'itens'
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.max(1, Math.min(page, pageCount));
  const start = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(totalItems, current * pageSize);
  const visiblePages = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : current <= 4
      ? [1, 2, 3, 4, 5, 6, pageCount]
      : current >= pageCount - 3
        ? [1, pageCount - 5, pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
        : [1, current - 1, current, current + 1, pageCount];

  return <nav className="surveyor-pagination" aria-label={`Paginação: ${label}`}>
    <div className="surveyor-pagination-summary">
      <label>Exibir
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label={`Quantidade de ${label} por página`}>
          {[...new Set([...pageSizeOptions, pageSize])].sort((a, b) => a - b).map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <span aria-live="polite">{start}–{end} de {totalItems} {label}</span>
    </div>
    <div className="surveyor-pagination-controls">
      <button type="button" className="surveyor-page-prev" aria-label="Página anterior" title="Página anterior" disabled={current <= 1} onClick={() => onPageChange(current - 1)}><ChevronLeft size={20}/></button>
      {visiblePages.map((value, index) => <span className="surveyor-page-number-wrap" key={value}>
        {index > 0 && value - visiblePages[index - 1] > 1 && <span className="surveyor-page-ellipsis" aria-hidden="true">…</span>}
        <button type="button" className={value === current ? 'is-current' : ''} aria-current={value === current ? 'page' : undefined} aria-label={`Página ${value}`} onClick={() => onPageChange(value)}>{value}</button>
      </span>)}
      <button type="button" className="surveyor-page-next" aria-label="Próxima página" title="Próxima página" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)}><ChevronRight size={20}/></button>
    </div>
  </nav>;
}
