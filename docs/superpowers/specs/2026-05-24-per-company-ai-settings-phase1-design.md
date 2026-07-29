# Per-Company AI Settings — Phase 1 (MVP)

**Status:** Design approved, ready for implementation plan
**Author:** Dudi + Claude
**Date:** 2026-05-24
**Reference implementation:** `~/conductor/workspaces/shai/manama` (similar feature)

---

## Context

Badook has a working chat feature (`apps/api/src/intelligence/chat/`) backed by a single global `ChatAgent` (model, system prompt, max tokens). Currently every company shares the same agent — there is no per-company control over:

- Which Gemini model is used
- Token budgets (context, thinking, output)
- File-attachment limits
- Monthly query allowance
- Usage tracking per company

The user wants to port the management UI from a sister project (`manama`), which already implements this cleanly. Direction: a **phased port**, starting with the MVP (this spec). Future phases will add quota enforcement, top-up grants, query-log viewer, multi-provider routing, and per-agent overrides.

**Scope decisions made during brainstorming:**

| Question | Decision |
|----------|----------|
| Provider stack | **Gemini only** (defer OpenRouter & multi-provider to later) |
| Model slots in form | **Two:** `defaultModel` + `fileModel` |
| Quota enforcement | **Soft tracking only** — record usage, display gauge, never block |
| UI placement | **New route** `/super-admin/companies/:id` with tabs (AI is one tab) |
| Schema | **Approach 2** — new `AICompanySettings` + `AIQuotaUsage`, extend existing `ApiUsageLog` (not a separate `AIQueryLog`) |
| Fine-tuned model | Include `gemini-finetuned` in catalog (same pricing as `gemini-2.5-flash`) |

Out of scope for Phase 1: quota enforcement, top-up grants, query-log table, OpenRouter, per-skill model overrides, monthly reset cron.

---

## Data Model

### New: `AICompanySettings` (per-company AI config)

```prisma
model AICompanySettings {
  id                       String   @id @default(cuid())
  companyId                String   @unique @map("company_id")
  company                  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  enabled                  Boolean  @default(true)
  defaultModel             String   @default("gemini-2.5-flash") @map("default_model")
  fileModel                String?  @map("file_model")
  maxContextTokens         Int      @default(100000) @map("max_context_tokens")
  thinkingBudget           Int      @default(24576)  @map("thinking_budget")
  maxOutputTokens          Int      @default(16384)  @map("max_output_tokens")
  monthlyQueryQuota        Int      @default(1000)   @map("monthly_query_quota")
  maxAttachmentsPerMessage Int      @default(5)      @map("max_attachments_per_message")
  maxAttachmentSizeMb      Int      @default(12)     @map("max_attachment_size_mb")
  autoFilterLargeFiles     Boolean  @default(true)   @map("auto_filter_large_files")
  createdAt                DateTime @default(now())  @map("created_at")
  updatedAt                DateTime @updatedAt       @map("updated_at")
  @@map("ai_company_settings")
}
```

### New: `AIQuotaUsage` (monthly counters per company)

```prisma
model AIQuotaUsage {
  id           String   @id @default(cuid())
  companyId    String   @map("company_id")
  company      Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  yearMonth    String   @map("year_month")        // "2026-05"
  queriesUsed  Int      @default(0) @map("queries_used")
  topUpQueries Int      @default(0) @map("top_up_queries")   // reserved for Phase 2
  tokensIn     Int      @default(0) @map("tokens_in")
  tokensOut    Int      @default(0) @map("tokens_out")
  costUsd      Decimal  @default(0) @db.Decimal(10, 6) @map("cost_usd")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt      @map("updated_at")
  @@unique([companyId, yearMonth])
  @@map("ai_quota_usage")
}
```

### Modified: `ApiUsageLog` (extend, don't duplicate)

Add two nullable columns so the same table tracks OCR (no userId) and chat (with userId + conversationId).

```prisma
model ApiUsageLog {
  // ...existing fields unchanged...
  userId         String?  @map("user_id")
  conversationId String?  @map("conversation_id")
  @@index([operation, createdAt])    // NEW: fast filter by "chat.message"
}
```

The `operation` field gains the value `chat.message` (existing OCR uses `ocr.extract`, `ocr.classify` etc.).

### Updated: `Company` (relations only)

```prisma
model Company {
  // ...
  aiSettings   AICompanySettings?
  aiQuotaUsage AIQuotaUsage[]
}
```

### Model catalog (config file, not DB)

Replace `MODEL_PRICING` in `apps/api/src/common/ai-models.ts` with a structured catalog:

```ts
export interface AIModelEntry {
  id: string;          // Gemini API model name
  label: string;       // Hebrew/English display
  inPerM: number;      // USD per 1M input tokens
  outPerM: number;     // USD per 1M output tokens
  vision: boolean;
  finetuned?: boolean;
}

export const AI_MODEL_CATALOG: AIModelEntry[] = [
  { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash',           inPerM: 0.075, outPerM: 0.30, vision: true },
  { id: 'gemini-2.5-flash-lite',  label: 'Gemini 2.5 Flash Lite',      inPerM: 0.04,  outPerM: 0.15, vision: true },
  { id: 'gemini-2.5-pro',         label: 'Gemini 2.5 Pro',             inPerM: 1.25,  outPerM: 5.00, vision: true },
  { id: 'gemini-finetuned',       label: 'Gemini (Fine-tuned Badook)', inPerM: 0.075, outPerM: 0.30, vision: true, finetuned: true },
];
// MODEL_PRICING kept as a derived constant for backward compatibility with OCR's ApiUsageLoggerService
```

---

## Backend

### New module: `apps/api/src/intelligence/ai-management/`

| File | Responsibility |
|------|----------------|
| `ai-management.module.ts` | Registers services + controller |
| `ai-settings.service.ts` | `getOrCreate(companyId)`, `get(companyId)`, `update(companyId, dto)` — owns `AICompanySettings` CRUD |
| `ai-quota.service.ts` | `getUsage(companyId, yearMonth?)`, `getUsageHistory(companyId, months)`, `consume(companyId, {tokensIn, tokensOut, costUsd})` — owns `AIQuotaUsage` |
| `ai-models.service.ts` | `list()` → returns `AI_MODEL_CATALOG` to frontend |
| `cost-estimator.ts` | Pure function `estimateCostUsd(model, tokensIn, tokensOut) → number` |
| `ai-management.controller.ts` | HTTP endpoints (below) |

### New endpoints (all under `SuperAdminGuard`)

```
GET    /super-admin/companies/:id/ai
       → { settings, usage_current_month, company: {id, name} }

PATCH  /super-admin/companies/:id/ai
       → body: Partial<AICompanySettings>, returns updated settings

GET    /super-admin/companies/:id/ai/usage?months=6
       → [{yearMonth, queriesUsed, tokensIn, tokensOut, costUsd}, ...]

GET    /super-admin/ai-models
       → AI_MODEL_CATALOG (label, id, prices, vision, finetuned)
```

### Wiring into `ChatService` (existing file, careful edits)

In `apps/api/src/intelligence/chat/chat.service.ts`:

1. **Before LLM call**: load `settings = aiSettings.getOrCreate(companyId)`. Throw `ForbiddenException` if `!settings.enabled`.
2. **Model selection**: `const model = hasAttachments && settings.fileModel ? settings.fileModel : settings.defaultModel;` (overrides the global ChatAgent's `model` field for this call).
3. **Token budgets**: pass `settings.maxOutputTokens`, `settings.thinkingBudget` to the Gemini API call.
4. **Attachment limits**: enforce `settings.maxAttachmentsPerMessage` and `settings.maxAttachmentSizeMb` in the upload endpoint (`POST /chat/attachments`). Return 413 if exceeded.
5. **After response (fire-and-forget)**:
   - `aiQuota.consume(companyId, {tokensIn, tokensOut, costUsd})`
   - `apiUsage.logUsage({companyId, userId, conversationId, provider:'GEMINI', model, operation:'chat.message', promptTokens, completionTokens, totalTokens, estimatedCostUsd: costUsd})`

`getOrCreate` returns sensible defaults the first time a company is touched, so existing chat flows never break for companies with no row yet.

---

## Frontend

### New route + page

In `apps/web/src/App.tsx`:

```tsx
<Route path="companies/:companyId" element={<CompanyDetailPage />}>
  <Route index element={<Navigate to="overview" replace />} />
  <Route path="overview" element={<CompanyOverviewTab />} />
  <Route path="users"    element={<CompanyUsersTab />} />
  <Route path="ai"       element={<CompanyAITab />} />
</Route>
```

`overview` and `users` tabs are stubs in Phase 1 (placeholder text "בקרוב"). Only `ai` is fully built.

### New component tree under `apps/web/src/pages/SuperAdminPage/components/CompanyDetailPage/`

```
CompanyDetailPage.tsx          Layout with header + tab bar + <Outlet/>
CompanyDetailHeader.tsx        Company name, businessId, status
tabs/
  CompanyAITab/
    CompanyAITab.tsx           Orchestrator: kicks off load(), renders cards
    AISettingsCard.tsx         Form: enabled toggle, model pickers, all numeric fields
    AIUsageGauge.tsx           Big progress bar for current month: queries / quota
    AIUsageHistoryTable.tsx    Table: last 6 months × {queries, tokens, cost}
    ModelPicker.tsx            Combobox sourced from GET /super-admin/ai-models
    NumericField.tsx           Labeled input with suffix (טוקנים / MB)
```

Hook up via the existing `CompanyCard` "פתח" link to navigate to the new route.

### New MobX store: `apps/web/src/stores/aiManagement.store.ts`

```ts
class AIManagementStore {
  settings: IAISettings | null = null;
  usage: IUsageSnapshot | null = null;
  usageHistory: IUsageHistoryRow[] = [];
  models: IAIModel[] = [];
  isLoading = false;
  isSaving = false;
  async load(companyId: string)                  // parallel GETs
  async save(companyId, patch: Partial<IAISettings>)
  async loadHistory(companyId, months = 6)
}
```

Register on the root store as `aiManagement`. Use `useStores().aiManagement` in the components.

### New frontend service: `apps/web/src/services/aiManagement.service.ts`

```ts
export const aiManagementService = {
  get(companyId: string)             { /* GET /super-admin/companies/:id/ai */ },
  update(companyId, dto)             { /* PATCH ... */ },
  getUsage(companyId, months = 6)    { /* GET .../usage?months */ },
  listModels()                       { /* GET /super-admin/ai-models */ },
};
```

### i18n

New namespace `ai-management` (he + en). Strings cover form labels, gauge captions, and the column headers in the history table. Hebrew is the source of truth; English is auto-fillable later.

### Visual design

Before writing any CSS we read the corresponding component(s) from the reference design system. It does not have an "AI" tab, so we adopt its existing patterns for tabs, form cards, and stat tiles, and lay out the page to match the reference screenshot (settings card on the right, stats on the left, history table below). RTL throughout.

---

## Files Modified Summary

### New
| Path | Purpose |
|------|---------|
| `apps/api/prisma/migrations/<ts>_add_ai_management/migration.sql` | Two new tables + two columns on `api_usage_log` |
| `apps/api/src/intelligence/ai-management/ai-management.module.ts` | NestJS module |
| `apps/api/src/intelligence/ai-management/ai-settings.service.ts` | Settings CRUD |
| `apps/api/src/intelligence/ai-management/ai-quota.service.ts` | Usage tracking |
| `apps/api/src/intelligence/ai-management/ai-models.service.ts` | Catalog endpoint |
| `apps/api/src/intelligence/ai-management/cost-estimator.ts` | Pricing math |
| `apps/api/src/intelligence/ai-management/ai-management.controller.ts` | HTTP routes |
| `apps/web/src/pages/SuperAdminPage/components/CompanyDetailPage/CompanyDetailPage.tsx` | Layout |
| `apps/web/src/pages/SuperAdminPage/components/CompanyDetailPage/CompanyDetailHeader.tsx` | Header |
| `apps/web/src/pages/SuperAdminPage/components/CompanyDetailPage/tabs/CompanyAITab/CompanyAITab.tsx` | Tab root |
| `.../CompanyAITab/AISettingsCard.tsx` | Form |
| `.../CompanyAITab/AIUsageGauge.tsx` | Stats card |
| `.../CompanyAITab/AIUsageHistoryTable.tsx` | History table |
| `.../CompanyAITab/ModelPicker.tsx` | Combobox |
| `.../CompanyAITab/NumericField.tsx` | Labeled input |
| `apps/web/src/stores/aiManagement.store.ts` | MobX |
| `apps/web/src/services/aiManagement.service.ts` | API client |
| `apps/web/src/i18n/locales/he/ai-management.json` | i18n he |
| `apps/web/src/i18n/locales/en/ai-management.json` | i18n en |

### Modified
| Path | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | +2 models, +2 fields on `ApiUsageLog`, +relations on `Company` |
| `apps/api/src/common/ai-models.ts` | Add `AI_MODEL_CATALOG`, keep `MODEL_PRICING` derived |
| `apps/api/src/intelligence/chat/chat.service.ts` | Use settings; log usage after each call |
| `apps/api/src/intelligence/chat/chat.controller.ts` | Enforce attachment limits from settings |
| `apps/api/src/app.module.ts` | Register `AIManagementModule` |
| `apps/api/src/common/services/api-usage-logger.service.ts` | Accept `userId`, `conversationId` |
| `apps/web/src/App.tsx` | Mount `/companies/:id` route |
| `apps/web/src/stores/root.store.ts` | Register `aiManagement` store |
| `apps/web/src/pages/SuperAdminPage/components/CompaniesTab/CompanyCard.tsx` | Add "פתח" link to new route |
| `apps/web/src/i18n/index.ts` | Register new namespace |

---

## Verification

### 1. Schema migrated cleanly
```bash
psql "$DATABASE_URL" -c "\d ai_company_settings"
psql "$DATABASE_URL" -c "\d ai_quota_usage"
psql "$DATABASE_URL" -c "\d api_usage_log" | grep -E "(user_id|conversation_id)"
```

### 2. API endpoints
```bash
curl /api/super-admin/ai-models                        # 200, ~4 entries
curl /api/super-admin/companies/$ID/ai                 # 200, settings + usage
curl -X PATCH /api/super-admin/companies/$ID/ai \
  -H 'Content-Type: application/json' \
  -d '{"defaultModel":"gemini-2.5-flash-lite","monthlyQueryQuota":500}'
```

### 3. UI flow
- Login as super admin
- Navigate to `/super-admin` → click a company → land on `/super-admin/companies/<id>/overview`
- Click "AI" tab → form loads with current settings
- Toggle "enabled", change model, change a budget, save → refresh: values persist
- Check that the usage gauge shows current month numbers

### 4. Chat records usage
```bash
# Send a chat message as a normal user, then:
psql "$DATABASE_URL" -c "
  SELECT operation, prompt_tokens, completion_tokens, estimated_cost_usd
  FROM api_usage_log
  WHERE operation='chat.message'
  ORDER BY created_at DESC LIMIT 3;
"
# Should see new rows with tokens > 0 and cost > 0

psql "$DATABASE_URL" -c "
  SELECT year_month, queries_used, tokens_in, tokens_out, cost_usd
  FROM ai_quota_usage
  ORDER BY year_month DESC LIMIT 3;
"
# Should see incremented counters for current month
```

### 5. No regression
- Existing companies with no `AICompanySettings` row still get a working chat (defaults via `getOrCreate`).
- Existing OCR usage logging still works (the two new columns on `api_usage_log` are nullable).

---

## Out of Scope (deferred)

| Feature | Phase |
|---------|-------|
| Quota enforcement (block at 100%) | 2 |
| Top-up grants UI + `AITopUpGrant` model | 2 |
| Query log viewer (detailed per-call table) | 2 |
| OpenRouter as a third provider | 2 |
| Per-company agent overrides (`AICompanyAgent`) | 3 |
| Per-skill model override | 3 |
| Monthly reset cron job | not needed (yearMonth partition handles it implicitly) |
