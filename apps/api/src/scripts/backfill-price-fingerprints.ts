/**
 * Backfill script: populate price_fingerprints from existing invoice line items.
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/backfill-price-fingerprints.ts
 * Or run via: node -e "require('./dist/src/scripts/backfill-price-fingerprints.js').backfillPriceFingerprints()"
 */
import { PrismaClient } from '@prisma/client';

export async function backfillPriceFingerprints() {
  const prisma = new PrismaClient();

  try {
    const invoiceLineItems = await prisma.invoiceLineItem.findMany({
      where: {
        unitPrice: { not: null, gt: 0 },
        catalogNumber: { not: null },
      },
      include: {
        invoice: { select: { companyId: true } },
      },
    });

    console.log(
      `Found ${invoiceLineItems.length} invoice line items with catalog numbers`,
    );

    let created = 0;
    let updated = 0;

    for (const li of invoiceLineItems) {
      const companyId = li.invoice.companyId;
      const catalogNumber = (li.catalogNumber || '').trim();
      const unit = (li.unit || '').trim();
      const unitPrice = Number(li.unitPrice);

      if (!catalogNumber || unitPrice <= 0) continue;

      try {
        const existing = await prisma.priceFingerprint.findUnique({
          where: {
            companyId_catalogNumber_unit: { companyId, catalogNumber, unit },
          },
        });

        if (existing) {
          const count = existing.observationCount;
          const avg =
            (Number(existing.unitPrice) * count + unitPrice) / (count + 1);
          await prisma.priceFingerprint.update({
            where: { id: existing.id },
            data: {
              unitPrice: Math.round(avg * 100) / 100,
              minPrice: Math.min(Number(existing.minPrice), unitPrice),
              maxPrice: Math.max(Number(existing.maxPrice), unitPrice),
              observationCount: count + 1,
              confidence: Math.min(0.95, 0.5 + (count + 1) * 0.1),
            },
          });
          updated++;
        } else {
          await prisma.priceFingerprint.create({
            data: {
              companyId,
              catalogNumber,
              description: li.description || '',
              unit,
              unitPrice,
              minPrice: unitPrice,
              maxPrice: unitPrice,
              observationCount: 1,
              source: 'invoice',
              confidence: 0.6,
            },
          });
          created++;
        }
      } catch {
        // Skip duplicates or errors
      }
    }

    console.log(
      `Backfill complete: ${created} created, ${updated} updated`,
    );

    const total = await prisma.priceFingerprint.count();
    console.log(`Total fingerprints in DB: ${total}`);
  } finally {
    await prisma.$disconnect();
  }
}

backfillPriceFingerprints().catch(console.error);
