import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePOLineItemDto {
  @IsString() description!: string;
  @IsOptional() @IsString() catalogNumber?: string;
  @IsNumber() quantity!: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsNumber() totalPrice?: number;
  @IsOptional() @IsNumber() discountPercent?: number;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsString() expectedDeliveryDate?: string;
}

export class CreatePODto {
  @IsString() poNumber!: string;
  @IsString() supplierName!: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() orderDate?: string;
  @IsOptional() @IsString() expectedDelivery?: string;
  @IsOptional() @IsNumber() totalAmount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() paymentTerms?: string;

  // Vendor details
  @IsOptional() @IsString() vendorAddress?: string;
  @IsOptional() @IsString() vatNumber?: string;
  @IsOptional() @IsString() withholdingTax?: string;

  // Delivery details
  @IsOptional() @IsString() siteContact?: string;
  @IsOptional() @IsString() sitePhone?: string;
  @IsOptional() @IsString() deliveryNotes?: string;

  @IsOptional() @IsString() originalFileUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePOLineItemDto)
  lineItems?: CreatePOLineItemDto[];
}
