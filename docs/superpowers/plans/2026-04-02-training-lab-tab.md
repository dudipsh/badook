# Training Lab Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Training Lab" tab to the existing `apps/web` frontend that connects to the `apps/labeling-api` (port 3002), letting users upload documents, review/correct Gemini extractions, and export training data.

**Architecture:** Fully isolated feature — all code in `pages/TrainingLabPage/`, with a separate Axios client pointing to labeling-api via Vite proxy. No MobX store; uses React hooks + local state. 4 existing files get minimal wiring changes (~8 lines total).

**Tech Stack:** React 19, React Router 7, Axios, TailwindCSS + DaisyUI, Lucide icons, i18next, react-hot-toast.

**Spec:** `docs/superpowers/specs/2026-04-02-training-lab-tab-design.md`

**Removal guide:** See spec file, section "How to Remove This Feature"

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/services/labeling-api.client.ts` | Axios instance for labeling-api (separate from main apiClient) |
| `src/pages/TrainingLabPage/types.ts` | TypeScript types for Sample, Extraction, etc. |
| `src/pages/TrainingLabPage/api.ts` | All API calls to labeling-api |
| `src/pages/TrainingLabPage/TrainingLabPage.tsx` | Main page with 3 tabs |
| `src/pages/TrainingLabPage/components/SamplesTab.tsx` | Samples list + upload |
| `src/pages/TrainingLabPage/components/UploadModal.tsx` | Drag & drop upload modal |
| `src/pages/TrainingLabPage/components/SampleEditor.tsx` | Side-by-side editor (image + form) |
| `src/pages/TrainingLabPage/components/ExportsTab.tsx` | Export training data |
| `src/i18n/locales/he/training-lab.json` | Hebrew translations |
| `src/i18n/locales/en/training-lab.json` | English translations |

### Modified files (minimal wiring)
| File | Change |
|------|--------|
| `vite.config.ts` | Add proxy `/labeling-api` → `localhost:3002` |
| `src/i18n/index.ts` | Add `training-lab` namespace |
| `src/components/layout/SagurSidebar.tsx` | Add NavItem |
| `src/App.tsx` | Add Route |

---

## Task 1: Vite Proxy + API Client

**Files:**
- Modify: `apps/web/vite.config.ts:16`
- Create: `apps/web/src/services/labeling-api.client.ts`

- [ ] **Step 1: Add proxy to vite.config.ts**

In `apps/web/vite.config.ts`, replace line 16:
```ts
  server: { port: 5173 },
```
with:
```ts
  server: {
    port: 5173,
    proxy: {
      '/labeling-api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/labeling-api/, ''),
      },
    },
  },
```

- [ ] **Step 2: Create labeling-api client**

Create `apps/web/src/services/labeling-api.client.ts`:
```ts
import axios from 'axios';

export const labelingApi = axios.create({
  baseURL: '/labeling-api',
  headers: { 'Content-Type': 'application/json' },
});

labelingApi.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_LABELING_API_KEY;
  if (apiKey) {
    config.headers['x-api-key'] = apiKey;
  }
  return config;
});
```

- [ ] **Step 3: Add env var to apps/web/.env**

Add to `apps/web/.env` (create if not exists):
```
VITE_LABELING_API_KEY=labeling-dev-key
```

- [ ] **Step 4: Verify proxy works**

Restart Vite dev server, then:
```bash
curl -s http://localhost:5173/labeling-api/health
```
Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 5: Commit**
```bash
git add apps/web/vite.config.ts apps/web/src/services/labeling-api.client.ts apps/web/.env
git commit -m "feat(training-lab): add vite proxy and labeling-api client"
```

---

## Task 2: Types + API Layer

**Files:**
- Create: `apps/web/src/pages/TrainingLabPage/types.ts`
- Create: `apps/web/src/pages/TrainingLabPage/api.ts`

- [ ] **Step 1: Create types**

Create `apps/web/src/pages/TrainingLabPage/types.ts`:
```ts
export type DocumentType = 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER';

export type SampleStatus = 'PENDING' | 'AUTO_EXTRACTED' | 'LABELED' | 'VERIFIED';

export interface LineItem {
  description: string;
  catalogNumber: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  priceBeforeDiscount: number | null;
  remarks: string;
}

export interface BaseExtraction {
  supplierName: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierBusinessId: string;
  customerName: string;
  lineItems: LineItem[];
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  notes: string;
  confidence: number | null;
}

export interface DeliveryNoteExtraction extends BaseExtraction {
  noteNumber: string;
  deliveryDate: string;
  deliveryAddress: string;
  projectName: string;
  poReference: string;
}

export interface InvoiceExtraction extends BaseExtraction {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  poReference: string;
  deliveryNoteReferences: string[];
}

export interface PurchaseOrderExtraction extends BaseExtraction {
  poNumber: string;
  orderDate: string;
  expectedDelivery: string;
  deliveryAddress: string;
  projectName: string;
}

export type Extraction = DeliveryNoteExtraction | InvoiceExtraction | PurchaseOrderExtraction;

export interface Sample {
  id: string;
  documentType: DocumentType;
  status: SampleStatus;
  originalFileName: string;
  filePath: string;
  pageCount: number;
  geminiExtraction: Extraction | null;
  geminiConfidence: number | null;
  geminiTokens: number | null;
  geminiCostUsd: number | null;
  qwenExtraction: Extraction | null;
  qwenConfidence: number | null;
  groundTruth: Extraction | null;
  labeledAt: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSamples {
  samples: Sample[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Stats {
  total: number;
  byStatus: Record<SampleStatus, number>;
  byType: Record<DocumentType, number>;
}

export interface ExportRecord {
  id: string;
  format: string;
  documentType: string | null;
  sampleCount: number;
  filePath: string;
  createdAt: string;
}
```

- [ ] **Step 2: Create API layer**

Create `apps/web/src/pages/TrainingLabPage/api.ts`:
```ts
import { labelingApi } from '../../services/labeling-api.client';
import type { Sample, PaginatedSamples, Stats, DocumentType, SampleStatus, ExportRecord } from './types';

export const samplesApi = {
  list: async (params: { page: number; limit: number; status?: SampleStatus; documentType?: DocumentType; search?: string }) => {
    const { data } = await labelingApi.get<PaginatedSamples>('/samples', { params });
    return data;
  },

  get: async (id: string) => {
    const { data } = await labelingApi.get<Sample>(`/samples/${id}`);
    return data;
  },

  upload: async (file: File, documentType: DocumentType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    const { data } = await labelingApi.post<Sample>('/samples/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  updateGroundTruth: async (id: string, groundTruth: unknown, tags?: string[], notes?: string) => {
    const body: Record<string, unknown> = { groundTruth };
    if (tags) body.tags = tags;
    if (notes !== undefined) body.notes = notes;
    const { data } = await labelingApi.patch<Sample>(`/samples/${id}/ground-truth`, body);
    return data;
  },

  verify: async (id: string) => {
    const { data } = await labelingApi.post<Sample>(`/samples/${id}/verify`);
    return data;
  },

  reExtract: async (id: string) => {
    const { data } = await labelingApi.post<Sample>(`/samples/${id}/re-extract`);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await labelingApi.delete<Sample>(`/samples/${id}`);
    return data;
  },

  stats: async () => {
    const { data } = await labelingApi.get<Stats>('/stats');
    return data;
  },

  fileUrl: (sampleId: string) => `/labeling-api/files/${sampleId}`,
};

export const exportsApi = {
  create: async (params: { documentType?: DocumentType; format?: string; minStatus?: 'LABELED' | 'VERIFIED' }) => {
    const { data } = await labelingApi.post<ExportRecord>('/export', params);
    return data;
  },

  list: async () => {
    const { data } = await labelingApi.get<ExportRecord[]>('/exports');
    return data;
  },

  downloadUrl: (id: string) => `/labeling-api/exports/${id}/download`,
};
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/pages/TrainingLabPage/types.ts apps/web/src/pages/TrainingLabPage/api.ts
git commit -m "feat(training-lab): add types and API layer"
```

---

## Task 3: i18n Translations

**Files:**
- Create: `apps/web/src/i18n/locales/he/training-lab.json`
- Create: `apps/web/src/i18n/locales/en/training-lab.json`
- Modify: `apps/web/src/i18n/index.ts`

- [ ] **Step 1: Create Hebrew translations**

Create `apps/web/src/i18n/locales/he/training-lab.json`:
```json
{
  "title": "מעבדת אימון",
  "tabs": {
    "samples": "דוגמאות",
    "editor": "עורך",
    "exports": "ייצוא"
  },
  "samples": {
    "upload": "העלאת מסמך",
    "search": "חיפוש לפי שם קובץ...",
    "filterStatus": "סטטוס",
    "filterType": "סוג מסמך",
    "all": "הכל",
    "noResults": "לא נמצאו דוגמאות",
    "fileName": "שם קובץ",
    "type": "סוג",
    "status": "סטטוס",
    "confidence": "ביטחון",
    "date": "תאריך",
    "actions": "פעולות",
    "edit": "ערוך",
    "delete": "מחק",
    "deleteConfirm": "בטוח שרוצה למחוק?"
  },
  "upload": {
    "title": "העלאת מסמך לאימון",
    "dropzone": "גרור קובץ לכאן או לחץ לבחירה",
    "fileSelected": "נבחר: {{name}}",
    "selectType": "סוג מסמך",
    "uploading": "מעלה ומחלץ..."
  },
  "editor": {
    "selectSample": "בחר דוגמה מהרשימה לעריכה",
    "save": "שמור",
    "verify": "אמת",
    "reExtract": "חלץ מחדש",
    "saving": "שומר...",
    "verifying": "מאמת...",
    "reExtracting": "מחלץ מחדש...",
    "back": "חזור לרשימה",
    "groundTruth": "נתון אמת",
    "geminiResult": "תוצאת Gemini",
    "supplier": "ספק",
    "supplierName": "שם ספק",
    "supplierAddress": "כתובת ספק",
    "supplierPhone": "טלפון ספק",
    "supplierBusinessId": "ח.פ. ספק",
    "customerName": "שם לקוח",
    "documentNumber": "מספר מסמך",
    "documentDate": "תאריך",
    "lineItems": "שורות פריטים",
    "description": "תיאור",
    "catalogNumber": "מק\"ט",
    "quantity": "כמות",
    "unit": "יחידה",
    "unitPrice": "מחיר יחידה",
    "totalPrice": "סה\"כ שורה",
    "totals": "סיכומים",
    "subtotal": "סכום ביניים",
    "vatRate": "אחוז מע\"מ",
    "vatAmount": "סכום מע\"מ",
    "totalAmount": "סה\"כ",
    "addLineItem": "הוסף שורה",
    "removeLineItem": "הסר שורה"
  },
  "exports": {
    "title": "ייצוא Training Data",
    "create": "ייצוא חדש",
    "format": "פורמט",
    "type": "סוג מסמך",
    "minStatus": "סטטוס מינימלי",
    "allTypes": "כל הסוגים",
    "noExports": "אין ייצואים",
    "download": "הורד",
    "sampleCount": "דוגמאות",
    "date": "תאריך",
    "creating": "מייצא..."
  },
  "documentType": {
    "DELIVERY_NOTE": "תעודת משלוח",
    "INVOICE": "חשבונית",
    "PURCHASE_ORDER": "הזמנת רכש"
  },
  "status": {
    "PENDING": "ממתין",
    "AUTO_EXTRACTED": "חולץ אוטומטית",
    "LABELED": "תויג",
    "VERIFIED": "אומת"
  },
  "stats": {
    "total": "סה\"כ",
    "pending": "ממתין",
    "extracted": "חולץ",
    "labeled": "תויג",
    "verified": "אומת"
  },
  "toast": {
    "uploadSuccess": "מסמך הועלה בהצלחה",
    "uploadError": "שגיאה בהעלאת מסמך",
    "saveSuccess": "נשמר בהצלחה",
    "saveError": "שגיאה בשמירה",
    "verifySuccess": "אומת בהצלחה",
    "deleteSuccess": "נמחק בהצלחה",
    "deleteError": "שגיאה במחיקה",
    "reExtractSuccess": "חולץ מחדש בהצלחה",
    "exportSuccess": "ייצוא הושלם",
    "exportError": "שגיאה בייצוא"
  },
  "buttons": {
    "cancel": "ביטול",
    "upload": "העלה",
    "close": "סגור"
  }
}
```

- [ ] **Step 2: Create English translations**

Create `apps/web/src/i18n/locales/en/training-lab.json`:
```json
{
  "title": "Training Lab",
  "tabs": {
    "samples": "Samples",
    "editor": "Editor",
    "exports": "Exports"
  },
  "samples": {
    "upload": "Upload Document",
    "search": "Search by filename...",
    "filterStatus": "Status",
    "filterType": "Document Type",
    "all": "All",
    "noResults": "No samples found",
    "fileName": "File Name",
    "type": "Type",
    "status": "Status",
    "confidence": "Confidence",
    "date": "Date",
    "actions": "Actions",
    "edit": "Edit",
    "delete": "Delete",
    "deleteConfirm": "Are you sure you want to delete?"
  },
  "upload": {
    "title": "Upload Training Document",
    "dropzone": "Drag a file here or click to select",
    "fileSelected": "Selected: {{name}}",
    "selectType": "Document Type",
    "uploading": "Uploading & extracting..."
  },
  "editor": {
    "selectSample": "Select a sample from the list to edit",
    "save": "Save",
    "verify": "Verify",
    "reExtract": "Re-extract",
    "saving": "Saving...",
    "verifying": "Verifying...",
    "reExtracting": "Re-extracting...",
    "back": "Back to list",
    "groundTruth": "Ground Truth",
    "geminiResult": "Gemini Result",
    "supplier": "Supplier",
    "supplierName": "Supplier Name",
    "supplierAddress": "Supplier Address",
    "supplierPhone": "Supplier Phone",
    "supplierBusinessId": "Supplier Business ID",
    "customerName": "Customer Name",
    "documentNumber": "Document Number",
    "documentDate": "Date",
    "lineItems": "Line Items",
    "description": "Description",
    "catalogNumber": "Catalog #",
    "quantity": "Qty",
    "unit": "Unit",
    "unitPrice": "Unit Price",
    "totalPrice": "Total",
    "totals": "Totals",
    "subtotal": "Subtotal",
    "vatRate": "VAT %",
    "vatAmount": "VAT Amount",
    "totalAmount": "Total",
    "addLineItem": "Add Line",
    "removeLineItem": "Remove"
  },
  "exports": {
    "title": "Export Training Data",
    "create": "New Export",
    "format": "Format",
    "type": "Document Type",
    "minStatus": "Min Status",
    "allTypes": "All Types",
    "noExports": "No exports yet",
    "download": "Download",
    "sampleCount": "Samples",
    "date": "Date",
    "creating": "Exporting..."
  },
  "documentType": {
    "DELIVERY_NOTE": "Delivery Note",
    "INVOICE": "Invoice",
    "PURCHASE_ORDER": "Purchase Order"
  },
  "status": {
    "PENDING": "Pending",
    "AUTO_EXTRACTED": "Auto-Extracted",
    "LABELED": "Labeled",
    "VERIFIED": "Verified"
  },
  "stats": {
    "total": "Total",
    "pending": "Pending",
    "extracted": "Extracted",
    "labeled": "Labeled",
    "verified": "Verified"
  },
  "toast": {
    "uploadSuccess": "Document uploaded successfully",
    "uploadError": "Error uploading document",
    "saveSuccess": "Saved successfully",
    "saveError": "Error saving",
    "verifySuccess": "Verified successfully",
    "deleteSuccess": "Deleted successfully",
    "deleteError": "Error deleting",
    "reExtractSuccess": "Re-extracted successfully",
    "exportSuccess": "Export complete",
    "exportError": "Error exporting"
  },
  "buttons": {
    "cancel": "Cancel",
    "upload": "Upload",
    "close": "Close"
  }
}
```

- [ ] **Step 3: Wire i18n namespace**

In `apps/web/src/i18n/index.ts`, add the imports after line 9:
```ts
import heTrainingLab from './locales/he/training-lab.json';
```
After line 15:
```ts
import enTrainingLab from './locales/en/training-lab.json';
```

Update the resources object (line 22-23) to include the new namespace:
```ts
      he: { common: heCommon, auth: heAuth, nav: heNav, projects: heProjects, settings: heSettings, 'training-lab': heTrainingLab },
      en: { common: enCommon, auth: enAuth, nav: enNav, projects: enProjects, settings: enSettings, 'training-lab': enTrainingLab },
```

Update the ns array (line 27):
```ts
    ns: ['common', 'auth', 'nav', 'projects', 'settings', 'training-lab'],
```

- [ ] **Step 4: Add nav translation**

In `apps/web/src/i18n/locales/he/nav.json`, add before the closing `}`:
```json
  "trainingLab": "מעבדת אימון"
```

In `apps/web/src/i18n/locales/en/nav.json`, add before the closing `}`:
```json
  "trainingLab": "Training Lab"
```

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/i18n/
git commit -m "feat(training-lab): add i18n translations (he + en)"
```

---

## Task 4: Route + Sidebar NavItem

**Files:**
- Modify: `apps/web/src/App.tsx:51`
- Modify: `apps/web/src/components/layout/SagurSidebar.tsx:5,86`

- [ ] **Step 1: Add route in App.tsx**

After line 19 (SuperAdminPage import), add:
```tsx
import { TrainingLabPage } from './pages/TrainingLabPage/TrainingLabPage';
```

After line 53 (connectivity-hub route), add:
```tsx
              <Route path="/training-lab" element={<TrainingLabPage />} />
```

- [ ] **Step 2: Add NavItem in SagurSidebar.tsx**

In the import on line 5, add `FlaskConical` to the lucide imports:
```tsx
import { LayoutDashboard, Settings, Plug, Inbox, Sparkles, ShoppingBag, Shield, FlaskConical } from 'lucide-react';
```

After line 38 (isConnectivityHub), add:
```tsx
  const isTrainingLab = location.pathname.startsWith('/training-lab');
```

After line 86 (settings NavItem), add:
```tsx
            <NavItem label={t('trainingLab')} icon={<FlaskConical size={18} />} active={isTrainingLab} onClick={() => navigate('/training-lab')} />
```

- [ ] **Step 3: Verify navigation works**

Start dev server, navigate to `/training-lab`. Should see the page (will be empty until Task 5).
Sidebar should show "מעבדת אימון" with flask icon.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/App.tsx apps/web/src/components/layout/SagurSidebar.tsx
git commit -m "feat(training-lab): add route and sidebar nav item"
```

---

## Task 5: TrainingLabPage — Main Page with Tabs

**Files:**
- Create: `apps/web/src/pages/TrainingLabPage/TrainingLabPage.tsx`
- Create: `apps/web/src/pages/TrainingLabPage/components/SamplesTab.tsx` (stub)
- Create: `apps/web/src/pages/TrainingLabPage/components/ExportsTab.tsx` (stub)

- [ ] **Step 1: Create TrainingLabPage**

Create `apps/web/src/pages/TrainingLabPage/TrainingLabPage.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical, List, FileDown } from 'lucide-react';
import { SamplesTab } from './components/SamplesTab';
import { SampleEditor } from './components/SampleEditor';
import { ExportsTab } from './components/ExportsTab';
import { samplesApi } from './api';
import type { Sample, Stats } from './types';

type Tab = 'samples' | 'editor' | 'exports';

export const TrainingLabPage = () => {
  const { t } = useTranslation('training-lab');
  const [activeTab, setActiveTab] = useState<Tab>('samples');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSamples = async (p = page) => {
    setIsLoading(true);
    try {
      const data = await samplesApi.list({ page: p, limit: 20 });
      setSamples(data.samples);
      setTotal(data.total);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    const data = await samplesApi.stats();
    setStats(data);
  };

  useEffect(() => {
    loadSamples();
    loadStats();
  }, []);

  const handleEdit = async (sample: Sample) => {
    const fresh = await samplesApi.get(sample.id);
    setEditingSample(fresh);
    setActiveTab('editor');
  };

  const handleEditorBack = () => {
    setEditingSample(null);
    setActiveTab('samples');
    loadSamples();
    loadStats();
  };

  const handleSampleUpdated = (updated: Sample) => {
    setEditingSample(updated);
    setSamples((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'samples', label: t('tabs.samples'), icon: <List size={16} /> },
    { key: 'exports', label: t('tabs.exports'), icon: <FileDown size={16} /> },
  ];

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <FlaskConical size={24} className="text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {activeTab !== 'editor' && (
        <div className="tabs tabs-bordered mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab gap-2 ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'samples' && (
        <SamplesTab
          samples={samples}
          stats={stats}
          total={total}
          page={page}
          isLoading={isLoading}
          onPageChange={(p) => { setPage(p); loadSamples(p); }}
          onEdit={handleEdit}
          onRefresh={() => { loadSamples(); loadStats(); }}
        />
      )}

      {activeTab === 'editor' && (
        <SampleEditor
          sample={editingSample}
          onBack={handleEditorBack}
          onSampleUpdated={handleSampleUpdated}
        />
      )}

      {activeTab === 'exports' && <ExportsTab />}
    </div>
  );
};
```

- [ ] **Step 2: Create SamplesTab stub**

Create `apps/web/src/pages/TrainingLabPage/components/SamplesTab.tsx`:
```tsx
import type { Sample, Stats } from '../types';

interface SamplesTabProps {
  samples: Sample[];
  stats: Stats | null;
  total: number;
  page: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onEdit: (sample: Sample) => void;
  onRefresh: () => void;
}

export const SamplesTab = ({ samples, isLoading }: SamplesTabProps) => {
  if (isLoading) return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg" /></div>;
  return <div className="text-center p-8 text-base-content/50">Samples tab — {samples.length} samples loaded</div>;
};
```

- [ ] **Step 3: Create SampleEditor stub**

Create `apps/web/src/pages/TrainingLabPage/components/SampleEditor.tsx`:
```tsx
import type { Sample } from '../types';

interface SampleEditorProps {
  sample: Sample | null;
  onBack: () => void;
  onSampleUpdated: (sample: Sample) => void;
}

export const SampleEditor = ({ onBack }: SampleEditorProps) => {
  return (
    <div className="text-center p-8">
      <button className="btn btn-ghost" onClick={onBack}>Back</button>
      <p className="mt-4 text-base-content/50">Editor stub</p>
    </div>
  );
};
```

- [ ] **Step 4: Create ExportsTab stub**

Create `apps/web/src/pages/TrainingLabPage/components/ExportsTab.tsx`:
```tsx
export const ExportsTab = () => {
  return <div className="text-center p-8 text-base-content/50">Exports tab stub</div>;
};
```

- [ ] **Step 5: Verify tabs work**

Navigate to `/training-lab`. Should see:
- Title "מעבדת אימון" with flask icon
- Two tabs: "דוגמאות" and "ייצוא"
- Samples tab shows count of loaded samples (or loading spinner)

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/pages/TrainingLabPage/
git commit -m "feat(training-lab): main page with tab structure"
```

---

## Task 6: SamplesTab — Full Implementation

**Files:**
- Modify: `apps/web/src/pages/TrainingLabPage/components/SamplesTab.tsx`
- Create: `apps/web/src/pages/TrainingLabPage/components/UploadModal.tsx`

- [ ] **Step 1: Implement SamplesTab**

Replace `apps/web/src/pages/TrainingLabPage/components/SamplesTab.tsx` with:
```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { samplesApi } from '../api';
import { UploadModal } from './UploadModal';
import type { Sample, Stats, DocumentType, SampleStatus } from '../types';

interface SamplesTabProps {
  samples: Sample[];
  stats: Stats | null;
  total: number;
  page: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onEdit: (sample: Sample) => void;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<SampleStatus, string> = {
  PENDING: 'badge-warning',
  AUTO_EXTRACTED: 'badge-info',
  LABELED: 'badge-primary',
  VERIFIED: 'badge-success',
};

export const SamplesTab = ({ samples, stats, total, page, isLoading, onPageChange, onEdit, onRefresh }: SamplesTabProps) => {
  const { t } = useTranslation('training-lab');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleDelete = async (sample: Sample) => {
    if (!confirm(t('samples.deleteConfirm'))) return;
    try {
      await samplesApi.delete(sample.id);
      toast.success(t('toast.deleteSuccess'));
      onRefresh();
    } catch {
      toast.error(t('toast.deleteError'));
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {stats && (
        <div className="stats stats-horizontal shadow w-full">
          <div className="stat"><div className="stat-title">{t('stats.total')}</div><div className="stat-value text-2xl">{stats.total}</div></div>
          <div className="stat"><div className="stat-title">{t('stats.pending')}</div><div className="stat-value text-2xl text-warning">{stats.byStatus.PENDING || 0}</div></div>
          <div className="stat"><div className="stat-title">{t('stats.extracted')}</div><div className="stat-value text-2xl text-info">{stats.byStatus.AUTO_EXTRACTED || 0}</div></div>
          <div className="stat"><div className="stat-title">{t('stats.labeled')}</div><div className="stat-value text-2xl text-primary">{stats.byStatus.LABELED || 0}</div></div>
          <div className="stat"><div className="stat-title">{t('stats.verified')}</div><div className="stat-value text-2xl text-success">{stats.byStatus.VERIFIED || 0}</div></div>
        </div>
      )}

      {/* Upload button */}
      <div className="flex justify-end">
        <button className="btn btn-primary gap-2" onClick={() => setIsUploadOpen(true)}>
          <Plus size={16} />
          {t('samples.upload')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-base-100 rounded-box shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg" /></div>
        ) : samples.length === 0 ? (
          <div className="text-center p-8 text-base-content/50">{t('samples.noResults')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('samples.fileName')}</th>
                <th>{t('samples.type')}</th>
                <th>{t('samples.status')}</th>
                <th>{t('samples.confidence')}</th>
                <th>{t('samples.date')}</th>
                <th>{t('samples.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.id} className="hover">
                  <td className="font-medium max-w-[200px] truncate">{sample.originalFileName}</td>
                  <td><span className="badge badge-outline badge-sm">{t(`documentType.${sample.documentType}`)}</span></td>
                  <td><span className={`badge badge-sm ${STATUS_COLORS[sample.status]}`}>{t(`status.${sample.status}`)}</span></td>
                  <td>{sample.geminiConfidence != null ? `${Math.round(sample.geminiConfidence * 100)}%` : '—'}</td>
                  <td className="text-sm">{new Date(sample.createdAt).toLocaleDateString('he-IL')}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs" onClick={() => onEdit(sample)} title={t('samples.edit')}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(sample)} title={t('samples.delete')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronRight size={14} />
          </button>
          <span className="btn btn-sm btn-ghost">{page} / {totalPages}</span>
          <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronLeft size={14} />
          </button>
        </div>
      )}

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploaded={onRefresh} />
    </div>
  );
};
```

- [ ] **Step 2: Create UploadModal**

Create `apps/web/src/pages/TrainingLabPage/components/UploadModal.tsx`:
```tsx
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { samplesApi } from '../api';
import type { DocumentType } from '../types';

const DOCUMENT_TYPES: DocumentType[] = ['DELIVERY_NOTE', 'INVOICE', 'PURCHASE_ORDER'];

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export const UploadModal = ({ isOpen, onClose, onUploaded }: UploadModalProps) => {
  const { t } = useTranslation('training-lab');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('DELIVERY_NOTE');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      await samplesApi.upload(file, documentType);
      toast.success(t('toast.uploadSuccess'));
      setFile(null);
      onClose();
      onUploaded();
    } catch {
      toast.error(t('toast.uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    setFile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">{t('upload.title')}</h3>

        <div className="flex flex-col gap-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragOver ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
              onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-primary">
                <FileUp size={20} />
                <span>{t('upload.fileSelected', { name: file.name })}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-base-content/50">
                <Upload size={32} />
                <span>{t('upload.dropzone')}</span>
              </div>
            )}
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text">{t('upload.selectType')}</span></label>
            <select className="select select-bordered" value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>{t(`documentType.${dt}`)}</option>
              ))}
            </select>
          </div>

          <div className="modal-action">
            <button className="btn btn-ghost" onClick={handleClose} disabled={isUploading}>{t('buttons.cancel')}</button>
            <button className="btn btn-primary" onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? <><span className="loading loading-spinner loading-sm" /> {t('upload.uploading')}</> : t('buttons.upload')}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleClose} />
    </div>
  );
};
```

- [ ] **Step 3: Verify upload and list**

1. Navigate to `/training-lab`
2. Click "העלאת מסמך"
3. Upload a test PDF
4. Verify it appears in the table

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/pages/TrainingLabPage/components/SamplesTab.tsx apps/web/src/pages/TrainingLabPage/components/UploadModal.tsx
git commit -m "feat(training-lab): samples list with upload, stats, pagination"
```

---

## Task 7: SampleEditor — Side-by-Side View

**Files:**
- Modify: `apps/web/src/pages/TrainingLabPage/components/SampleEditor.tsx`

- [ ] **Step 1: Implement SampleEditor**

Replace `apps/web/src/pages/TrainingLabPage/components/SampleEditor.tsx` with:
```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Save, CheckCircle, RotateCcw, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { samplesApi } from '../api';
import type { Sample, Extraction, LineItem } from '../types';

interface SampleEditorProps {
  sample: Sample | null;
  onBack: () => void;
  onSampleUpdated: (sample: Sample) => void;
}

const emptyLineItem: LineItem = {
  description: '', catalogNumber: '', quantity: null, unit: '',
  unitPrice: null, totalPrice: null, discountPercent: null,
  discountAmount: null, priceBeforeDiscount: null, remarks: '',
};

export const SampleEditor = ({ sample, onBack, onSampleUpdated }: SampleEditorProps) => {
  const { t } = useTranslation('training-lab');
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);

  const initialData = sample?.groundTruth ?? sample?.geminiExtraction ?? null;
  const [formData, setFormData] = useState<Extraction | null>(initialData);

  if (!sample || !formData) {
    return <div className="text-center p-8 text-base-content/50">{t('editor.selectSample')}</div>;
  }

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: unknown) => {
    setFormData((prev) => {
      if (!prev) return prev;
      const items = [...prev.lineItems];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, lineItems: items };
    });
  };

  const addLineItem = () => {
    setFormData((prev) => prev ? { ...prev, lineItems: [...prev.lineItems, { ...emptyLineItem }] } : prev);
  };

  const removeLineItem = (index: number) => {
    setFormData((prev) => prev ? { ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) } : prev);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await samplesApi.updateGroundTruth(sample.id, formData);
      onSampleUpdated(updated);
      toast.success(t('toast.saveSuccess'));
    } catch {
      toast.error(t('toast.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await samplesApi.updateGroundTruth(sample.id, formData);
      const updated = await samplesApi.verify(sample.id);
      onSampleUpdated(updated);
      toast.success(t('toast.verifySuccess'));
    } catch {
      toast.error(t('toast.saveError'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReExtract = async () => {
    setIsReExtracting(true);
    try {
      const updated = await samplesApi.reExtract(sample.id);
      onSampleUpdated(updated);
      setFormData(updated.groundTruth ?? updated.geminiExtraction);
      toast.success(t('toast.reExtractSuccess'));
    } catch {
      toast.error(t('toast.saveError'));
    } finally {
      setIsReExtracting(false);
    }
  };

  const docNumber = 'noteNumber' in formData ? formData.noteNumber
    : 'invoiceNumber' in formData ? formData.invoiceNumber
    : 'poNumber' in formData ? formData.poNumber : '';

  const docDate = 'deliveryDate' in formData ? formData.deliveryDate
    : 'invoiceDate' in formData ? formData.invoiceDate
    : 'orderDate' in formData ? formData.orderDate : '';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button className="btn btn-ghost btn-sm gap-2" onClick={onBack}>
          <ArrowRight size={16} />
          {t('editor.back')}
        </button>
        <div className="flex gap-2">
          <button className="btn btn-sm gap-2" onClick={handleReExtract} disabled={isReExtracting}>
            {isReExtracting ? <span className="loading loading-spinner loading-xs" /> : <RotateCcw size={14} />}
            {t('editor.reExtract')}
          </button>
          <button className="btn btn-primary btn-sm gap-2" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
            {t('editor.save')}
          </button>
          <button className="btn btn-success btn-sm gap-2" onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={14} />}
            {t('editor.verify')}
          </button>
        </div>
      </div>

      {/* Side-by-side: Image + Form */}
      <div className="flex gap-4 min-h-[70vh]">
        {/* Left: Document viewer */}
        <div className="w-1/2 bg-base-200 rounded-box overflow-auto">
          {sample.filePath.endsWith('.pdf') ? (
            <iframe src={samplesApi.fileUrl(sample.id)} className="w-full h-full min-h-[70vh]" />
          ) : (
            <img src={samplesApi.fileUrl(sample.id)} alt={sample.originalFileName} className="w-full object-contain" />
          )}
        </div>

        {/* Right: Form */}
        <div className="w-1/2 bg-base-100 rounded-box shadow-sm p-4 overflow-y-auto max-h-[80vh]">
          <h3 className="font-bold mb-4">{t('editor.groundTruth')}</h3>

          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.documentNumber')}</label>
              <input className="input input-bordered input-sm" value={docNumber} readOnly />
            </div>
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.documentDate')}</label>
              <input className="input input-bordered input-sm" value={docDate} readOnly />
            </div>
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.supplierName')}</label>
              <input className="input input-bordered input-sm" value={formData.supplierName ?? ''} onChange={(e) => updateField('supplierName', e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.supplierBusinessId')}</label>
              <input className="input input-bordered input-sm" value={formData.supplierBusinessId ?? ''} onChange={(e) => updateField('supplierBusinessId', e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label label-text text-xs">{t('editor.customerName')}</label>
              <input className="input input-bordered input-sm" value={formData.customerName ?? ''} onChange={(e) => updateField('customerName', e.target.value)} />
            </div>
          </div>

          {/* Line items */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">{t('editor.lineItems')} ({formData.lineItems.length})</h4>
              <button className="btn btn-ghost btn-xs gap-1" onClick={addLineItem}>
                <Plus size={12} /> {t('editor.addLineItem')}
              </button>
            </div>

            <div className="space-y-3">
              {formData.lineItems.map((item, idx) => (
                <div key={idx} className="border border-base-300 rounded-lg p-3 relative">
                  <button
                    className="btn btn-ghost btn-xs text-error absolute top-1 left-1"
                    onClick={() => removeLineItem(idx)}
                    title={t('editor.removeLineItem')}
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="grid grid-cols-6 gap-2 mt-4">
                    <div className="col-span-3 form-control">
                      <label className="label label-text text-xs">{t('editor.description')}</label>
                      <input className="input input-bordered input-xs" value={item.description} onChange={(e) => updateLineItem(idx, 'description', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.catalogNumber')}</label>
                      <input className="input input-bordered input-xs" value={item.catalogNumber ?? ''} onChange={(e) => updateLineItem(idx, 'catalogNumber', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.quantity')}</label>
                      <input type="number" className="input input-bordered input-xs" value={item.quantity ?? ''} onChange={(e) => updateLineItem(idx, 'quantity', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.unit')}</label>
                      <input className="input input-bordered input-xs" value={item.unit ?? ''} onChange={(e) => updateLineItem(idx, 'unit', e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.unitPrice')}</label>
                      <input type="number" step="0.01" className="input input-bordered input-xs" value={item.unitPrice ?? ''} onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="form-control">
                      <label className="label label-text text-xs">{t('editor.totalPrice')}</label>
                      <input type="number" step="0.01" className="input input-bordered input-xs" value={item.totalPrice ?? ''} onChange={(e) => updateLineItem(idx, 'totalPrice', e.target.value ? Number(e.target.value) : null)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div>
            <h4 className="font-semibold text-sm mb-2">{t('editor.totals')}</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.subtotal')}</label>
                <input type="number" step="0.01" className="input input-bordered input-sm" value={formData.subtotal ?? ''} onChange={(e) => updateField('subtotal', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.vatRate')}</label>
                <input type="number" step="0.01" className="input input-bordered input-sm" value={formData.vatRate ?? ''} onChange={(e) => updateField('vatRate', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.vatAmount')}</label>
                <input type="number" step="0.01" className="input input-bordered input-sm" value={formData.vatAmount ?? ''} onChange={(e) => updateField('vatAmount', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="form-control">
                <label className="label label-text text-xs">{t('editor.totalAmount')}</label>
                <input type="number" step="0.01" className="input input-bordered input-sm" value={formData.totalAmount ?? ''} onChange={(e) => updateField('totalAmount', e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify editor**

1. Upload a document
2. Click edit pencil icon
3. Verify: left side shows document, right side shows editable form
4. Edit a field, click Save, verify toast appears

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/pages/TrainingLabPage/components/SampleEditor.tsx
git commit -m "feat(training-lab): sample editor with side-by-side view"
```

---

## Task 8: ExportsTab — Full Implementation

**Files:**
- Modify: `apps/web/src/pages/TrainingLabPage/components/ExportsTab.tsx`

- [ ] **Step 1: Implement ExportsTab**

Replace `apps/web/src/pages/TrainingLabPage/components/ExportsTab.tsx` with:
```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportsApi } from '../api';
import type { DocumentType, ExportRecord } from '../types';

export const ExportsTab = () => {
  const { t } = useTranslation('training-lab');
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [format, setFormat] = useState('jsonl');
  const [minStatus, setMinStatus] = useState<'LABELED' | 'VERIFIED'>('LABELED');

  useEffect(() => {
    loadExports();
  }, []);

  const loadExports = async () => {
    try {
      const data = await exportsApi.list();
      setExports(data);
    } catch {
      /* ignore */
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await exportsApi.create({
        documentType: documentType || undefined,
        format,
        minStatus,
      });
      toast.success(t('toast.exportSuccess'));
      loadExports();
    } catch {
      toast.error(t('toast.exportError'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export form */}
      <div className="bg-base-100 rounded-box shadow-sm p-4">
        <h3 className="font-bold mb-4">{t('exports.title')}</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="form-control">
            <label className="label label-text text-xs">{t('exports.type')}</label>
            <select className="select select-bordered select-sm" value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType | '')}>
              <option value="">{t('exports.allTypes')}</option>
              <option value="DELIVERY_NOTE">{t('documentType.DELIVERY_NOTE')}</option>
              <option value="INVOICE">{t('documentType.INVOICE')}</option>
              <option value="PURCHASE_ORDER">{t('documentType.PURCHASE_ORDER')}</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label label-text text-xs">{t('exports.format')}</label>
            <select className="select select-bordered select-sm" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="jsonl">JSONL</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label label-text text-xs">{t('exports.minStatus')}</label>
            <select className="select select-bordered select-sm" value={minStatus} onChange={(e) => setMinStatus(e.target.value as 'LABELED' | 'VERIFIED')}>
              <option value="LABELED">{t('status.LABELED')}</option>
              <option value="VERIFIED">{t('status.VERIFIED')}</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm gap-2" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <span className="loading loading-spinner loading-xs" /> : <FileDown size={14} />}
            {isCreating ? t('exports.creating') : t('exports.create')}
          </button>
        </div>
      </div>

      {/* Exports list */}
      <div className="bg-base-100 rounded-box shadow-sm overflow-x-auto">
        {exports.length === 0 ? (
          <div className="text-center p-8 text-base-content/50">{t('exports.noExports')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('exports.format')}</th>
                <th>{t('exports.type')}</th>
                <th>{t('exports.sampleCount')}</th>
                <th>{t('exports.date')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exports.map((exp) => (
                <tr key={exp.id}>
                  <td><span className="badge badge-outline badge-sm">{exp.format}</span></td>
                  <td>{exp.documentType ? t(`documentType.${exp.documentType}`) : t('exports.allTypes')}</td>
                  <td>{exp.sampleCount}</td>
                  <td className="text-sm">{new Date(exp.createdAt).toLocaleDateString('he-IL')}</td>
                  <td>
                    <a href={exportsApi.downloadUrl(exp.id)} className="btn btn-ghost btn-xs gap-1" download>
                      <Download size={14} />
                      {t('exports.download')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify exports**

1. Navigate to Exports tab
2. Click "ייצוא חדש"
3. Verify export appears in list with download link

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/pages/TrainingLabPage/components/ExportsTab.tsx
git commit -m "feat(training-lab): exports tab with create and download"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Full flow test**

1. Navigate to `/training-lab`
2. Upload 2 documents (different types)
3. Verify stats update
4. Edit a sample — correct a field, save
5. Verify the sample — status changes to VERIFIED
6. Export training data
7. Download the export file

- [ ] **Step 2: Verify sidebar nav**

- Flask icon visible in sidebar
- Active state highlights correctly when on `/training-lab`
- Works in both Hebrew and English

- [ ] **Step 3: Build check**

```bash
pnpm --filter @budapest/web build
```
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any fixes**
```bash
git add -A
git commit -m "feat(training-lab): final polish and build verification"
```
