import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { AutoMatchService } from './auto-match.service';
import { DiscrepancyService } from './discrepancy.service';
import { LineItemMatcherService } from './line-item-matcher.service';
import { AiMatcherService } from './ai-matcher.service';
import { SupplierMatchService } from './supplier-match.service';
import { OrphanConsolidatorService } from './orphan-consolidator.service';
import { MatchPostprocessorService } from './match-postprocessor.service';
import { SemanticMatchingService } from './semantic-matching.service';
import { UnitConversionService } from './unit-conversion.service';
import { PriceFingerprintService } from './price-fingerprint.service';
import { AuthModule } from '../../identity/auth/auth.module';
import { ApiUsageLoggerModule } from '../../common/services/api-usage-logger.module';
import { PromptsModule } from '../../intelligence/prompts/prompts.module';

@Module({
  imports: [AuthModule, ConfigModule, ApiUsageLoggerModule, PromptsModule],
  controllers: [MatchingController],
  providers: [
    MatchingService,
    AutoMatchService,
    DiscrepancyService,
    LineItemMatcherService,
    AiMatcherService,
    SupplierMatchService,
    OrphanConsolidatorService,
    MatchPostprocessorService,
    SemanticMatchingService,
    UnitConversionService,
    PriceFingerprintService,
  ],
  exports: [MatchingService, AutoMatchService, PriceFingerprintService],
})
export class MatchingModule {}
