import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { MessagesService } from '../services/messages.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { ListMessagesDto } from '../dto/list-messages.dto';
import { ListChatsDto } from '../dto/list-chats.dto';
import { ApiResponseDto, ChatDto, MessageDto } from '../dto/response.dto';
import { StartChatDto } from '../dto/start-chat.dto';
import { getUserFromToken } from '../helpers/auth.helper';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('messages')
@Controller('messages')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class MessagesController {
  private readonly logger: LoggerService;

  constructor(
    private readonly messagesService: MessagesService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('MessagesController', configService);
  }

  /**
   * GET /messages/chats
   * Listar chats del usuario autenticado
   */
  @Get('chats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar mis chats',
    description: 'Retorna todos los chats del usuario autenticado, ordenados por último mensaje.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite por página' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean, description: 'Solo chats con mensajes no leídos' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean, description: 'Incluir chats archivados' })
  @ApiResponse({
    status: 200,
    description: 'Lista de chats obtenida exitosamente',
    type: ApiResponseDto,
  })
  async listChats(@Request() req: any, @Query() query: ListChatsDto) {
    const startTime = Date.now();
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.messagesService.listChats(userInfo.userId, query);

      const duration = Date.now() - startTime;
      this.logger.log('Chats listados exitosamente', 'listChats', {
        userId: userInfo.userId,
        count: result.data?.length || 0,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al listar chats', error?.stack, 'listChats', {
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * GET /messages/chats/:chatId
   * Obtener información de un chat específico
   */
  @Get('chats/:chatId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener información de un chat',
    description: 'Retorna información detallada de un chat específico.',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiResponse({
    status: 200,
    description: 'Chat obtenido exitosamente',
    type: ChatDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  async getChat(@Request() req: any, @Param('chatId') chatId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      // Por ahora, obtener el chat desde la lista
      const result = await this.messagesService.listChats(userInfo.userId, { page: 1, limit: 100 });
      const chat = result.data?.find((c) => c.chatId === chatId);

      if (!chat) {
        throw new NotFoundException('Chat no encontrado');
      }

      return {
        success: true,
        data: chat,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error al obtener chat', error?.stack, 'getChat', {
        chatId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /messages/chats/:chatId/messages
   * Obtener mensajes de un chat
   */
  @Get('chats/:chatId/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener mensajes de un chat',
    description: 'Retorna los mensajes de un chat específico, ordenados por fecha (más antiguos primero).',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Cursor para paginación' })
  @ApiResponse({
    status: 200,
    description: 'Mensajes obtenidos exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes acceso a este chat',
  })
  async getChatMessages(
    @Request() req: any,
    @Param('chatId') chatId: string,
    @Query() query: ListMessagesDto,
  ) {
    const startTime = Date.now();
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.messagesService.getChatMessages(chatId, userInfo.userId, query);

      const duration = Date.now() - startTime;
      this.logger.log('Mensajes obtenidos exitosamente', 'getChatMessages', {
        chatId,
        userId: userInfo.userId,
        count: result.data?.length || 0,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al obtener mensajes', error?.stack, 'getChatMessages', {
        chatId,
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * POST /messages/chats/:chatId/messages
   * Enviar un mensaje
   */
  @Post('chats/:chatId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enviar mensaje',
    description: 'Envía un mensaje en un chat. Soporta múltiples tipos: text, paid_image, contract_pdf, etc.',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiResponse({
    status: 201,
    description: 'Mensaje enviado exitosamente',
    type: MessageDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Chat no encontrado',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes acceso a este chat',
  })
  async sendMessage(
    @Request() req: any,
    @Param('chatId') chatId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const startTime = Date.now();
    try {
      const userInfo = await getUserFromToken(req.token);
      
      // Asegurar que el chatId coincida
      createMessageDto.chatId = chatId;
      
      const message = await this.messagesService.sendMessage(userInfo.userId, createMessageDto);

      const duration = Date.now() - startTime;
      this.logger.log('Mensaje enviado exitosamente', 'sendMessage', {
        messageId: message.messageId,
        chatId,
        type: message.type,
        duration: `${duration}ms`,
      });

      // Normalizar contractData y transferData para incluir alias si es necesario
      // contractData ya tiene todos los campos necesarios, incluyendo notes directamente
      let contractData = message.contractData;

      let transferData = message.transferData;
      if (transferData) {
        transferData = {
          ...transferData,
          fromAgency: transferData.fromAgency || transferData.requestingAgencyName,
          toAgency: transferData.toAgency || transferData.currentAgencyName,
          requestedAmount: transferData.requestedAmount || transferData.transferAmount,
          notes: transferData.notes || transferData.transferNotes,
        };
      }

      return {
        success: true,
        data: {
          messageId: message.messageId,
          chatId: message.chatId,
          senderId: message.senderId,
          isFromMe: true,
          type: message.type,
          content: message.content,
          imageUrl: message.imageUrl,
          price: message.price,
          contractData,
          transferData,
          read: message.read,
          createdAt: message.createdAt,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al enviar mensaje', error?.stack, 'sendMessage', {
        chatId,
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * POST /messages/chats/start
   * Iniciar chat con otro usuario
   */
  @Post('chats/start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Iniciar chat con usuario',
    description: 'Crea o obtiene un chat con otro usuario. Si el chat ya existe, lo retorna.',
  })
  @ApiResponse({
    status: 201,
    description: 'Chat iniciado exitosamente',
  })
  async startChat(@Request() req: any, @Body() body: StartChatDto) {
    const startTime = Date.now();
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.messagesService.getChatWithUser(userInfo.userId, body.otherUserId);

      if (!result) {
        throw new NotFoundException('No se pudo crear o obtener el chat');
      }

      const duration = Date.now() - startTime;
      this.logger.log('Chat iniciado exitosamente', 'startChat', {
        userId: userInfo.userId,
        otherUserId: body.otherUserId,
        chatId: result.data?.chatId,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al iniciar chat', error?.stack, 'startChat', {
        otherUserId: body.otherUserId,
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * GET /messages/chats/with/:userId
   * Obtener chat con un usuario específico
   */
  @Get('chats/with/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener chat con usuario',
    description: 'Obtiene o crea un chat con un usuario específico.',
  })
  @ApiParam({ name: 'userId', description: 'ID del otro usuario' })
  @ApiResponse({
    status: 200,
    description: 'Chat obtenido exitosamente',
  })
  async getChatWithUser(@Request() req: any, @Param('userId') otherUserId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      return await this.messagesService.getChatWithUser(userInfo.userId, otherUserId);
    } catch (error: any) {
      this.logger.error('Error al obtener chat con usuario', error?.stack, 'getChatWithUser', {
        otherUserId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /messages/chats/:chatId/archive
   * Archivar chat
   */
  @Put('chats/:chatId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archivar chat',
    description: 'Archiva un chat. Los chats archivados no aparecen en la lista principal.',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiResponse({
    status: 200,
    description: 'Chat archivado exitosamente',
  })
  async archiveChat(@Request() req: any, @Param('chatId') chatId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      return await this.messagesService.archiveChat(chatId, userInfo.userId, true);
    } catch (error: any) {
      this.logger.error('Error al archivar chat', error?.stack, 'archiveChat', {
        chatId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /messages/chats/:chatId/unarchive
   * Desarchivar chat
   */
  @Put('chats/:chatId/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desarchivar chat',
    description: 'Desarchiva un chat. El chat volverá a aparecer en la lista principal.',
  })
  @ApiParam({ name: 'chatId', description: 'ID del chat' })
  @ApiResponse({
    status: 200,
    description: 'Chat desarchivado exitosamente',
  })
  async unarchiveChat(@Request() req: any, @Param('chatId') chatId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      return await this.messagesService.archiveChat(chatId, userInfo.userId, false);
    } catch (error: any) {
      this.logger.error('Error al desarchivar chat', error?.stack, 'unarchiveChat', {
        chatId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /messages/:messageId/read
   * Marcar mensaje como leído
   */
  @Put(':messageId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar mensaje como leído',
    description: 'Marca un mensaje específico como leído y actualiza el contador de no leídos.',
  })
  @ApiParam({ name: 'messageId', description: 'ID del mensaje' })
  @ApiResponse({
    status: 200,
    description: 'Mensaje marcado como leído',
  })
  @ApiResponse({
    status: 404,
    description: 'Mensaje no encontrado',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes acceso a este mensaje',
  })
  async markMessageAsRead(@Request() req: any, @Param('messageId') messageId: string) {
    const startTime = Date.now();
    try {
      const userInfo = await getUserFromToken(req.token);
      
      // Obtener mensaje para obtener chatId
      const message = await this.messagesService.getMessageById(messageId);
      
      if (!message) {
        throw new NotFoundException('Mensaje no encontrado');
      }

      // Verificar acceso al chat
      const chat = await this.messagesService.getChatById(message.chatId);
      
      if (!chat) {
        throw new NotFoundException('Chat no encontrado');
      }

      if (chat.participant1Id !== userInfo.userId && chat.participant2Id !== userInfo.userId) {
        throw new ForbiddenException('No tienes acceso a este mensaje');
      }

      // Marcar como leído
      await this.messagesService.markMessagesAsRead(message.chatId, userInfo.userId, [messageId]);

      const duration = Date.now() - startTime;
      this.logger.log('Mensaje marcado como leído', 'markMessageAsRead', {
        messageId,
        chatId: message.chatId,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        message: 'Mensaje marcado como leído',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al marcar mensaje como leído', error?.stack, 'markMessageAsRead', {
        messageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * DELETE /messages/:messageId
   * Eliminar mensaje
   */
  @Delete(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar mensaje',
    description: 'Elimina un mensaje. Solo puedes eliminar tus propios mensajes.',
  })
  @ApiParam({ name: 'messageId', description: 'ID del mensaje' })
  @ApiResponse({
    status: 200,
    description: 'Mensaje eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Mensaje no encontrado',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo puedes eliminar tus propios mensajes',
  })
  async deleteMessage(@Request() req: any, @Param('messageId') messageId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      return await this.messagesService.deleteMessage(messageId, userInfo.userId);
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al eliminar mensaje', error?.stack, 'deleteMessage', {
        messageId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /messages/chats/:chatId/read
   * Marcar todos los mensajes de un chat como leídos
   */
  @Put('chats/:chatId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '✅ Marcar todos los mensajes del chat como leídos',
    description: `
**¿Para qué sirve?**
Marca todos los mensajes no leídos de un chat específico como leídos y actualiza el contador de no leídos del chat.

**Casos de uso:**
- Usuario abre un chat y quiere marcar todos los mensajes como leídos de una vez
- Limpiar notificaciones de un chat específico
- Actualizar el contador de no leídos del chat a cero

**Restricciones:**
- Solo puedes marcar como leídos los mensajes de chats a los que tienes acceso
- Solo se marcan como leídos los mensajes que NO fueron enviados por ti
- El chat debe existir y el usuario debe ser participante

**Ejemplo de uso:**
\`\`\`
PUT /api/v1/messages/chats/chat_123456/read
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "message": "15 mensajes marcados como leídos exitosamente",
  "data": {
    "chatId": "chat_123456",
    "count": 15
  }
}
\`\`\`
    `.trim(),
  })
  @ApiParam({
    name: 'chatId',
    description: 'ID único del chat',
    example: 'chat_123456',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Todos los mensajes del chat marcados como leídos exitosamente',
    type: ApiResponseDto,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '15 mensaje(s) marcado(s) como leído(s) exitosamente' },
        data: {
          type: 'object',
          properties: {
            chatId: { type: 'string', example: 'chat_123456' },
            count: { type: 'number', example: 15 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ No tienes acceso a este chat',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Chat no encontrado',
  })
  async markAllChatMessagesAsRead(@Request() req: any, @Param('chatId') chatId: string) {
    const startTime = Date.now();
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.messagesService.markAllChatMessagesAsRead(chatId, userInfo.userId);

      const duration = Date.now() - startTime;
      this.logger.log('Todos los mensajes del chat marcados como leídos', 'markAllChatMessagesAsRead', {
        chatId,
        userId: userInfo.userId,
        count: result.count,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        message: result.count > 0 
          ? `${result.count} mensaje(s) marcado(s) como leído(s) exitosamente`
          : 'No hay mensajes no leídos en este chat',
        data: {
          chatId,
          count: result.count,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al marcar todos los mensajes como leídos', error?.stack, 'markAllChatMessagesAsRead', {
        chatId,
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * GET /messages/unread-count
   * Obtener contador de mensajes no leídos
   */
  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener contador de no leídos',
    description: 'Retorna el total de mensajes no leídos del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contador obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            unreadCount: { type: 'number' },
          },
        },
      },
    },
  })
  async getUnreadCount(@Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const count = await this.messagesService.getUnreadCount(userInfo.userId);

      return {
        success: true,
        data: {
          unreadCount: count,
        },
      };
    } catch (error: any) {
      this.logger.error('Error al obtener contador de no leídos', error?.stack, 'getUnreadCount', {
        error: error.message,
      });
      throw error;
    }
  }
}

