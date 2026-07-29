import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  Req,
  Logger,
  UseGuards,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CreateAllowedPhoneDto, UpdateAllowedPhoneDto } from './dto/manage-allowed-phone.dto';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly webhook: WhatsAppWebhookService,
    private readonly config: ConfigService,
  ) {}

  // -- Twilio Webhook Endpoint --

  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Req() req: Request, @Body() body: any) {
    this.logger.log(
      `Twilio webhook POST received. MessageSid=${body.MessageSid}, From=${body.From}`,
    );

    // Verify Twilio signature (production only — tunnels change the URL which breaks validation)
    const isProduction = this.config.get('nodeEnv') === 'production';

    if (isProduction) {
      const signature = req.headers['x-twilio-signature'] as string;
      if (!signature) {
        this.logger.warn('Webhook rejected: missing Twilio signature in production');
        throw new ForbiddenException('Signature verification required');
      }
      // Use X-Forwarded-Proto if behind reverse proxy (Railway, Render, etc.)
      const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol;
      const webhookUrl = `${proto}://${req.get('host')}${req.originalUrl}`;
      this.logger.log(`Verifying signature with URL: ${webhookUrl}`);
      if (!this.webhook.verifySignature(webhookUrl, body, signature)) {
        this.logger.warn(`Twilio webhook signature verification failed for URL: ${webhookUrl}`);
        throw new ForbiddenException('Invalid signature');
      }
      this.logger.log('Twilio webhook signature verified OK');
    }

    // Process async
    this.webhook.processWebhookPayload(body).catch((err) => {
      this.logger.error(`Webhook processing failed: ${err?.message || err}`, (err as Error)?.stack);
    });

    // Twilio expects TwiML or empty 200
    return '';
  }

  @SkipThrottle()
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      provider: 'twilio',
      webhookUrl: '/api/whatsapp/webhook',
    };
  }

  // -- Settings (Super Admin) --

  @Get('settings')
  @UseGuards(AuthGuard)
  getSettings() {
    return this.whatsapp.getSettings();
  }

  @Get('logs')
  @UseGuards(AuthGuard)
  getLogs(
    @CurrentUser('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.whatsapp.getLogs(companyId, limit ? parseInt(limit, 10) : 50);
  }

  @Post('test')
  @UseGuards(AuthGuard, SuperAdminGuard)
  async sendTestMessage(@Body() body: { phoneNumber?: string }) {
    const settings = this.whatsapp.getSettings();
    if (!settings.connected) {
      throw new ForbiddenException('WhatsApp is not configured');
    }
    const recipient = body.phoneNumber?.replace(/\D/g, '');
    if (!recipient || recipient.length < 10 || recipient.length > 15) {
      throw new ForbiddenException('Invalid phone number');
    }
    await this.whatsapp.sendReply(`+${recipient}`, 'Test message — connection active!');
    return { success: true };
  }

  // -- Allowlist Endpoints --

  @Get('allowed-phones')
  @UseGuards(AuthGuard)
  getAllowedPhones(@CurrentUser('companyId') companyId: string) {
    return this.whatsapp.getAllowedPhones(companyId);
  }

  @Post('allowed-phones')
  @UseGuards(AuthGuard)
  addAllowedPhone(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateAllowedPhoneDto,
  ) {
    return this.whatsapp.addAllowedPhone(companyId, dto);
  }

  @Patch('allowed-phones/:id')
  @UseGuards(AuthGuard)
  updateAllowedPhone(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAllowedPhoneDto,
  ) {
    return this.whatsapp.updateAllowedPhone(companyId, id, dto);
  }

  @Delete('allowed-phones/:id')
  @UseGuards(AuthGuard)
  removeAllowedPhone(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.whatsapp.removeAllowedPhone(companyId, id);
  }

  // -- Global Status (Super Admin) --

  @Get('global-status')
  @UseGuards(AuthGuard, SuperAdminGuard)
  getGlobalStatus() {
    return this.whatsapp.getSettings();
  }
}
