import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { AuthModule } from '../../identity/auth/auth.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [AuthModule, MatchingModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
