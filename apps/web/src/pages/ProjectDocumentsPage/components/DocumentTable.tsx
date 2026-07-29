import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Download, MoreHorizontal, FileEdit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { filesService } from '../../../services/files.service';
import { formatCurrency } from '../../../lib/currencyUtils';
import { formatDate } from '../../../lib/formatters';

export interface DocItem {
  id: string;
  number: string;
  supplier: string;
  date: string | null;
  amount: number | null;
  status: string;
  fileUrl: string | null;
  fileName: string | null;
  isQuote?: boolean;
  createdAt: string | null;
  docType: 'deliveryNote' | 'purchaseOrder' | 'invoice';
}

type SortField = 'number' | 'supplier' | 'date' | 'amount' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

interface SortState {
  field: SortField | null;
  dir: SortDir;
}

interface DocumentTableProps {
  items: DocItem[];
  onView: (fileUrl: string) => void;
  onEdit: (item: DocItem) => void;
  onDelete: (item: DocItem) => void;
}

const getStatusBadge = (status: string): string => {
  switch (status) {
    case 'APPROVED':
    case 'MATCHED':
      return 'badge-success';
    case 'PENDING':
    case 'PARSED':
      return 'badge-warning';
    case 'REJECTED':
    case 'PARSE_FAILED':
      return 'badge-error';
    case 'QUOTE':
      return 'badge-warning';
    default:
      return 'badge-ghost';
  }
};

const ActionsMenu = ({ item, onEdit, onDelete, t }: { item: DocItem; onEdit: (item: DocItem) => void; onDelete: (item: DocItem) => void; t: (key: string) => string }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const toggle = useCallback(() => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left - 100 });
    }
    setOpen((v) => !v);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <>
      <button ref={btnRef} onClick={toggle} className="btn btn-xs btn-ghost btn-square h-7 w-7 min-h-0 text-base-content/50 hover:bg-base-300 transition-colors">
        <MoreHorizontal size={16} />
      </button>
      {open && createPortal(
        <ul ref={menuRef} className="fixed z-[9999] menu p-1 shadow-xl bg-base-100 rounded-box w-36 outline outline-1 outline-base-200" style={{ top: pos.top, left: pos.left }}>
          <li>
            <button onClick={() => { onEdit(item); setOpen(false); }} className="text-sm py-1.5 flex gap-2">
              <FileEdit size={14} /> {t('documents.edit')}
            </button>
          </li>
          <li>
            <button onClick={() => { onDelete(item); setOpen(false); }} className="text-sm py-1.5 flex gap-2 text-error hover:bg-error/10 hover:text-error transition-colors">
              <Trash2 size={14} /> {t('documents.delete')}
            </button>
          </li>
        </ul>,
        document.body,
      )}
    </>
  );
};

export const DocumentTable = ({ items, onView, onEdit, onDelete }: DocumentTableProps) => {
  const { t } = useTranslation('projects');
  const [sort, setSort] = useState<SortState>({ field: null, dir: 'asc' });

  const toggleSort = (field: SortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        return prev.dir === 'asc' ? { field, dir: 'desc' } : { field: null, dir: 'asc' };
      }
      return { field, dir: 'asc' };
    });
  };

  const sortedItems = useMemo(() => {
    if (!sort.field) return items;
    const f = sort.field;
    const sorted = [...items].sort((a, b) => {
      const va = a[f];
      const vb = b[f];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      return String(va).localeCompare(String(vb), 'he');
    });
    return sort.dir === 'desc' ? sorted.reverse() : sorted;
  }, [items, sort]);

  const SortableHeader = ({ field, label, align }: { field: SortField; label: string; align?: string }) => (
    <th
      className={`${align === 'left' ? 'text-left' : 'text-right'} text-xs font-semibold text-base-content/40 uppercase tracking-wider px-6 py-3 cursor-pointer select-none hover:text-base-content/60 transition-colors`}
      onClick={() => toggleSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === 'left' ? '' : ''}`}>
        {label}
        {sort.field === field && (
          <span className="text-secondary">
            {sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        )}
      </div>
    </th>
  );

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-base-content/40">
        {t('documents.noDocuments')}
      </div>
    );
  }

  return (
    <table className="table table-sm w-full text-sm">
      <thead>
        <tr className="bg-base-200/50 text-base-content/60 uppercase text-xs">
          <SortableHeader field="number" label={t('documents.number')} />
          <SortableHeader field="supplier" label={t('documents.supplier')} />
          <SortableHeader field="date" label={t('documents.date')} />
          <SortableHeader field="amount" label={t('documents.amount')} align="left" />
          <SortableHeader field="createdAt" label={t('documents.receivedDate')} />
          <SortableHeader field="status" label={t('documents.status')} />
          <th className="text-left text-xs font-semibold text-base-content/40 uppercase tracking-wider px-6 py-3">
            {t('documents.actions')}
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedItems.map((item) => (
          <tr key={item.id} className="border-b border-base-200/60 last:border-0 hover:bg-base-200/30 transition-colors">
            {/* Number + Quote badge */}
            <td className="px-6 py-2.5">
              <div className="font-bold text-base-content text-sm leading-tight">
                {item.number}
                {item.isQuote && (
                  <span className="mr-2 text-xs bg-warning/15 text-warning px-1.5 py-0.5 rounded-full font-medium">
                    {t('documents.quote')}
                  </span>
                )}
              </div>
            </td>

            {/* Supplier */}
            <td className="py-2.5 text-sm text-base-content/60">{item.supplier}</td>

            {/* Date */}
            <td className="py-2.5">
              <span className="text-xs font-mono text-base-content/40">{formatDate(item.date)}</span>
            </td>

            {/* Amount */}
            <td className="py-2.5 text-sm text-base-content text-left">{formatCurrency(item.amount)}</td>

            {/* Received Date (createdAt) */}
            <td className="py-2.5">
              <span className="text-xs font-mono text-base-content/40">{formatDate(item.createdAt)}</span>
            </td>

            {/* Status */}
            <td className="py-2.5">
              <span className={`badge badge-outline badge-sm gap-1 font-bold text-xs ${getStatusBadge(item.status)}`}>
                {item.status === 'QUOTE' ? t('documents.quote') : item.status}
              </span>
            </td>

            {/* Actions */}
            <td className="py-2.5 px-6">
              <div className="flex items-center justify-start gap-1">
                {item.fileUrl && (
                  <>
                    <button
                      onClick={() => onView(item.fileUrl!)}
                      className="btn btn-xs btn-ghost h-7 min-h-0 px-2 text-xs text-base-content/70 hover:bg-base-300/50"
                      title={t('documents.view')}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => filesService.downloadFile(item.fileUrl!)}
                      className="btn btn-xs btn-ghost h-7 min-h-0 px-2 text-xs text-base-content/70 hover:bg-base-300/50"
                      title={t('documents.download')}
                    >
                      <Download size={14} />
                    </button>
                  </>
                )}
                <ActionsMenu item={item} onEdit={onEdit} onDelete={onDelete} t={t} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
