import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { DeliveryNoteStatus } from '@prisma/client';

export class UpdateNoteDto {
  @IsOptional() @IsString() noteNumber?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() deliveryDate?: string;
  @IsOptional() @IsNumber() totalAmount?: number;
  @IsOptional() @IsNumber() vatAmount?: number;
  @IsOptional() @IsEnum(DeliveryNoteStatus) status?: DeliveryNoteStatus;
  @IsOptional() @IsString() notes?: string;
}

export class ApproveNoteDto {
  @IsOptional() @IsString() notes?: string;
}

export class RejectNoteDto {
  @IsString() notes!: string;
}
