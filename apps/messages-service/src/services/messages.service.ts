import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { v4 as uuidv4 } from 'uuid';
import { ChatRecord, MessageRecord, generateChatId, getParticipantNumber } from './database-schema.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { ListMessagesDto } from '../dto/list-messages.dto';
import { ListChatsDto } from '../dto/list-chats.dto';
import { LoggerService } from '../common/logger/logger.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NotificationClient } from '@bravas/shared';

@Injectable()
export class MessagesService {
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;
  private readonly logger: LoggerService;
  private readonly chatsTable: string;
  private readonly messagesTable: string;

  private readonly paymentServiceUrl: string;
  private readonly userServiceUrl: string;
  private readonly notificationServiceUrl: string;
  private readonly notificationClient: NotificationClient;

  constructor(
    private configService: ConfigService,
    private httpService?: HttpService,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    this.logger = LoggerService.create('MessagesService', configService);
    
    const projectName = process.env.PROJECT_NAME || 'bravas';
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
    this.chatsTable = `${projectName}-chats-${environment}`;
    this.messagesTable = `${projectName}-messages-${environment}`;
    
    // URLs de servicios (para integración)
    this.paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003/api/v1';
    this.userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006/api/v1';
    
    // Cliente de notificaciones
    this.notificationClient = new NotificationClient(this.notificationServiceUrl);
  }

  /**
   * Obtener o crear un chat entre dos usuarios
   */
  async getOrCreateChat(userId1: string, userId2: string): Promise<ChatRecord> {
    if (userId1 === userId2) {
      throw new BadRequestException('No puedes crear un chat contigo mismo');
    }

    const chatId = generateChatId(userId1, userId2);
    const sorted = [userId1, userId2].sort();
    const participant1Id = sorted[0];
    const participant2Id = sorted[1];

    try {
      // Intentar obtener chat existente
      const getResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.chatsTable,
          Key: { chatId },
        }),
      );

      if (getResponse.Item) {
        return getResponse.Item as ChatRecord;
      }

      // Crear nuevo chat
      const now = Date.now();
      const chat: ChatRecord = {
        chatId,
        createdAt: new Date().toISOString(),
        participant1Id,
        participant2Id,
        unreadCount1: 0,
        unreadCount2: 0,
        isActive: true,
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
      };

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.chatsTable,
          Item: chat,
        }),
      );

      this.logger.log('Chat creado exitosamente', 'getOrCreateChat', { chatId });
      return chat;
    } catch (error: any) {
      this.logger.error('Error al obtener/crear chat', error?.stack, 'getOrCreateChat', {
        userId1,
        userId2,
        error: error.message,
      });
      throw new BadRequestException(`Error al obtener/crear chat: ${error.message}`);
    }
  }

  /**
   * Listar chats del usuario
   */
  async listChats(userId: string, query: ListChatsDto) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // Buscar chats donde el usuario es participant1 o participant2
      const scanParams: any = {
        TableName: this.chatsTable,
        FilterExpression: '(participant1Id = :userId OR participant2Id = :userId) AND isActive = :active',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':active': true,
        },
      };

      if (query.unreadOnly) {
        // Filtrar solo chats con mensajes no leídos
        scanParams.FilterExpression += ' AND (unreadCount1 > :zero OR unreadCount2 > :zero)';
        scanParams.ExpressionAttributeValues[':zero'] = 0;
      }

      if (!query.includeArchived) {
        // Excluir chats archivados
        const participantNum = getParticipantNumber('', userId); // Necesitamos el chatId para esto
        // Por ahora, filtramos después
      }

      const response = await this.dynamoClient.send(new ScanCommand(scanParams));
      let chats = (response.Items || []) as ChatRecord[];

      // Filtrar chats archivados si es necesario
      if (!query.includeArchived) {
        chats = chats.filter((chat) => {
          const participantNum = getParticipantNumber(chat.chatId, userId);
          if (participantNum === 1) {
            return !chat.archivedBy1;
          } else {
            return !chat.archivedBy2;
          }
        });
      }

      // Ordenar por último mensaje (más reciente primero)
      chats.sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });

      // Paginación
      const total = chats.length;
      const paginatedChats = chats.slice(skip, skip + limit);

      // Obtener información de participantes desde user-service
      const allParticipantIds = new Set<string>();
      paginatedChats.forEach((chat) => {
        allParticipantIds.add(chat.participant1Id);
        allParticipantIds.add(chat.participant2Id);
      });

      // Cache de información de usuarios
      const userInfoCache = new Map<string, { name: string; avatar?: string }>();
      
      // Intentar obtener información de participantes (si user-service está disponible)
      if (this.httpService && allParticipantIds.size > 0) {
        try {
          await Promise.all(
            Array.from(allParticipantIds).map(async (participantId) => {
              try {
                if (!this.httpService) return;
                const response: any = await firstValueFrom(
                  this.httpService.get(`${this.userServiceUrl}/users/${participantId}`)
                );
                if (response?.data?.success && response?.data?.data) {
                  const userData = response.data.data;
                  userInfoCache.set(participantId, {
                    name: userData.fullName || userData.name || 'Usuario',
                    avatar: userData.avatarUrl || userData.avatar,
                  });
                }
              } catch (error) {
                // Si falla, usar datos del caché del chat o valores por defecto
                this.logger.warn('No se pudo obtener información de usuario', 'listChats', {
                  userId: participantId,
                  error: error.message,
                });
              }
            })
          );
        } catch (error) {
          this.logger.warn('Error al obtener información de participantes', 'listChats', {
            error: error.message,
          });
        }
      }

      // Formatear respuesta
      const formattedChats = paginatedChats.map((chat) => {
        const participantNum = getParticipantNumber(chat.chatId, userId);
        const otherParticipantId = participantNum === 1 ? chat.participant2Id : chat.participant1Id;
        const unreadCount = participantNum === 1 ? chat.unreadCount1 : chat.unreadCount2;
        const isArchived = participantNum === 1 ? chat.archivedBy1 : chat.archivedBy2;

        // Obtener información del participante (de caché del chat o de user-service)
        const cachedInfo = userInfoCache.get(otherParticipantId);
        const participantName = cachedInfo?.name || 
          (participantNum === 1 ? chat.participant2Name : chat.participant1Name) || 
          'Usuario';
        const participantAvatar = cachedInfo?.avatar || 
          (participantNum === 1 ? chat.participant2Avatar : chat.participant1Avatar);

        // Actualizar caché del chat si tenemos nueva información
        if (cachedInfo && !(participantNum === 1 ? chat.participant2Name : chat.participant1Name)) {
          this.updateChatParticipantInfo(chat.chatId, participantNum === 1 ? 2 : 1, cachedInfo.name, cachedInfo.avatar).catch(() => {});
        }

        return {
          chatId: chat.chatId,
          otherParticipantId,
          otherParticipantName: participantName,
          otherParticipantAvatar: participantAvatar,
          lastMessagePreview: chat.lastMessagePreview,
          lastMessageAt: chat.lastMessageAt,
          unreadCount,
          isArchived: !!isArchived,
          createdAt: chat.createdAt,
        };
      });

      return {
        success: true,
        data: formattedChats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error('Error al listar chats', error?.stack, 'listChats', {
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al listar chats: ${error.message}`);
    }
  }

  /**
   * Obtener mensajes de un chat
   */
  async getChatMessages(chatId: string, userId: string, query: ListMessagesDto) {
    try {
      // Verificar que el usuario tiene acceso al chat
      const chat = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.chatsTable,
          Key: { chatId },
        }),
      );

      if (!chat.Item) {
        throw new NotFoundException('Chat no encontrado');
      }

      const chatRecord = chat.Item as ChatRecord;
      if (chatRecord.participant1Id !== userId && chatRecord.participant2Id !== userId) {
        throw new ForbiddenException('No tienes acceso a este chat');
      }

      const limit = Math.min(query.limit || 50, 100);

      // Obtener mensajes usando GSI
      const queryParams: any = {
        TableName: this.messagesTable,
        IndexName: 'chatId-createdAt-index',
        KeyConditionExpression: 'chatId = :chatId',
        ExpressionAttributeValues: {
          ':chatId': chatId,
        },
        ScanIndexForward: false, // Ordenar descendente (más recientes primero)
        Limit: limit,
      };

      if (query.cursor) {
        // Paginación cursor-based
        queryParams.ExclusiveStartKey = {
          chatId,
          messageId: query.cursor,
        };
      }

      const response = await this.dynamoClient.send(new QueryCommand(queryParams));
      const messages = (response.Items || []) as MessageRecord[];

      // Formatear mensajes
      const formattedMessages = messages.map((msg) => ({
        messageId: msg.messageId,
        chatId: msg.chatId,
        senderId: msg.senderId,
        isFromMe: msg.senderId === userId,
        type: msg.type,
        content: msg.content,
        imageUrl: msg.imageUrl,
        price: msg.price,
        contractData: msg.contractData,
        transferData: msg.transferData,
        read: msg.read,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      }));

      // Marcar mensajes como leídos
      await this.markMessagesAsRead(chatId, userId, messages.filter((m) => !m.read && m.senderId !== userId).map((m) => m.messageId));

      return {
        success: true,
        data: formattedMessages.reverse(), // Revertir para mostrar más antiguos primero
        pagination: {
          page: query.page || 1,
          limit,
          total: messages.length,
          hasMore: !!response.LastEvaluatedKey,
          cursor: response.LastEvaluatedKey?.messageId,
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al obtener mensajes', error?.stack, 'getChatMessages', {
        chatId,
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al obtener mensajes: ${error.message}`);
    }
  }

  /**
   * Enviar un mensaje
   */
  async sendMessage(senderId: string, createMessageDto: CreateMessageDto): Promise<MessageRecord> {
    try {
      // Verificar que el chat existe y el usuario tiene acceso
      const chat = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.chatsTable,
          Key: { chatId: createMessageDto.chatId },
        }),
      );

      if (!chat.Item) {
        throw new NotFoundException('Chat no encontrado');
      }

      const chatRecord = chat.Item as ChatRecord;
      if (chatRecord.participant1Id !== senderId && chatRecord.participant2Id !== senderId) {
        throw new ForbiddenException('No tienes acceso a este chat');
      }

      // Crear mensaje
      const now = Date.now();
      const messageId = `msg_${now}_${uuidv4().substring(0, 8)}`;
      
      const message: MessageRecord = {
        messageId,
        createdAt: new Date().toISOString(),
        chatId: createMessageDto.chatId,
        senderId,
        type: createMessageDto.type,
        content: createMessageDto.content,
        imageUrl: createMessageDto.imageUrl,
        price: createMessageDto.price,
        contractData: createMessageDto.contractData,
        transferData: createMessageDto.transferData,
        read: false,
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
        metadata: createMessageDto.metadata,
      };

      // Si es paid_image, procesar pago inmediatamente
      if (createMessageDto.type === 'paid_image' && createMessageDto.price && createMessageDto.imageUrl) {
        try {
          const recipientId = chatRecord.participant1Id === senderId ? chatRecord.participant2Id : chatRecord.participant1Id;
          const paymentResult = await this.processPaymentForImage(
            senderId,
            recipientId,
            createMessageDto.price,
            messageId,
            createMessageDto.imageUrl,
            undefined, // agencyId - se puede obtener después si es necesario
          );
          
          message.paymentId = paymentResult.paymentId;
          message.paymentStatus = paymentResult.status as 'pending' | 'succeeded' | 'failed';
          
          this.logger.log('Pago procesado para imagen pagada', 'sendMessage', {
            messageId,
            paymentId: paymentResult.paymentId,
            status: paymentResult.status,
          });
        } catch (error: any) {
          this.logger.error('Error al procesar pago para imagen pagada', error?.stack, 'sendMessage', {
            messageId,
            error: error.message,
          });
          // Marcar como failed pero no fallar el envío del mensaje
          message.paymentStatus = 'failed';
          message.metadata = {
            ...message.metadata,
            paymentError: error.message,
          };
        }
      } else if (createMessageDto.type === 'paid_image') {
        message.paymentStatus = 'pending';
      }

      // Guardar mensaje
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.messagesTable,
          Item: message,
        }),
      );

      // Actualizar chat con último mensaje
      const participantNum = getParticipantNumber(createMessageDto.chatId, senderId);
      const otherParticipantNum = participantNum === 1 ? 2 : 1;
      
      const updateExpression: string[] = [
        'SET lastMessageId = :lastMessageId',
        'lastMessageAt = :lastMessageAt',
        'updatedAtTimestamp = :updatedAt',
      ];

      const expressionAttributeValues: any = {
        ':lastMessageId': messageId,
        ':lastMessageAt': message.createdAt,
        ':updatedAt': now,
      };

      // Incrementar contador de no leídos para el otro participante
      if (otherParticipantNum === 1) {
        updateExpression.push('unreadCount1 = unreadCount1 + :one');
      } else {
        updateExpression.push('unreadCount2 = unreadCount2 + :one');
      }
      expressionAttributeValues[':one'] = 1;

      // Vista previa del mensaje
      let preview = '';
      if (message.type === 'text' && message.content) {
        preview = message.content.substring(0, 100);
      } else if (message.type === 'paid_image') {
        preview = '📷 Imagen pagada';
      } else if (message.type === 'contract_pdf') {
        preview = '📄 Contrato de representación';
      } else if (message.type === 'contract_proposal') {
        preview = '💼 Propuesta de contrato';
      } else if (message.type === 'agency_transfer_request' || message.type === 'model_transfer_proposal') {
        preview = '🔄 Solicitud de transferencia';
      }

      if (preview) {
        updateExpression.push('lastMessagePreview = :preview');
        expressionAttributeValues[':preview'] = preview;
      }

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.chatsTable,
          Key: { chatId: createMessageDto.chatId },
          UpdateExpression: updateExpression.join(', '),
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      // Crear notificación para el receptor (solo para mensajes de texto normales)
      if (message.type === 'text' && message.content) {
        const recipientId = chatRecord.participant1Id === senderId ? chatRecord.participant2Id : chatRecord.participant1Id;
        try {
          // Obtener nombre del remitente para la notificación
          let senderName = 'Alguien';
          try {
            if (this.httpService) {
              const userResponse = await firstValueFrom(
                this.httpService.get(`${this.userServiceUrl}/users/${senderId}`, {
                  headers: { Authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN || ''}` },
                }),
              );
              senderName = userResponse.data?.data?.name || userResponse.data?.data?.username || 'Alguien';
            }
          } catch (error) {
            this.logger.warn('No se pudo obtener nombre del remitente para notificación', 'sendMessage', {
              senderId,
              error: error.message,
            });
          }

          await this.notificationClient.createNotification({
            userId: recipientId,
            type: 'message',
            title: 'Nuevo mensaje',
            message: `${senderName}: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`,
            link: `/messages/${createMessageDto.chatId}`,
            metadata: {
              chatId: createMessageDto.chatId,
              messageId: messageId,
              senderId: senderId,
            },
          });
        } catch (error: any) {
          // No fallar el envío del mensaje si la notificación falla
          this.logger.warn('Error al crear notificación de mensaje', 'sendMessage', {
            messageId,
            recipientId: chatRecord.participant1Id === senderId ? chatRecord.participant2Id : chatRecord.participant1Id,
            error: error.message,
          });
        }
      }

      this.logger.log('Mensaje enviado exitosamente', 'sendMessage', {
        messageId,
        chatId: createMessageDto.chatId,
        type: createMessageDto.type,
      });

      return message;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al enviar mensaje', error?.stack, 'sendMessage', {
        senderId,
        chatId: createMessageDto.chatId,
        error: error.message,
      });
      throw new BadRequestException(`Error al enviar mensaje: ${error.message}`);
    }
  }

  /**
   * Marcar mensajes como leídos
   */
  async markMessagesAsRead(chatId: string, userId: string, messageIds: string[]) {
    if (messageIds.length === 0) return;

    try {
      const now = Date.now();
      const readAt = new Date().toISOString();

      // Actualizar cada mensaje
      await Promise.all(
        messageIds.map((messageId) =>
          this.dynamoClient.send(
            new UpdateCommand({
              TableName: this.messagesTable,
              Key: { messageId },
              UpdateExpression: 'SET #read = :read, readAt = :readAt, updatedAtTimestamp = :updatedAt',
              ExpressionAttributeNames: {
                '#read': 'read',
              },
              ExpressionAttributeValues: {
                ':read': true,
                ':readAt': readAt,
                ':updatedAt': now,
              },
              ConditionExpression: 'chatId = :chatId AND senderId <> :userId',
            }),
          ),
        ),
      );

      // Actualizar contador de no leídos en el chat
      const chat = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.chatsTable,
          Key: { chatId },
        }),
      );

      if (chat.Item) {
        const chatRecord = chat.Item as ChatRecord;
        const participantNum = getParticipantNumber(chatId, userId);
        
        const updateExpression: string[] = ['SET updatedAtTimestamp = :updatedAt'];
        const expressionAttributeValues: any = {
          ':updatedAt': now,
        };

        if (participantNum === 1) {
          updateExpression.push('unreadCount1 = :zero');
          expressionAttributeValues[':zero'] = 0;
        } else {
          updateExpression.push('unreadCount2 = :zero');
          expressionAttributeValues[':zero'] = 0;
        }

        await this.dynamoClient.send(
          new UpdateCommand({
            TableName: this.chatsTable,
            Key: { chatId },
            UpdateExpression: updateExpression.join(', '),
            ExpressionAttributeValues: expressionAttributeValues,
          }),
        );
      }

      this.logger.log('Mensajes marcados como leídos', 'markMessagesAsRead', {
        chatId,
        userId,
        count: messageIds.length,
      });
    } catch (error: any) {
      this.logger.error('Error al marcar mensajes como leídos', error?.stack, 'markMessagesAsRead', {
        chatId,
        userId,
        error: error.message,
      });
      // No lanzar error, es una operación no crítica
    }
  }

  /**
   * Obtener contador de mensajes no leídos
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const scanParams = {
        TableName: this.chatsTable,
        FilterExpression: '(participant1Id = :userId OR participant2Id = :userId) AND isActive = :active',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':active': true,
        },
      };

      const response = await this.dynamoClient.send(new ScanCommand(scanParams));
      const chats = (response.Items || []) as ChatRecord[];

      let totalUnread = 0;
      chats.forEach((chat) => {
        const participantNum = getParticipantNumber(chat.chatId, userId);
        if (participantNum === 1) {
          totalUnread += chat.unreadCount1;
        } else {
          totalUnread += chat.unreadCount2;
        }
      });

      return totalUnread;
    } catch (error: any) {
      this.logger.error('Error al obtener contador de no leídos', error?.stack, 'getUnreadCount', {
        userId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Procesar pago para imagen pagada
   */
  private async processPaymentForImage(
    senderId: string,
    recipientId: string,
    amount: number,
    messageId: string,
    imageUrl?: string,
    agencyId?: string,
  ): Promise<{ paymentId: string; status: 'pending' | 'succeeded' | 'failed' }> {
    if (!this.httpService) {
      throw new BadRequestException('Payment service no disponible');
    }

    try {
      // Obtener customerId del sender (necesitarías obtenerlo de user-service o token)
      // Por ahora, asumimos que está en metadata o se pasa como parámetro
      
      const paymentPayload = {
        userId: senderId,
        recipientId,
        amount, // Ya está en centavos
        currency: 'usd',
        type: 'ppv',
        customerId: `cus_${senderId}`, // Esto debería obtenerse del usuario
        metadata: {
          messageId,
          imageUrl: imageUrl || '',
        },
        agencyId,
        idempotencyKey: `msg_${messageId}_${Date.now()}`,
      };

      const response: any = await firstValueFrom(
        this.httpService.post(`${this.paymentServiceUrl}/payments`, paymentPayload, {
          headers: {
            'Content-Type': 'application/json',
            // En producción, pasar el token de autenticación
          },
        }),
      );

      if (response?.data?.paymentId) {
        const status = response.data.status || 'succeeded';
        const validStatus: 'pending' | 'succeeded' | 'failed' = 
          (status === 'pending' || status === 'succeeded' || status === 'failed') 
            ? status 
            : 'succeeded';
        return {
          paymentId: response.data.paymentId,
          status: validStatus,
        };
      }

      throw new BadRequestException('Error al procesar pago: respuesta inválida');
    } catch (error: any) {
      this.logger.error('Error al procesar pago', error?.stack, 'processPaymentForImage', {
        senderId,
        recipientId,
        amount,
        error: error.message,
      });
      throw new BadRequestException(`Error al procesar pago: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * Actualizar información de participante en el chat (caché)
   */
  private async updateChatParticipantInfo(
    chatId: string,
    participantNum: 1 | 2,
    name: string,
    avatar?: string,
  ) {
    try {
      const updateExpression: string[] = ['SET updatedAtTimestamp = :updatedAt'];
      const expressionAttributeValues: any = {
        ':updatedAt': Date.now(),
      };

      if (participantNum === 1) {
        updateExpression.push('participant1Name = :name');
        expressionAttributeValues[':name'] = name;
        if (avatar) {
          updateExpression.push('participant1Avatar = :avatar');
          expressionAttributeValues[':avatar'] = avatar;
        }
      } else {
        updateExpression.push('participant2Name = :name');
        expressionAttributeValues[':name'] = name;
        if (avatar) {
          updateExpression.push('participant2Avatar = :avatar');
          expressionAttributeValues[':avatar'] = avatar;
        }
      }

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.chatsTable,
          Key: { chatId },
          UpdateExpression: updateExpression.join(', '),
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );
    } catch (error: any) {
      // No crítico, solo log
      this.logger.warn('Error al actualizar información de participante', 'updateChatParticipantInfo', {
        chatId,
        error: error.message,
      });
    }
  }

  /**
   * Archivar o desarchivar un chat
   */
  async archiveChat(chatId: string, userId: string, archive: boolean = true) {
    try {
      const chat = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.chatsTable,
          Key: { chatId },
        }),
      );

      if (!chat.Item) {
        throw new NotFoundException('Chat no encontrado');
      }

      const chatRecord = chat.Item as ChatRecord;
      if (chatRecord.participant1Id !== userId && chatRecord.participant2Id !== userId) {
        throw new ForbiddenException('No tienes acceso a este chat');
      }

      const participantNum = getParticipantNumber(chatId, userId);
      const field = participantNum === 1 ? 'archivedBy1' : 'archivedBy2';

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.chatsTable,
          Key: { chatId },
          UpdateExpression: `SET ${field} = :archive, updatedAtTimestamp = :updatedAt`,
          ExpressionAttributeValues: {
            ':archive': archive,
            ':updatedAt': Date.now(),
          },
        }),
      );

      this.logger.log('Chat archivado/desarchivado', 'archiveChat', {
        chatId,
        userId,
        archive,
      });

      return {
        success: true,
        message: archive ? 'Chat archivado exitosamente' : 'Chat desarchivado exitosamente',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al archivar chat', error?.stack, 'archiveChat', {
        chatId,
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al archivar chat: ${error.message}`);
    }
  }

  /**
   * Eliminar un mensaje
   */
  async deleteMessage(messageId: string, userId: string) {
    try {
      // Obtener mensaje
      const message = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.messagesTable,
          Key: { messageId },
        }),
      );

      if (!message.Item) {
        throw new NotFoundException('Mensaje no encontrado');
      }

      const messageRecord = message.Item as MessageRecord;

      // Verificar que el usuario es el remitente
      if (messageRecord.senderId !== userId) {
        throw new ForbiddenException('Solo puedes eliminar tus propios mensajes');
      }

      // Eliminar mensaje
      await this.dynamoClient.send(
        new DeleteCommand({
          TableName: this.messagesTable,
          Key: { messageId },
        }),
      );

      // Si era el último mensaje del chat, actualizar el chat
      const chat = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.chatsTable,
          Key: { chatId: messageRecord.chatId },
        }),
      );

      if (chat.Item && chat.Item.lastMessageId === messageId) {
        // Buscar el mensaje anterior
        const messagesResponse = await this.dynamoClient.send(
          new QueryCommand({
            TableName: this.messagesTable,
            IndexName: 'chatId-createdAt-index',
            KeyConditionExpression: 'chatId = :chatId',
            ExpressionAttributeValues: {
              ':chatId': messageRecord.chatId,
            },
            ScanIndexForward: false,
            Limit: 1,
          }),
        );

        const previousMessage = messagesResponse.Items?.[0] as MessageRecord | undefined;

        const updateExpression: string[] = ['SET updatedAtTimestamp = :updatedAt'];
        const expressionAttributeValues: any = {
          ':updatedAt': Date.now(),
        };

        if (previousMessage) {
          updateExpression.push('lastMessageId = :lastMessageId');
          updateExpression.push('lastMessageAt = :lastMessageAt');
          expressionAttributeValues[':lastMessageId'] = previousMessage.messageId;
          expressionAttributeValues[':lastMessageAt'] = previousMessage.createdAt;
          
          let preview = '';
          if (previousMessage.type === 'text' && previousMessage.content) {
            preview = previousMessage.content.substring(0, 100);
          } else if (previousMessage.type === 'paid_image') {
            preview = '📷 Imagen pagada';
          } else if (previousMessage.type === 'contract_pdf') {
            preview = '📄 Contrato de representación';
          }
          
          if (preview) {
            updateExpression.push('lastMessagePreview = :preview');
            expressionAttributeValues[':preview'] = preview;
          }
        } else {
          updateExpression.push('REMOVE lastMessageId, lastMessageAt, lastMessagePreview');
        }

        await this.dynamoClient.send(
          new UpdateCommand({
            TableName: this.chatsTable,
            Key: { chatId: messageRecord.chatId },
            UpdateExpression: updateExpression.join(', '),
            ExpressionAttributeValues: expressionAttributeValues,
          }),
        );
      }

      this.logger.log('Mensaje eliminado exitosamente', 'deleteMessage', {
        messageId,
        userId,
      });

      return {
        success: true,
        message: 'Mensaje eliminado exitosamente',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Error al eliminar mensaje', error?.stack, 'deleteMessage', {
        messageId,
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al eliminar mensaje: ${error.message}`);
    }
  }

  /**
   * Obtener mensaje por ID
   */
  async getMessageById(messageId: string): Promise<MessageRecord | null> {
    try {
      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.messagesTable,
          Key: { messageId },
        }),
      );
      return response.Item as MessageRecord | null;
    } catch (error: any) {
      this.logger.error('Error al obtener mensaje', error?.stack, 'getMessageById', {
        messageId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Obtener chat por ID
   */
  async getChatById(chatId: string): Promise<ChatRecord | null> {
    try {
      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.chatsTable,
          Key: { chatId },
        }),
      );
      return response.Item as ChatRecord | null;
    } catch (error: any) {
      this.logger.error('Error al obtener chat', error?.stack, 'getChatById', {
        chatId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Obtener chat con un usuario específico
   */
  async getChatWithUser(currentUserId: string, otherUserId: string) {
    try {
      const chat = await this.getOrCreateChat(currentUserId, otherUserId);
      
      // Obtener información del otro participante
      const participantNum = getParticipantNumber(chat.chatId, currentUserId);
      const otherParticipantId = participantNum === 1 ? chat.participant2Id : chat.participant1Id;
      
      // Intentar obtener información desde user-service
      let otherParticipantName = participantNum === 1 ? chat.participant2Name : chat.participant1Name;
      let otherParticipantAvatar = participantNum === 1 ? chat.participant2Avatar : chat.participant1Avatar;

      if (this.httpService && !otherParticipantName) {
        try {
          if (!this.httpService) return;
          const response: any = await firstValueFrom(
            this.httpService.get(`${this.userServiceUrl}/users/${otherParticipantId}`)
          );
          if (response?.data?.success && response?.data?.data) {
            const userData = response.data.data;
            otherParticipantName = userData.fullName || userData.name || 'Usuario';
            otherParticipantAvatar = userData.avatarUrl || userData.avatar;
            
            // Actualizar caché
            if (otherParticipantName) {
              await this.updateChatParticipantInfo(
                chat.chatId,
                participantNum === 1 ? 2 : 1,
                otherParticipantName,
                otherParticipantAvatar,
              );
            }
          }
        } catch (error) {
          this.logger.warn('No se pudo obtener información del usuario', 'getChatWithUser', {
            userId: otherParticipantId,
            error: error.message,
          });
        }
      }

      const unreadCount = participantNum === 1 ? chat.unreadCount1 : chat.unreadCount2;
      const isArchived = participantNum === 1 ? chat.archivedBy1 : chat.archivedBy2;

      return {
        success: true,
        data: {
          chatId: chat.chatId,
          otherParticipantId,
          otherParticipantName: otherParticipantName || 'Usuario',
          otherParticipantAvatar,
          unreadCount,
          isArchived: !!isArchived,
          createdAt: chat.createdAt,
        },
      };
    } catch (error: any) {
      this.logger.error('Error al obtener chat con usuario', error?.stack, 'getChatWithUser', {
        currentUserId,
        otherUserId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validar datos del mensaje según su tipo
   */
  private validateMessageData(createMessageDto: CreateMessageDto) {
    switch (createMessageDto.type) {
      case 'text':
        if (!createMessageDto.content || createMessageDto.content.trim().length === 0) {
          throw new BadRequestException('El contenido del mensaje de texto es requerido');
        }
        break;
      
      case 'paid_image':
        if (!createMessageDto.imageUrl) {
          throw new BadRequestException('La URL de la imagen es requerida para imágenes pagadas');
        }
        if (!createMessageDto.price || createMessageDto.price < 50) {
          throw new BadRequestException('El precio debe ser al menos $0.50 (50 centavos)');
        }
        break;
      
      case 'contract_pdf':
      case 'contract_proposal':
        if (!createMessageDto.contractData) {
          throw new BadRequestException('Los datos del contrato son requeridos');
        }
        if (!createMessageDto.contractData.modelId || !createMessageDto.contractData.agencyId) {
          throw new BadRequestException('modelId y agencyId son requeridos en contractData');
        }
        break;
      
      case 'agency_transfer_request':
      case 'model_transfer_proposal':
        if (!createMessageDto.transferData) {
          throw new BadRequestException('Los datos de transferencia son requeridos');
        }
        if (!createMessageDto.transferData.modelId || !createMessageDto.transferData.transferAmount) {
          throw new BadRequestException('modelId y transferAmount son requeridos en transferData');
        }
        break;
    }
  }
}

