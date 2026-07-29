import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class EditLineItemDto {
  @IsOptional()
  @IsNumber()
  invoicedQty?: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsString()
  @IsIn([
    'DATA_EXTRACTION_ERROR',
    'PRICE_CORRECTION',
    'QUANTITY_ADJUSTMENT',
    'UNIT_TYPE_CORRECTION',
    'CREDIT_NOTE_APPLIED',
    'OTHER',
  ])
  reason!: string;

  @IsOptional()
  @IsString()
  @IsIn(['po', 'dn', 'invoice'])
  editSource?: 'po' | 'dn' | 'invoice';

  @IsOptional()
  @IsString()
  note?: string;
}
