import { useState } from 'react';
import { InlineDocumentViewer } from '../InlineDocumentViewer';
import type { RelatedDocument } from '../../../../types/reconciliation';

export interface DocColumn {
  type: string;
  title: string;
  count: string;
  docs: RelatedDocument[];
  cssColor: string;
}

const TYPE_PREFIX: Record<string, string> = {
  INV: 'INV',
  DC: 'DN',
  PO: 'PO',
};

const getDocTabLabel = (doc: RelatedDocument, idx: number) => {
  const prefix = TYPE_PREFIX[doc.type] || doc.type;
  const number = doc.documentNumber ?? doc.name;
  const digits = number.replace(/\D/g, '');
  const suffix = digits.length >= 4 ? digits.slice(-4) : digits;
  if (suffix) return `${prefix}-${suffix}`;
  return `${prefix}-${idx + 1}`;
};

export const DocumentColumn = ({ col, isFirst, noDocsLabel, unitsLabel, widthPercent }: {
  col: DocColumn;
  isFirst: boolean;
  noDocsLabel: string;
  unitsLabel: string;
  widthPercent: number;
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, col.docs.length - 1);
  const activeDoc = col.docs[safeIdx];

  return (
    <div className={`flex flex-col min-w-0 ${!isFirst ? 'border-l border-base-300' : ''}`} style={{ width: `${widthPercent}%` }}>
      <div
        className="border-b flex justify-between items-center shrink-0 px-4 py-2"
        style={{ background: `color-mix(in srgb, ${col.cssColor} 10%, transparent)`, borderColor: `color-mix(in srgb, ${col.cssColor} 20%, transparent)` }}
      >
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col.cssColor }}>
          {col.title}
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: col.cssColor }}>
          {col.count} {unitsLabel}
        </span>
      </div>

      {activeDoc ? (
        <InlineDocumentViewer fileUrl={activeDoc.fileUrl} filename={activeDoc.name} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-base-content/40 italic text-sm bg-base-200">
          {noDocsLabel}
        </div>
      )}

      {col.docs.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-base-200 border-t border-base-300 shrink-0 overflow-x-auto">
          {col.docs.map((doc, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`text-xs font-medium px-2 py-0.5 rounded transition-colors truncate max-w-[120px] ${idx === safeIdx ? 'evidence-tab--active' : 'text-base-content/40 hover:text-base-content/60'}`}
              title={doc.name}
            >
              {getDocTabLabel(doc, idx)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
