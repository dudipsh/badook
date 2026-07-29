import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { MatchingService } from './matching.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { QueryMatchesDto } from './dto/query-matches.dto';
import { ResolveMatchDto } from './dto/resolve-match.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { UNIT_ALIASES } from './unit-utils';

@Controller('matching')
@UseGuards(AuthGuard)
export class MatchingController {
  constructor(private readonly service: MatchingService) {}

  @Get()
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Query() query: QueryMatchesDto,
  ) {
    return this.service.findAll(companyId, query);
  }

  @Get('feedback')
  getFeedback(@CurrentUser('companyId') companyId: string) {
    return this.service.getFeedback(companyId);
  }

  @Delete('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  deleteAll(
    @CurrentUser('companyId') companyId: string,
    @Query('deleteFeedback') deleteFeedback?: string,
  ) {
    return this.service.deleteAll(companyId, deleteFeedback === 'true');
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.findOne(id, companyId);
  }

  @Post('auto')
  autoMatch(
    @CurrentUser('companyId') companyId: string,
    @Query('projectId') projectId?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.service.autoMatch(companyId, { projectId, supplierId });
  }

  @Post('feedback')
  submitFeedback(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.service.submitFeedback(companyId, userId, dto);
  }

  @Get('units/list')
  getUnits() {
    const grouped = new Map<string, string[]>();
    for (const [alias, canonical] of Object.entries(UNIT_ALIASES)) {
      if (!grouped.has(canonical)) grouped.set(canonical, []);
      if (alias !== canonical) grouped.get(canonical)!.push(alias);
    }
    return [...grouped.entries()].map(([canonical, aliases]) => ({ canonical, aliases }));
  }

  @Delete('document/:documentId')
  removeDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('companyId') companyId: string,
    @Query('type') documentType: 'deliveryNote' | 'invoice',
  ) {
    return this.service.removeDocument(companyId, documentId, documentType);
  }

  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: ResolveMatchDto,
  ) {
    return this.service.resolve(id, userId, companyId, dto.notes);
  }
}
