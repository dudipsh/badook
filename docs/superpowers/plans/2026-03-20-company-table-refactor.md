# Company Table Refactor — Split into 4 Tables

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the God-table `companies` (22 columns) into 4 focused tables: `companies` (identity+status), `company_settings`, `company_scan_settings`, `company_integrations`.

**Architecture:** Add 3 new Prisma models with 1:1 (settings, scan_settings) and 1:N (integrations) relations to Company. Create a Prisma migration with data migration SQL to move existing data. Update all backend services that read/write the moved fields. Frontend API contracts stay the same — no frontend changes needed.

**Tech Stack:** Prisma (PostgreSQL), NestJS, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/prisma/schema.prisma` | Add 3 new models, 3 new enums, slim Company |
| Create | `apps/api/prisma/migrations/YYYYMMDD_split_company_table/migration.sql` | Auto-generated + manual data migration SQL |
| Modify | `apps/api/prisma/seed.ts` | Create settings + scan_settings with company |
| Modify | `apps/api/src/support/admin/admin.service.ts` | Query `companySettings` table |
| Modify | `apps/api/src/integrations/gmail/gmail.service.ts` | Query `companyScanSettings` + `companyIntegration` |
| Modify | `apps/api/src/integrations/gmail/gmail-scanner.service.ts` | Fetch scan settings + integration separately |
| Modify | `apps/api/src/integrations/gmail/email-processor.service.ts` | Query `companyScanSettings` for blocked rules |
| Modify | `apps/api/src/integrations/whatsapp/whatsapp.service.ts` | Query `companyIntegration` |
| Modify | `apps/api/src/integrations/whatsapp/whatsapp-webhook.service.ts` | Adjust type for company+accessToken |
| Modify | `apps/api/src/intelligence/ocr/vision-api.service.ts` | Query `companyScanSettings` for ocrProvider |
| Modify | `apps/api/src/domain/matching/ai-matcher.service.ts` | Query `companyScanSettings` for ocrProvider |
| Modify | `apps/api/src/support/upload/upload.service.ts` | Query `companySettings` for maxUploadSizeMb |
| Modify | `apps/api/src/support/testing/test-runner.service.ts` | Create scan settings with test company |
| Modify | `apps/api/src/support/testing/mock-generator.service.ts` | Create scan settings with test company |
| Modify | `packages/shared/src/types/company.ts` | Add `status` field |

---

### Task 1: Prisma Schema — Add New Models & Enums

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add 3 new enums after existing enums**

```prisma
enum CompanyStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

enum IntegrationType {
  GMAIL
  WHATSAPP
}

enum IntegrationStatus {
  CONNECTED
  DISCONNECTED
  ERROR
}
```

- [ ] **Step 2: Modify Company model — remove migrated fields, add status + deletedAt + relations**

Replace the entire `Company` model with:

```prisma
model Company {
  id            String        @id @default(cuid())
  name          String
  businessId    String?       @unique @map("business_id")
  address       String?
  phone         String?
  email         String?
  status        CompanyStatus @default(ACTIVE)
  deletedAt     DateTime?     @map("deleted_at")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  users          User[]
  suppliers      Supplier[]
  projects       Project[]
  deliveryNotes  DeliveryNote[]
  purchaseOrders PurchaseOrder[]
  invoices       Invoice[]
  matches        ThreeWayMatch[]
  feedbacks      ItemMatchFeedback[]
  apiUsageLogs   ApiUsageLog[]
  processingJobs ProcessingJob[]
  emailScanLogs  EmailScanLog[]
  whatsappMessageLogs WhatsAppMessageLog[]

  settings       CompanySettings?
  scanSettings   CompanyScanSettings?
  integrations   CompanyIntegration[]

  @@map("companies")
}
```

**Removed fields:** `scanDaysBack`, `scanSent`, `gmailEmail`, `gmailRefreshToken`, `gmailConnectedAt`, `ocrProvider`, `maxUploadSizeMb`, `defaultVatRate`, `whatsappPhoneNumberId`, `whatsappBusinessId`, `whatsappAccessToken`, `whatsappVerifyToken`, `whatsappConnectedAt`, `whatsappPhoneNumber`, `blockedEmailRules`

**Added fields:** `status`, `deletedAt`

**Added relations:** `settings`, `scanSettings`, `integrations`

- [ ] **Step 3: Add CompanySettings model (after Company)**

```prisma
model CompanySettings {
  id              String   @id @default(cuid())
  companyId       String   @unique @map("company_id")
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  maxUploadSizeMb Int      @default(20) @map("max_upload_size_mb")
  defaultVatRate  Float    @default(18) @map("default_vat_rate")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("company_settings")
}
```

- [ ] **Step 4: Add CompanyScanSettings model**

```prisma
model CompanyScanSettings {
  id                String      @id @default(cuid())
  companyId         String      @unique @map("company_id")
  company           Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  ocrProvider       OcrProvider @default(GEMINI) @map("ocr_provider")
  scanDaysBack      Int         @default(7) @map("scan_days_back")
  scanSent          Boolean     @default(true) @map("scan_sent")
  blockedEmailRules Json        @default("[]") @map("blocked_email_rules")
  createdAt         DateTime    @default(now()) @map("created_at")
  updatedAt         DateTime    @updatedAt @map("updated_at")

  @@map("company_scan_settings")
}
```

- [ ] **Step 5: Add CompanyIntegration model**

```prisma
model CompanyIntegration {
  id           String            @id @default(cuid())
  companyId    String            @map("company_id")
  company      Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  type         IntegrationType
  status       IntegrationStatus @default(DISCONNECTED)
  externalId   String?           @map("external_id")
  credentials  Json?
  config       Json?
  connectedAt  DateTime?         @map("connected_at")
  errorMessage String?           @map("error_message")
  createdAt    DateTime          @default(now()) @map("created_at")
  updatedAt    DateTime          @updatedAt @map("updated_at")

  @@unique([companyId, type])
  @@index([type, externalId])
  @@map("company_integrations")
}
```

**Column mapping for integrations:**

| Old Column | New Location | Field |
|---|---|---|
| `gmailRefreshToken` | `company_integrations.credentials` | `{ refreshToken: "..." }` |
| `gmailEmail` | `company_integrations.external_id` + `config.email` | |
| `gmailConnectedAt` | `company_integrations.connected_at` | |
| `whatsappAccessToken` | `company_integrations.credentials` | `{ accessToken: "..." }` |
| `whatsappVerifyToken` | `company_integrations.credentials` | `{ ..., verifyToken: "..." }` |
| `whatsappPhoneNumberId` | `company_integrations.external_id` + `config.phoneNumberId` | |
| `whatsappBusinessId` | `company_integrations.config` | `{ businessId: "..." }` |
| `whatsappPhoneNumber` | `company_integrations.config` | `{ phoneNumber: "..." }` |
| `whatsappConnectedAt` | `company_integrations.connected_at` | |

- [ ] **Step 6: Create the migration with `--create-only` and add data migration SQL**

Run: `cd apps/api && npx prisma migrate dev --create-only --name split_company_table`

Then edit the generated `migration.sql`. The required ordering within the file is:
1. CREATE TYPE statements (new enums)
2. CREATE TABLE statements (new tables)
3. ADD COLUMN statements on `companies` (status, deleted_at)
4. **DATA MIGRATION INSERTs** (copy data from old columns to new tables) — add these manually
5. DROP COLUMN statements on `companies` (remove old fields)

Add the following data migration statements **between** the ADD COLUMN and DROP COLUMN sections:

```sql
-- ============================================================
-- DATA MIGRATION: Copy data from companies to new tables
-- ============================================================

-- 1. Populate company_settings for every existing company
INSERT INTO "company_settings" ("id", "company_id", "max_upload_size_mb", "default_vat_rate", "created_at", "updated_at")
SELECT gen_random_uuid()::text, id, "max_upload_size_mb", "default_vat_rate", "created_at", "updated_at"
FROM "companies";

-- 2. Populate company_scan_settings for every existing company
INSERT INTO "company_scan_settings" ("id", "company_id", "ocr_provider", "scan_days_back", "scan_sent", "blocked_email_rules", "created_at", "updated_at")
SELECT gen_random_uuid()::text, id, "ocr_provider", "scan_days_back", "scan_sent", "blocked_email_rules", "created_at", "updated_at"
FROM "companies";

-- 3. Migrate Gmail integrations (only companies that have Gmail data)
INSERT INTO "company_integrations" ("id", "company_id", "type", "status", "external_id", "credentials", "config", "connected_at", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  id,
  'GMAIL'::"IntegrationType",
  CASE WHEN "gmail_refresh_token" IS NOT NULL THEN 'CONNECTED'::"IntegrationStatus" ELSE 'DISCONNECTED'::"IntegrationStatus" END,
  "gmail_email",
  CASE WHEN "gmail_refresh_token" IS NOT NULL THEN jsonb_build_object('refreshToken', "gmail_refresh_token") ELSE NULL END,
  CASE WHEN "gmail_email" IS NOT NULL THEN jsonb_build_object('email', "gmail_email") ELSE NULL END,
  "gmail_connected_at",
  "created_at",
  "updated_at"
FROM "companies"
WHERE "gmail_email" IS NOT NULL OR "gmail_refresh_token" IS NOT NULL;

-- 4. Migrate WhatsApp integrations (only companies that have WhatsApp data)
INSERT INTO "company_integrations" ("id", "company_id", "type", "status", "external_id", "credentials", "config", "connected_at", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  id,
  'WHATSAPP'::"IntegrationType",
  CASE WHEN "whatsapp_access_token" IS NOT NULL AND "whatsapp_phone_number_id" IS NOT NULL THEN 'CONNECTED'::"IntegrationStatus" ELSE 'DISCONNECTED'::"IntegrationStatus" END,
  "whatsapp_phone_number_id",
  CASE WHEN "whatsapp_access_token" IS NOT NULL THEN jsonb_build_object('accessToken', "whatsapp_access_token", 'verifyToken', "whatsapp_verify_token") ELSE NULL END,
  jsonb_build_object('phoneNumberId', "whatsapp_phone_number_id", 'businessId', "whatsapp_business_id", 'phoneNumber', "whatsapp_phone_number"),
  "whatsapp_connected_at",
  "created_at",
  "updated_at"
FROM "companies"
WHERE "whatsapp_phone_number_id" IS NOT NULL OR "whatsapp_access_token" IS NOT NULL;
```

- [ ] **Step 7: Run the migration**

Run: `cd apps/api && npx prisma migrate dev`

- [ ] **Step 8: Verify migration success**

Run: `cd apps/api && npx prisma studio` — check that `company_settings`, `company_scan_settings`, and `company_integrations` have the correct data.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: split companies table into 4 tables (schema + data migration)"
```

---

### Task 2: Seed File

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Update seed to create settings records after company creation**

After the `company` upsert, add:

```typescript
// Create default settings for the company
await prisma.companySettings.upsert({
  where: { companyId: company.id },
  update: {},
  create: { companyId: company.id },
});

await prisma.companyScanSettings.upsert({
  where: { companyId: company.id },
  update: {},
  create: { companyId: company.id },
});
```

- [ ] **Step 2: Run seed to verify**

Run: `cd apps/api && npx prisma db seed`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat: update seed to create company settings records"
```

---

### Task 3: Admin Service — Company Settings

**Files:**
- Modify: `apps/api/src/support/admin/admin.service.ts`

- [ ] **Step 1: Update `getCompanySettings` to query `companySettings` table**

```typescript
async getCompanySettings(companyId: string) {
  const settings = await this.prisma.companySettings.findUnique({
    where: { companyId },
  });
  if (!settings) {
    // Auto-create defaults if missing (backward compat)
    return this.prisma.companySettings.create({
      data: { companyId },
      select: { maxUploadSizeMb: true, defaultVatRate: true },
    });
  }
  return { maxUploadSizeMb: settings.maxUploadSizeMb, defaultVatRate: settings.defaultVatRate };
}
```

- [ ] **Step 2: Update `updateCompanySettings` to update `companySettings` table**

```typescript
async updateCompanySettings(companyId: string, dto: { maxUploadSizeMb?: number; defaultVatRate?: number }) {
  return this.prisma.companySettings.upsert({
    where: { companyId },
    create: {
      companyId,
      ...(dto.maxUploadSizeMb !== undefined && { maxUploadSizeMb: dto.maxUploadSizeMb }),
      ...(dto.defaultVatRate !== undefined && { defaultVatRate: dto.defaultVatRate }),
    },
    update: {
      ...(dto.maxUploadSizeMb !== undefined && { maxUploadSizeMb: dto.maxUploadSizeMb }),
      ...(dto.defaultVatRate !== undefined && { defaultVatRate: dto.defaultVatRate }),
    },
    select: { maxUploadSizeMb: true, defaultVatRate: true },
  });
}
```

- [ ] **Step 3: Update `createCompany` to also create settings + scan settings in a transaction**

```typescript
async createCompany(dto: { name: string; email?: string; businessId?: string }) {
  return this.prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: dto.name, email: dto.email, businessId: dto.businessId },
      select: { id: true, name: true, email: true, businessId: true, createdAt: true },
    });
    await tx.companySettings.create({ data: { companyId: company.id } });
    await tx.companyScanSettings.create({ data: { companyId: company.id } });
    return company;
  });
}
```

- [ ] **Step 4: Update `listCompanies` to include `status` field**

```typescript
async listCompanies() {
  return this.prisma.company.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      businessId: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/support/admin/admin.service.ts
git commit -m "feat: update admin service to use company_settings table"
```

---

### Task 4: Gmail Service

**Files:**
- Modify: `apps/api/src/integrations/gmail/gmail.service.ts`

- [ ] **Step 1: Update `handleOAuthCallback` — write to `companyIntegration`**

```typescript
async handleOAuthCallback(code: string, companyId: string) {
  const oauth2 = this.createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const email = profile.data.emailAddress || null;

  await this.prisma.companyIntegration.upsert({
    where: { companyId_type: { companyId, type: 'GMAIL' } },
    create: {
      companyId,
      type: 'GMAIL',
      status: 'CONNECTED',
      externalId: email,
      credentials: { refreshToken: tokens.refresh_token! },
      config: { email },
      connectedAt: new Date(),
    },
    update: {
      status: 'CONNECTED',
      externalId: email,
      credentials: { refreshToken: tokens.refresh_token! },
      config: { email },
      connectedAt: new Date(),
    },
  });
  return { email };
}
```

- [ ] **Step 2: Update `disconnect` — update `companyIntegration`**

```typescript
async disconnect(companyId: string) {
  await this.prisma.companyIntegration.upsert({
    where: { companyId_type: { companyId, type: 'GMAIL' } },
    create: { companyId, type: 'GMAIL', status: 'DISCONNECTED' },
    update: { status: 'DISCONNECTED', credentials: null, externalId: null, config: null, connectedAt: null },
  });
}
```

- [ ] **Step 3: Update `getSettings` — query scan settings + gmail integration**

```typescript
async getSettings(companyId: string) {
  const [scanSettings, integration] = await Promise.all([
    this.prisma.companyScanSettings.findUnique({ where: { companyId } }),
    this.prisma.companyIntegration.findUnique({ where: { companyId_type: { companyId, type: 'GMAIL' } } }),
  ]);
  const creds = integration?.credentials as Record<string, any> | null;
  return {
    scanDaysBack: scanSettings?.scanDaysBack ?? 7,
    scanSent: scanSettings?.scanSent ?? true,
    connected: !!creds?.refreshToken,
    gmailEmail: integration?.externalId ?? null,
    connectedAt: integration?.connectedAt ?? null,
    ocrProvider: scanSettings?.ocrProvider ?? 'GEMINI',
  };
}
```

- [ ] **Step 4: Update `updateSettings` — update `companyScanSettings`**

```typescript
async updateSettings(companyId: string, scanDaysBack: number, scanSent?: boolean) {
  const data: { scanDaysBack: number; scanSent?: boolean } = { scanDaysBack };
  if (scanSent !== undefined) data.scanSent = scanSent;
  const scanSettings = await this.prisma.companyScanSettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
  const integration = await this.prisma.companyIntegration.findUnique({
    where: { companyId_type: { companyId, type: 'GMAIL' } },
  });
  const creds = integration?.credentials as Record<string, any> | null;
  return {
    scanDaysBack: scanSettings.scanDaysBack,
    scanSent: scanSettings.scanSent,
    connected: !!creds?.refreshToken,
    gmailEmail: integration?.externalId ?? null,
    connectedAt: integration?.connectedAt ?? null,
  };
}
```

- [ ] **Step 5: Update `getOcrProvider` / `updateOcrProvider` — use `companyScanSettings`**

```typescript
async getOcrProvider(companyId: string) {
  const s = await this.prisma.companyScanSettings.findUnique({ where: { companyId } });
  return { ocrProvider: s?.ocrProvider ?? 'GEMINI' };
}

async updateOcrProvider(companyId: string, provider: 'OPENAI' | 'GEMINI') {
  const s = await this.prisma.companyScanSettings.upsert({
    where: { companyId },
    create: { companyId, ocrProvider: provider },
    update: { ocrProvider: provider },
  });
  return { ocrProvider: s.ocrProvider };
}
```

- [ ] **Step 6: Update blocked rules methods — use `companyScanSettings`**

```typescript
async getBlockedRules(companyId: string) {
  const s = await this.prisma.companyScanSettings.findUnique({ where: { companyId } });
  return { rules: ((s?.blockedEmailRules ?? []) as Array<{ type: string; pattern: string }>) };
}

async addBlockedRule(companyId: string, type: 'sender' | 'subject', pattern: string) {
  const s = await this.prisma.companyScanSettings.findUniqueOrThrow({ where: { companyId } });
  const rules = (s.blockedEmailRules ?? []) as Array<{ type: string; pattern: string }>;
  rules.push({ type, pattern });
  await this.prisma.companyScanSettings.update({ where: { companyId }, data: { blockedEmailRules: rules } });
  return { rules };
}

async removeBlockedRule(companyId: string, index: number) {
  const s = await this.prisma.companyScanSettings.findUniqueOrThrow({ where: { companyId } });
  const rules = (s.blockedEmailRules ?? []) as Array<{ type: string; pattern: string }>;
  if (index < 0 || index >= rules.length) throw new Error('Invalid rule index');
  rules.splice(index, 1);
  await this.prisma.companyScanSettings.update({ where: { companyId }, data: { blockedEmailRules: rules } });
  return { rules };
}
```

- [ ] **Step 7: Update `createGmailClient` signature — accept refreshToken directly**

```typescript
createGmailClient(refreshToken: string | null): gmail_v1.Gmail | null {
  const token = refreshToken || this.config.get('gmail.refreshToken');
  if (!token) return null;
  const oauth2 = this.createOAuth2Client();
  oauth2.setCredentials({ refresh_token: token });
  return google.gmail({ version: 'v1', auth: oauth2 });
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/integrations/gmail/gmail.service.ts
git commit -m "feat: update gmail service to use new settings + integrations tables"
```

---

### Task 5: Gmail Scanner Service

**Files:**
- Modify: `apps/api/src/integrations/gmail/gmail-scanner.service.ts`

- [ ] **Step 1: Update `scanInbox` — fetch scan settings + integration separately**

In `scanInbox`, after getting `company`, add:

```typescript
const [scanSettings, gmailIntegration] = await Promise.all([
  this.prisma.companyScanSettings.findUnique({ where: { companyId: company.id } }),
  this.prisma.companyIntegration.findUnique({ where: { companyId_type: { companyId: company.id, type: 'GMAIL' } } }),
]);
const refreshToken = (gmailIntegration?.credentials as Record<string, any>)?.refreshToken ?? null;
```

Then update the references:
- `this.gmail.createGmailClient(company)` → `this.gmail.createGmailClient(refreshToken)`
- `company.scanDaysBack` → `scanSettings?.scanDaysBack ?? 7`
- `company.scanSent` → `scanSettings?.scanSent ?? true`

- [ ] **Step 2: Update `retryScanLog` — fetch integration for Gmail client**

```typescript
const gmailIntegration = await this.prisma.companyIntegration.findUnique({
  where: { companyId_type: { companyId, type: 'GMAIL' } },
});
const refreshToken = (gmailIntegration?.credentials as Record<string, any>)?.refreshToken ?? null;
const client = this.gmail.createGmailClient(refreshToken);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/integrations/gmail/gmail-scanner.service.ts
git commit -m "feat: update gmail scanner to use new settings tables"
```

---

### Task 6: Email Processor Service

**Files:**
- Modify: `apps/api/src/integrations/gmail/email-processor.service.ts`

- [ ] **Step 1: Update `isEmailBlocked` — query `companyScanSettings`**

```typescript
async isEmailBlocked(
  companyId: string,
  subject: string | null,
  senderEmail: string | null,
  senderName: string | null,
): Promise<boolean> {
  const scanSettings = await this.prisma.companyScanSettings.findUnique({
    where: { companyId },
  });
  const rules = (scanSettings?.blockedEmailRules ?? []) as Array<{ type: string; pattern: string }>;
  if (rules.length === 0) return false;

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    if (rule.type === 'sender') {
      if (senderEmail?.toLowerCase().includes(pattern)) return true;
      if (senderName?.toLowerCase().includes(pattern)) return true;
    } else if (rule.type === 'subject') {
      if (subject?.toLowerCase().includes(pattern)) return true;
    }
  }
  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/integrations/gmail/email-processor.service.ts
git commit -m "feat: update email processor to use company_scan_settings"
```

---

### Task 7: WhatsApp Service

**Files:**
- Modify: `apps/api/src/integrations/whatsapp/whatsapp.service.ts`

- [ ] **Step 1: Update `getSettings` — query `companyIntegration`**

```typescript
async getSettings(companyId: string) {
  const integration = await this.prisma.companyIntegration.findUnique({
    where: { companyId_type: { companyId, type: 'WHATSAPP' } },
  });
  const creds = integration?.credentials as Record<string, any> | null;
  const cfg = integration?.config as Record<string, any> | null;
  return {
    connected: !!creds?.accessToken && !!integration?.externalId,
    phoneNumber: cfg?.phoneNumber ?? null,
    connectedAt: integration?.connectedAt ?? null,
    phoneNumberId: integration?.externalId ?? null,
    businessId: cfg?.businessId ?? null,
    hasAccessToken: !!creds?.accessToken,
    verifyToken: creds?.verifyToken ?? null,
  };
}
```

- [ ] **Step 2: Update `updateSettings` — upsert `companyIntegration`**

```typescript
async updateSettings(
  companyId: string,
  dto: { phoneNumberId: string; businessId: string; accessToken: string; verifyToken?: string; phoneNumber?: string },
) {
  await this.prisma.companyIntegration.upsert({
    where: { companyId_type: { companyId, type: 'WHATSAPP' } },
    create: {
      companyId,
      type: 'WHATSAPP',
      status: 'CONNECTED',
      externalId: dto.phoneNumberId,
      credentials: { accessToken: dto.accessToken, verifyToken: dto.verifyToken ?? null },
      config: { phoneNumberId: dto.phoneNumberId, businessId: dto.businessId, phoneNumber: dto.phoneNumber ?? null },
      connectedAt: new Date(),
    },
    update: {
      status: 'CONNECTED',
      externalId: dto.phoneNumberId,
      credentials: { accessToken: dto.accessToken, verifyToken: dto.verifyToken ?? null },
      config: { phoneNumberId: dto.phoneNumberId, businessId: dto.businessId, phoneNumber: dto.phoneNumber ?? null },
      connectedAt: new Date(),
    },
  });
  return this.getSettings(companyId);
}
```

- [ ] **Step 3: Update `disconnect` — update `companyIntegration`**

```typescript
async disconnect(companyId: string) {
  await this.prisma.companyIntegration.upsert({
    where: { companyId_type: { companyId, type: 'WHATSAPP' } },
    create: { companyId, type: 'WHATSAPP', status: 'DISCONNECTED' },
    update: {
      status: 'DISCONNECTED',
      externalId: null,
      credentials: null,
      config: null,
      connectedAt: null,
    },
  });
}
```

- [ ] **Step 4: Update `sendReply` and `markAsRead` — query `companyIntegration`**

Replace both methods' company query with:

```typescript
const integration = await this.prisma.companyIntegration.findUnique({
  where: { companyId_type: { companyId, type: 'WHATSAPP' } },
});
const creds = integration?.credentials as Record<string, any> | null;
const accessToken = creds?.accessToken;
const phoneNumberId = integration?.externalId;
if (!accessToken || !phoneNumberId) return;
```

Then replace:
- `company.whatsappAccessToken` → `accessToken`
- `company.whatsappPhoneNumberId` → `phoneNumberId`

- [ ] **Step 5: Update `findCompanyByPhoneNumberId` — query `companyIntegration`**

```typescript
async findCompanyByPhoneNumberId(phoneNumberId: string): Promise<{ id: string; whatsappAccessToken: string | null } | null> {
  const integration = await this.prisma.companyIntegration.findFirst({
    where: { type: 'WHATSAPP', externalId: phoneNumberId },
  });
  if (!integration) return null;
  const creds = integration.credentials as Record<string, any> | null;
  return { id: integration.companyId, whatsappAccessToken: creds?.accessToken ?? null };
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/integrations/whatsapp/whatsapp.service.ts
git commit -m "feat: update whatsapp service to use company_integrations table"
```

---

### Task 8: WhatsApp Webhook Service

**Files:**
- Modify: `apps/api/src/integrations/whatsapp/whatsapp-webhook.service.ts`

- [ ] **Step 1: No changes needed**

The `processMessage` method signature `company: { id: string; whatsappAccessToken: string | null }` already matches the return type of the updated `findCompanyByPhoneNumberId`. The `company.whatsappAccessToken!` usage on line 190 will still work.

Verify by reading the method and confirming the types align.

- [ ] **Step 2: Commit (if any changes were needed)**

---

### Task 9: Vision API Service + AI Matcher Service

**Files:**
- Modify: `apps/api/src/intelligence/ocr/vision-api.service.ts`
- Modify: `apps/api/src/domain/matching/ai-matcher.service.ts`

- [ ] **Step 1: Update `VisionApiService.getProvider` — query `companyScanSettings`**

```typescript
async getProvider(companyId: string): Promise<'OPENAI' | 'GEMINI'> {
  const now = Date.now();
  if (this.providerCache && this.providerCache.companyId === companyId && now - this.providerCache.ts < 5 * 60_000) {
    return this.providerCache.provider;
  }
  const scanSettings = await this.prisma.companyScanSettings.findUnique({ where: { companyId } });
  const provider = scanSettings?.ocrProvider ?? 'GEMINI';
  this.providerCache = { companyId, provider, ts: now };
  return provider;
}
```

- [ ] **Step 2: Update `AiMatcherService.getOcrProvider` — query `companyScanSettings`**

```typescript
async getOcrProvider(companyId: string): Promise<'OPENAI' | 'GEMINI'> {
  const scanSettings = await this.prisma.companyScanSettings.findUnique({
    where: { companyId },
  });
  return scanSettings?.ocrProvider ?? 'GEMINI';
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/intelligence/ocr/vision-api.service.ts apps/api/src/domain/matching/ai-matcher.service.ts
git commit -m "feat: update OCR services to use company_scan_settings"
```

---

### Task 10: Upload Service

**Files:**
- Modify: `apps/api/src/support/upload/upload.service.ts`

- [ ] **Step 1: Update `processUpload` — query `companySettings`**

Replace line 43:
```typescript
const settings = await this.prisma.companySettings.findUnique({ where: { companyId } });
const maxUploadSizeMb = settings?.maxUploadSizeMb ?? 20;
const maxBytes = maxUploadSizeMb * 1024 * 1024;
if (file.size > maxBytes) {
  throw new BadRequestException(`הקובץ גדול מדי. הגודל המרבי המותר הוא ${maxUploadSizeMb}MB`);
}
```

- [ ] **Step 2: Update `processManualScan` — same pattern**

Replace lines 161-165:
```typescript
const settings = await this.prisma.companySettings.findUnique({ where: { companyId } });
const maxUploadSizeMb = settings?.maxUploadSizeMb ?? 20;
const maxBytes = maxUploadSizeMb * 1024 * 1024;
```

And update the error message on line 177 to use `maxUploadSizeMb` variable.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/support/upload/upload.service.ts
git commit -m "feat: update upload service to use company_settings table"
```

---

### Task 11: Testing Services

**Files:**
- Modify: `apps/api/src/support/testing/test-runner.service.ts`
- Modify: `apps/api/src/support/testing/mock-generator.service.ts`

- [ ] **Step 1: Update test-runner.service.ts — create scan settings after company**

After each `prisma.company.create(...)` call (lines ~54-58 and ~126-130), remove `ocrProvider: 'OPENAI'` from the company create data, and add:

```typescript
const company = await this.prisma.company.create({
  data: { name: `__test_live_${caseId}_${Date.now()}` },
});
await this.prisma.companySettings.create({ data: { companyId: company.id } });
await this.prisma.companyScanSettings.create({ data: { companyId: company.id, ocrProvider: 'OPENAI' } });
```

- [ ] **Step 2: Update mock-generator.service.ts — same pattern**

Line ~46-50: remove `ocrProvider: 'OPENAI'` from company create, add settings creation after.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/support/testing/test-runner.service.ts apps/api/src/support/testing/mock-generator.service.ts
git commit -m "feat: update test services to create company settings records"
```

---

### Task 12: Shared Types, Frontend Types & Debug Script

**Files:**
- Modify: `packages/shared/src/types/company.ts`
- Modify: `apps/web/src/services/admin.service.ts`
- Modify: `apps/api/src/scripts/debug-extract.ts`

- [ ] **Step 1: Update shared Company type — add status**

```typescript
export interface Company {
  id: string;
  name: string;
  businessId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Update frontend `CompanyListItem` type — add status**

In `apps/web/src/services/admin.service.ts`, add `status` to the `CompanyListItem` interface:

```typescript
export interface CompanyListItem {
  id: string;
  name: string;
  email: string | null;
  businessId: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  _count: { users: number };
}
```

- [ ] **Step 3: Update debug-extract.ts — query `companyScanSettings` for ocrProvider**

Replace the company query (around line 34-36):

```typescript
const company = await prisma.company.findFirst({
  select: { id: true, name: true },
});
if (!company) throw new Error('No company found');
const scanSettings = await prisma.companyScanSettings.findUnique({
  where: { companyId: company.id },
  select: { ocrProvider: true },
});
const ocrProvider = scanSettings?.ocrProvider ?? 'GEMINI';
```

Then update `console.log` at line 41 to use `ocrProvider` instead of `company.ocrProvider`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/company.ts apps/web/src/services/admin.service.ts apps/api/src/scripts/debug-extract.ts
git commit -m "feat: update shared types and debug script for company refactor"
```

---

### Task 13: Build Verification & Smoke Test

- [ ] **Step 1: Generate Prisma client**

Run: `cd apps/api && npx prisma generate`

- [ ] **Step 2: Build the API**

Run: `cd apps/api && npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Build the web app**

Run: `cd apps/web && npm run build`
Expected: No TypeScript errors (no frontend changes needed)

- [ ] **Step 4: Start the server and verify basic flows**

Run: `cd apps/api && npm run start:dev`

Verify:
1. `GET /admin/company-settings` returns `{ maxUploadSizeMb, defaultVatRate }`
2. `GET /gmail/settings` returns settings with correct `connected`, `ocrProvider`
3. `GET /whatsapp/settings` returns settings with correct `connected`
4. `GET /admin/companies` returns companies with `status: "ACTIVE"`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete company table refactor — split into 4 tables"
```

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| `companies` table | 22 columns (God table) | 8 columns (identity + status) |
| Company settings | Mixed in `companies` | `company_settings` (1:1) |
| Scan/OCR settings | Mixed in `companies` | `company_scan_settings` (1:1) |
| Gmail integration | 3 columns in `companies` | Row in `company_integrations` |
| WhatsApp integration | 6 columns in `companies` | Row in `company_integrations` |
| Future integrations | New migration per integration | Just a new row |
| Company status | N/A | `ACTIVE` / `SUSPENDED` / `DELETED` enum |
| Frontend | N/A | **Minimal** — add `status` to `CompanyListItem` type |

## Risk Mitigation

1. **Data migration SQL** runs inside the Prisma migration — atomic, all-or-nothing
2. **`upsert` pattern** used in services — handles edge case where settings record doesn't exist yet
3. **Default values** on all new fields — existing behavior preserved even if migration misses a row
4. **No frontend changes** — API response shapes stay identical, zero risk of breaking UI
5. **No downtime** — migration is additive (create tables, copy data) then subtractive (drop columns)
