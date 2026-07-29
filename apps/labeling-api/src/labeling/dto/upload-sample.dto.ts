import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadSampleDto {
  @IsOptional()
  @IsEnum(['DELIVERY_NOTE', 'INVOICE', 'PURCHASE_ORDER'])
  documentType?: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER';

  @IsOptional()
  @IsString()
  replaceId?: string;
}
