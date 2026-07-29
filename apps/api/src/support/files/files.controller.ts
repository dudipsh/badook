import { Controller, Get, Query, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from './files.service';

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly service: FilesService) {}

  private assertCompanyFile(filePath: string, companyId: string) {
    if (!filePath || !filePath.startsWith(`companies/${companyId}/`)) {
      throw new ForbiddenException('Access denied');
    }
  }

  @Get('info')
  getFileInfo(
    @Query('path') filePath: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    this.assertCompanyFile(filePath, companyId);
    return this.service.getFileInfo(filePath);
  }

  @Get('thumbnail')
  async getThumbnail(
    @Query('path') filePath: string,
    @Query('page') page: string,
    @CurrentUser('companyId') companyId: string,
    @Res() res: Response,
  ) {
    this.assertCompanyFile(filePath, companyId);
    const buffer = await this.service.getThumbnail(filePath, parseInt(page || '0', 10));
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    res.send(buffer);
  }

  @Get('page')
  async getPage(
    @Query('path') filePath: string,
    @Query('page') page: string,
    @CurrentUser('companyId') companyId: string,
    @Res() res: Response,
  ) {
    this.assertCompanyFile(filePath, companyId);
    const buffer = await this.service.getPage(filePath, parseInt(page || '0', 10));
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    res.send(buffer);
  }

  @Get('download')
  async downloadFile(
    @Query('path') filePath: string,
    @CurrentUser('companyId') companyId: string,
    @Res() res: Response,
  ) {
    this.assertCompanyFile(filePath, companyId);
    const { buffer, filename, contentType } = await this.service.getRawFile(filePath);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(buffer);
  }
}
