import { Controller, Get, Patch, Post, Delete, Param, Body, Query, Res, Logger, UseGuards, ConflictException } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { GmailService } from './gmail.service';
import { GmailScannerService } from './gmail-scanner.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateOcrProviderDto } from './dto/update-ocr-provider.dto';
import { UpdateOcrAutoFixesDto } from './dto/update-ocr-auto-fixes.dto';
import { AddBlockedRuleDto } from './dto/blocked-email-rule.dto';

@Controller('gmail')
export class GmailController {
  private readonly logger = new Logger(GmailController.name);

  constructor(
    private readonly gmail: GmailService,
    private readonly scanner: GmailScannerService,
    private readonly config: ConfigService,
  ) {}

  @Get('oauth/url')
  @UseGuards(AuthGuard)
  getAuthorizationUrl(
    @CurrentUser('companyId') companyId: string,
    @Query('slot') slotStr?: string,
  ) {
    const slot = slotStr ? parseInt(slotStr, 10) : 1;
    return this.gmail.getAuthorizationUrl(companyId, slot);
  }

  @Get('oauth/callback')
  async handleOAuthCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = (this.config.get('cors.origin') || 'http://localhost:5173').split(',')[0];
    try {
      await this.gmail.handleOAuthCallback(code, state);
      res.redirect(`${frontendUrl}/settings/email?connected=true`);
    } catch {
      res.redirect(`${frontendUrl}/settings/email?error=oauth_failed`);
    }
  }

  @Post('trigger/:mailboxId')
  @UseGuards(AuthGuard)
  async triggerScan(
    @CurrentUser('companyId') companyId: string,
    @Param('mailboxId') mailboxId: string,
  ) {
    if (await this.gmail.isScanning(companyId)) {
      throw new ConflictException('סריקה כבר פעילה. עצור ונסה שוב.');
    }
    this.scanner.scanInbox(companyId, mailboxId).catch((err) => {
      this.logger.error(`Scan failed: ${err?.message || err}`);
    });
    return { message: 'Scan started' };
  }

  @Get('scan-status')
  @UseGuards(AuthGuard)
  async getScanStatus(@CurrentUser('companyId') companyId: string) {
    return { scanning: await this.gmail.isScanning(companyId) };
  }

  @Get('local-folders')
  @UseGuards(AuthGuard)
  getLocalFolders() {
    return this.gmail.listLocalFolders();
  }

  @Post('local-scan')
  @UseGuards(AuthGuard)
  triggerLocalScan(@CurrentUser('companyId') companyId: string, @Body() body: { folders: string[] }) {
    this.scanner.scanLocalFolders(body.folders, companyId).catch((err) => {
      this.logger.error(`Local scan failed: ${err?.message || err}`);
    });
    return { message: 'Local scan started' };
  }

  @Get('logs')
  @UseGuards(AuthGuard)
  getLogs(@CurrentUser('companyId') companyId: string, @Query('limit') limit?: string) {
    return this.gmail.getScanLogs(companyId, limit ? parseInt(limit, 10) : 50);
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
    return this.gmail.dismissScanLog(companyId, id);
  }

  @Get('ocr-provider')
  @UseGuards(AuthGuard)
  getOcrProvider(@CurrentUser('companyId') companyId: string) {
    return this.gmail.getOcrProvider(companyId);
  }

  @Patch('ocr-provider')
  @UseGuards(AuthGuard)
  updateOcrProvider(@CurrentUser('companyId') companyId: string, @Body() dto: UpdateOcrProviderDto) {
    return this.gmail.updateOcrProvider(companyId, dto.provider);
  }

  @Get('ocr-auto-fixes')
  @UseGuards(AuthGuard)
  getOcrAutoFixes(@CurrentUser('companyId') companyId: string) {
    return this.gmail.getOcrAutoFixesEnabled(companyId);
  }

  @Patch('ocr-auto-fixes')
  @UseGuards(AuthGuard)
  updateOcrAutoFixes(@CurrentUser('companyId') companyId: string, @Body() dto: UpdateOcrAutoFixesDto) {
    return this.gmail.updateOcrAutoFixes(companyId, dto.enabled);
  }

  @Get('blocked-rules')
  @UseGuards(AuthGuard)
  getBlockedRules(@CurrentUser('companyId') companyId: string) {
    return this.gmail.getBlockedRules(companyId);
  }

  @Post('blocked-rules')
  @UseGuards(AuthGuard)
  addBlockedRule(@CurrentUser('companyId') companyId: string, @Body() dto: AddBlockedRuleDto) {
    return this.gmail.addBlockedRule(companyId, dto.type, dto.pattern);
  }

  @Delete('blocked-rules/:index')
  @UseGuards(AuthGuard)
  removeBlockedRule(@CurrentUser('companyId') companyId: string, @Param('index') index: string) {
    return this.gmail.removeBlockedRule(companyId, parseInt(index, 10));
  }
}
