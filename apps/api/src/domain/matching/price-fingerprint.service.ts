import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface PriceFingerprintEntry {
  unitPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  observationCount: number;
}

@Injectable()
export class PriceFingerprintService {
  private readonly logger = new Logger(PriceFingerprintService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load all fingerprints for a company into a lookup map.
   * Key format: "catalogNumber:unit"
   */
  async getCompanyFingerprints(
    companyId: string,
  ): Promise<Map<string, PriceFingerprintEntry>> {
    const records = await this.prisma.priceFingerprint.findMany({
      where: { companyId },
    });

    const map = new Map<string, PriceFingerprintEntry>();
    for (const r of records) {
      const key = `${r.catalogNumber}:${r.unit}`;
      map.set(key, {
        unitPrice: Number(r.unitPrice),
        minPrice: Number(r.minPrice),
        maxPrice: Number(r.maxPrice),
        confidence: r.confidence,
        observationCount: r.observationCount,
      });
    }
    return map;
  }

  /**
   * Learn a price from an invoice line item.
   * Uses running average for unitPrice, widens min/max range.
   */
  async learnFromInvoice(
    companyId: string,
    item: {
      catalogNumber?: string | null;
      description?: string;
      unit?: string | null;
      unitPrice: number;
    },
  ): Promise<void> {
    const catalogNumber = (item.catalogNumber || '').trim();
    if (!catalogNumber || item.unitPrice <= 0) return;

    const unit = (item.unit || '').trim();
    const price = item.unitPrice;

    try {
      const existing = await this.prisma.priceFingerprint.findUnique({
        where: {
          companyId_catalogNumber_unit: { companyId, catalogNumber, unit },
        },
      });

      if (existing) {
        const count = existing.observationCount;
        const avg =
          (Number(existing.unitPrice) * count + price) / (count + 1);
        await this.prisma.priceFingerprint.update({
          where: { id: existing.id },
          data: {
            unitPrice: Math.round(avg * 100) / 100,
            minPrice: Math.min(Number(existing.minPrice), price),
            maxPrice: Math.max(Number(existing.maxPrice), price),
            observationCount: count + 1,
            confidence: Math.min(0.95, 0.5 + (count + 1) * 0.1),
            source: 'invoice',
            lastSeenAt: new Date(),
            description: item.description || existing.description,
          },
        });
      } else {
        await this.prisma.priceFingerprint.create({
          data: {
            companyId,
            catalogNumber,
            description: item.description || '',
            unit,
            unitPrice: price,
            minPrice: price,
            maxPrice: price,
            observationCount: 1,
            source: 'invoice',
            confidence: 0.6,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to learn price: ${error}`);
    }
  }

  /**
   * Learn a price from a user correction (highest confidence).
   */
  async learnFromUserCorrection(
    companyId: string,
    item: {
      catalogNumber?: string | null;
      description?: string;
      unit?: string | null;
      unitPrice: number;
    },
  ): Promise<void> {
    const catalogNumber = (item.catalogNumber || '').trim();
    if (!catalogNumber || item.unitPrice <= 0) return;

    const unit = (item.unit || '').trim();
    const price = item.unitPrice;

    try {
      await this.prisma.priceFingerprint.upsert({
        where: {
          companyId_catalogNumber_unit: { companyId, catalogNumber, unit },
        },
        create: {
          companyId,
          catalogNumber,
          description: item.description || '',
          unit,
          unitPrice: price,
          minPrice: price,
          maxPrice: price,
          observationCount: 1,
          source: 'user_correction',
          confidence: 0.95,
        },
        update: {
          unitPrice: price,
          minPrice: price,
          maxPrice: price,
          source: 'user_correction',
          confidence: 0.95,
          lastSeenAt: new Date(),
          description: item.description || undefined,
        },
      });

      this.logger.log(
        `Learned price from user correction: ${catalogNumber} = ${price}`,
      );
    } catch (error) {
      this.logger.warn(`Failed to learn price from correction: ${error}`);
    }
  }

}
