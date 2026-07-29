import { Module } from '@nestjs/common';
import { MailboxesService } from './mailboxes.service';
import { MailboxesController } from './mailboxes.controller';
import { AuthModule } from '../../identity/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [MailboxesService],
  controllers: [MailboxesController],
  exports: [MailboxesService],
})
export class MailboxesModule {}
