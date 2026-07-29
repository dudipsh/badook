import { IsEnum } from 'class-validator';

export class UpdateDocumentTypeDto {
  @IsEnum(['DELIVERY_NOTE', 'INVOICE', 'PURCHASE_ORDER'])
  documentType!: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER';
}
