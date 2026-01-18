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
} from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { ContractRecord, ContractProposalRecord, generateContractId, generateProposalId } from './database-schema.service';
import { CreateContractDto } from '../dto/create-contract.dto';
import { CreateProposalDto } from '../dto/create-proposal.dto';
import { LoggerService } from '../common/logger/logger.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NotificationClient } from '@bravas/shared';

@Injectable()
export class ContractsService {
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;
  private readonly logger: LoggerService;
  private readonly contractsTable: string;
  private readonly proposalsTable: string;

  private readonly userServiceUrl: string;
  private readonly messagesServiceUrl: string;
  private readonly notificationServiceUrl: string;
  private readonly notificationClient: NotificationClient;

  constructor(
    private configService: ConfigService,
    private httpService?: HttpService,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    this.logger = LoggerService.create('ContractsService', configService);
    
    const projectName = process.env.PROJECT_NAME || 'bravas';
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
    this.contractsTable = `${projectName}-contracts-${environment}`;
    this.proposalsTable = `${projectName}-contract-proposals-${environment}`;
    
    this.userServiceUrl = this.configService.get<string>('USER_SERVICE_URL') || 'http://localhost:3001/api/v1';
    this.messagesServiceUrl = this.configService.get<string>('MESSAGES_SERVICE_URL') || 'http://localhost:3003/api/v1';
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006/api/v1';
    
    // Cliente de notificaciones
    this.notificationClient = new NotificationClient(this.notificationServiceUrl);
  }

  /**
   * Crear propuesta de contrato (desde agencia a modelo)
   */
  async createProposal(agencyId: string, createProposalDto: CreateProposalDto): Promise<ContractProposalRecord> {
    try {
      // Validar que el usuario es una agencia
      // (esto se puede validar desde el token o desde user-service)

      // Verificar que no existe una propuesta pendiente
      const existingProposal = await this.getPendingProposal(agencyId, createProposalDto.modelId);
      if (existingProposal) {
        throw new BadRequestException('Ya existe una propuesta pendiente para esta modelo');
      }

      // Verificar que no existe un contrato activo
      const existingContract = await this.getActiveContract(agencyId, createProposalDto.modelId);
      if (existingContract) {
        throw new BadRequestException('Ya existe un contrato activo con esta modelo');
      }

      const now = Date.now();
      const proposalId = generateProposalId(agencyId, createProposalDto.modelId, now);
      const agencyPercentage = 100 - createProposalDto.modelPercentage;

      const proposal: ContractProposalRecord = {
        proposalId,
        createdAt: new Date().toISOString(),
        agencyId,
        modelId: createProposalDto.modelId,
        chatId: createProposalDto.chatId,
        modelPercentage: createProposalDto.modelPercentage,
        agencyPercentage,
        bravasCommission: 12,
        status: 'pending',
        pdfUrl: createProposalDto.pdfUrl,
        pdfDataUri: createProposalDto.pdfDataUri,
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
      };

      // Obtener información de participantes desde user-service
      await this.enrichProposalWithUserInfo(proposal);

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.proposalsTable,
          Item: proposal,
        }),
      );

      this.logger.log('Propuesta de contrato creada', 'createProposal', {
        proposalId,
        agencyId,
        modelId: createProposalDto.modelId,
      });

      // Crear notificación para el modelo
      try {
        await this.notificationClient.createNotification({
          userId: createProposalDto.modelId,
          type: 'contract',
          title: 'Nueva propuesta de contrato',
          message: `Has recibido una nueva propuesta de contrato de representación de ${proposal.agencyName || 'una agencia'}`,
          link: `/contracts/proposals/${proposalId}`,
          metadata: {
            proposalId,
            agencyId,
            contractType: 'representation',
          },
        });
      } catch (error: any) {
        this.logger.warn('Error al crear notificación de propuesta', 'createProposal', {
          proposalId,
          error: error.message,
        });
      }

      return proposal;
    } catch (error: any) {
      this.logger.error('Error al crear propuesta', error?.stack, 'createProposal', {
        agencyId,
        modelId: createProposalDto.modelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Aceptar propuesta de contrato (desde modelo)
   */
  async acceptProposal(proposalId: string, modelId: string): Promise<ContractRecord> {
    try {
      // Obtener propuesta
      const proposal = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.proposalsTable,
          Key: { proposalId },
        }),
      );

      if (!proposal.Item) {
        throw new NotFoundException('Propuesta no encontrada');
      }

      const proposalRecord = proposal.Item as ContractProposalRecord;

      // Verificar que la propuesta es para esta modelo
      if (proposalRecord.modelId !== modelId) {
        throw new ForbiddenException('No tienes permiso para aceptar esta propuesta');
      }

      // Verificar que la propuesta está pendiente
      if (proposalRecord.status !== 'pending') {
        throw new BadRequestException(`La propuesta ya fue ${proposalRecord.status}`);
      }

      // Crear contrato activo
      const now = Date.now();
      const contractId = generateContractId(proposalRecord.agencyId, proposalRecord.modelId, now);

      const contract: ContractRecord = {
        contractId,
        createdAt: new Date().toISOString(),
        agencyId: proposalRecord.agencyId,
        modelId: proposalRecord.modelId,
        chatId: proposalRecord.chatId,
        modelPercentage: proposalRecord.modelPercentage,
        agencyPercentage: proposalRecord.agencyPercentage,
        bravasCommission: proposalRecord.bravasCommission,
        status: 'active',
        startDate: new Date().toISOString(),
        agencyName: proposalRecord.agencyName,
        agencyUsername: proposalRecord.agencyUsername,
        agencyLogo: proposalRecord.agencyLogo,
        modelName: proposalRecord.modelName,
        modelUsername: proposalRecord.modelUsername,
        modelAvatar: proposalRecord.modelAvatar,
        pdfUrl: proposalRecord.pdfUrl,
        pdfDataUri: proposalRecord.pdfDataUri,
        totalEarnings: 0,
        totalPayments: 0,
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
      };

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.contractsTable,
          Item: contract,
        }),
      );

      // Actualizar propuesta
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.proposalsTable,
          Key: { proposalId },
          UpdateExpression: 'SET #status = :accepted, respondedAt = :respondedAt, contractId = :contractId, updatedAtTimestamp = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':accepted': 'accepted',
            ':respondedAt': new Date().toISOString(),
            ':contractId': contractId,
            ':updatedAt': now,
          },
        }),
      );

      // Enriquecer contrato con información de usuario si no está completa
      if (!contract.agencyName || !contract.modelName) {
        await this.enrichContractWithUserInfo(contract);
      }

      this.logger.log('Propuesta aceptada y contrato creado', 'acceptProposal', {
        proposalId,
        contractId,
        modelId,
      });

      // Crear notificación para la agencia
      try {
        await this.notificationClient.createNotification({
          userId: proposalRecord.agencyId,
          type: 'contract',
          title: 'Propuesta de contrato aceptada',
          message: `${contract.modelName || 'Una modelo'} ha aceptado tu propuesta de contrato de representación`,
          link: `/contracts/${contractId}`,
          metadata: {
            contractId,
            proposalId,
            modelId,
          },
        });
      } catch (error: any) {
        this.logger.warn('Error al crear notificación de aceptación', 'acceptProposal', {
          proposalId,
          error: error.message,
        });
      }

      return contract;
    } catch (error: any) {
      this.logger.error('Error al aceptar propuesta', error?.stack, 'acceptProposal', {
        proposalId,
        modelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Rechazar propuesta de contrato (desde modelo)
   */
  async rejectProposal(proposalId: string, modelId: string): Promise<void> {
    try {
      const proposal = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.proposalsTable,
          Key: { proposalId },
        }),
      );

      if (!proposal.Item) {
        throw new NotFoundException('Propuesta no encontrada');
      }

      const proposalRecord = proposal.Item as ContractProposalRecord;

      if (proposalRecord.modelId !== modelId) {
        throw new ForbiddenException('No tienes permiso para rechazar esta propuesta');
      }

      if (proposalRecord.status !== 'pending') {
        throw new BadRequestException(`La propuesta ya fue ${proposalRecord.status}`);
      }

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.proposalsTable,
          Key: { proposalId },
          UpdateExpression: 'SET #status = :rejected, respondedAt = :respondedAt, updatedAtTimestamp = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':rejected': 'rejected',
            ':respondedAt': new Date().toISOString(),
            ':updatedAt': Date.now(),
          },
        }),
      );

      this.logger.log('Propuesta rechazada', 'rejectProposal', { proposalId, modelId });

      // Crear notificación para la agencia
      try {
        await this.notificationClient.createNotification({
          userId: proposalRecord.agencyId,
          type: 'contract',
          title: 'Propuesta de contrato rechazada',
          message: `${proposalRecord.modelName || 'Una modelo'} ha rechazado tu propuesta de contrato de representación`,
          link: `/contracts/proposals/${proposalId}`,
          metadata: {
            proposalId,
            modelId,
          },
        });
      } catch (error: any) {
        this.logger.warn('Error al crear notificación de rechazo', 'rejectProposal', {
          proposalId,
          error: error.message,
        });
      }
    } catch (error: any) {
      this.logger.error('Error al rechazar propuesta', error?.stack, 'rejectProposal', {
        proposalId,
        modelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Listar contratos activos del usuario
   */
  async listContracts(userId: string, userRole: 'model' | 'agency', includeTerminated: boolean = false): Promise<ContractRecord[]> {
    try {
      let filterExpression = userRole === 'model' 
        ? 'modelId = :userId'
        : 'agencyId = :userId';

      const expressionAttributeValues: any = {
        ':userId': userId,
      };

      if (includeTerminated) {
        // Incluir todos los estados
        filterExpression += ' AND (#status = :active OR #status = :termination OR #status = :terminated)';
        expressionAttributeValues[':active'] = 'active';
        expressionAttributeValues[':termination'] = 'termination_requested';
        expressionAttributeValues[':terminated'] = 'terminated';
      } else {
        // Solo activos y en proceso de terminación
        filterExpression += ' AND (#status = :active OR #status = :termination)';
        expressionAttributeValues[':active'] = 'active';
        expressionAttributeValues[':termination'] = 'termination_requested';
      }

      const response = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.contractsTable,
          FilterExpression: filterExpression,
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      const contracts = (response.Items || []) as ContractRecord[];

      // Enriquecer contratos con información de usuario si está disponible
      if (this.httpService) {
        await Promise.all(
          contracts.map(async (contract) => {
            if (!contract.agencyName || !contract.modelName) {
              await this.enrichContractWithUserInfo(contract);
            }
          })
        );
      }

      return contracts;
    } catch (error: any) {
      this.logger.error('Error al listar contratos', error?.stack, 'listContracts', {
        userId,
        userRole,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Listar historial de contratos terminados
   */
  async listContractHistory(userId: string, userRole: 'model' | 'agency'): Promise<ContractRecord[]> {
    try {
      const filterExpression = userRole === 'model' 
        ? 'modelId = :userId AND #status = :terminated'
        : 'agencyId = :userId AND #status = :terminated';

      const response = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.contractsTable,
          FilterExpression: filterExpression,
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':userId': userId,
            ':terminated': 'terminated',
          },
        }),
      );

      return (response.Items || []) as ContractRecord[];
    } catch (error: any) {
      this.logger.error('Error al listar historial de contratos', error?.stack, 'listContractHistory', {
        userId,
        userRole,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Listar propuestas del usuario
   */
  async listProposals(userId: string, userRole: 'model' | 'agency', status?: string): Promise<ContractProposalRecord[]> {
    try {
      let filterExpression = userRole === 'model'
        ? 'modelId = :userId'
        : 'agencyId = :userId';

      const expressionAttributeValues: any = {
        ':userId': userId,
      };

      if (status) {
        filterExpression += ' AND #status = :status';
        expressionAttributeValues[':status'] = status;
      } else {
        filterExpression += ' AND #status = :pending';
        expressionAttributeValues[':pending'] = 'pending';
      }

      const response = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.proposalsTable,
          FilterExpression: filterExpression,
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      return (response.Items || []) as ContractProposalRecord[];
    } catch (error: any) {
      this.logger.error('Error al listar propuestas', error?.stack, 'listProposals', {
        userId,
        userRole,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Solicitar terminación de contrato (desde modelo, con 15 días de preaviso)
   */
  async requestTermination(contractId: string, modelId: string): Promise<ContractRecord> {
    try {
      const contract = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.contractsTable,
          Key: { contractId },
        }),
      );

      if (!contract.Item) {
        throw new NotFoundException('Contrato no encontrado');
      }

      const contractRecord = contract.Item as ContractRecord;

      if (contractRecord.modelId !== modelId) {
        throw new ForbiddenException('No tienes permiso para solicitar la terminación de este contrato');
      }

      if (contractRecord.status !== 'active') {
        throw new BadRequestException('Solo se puede solicitar terminación de contratos activos');
      }

      const now = Date.now();
      const terminationDate = new Date(now + 15 * 24 * 60 * 60 * 1000); // 15 días

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.contractsTable,
          Key: { contractId },
          UpdateExpression: 'SET #status = :status, terminationRequestDate = :requestDate, terminationDate = :terminationDate, updatedAtTimestamp = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'termination_requested',
            ':requestDate': new Date().toISOString(),
            ':terminationDate': terminationDate.toISOString(),
            ':updatedAt': now,
          },
        }),
      );

      this.logger.log('Terminación de contrato solicitada', 'requestTermination', {
        contractId,
        modelId,
        terminationDate: terminationDate.toISOString(),
      });

      // Obtener contrato actualizado
      const updated = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.contractsTable,
          Key: { contractId },
        }),
      );

      return updated.Item as ContractRecord;
    } catch (error: any) {
      this.logger.error('Error al solicitar terminación', error?.stack, 'requestTermination', {
        contractId,
        modelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Obtener contrato por ID
   */
  async getContractById(contractId: string, userId: string): Promise<ContractRecord> {
    try {
      const contract = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.contractsTable,
          Key: { contractId },
        }),
      );

      if (!contract.Item) {
        throw new NotFoundException('Contrato no encontrado');
      }

      const contractRecord = contract.Item as ContractRecord;

      // Verificar acceso
      if (contractRecord.agencyId !== userId && contractRecord.modelId !== userId) {
        throw new ForbiddenException('No tienes acceso a este contrato');
      }

      return contractRecord;
    } catch (error: any) {
      this.logger.error('Error al obtener contrato', error?.stack, 'getContractById', {
        contractId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // Helpers privados

  private async getPendingProposal(agencyId: string, modelId: string): Promise<ContractProposalRecord | null> {
    try {
      const response = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.proposalsTable,
          FilterExpression: 'agencyId = :agencyId AND modelId = :modelId AND #status = :pending',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':agencyId': agencyId,
            ':modelId': modelId,
            ':pending': 'pending',
          },
          Limit: 1,
        }),
      );

      return response.Items?.[0] as ContractProposalRecord | null;
    } catch (error) {
      return null;
    }
  }

  private async getActiveContract(agencyId: string, modelId: string): Promise<ContractRecord | null> {
    try {
      const response = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.contractsTable,
          FilterExpression: 'agencyId = :agencyId AND modelId = :modelId AND (#status = :active OR #status = :termination)',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':agencyId': agencyId,
            ':modelId': modelId,
            ':active': 'active',
            ':termination': 'termination_requested',
          },
          Limit: 1,
        }),
      );

      return response.Items?.[0] as ContractRecord | null;
    } catch (error) {
      return null;
    }
  }

  private async enrichProposalWithUserInfo(proposal: ContractProposalRecord): Promise<void> {
    if (!this.httpService) return;

    try {
      // Obtener información de la agencia
      const agencyResponse: any = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/users/${proposal.agencyId}`)
      );
      if (agencyResponse?.data?.success && agencyResponse?.data?.data) {
        const agencyData = agencyResponse.data.data;
        proposal.agencyName = agencyData.fullName || agencyData.name || agencyData.agencyName;
        proposal.agencyUsername = agencyData.username;
        proposal.agencyLogo = agencyData.avatarUrl || agencyData.avatar || agencyData.logo;
      }

      // Obtener información de la modelo
      const modelResponse: any = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/users/${proposal.modelId}`)
      );
      if (modelResponse?.data?.success && modelResponse?.data?.data) {
        const modelData = modelResponse.data.data;
        proposal.modelName = modelData.fullName || modelData.name || modelData.artistName;
        proposal.modelUsername = modelData.username;
        proposal.modelAvatar = modelData.avatarUrl || modelData.avatar;
      }
    } catch (error) {
      this.logger.warn('No se pudo obtener información de usuarios', 'enrichProposalWithUserInfo', {
        agencyId: proposal.agencyId,
        modelId: proposal.modelId,
        error: error.message,
      });
    }
  }

  private async enrichContractWithUserInfo(contract: ContractRecord): Promise<void> {
    if (!this.httpService) return;

    try {
      // Obtener información de la agencia si no está disponible
      if (!contract.agencyName || !contract.agencyUsername) {
        const agencyResponse: any = await firstValueFrom(
          this.httpService.get(`${this.userServiceUrl}/users/${contract.agencyId}`)
        );
        if (agencyResponse?.data?.success && agencyResponse?.data?.data) {
          const agencyData = agencyResponse.data.data;
          contract.agencyName = contract.agencyName || agencyData.fullName || agencyData.name || agencyData.agencyName;
          contract.agencyUsername = contract.agencyUsername || agencyData.username;
          contract.agencyLogo = contract.agencyLogo || agencyData.avatarUrl || agencyData.avatar || agencyData.logo;
        }
      }

      // Obtener información de la modelo si no está disponible
      if (!contract.modelName || !contract.modelUsername) {
        const modelResponse: any = await firstValueFrom(
          this.httpService.get(`${this.userServiceUrl}/users/${contract.modelId}`)
        );
        if (modelResponse?.data?.success && modelResponse?.data?.data) {
          const modelData = modelResponse.data.data;
          contract.modelName = contract.modelName || modelData.fullName || modelData.name || modelData.artistName;
          contract.modelUsername = contract.modelUsername || modelData.username;
          contract.modelAvatar = contract.modelAvatar || modelData.avatarUrl || modelData.avatar;
        }
      }
    } catch (error) {
      this.logger.warn('No se pudo obtener información de usuarios', 'enrichContractWithUserInfo', {
        agencyId: contract.agencyId,
        modelId: contract.modelId,
        error: error.message,
      });
    }
  }

  /**
   * Mapear ContractRecord a formato del frontend
   */
  mapContractToDto(record: ContractRecord): any {
    return {
      id: record.contractId, // Alias para frontend
      contractId: record.contractId,
      agencyId: record.agencyId,
      modelId: record.modelId,
      chatId: record.chatId,
      agencyName: record.agencyName,
      agencyUsername: record.agencyUsername,
      agencyLogo: record.agencyLogo,
      modelName: record.modelName,
      modelUsername: record.modelUsername,
      modelAvatar: record.modelAvatar,
      modelPercentage: record.modelPercentage,
      agencyPercentage: record.agencyPercentage,
      status: record.status,
      // El frontend espera startDate como Date, pero en JSON se serializa como ISO string
      // El frontend puede parsearlo automáticamente desde ISO string
      startDate: record.startDate ? new Date(record.startDate).toISOString() : undefined,
      terminationDate: record.terminationDate ? new Date(record.terminationDate).toISOString() : undefined,
      createdAt: record.createdAt || (record.createdAtTimestamp ? new Date(record.createdAtTimestamp).toISOString() : undefined),
      totalEarnings: record.totalEarnings,
      pdfUrl: record.pdfUrl,
    };
  }

  /**
   * Mapear ContractProposalRecord a formato del frontend
   */
  mapProposalToDto(record: ContractProposalRecord): any {
    return {
      id: record.proposalId, // Alias para frontend
      proposalId: record.proposalId,
      agencyId: record.agencyId,
      modelId: record.modelId,
      chatId: record.chatId,
      agencyName: record.agencyName,
      agencyUsername: record.agencyUsername,
      agencyLogo: record.agencyLogo,
      modelPercentage: record.modelPercentage,
      agencyPercentage: record.agencyPercentage,
      status: record.status,
      // El frontend espera createdAt como Date, pero en JSON se serializa como ISO string
      // El frontend puede parsearlo automáticamente desde ISO string
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : undefined,
      pdfUrl: record.pdfUrl,
      pdfDataUri: record.pdfDataUri,
    };
  }
}

