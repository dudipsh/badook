import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { AuthModule } from '../../identity/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
