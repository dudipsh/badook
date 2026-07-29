import { Injectable, Logger } from '@nestjs/common';

/**
 * Mailer stub. Login is OAuth-only, so newly created users no longer get a
 * password — instead they should receive an invite email telling them to sign
 * in with Google / Microsoft 365.
 *
 * TODO(Phase 2): wire a real provider (e.g. nodemailer/SES/SendGrid) and an
 * email template. For now this only logs so the call sites are already in place.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendInvite(email: string, name: string, role: string): Promise<void> {
    this.logger.log(
      `[invite-stub] Would send sign-in invite to ${name} <${email}> (role: ${role}). ` +
        `User can log in via Google / Microsoft 365 with this email.`,
    );
  }
}
