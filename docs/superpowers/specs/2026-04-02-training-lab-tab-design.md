# Training Lab Tab — Design Spec

## Overview

Add a "Training Lab" tab to `apps/web` that connects to the existing `apps/labeling-api` (port 3002, separate DB). Purpose: let the team upload documents, review Gemini extractions, correct them, and export training data for fine-tuning an open-source model (Qwen2.5-VL).

## Status: POC

This feature is intentionally isolated and designed for easy removal. It does NOT modify any existing stores, services, or components — only adds new files and minimal wiring (route, nav item, proxy).

---

## Architecture

```
apps/web/src/
  pages/TrainingLabPage/              # ALL feature code lives here
    TrainingLabPage.tsx               # Main page: 3 tabs (Samples, Editor, Exports)
    components/
      SamplesList.tsx                 # Table + upload button + filters
      SampleEditor.tsx                # Side-by-side: image left, JSON editor right
      ExportsPanel.tsx                # Export training data (JSON/JSONL)
    hooks/
      useTrainingLabApi.ts            # All API calls to labeling-api
  services/
    labeling-api.client.ts            # Separate Axios instance (proxied to port 3002)
  i18n/locales/he/training-lab.json   # Hebrew translations
  i18n/locales/en/training-lab.json   # English translations
```

## Changes to Existing Files

| File | Change | Lines |
|------|--------|-------|
| `App.tsx` | Add `<Route path="/training-lab" element={<TrainingLabPage />} />` | 1-2 |
| `SagurSidebar.tsx` | Add NavItem with Flask/Beaker icon | 1-3 |
| `vite.config.ts` | Add proxy: `/labeling-api` → `http://localhost:3002` | 3-5 |
| `i18n/index.ts` | Add `training-lab` namespace | 1 |

Total changes to existing files: ~8 lines across 4 files.

## API Communication

- Separate Axios instance in `labeling-api.client.ts`
- Base URL: `/labeling-api` (proxied by Vite dev server)
- Auth: sends `x-api-key` header (hardcoded dev key, or from env `VITE_LABELING_API_KEY`)
- Does NOT use the existing `apiClient` (which talks to port 3001)

## UI Design

### Tab 1: Samples List
- Table: filename, type, status (pending/verified), Gemini confidence, date
- Upload button (drag & drop)
- Filter by status, type
- Click row → opens editor

### Tab 2: Sample Editor
- Left panel: document image (zoomable)
- Right panel: JSON editor with ground truth fields
- Actions: Save, Verify, Re-extract, Delete

### Tab 3: Exports
- Export button with format selection (JSON/JSONL)
- Filter by document type, verified only
- List of previous exports with download links

## Patterns

Follows existing app conventions:
- `observer()` wrapper for MobX reactivity (though this feature uses local state via hooks, not a global store — keeping it isolated)
- `useTranslation('training-lab')` for i18n
- TailwindCSS + DaisyUI for styling
- Lucide React for icons

---

## How to Remove This Feature

If the POC is abandoned, follow these steps to cleanly remove all training lab code:

### Step 1: Delete feature files
```bash
rm -rf apps/web/src/pages/TrainingLabPage/
rm -f apps/web/src/services/labeling-api.client.ts
rm -f apps/web/src/i18n/locales/he/training-lab.json
rm -f apps/web/src/i18n/locales/en/training-lab.json
```

### Step 2: Remove wiring from existing files

**`apps/web/src/App.tsx`** — delete the line:
```tsx
<Route path="/training-lab" element={<TrainingLabPage />} />
```
And its import at the top.

**`apps/web/src/components/layout/SagurSidebar.tsx`** — delete the NavItem:
```tsx
<NavItem to="/training-lab" icon={FlaskConical} label={t('nav:trainingLab')} />
```

**`apps/web/vite.config.ts`** — delete the proxy block:
```ts
'/labeling-api': {
  target: 'http://localhost:3002',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/labeling-api/, ''),
},
```

**`apps/web/src/i18n/index.ts`** — remove `'training-lab'` from the namespaces array.

### Step 3: Delete the backend
```bash
rm -rf apps/labeling-api/
rm -rf apps/labeling-web/  # if still exists
dropdb labeling
```

### Step 4: Clean up root package.json
Remove any `labeling` scripts from the root `package.json` if added.

### Step 5: Verify
```bash
pnpm --filter @budapest/web build  # should compile cleanly
```

---

## Dependencies

- `apps/labeling-api` must be running on port 3002
- PostgreSQL database `labeling` must exist
- No new npm packages required (uses existing axios, react-router, tailwind, lucide)
