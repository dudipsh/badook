import { Controller, Get, Post, Param, Query, Res, Logger, UseGuards, ConflictException } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { OutlookService } from './outlook.service';
import { OutlookScannerService } from './outlook-scanner.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('outlook')
export class OutlookController {
  private readonly logger = new Logger(OutlookController.name);

  constructor(
    private readonly outlook: OutlookService,
    private readonly scanner: OutlookScannerService,
    private readonly config: ConfigService,
  ) {}

  @Get('oauth/url')
  @UseGuards(AuthGuard)
  getAuthorizationUrl(
    @CurrentUser('companyId') companyId: string,
    @Query('slot') slotStr?: string,
  ) {
    const slot = slotStr ? parseInt(slotStr, 10) : 1;
    return this.outlook.getAuthorizationUrl(companyId, slot);
  }

  @Get('oauth/callback')
  async handleOAuthCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = (this.config.get('cors.origin') || 'http://localhost:5173').split(',')[0];
    try {
      await this.outlook.handleOAuthCallback(code, state);
      res.redirect(`${frontendUrl}/settings/email?provider=outlook&connected=true`);
    } catch (error) {
      this.logger.error(`Outlook OAuth callback failed: ${(error as Error)?.message}`);
      res.redirect(`${frontendUrl}/settings/email?provider=outlook&error=oauth_failed`);
    }
  }

  @Post('trigger/:mailboxId')
  @UseGuards(AuthGuard)
  async triggerScan(
    @CurrentUser('companyId') companyId: string,
    @Param('mailboxId') mailboxId: string,
  ) {
    if (await this.outlook.isScanning(companyId)) {
      throw new ConflictException('סריקה כבר פעילה. עצור ונסה שוב.');
    }
    this.scanner.scanInbox(companyId, mailboxId).catch((err) => {
      this.logger.error(`Outlook scan failed: ${err?.message || err}`);
    });
    return { message: 'Scan started' };
  }

  @Get('scan-status')
  @UseGuards(AuthGuard)
  async getScanStatus(@CurrentUser('companyId') companyId: string) {
    return { scanning: await this.outlook.isScanning(companyId) };
  }

  @Get('logs')
  @UseGuards(AuthGuard)
  getLogs(@CurrentUser('companyId') companyId: string, @Query('limit') limit?: string) {
    return this.outlook.getScanLogs(companyId, limit ? parseInt(limit, 10) : 50);
  }

  @Post('logs/:id/retry')
  @UseGuards(AuthGuard)
  retryScanLog(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.scanner.retryScanLog(companyId, id);
  }

  @Post('attachments/:id/retry')
  @UseGuards(AuthGuard)
  retryAttachment(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.scanner.retryAttachment(companyId, id);
  }

  @Post('logs/:id/dismiss')
  @UseGuards(AuthGuard)
  dismissScanLog(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.outlook.dismissScanLog(companyId, id);
  }
}
