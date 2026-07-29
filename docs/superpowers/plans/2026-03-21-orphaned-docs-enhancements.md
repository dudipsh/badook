# Orphaned Documents Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "handle" button (opens UploadDocumentModal), context menu (delete + block sender), and sender email info to the orphaned documents page.

**Architecture:** Extend the backend orphan docs query to include sender email from EmailScanLog. On the frontend, extend the existing `useUploadDocumentForm` hook to accept an optional `initialFileUrl` and project selector. Add a DaisyUI dropdown context menu per row.

**Tech Stack:** NestJS/Prisma (backend), React + MobX + TailwindCSS/DaisyUI (frontend), react-i18next

---

### Task 1: Backend — Add sender email to orphan docs response

**Files:**
- Modify: `apps/api/src/domain/projects/project-documents.service.ts:118-167`

- [ ] **Step 1: Add emailScanLog include to DeliveryNote query**

In `getOrphanDocuments()`, add `emailScanLog` to the DeliveryNote select:

```typescript
this.prisma.deliveryNote.findMany({
  where: { companyId, projectId: null },
  select: {
    id: true,
    noteNumber: true,
    supplierName: true,
    deliveryDate: true,
    totalAmount: true,
    originalFileUrl: true,
    createdAt: true,
    status: true,
    parsingConfidence: true,
    supplierId: true,
    emailScanLog: {
      select: { senderEmail: true, senderName: true },
    },
  },
  orderBy: { createdAt: 'desc' },
}),
```

**Note:** Only `DeliveryNote` has a direct `emailScanLogId` FK. PurchaseOrder and Invoice don't have this relation in the Prisma schema. Sender email will be available only for delivery note orphans. PO/Invoice orphans will have `senderEmail: undefined`, and the "Block Sender" context menu item will be hidden for them. This is acceptable because delivery notes are the most common orphan type and are the primary email-sourced documents.

- [ ] **Step 2: Verify the API returns the new fields**

Run: `cd apps/api && npx ts-node -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.deliveryNote.findFirst({ where: { projectId: null }, select: { emailScanLog: { select: { senderEmail: true } } } }).then(console.log).finally(() => p.\$disconnect())"`

Expected: Returns object with `emailScanLog: { senderEmail: '...' }` or `emailScanLog: null`

- [ ] **Step 3: Rebuild and restart the API server**

Run: `cd apps/api && npm run build && npm run start:dev`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/domain/projects/project-documents.service.ts
git commit -m "feat: include sender email in orphan documents response"
```

---

### Task 2: Frontend types + service — Add sender fields

**Files:**
- Modify: `apps/web/src/types/orphan.ts`
- Modify: `apps/web/src/services/projects.service.ts:165-198`
- Modify: `apps/web/src/services/orphan.service.ts`

- [ ] **Step 1: Add senderEmail/senderName to OrphanedDoc type**

In `types/orphan.ts`, add to `OrphanedDoc`:

```typescript
export interface OrphanedDoc {
  id: string;
  docType: OrphanDocType;
  docNumber: string | null;
  supplierName: string;
  date: string | null;
  totalAmount: number | null;
  originalFileUrl: string | null;
  createdAt: string;
  reason: OrphanReason;
  senderEmail?: string;
  senderName?: string;
}
```

- [ ] **Step 2: Update OrphanDocuments interface in projects.service.ts**

Add `emailScanLog` to the deliveryNotes type:

```typescript
deliveryNotes: Array<{
  id: string;
  noteNumber: string | null;
  supplierName: string;
  deliveryDate: string | null;
  totalAmount: number | null;
  originalFileUrl: string | null;
  createdAt: string;
  status: string;
  parsingConfidence: number | null;
  supplierId: string | null;
  emailScanLog?: { senderEmail: string; senderName: string } | null;
}>;
```

- [ ] **Step 3: Add deleteDoc to orphan.service.ts and pass sender info in flatten**

```typescript
// In flatten(), update the deliveryNotes loop:
for (const dn of data.deliveryNotes) {
  docs.push({
    id: dn.id, docType: 'deliveryNote', docNumber: dn.noteNumber,
    supplierName: dn.supplierName, date: dn.deliveryDate,
    totalAmount: dn.totalAmount, originalFileUrl: dn.originalFileUrl,
    createdAt: dn.createdAt, reason: inferDnReason(dn),
    senderEmail: dn.emailScanLog?.senderEmail,
    senderName: dn.emailScanLog?.senderName,
  });
}

// Add delete method:
async deleteDoc(doc: OrphanedDoc): Promise<void> {
  await projectsService.deleteOrphanDocument(doc.id, doc.docType);
},
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/types/orphan.ts apps/web/src/services/projects.service.ts apps/web/src/services/orphan.service.ts
git commit -m "feat: add sender email fields to orphan doc types and service"
```

---

### Task 3: Store — Add delete, block, and intake actions

**Files:**
- Modify: `apps/web/src/stores/orphan.store.ts`

- [ ] **Step 1: Add new observables and methods**

Add to `OrphanStore`:

```typescript
import type { OrphanedDoc, OrphanModalType } from '../types/orphan';
import type { OrphanDocType } from '../types/orphan';
import { orphanService } from '../services/orphan.service';
import type { DocType } from '../types/reconciliation';
import toast from 'react-hot-toast';
import i18n from '../i18n';

// New observable:
intakeDoc: OrphanedDoc | null = null;

// DocType mapping helper:
private docTypeToUploadType(docType: OrphanDocType): DocType {
  const map: Record<OrphanDocType, DocType> = {
    deliveryNote: 'DC',
    purchaseOrder: 'PO',
    invoice: 'INVOICE',
  };
  return map[docType];
}

get intakeDocType(): DocType | null {
  return this.intakeDoc ? this.docTypeToUploadType(this.intakeDoc.docType) : null;
}

openIntakeModal(doc: OrphanedDoc) {
  this.intakeDoc = doc;
}

closeIntakeModal() {
  this.intakeDoc = null;
}

async deleteDoc(doc: OrphanedDoc) {
  try {
    await orphanService.deleteDoc(doc);
    runInAction(() => {
      this.docs = this.docs.filter((d) => d.id !== doc.id);
    });
    toast.success(i18n.t('settings:orphan.deleteSuccess'));
  } catch {
    toast.error(i18n.t('settings:orphan.deleteError'));
  }
}

removeDocFromList(docId: string) {
  this.docs = this.docs.filter((d) => d.id !== docId);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/stores/orphan.store.ts
git commit -m "feat: add delete and intake actions to orphan store"
```

---

### Task 4: Context menu component

**Files:**
- Create: `apps/web/src/pages/OrphanedDocsPage/components/OrphanDocContextMenu.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { MoreVertical, Trash2, ShieldBan } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrphanedDoc } from '../../../types/orphan';

interface OrphanDocContextMenuProps {
  doc: OrphanedDoc;
  onDelete: () => void;
  onBlockSender: () => void;
}

export const OrphanDocContextMenu = ({ doc, onDelete, onBlockSender }: OrphanDocContextMenuProps) => {
  const { t } = useTranslation('settings');

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-xs btn-square">
        <MoreVertical className="w-4 h-4" />
      </div>
      <ul tabIndex={0} className="dropdown-content z-[50] menu p-2 shadow-lg bg-white rounded-xl border border-gray-200 w-48">
        <li>
          <a onClick={onDelete} className="text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
            {t('orphan.contextMenu.delete')}
          </a>
        </li>
        {doc.senderEmail && (
          <li>
            <a onClick={onBlockSender} className="hover:bg-orange-50">
              <ShieldBan className="w-4 h-4" />
              {t('orphan.contextMenu.blockSender')}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/OrphanedDocsPage/components/OrphanDocContextMenu.tsx
git commit -m "feat: add orphan doc context menu component"
```

---

### Task 5: Update OrphanDocRow — Add handle button + context menu

**Files:**
- Modify: `apps/web/src/pages/OrphanedDocsPage/components/OrphanDocRow.tsx`

- [ ] **Step 1: Replace per-reason action buttons with unified "handle" + context menu**

Replace the current content of `OrphanDocRow.tsx`:

```tsx
import { FileQuestion, Eye, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrphanedDoc } from '../../../types/orphan';
import { OrphanReasonBadge } from './OrphanReasonBadge';
import { OrphanDocContextMenu } from './OrphanDocContextMenu';
import i18n from '../../../i18n';

interface OrphanDocRowProps {
  doc: OrphanedDoc;
  onHandle: (doc: OrphanedDoc) => void;
  onView?: (doc: OrphanedDoc) => void;
  onDelete: (doc: OrphanedDoc) => void;
  onBlockSender: (doc: OrphanedDoc) => void;
}

export const OrphanDocRow = ({ doc, onHandle, onView, onDelete, onBlockSender }: OrphanDocRowProps) => {
  const { t } = useTranslation('settings');
  const displayDate = doc.date
    ? new Date(doc.date).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')
    : '\u2014';

  const isUnknownVendor = !doc.supplierName || doc.supplierName.includes('Unknown');

  return (
    <tr className="hover:bg-base-200/40 border-b border-base-100 last:border-0">
      <td className="pr-6 py-4">
        <OrphanReasonBadge reason={doc.reason} />
      </td>
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-base-200 flex items-center justify-center text-base-content/50">
            <FileQuestion className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-base-content text-sm">{doc.docNumber || t('orphan.noNumber')}</div>
            <div className="text-xs opacity-50 font-mono">{displayDate}</div>
          </div>
        </div>
      </td>
      <td className="py-4 font-medium text-base-content/80">
        {isUnknownVendor ? <span className="italic opacity-50">{t('orphan.unidentified')}</span> : doc.supplierName}
      </td>
      <td className="py-4 text-base-content/70 text-xs max-w-[200px]">
        {doc.reason === 'UNKNOWN_VENDOR'
          ? t('orphan.vendorNotInList', { vendor: doc.supplierName })
          : t(`orphan.issues.${doc.reason}`)}
      </td>
      <td className="py-4 text-left pl-6">
        <div className="flex items-center gap-2">
          {doc.originalFileUrl && onView && (
            <button onClick={() => onView(doc)} className="btn btn-ghost btn-xs gap-1" title={t('orphan.viewDocument')}>
              <Eye className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => onHandle(doc)} className="btn btn-primary btn-xs gap-1">
            <ClipboardCheck className="w-3 h-3" />
            {t('orphan.handle')}
          </button>
          <OrphanDocContextMenu
            doc={doc}
            onDelete={() => onDelete(doc)}
            onBlockSender={() => onBlockSender(doc)}
          />
        </div>
      </td>
    </tr>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/OrphanedDocsPage/components/OrphanDocRow.tsx
git commit -m "feat: update orphan doc row with handle button and context menu"
```

---

### Task 6: Update OrphanDocsTable — Wire new callbacks

**Files:**
- Modify: `apps/web/src/pages/OrphanedDocsPage/components/OrphanDocsTable.tsx`

- [ ] **Step 1: Replace handleAction with new callbacks**

```tsx
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../../lib/store-context';
import { OrphanDocRow } from './OrphanDocRow';
import type { OrphanedDoc } from '../../../types/orphan';
import toast from 'react-hot-toast';

export const OrphanDocsTable = observer(() => {
  const { t } = useTranslation(['projects', 'settings']);
  const { orphanStore, gmailStore } = useStores();

  const handleDelete = async (doc: OrphanedDoc) => {
    if (!confirm(t('settings:orphan.contextMenu.confirmDelete'))) return;
    await orphanStore.deleteDoc(doc);
  };

  const handleBlockSender = async (doc: OrphanedDoc) => {
    if (!doc.senderEmail) return;
    if (!confirm(t('settings:orphan.contextMenu.confirmBlock', { email: doc.senderEmail }))) return;
    try {
      await gmailStore.addBlockedRule('sender', doc.senderEmail);
      toast.success(t('settings:orphan.blockSuccess'));
    } catch {
      toast.error(t('settings:orphan.blockError'));
    }
  };

  return (
    <div className="flex-1 bg-base-100 rounded-box border border-base-200 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="table table-sm table-pin-rows w-full text-sm">
          <thead>
            <tr className="bg-base-200/50 text-base-content/60 uppercase text-xs">
              <th className="w-[15%] pr-6">{t('projects:orphan.status')}</th>
              <th className="w-[25%]">{t('projects:orphan.document')}</th>
              <th className="w-[20%]">{t('projects:orphan.identifiedSupplier')}</th>
              <th className="w-[20%]">{t('projects:orphan.problemDescription')}</th>
              <th className="w-[20%] text-left pl-6">{t('projects:orphan.action')}</th>
            </tr>
          </thead>
          <tbody>
            {orphanStore.docs.map((doc) => (
              <OrphanDocRow
                key={doc.id}
                doc={doc}
                onHandle={(d) => orphanStore.openIntakeModal(d)}
                onView={(d) => d.originalFileUrl && orphanStore.openDocument(d.originalFileUrl)}
                onDelete={handleDelete}
                onBlockSender={handleBlockSender}
              />
            ))}
            {orphanStore.docs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center opacity-40">
                    <CheckCircle2 className="w-12 h-12 mb-2 text-success" />
                    <p className="font-bold">{t('projects:orphan.allClear')}</p>
                    <p className="text-sm">{t('projects:orphan.noUnlinkedDocs')}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/OrphanedDocsPage/components/OrphanDocsTable.tsx
git commit -m "feat: wire delete and block sender callbacks in orphan docs table"
```

---

### Task 7: Extend useUploadDocumentForm hook

**Files:**
- Modify: `apps/web/src/pages/ProjectDashboardPage/hooks/useUploadDocumentForm.ts`

- [ ] **Step 1: Add optional props for orphan context**

Extend the interface and add initialFileUrl loading:

```typescript
interface UseUploadDocumentFormProps {
  docType: DocType;
  onClose: () => void;
  isOpen: boolean;
  initialFileUrl?: string;
  orphanDocId?: string;
  externalProjectId?: string;
}
```

Update the hook to use `externalProjectId` when available:

```typescript
const projectId = externalProjectId ?? project?.id ?? '';
const projectName = externalProjectId ? '' : (project?.name ?? '');
```

Add `initialFileUrl` loading after the reset effect — add a new effect:

```typescript
// Load initial file from URL (orphan doc flow)
useEffect(() => {
  if (!isOpen || !initialFileUrl) return;
  let cancelled = false;

  const loadFile = async () => {
    try {
      // Use fetch for absolute URLs, apiClient for relative paths
      const response = initialFileUrl.startsWith('http')
        ? await fetch(initialFileUrl).then((r) => r.blob())
        : await apiClient.get(initialFileUrl, { responseType: 'blob' }).then((r) => r.data as Blob);
      if (cancelled) return;
      const fileName = initialFileUrl.split('/').pop() || 'document.pdf';
      const file = new File([response], fileName, { type: response.type });
      handleFileSelect(file);
    } catch {
      toast.error(t('settings:upload.fileLoadError'));
    }
  };

  loadFile();
  return () => { cancelled = true; };
}, [isOpen, initialFileUrl]);
```

In `handleSubmit`, after success, handle the orphan vs project flow differently:

```typescript
// Replace the post-submit block:
if (orphanDocId) {
  // Orphan flow: notify success via callback, don't trigger matching modal
  onOrphanSuccess?.();
} else {
  projectDashboardStore.setMatching(true);
}
```

Add `onOrphanSuccess?: () => void` to the props interface:

```typescript
interface UseUploadDocumentFormProps {
  docType: DocType;
  onClose: () => void;
  isOpen: boolean;
  initialFileUrl?: string;
  orphanDocId?: string;
  externalProjectId?: string;
  onOrphanSuccess?: () => void;
}
```

Also add `orphanDocId`, `externalProjectId`, `onOrphanSuccess` to the returned object.

**i18n note:** The hook uses `useTranslation('projects')`. The `fileLoadError` key is in the `settings` namespace, so use `t('settings:upload.fileLoadError')` for the error toast (already shown in the effect code above).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/ProjectDashboardPage/hooks/useUploadDocumentForm.ts
git commit -m "feat: extend upload form hook to support orphan doc flow"
```

---

### Task 8: Update OrphanedDocsPage — Add UploadDocumentModal + project selector

**Files:**
- Modify: `apps/web/src/pages/OrphanedDocsPage/OrphanedDocsPage.tsx`

- [ ] **Step 1: Add UploadDocumentModal with project selector state**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '../../lib/store-context';
import { OrphanDocsTable } from './components/OrphanDocsTable';
import { DocumentViewerModal } from '../../components/shared/DocumentViewerModal';
import { UploadDocumentModal } from '../ProjectDashboardPage/components/UploadDocumentModal';

export const OrphanedDocsPage = observer(() => {
  const { orphanStore, projectsStore } = useStores();
  const { t } = useTranslation('settings');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectConfirmed, setProjectConfirmed] = useState(false);

  useEffect(() => {
    orphanStore.loadDocs();
  }, [orphanStore]);

  useEffect(() => {
    if (!projectsStore.projects.length) projectsStore.fetchProjects();
  }, [projectsStore]);

  // Reset project selection when intake modal opens
  useEffect(() => {
    if (orphanStore.intakeDoc) {
      setSelectedProjectId('');
      setProjectConfirmed(false);
    }
  }, [orphanStore.intakeDoc]);

  const handleIntakeClose = useCallback(() => {
    // Only close — doc is NOT removed from list (user cancelled)
    orphanStore.closeIntakeModal();
  }, [orphanStore]);

  const handleIntakeSuccess = useCallback(() => {
    // Upload succeeded — remove doc from orphan list, then close
    if (orphanStore.intakeDoc) {
      orphanStore.removeDocFromList(orphanStore.intakeDoc.id);
    }
    orphanStore.closeIntakeModal();
  }, [orphanStore]);

  if (orphanStore.loading && orphanStore.docs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <OrphanDocsTable />

      <DocumentViewerModal
        filePath={orphanStore.viewerFilePath}
        onClose={() => orphanStore.closeDocument()}
      />

      {/* Project selector dialog — shown until user confirms */}
      {orphanStore.intakeDoc && !projectConfirmed && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => orphanStore.closeIntakeModal()} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" dir="rtl">
            <h3 className="text-base font-bold text-gray-900 mb-3">{t('orphan.selectProjectTitle')}</h3>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4"
            >
              <option value="">{t('orphan.selectProject')}</option>
              {projectsStore.activeProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => orphanStore.closeIntakeModal()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                {t('common:cancel')}
              </button>
              <button
                onClick={() => setProjectConfirmed(true)}
                disabled={!selectedProjectId}
                className="btn btn-sm btn-primary disabled:opacity-50"
              >
                {t('orphan.continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal — only renders after project is confirmed */}
      {orphanStore.intakeDoc && orphanStore.intakeDocType && projectConfirmed && selectedProjectId && (
        <UploadDocumentModal
          isOpen={true}
          onClose={handleIntakeClose}
          docType={orphanStore.intakeDocType}
          initialFileUrl={orphanStore.intakeDoc.originalFileUrl ?? undefined}
          orphanDocId={orphanStore.intakeDoc.id}
          externalProjectId={selectedProjectId}
          onOrphanSuccess={handleIntakeSuccess}
        />
      )}
    </div>
  );
});
```

Note: `UploadDocumentModal` needs to be updated to accept and pass through the new props. See next step.

- [ ] **Step 2: Update UploadDocumentModal to accept new optional props**

In `apps/web/src/pages/ProjectDashboardPage/components/UploadDocumentModal.tsx`, extend the Props interface:

```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  docType: DocType;
  initialFileUrl?: string;
  orphanDocId?: string;
  externalProjectId?: string;
  onOrphanSuccess?: () => void;
}

export const UploadDocumentModal = ({ isOpen, onClose, docType, initialFileUrl, orphanDocId, externalProjectId, onOrphanSuccess }: Props) => {
  const { t } = useTranslation('projects');
  const form = useUploadDocumentForm({ docType, onClose, isOpen, initialFileUrl, orphanDocId, externalProjectId, onOrphanSuccess });
  // ... rest unchanged
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/OrphanedDocsPage/OrphanedDocsPage.tsx apps/web/src/pages/ProjectDashboardPage/components/UploadDocumentModal.tsx
git commit -m "feat: integrate upload modal with project selector in orphaned docs page"
```

---

### Task 9: i18n — Add new translation keys

**Files:**
- Modify: `apps/web/src/i18n/locales/he/settings.json`
- Modify: `apps/web/src/i18n/locales/en/settings.json`

- [ ] **Step 1: Add Hebrew keys**

Add to the `orphan` section in `he/settings.json`:

```json
"handle": "טפל",
"selectProjectTitle": "בחר פרויקט לשיוך",
"selectProject": "בחר פרויקט...",
"continue": "המשך",
"deleteSuccess": "המסמך נמחק בהצלחה",
"deleteError": "שגיאה במחיקת המסמך",
"blockSuccess": "השולח נחסם בהצלחה",
"blockError": "שגיאה בחסימת השולח",
"contextMenu": {
  "delete": "מחיקה",
  "blockSender": "חסום שולח",
  "confirmDelete": "האם אתה בטוח שברצונך למחוק מסמך זה?",
  "confirmBlock": "האם לחסום את השולח {{email}}? מיילים עתידיים ממנו לא ייסרקו."
}
```

Add to the `upload` section: `"fileLoadError": "שגיאה בטעינת הקובץ"`

- [ ] **Step 2: Add English keys**

Add matching keys to `en/settings.json`:

```json
"handle": "Handle",
"selectProjectTitle": "Select project to assign",
"selectProject": "Select project...",
"continue": "Continue",
"deleteSuccess": "Document deleted successfully",
"deleteError": "Error deleting document",
"blockSuccess": "Sender blocked successfully",
"blockError": "Error blocking sender",
"contextMenu": {
  "delete": "Delete",
  "blockSender": "Block Sender",
  "confirmDelete": "Are you sure you want to delete this document?",
  "confirmBlock": "Block sender {{email}}? Future emails from this address won't be scanned."
}
```

Add to upload section: `"fileLoadError": "Error loading file"`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/locales/he/settings.json apps/web/src/i18n/locales/en/settings.json
git commit -m "feat: add i18n keys for orphan doc handle, delete, and block sender"
```

---

### Task 10: Remove unused modals from OrphanedDocsPage

**Files:**
- Modify: `apps/web/src/pages/OrphanedDocsPage/OrphanedDocsPage.tsx`

- [ ] **Step 1: Remove ManualTriageModal and AssignProjectModal imports and usage**

These are replaced by the unified "handle" flow via UploadDocumentModal. Remove the imports and JSX for `ManualTriageModal` and `AssignProjectModal` from the page component. Keep the files themselves in case they're used elsewhere.

- [ ] **Step 2: Remove unused store methods if no longer referenced**

Check if `openTriageModal`, `openAssignModal`, `assignToProject` in `orphan.store.ts` are still used elsewhere. If not, remove them. Also remove `activeModal`, `selectedDoc`, `resolving` observables if unused.

Run: `cd apps/web && grep -r "openTriageModal\|openAssignModal\|assignToProject\|activeModal" src/ --include="*.tsx" --include="*.ts" | grep -v orphan.store`

If no results, safely remove the dead code.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/OrphanedDocsPage/OrphanedDocsPage.tsx apps/web/src/stores/orphan.store.ts
git commit -m "refactor: remove unused triage and assign modals from orphaned docs page"
```

---

### Task 11: Manual verification

- [ ] **Step 1: Start the dev server and verify the page**

Run: `cd apps/web && npm run dev`

Open the orphaned docs page and verify:
1. Table renders correctly with all orphan docs
2. "View" button opens document viewer
3. "Handle" button opens project selector dialog, then UploadDocumentModal with file pre-loaded
4. Context menu (three dots) shows Delete and Block Sender options
5. Delete shows confirm dialog, removes doc from list on success
6. Block Sender shows confirm dialog, adds rule via gmailStore
7. UploadDocumentModal works end-to-end: file loads, OCR extracts data, submit saves

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
