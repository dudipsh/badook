# Orphaned Documents Page Enhancements

## Summary

Enhance the orphaned documents page with three capabilities:
1. **"Handle" (טפל) button** — opens the existing `UploadDocumentModal` with the orphan's file pre-loaded and correct docType, plus a project selector
2. **Context menu** — per-row dropdown with Delete and Block Sender actions
3. **Backend: sender email** — extend orphan docs endpoint to return `senderEmail`/`senderName` from `EmailScanLog`

## Backend Changes

### Extend `GET /projects/orphan-documents` response

**File:** `apps/api/src/domain/projects/project-documents.service.ts`

Add `include: { emailScanLog: { select: { senderEmail: true, senderName: true } } }` to the DeliveryNote query. For PurchaseOrder and Invoice, extract `emailScanLogId` from `parsedData` and batch-fetch sender info.

Each document in the response gains two optional fields:
```ts
senderEmail?: string;
senderName?: string;
```

No new endpoints needed — existing APIs cover all actions:
- `DELETE /projects/orphan-documents/:id?type=...` (delete)
- `POST /gmail/blocked-rules` (block sender)
- `POST /upload/delivery-note` (handle/intake)

## Frontend Changes

### 1. Types (`types/orphan.ts`)

Add to `OrphanedDoc`:
```ts
senderEmail?: string;
senderName?: string;
```

### 2. Store (`stores/orphan.store.ts`)

Add methods:
- `deleteDoc(doc: OrphanedDoc)` — calls DELETE endpoint, removes from list, shows toast
- `blockSender(email: string)` — delegates to `gmailStore.addBlockedRule('sender', email)`, shows toast
- `openIntakeModal(doc: OrphanedDoc)` — sets selected doc for the UploadDocumentModal flow
- `closeIntakeModal()` — clears intake state

New observable fields:
- `intakeDoc: OrphanedDoc | null`

### 3. Hook (`useUploadDocumentForm.ts`)

Extend `UseUploadDocumentFormProps`:
```ts
initialFileUrl?: string;   // pre-load file from URL
orphanDocId?: string;       // orphan doc ID for post-submit cleanup
externalProjectId?: string; // when project is selected externally (not from store)
```

Changes:
- When `initialFileUrl` is provided, fetch the file on open and call `handleFileSelect` with it
- When `externalProjectId` is provided, use it instead of `projectDashboardStore.project.id`
- On submit with `orphanDocId`: after successful upload, remove doc from orphan list

### 4. Components

**`OrphanDocContextMenu.tsx`** (new file in `OrphanedDocsPage/components/`)
- DaisyUI dropdown (`dropdown-end`) with `MoreVertical` trigger
- Two menu items: Delete (Trash2 icon, red text) and Block Sender (ShieldBan icon)
- Block Sender disabled when `senderEmail` is missing
- Both actions show confirmation dialog before executing

**`OrphanDocRow.tsx`** (modify)
- Add "טפל" button next to existing "view" button
- Add `OrphanDocContextMenu` at the end of the row
- Remove existing per-reason action buttons (replaced by unified "handle")

**`OrphanedDocsPage.tsx`** (modify)
- Add `UploadDocumentModal` with intake state from `orphanStore`
- Add project selector state (simple dropdown) that passes `externalProjectId` to the modal
- Map orphan `docType` to modal `DocType`: `deliveryNote→DC`, `purchaseOrder→PO`, `invoice→INVOICE`

### 5. i18n

Add keys to Hebrew and English locale files:
- `orphan.handle` — "טפל"
- `orphan.contextMenu.delete` — "מחיקה"
- `orphan.contextMenu.blockSender` — "חסום שולח"
- `orphan.contextMenu.confirmDelete` — "האם אתה בטוח שברצונך למחוק מסמך זה?"
- `orphan.contextMenu.confirmBlock` — "האם לחסום את השולח {email}?"
- `orphan.deleteSuccess` / `orphan.deleteError`
- `orphan.blockSuccess` / `orphan.blockError`
- `orphan.selectProject` — "בחר פרויקט"

## File Impact Summary

| File | Action |
|------|--------|
| `apps/api/.../project-documents.service.ts` | Modify — add emailScanLog join |
| `apps/web/.../types/orphan.ts` | Modify — add senderEmail fields |
| `apps/web/.../stores/orphan.store.ts` | Modify — add delete/block/intake methods |
| `apps/web/.../hooks/useUploadDocumentForm.ts` | Modify — add initialFileUrl/orphan support |
| `apps/web/.../OrphanDocRow.tsx` | Modify — add handle button + context menu |
| `apps/web/.../OrphanedDocsPage.tsx` | Modify — add UploadDocumentModal |
| `apps/web/.../OrphanDocContextMenu.tsx` | **New** — context menu component |
| `apps/web/.../i18n/locales/he/settings.json` | Modify — add orphan keys |
| `apps/web/.../i18n/locales/en/settings.json` | Modify — add orphan keys |
| `apps/web/.../services/orphan.service.ts` | Modify — add deleteDoc method |
