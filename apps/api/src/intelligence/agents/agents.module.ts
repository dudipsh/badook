import { Module } from '@nestjs/common';
import { IntakeAgent } from './intake.agent';
import { ExtractionAgent } from './extraction.agent';
import { MatchingAgent } from './matching.agent';
import { VerificationAgent } from './verification.agent';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { DocumentSaverService } from './document-saver.service';
import { OcrModule } from '../ocr/ocr.module';
import { PromptsModule } from '../prompts/prompts.module';
import { DeliveryNotesModule } from '../../domain/delivery-notes/delivery-notes.module';
import { PurchaseOrdersModule } from '../../domain/purchase-orders/purchase-orders.module';
import { InvoicesModule } from '../../domain/invoices/invoices.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ProjectsModule } from '../../domain/projects/projects.module';
import { SuppliersModule } from '../../domain/suppliers/suppliers.module';
import { MatchingModule } from '../../domain/matching/matching.module';

@Module({
  imports: [
    OcrModule,
    PromptsModule,
    DeliveryNotesModule,
    PurchaseOrdersModule,
    InvoicesModule,
    PrismaModule,
    ProjectsModule,
    SuppliersModule,
    MatchingModule,
  ],
  providers: [
    IntakeAgent,
    ExtractionAgent,
    MatchingAgent,
    VerificationAgent,
    DocumentSaverService,
    AgentOrchestratorService,
  ],
  exports: [AgentOrchestratorService],
})
export class AgentsModule {}
