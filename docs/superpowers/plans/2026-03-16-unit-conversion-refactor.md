# Unit Conversion Fix + build-line-item Refactor

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix unit conversion bug where received quantity uses raw DN count (920 units) instead of converted value (3,220 linear meters), and refactor build-line-item.ts from 580 lines into 3 focused files under 500 lines each.

**Architecture:** Extract received-qty resolution and invoice resolution into separate files. Add invoice-based unit conversion fallback: when DN unit != PO unit and no quantityBreakdown, derive converted qty from invoice's totalPrice/unitPrice.

**Tech Stack:** TypeScript, Vitest

---

## File Structure

| File | Responsibility | ~Lines |
|------|---------------|--------|
| `resolve-received.ts` (new) | `resolveReceivedFromPairing`, `resolveReceivedFallback`, `deriveQtyFromInvoice`, string helpers | ~300 |
| `resolve-invoiced.ts` (new) | `resolveInvoiced`, `descriptionsSimilar` | ~110 |
| `build-line-item.ts` (modified) | `buildLineItem`, `buildRelatedDocs`, `resolveOrderedQty`, types | ~170 |

---

### Task 1: Extract `resolve-received.ts`

**Files:**
- Create: `apps/api/src/domain/projects/resolve-received.ts`
- Modify: `apps/api/src/domain/projects/build-line-item.ts`

- [ ] **Step 1: Create `resolve-received.ts`**
Move `normalize`, `resolveReceivedFromPairing`, `resolveReceivedFallback` from build-line-item.ts. Add `deriveQtyFromInvoice` helper + invoice-based conversion fallback in both `add()` functions.

- [ ] **Step 2: Verify build compiles**
Run: `cd apps/api && npx tsc --noEmit`

### Task 2: Extract `resolve-invoiced.ts`

**Files:**
- Create: `apps/api/src/domain/projects/resolve-invoiced.ts`
- Modify: `apps/api/src/domain/projects/build-line-item.ts`

- [ ] **Step 1: Create `resolve-invoiced.ts`**
Move `resolveInvoiced` and `descriptionsSimilar` from build-line-item.ts.

- [ ] **Step 2: Update `build-line-item.ts` imports**
Import from new files, remove moved code.

- [ ] **Step 3: Verify build compiles**
Run: `cd apps/api && npx tsc --noEmit`

### Task 3: Add unit conversion test

**Files:**
- Modify: `apps/api/src/__tests__/build-line-item.test.ts`

- [ ] **Step 1: Add test for invoice-based unit conversion**
Test: PO orders 3360 מ"א, DN delivers 920 יח', invoice shows 920×3.96=3,643.20 but totalPrice=12,751.20 → derived qty = 12,751.20/3.96 = 3,220 מ"א.

- [ ] **Step 2: Run tests**
Run: `cd apps/api && npx vitest run src/__tests__/build-line-item.test.ts`

### Task 4: Verify all tests pass

- [ ] **Step 1: Run full test suite**
Run: `cd apps/api && npx vitest run`
