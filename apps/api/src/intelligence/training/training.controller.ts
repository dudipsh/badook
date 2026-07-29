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
import { TrainingService } from './training.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryDiscrepanciesDto } from './dto/query-discrepancies.dto';
import {
  PairingActionDto,
  EditMappingDto,
  CreateFeedbackDto,
  UpdateFeedbackDto,
  QueryFeedbackDto,
} from './dto/pairing-action.dto';

@Controller('training')
@UseGuards(AuthGuard)
export class TrainingController {
  constructor(private readonly service: TrainingService) {}

  @Get('discrepancies')
  getDiscrepancies(
    @CurrentUser('companyId') companyId: string,
    @Query() query: QueryDiscrepanciesDto,
  ) {
    return this.service.getDiscrepancies(
      companyId,
      query.page || 1,
      query.limit || 20,
      query.search,
      query.projectId,
      query.severity,
    );
  }

  @Post('discrepancies/:matchId/approve')
  approvePairing(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('matchId') matchId: string,
    @Body() dto: PairingActionDto,
  ) {
    return this.service.approvePairing(companyId, userId, matchId, dto.pairingIndex);
  }

  @Post('discrepancies/:matchId/reject')
  rejectPairing(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('matchId') matchId: string,
    @Body() dto: PairingActionDto,
  ) {
    return this.service.rejectPairing(companyId, userId, matchId, dto.pairingIndex);
  }

  @Post('discrepancies/:matchId/edit-mapping')
  editMapping(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('matchId') matchId: string,
    @Body() dto: EditMappingDto,
  ) {
    return this.service.editMapping(
      companyId,
      userId,
      matchId,
      dto.pairingIndex,
      dto.descriptionA,
      dto.descriptionB,
      dto.catalogNumberA,
      dto.catalogNumberB,
    );
  }

  @Get('feedback')
  getFeedback(
    @CurrentUser('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('feedbackType') feedbackType?: string,
  ) {
    return this.service.getFeedback(
      companyId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
      feedbackType,
    );
  }

  @Post('feedback')
  createFeedback(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.service.createFeedback(
      companyId,
      userId,
      dto.descriptionA,
      dto.descriptionB,
      dto.sourceDocType,
      dto.targetDocType,
      dto.catalogNumberA,
      dto.catalogNumberB,
    );
  }

  @Patch('feedback/:id')
  updateFeedback(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.service.updateFeedback(id, companyId, dto);
  }

  @Delete('feedback/:id')
  deleteFeedback(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteFeedback(id, companyId);
  }
}
