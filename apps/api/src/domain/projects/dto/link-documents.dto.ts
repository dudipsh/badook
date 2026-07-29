import { IsArray, IsString, IsIn } from 'class-validator';

export class DocumentRef {
  @IsString() id!: string;
  @IsIn(['deliveryNote', 'purchaseOrder', 'invoice']) type!: 'deliveryNote' | 'purchaseOrder' | 'invoice';
}

export class LinkDocumentsDto {
  @IsArray() documents!: DocumentRef[];
}
