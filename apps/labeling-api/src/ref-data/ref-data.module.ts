import { Module, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { RefDataController } from './ref-data.controller';
import { RefDataService } from './ref-data.service';
import { PrismaService } from '../common/prisma.service';
import { RefDataSeeder } from './ref-data.seeder';

@Module({
  controllers: [RefDataController],
  providers: [RefDataService, PrismaService, RefDataSeeder],
  exports: [RefDataService],
})
export class RefDataModule {}
