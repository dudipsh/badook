import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ImportSampleDto {
  @IsOptional()
  @IsEnum(['DELIVERY_NOTE', 'INVOICE', 'PURCHASE_ORDER'])
  documentType?: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER';

  @IsString()
  groundTruth!: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;
}
