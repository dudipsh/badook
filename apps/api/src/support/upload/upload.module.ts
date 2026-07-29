import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { DeliveryNotesModule } from '../../domain/delivery-notes/delivery-notes.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { AgentsModule } from '../../intelligence/agents/agents.module';
import { ProjectsModule } from '../../domain/projects/projects.module';
import { MatchingModule } from '../../domain/matching/matching.module';

@Module({
  imports: [DeliveryNotesModule, AuthModule, AgentsModule, ProjectsModule, MatchingModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
