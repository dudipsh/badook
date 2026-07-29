import { Controller, Get, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { MailboxesService } from './mailboxes.service';
import { UpdateMailboxDto } from './dto/update-mailbox.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('mailboxes')
@UseGuards(AuthGuard)
export class MailboxesController {
  constructor(private readonly mailboxes: MailboxesService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.mailboxes.listForCompany(companyId);
  }

  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMailboxDto,
  ) {
    return this.mailboxes.update(companyId, id, dto);
  }

  @Delete(':id')
  async disconnect(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    await this.mailboxes.disconnect(companyId, id);
    return { success: true };
  }
}
