# PO PDF Generation & Evidence Modal Improvements

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save/generate PDF for purchase orders and improve the evidence comparison modal with document toggles and full-screen layout fix.

**Architecture:** Three changes: (1) Pass uploaded file URL from extraction to PO create, and generate PDF on backend when no file uploaded using `pdf-lib`. (2) Fix modal CSS for full-screen RTL layout. (3) Add header toggles to select which document columns to show, with dynamic column sizing.

**Tech Stack:** pdf-lib (already in project), React, MobX, NestJS, Tailwind CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/domain/purchase-orders/dto/create-po.dto.ts` | Modify | Add `originalFileUrl` optional field |
| `apps/api/src/domain/purchase-orders/purchase-orders.controller.ts` | Modify | Use DTO's `originalFileUrl` when no file uploaded, call PDF generator when neither exists |
| `apps/api/src/domain/purchase-orders/po-pdf-generator.ts` | Create | Generate PDF from PO form data using pdf-lib |
| `apps/web/src/services/purchase-orders.service.ts` | Modify | Add `originalFileUrl` to `CreatePOPayload` |
| `apps/web/src/pages/OverviewPage/components/useCreatePOForm.ts` | Modify | Pass `fileUrl` from extraction in create payload |
| `apps/web/src/pages/ProjectDashboardPage/components/EvidenceSlidePanel.tsx` | Modify | Fix layout, add document toggles, dynamic columns |
| `apps/web/src/i18n/locales/en/projects.json` | Modify | Add new i18n keys |
| `apps/web/src/i18n/locales/he/projects.json` | Modify | Add new i18n keys |

---

## Chunk 1: Pass fileUrl and Generate PDF on Backend

### Task 1: Pass extracted fileUrl from frontend to backend on PO create

**Files:**
- Modify: `apps/api/src/domain/purchase-orders/dto/create-po.dto.ts`
- Modify: `apps/web/src/services/purchase-orders.service.ts`
- Modify: `apps/web/src/pages/OverviewPage/components/useCreatePOForm.ts`
- Modify: `apps/api/src/domain/purchase-orders/purchase-orders.controller.ts`

- [ ] **Step 1: Add `originalFileUrl` to CreatePODto**

In `apps/api/src/domain/purchase-orders/dto/create-po.dto.ts`, add the field:

```typescript
@IsOptional() @IsString() originalFileUrl?: string;
```

Add it after the `deliveryNotes` field (line 39).

- [ ] **Step 2: Add `originalFileUrl` to frontend CreatePOPayload**

In `apps/web/src/services/purchase-orders.service.ts`, add to the `CreatePOPayload` interface:

```typescript
originalFileUrl?: string;
```

Add it after `deliveryNotes` field.

- [ ] **Step 3: Pass fileUrl in useCreatePOForm submit**

In `apps/web/src/pages/OverviewPage/components/useCreatePOForm.ts`, in the `handleSubmit` function (line 194), add `originalFileUrl` to the payload:

```typescript
await purchaseOrdersService.create({
  poNumber,
  supplierName: vendorName.trim(),
  projectId: projectId || undefined,
  expectedDelivery: deliveryDate || undefined,
  paymentTerms: paymentTerms || undefined,
  vendorAddress: vendorAddress || undefined,
  vatNumber: vatNumber || undefined,
  withholdingTax: withholdingTax || undefined,
  siteContact: siteContact || undefined,
  sitePhone: sitePhone || undefined,
  deliveryNotes: deliveryNotes || undefined,
  totalAmount: grandTotal || undefined,
  originalFileUrl: fileUrl || undefined,  // <-- ADD THIS
  lineItems: lineItems
    .filter((li) => li.description.trim())
    .map((li) => ({
      description: li.description.trim(),
      catalogNumber: li.catalogNumber || undefined,
      unit: li.unit || undefined,
      quantity: parseFloat(li.quantity) || 0,
      unitPrice: parseFloat(li.unitPrice) || undefined,
      totalPrice: calcLineTotal(li) || undefined,
      discountPercent: parseFloat(li.discountPercent) || undefined,
    })),
});
```

- [ ] **Step 4: Update controller to use DTO's originalFileUrl**

In `apps/api/src/domain/purchase-orders/purchase-orders.controller.ts`, in the `create` method (line 155-189), update the fileUrl logic:

```typescript
async create(
  @CurrentUser('companyId') companyId: string,
  @CurrentUser('sub') userId: string,
  @Body() dto: CreatePODto,
  @UploadedFile() file?: Express.Multer.File,
) {
  let fileUrl: string | undefined;

  if (file) {
    // File uploaded directly with create request
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    fileUrl = await this.storage.upload(file.buffer, originalName, companyId);
  } else if (dto.originalFileUrl) {
    // File was already uploaded via extract-quote
    fileUrl = dto.originalFileUrl;
  }

  const po = await this.service.create({
    ...dto,
    companyId,
    createdById: userId,
    originalFileUrl: fileUrl,
  });

  // ... rest stays the same
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/purchase-orders/dto/create-po.dto.ts \
       apps/web/src/services/purchase-orders.service.ts \
       apps/web/src/pages/OverviewPage/components/useCreatePOForm.ts \
       apps/api/src/domain/purchase-orders/purchase-orders.controller.ts
git commit -m "fix: pass extracted fileUrl to PO create endpoint"
```

---

### Task 2: Generate PDF from PO form data when no file uploaded

**Files:**
- Create: `apps/api/src/domain/purchase-orders/po-pdf-generator.ts`
- Modify: `apps/api/src/domain/purchase-orders/purchase-orders.controller.ts`
- Modify: `apps/api/src/domain/purchase-orders/purchase-orders.module.ts`

- [ ] **Step 1: Create po-pdf-generator.ts**

Create `apps/api/src/domain/purchase-orders/po-pdf-generator.ts`. This service generates a simple RTL-compatible PDF from PO form data using `pdf-lib`.

```typescript
import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface POPdfData {
  poNumber: string;
  supplierName: string;
  orderDate?: string;
  expectedDelivery?: string;
  paymentTerms?: string;
  vendorAddress?: string;
  vatNumber?: string;
  siteContact?: string;
  sitePhone?: string;
  deliveryNotes?: string;
  totalAmount?: number;
  currency?: string;
  lineItems?: Array<{
    description: string;
    catalogNumber?: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
    discountPercent?: number;
  }>;
  companyName?: string;
}

@Injectable()
export class PoPdfGenerator {
  async generate(data: POPdfData): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;
    const lineHeight = 18;
    const darkGray = rgb(0.2, 0.2, 0.2);
    const lightGray = rgb(0.6, 0.6, 0.6);
    const headerBlue = rgb(0.2, 0.35, 0.65);

    // Helper: draw text left-aligned (PDF is LTR internally, Hebrew text will render if font supports it)
    const drawText = (text: string, x: number, yPos: number, size = 10, f = font, color = darkGray) => {
      page.drawText(text, { x, y: yPos, size, font: f, color });
    };

    const drawLine = (yPos: number) => {
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
    };

    // ── Header ──
    drawText('Purchase Order', margin, y, 20, fontBold, headerBlue);
    y -= 8;
    drawText(data.poNumber, margin, y, 12, font, lightGray);
    y -= lineHeight * 2;

    // ── Company & Supplier info ──
    if (data.companyName) {
      drawText('From:', margin, y, 8, font, lightGray);
      drawText(data.companyName, margin + 35, y, 10, fontBold);
      y -= lineHeight;
    }

    drawText('To:', margin, y, 8, font, lightGray);
    drawText(data.supplierName, margin + 35, y, 10, fontBold);
    y -= lineHeight;

    if (data.vendorAddress) {
      drawText(data.vendorAddress, margin + 35, y, 9, font, lightGray);
      y -= lineHeight;
    }
    if (data.vatNumber) {
      drawText(`VAT: ${data.vatNumber}`, margin + 35, y, 9, font, lightGray);
      y -= lineHeight;
    }

    y -= 8;
    drawLine(y);
    y -= lineHeight;

    // ── Order details ──
    const details: [string, string][] = [];
    if (data.orderDate) details.push(['Date', data.orderDate]);
    if (data.expectedDelivery) details.push(['Expected Delivery', data.expectedDelivery]);
    if (data.paymentTerms) details.push(['Payment Terms', data.paymentTerms]);

    for (const [label, value] of details) {
      drawText(`${label}:`, margin, y, 9, font, lightGray);
      drawText(value, margin + 120, y, 10, font);
      y -= lineHeight;
    }

    if (details.length > 0) {
      y -= 8;
      drawLine(y);
      y -= lineHeight;
    }

    // ── Line items table ──
    if (data.lineItems && data.lineItems.length > 0) {
      // Table header
      const colX = { num: margin, desc: margin + 30, qty: 320, unit: 370, price: 410, total: 480 };

      drawText('#', colX.num, y, 8, fontBold, lightGray);
      drawText('Description', colX.desc, y, 8, fontBold, lightGray);
      drawText('Qty', colX.qty, y, 8, fontBold, lightGray);
      drawText('Unit', colX.unit, y, 8, fontBold, lightGray);
      drawText('Price', colX.price, y, 8, fontBold, lightGray);
      drawText('Total', colX.total, y, 8, fontBold, lightGray);
      y -= 6;
      drawLine(y);
      y -= lineHeight;

      for (let i = 0; i < data.lineItems.length; i++) {
        if (y < margin + 60) {
          // New page
          page = doc.addPage([595, 842]);
          y = height - margin;
        }

        const item = data.lineItems[i];
        const lineTotal = item.totalPrice ?? (item.quantity * (item.unitPrice ?? 0));

        drawText(String(i + 1), colX.num, y, 9);
        // Truncate long descriptions
        const desc = item.description.length > 35 ? item.description.slice(0, 35) + '...' : item.description;
        drawText(desc, colX.desc, y, 9);
        drawText(String(item.quantity), colX.qty, y, 9);
        drawText(item.unit || '-', colX.unit, y, 9);
        drawText(item.unitPrice != null ? item.unitPrice.toFixed(2) : '-', colX.price, y, 9);
        drawText(lineTotal > 0 ? lineTotal.toFixed(2) : '-', colX.total, y, 9);

        if (item.discountPercent && item.discountPercent > 0) {
          y -= 12;
          drawText(`Discount: ${item.discountPercent}%`, colX.desc, y, 7, font, lightGray);
        }

        y -= lineHeight;
      }

      y -= 8;
      drawLine(y);
      y -= lineHeight;

      // Total
      if (data.totalAmount != null) {
        const currency = data.currency || 'ILS';
        drawText('Total:', colX.price, y, 11, fontBold);
        drawText(`${currency} ${data.totalAmount.toFixed(2)}`, colX.total, y, 11, fontBold, headerBlue);
        y -= lineHeight * 2;
      }
    }

    // ── Delivery info ──
    const deliveryDetails: [string, string][] = [];
    if (data.siteContact) deliveryDetails.push(['Site Contact', data.siteContact]);
    if (data.sitePhone) deliveryDetails.push(['Phone', data.sitePhone]);
    if (data.deliveryNotes) deliveryDetails.push(['Notes', data.deliveryNotes]);

    if (deliveryDetails.length > 0 && y > margin + 80) {
      drawText('Delivery Details', margin, y, 10, fontBold, headerBlue);
      y -= lineHeight;
      for (const [label, value] of deliveryDetails) {
        drawText(`${label}:`, margin, y, 9, font, lightGray);
        drawText(value, margin + 100, y, 9, font);
        y -= lineHeight;
      }
    }

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }
}
```

- [ ] **Step 2: Register PoPdfGenerator in the module**

In `apps/api/src/domain/purchase-orders/purchase-orders.module.ts`, add `PoPdfGenerator` to the providers array.

```typescript
import { PoPdfGenerator } from './po-pdf-generator';
// ...
providers: [...existingProviders, PoPdfGenerator],
```

- [ ] **Step 3: Use PoPdfGenerator in the controller when no file exists**

In `apps/api/src/domain/purchase-orders/purchase-orders.controller.ts`:

1. Inject `PoPdfGenerator` in the constructor
2. After creating the PO, if no `fileUrl` exists, generate a PDF and update the PO:

```typescript
import { PoPdfGenerator } from './po-pdf-generator';

// In constructor:
private readonly pdfGenerator: PoPdfGenerator,

// In create method, after the existing fileUrl logic:
if (!fileUrl) {
  // Generate PDF from form data
  const company = await this.service.getCompanyName(companyId);
  const pdfBuffer = await this.pdfGenerator.generate({
    poNumber: dto.poNumber,
    supplierName: dto.supplierName,
    orderDate: dto.orderDate,
    expectedDelivery: dto.expectedDelivery,
    paymentTerms: dto.paymentTerms,
    vendorAddress: dto.vendorAddress,
    vatNumber: dto.vatNumber,
    siteContact: dto.siteContact,
    sitePhone: dto.sitePhone,
    deliveryNotes: dto.deliveryNotes,
    totalAmount: dto.totalAmount,
    currency: dto.currency,
    lineItems: dto.lineItems,
    companyName: company,
  });
  fileUrl = await this.storage.upload(pdfBuffer, `${dto.poNumber}.pdf`, companyId);
}
```

- [ ] **Step 4: Add getCompanyName helper to PurchaseOrdersService**

In `apps/api/src/domain/purchase-orders/purchase-orders.service.ts`, add:

```typescript
async getCompanyName(companyId: string): Promise<string | undefined> {
  const company = await this.prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  return company?.name;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/purchase-orders/po-pdf-generator.ts \
       apps/api/src/domain/purchase-orders/purchase-orders.controller.ts \
       apps/api/src/domain/purchase-orders/purchase-orders.service.ts \
       apps/api/src/domain/purchase-orders/purchase-orders.module.ts
git commit -m "feat: generate PDF from PO form data when no file uploaded"
```

---

## Chunk 2: Fix Evidence Modal Layout and Add Document Toggles

### Task 3: Fix modal full-screen layout bug

**Files:**
- Modify: `apps/web/src/pages/ProjectDashboardPage/components/EvidenceSlidePanel.tsx`

The modal has `sm:m-4` which adds margin on all sides. Combined with RTL layout, the modal appears pushed/not full-screen.

- [ ] **Step 1: Fix the modal container CSS**

In `EvidenceSlidePanel.tsx` line 89, replace:

```tsx
<div className="flex flex-col w-full h-full bg-white sm:m-4 sm:rounded-2xl sm:shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
```

With:

```tsx
<div className="flex flex-col bg-white m-3 sm:m-5 rounded-2xl shadow-2xl overflow-hidden" style={{ position: 'absolute', inset: 0, margin: '12px', left: 0, right: 0 }} onClick={(e) => e.stopPropagation()}>
```

Actually, simpler approach — the `fixed inset-0` on the parent already covers viewport. The inner div just needs consistent margin without RTL interference:

Replace line 88-89:

```tsx
<div className={`fixed inset-0 z-[90] flex flex-col transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
  <div className="flex flex-col w-full h-full bg-white sm:m-4 sm:rounded-2xl sm:shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
```

With:

```tsx
<div className={`fixed z-[90] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ top: 12, left: 12, right: 12, bottom: 12 }}>
  <div className="flex flex-col w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
```

Using explicit `top/left/right/bottom` pixel values avoids any RTL `inset` interpretation issues.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/ProjectDashboardPage/components/EvidenceSlidePanel.tsx
git commit -m "fix: evidence modal full-screen layout in RTL"
```

---

### Task 4: Add document toggle header and dynamic column sizing

**Files:**
- Modify: `apps/web/src/pages/ProjectDashboardPage/components/EvidenceSlidePanel.tsx`
- Modify: `apps/web/src/i18n/locales/en/projects.json`
- Modify: `apps/web/src/i18n/locales/he/projects.json`

- [ ] **Step 1: Add i18n keys**

In `apps/web/src/i18n/locales/en/projects.json`, in the `"evidence"` section add:

```json
"documentComparison": "Document Comparison",
"showPurchaseOrder": "Purchase Order",
"showInvoice": "Invoice",
"showDeliveryNote": "Delivery Note"
```

In `apps/web/src/i18n/locales/he/projects.json`, in the `"evidence"` section add:

```json
"documentComparison": "השוואת מסמכים",
"showPurchaseOrder": "הזמנת רכש",
"showInvoice": "חשבונית",
"showDeliveryNote": "תעודת משלוח"
```

- [ ] **Step 2: Add toggle state and filter logic to EvidenceSlidePanel**

In `EvidenceSlidePanel.tsx`, add state for which document types are visible. The toggles default to showing all available types. The column width is computed as `100% / visibleCount`.

Add this state after the `isOpen` checks:

```tsx
// Track which doc types are visible — default all ON
const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(['PO', 'INV', 'DC']));

const toggleType = (type: string) => {
  setVisibleTypes((prev) => {
    const next = new Set(prev);
    if (next.has(type)) {
      // Don't allow hiding all
      if (next.size > 1) next.delete(type);
    } else {
      next.add(type);
    }
    return next;
  });
};
```

- [ ] **Step 3: Add toggle buttons in the header**

After the title section in the header (after `</div>` of the `min-w-0` div, before the close button), add a toggle row:

```tsx
{/* Document type toggles */}
<div className="flex items-center gap-1.5">
  {poDocs.length > 0 && (
    <ToggleChip
      label={t('evidence.showPurchaseOrder')}
      active={visibleTypes.has('PO')}
      onClick={() => toggleType('PO')}
      color="indigo"
    />
  )}
  <ToggleChip
    label={t('evidence.showInvoice')}
    active={visibleTypes.has('INV')}
    onClick={() => toggleType('INV')}
    color="rose"
  />
  <ToggleChip
    label={t('evidence.showDeliveryNote')}
    active={visibleTypes.has('DC')}
    onClick={() => toggleType('DC')}
    color="emerald"
  />
</div>
```

Add the `ToggleChip` component at the bottom of the file:

```tsx
const ToggleChip = ({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) => {
  const colors: Record<string, { on: string; off: string }> = {
    indigo: { on: 'bg-indigo-100 text-indigo-700 border-indigo-200', off: 'bg-gray-50 text-gray-400 border-gray-200' },
    rose: { on: 'bg-rose-100 text-rose-700 border-rose-200', off: 'bg-gray-50 text-gray-400 border-gray-200' },
    emerald: { on: 'bg-emerald-100 text-emerald-700 border-emerald-200', off: 'bg-gray-50 text-gray-400 border-gray-200' },
  };
  const c = colors[color] || colors.indigo;

  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${active ? c.on : c.off}`}
    >
      {label}
    </button>
  );
};
```

- [ ] **Step 4: Filter columns by visible types and add dynamic width**

Replace the column-building logic. Add a `type` field to `DocColumn`:

```typescript
interface DocColumn { type: string; title: string; count: string; docs: RelatedDocument[]; headerBg: string; textColor: string }
```

Add `type` to each column push:

```tsx
if (poDocs.length > 0) {
  columns.push({
    type: 'PO',
    title: t('evidence.purchaseOrder'),
    // ...
  });
}

columns.push({
  type: 'INV',
  title: t('evidence.invoiced'),
  // ...
});

columns.push({
  type: 'DC',
  title: t('evidence.received'),
  // ...
});
```

Filter columns by visible types:

```tsx
const visibleColumns = columns.filter((col) => visibleTypes.has(col.type));
```

Update the render to use `visibleColumns` and give each column an explicit flex-basis:

```tsx
<div className="flex-1 flex overflow-hidden min-h-0">
  {visibleColumns.map((col, idx) => (
    <DocumentColumn
      key={col.type}
      col={col}
      isFirst={idx === 0}
      noDocsLabel={t('evidence.noDocuments')}
      unitsLabel={t('evidence.units')}
      widthPercent={100 / visibleColumns.length}
    />
  ))}
</div>
```

Update `DocumentColumn` to accept and use `widthPercent`:

```tsx
const DocumentColumn = ({ col, isFirst, noDocsLabel, unitsLabel, widthPercent }: {
  col: DocColumn; isFirst: boolean; noDocsLabel: string; unitsLabel: string; widthPercent: number;
}) => {
  // ...
  return (
    <div
      className={`flex flex-col min-w-0 ${!isFirst ? 'border-l border-gray-200' : ''}`}
      style={{ width: `${widthPercent}%` }}
    >
      {/* ... rest unchanged */}
    </div>
  );
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ProjectDashboardPage/components/EvidenceSlidePanel.tsx \
       apps/web/src/i18n/locales/en/projects.json \
       apps/web/src/i18n/locales/he/projects.json
git commit -m "feat: add document toggles and dynamic column sizing to evidence modal"
```
