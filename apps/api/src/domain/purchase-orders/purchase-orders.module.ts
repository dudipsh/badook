import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PoPdfGenerator } from './po-pdf-generator';
import { AuthModule } from '../../identity/auth/auth.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { OcrModule } from '../../intelligence/ocr/ocr.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [AuthModule, SuppliersModule, OcrModule, StorageModule, MatchingModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PoPdfGenerator],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
