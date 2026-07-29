import { DocumentTable, type DocItem } from './DocumentTable';

interface DocTableContentProps {
  activeTab: string;
  details: any;
  loading: boolean;
  onView: (url: string) => void;
  onEdit: (item: DocItem) => void;
  onDelete: (item: DocItem) => void;
}

export const DocTableContent = ({ activeTab, details, loading, onView, onEdit, onDelete }: DocTableContentProps) => {
  if (loading) {
    return <div className="flex items-center justify-center h-32"><span className="loading loading-spinner loading-md text-base-content/40" /></div>;
  }

  const mapDN = (dn: any): DocItem => ({
    id: dn.id,
    number: dn.noteNumber || '-',
    supplier: dn.supplierName,
    date: dn.deliveryDate,
    amount: dn.totalAmount,
    status: dn.status,
    fileUrl: dn.originalFileUrl,
    fileName: dn.originalFileName,
    createdAt: dn.createdAt,
    docType: 'deliveryNote',
  });

  const mapPO = (po: any): DocItem => ({
    id: po.id,
    number: po.poNumber,
    supplier: po.supplierName,
    date: po.orderDate,
    amount: po.totalAmount,
    status: po.isQuote ? 'QUOTE' : po.status,
    fileUrl: po.originalFileUrl || null,
    fileName: null,
    isQuote: po.isQuote ?? false,
    createdAt: po.createdAt,
    docType: 'purchaseOrder',
  });

  const mapINV = (inv: any): DocItem => ({
    id: inv.id,
    number: inv.invoiceNumber,
    supplier: inv.supplierName,
    date: inv.invoiceDate,
    amount: inv.totalAmount,
    status: inv.status,
    fileUrl: inv.originalFileUrl || null,
    fileName: null,
    createdAt: inv.createdAt,
    docType: 'invoice',
  });

  const itemsMap: Record<string, DocItem[]> = {
    'delivery-notes': (details?.deliveryNotes ?? []).map(mapDN),
    'purchase-orders': (details?.purchaseOrders ?? []).map(mapPO),
    'invoices': (details?.invoices ?? []).map(mapINV),
  };

  return (
    <div className="h-full">
      <DocumentTable items={itemsMap[activeTab] ?? []} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
};
