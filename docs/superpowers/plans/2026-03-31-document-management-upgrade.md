# Document Management Screen Upgrade - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the project documents screen (`/projects/:id/documents`) with Sagur-inspired UI, sorting, edit/delete capabilities, and re-matching after changes.

**Architecture:** Enhance the existing `ProjectDocumentsPage` and `DocumentTable` components with new table design matching Sagur, add sort state, 3-dot dropdown menu for edit/delete on each row, "received date" column, and integrate `UploadDocumentModal` in edit mode. Backend gets a new document update endpoint. After edit/delete, trigger `checkReconciliation` to re-run matching.

**Tech Stack:** React, MobX, react-i18next, lucide-react, DaisyUI/Tailwind, NestJS (backend)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/web/src/pages/ProjectDocumentsPage/components/DocumentTable.tsx` | Redesigned table with Sagur UI, sorting, actions dropdown |
| Modify | `apps/web/src/pages/ProjectDocumentsPage/components/DocTableContent.tsx` | Pass new props (createdAt, docType, raw doc), handle edit/delete callbacks |
| Modify | `apps/web/src/pages/ProjectDocumentsPage/ProjectDocumentsPage.tsx` | Add edit modal state, delete handler, re-match trigger |
| Modify | `apps/web/src/pages/ProjectDashboardPage/components/UploadDocumentModal.tsx` | Add `editMode` + `initialData` props |
| Modify | `apps/web/src/pages/ProjectDashboardPage/hooks/useUploadDocumentForm.ts` | Support pre-populating from existing document for edit |
| Modify | `apps/web/src/services/projects.service.ts` | Add `updateDocument()` + `deleteProjectDocument()` (PO support) |
| Modify | `apps/web/src/i18n/locales/he/projects.json` | New translation keys |
| Modify | `apps/web/src/i18n/locales/en/projects.json` | New translation keys |
| Modify | `apps/api/src/domain/projects/projects.controller.ts` | Add PATCH endpoint for document update, extend DELETE to support PO |
| Modify | `apps/api/src/domain/projects/project-dashboard.service.ts` | Add `updateDocument()` method |

---

### Task 1: Add i18n Translation Keys

**Files:**
- Modify: `apps/web/src/i18n/locales/he/projects.json` (documents section)
- Modify: `apps/web/src/i18n/locales/en/projects.json` (documents section)

- [ ] **Step 1: Add Hebrew translation keys**

Add these keys inside the existing `"documents"` object in `apps/web/src/i18n/locales/he/projects.json`:

```json
"edit": "עריכה",
"delete": "מחיקה",
"confirmDelete": "האם למחוק את המסמך? פעולה זו אינה ניתנת לביטול.",
"deleteSuccess": "המסמך נמחק בהצלחה",
"deleteError": "שגיאה במחיקת המסמך",
"editDocument": "עריכת מסמך",
"updateSuccess": "המסמך עודכן בהצלחה",
"updateError": "שגיאה בעדכון המסמך",
"receivedDate": "תאריך קליטה",
"sortAsc": "מיון עולה",
"sortDesc": "מיון יורד",
"document": "מסמך"
```

- [ ] **Step 2: Add English translation keys**

Add the same keys in English inside `"documents"` in `apps/web/src/i18n/locales/en/projects.json`:

```json
"edit": "Edit",
"delete": "Delete",
"confirmDelete": "Delete this document? This action cannot be undone.",
"deleteSuccess": "Document deleted successfully",
"deleteError": "Error deleting document",
"editDocument": "Edit Document",
"updateSuccess": "Document updated successfully",
"updateError": "Error updating document",
"receivedDate": "Received Date",
"sortAsc": "Sort Ascending",
"sortDesc": "Sort Descending",
"document": "Document"
```

- [ ] **Step 3: Add `upload.update` and `upload.saveChanges` keys**

In Hebrew (`he/projects.json`), inside `"upload"`:
```json
"saveChanges": "שמור שינויים",
"update": "עדכון"
```

In English (`en/projects.json`), inside `"upload"`:
```json
"saveChanges": "Save Changes",
"update": "Update"
```

---

### Task 2: Add Backend Document Update Endpoint

**Files:**
- Modify: `apps/api/src/domain/projects/projects.controller.ts`
- Modify: `apps/api/src/domain/projects/project-dashboard.service.ts`

- [ ] **Step 1: Add `updateDocument` method to `ProjectDashboardService`**

In `apps/api/src/domain/projects/project-dashboard.service.ts`, add a method that:
1. Finds the document by ID + type (deliveryNote/purchaseOrder/invoice)
2. Updates the allowed fields (supplierName, docNumber, date, totalAmount)
3. Sets `needsReconciliation` flag on the document
4. Returns the updated document

```typescript
async updateDocument(
  companyId: string,
  documentId: string,
  documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
  data: { supplierName?: string; docNumber?: string; date?: string; totalAmount?: number },
) {
  // Update based on type using prisma
  // Then trigger reconciliation check
}
```

Read the existing `removeDocument` method in this file as reference for how to find documents by type. Follow the same pattern.

- [ ] **Step 2: Extend `removeDocument` to support purchaseOrder type**

The current `removeDocument` endpoint only accepts `'deliveryNote' | 'invoice'`. Extend the type union to also accept `'purchaseOrder'`, and in the service method, add a case for deleting purchase orders (similar to how delivery notes are deleted, but using the `purchaseOrder` model).

- [ ] **Step 3: Add PATCH route in `ProjectsController`**

In `apps/api/src/domain/projects/projects.controller.ts`, add:

```typescript
@Patch('documents/:documentId')
updateDocument(
  @Param('documentId') documentId: string,
  @CurrentUser('companyId') companyId: string,
  @Query('type') documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
  @Body() body: { supplierName?: string; docNumber?: string; date?: string; totalAmount?: number },
) {
  return this.dashboard.updateDocument(companyId, documentId, documentType, body);
}
```

Place this BEFORE the `@Patch(':id')` route (line ~191) to avoid route conflicts.

- [ ] **Step 4: Update DELETE route type to include purchaseOrder**

Change the type parameter on the existing `@Delete('documents/:documentId')` route from `'deliveryNote' | 'invoice'` to `'deliveryNote' | 'purchaseOrder' | 'invoice'`.

---

### Task 3: Add Frontend API Methods

**Files:**
- Modify: `apps/web/src/services/projects.service.ts`

- [ ] **Step 1: Add `updateDocument` method**

Add to the `projectsService` object:

```typescript
updateDocument(
  documentId: string,
  documentType: 'deliveryNote' | 'purchaseOrder' | 'invoice',
  data: { supplierName?: string; docNumber?: string; date?: string; totalAmount?: number },
) {
  return apiClient.patch(`/projects/documents/${documentId}?type=${documentType}`, data).then((r) => r.data);
},
```

- [ ] **Step 2: Extend `removeDocument` to support purchaseOrder**

Change the existing `removeDocument` method's type parameter from `'deliveryNote' | 'invoice'` to `'deliveryNote' | 'purchaseOrder' | 'invoice'`.

---

### Task 4: Redesign DocumentTable with Sagur UI, Sorting, and Actions

**Files:**
- Modify: `apps/web/src/pages/ProjectDocumentsPage/components/DocumentTable.tsx`

This is the main visual change. The table should match the Sagur design with:
- Columns: Document (name + supplier), Date, Amount, Received Date (createdAt), Status, Actions
- Sortable headers (click to toggle asc/desc/none)
- 3-dot menu on each row with Edit and Delete options
- Sagur-style status badges
- Hover effects matching Sagur (`hover:bg-base-200/30`)

- [ ] **Step 1: Update DocItem interface**

Replace the existing `DocItem` interface:

```typescript
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
```

- [ ] **Step 2: Add sort state and sort logic**

Add sort types and sorting logic inside the component file:

```typescript
type SortField = 'number' | 'supplier' | 'date' | 'amount' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

interface SortState {
  field: SortField | null;
  dir: SortDir;
}
```

Add a `useMemo` that sorts items based on sort state:

```typescript
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
  const sorted = [...items].sort((a, b) => {
    const fa = sort.field!;
    const va = a[fa];
    const vb = b[fa];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va).localeCompare(String(vb), 'he');
  });
  return sort.dir === 'desc' ? sorted.reverse() : sorted;
}, [items, sort]);
```

- [ ] **Step 3: Add SortableHeader helper**

```typescript
const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
  <th
    className="text-right text-[10px] font-semibold text-base-content/40 uppercase tracking-wider px-6 py-3 cursor-pointer select-none hover:text-base-content/60 transition-colors"
    onClick={() => toggleSort(field)}
  >
    <div className="flex items-center gap-1">
      {label}
      {sort.field === field && (
        <span className="text-secondary">
          {sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      )}
    </div>
  </th>
);
```

- [ ] **Step 4: Rewrite table JSX**

Replace the entire table JSX with the redesigned version. Key changes:
- Use `table table-sm w-full` classes (Sagur style)
- Header row: `bg-base-200/50 text-base-content/60 uppercase text-xs`
- Sortable headers using the `SortableHeader` component
- Amount header has `text-left` alignment
- Actions column has 3-dot dropdown menu

```tsx
return (
  <table className="table table-sm w-full text-sm">
    <thead>
      <tr className="bg-base-200/50 text-base-content/60 uppercase text-xs">
        <SortableHeader field="number" label={t('documents.document')} />
        <SortableHeader field="supplier" label={t('documents.supplier')} />
        <SortableHeader field="date" label={t('documents.date')} />
        <SortableHeader field="amount" label={t('documents.amount')} />
        <SortableHeader field="createdAt" label={t('documents.receivedDate')} />
        <SortableHeader field="status" label={t('documents.status')} />
        <th className="text-right text-[10px] font-semibold text-base-content/40 uppercase tracking-wider px-6 py-3">
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
                <span className="mr-2 text-[10px] bg-amber-100 text-warning px-1.5 py-0.5 rounded-full font-medium">
                  {t('documents.quote')}
                </span>
              )}
            </div>
          </td>

          {/* Supplier */}
          <td className="py-2.5 text-sm text-base-content/60">{item.supplier}</td>

          {/* Date */}
          <td className="py-2.5">
            <span className="text-xs font-mono text-base-content/40">
              {item.date ? new Date(item.date).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US') : '-'}
            </span>
          </td>

          {/* Amount */}
          <td className="py-2.5 text-sm text-base-content">
            {item.amount != null
              ? new Intl.NumberFormat(i18n.language === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(item.amount))
              : '-'}
          </td>

          {/* Received Date (createdAt) */}
          <td className="py-2.5">
            <span className="text-xs font-mono text-base-content/40">
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US') : '-'}
            </span>
          </td>

          {/* Status - badge style from Sagur */}
          <td className="py-2.5">
            <span className={`badge badge-outline badge-sm gap-1 font-bold text-xs ${getStatusBadge(item.status)}`}>
              {item.status === 'QUOTE' ? t('documents.quote') : item.status}
            </span>
          </td>

          {/* Actions - View, Download, 3-dot menu */}
          <td className="py-2.5 px-6">
            <div className="flex items-center justify-end gap-1">
              {item.fileUrl && (
                <>
                  <button
                    onClick={() => onView(item.fileUrl!)}
                    className="btn btn-xs btn-ghost h-7 min-h-0 px-2 text-[11px] text-base-content/70 hover:bg-base-300/50"
                    title={t('documents.view')}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => filesService.downloadFile(item.fileUrl!)}
                    className="btn btn-xs btn-ghost h-7 min-h-0 px-2 text-[11px] text-base-content/70 hover:bg-base-300/50"
                    title={t('documents.download')}
                  >
                    <Download size={14} />
                  </button>
                </>
              )}
              {/* 3-Dot Contextual Menu */}
              <div className="dropdown dropdown-end">
                <button tabIndex={0} className="btn btn-xs btn-ghost btn-square h-7 w-7 min-h-0 text-base-content/50 hover:bg-base-300 transition-colors">
                  <MoreHorizontal size={16} />
                </button>
                <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow-xl bg-base-100 rounded-box w-36 outline outline-1 outline-base-200 mt-1">
                  <li>
                    <button onClick={() => onEdit(item)} className="text-[13px] py-1.5 flex gap-2">
                      <FileEdit size={14} /> {t('documents.edit')}
                    </button>
                  </li>
                  <li>
                    <button onClick={() => onDelete(item)} className="text-[13px] py-1.5 flex gap-2 text-error hover:bg-error/10 hover:text-error transition-colors">
                      <Trash2 size={14} /> {t('documents.delete')}
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
```

- [ ] **Step 5: Update `getStatusBadge` helper**

Replace the import of `getStatusStyle` with an inline badge mapper matching Sagur badges:

```typescript
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
```

- [ ] **Step 6: Update component props and imports**

Update the component signature to accept the new callbacks:

```typescript
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Download, MoreHorizontal, FileEdit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { filesService } from '../../../services/files.service';
import i18n from '../../../i18n';

interface DocumentTableProps {
  items: DocItem[];
  onView: (fileUrl: string) => void;
  onEdit: (item: DocItem) => void;
  onDelete: (item: DocItem) => void;
}

export const DocumentTable = ({ items, onView, onEdit, onDelete }: DocumentTableProps) => {
```

---

### Task 5: Update DocTableContent to Pass New Props and Data

**Files:**
- Modify: `apps/web/src/pages/ProjectDocumentsPage/components/DocTableContent.tsx`

- [ ] **Step 1: Update the mappers to include `createdAt` and `docType`**

```typescript
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
```

- [ ] **Step 2: Update props and pass callbacks**

```typescript
import { DocItem } from './DocumentTable';

interface DocTableContentProps {
  activeTab: string;
  details: any;
  loading: boolean;
  onView: (url: string) => void;
  onEdit: (item: DocItem) => void;
  onDelete: (item: DocItem) => void;
}

export const DocTableContent = ({ activeTab, details, loading, onView, onEdit, onDelete }: DocTableContentProps) => {
  // ... existing loading state ...

  return (
    <div className="bg-white rounded-xl border border-base-300 overflow-hidden">
      <DocumentTable items={itemsMap[activeTab] ?? []} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
};
```

---

### Task 6: Add Edit Modal and Delete to ProjectDocumentsPage

**Files:**
- Modify: `apps/web/src/pages/ProjectDocumentsPage/ProjectDocumentsPage.tsx`

- [ ] **Step 1: Add state for edit modal and imports**

Add these state variables and imports:

```typescript
import { UploadDocumentModal } from '../ProjectDashboardPage/components/UploadDocumentModal';
import type { DocItem } from './components/DocumentTable';
import type { DocType } from '../../types/reconciliation';
import toast from 'react-hot-toast';
import { projectsService } from '../../services/projects.service';

// Inside the component:
const [editDoc, setEditDoc] = useState<DocItem | null>(null);
```

- [ ] **Step 2: Add delete handler**

```typescript
const handleDeleteDocument = useCallback(async (item: DocItem) => {
  if (!confirm(t('documents.confirmDelete'))) return;
  try {
    await projectsService.removeDocument(item.id, item.docType);
    toast.success(t('documents.deleteSuccess'));
    if (id) {
      projectsStore.fetchProjectFull(id);
      projectsService.checkReconciliation(id);
    }
  } catch {
    toast.error(t('documents.deleteError'));
  }
}, [id, projectsStore, t]);
```

- [ ] **Step 3: Add edit handler (opens modal)**

```typescript
const handleEditDocument = useCallback((item: DocItem) => {
  setEditDoc(item);
}, []);

const handleEditClose = useCallback(() => {
  setEditDoc(null);
  if (id) {
    projectsStore.fetchProjectFull(id);
    projectsService.checkReconciliation(id);
  }
}, [id, projectsStore]);
```

- [ ] **Step 4: Map DocItem.docType to DocType for the modal**

```typescript
const docTypeMap: Record<string, DocType> = {
  deliveryNote: 'DC',
  purchaseOrder: 'PO',
  invoice: 'INVOICE',
};
```

- [ ] **Step 5: Pass callbacks to DocTableContent and add edit modal**

Update the JSX to pass `onEdit` and `onDelete`, and add the edit modal:

```tsx
<DocTableContent
  activeTab={activeTab}
  details={details}
  loading={projectsStore.loading}
  onView={handleViewDocument}
  onEdit={handleEditDocument}
  onDelete={handleDeleteDocument}
/>

{/* ... after DocumentViewerModal ... */}

{editDoc && (
  <UploadDocumentModal
    isOpen={!!editDoc}
    onClose={handleEditClose}
    docType={docTypeMap[editDoc.docType] ?? 'DC'}
    editMode
    editDocumentId={editDoc.id}
    editDocumentType={editDoc.docType}
    externalProjectId={id}
  />
)}
```

---

### Task 7: Add Edit Mode to UploadDocumentModal and Form Hook

**Files:**
- Modify: `apps/web/src/pages/ProjectDashboardPage/components/UploadDocumentModal.tsx`
- Modify: `apps/web/src/pages/ProjectDashboardPage/hooks/useUploadDocumentForm.ts`

- [ ] **Step 1: Extend UploadDocumentModal props**

Add new optional props to the `Props` interface:

```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  docType: DocType;
  orphanDoc?: OrphanedDoc;
  externalProjectId?: string;
  showProjectSelector?: boolean;
  onOrphanSuccess?: () => void;
  editMode?: boolean;
  editDocumentId?: string;
  editDocumentType?: 'deliveryNote' | 'purchaseOrder' | 'invoice';
}
```

- [ ] **Step 2: Pass editMode props to the form hook**

In `UploadDocumentModal`, pass the new props down:

```typescript
const form = useUploadDocumentForm({
  docType,
  onClose,
  isOpen,
  orphanDoc,
  externalProjectId,
  showProjectSelector,
  onOrphanSuccess,
  editMode,
  editDocumentId,
  editDocumentType,
});
```

- [ ] **Step 3: Update modal title for edit mode**

In the top bar JSX, change the title based on edit mode:

```tsx
<h2 className="text-lg font-bold text-base-content" dir="auto">
  {editMode ? t('documents.editDocument') : t('upload.title')} - {t(TITLE_MAP[docType])}
</h2>
```

- [ ] **Step 4: Update save button label for edit mode**

```tsx
<button onClick={form.handleSubmit} disabled={!canSubmit} className="btn btn-sm btn-primary gap-1 min-w-[140px]">
  {form.submitStatus === 'uploading'
    ? <><Loader2 size={14} className="animate-spin" /> {editMode ? t('upload.update') : t('upload.uploading')}</>
    : form.submitStatus === 'success'
    ? <><CheckCircle2 size={14} /> {t('upload.success')}</>
    : <><Save size={14} /> {editMode ? t('upload.saveChanges') : t('upload.save')}</>}
</button>
```

- [ ] **Step 5: Adjust canSubmit for edit mode (no file required)**

```typescript
const canSubmit = form.submitStatus === 'idle'
  && !form.duplicateWarning
  && (form.editMode || form.isOrphanFlow ? !!form.fileUrl : !!form.uploadedFile)
  && (!form.showProjectSelector || !!form.selectedProjectId);
```

- [ ] **Step 6: Extend useUploadDocumentForm props and state**

In `useUploadDocumentForm.ts`, add the new props:

```typescript
interface UseUploadDocumentFormProps {
  docType: DocType;
  onClose: () => void;
  isOpen: boolean;
  orphanDoc?: OrphanedDoc;
  externalProjectId?: string;
  showProjectSelector?: boolean;
  onOrphanSuccess?: () => void;
  editMode?: boolean;
  editDocumentId?: string;
  editDocumentType?: 'deliveryNote' | 'purchaseOrder' | 'invoice';
}
```

- [ ] **Step 7: Pre-populate form when editing**

In the `useEffect` that resets on `isOpen`, add an edit-mode branch. After the orphanDoc branch:

```typescript
if (editMode && editDocumentId) {
  // Load the document data from the store's fullDetails
  const details = projectsStore.fullDetails;
  let doc: any = null;
  if (editDocumentType === 'deliveryNote') {
    doc = details?.deliveryNotes?.find((d) => d.id === editDocumentId);
    if (doc) {
      setDocNumber(doc.noteNumber ?? '');
      setDeliveryDate(doc.deliveryDate ?? '');
      setVendorName(doc.supplierName ?? '');
      setFileUrl(doc.originalFileUrl ?? null);
      if (doc.lineItems?.length) {
        setLineItems(doc.lineItems.map((li: any) => ({
          description: li.description ?? '',
          catalogNumber: li.catalogNumber ?? '',
          unit: li.unit ?? '',
          quantity: li.quantity?.toString() ?? '',
          unitPrice: li.unitPrice?.toString() ?? '',
          discountPercent: li.discountPercent?.toString() ?? '0',
        })));
      }
      setIsExtracted(true);
    }
  } else if (editDocumentType === 'purchaseOrder') {
    doc = details?.purchaseOrders?.find((d) => d.id === editDocumentId);
    if (doc) {
      setDocNumber(doc.poNumber ?? '');
      setDeliveryDate(doc.orderDate ?? '');
      setVendorName(doc.supplierName ?? '');
      setFileUrl(doc.originalFileUrl ?? null);
      if (doc.lineItems?.length) {
        setLineItems(doc.lineItems.map((li: any) => ({
          description: li.description ?? '',
          catalogNumber: li.catalogNumber ?? '',
          unit: li.unit ?? '',
          quantity: li.quantity?.toString() ?? '',
          unitPrice: li.unitPrice?.toString() ?? '',
          discountPercent: li.discountPercent?.toString() ?? '0',
        })));
      }
      setIsExtracted(true);
    }
  } else if (editDocumentType === 'invoice') {
    doc = details?.invoices?.find((d) => d.id === editDocumentId);
    if (doc) {
      setDocNumber(doc.invoiceNumber ?? '');
      setDeliveryDate(doc.invoiceDate ?? '');
      setVendorName(doc.supplierName ?? '');
      setFileUrl(doc.originalFileUrl ?? null);
      if (doc.lineItems?.length) {
        setLineItems(doc.lineItems.map((li: any) => ({
          description: li.description ?? '',
          catalogNumber: li.catalogNumber ?? '',
          unit: li.unit ?? '',
          quantity: li.quantity?.toString() ?? '',
          unitPrice: li.unitPrice?.toString() ?? '',
          discountPercent: li.discountPercent?.toString() ?? '0',
        })));
      }
      setIsExtracted(true);
    }
  }
}
```

- [ ] **Step 8: Add edit-mode submit handler**

In the `handleSubmit` function, add an edit branch before the orphan/normal branches:

```typescript
const handleSubmit = async () => {
  setSubmitStatus('uploading');
  setErrorMessage('');

  try {
    if (editMode && editDocumentId && editDocumentType) {
      await projectsService.updateDocument(editDocumentId, editDocumentType, {
        supplierName: vendorName || undefined,
        docNumber: docNumber || undefined,
        date: deliveryDate || undefined,
        totalAmount: grandTotal || undefined,
      });
      setSubmitStatus('success');
    } else if (orphanDoc) {
      // ... existing orphan flow
    } else {
      // ... existing normal upload flow
    }
    setTimeout(() => { onClose(); }, 600);
  } catch (e: any) {
    setSubmitStatus('error');
    setErrorMessage(e?.response?.data?.message || e?.message || t('upload.uploadFailed'));
  }
};
```

- [ ] **Step 9: Return editMode flag from the hook**

Add `editMode: !!editMode` to the return object so the modal can read it.

---

### Task 8: Build and Verify

- [ ] **Step 1: Run TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Run dev server and verify**

```bash
cd apps/web && npm run dev
```

Navigate to a project's documents page and verify:
- Table shows new columns (received date)
- Sort works on all columns
- 3-dot menu appears with Edit and Delete
- Edit opens the upload modal pre-populated
- Delete removes the document and refreshes
- The projects table (on `/projects`) still works correctly

---

## Notes

- **Do NOT modify** `VirtualTable.tsx` or any files in `apps/web/src/components/shared/virtual-table/` - these power the projects dashboard table.
- The existing `getStatusStyle.ts` file can be left in place (other components may use it), but the DocumentTable now uses its own inline badge mapper.
- The `removeDocument` in the backend uses the matching service to disconnect from matches and recompute. After calling it from the frontend, we also call `checkReconciliation` as a safety net.
- The edit flow updates document metadata and triggers re-matching through the `needsReconciliation` flag mechanism.
