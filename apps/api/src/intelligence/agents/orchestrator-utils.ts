import * as fs from 'fs';
import type { ExtractionResult } from './agent.types';
import type { DocumentType, ParsedLineItemBase } from '../ocr/ocr.types';

/** Type guard for Prisma unique-constraint violation errors (code P2002) */
export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}

/** Debug helper: write extraction state to file for pipeline tracing */
export function debugDumpExtraction(stage: string, result: ExtractionResult) {
  try {
    const items: ParsedLineItemBase[] = result.parsedData?.lineItems || [];
    const summary = items.map((it, i) =>
      `  [${i}] ${(it.description || '').slice(0, 40)} | qty=${it.quantity} | price=${it.unitPrice} | total=${it.totalPrice}`,
    ).join('\n');
    const line = `\n=== ${stage} (${new Date().toISOString()}) ===\ntype=${result.documentType} | vendor=${result.supplierName} | confidence=${result.confidence} | items=${items.length}\n${summary}\n`;
    fs.appendFileSync('/tmp/pipeline-debug.log', line);
  } catch { /* ignore */ }
}

/** Map subtypes to their processing type (same as IntakeAgent) */
export const TYPE_MAP: Partial<Record<string, DocumentType>> = {
  order_confirmation: 'purchase_order',
  credit_note: 'delivery_note',
};
