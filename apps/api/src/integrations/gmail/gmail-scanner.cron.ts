import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { GmailScannerService } from './gmail-scanner.service';
import { OutlookScannerService } from '../outlook/outlook-scanner.service';

@Injectable()
export class GmailScannerCron {
  private readonly logger = new Logger(GmailScannerCron.name);
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: GmailScannerService,
    private readonly outlook: OutlookScannerService,
  ) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.logger.log(`Mailbox cron scanning ${enabled ? 'enabled' : 'disabled'}`);
  }

  isEnabled() {
    return this.enabled;
  }

  @Cron('*/5 * * * *')
  async handleScan() {
    if (!this.enabled) return;
    this.logger.log('Round-robin mailbox scan starting...');

    const companies = await this.prisma.company.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const company of companies) {
      try {
        const next = await this.prisma.companyIntegration.findFirst({
          where: { companyId: company.id, status: 'CONNECTED' },
          orderBy: [{ lastScannedAt: { sort: 'asc', nulls: 'first' } }],
        });
        if (!next) continue;

        if (next.type === 'GMAIL') {
          await this.gmail.scanInbox(company.id, next.id);
        } else if (next.type === 'OUTLOOK') {
          await this.outlook.scanInbox(company.id, next.id);
        }
      } catch (err) {
        this.logger.error(`Scan failed for company ${company.id}`, err);
      }
    }
  }
}
