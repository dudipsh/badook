import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatToolsService } from './chat-tools.service';
import { ChatItemToolsService } from './chat-item-tools.service';
import { AiManagementModule } from '../ai-management/ai-management.module';

@Module({
  imports: [AuthModule, AiManagementModule],
  controllers: [ChatController],
  providers: [ChatService, ChatToolsService, ChatItemToolsService],
  exports: [ChatService],
})
export class ChatModule {}
