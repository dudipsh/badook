import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { MailerModule } from './infrastructure/mailer/mailer.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { AuthModule } from './identity/auth/auth.module';
import { UsersModule } from './identity/users/users.module';
import { DeliveryNotesModule } from './domain/delivery-notes/delivery-notes.module';
import { SuppliersModule } from './domain/suppliers/suppliers.module';
import { ProjectsModule } from './domain/projects/projects.module';
import { PurchaseOrdersModule } from './domain/purchase-orders/purchase-orders.module';
import { InvoicesModule } from './domain/invoices/invoices.module';
import { MatchingModule } from './domain/matching/matching.module';
import { OcrModule } from './intelligence/ocr/ocr.module';
import { TrainingModule } from './intelligence/training/training.module';
import { PromptsModule } from './intelligence/prompts/prompts.module';
import { AgentsModule } from './intelligence/agents/agents.module';
import { ChatModule } from './intelligence/chat/chat.module';
import { AiManagementModule } from './intelligence/ai-management/ai-management.module';
import { GmailModule } from './integrations/gmail/gmail.module';
import { OutlookModule } from './integrations/outlook/outlook.module';
import { MailboxesModule } from './integrations/mailboxes/mailboxes.module';
import { WhatsAppModule } from './integrations/whatsapp/whatsapp.module';
import { DashboardModule } from './support/dashboard/dashboard.module';
import { UploadModule } from './support/upload/upload.module';
import { AdminModule } from './support/admin/admin.module';
import { FilesModule } from './support/files/files.module';
import { TestingModule } from './support/testing/testing.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    StorageModule,
    JobsModule,
    QueueModule.forRoot(),
    PrismaModule,
    MailerModule,
    AuthModule,
    DeliveryNotesModule,
    SuppliersModule,
    ProjectsModule,
    DashboardModule,
    UploadModule,
    OcrModule,
    GmailModule,
    OutlookModule,
    MailboxesModule,
    PurchaseOrdersModule,
    InvoicesModule,
    MatchingModule,
    AdminModule,
    FilesModule,
    TrainingModule,
    PromptsModule,
    AgentsModule,
    ChatModule,
    AiManagementModule,
    UsersModule,
    WhatsAppModule,
    TestingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
