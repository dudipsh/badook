import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateConversationDto, SendMessageDto } from './chat.types';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get('conversations')
  list(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.listConversations(companyId, userId);
  }

  @Post('conversations')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.createConversation(companyId, userId, dto.title);
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.deleteConversation(companyId, userId, id);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.listMessages(companyId, userId, id);
  }

  @Post('conversations/:id/messages')
  stream(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const subscription = this.service
      .streamReply(companyId, userId, id, dto.content, dto.attachmentIds ?? [], dto.scope)
      .subscribe({
        next: (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
        error: () => {
          res.write(
            `data: ${JSON.stringify({ type: 'error', message: 'שגיאה ביצירת תשובה. נסה שוב.' })}\n\n`,
          );
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

    res.on('close', () => {
      subscription.unsubscribe();
    });
  }

  @Post('attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadAttachment(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.createAttachment(companyId, userId, file);
  }

  @Get('attachments/:id/raw')
  async getAttachmentRaw(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mimeType } = await this.service.getAttachmentBuffer(companyId, userId, id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    return this.service.transcribeAudio(file);
  }
}
