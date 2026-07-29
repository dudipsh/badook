import { IsString, IsOptional, IsBoolean, IsIn, IsArray } from 'class-validator';

export class CreateProjectDto {
  @IsString() name!: string;
  @IsOptional() @IsString() address?: string;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isArchived?: boolean;
}

export class MergeProjectDto {
  @IsString() sourceProjectId!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) addressesToInclude?: string[];
}

export class CreateFromDocumentDto {
  @IsString() documentId!: string;
  @IsString() @IsIn(['deliveryNote', 'purchaseOrder', 'invoice']) documentType!: 'deliveryNote' | 'purchaseOrder' | 'invoice';
  @IsOptional() @IsString() name?: string;
}
