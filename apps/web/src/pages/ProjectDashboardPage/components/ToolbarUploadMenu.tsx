import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, FileText, Package, ReceiptText } from 'lucide-react';
import type { DocType } from '../../../types/reconciliation';

interface ToolbarUploadMenuProps {
  onUpload: (docType: DocType) => void;
}

export const ToolbarUploadMenu = ({ onUpload }: ToolbarUploadMenuProps) => {
  const { t } = useTranslation('projects');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const items: { type: DocType; label: string; icon: React.ReactNode }[] = [
    { type: 'PO', label: t('docType.po'), icon: <FileText className="w-[15px] h-[15px] opacity-70" /> },
    { type: 'DC', label: t('docType.dc'), icon: <Package className="w-[15px] h-[15px] opacity-70" /> },
    { type: 'INVOICE', label: t('docType.invoice'), icon: <ReceiptText className="w-[15px] h-[15px] opacity-70" /> },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-sm bg-base-100 text-base-content hover:bg-base-300 border border-base-300 gap-2 px-3 shadow-sm"
      >
        <UploadCloud className="w-3.5 h-3.5" />
        <span className="hidden sm:inline font-medium">{t('header.uploadDocs')}</span>
      </button>
      {open && (
        <ul className="absolute end-0 top-full mt-2 w-48 bg-base-100 rounded-box shadow-xl border border-base-200 py-2 z-[100] font-medium">
          {items.map((item) => (
            <li key={item.type}>
              <button
                onClick={() => { setOpen(false); onUpload(item.type); }}
                className="flex justify-between w-full text-start px-4 py-2.5 hover:bg-base-200 items-center text-sm text-base-content"
              >
                <span>{item.label}</span>
                {item.icon}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
