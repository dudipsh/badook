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
import { InvoicesService } from './invoices.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Get()
  findAll(
    @CurrentUser('companyId') companyId: string,
    @Query() query: QueryInvoicesDto,
  ) {
    return this.service.findAll(companyId, query);
  }

  @Post()
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.create({ ...dto, companyId, createdById: userId });
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
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.service.update(id, dto, companyId);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.delete(id, companyId);
  }
}
