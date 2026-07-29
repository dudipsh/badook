import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth/auth.module';
import { JobsService } from './jobs.service';
import { JobsGateway } from './jobs.gateway';
import { JobsController } from './jobs.controller';
import { ScanLogger } from './scan-logger.service';

@Global()
@Module({
  imports: [AuthModule],
  providers: [JobsService, JobsGateway, ScanLogger],
  controllers: [JobsController],
  exports: [JobsService, JobsGateway, ScanLogger],
})
export class JobsModule {}
