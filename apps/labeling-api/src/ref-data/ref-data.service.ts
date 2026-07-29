import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '../generated/prisma-client';
import {
  PaginationDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateProductDto,
  UpdateProductDto,
  CreateCityDto,
  UpdateCityDto,
} from './dto/ref-data.dto';

@Injectable()
export class RefDataService {
  private readonly logger = new Logger(RefDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Suppliers ───

  async listSuppliers(query: PaginationDto) {
    const { page = 1, limit = 50, search, category } = query;
    const where: Prisma.RefSupplierWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (category) {
      where.categories = { has: category };
    }

    const [items, total] = await Promise.all([
      this.prisma.refSupplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refSupplier.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.refSupplier.create({
      data: {
        name: dto.name,
        categories: dto.categories ?? [],
        phone: dto.phone,
        address: dto.address,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    return this.prisma.refSupplier.update({ where: { id }, data: dto });
  }

  async deleteSupplier(id: string) {
    return this.prisma.refSupplier.delete({ where: { id } });
  }

  async supplierCategories(): Promise<string[]> {
    const suppliers = await this.prisma.refSupplier.findMany({
      select: { categories: true },
    });
    const set = new Set<string>();
    for (const s of suppliers) {
      for (const c of s.categories) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'he'));
  }

  // ─── Products ───

  async listProducts(query: PaginationDto) {
    const { page = 1, limit = 50, search, category } = query;
    const where: Prisma.RefProductWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (category) {
      where.category = category;
    }

    const [items, total] = await Promise.all([
      this.prisma.refProduct.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refProduct.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createProduct(dto: CreateProductDto) {
    return this.prisma.refProduct.create({
      data: {
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        avgPrice: dto.avgPrice,
        variants: dto.variants ?? [],
        commonVendors: dto.commonVendors ?? [],
      },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    return this.prisma.refProduct.update({ where: { id }, data: dto });
  }

  async deleteProduct(id: string) {
    return this.prisma.refProduct.delete({ where: { id } });
  }

  async deleteProductsByCategories(categories: string[]) {
    const result = await this.prisma.refProduct.deleteMany({
      where: { category: { in: categories } },
    });
    this.logger.log(`Deleted ${result.count} products from categories: ${categories.join(', ')}`);
    return { deleted: result.count, categories };
  }

  async productCategories(): Promise<string[]> {
    const raw = await this.prisma.refProduct.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return raw.map((r) => r.category);
  }

  // ─── Cities ───

  async listCities(query: PaginationDto) {
    const { page = 1, limit = 50, search, category: district } = query;
    const where: Prisma.RefCityWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { englishName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (district) {
      where.district = district;
    }

    const [items, total] = await Promise.all([
      this.prisma.refCity.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refCity.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createCity(dto: CreateCityDto) {
    return this.prisma.refCity.create({
      data: {
        code: dto.code,
        name: dto.name,
        englishName: dto.englishName ?? '',
        district: dto.district ?? '',
        council: dto.council ?? '',
      },
    });
  }

  async updateCity(id: string, dto: UpdateCityDto) {
    return this.prisma.refCity.update({ where: { id }, data: dto });
  }

  async deleteCity(id: string) {
    return this.prisma.refCity.delete({ where: { id } });
  }

  async cityDistricts(): Promise<string[]> {
    const raw = await this.prisma.refCity.findMany({
      select: { district: true },
      distinct: ['district'],
      orderBy: { district: 'asc' },
    });
    return raw.map((r) => r.district).filter(Boolean);
  }

  // ─── Seed / Bulk Import ───

  async seedSuppliers(data: CreateSupplierDto[]) {
    let created = 0;
    let skipped = 0;

    for (const item of data) {
      try {
        await this.prisma.refSupplier.upsert({
          where: { name: item.name },
          create: {
            name: item.name,
            categories: item.categories ?? [],
            phone: item.phone,
            address: item.address,
          },
          update: {
            categories: item.categories ?? [],
            phone: item.phone,
            address: item.address,
          },
        });
        created++;
      } catch (e) {
        skipped++;
        this.logger.warn(`Skip supplier "${item.name}": ${e}`);
      }
    }

    return { created, skipped, total: data.length };
  }

  async seedProducts(data: CreateProductDto[]) {
    let created = 0;
    let skipped = 0;

    for (const item of data) {
      try {
        await this.prisma.refProduct.upsert({
          where: {
            name_category: { name: item.name, category: item.category },
          },
          create: {
            name: item.name,
            category: item.category,
            unit: item.unit,
            avgPrice: item.avgPrice,
            variants: item.variants ?? [],
            commonVendors: item.commonVendors ?? [],
          },
          update: {
            unit: item.unit,
            avgPrice: item.avgPrice,
            variants: item.variants ?? [],
            commonVendors: item.commonVendors ?? [],
          },
        });
        created++;
      } catch (e) {
        skipped++;
        this.logger.warn(`Skip product "${item.name}": ${e}`);
      }
    }

    return { created, skipped, total: data.length };
  }

  async seedCities(data: CreateCityDto[]) {
    let created = 0;
    let skipped = 0;

    for (const item of data) {
      try {
        await this.prisma.refCity.upsert({
          where: { code: item.code },
          create: {
            code: item.code,
            name: item.name,
            englishName: item.englishName ?? '',
            district: item.district ?? '',
            council: item.council ?? '',
          },
          update: {
            name: item.name,
            englishName: item.englishName ?? '',
            district: item.district ?? '',
            council: item.council ?? '',
          },
        });
        created++;
      } catch (e) {
        skipped++;
        this.logger.warn(`Skip city "${item.name}": ${e}`);
      }
    }

    return { created, skipped, total: data.length };
  }

  // ─── Migrate suppliers from existing samples ───

  async migrateSuppliersFromSamples() {
    const samples = await this.prisma.sample.findMany({
      where: {
        OR: [
          { groundTruth: { not: Prisma.DbNull } },
          { geminiExtraction: { not: Prisma.DbNull } },
        ],
      },
      select: {
        groundTruth: true,
        geminiExtraction: true,
        documentType: true,
      },
    });

    const supplierMap = new Map<string, { phone?: string; address?: string; categories: Set<string> }>();

    const DOC_TYPE_CATEGORY: Record<string, string> = {
      DELIVERY_NOTE: 'תעודות משלוח',
      INVOICE: 'חשבוניות',
      PURCHASE_ORDER: 'הזמנות רכש',
    };

    for (const sample of samples) {
      const data = (sample.groundTruth ?? sample.geminiExtraction) as Record<string, any> | null;
      if (!data) continue;

      const supplierName = data.supplierName?.trim();
      if (!supplierName) continue;

      const existing = supplierMap.get(supplierName) ?? { categories: new Set<string>() };

      if (data.supplierPhone) existing.phone = data.supplierPhone;
      if (data.supplierAddress) existing.address = data.supplierAddress;

      const cat = DOC_TYPE_CATEGORY[sample.documentType];
      if (cat) existing.categories.add(cat);

      supplierMap.set(supplierName, existing);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const [name, info] of supplierMap) {
      try {
        const existing = await this.prisma.refSupplier.findUnique({ where: { name } });
        if (existing) {
          const mergedCategories = new Set([...existing.categories, ...info.categories]);
          await this.prisma.refSupplier.update({
            where: { name },
            data: {
              categories: [...mergedCategories],
              phone: info.phone ?? existing.phone,
              address: info.address ?? existing.address,
            },
          });
          updated++;
        } else {
          await this.prisma.refSupplier.create({
            data: {
              name,
              categories: [...info.categories],
              phone: info.phone ?? null,
              address: info.address ?? null,
            },
          });
          created++;
        }
      } catch (e) {
        skipped++;
        this.logger.warn(`migrate supplier "${name}": ${e}`);
      }
    }

    return {
      samplesScanned: samples.length,
      uniqueSuppliers: supplierMap.size,
      created,
      updated,
      skipped,
    };
  }

  // ─── Migrate products from existing samples ───

  async migrateProductsFromSamples() {
    const samples = await this.prisma.sample.findMany({
      where: {
        OR: [
          { groundTruth: { not: Prisma.DbNull } },
          { geminiExtraction: { not: Prisma.DbNull } },
        ],
      },
      select: {
        groundTruth: true,
        geminiExtraction: true,
      },
    });

    // key = "name|unit" to deduplicate
    const productMap = new Map<string, {
      name: string;
      unit: string;
      prices: number[];
      category: string;
    }>();

    for (const sample of samples) {
      const data = (sample.groundTruth ?? sample.geminiExtraction) as Record<string, any> | null;
      if (!data?.lineItems || !Array.isArray(data.lineItems)) continue;

      for (const item of data.lineItems) {
        const description = item.description?.trim();
        if (!description) continue;

        const unit = item.unit?.trim() || 'יח\'';
        const key = `${description}|${unit}`;

        const existing = productMap.get(key);
        if (existing) {
          if (item.unitPrice && item.unitPrice > 0) {
            existing.prices.push(item.unitPrice);
          }
        } else {
          productMap.set(key, {
            name: description,
            unit,
            prices: item.unitPrice && item.unitPrice > 0 ? [item.unitPrice] : [],
            category: 'מתעודות קיימות',
          });
        }
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const [, info] of productMap) {
      const avgPrice = info.prices.length > 0
        ? Math.round(info.prices.reduce((a, b) => a + b, 0) / info.prices.length * 100) / 100
        : 0;

      try {
        const existing = await this.prisma.refProduct.findFirst({
          where: { name: info.name, category: info.category },
        });

        if (existing) {
          // Update price if we have better data
          if (avgPrice > 0 && existing.avgPrice === 0) {
            await this.prisma.refProduct.update({
              where: { id: existing.id },
              data: { avgPrice },
            });
          }
          updated++;
        } else {
          await this.prisma.refProduct.create({
            data: {
              name: info.name,
              category: info.category,
              unit: info.unit,
              avgPrice,
            },
          });
          created++;
        }
      } catch (e) {
        skipped++;
        this.logger.warn(`migrate product "${info.name}": ${e}`);
      }
    }

    return {
      samplesScanned: samples.length,
      uniqueProducts: productMap.size,
      created,
      updated,
      skipped,
    };
  }

  // ─── Auto-ingest from extraction ───

  async ingestFromExtraction(
    extractionData: Record<string, any>,
    documentType: string,
  ) {
    try {
      await this.ingestSupplier(extractionData, documentType);
      await this.ingestProducts(extractionData);
    } catch (e) {
      this.logger.warn(`ingestFromExtraction failed: ${e}`);
    }
  }

  private async ingestSupplier(data: Record<string, any>, documentType: string) {
    const supplierName = data.supplierName?.trim();
    if (!supplierName) return;

    const DOC_CAT: Record<string, string> = {
      DELIVERY_NOTE: 'תעודות משלוח',
      INVOICE: 'חשבוניות',
      PURCHASE_ORDER: 'הזמנות רכש',
    };
    const cat = DOC_CAT[documentType];

    const existing = await this.prisma.refSupplier.findUnique({ where: { name: supplierName } });

    if (existing) {
      const cats = new Set(existing.categories);
      if (cat) cats.add(cat);
      await this.prisma.refSupplier.update({
        where: { name: supplierName },
        data: {
          categories: [...cats],
          phone: data.supplierPhone?.trim() || existing.phone,
          address: data.supplierAddress?.trim() || existing.address,
        },
      });
    } else {
      await this.prisma.refSupplier.create({
        data: {
          name: supplierName,
          categories: cat ? [cat] : [],
          phone: data.supplierPhone?.trim() || null,
          address: data.supplierAddress?.trim() || null,
        },
      });
      this.logger.log(`Auto-added supplier: ${supplierName}`);
    }
  }

  private async ingestProducts(data: Record<string, any>) {
    if (!data.lineItems || !Array.isArray(data.lineItems)) return;

    for (const item of data.lineItems) {
      const name = item.description?.trim();
      if (!name) continue;

      const unit = item.unit?.trim() || 'יח\'';
      const price = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : 0;
      const category = 'מתעודות קיימות';

      const existing = await this.prisma.refProduct.findFirst({
        where: { name, category },
      });

      if (!existing) {
        try {
          await this.prisma.refProduct.create({
            data: { name, category, unit, avgPrice: price },
          });
        } catch {
          // unique constraint — skip
        }
      }
    }
  }

  // ─── Stats ───

  async stats() {
    const [suppliers, products, cities] = await Promise.all([
      this.prisma.refSupplier.count(),
      this.prisma.refProduct.count(),
      this.prisma.refCity.count(),
    ]);
    return { suppliers, products, cities };
  }
}
