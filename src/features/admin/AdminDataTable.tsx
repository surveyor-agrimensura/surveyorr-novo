import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pagination } from '../../components/Pagination';
import { Search } from 'lucide-react';

export type AdminTableColumn<T> = {
  id: string;
  label: string;
  value: (row: T) => unknown;
  render?: (row: T) => ReactNode;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalize(value: unknown) {
  return text(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function AdminDataTable<T>({
  rows, columns, getId, label, emptyText, loading = false, rowActions, copyValue
}: {
  rows: T[];
  columns: AdminTableColumn<T>[];
  getId: (row: T) => string;
  label: string;
  emptyText: string;
  loading?: boolean;
  rowActions?: (row: T) => ReactNode;
  copyValue?: (row: T) => string;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ id: string; direction: 'asc' | 'desc' }>({ id: columns[0]?.id || '', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return rows.filter(row => !q || columns.some(column => normalize(column.value(row)).includes(q)));
  }, [columns, query, rows]);
  const sorted = useMemo(() => {
    const column = columns.find(item => item.id === sort.id);
    if (!column) return filtered;
    return [...filtered].sort((a, b) => {
      const left = column.value(a), right = column.value(b);
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : text(left).localeCompare(text(right), 'pt-BR', { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? result : -result;
    });
  }, [columns, filtered, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);
  const visibleIds = visible.map(getId);
  const selectedRows = rows.filter(row => selected.has(getId(row)));
  const allVisible = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

  useEffect(() => { setPage(1); }, [query, pageSize, sort]);
  useEffect(() => { setPage(current => Math.min(current, pageCount)); }, [pageCount]);

  const toggleVisible = (checked: boolean) => setSelected(current => {
    const next = new Set(current);
    visibleIds.forEach(id => checked ? next.add(id) : next.delete(id));
    return next;
  });
  const copySelection = async () => {
    if (!copyValue || !selectedRows.length) return;
    try {
      await navigator.clipboard.writeText(selectedRows.map(copyValue).filter(Boolean).join('\n'));
    } catch {
      const field = document.createElement('textarea');
      field.value = selectedRows.map(copyValue).filter(Boolean).join('\n');
      field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.appendChild(field); field.select(); document.execCommand('copy'); field.remove();
    }
  };

  return <div className="admin-data-table">
    <div className="admin-table-tools">
      <label className="admin-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Buscar ${label}`} aria-label={`Buscar ${label}`}/></label>
      <span className="admin-selection-status" role="status">{selectedRows.length} selecionado(s)</span>
      {selectedRows.length > 0 && <button type="button" className="admin-action" onClick={() => setSelected(new Set())}>Limpar seleção</button>}
      {copyValue && selectedRows.length > 0 && <button type="button" className="admin-action" onClick={() => void copySelection()}>Copiar seleção</button>}
      <span className="admin-table-status" role="status" aria-live="polite">{loading ? 'Atualizando dados…' : `${sorted.length} ${label}`}</span>
    </div>
    <div className="admin-table-wrap"><table className="admin-table">
      <thead><tr>
        <th className="admin-select-column" scope="col"><input type="checkbox" aria-label={`Selecionar todos os ${label} desta página`} checked={allVisible} ref={node => { if (node) node.indeterminate = visibleIds.some(id => selected.has(id)) && !allVisible; }} onChange={event => toggleVisible(event.target.checked)}/></th>
        {columns.map(column => <th key={column.id} scope="col" aria-sort={sort.id === column.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className="admin-sort-button" onClick={() => setSort(current => ({ id: column.id, direction: current.id === column.id && current.direction === 'asc' ? 'desc' : 'asc' }))} aria-label={`Ordenar por ${column.label}`}>{column.label}<span aria-hidden="true">{sort.id === column.id ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>)}
        {rowActions && <th scope="col">Ações</th>}
      </tr></thead>
      <tbody>{visible.map(row => <tr key={getId(row)}>
        <td className="admin-select-column"><input type="checkbox" aria-label={`Selecionar item de ${label}`} checked={selected.has(getId(row))} onChange={event => setSelected(current => { const next = new Set(current); event.target.checked ? next.add(getId(row)) : next.delete(getId(row)); return next; })}/></td>
        {columns.map(column => <td key={column.id}>{column.render ? column.render(row) : text(column.value(row))}</td>)}
        {rowActions && <td><div className="admin-inline-actions">{rowActions(row)}</div></td>}
      </tr>)}</tbody>
    </table>{!sorted.length && <div className="admin-empty" role={loading ? 'status' : 'note'}><p>{loading ? 'Carregando dados…' : query.trim() ? 'Nenhum resultado corresponde à busca.' : emptyText}</p></div>}</div>
    <Pagination page={page} pageSize={pageSize} totalItems={sorted.length} onPageChange={next => setPage(Math.max(1, Math.min(next, pageCount)))} onPageSizeChange={size => { setPageSize(size); setPage(1); }} label={label}/>
  </div>;
}
