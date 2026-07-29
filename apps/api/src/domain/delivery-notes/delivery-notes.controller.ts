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
import { DeliveryNotesService } from './delivery-notes.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { QueryNotesDto } from './dto/query-notes.dto';
import {
  UpdateNoteDto,
  ApproveNoteDto,
  RejectNoteDto,
} from './dto/update-note.dto';

@Controller('delivery-notes')
@UseGuards(AuthGuard)
export class DeliveryNotesController {
  constructor(private readonly service: DeliveryNotesService) {}

  @Get()
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Query() query: QueryNotesDto,
  ) {
    return this.service.findAll(companyId, query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.findOne(id, companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.service.update(id, dto, companyId);
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: ApproveNoteDto,
  ) {
    return this.service.approve(id, userId, dto.notes, companyId);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: RejectNoteDto,
  ) {
    return this.service.reject(id, dto.notes, companyId);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.delete(id, companyId);
  }

  @Post('reset')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  resetAll(
    @CurrentUser('companyId') companyId: string,
    @Query('deleteFeedback') deleteFeedback?: string,
  ) {
    return this.service.resetAll(companyId, deleteFeedback === 'true');
  }
}
