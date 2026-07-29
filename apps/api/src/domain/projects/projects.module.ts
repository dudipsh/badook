import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectBackfillService } from './project-backfill.service';
import { ProjectDashboardService } from './project-dashboard.service';
import { ProjectStatsService } from './project-stats.service';
import { VendorLineItemsService } from './vendor-line-items.service';
import { ProjectDocumentsService } from './project-documents.service';
import { LineItemEditService } from './line-item-edit.service';
import { AuthModule } from '../../identity/auth/auth.module';
import { MatchingModule } from '../matching/matching.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';

@Module({
  imports: [AuthModule, MatchingModule, SuppliersModule, StorageModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectBackfillService,
    ProjectDashboardService,
    ProjectStatsService,
    VendorLineItemsService,
    ProjectDocumentsService,
    LineItemEditService,
  ],
  exports: [ProjectsService, ProjectBackfillService],
})
export class ProjectsModule {}
