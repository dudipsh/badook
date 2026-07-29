import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/create-supplier.dto';
import { AutoMatchService } from '../matching/auto-match.service';
import { isTransliterationMatch } from '../matching/supplier-matcher';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoMatch: AutoMatchService,
  ) {}

  findAll(companyId: string) {
    return this.prisma.supplier.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, companyId?: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (companyId && supplier.companyId !== companyId) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  create(companyId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: { ...dto, companyId },
    });
  }

  async update(id: string, dto: UpdateSupplierDto, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async delete(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.supplier.delete({ where: { id } });
  }

  async findOrCreate(
    name: string,
    companyId: string,
    details?: { phone?: string; email?: string; address?: string; businessId?: string },
  ) {
    const trimmed = name.trim();
    if (!trimmed) return null;

    // 1. Exact name match (case-insensitive)
    let existing = await this.prisma.supplier.findFirst({
      where: {
        name: { equals: trimmed, mode: 'insensitive' },
        companyId,
      },
    });

    // 2. BusinessId match
    if (!existing && details?.businessId) {
      existing = await this.prisma.supplier.findFirst({
        where: { businessId: details.businessId, companyId },
      });
      if (existing) this.logger.log(`Matched supplier "${trimmed}" to "${existing.name}" by businessId ${details.businessId}`);
    }

    // 3. Phone match (last 7 digits)
    if (!existing && details?.phone) {
      const normalizedPhone = details.phone.replace(/[\s\-()]/g, '');
      if (normalizedPhone.length >= 7) {
        existing = await this.prisma.supplier.findFirst({
          where: { phone: { contains: normalizedPhone.slice(-7) }, companyId },
        });
        if (existing) this.logger.log(`Matched supplier "${trimmed}" to "${existing.name}" by phone`);
      }
    }

    // 4. Fuzzy name match — load all suppliers and compare with word overlap
    if (!existing) {
      const allSuppliers = await this.prisma.supplier.findMany({
        where: { companyId },
        select: { id: true, name: true, phone: true, email: true, address: true, businessId: true, contactName: true, companyId: true, aliases: true, createdAt: true, updatedAt: true },
      });
      const newNorm = this.normalizeName(trimmed);
      for (const sup of allSuppliers) {
        const supNorm = this.normalizeName(sup.name);
        if (this.isFuzzyMatch(newNorm, supNorm)) {
          existing = sup;
          this.logger.log(`Fuzzy matched supplier "${trimmed}" to "${sup.name}"`);
          break;
        }
      }

      // 4b. Alias match — check if the name matches any supplier alias
      if (!existing) {
        for (const sup of allSuppliers) {
          for (const alias of sup.aliases || []) {
            if (this.normalizeName(alias) === newNorm) {
              existing = sup;
              this.logger.log(`Alias matched supplier "${trimmed}" to "${sup.name}" via alias "${alias}"`);
              break;
            }
          }
          if (existing) break;
        }
      }

      // 4c. Transliteration match — Hebrew ↔ English phonetic comparison
      if (!existing) {
        for (const sup of allSuppliers) {
          if (isTransliterationMatch(trimmed, sup.name)) {
            existing = sup;
            this.logger.log(`Transliteration matched supplier "${trimmed}" to "${sup.name}"`);
            break;
          }
          // Also check against aliases
          for (const alias of sup.aliases || []) {
            if (isTransliterationMatch(trimmed, alias)) {
              existing = sup;
              this.logger.log(`Transliteration matched supplier "${trimmed}" to "${sup.name}" via alias "${alias}"`);
              break;
            }
          }
          if (existing) break;
        }
      }
    }

    // 5. Address match — same address often means same supplier even with different names
    if (!existing && details?.address) {
      const addressWords = details.address.replace(/[,.\-"']/g, '').split(/\s+/).filter((w) => w.length > 2);
      if (addressWords.length >= 2) {
        const allSuppliers = await this.prisma.supplier.findMany({
          where: { companyId, address: { not: null } },
          select: { id: true, name: true, phone: true, email: true, address: true, businessId: true, contactName: true, companyId: true, aliases: true, createdAt: true, updatedAt: true },
        });
        for (const sup of allSuppliers) {
          if (!sup.address) continue;
          const supWords = sup.address.replace(/[,.\-"']/g, '').split(/\s+/).filter((w) => w.length > 2);
          const common = addressWords.filter((w) => supWords.some((sw) => sw.includes(w) || w.includes(sw)));
          if (common.length >= 2 && common.length / Math.min(addressWords.length, supWords.length) >= 0.5) {
            existing = sup;
            this.logger.log(`Matched supplier "${trimmed}" to "${sup.name}" by address`);
            break;
          }
        }
      }
    }

    if (existing) {
      const updates: Record<string, any> = {};
      if (details?.phone && !existing.phone) updates.phone = details.phone;
      if (details?.email && !existing.email) updates.email = details.email;
      if (details?.address && !existing.address) updates.address = details.address;
      if (details?.businessId && !existing.businessId) updates.businessId = details.businessId;

      // Auto-add alias when matched by non-name method (businessId, phone, fuzzy, address)
      const namesDiffer = this.normalizeName(trimmed) !== this.normalizeName(existing.name);
      if (namesDiffer) {
        const existingAliases = existing.aliases || [];
        const alreadyAliased = existingAliases.some(
          (a: string) => this.normalizeName(a) === this.normalizeName(trimmed),
        );
        if (!alreadyAliased) {
          updates.aliases = [...existingAliases, trimmed];
          this.logger.log(`Auto-added alias "${trimmed}" to supplier "${existing.name}"`);
        }
      }

      if (Object.keys(updates).length > 0) {
        return this.prisma.supplier.update({
          where: { id: existing.id },
          data: updates,
        });
      }
      return existing;
    }

    try {
      return await this.prisma.supplier.create({
        data: {
          name: trimmed,
          companyId,
          phone: details?.phone ?? undefined,
          email: details?.email ?? undefined,
          address: details?.address ?? undefined,
          businessId: details?.businessId ?? undefined,
        },
      });
    } catch (err: any) {
      // Handle race condition: if another concurrent request created the supplier, find and return it
      if (err?.code === 'P2002') {
        this.logger.warn(`Supplier "${trimmed}" unique constraint — finding existing record`);
        const retry = await this.prisma.supplier.findFirst({
          where: { name: { equals: trimmed, mode: 'insensitive' }, companyId },
        });
        if (retry) return retry;
      }
      throw err;
    }
  }

  /** Normalize supplier name for fuzzy comparison */
  private normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[.\-,'"]/g, '')
      .replace(/\s*(בע"?מ|ltd|inc|llc)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Check if two normalized names likely refer to the same company */
  private isFuzzyMatch(n1: string, n2: string): boolean {
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;

    const words1 = n1.split(/\s+/).filter((w) => w.length > 2);
    const words2 = n2.split(/\s+/).filter((w) => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return false;

    const common = words1.filter((w) => words2.some((w2) => w === w2 || w.includes(w2) || w2.includes(w)));
    const overlapRatio = common.length / Math.min(words1.length, words2.length);
    return overlapRatio >= 0.6;
  }

  /**
   * Merge sourceId into targetId: move all documents, enrich target, delete source.
   */
  async merge(targetId: string, sourceId: string, companyId?: string) {
    const target = await this.findOne(targetId, companyId);
    const source = await this.findOne(sourceId, companyId);

    if (target.companyId !== source.companyId) {
      throw new NotFoundException('Suppliers must belong to the same company');
    }

    const [poCount, dnCount, invCount] = await Promise.all([
      this.prisma.purchaseOrder.updateMany({ where: { supplierId: sourceId }, data: { supplierId: targetId } }),
      this.prisma.deliveryNote.updateMany({ where: { supplierId: sourceId }, data: { supplierId: targetId } }),
      this.prisma.invoice.updateMany({ where: { supplierId: sourceId }, data: { supplierId: targetId } }),
    ]);

    const updates: Record<string, string | string[]> = {};
    if (source.phone && !target.phone) updates.phone = source.phone;
    if (source.email && !target.email) updates.email = source.email;
    if (source.address && !target.address) updates.address = source.address;
    if (source.businessId && !target.businessId) updates.businessId = source.businessId;
    if (source.contactName && !target.contactName) updates.contactName = source.contactName;

    // Add source name and aliases to target's alias list
    const newAliases = new Set([
      ...(target.aliases || []),
      source.name,
      ...(source.aliases || []),
    ]);
    newAliases.delete(target.name);
    updates.aliases = [...newAliases];

    await this.prisma.supplier.update({ where: { id: targetId }, data: updates });

    // Delete ThreeWayMatch records that referenced documents from either supplier
    // so auto-match can recreate them correctly
    const affectedMatches = await this.prisma.threeWayMatch.findMany({
      where: {
        companyId: target.companyId,
        OR: [
          { purchaseOrder: { supplierId: targetId } },
          { deliveryNotes: { some: { supplierId: targetId } } },
          { invoices: { some: { supplierId: targetId } } },
        ],
      },
      select: { id: true },
    });

    if (affectedMatches.length > 0) {
      // Nullify feedback FKs so matches can be deleted
      await this.prisma.itemMatchFeedback.updateMany({
        where: { threeWayMatchId: { in: affectedMatches.map((m) => m.id) } },
        data: { threeWayMatchId: null },
      });
      await this.prisma.threeWayMatch.deleteMany({
        where: { id: { in: affectedMatches.map((m) => m.id) } },
      });
    }

    await this.prisma.supplier.delete({ where: { id: sourceId } });

    // Re-run auto-matching so the merged documents get properly linked
    let matchResult = { matchesCreated: 0, matchIds: [] as string[] };
    try {
      matchResult = await this.autoMatch.run(target.companyId);
      this.logger.log(`Post-merge auto-match: created ${matchResult.matchesCreated} matches`);
    } catch (err) {
      this.logger.error(`Post-merge auto-match failed`, err);
    }

    return {
      moved: { purchaseOrders: poCount.count, deliveryNotes: dnCount.count, invoices: invCount.count },
      deletedSupplier: source.name,
      matchesDeleted: affectedMatches.length,
      matchesCreated: matchResult.matchesCreated,
    };
  }

  async addAlias(supplierId: string, aliasName: string): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return;
    const aliases = new Set(supplier.aliases || []);
    aliases.add(aliasName.trim());
    aliases.delete(supplier.name);
    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { aliases: [...aliases] },
    });
  }

  async getDeliveryNotes(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    return this.prisma.deliveryNote.findMany({
      where: { supplierId: id },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
