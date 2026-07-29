import { Injectable, Logger } from '@nestjs/common';
import { LineItemMatcherService } from './line-item-matcher.service';
import { UnitConversionService } from './unit-conversion.service';
import { Discrepancy, LineItemPairing } from './matching.types';
import { normalizeUnit } from './unit-utils';

@Injectable()
export class DiscrepancyService {
  private readonly logger = new Logger(DiscrepancyService.name);

  constructor(
    private readonly lineItemMatcher: LineItemMatcherService,
    private readonly unitConversion: UnitConversionService,
  ) {}

  async computeDiscrepancies(
    po: any | null,
    dns: any[],
    invs: any[],
    companyId: string,
  ): Promise<{ discrepancies: Discrepancy[]; pairings: LineItemPairing[] }> {
    const discStart = Date.now();
    const discrepancies: Discrepancy[] = [];

    // Learn unit conversions from DN quantityBreakdowns
    for (const dn of dns) {
      for (const item of (dn?.lineItems || [])) {
        if (Array.isArray(item.quantityBreakdown) && item.quantityBreakdown.length >= 2) {
          await this.unitConversion.learnFromBreakdown(
            companyId,
            item.catalogNumber || null,
            item.description || '',
            item.quantityBreakdown,
            Number(item.quantity) || 0,
            item.unit || '',
          );
        }
      }
    }

    this.checkTotalAmounts(po, dns, invs, discrepancies);

    const poItems: any[] = po?.lineItems || [];
    const dnItems: any[] = dns.flatMap((dn) => dn?.lineItems || []);
    const invItems: any[] = invs
      .flatMap((inv, invIdx) =>
        (inv?.lineItems || []).map((item: any) => ({ ...item, __sourceInvIdx: invIdx })),
      )
      .filter((item) => item.totalPrice !== 0 && item.totalPrice !== '0' && item.totalPrice !== '0.00');

    const { itemMap, pairings } = await this.lineItemMatcher.matchItems(poItems, dnItems, invItems, companyId);
    this.logger.log(`⏱️ [DISC TIMING] matchItems: ${Date.now() - discStart}ms (PO=${poItems.length}, DN=${dnItems.length}, INV=${invItems.length})`);

    await this.checkLineItems(itemMap, po, dns, invs, discrepancies, companyId);
    this.checkMissingDocuments(po, dns, invs, discrepancies);
    this.checkMultiDocumentSummary(po, dns, invs, discrepancies);

    this.logger.log(`⏱️ [DISC TIMING] TOTAL computeDiscrepancies: ${Date.now() - discStart}ms`);
    return { discrepancies, pairings };
  }

  private checkTotalAmounts(po: any | null, dns: any[], invs: any[], discrepancies: Discrepancy[]) {
    const poAmount = po?.totalAmount ? Number(po.totalAmount) : null;
    const dnAmount = dns.length > 0
      ? dns.reduce((sum, dn) => sum + (dn?.totalAmount ? Number(dn.totalAmount) : 0), 0) || null
      : null;
    const invAmount = invs.length > 0
      ? invs.reduce((sum, inv) => sum + (inv?.totalAmount ? Number(inv.totalAmount) : 0), 0) || null
      : null;

    const amounts = [poAmount, dnAmount, invAmount].filter((a): a is number => a !== null);
    if (amounts.length < 2) return;

    const maxAmt = Math.max(...amounts);
    const minAmt = Math.min(...amounts);
    if (maxAmt <= 0) return;

    const diffPct = ((maxAmt - minAmt) / maxAmt) * 100;
    if (diffPct > 1) {
      discrepancies.push({
        field: 'totalAmount',
        description: `total_amount_diff:${diffPct.toFixed(1)}%`,
        poValue: poAmount?.toFixed(2) ?? null,
        dnValue: dnAmount?.toFixed(2) ?? null,
        invValue: invAmount?.toFixed(2) ?? null,
        severity: diffPct > 10 ? 'CRITICAL' : 'WARNING',
      });
    }
  }

  private async checkLineItems(
    itemMap: Map<string, { po?: any; dn?: any; inv?: any }>,
    po: any | null,
    dns: any[],
    invs: any[],
    discrepancies: Discrepancy[],
    companyId: string,
  ) {
    for (const [key, items] of itemMap) {
      const desc = items.po?.description || items.dn?.description || items.inv?.description || key;

      if (po && !items.po) {
        discrepancies.push({
          field: `lineItem:${key}`, description: `${desc} - not_found_in_po`,
          poValue: null, dnValue: items.dn ? String(Number(items.dn.quantity)) : null,
          invValue: items.inv ? String(Number(items.inv.quantity)) : null, severity: 'CRITICAL',
        });
      }
      if (dns.length > 0 && !items.dn) {
        discrepancies.push({
          field: `lineItem:${key}`, description: `${desc} - not_found_in_dn`,
          poValue: items.po ? String(Number(items.po.quantity)) : null, dnValue: null,
          invValue: items.inv ? String(Number(items.inv.quantity)) : null, severity: 'CRITICAL',
        });
      }
      if (invs.length > 0 && !items.inv) {
        discrepancies.push({
          field: `lineItem:${key}`, description: `${desc} - not_found_in_invoice`,
          poValue: items.po ? String(Number(items.po.quantity)) : null,
          dnValue: items.dn ? String(Number(items.dn.quantity)) : null, invValue: null, severity: 'WARNING',
        });
      }

      await this.checkQuantities(key, items, desc, discrepancies, companyId);
      this.checkPrices(key, items, desc, discrepancies);
    }
  }

  private async checkQuantities(
    key: string,
    items: { po?: any; dn?: any; inv?: any },
    desc: string,
    discrepancies: Discrepancy[],
    companyId: string,
  ) {
    const poUnit = normalizeUnit(items.po?.unit);
    const dnUnit = normalizeUnit(items.dn?.unit);
    const invUnit = normalizeUnit(items.inv?.unit);

    let poQty = items.po ? Number(items.po.quantity) : null;
    let dnQty = items.dn ? Number(items.dn.quantity) : null;
    let invQty = items.inv ? Number(items.inv.quantity) : null;

    // If DN unit differs from PO unit, try to convert —
    // BUT if raw quantities already match (within 5%), the unit label is likely wrong.
    // Skip conversion and just flag the unit naming difference.
    if (poQty != null && dnQty != null && poUnit && dnUnit && poUnit !== dnUnit) {
      const maxQtyVal = Math.max(poQty, dnQty);
      const rawDiff = maxQtyVal > 0 ? Math.abs(poQty - dnQty) / maxQtyVal : 0;
      if (rawDiff <= 0.05) {
        // Quantities match — unit label mismatch only
        discrepancies.push({
          field: `lineItemUnit:${key}`,
          description: `${desc} - unit_mismatch: PO(${items.po.unit}) ≠ DN(${items.dn.unit}), qty_equal`,
          poValue: `${poQty} ${items.po.unit || ''}`,
          dnValue: `${dnQty} ${items.dn.unit || ''}`,
          invValue: invQty != null ? `${invQty} ${items.inv?.unit || ''}` : null,
          severity: 'INFO',
        });
        // Don't convert — use raw quantities for comparison below
      } else {
        // Quantities differ AND units differ — try conversion
        dnQty = await this.tryConvertDnQty(items, poUnit, dnUnit, dnQty, poQty, desc, discrepancies, key, invQty, companyId);
        if (dnQty === null) return; // conversion failed, already flagged
      }
    }

    // Similarly handle invoice unit conversion if needed
    if (poQty != null && invQty != null && poUnit && invUnit && poUnit !== invUnit) {
      const rawDiff = Math.abs(poQty - invQty) / Math.max(poQty, invQty);
      if (rawDiff > 0.05) {
        const converted = await this.unitConversion.convert(
          companyId, items.inv?.catalogNumber || items.po?.catalogNumber || null,
          desc, invUnit, poUnit, invQty,
        );
        if (converted) invQty = converted.quantity;
      }
    }

    // Existing comparison logic with (possibly converted) quantities
    const qtys = [poQty, dnQty, invQty].filter((q): q is number => q !== null);
    if (qtys.length < 2) return;
    const maxQty = Math.max(...qtys);
    const minQty = Math.min(...qtys);
    if (maxQty === minQty) return;

    const diffPct = maxQty > 0 ? ((maxQty - minQty) / maxQty) * 100 : 0;
    discrepancies.push({
      field: `lineItemQty:${key}`,
      description: `${desc} - qty_diff`,
      poValue: items.po ? String(poQty) : null,
      dnValue: items.dn ? String(dnQty) : null,
      invValue: items.inv ? String(invQty) : null,
      severity: diffPct > 10 ? 'CRITICAL' : 'WARNING',
    });
  }

  /** Try to convert DN quantity to PO unit. Returns converted qty or null if failed (already flagged). */
  private async tryConvertDnQty(
    items: { po?: any; dn?: any; inv?: any },
    poUnit: string, dnUnit: string, dnQty: number, poQty: number,
    desc: string, discrepancies: Discrepancy[], key: string,
    invQty: number | null, companyId: string,
  ): Promise<number | null> {
    // Try quantityBreakdown first
    if (Array.isArray(items.dn.quantityBreakdown)) {
      const bdMatch = items.dn.quantityBreakdown.find(
        (c: any) => normalizeUnit(c.unit) === poUnit,
      );
      if (bdMatch) return Number(bdMatch.value) || dnQty;
    }
    // Try conversion service
    const converted = await this.unitConversion.convert(
      companyId,
      items.dn.catalogNumber || items.po?.catalogNumber || null,
      desc, dnUnit, poUnit, dnQty,
    );
    if (converted) return converted.quantity;

    // Can't convert — flag unit mismatch
    discrepancies.push({
      field: `lineItemUnit:${key}`,
      description: `${desc} - unit_mismatch: PO(${items.po.unit}) ≠ DN(${items.dn.unit})`,
      poValue: `${poQty} ${items.po.unit || ''}`,
      dnValue: `${Number(items.dn.quantity)} ${items.dn.unit || ''}`,
      invValue: invQty != null ? `${invQty} ${items.inv?.unit || ''}` : null,
      severity: 'WARNING',
    });
    return null;
  }

  private checkPrices(key: string, items: { po?: any; dn?: any; inv?: any }, desc: string, discrepancies: Discrepancy[]) {
    const prices = [
      items.po?.unitPrice ? Number(items.po.unitPrice) : null,
      items.dn?.unitPrice ? Number(items.dn.unitPrice) : null,
      items.inv?.unitPrice ? Number(items.inv.unitPrice) : null,
    ].filter((p): p is number => p !== null);

    if (prices.length < 2) return;
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    if (maxPrice === minPrice || maxPrice <= 0) return;

    const diffPct = ((maxPrice - minPrice) / maxPrice) * 100;
    if (diffPct <= 1) return;

    discrepancies.push({
      field: `lineItemPrice:${key}`, description: `${desc} - unit_price_diff`,
      poValue: items.po?.unitPrice ? Number(items.po.unitPrice).toFixed(2) : null,
      dnValue: items.dn?.unitPrice ? Number(items.dn.unitPrice).toFixed(2) : null,
      invValue: items.inv?.unitPrice ? Number(items.inv.unitPrice).toFixed(2) : null,
      severity: diffPct > 10 ? 'CRITICAL' : 'WARNING',
    });
  }

  private checkMissingDocuments(po: any | null, dns: any[], invs: any[], discrepancies: Discrepancy[]) {
    if (!po) {
      discrepancies.push({
        field: 'missingDocument', description: 'missing_po',
        poValue: null, dnValue: dns.length > 0 ? 'exists' : null,
        invValue: invs.length > 0 ? 'exists' : null, severity: 'WARNING',
      });
    }
    if (dns.length === 0) {
      discrepancies.push({
        field: 'missingDocument', description: 'missing_dn',
        poValue: po ? 'exists' : null, dnValue: null,
        invValue: invs.length > 0 ? 'exists' : null, severity: 'WARNING',
      });
    }
    if (invs.length === 0) {
      discrepancies.push({
        field: 'missingDocument', description: 'missing_invoice',
        poValue: po ? 'exists' : null, dnValue: dns.length > 0 ? 'exists' : null,
        invValue: null, severity: 'INFO',
      });
    }
  }

  private checkMultiDocumentSummary(
    po: any | null,
    dns: any[],
    invs: any[],
    discrepancies: Discrepancy[],
  ) {
    // Flag when multiple invoices exist for one PO
    if (invs.length > 1) {
      const totalInvoiced = invs.reduce(
        (sum, inv) => sum + (inv?.totalAmount ? Number(inv.totalAmount) : 0), 0,
      );
      discrepancies.push({
        field: 'multiInvoice',
        description: `multi_invoice:${invs.length}:${totalInvoiced.toFixed(2)}`,
        poValue: null,
        dnValue: null,
        invValue: String(invs.length),
        severity: 'INFO',
      });
    }

    // Check cumulative delivery vs PO
    const poTotal = po?.totalAmount ? Number(po.totalAmount) : null;
    if (poTotal && poTotal > 0) {
      const totalDelivered = dns.length > 0
        ? dns.reduce((sum, dn) => sum + (dn?.totalAmount ? Number(dn.totalAmount) : 0), 0)
        : null;
      const totalInvoiced = invs.length > 0
        ? invs.reduce((sum, inv) => sum + (inv?.totalAmount ? Number(inv.totalAmount) : 0), 0)
        : null;

      if (totalDelivered != null && totalDelivered < poTotal * 0.95) {
        const pct = ((poTotal - totalDelivered) / poTotal * 100).toFixed(1);
        discrepancies.push({
          field: 'partialDelivery',
          description: `partial_delivery:${pct}%`,
          poValue: poTotal.toFixed(2),
          dnValue: totalDelivered.toFixed(2),
          invValue: totalInvoiced?.toFixed(2) ?? null,
          severity: 'WARNING',
        });
      }

      if (totalInvoiced != null && totalInvoiced > poTotal * 1.05) {
        const pct = ((totalInvoiced - poTotal) / poTotal * 100).toFixed(1);
        discrepancies.push({
          field: 'invoiceExceedsPO',
          description: `invoice_exceeds_po:${pct}%`,
          poValue: poTotal.toFixed(2),
          dnValue: totalDelivered?.toFixed(2) ?? null,
          invValue: totalInvoiced.toFixed(2),
          severity: 'CRITICAL',
        });
      }
    }
  }
}
