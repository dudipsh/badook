import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { normalizeUnit } from './unit-utils';

@Injectable()
export class UnitConversionService {
  private readonly logger = new Logger(UnitConversionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Try to convert a quantity from one unit to another using stored conversion factors.
   * Returns null if no conversion is known.
   */
  async convert(
    companyId: string,
    catalogNumber: string | null,
    description: string,
    fromUnit: string,
    toUnit: string,
    quantity: number,
  ): Promise<{ quantity: number; unit: string } | null> {
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    if (!from || !to || from === to) return { quantity, unit: toUnit };

    // Try exact catalog number match first
    let conversion = catalogNumber
      ? await this.prisma.catalogItemConversion.findFirst({
          where: { companyId, fromUnit: from, toUnit: to, catalogNumber },
          orderBy: { confidence: 'desc' },
        })
      : null;

    // Fallback: match by description keywords (only if no catalog match)
    if (!conversion && description) {
      const keywords = description
        .replace(/[()"/\-,.:;!?]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      if (keywords.length > 0) {
        const candidates = await this.prisma.catalogItemConversion.findMany({
          where: { companyId, fromUnit: from, toUnit: to, catalogNumber: '' },
        });
        conversion = candidates.find((c) =>
          keywords.some((kw) => (c.description || '').includes(kw)),
        ) ?? null;
      }
    }

    if (!conversion) return null;

    const factor = Number(conversion.factor);
    return { quantity: quantity * factor, unit: toUnit };
  }

  /**
   * Learn conversion factor from a DN line item's quantityBreakdown.
   * E.g., breakdown = [{value: 49, unit: "קרטון"}, {value: 114.66, unit: "מ\"ר"}]
   * -> factor from קרטון to מ"ר = 114.66/49 = 2.34
   */
  async learnFromBreakdown(
    companyId: string,
    catalogNumber: string | null,
    description: string,
    breakdown: Array<{ label?: string; value: number; unit: string }>,
    primaryQty: number,
    primaryUnit: string,
  ): Promise<void> {
    if (!Array.isArray(breakdown) || breakdown.length < 2) return;

    const primary = normalizeUnit(primaryUnit);
    if (!primary) return;

    for (const entry of breakdown) {
      const entryUnit = normalizeUnit(entry.unit);
      if (!entryUnit || entryUnit === primary) continue;
      if (!entry.value || entry.value <= 0 || !primaryQty || primaryQty <= 0) continue;

      // Compute factor: how many primaryUnits per entryUnit
      const factor = primaryQty / entry.value;

      try {
        await this.prisma.catalogItemConversion.upsert({
          where: {
            companyId_catalogNumber_fromUnit_toUnit: {
              companyId,
              catalogNumber: catalogNumber || '',
              fromUnit: entryUnit,
              toUnit: primary,
            },
          },
          create: {
            companyId,
            catalogNumber: catalogNumber || '',
            description: description || '',
            fromUnit: entryUnit,
            toUnit: primary,
            factor,
            source: 'learned',
            confidence: 0.9,
          },
          update: {
            factor,
            description: description || undefined,
            confidence: 0.9,
          },
        });

        // Also store reverse conversion
        await this.prisma.catalogItemConversion.upsert({
          where: {
            companyId_catalogNumber_fromUnit_toUnit: {
              companyId,
              catalogNumber: catalogNumber || '',
              fromUnit: primary,
              toUnit: entryUnit,
            },
          },
          create: {
            companyId,
            catalogNumber: catalogNumber || '',
            description: description || '',
            fromUnit: primary,
            toUnit: entryUnit,
            factor: 1 / factor,
            source: 'learned',
            confidence: 0.9,
          },
          update: {
            factor: 1 / factor,
            description: description || undefined,
            confidence: 0.9,
          },
        });

        this.logger.log(
          `Learned conversion: ${entryUnit} -> ${primary} = ${factor.toFixed(4)} (catalog: ${catalogNumber || 'N/A'})`,
        );
      } catch (error) {
        this.logger.warn(`Failed to learn conversion: ${error}`);
      }
    }
  }
}
