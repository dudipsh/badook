import type { ThreeWayMatch, LineItemPairing } from '../services/projects.service';
import { formatCurrency } from './currencyUtils';
import i18n from '../i18n';

export type FinancialStatusCode = 'OVERPAID' | 'UNDER_DELIVERED' | 'OK' | 'INCOMPLETE';

export interface QuantityShortfall {
  description: string;
  poQuantity: number;
  dnQuantity: number;
  shortfall: number;
}

export interface FinancialStatus {
  code: FinancialStatusCode;
  label: string;
  description: string;
  details: {
    invoiceTotal: number | null;
    poTotal: number | null;
    dnTotal: number | null;
    amountDifference: number | null;
    quantityShortfalls: QuantityShortfall[];
  };
}

export const FINANCIAL_STATUS_DISPLAY: Record<FinancialStatusCode, {
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeBg: string;
  badgeText: string;
}> = {
  OVERPAID: {
    bgClass: 'bg-error/10',
    textClass: 'text-error',
    borderClass: 'border-error/30',
    badgeBg: 'bg-error/15',
    badgeText: 'text-error',
  },
  UNDER_DELIVERED: {
    bgClass: 'bg-warning/10',
    textClass: 'text-warning',
    borderClass: 'border-warning/30',
    badgeBg: 'bg-warning/15',
    badgeText: 'text-warning',
  },
  OK: {
    bgClass: 'bg-success/10',
    textClass: 'text-success',
    borderClass: 'border-success/30',
    badgeBg: 'bg-success/15',
    badgeText: 'text-success',
  },
  INCOMPLETE: {
    bgClass: 'bg-base-200',
    textClass: 'text-base-content/60',
    borderClass: 'border-base-300',
    badgeBg: 'bg-base-300',
    badgeText: 'text-base-content/60',
  },
};

export interface CumulativeFulfillment {
  poTotal: number | null;
  totalDelivered: number | null;
  totalInvoiced: number | null;
  invoiceCount: number;
  dnCount: number;
  deliveryPercentage: number | null;
  invoicePercentage: number | null;
}

export const computeCumulativeFulfillment = (match: ThreeWayMatch): CumulativeFulfillment => {
  const po = match?.purchaseOrder;
  const dns = match?.deliveryNotes || [];
  const invs = match?.invoices || [];

  const poTotal = po?.totalAmount ? Number(po.totalAmount) : null;
  const totalDelivered = dns.length > 0
    ? dns.reduce((sum: number, dn: any) => sum + (dn?.totalAmount ? Number(dn.totalAmount) : 0), 0) || null
    : null;
  const totalInvoiced = invs.length > 0
    ? invs.reduce((sum: number, inv: any) => sum + (inv?.totalAmount ? Number(inv.totalAmount) : 0), 0) || null
    : null;

  return {
    poTotal,
    totalDelivered,
    totalInvoiced,
    invoiceCount: invs.length,
    dnCount: dns.length,
    deliveryPercentage: poTotal && totalDelivered != null ? Math.round((totalDelivered / poTotal) * 100) : null,
    invoicePercentage: poTotal && totalInvoiced != null ? Math.round((totalInvoiced / poTotal) * 100) : null,
  };
};

function computeQuantityShortfalls(match: ThreeWayMatch): QuantityShortfall[] {
  const po = match.purchaseOrder;
  const dns = match.deliveryNotes || [];
  if (!po?.lineItems?.length || dns.length === 0) return [];

  const pairings = (match.lineItemPairings || []) as LineItemPairing[];
  const shortfalls: QuantityShortfall[] = [];

  if (pairings.length > 0) {
    for (const pairing of pairings) {
      if (pairing.po && pairing.dn) {
        const poQty = Number(pairing.po.quantity) || 0;
        const dnQty = Number(pairing.dn.quantity) || 0;
        if (dnQty < poQty) {
          shortfalls.push({
            description: pairing.po.description,
            poQuantity: poQty,
            dnQuantity: dnQty,
            shortfall: poQty - dnQty,
          });
        }
      } else if (pairing.po && !pairing.dn) {
        const poQty = Number(pairing.po.quantity) || 0;
        if (poQty > 0) {
          shortfalls.push({
            description: pairing.po.description,
            poQuantity: poQty,
            dnQuantity: 0,
            shortfall: poQty,
          });
        }
      }
    }
  }

  return shortfalls;
}

export type InvoiceVsDnCode = 'MATCH' | 'OVERPAID' | 'UNDERPAID' | 'NO_DATA';

export interface InvoiceVsDnStatus {
  code: InvoiceVsDnCode;
  label: string;
  description: string;
  difference: number | null; // positive = paid more than received
}

export function computeInvoiceVsDn(match: ThreeWayMatch): InvoiceVsDnStatus {
  const invs = match.invoices || [];
  const dns = match.deliveryNotes || [];

  if (invs.length === 0 || dns.length === 0) {
    return { code: 'NO_DATA', label: '', description: '', difference: null };
  }

  const invTotal = invs.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const dnTotal = dns.reduce((sum, dn) => sum + Number(dn.totalAmount || 0), 0);

  // If DN has no total amount, try summing from subtotal
  if (dnTotal === 0) {
    return { code: 'NO_DATA', label: '', description: '', difference: null };
  }

  const diff = invTotal - dnTotal;

  if (Math.abs(diff) <= 1) {
    return {
      code: 'MATCH',
      label: i18n.t('projects:financialStatus.invoiceMatchesDelivery'),
      description: i18n.t('projects:financialStatus.invoiceMatchesDescription', { invTotal: formatCurrency(invTotal), dnTotal: formatCurrency(dnTotal) }),
      difference: 0,
    };
  }

  if (diff > 1) {
    return {
      code: 'OVERPAID',
      label: i18n.t('projects:financialStatus.overpaid', { amount: formatCurrency(diff) }),
      description: i18n.t('projects:financialStatus.overpaidInvVsDn', { invTotal: formatCurrency(invTotal), dnTotal: formatCurrency(dnTotal) }),
      difference: diff,
    };
  }

  return {
    code: 'UNDERPAID',
    label: i18n.t('projects:financialStatus.underpaid', { amount: formatCurrency(Math.abs(diff)) }),
    description: i18n.t('projects:financialStatus.underpaidInvVsDn', { invTotal: formatCurrency(invTotal), dnTotal: formatCurrency(dnTotal) }),
    difference: diff,
  };
}

export function computeFinancialStatus(match: ThreeWayMatch): FinancialStatus {
  const po = match.purchaseOrder;
  const invs = match.invoices || [];
  const dns = match.deliveryNotes || [];

  const poTotal = po?.totalAmount != null ? Number(po.totalAmount) : null;
  const invTotal = invs.length > 0
    ? invs.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
    : null;
  const dnTotal = dns.length > 0
    ? dns.reduce((sum, dn) => sum + Number(dn.totalAmount || 0), 0)
    : null;

  const amountDifference = invTotal != null && poTotal != null
    ? Number(invTotal) - Number(poTotal)
    : null;

  const quantityShortfalls = computeQuantityShortfalls(match);

  const details = { invoiceTotal: invTotal, poTotal, dnTotal, amountDifference, quantityShortfalls };

  if (!po || invs.length === 0) {
    return {
      code: 'INCOMPLETE',
      label: i18n.t('projects:financialStatus.missingInfo'),
      description: i18n.t('projects:financialStatus.missingInfoDescription'),
      details,
    };
  }

  if (amountDifference != null && amountDifference > 1) {
    return {
      code: 'OVERPAID',
      label: i18n.t('projects:financialStatus.overpaidLabel'),
      description: i18n.t('projects:financialStatus.overpaidDescription', { amount: formatCurrency(amountDifference) }),
      details,
    };
  }

  if (quantityShortfalls.length > 0) {
    return {
      code: 'UNDER_DELIVERED',
      label: i18n.t('projects:financialStatus.partialDelivery'),
      description: i18n.t('projects:financialStatus.partialDeliveryDescription'),
      details,
    };
  }

  return {
    code: 'OK',
    label: i18n.t('projects:financialStatus.allGood'),
    description: i18n.t('projects:financialStatus.allGoodDescription'),
    details,
  };
}
