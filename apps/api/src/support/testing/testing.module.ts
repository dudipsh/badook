import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';
import { TestingService } from './testing.service';
import { TestRunnerService } from './test-runner.service';
import { MockGeneratorService } from './mock-generator.service';
import { AuthModule } from '../../identity/auth/auth.module';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AgentsModule } from '../../intelligence/agents/agents.module';
import { MatchingModule } from '../../domain/matching/matching.module';

@Module({
  imports: [AuthModule, PrismaModule, AgentsModule, MatchingModule],
  controllers: [TestingController],
  providers: [
    TestingService,
    TestRunnerService,
    MockGeneratorService,
    SuperAdminGuard,
  ],
})
export class TestingModule {}
