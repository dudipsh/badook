import { Prisma } from '@prisma/client';

/** Convert any value to Prisma.Decimal or null. Handles empty strings, NaN, Infinity safely. */
export function safeDecimal(v: unknown): Prisma.Decimal | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? new Prisma.Decimal(n) : null;
}
