import { ChatDocType } from '../../services/documents.service';

/**
 * Document-type → badge (label key + classes). Colors follow the brand mapping:
 * PO=primary, DC=secondary, INV=accent. Reuses the existing
 * INV/DC/PO i18n labels so the abbreviations stay consistent across the chat.
 */
export const DOC_TYPE_BADGE: Record<ChatDocType, { labelKey: string; cls: string }> = {
  purchase_order: { labelKey: 'cards.itemSupply.badgePo', cls: 'bg-primary/10 text-primary' },
  delivery_note: { labelKey: 'cards.itemSupply.badgeDelivery', cls: 'bg-secondary/10 text-secondary' },
  invoice: { labelKey: 'cards.itemSupply.badgeInvoice', cls: 'bg-accent/10 text-accent' },
};
