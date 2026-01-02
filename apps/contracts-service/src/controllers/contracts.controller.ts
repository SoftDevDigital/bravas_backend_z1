import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  BadRequestException,
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
import { ContractsService } from '../services/contracts.service';
import { CreateContractDto } from '../dto/create-contract.dto';
import { CreateProposalDto } from '../dto/create-proposal.dto';
import { ApiResponseDto, ContractDto, ContractProposalDto } from '../dto/response.dto';
import { getUserFromToken } from '../helpers/auth.helper';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('contracts')
@Controller('contracts')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class ContractsController {
  private readonly logger: LoggerService;

  constructor(
    private readonly contractsService: ContractsService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('ContractsController', configService);
  }

  /**
   * POST /contracts/proposals
   * Crear propuesta de contrato (desde agencia)
   */
  @Post('proposals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear propuesta de contrato',
    description: 'Crea una propuesta de contrato de representación desde una agencia hacia una modelo.',
  })
  @ApiResponse({
    status: 201,
    description: 'Propuesta creada exitosamente',
    type: ContractProposalDto,
  })
  async createProposal(@Request() req: any, @Body() body: CreateProposalDto) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      // Verificar que el usuario es una agencia
      if (userInfo.role !== 'agency') {
        throw new BadRequestException('Solo las agencias pueden crear propuestas de contrato');
      }

      const proposal = await this.contractsService.createProposal(userInfo.userId, body);

      return {
        success: true,
        data: this.contractsService.mapProposalToDto(proposal),
        message: 'Propuesta de contrato creada exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al crear propuesta', error?.stack, 'createProposal', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /contracts/proposals/:proposalId/accept
   * Aceptar propuesta de contrato (desde modelo)
   */
  @Put('proposals/:proposalId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aceptar propuesta de contrato',
    description: 'Acepta una propuesta de contrato y crea un contrato activo.',
  })
  @ApiParam({ name: 'proposalId', description: 'ID de la propuesta' })
  @ApiResponse({
    status: 200,
    description: 'Propuesta aceptada y contrato creado',
    type: ContractDto,
  })
  async acceptProposal(@Request() req: any, @Param('proposalId') proposalId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      // Verificar que el usuario es una modelo
      if (userInfo.role !== 'model') {
        throw new BadRequestException('Solo las modelos pueden aceptar propuestas de contrato');
      }

      const contract = await this.contractsService.acceptProposal(proposalId, userInfo.userId);

      return {
        success: true,
        data: this.contractsService.mapContractToDto(contract),
        message: 'Propuesta aceptada y contrato creado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al aceptar propuesta', error?.stack, 'acceptProposal', {
        proposalId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /contracts/proposals/:proposalId/reject
   * Rechazar propuesta de contrato (desde modelo)
   */
  @Put('proposals/:proposalId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar propuesta de contrato',
    description: 'Rechaza una propuesta de contrato.',
  })
  @ApiParam({ name: 'proposalId', description: 'ID de la propuesta' })
  @ApiResponse({
    status: 200,
    description: 'Propuesta rechazada exitosamente',
  })
  async rejectProposal(@Request() req: any, @Param('proposalId') proposalId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      if (userInfo.role !== 'model') {
        throw new BadRequestException('Solo las modelos pueden rechazar propuestas de contrato');
      }

      await this.contractsService.rejectProposal(proposalId, userInfo.userId);

      return {
        success: true,
        message: 'Propuesta rechazada exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al rechazar propuesta', error?.stack, 'rejectProposal', {
        proposalId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /contracts
   * Listar contratos activos del usuario
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar contratos activos',
    description: 'Retorna todos los contratos activos del usuario (modelo o agencia).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de contratos obtenida exitosamente',
    type: ApiResponseDto,
  })
  async listContracts(@Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      if (userInfo.role !== 'model' && userInfo.role !== 'agency') {
        throw new BadRequestException('Solo modelos y agencias pueden ver contratos');
      }

      const contracts = await this.contractsService.listContracts(
        userInfo.userId,
        userInfo.role as 'model' | 'agency',
        false, // Solo activos y en proceso de terminación
      );

      return {
        success: true,
        data: contracts.map(c => this.contractsService.mapContractToDto(c)),
        message: 'Contratos obtenidos exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al listar contratos', error?.stack, 'listContracts', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /contracts/proposals
   * Listar propuestas del usuario
   */
  @Get('proposals')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar propuestas de contrato',
    description: 'Retorna todas las propuestas de contrato del usuario (pendientes por defecto).',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado (pending, accepted, rejected)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de propuestas obtenida exitosamente',
    type: ApiResponseDto,
  })
  async listProposals(@Request() req: any, @Query('status') status?: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      if (userInfo.role !== 'model' && userInfo.role !== 'agency') {
        throw new BadRequestException('Solo modelos y agencias pueden ver propuestas');
      }

      const proposals = await this.contractsService.listProposals(
        userInfo.userId,
        userInfo.role as 'model' | 'agency',
        status,
      );

      return {
        success: true,
        data: proposals.map(p => this.contractsService.mapProposalToDto(p)),
        message: 'Propuestas obtenidas exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al listar propuestas', error?.stack, 'listProposals', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /contracts/:contractId
   * Obtener contrato por ID
   */
  @Get(':contractId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener contrato por ID',
    description: 'Obtiene los detalles de un contrato específico.',
  })
  @ApiParam({ name: 'contractId', description: 'ID del contrato' })
  @ApiResponse({
    status: 200,
    description: 'Contrato obtenido exitosamente',
    type: ContractDto,
  })
  async getContract(@Request() req: any, @Param('contractId') contractId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const contract = await this.contractsService.getContractById(contractId, userInfo.userId);

      return {
        success: true,
        data: this.contractsService.mapContractToDto(contract),
        message: 'Contrato obtenido exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al obtener contrato', error?.stack, 'getContract', {
        contractId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /contracts/:contractId/terminate
   * Solicitar terminación de contrato (desde modelo, con 15 días de preaviso)
   */
  @Put(':contractId/terminate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar terminación de contrato',
    description: 'Solicita la terminación de un contrato activo. El contrato finalizará en 15 días.',
  })
  @ApiParam({ name: 'contractId', description: 'ID del contrato' })
  @ApiResponse({
    status: 200,
    description: 'Terminación solicitada exitosamente',
    type: ContractDto,
  })
  async requestTermination(@Request() req: any, @Param('contractId') contractId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      if (userInfo.role !== 'model') {
        throw new BadRequestException('Solo las modelos pueden solicitar la terminación de contratos');
      }

      const contract = await this.contractsService.requestTermination(contractId, userInfo.userId);

      return {
        success: true,
        data: this.contractsService.mapContractToDto(contract),
        message: 'Terminación de contrato solicitada exitosamente. El contrato finalizará en 15 días.',
      };
    } catch (error: any) {
      this.logger.error('Error al solicitar terminación', error?.stack, 'requestTermination', {
        contractId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /contracts/history
   * Listar historial de contratos terminados
   */
  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar historial de contratos terminados',
    description: 'Retorna todos los contratos terminados del usuario (modelo o agencia).',
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de contratos obtenido exitosamente',
    type: ApiResponseDto,
  })
  async listContractHistory(@Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      if (userInfo.role !== 'model' && userInfo.role !== 'agency') {
        throw new BadRequestException('Solo modelos y agencias pueden ver historial de contratos');
      }

      const history = await this.contractsService.listContractHistory(
        userInfo.userId,
        userInfo.role as 'model' | 'agency',
      );

      return {
        success: true,
        data: history.map(c => this.contractsService.mapContractToDto(c)),
        message: 'Historial de contratos obtenido exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al listar historial', error?.stack, 'listContractHistory', {
        error: error.message,
      });
      throw error;
    }
  }
}

