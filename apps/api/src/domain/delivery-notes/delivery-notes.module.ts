import { Module } from '@nestjs/common';
import { DeliveryNotesController } from './delivery-notes.controller';
import { DeliveryNotesService } from './delivery-notes.service';
import { AuthModule } from '../../identity/auth/auth.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AuthModule, SuppliersModule, ProjectsModule],
  controllers: [DeliveryNotesController],
  providers: [DeliveryNotesService],
  exports: [DeliveryNotesService],
})
export class DeliveryNotesModule {}
