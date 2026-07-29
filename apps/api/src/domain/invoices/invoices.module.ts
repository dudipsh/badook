import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { AuthModule } from '../../identity/auth/auth.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';

@Module({
  imports: [AuthModule, SuppliersModule, StorageModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
