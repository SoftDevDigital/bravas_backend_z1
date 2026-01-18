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
   * Listar contratos del usuario con filtros avanzados
   * 
   * **OPTIMIZADO:** Ahora unifica contratos activos, propuestas e historial con query params
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '📋 Listar contratos (Optimizado con queries)',
    description: `
**¿Para qué sirve?**
Lista contratos del usuario con filtros avanzados usando query parameters.

**Query params:**
- \`type\`: Tipo de contratos a obtener
  - \`active\`: Solo contratos activos (default)
  - \`proposals\`: Solo propuestas (equivalente a GET /contracts/proposals)
  - \`history\`: Solo historial de contratos terminados (equivalente a GET /contracts/history)
  - \`all\`: Todos los contratos (activos, propuestas e historial)
- \`status\`: Filtrar por estado (solo si type=proposals)
  - \`pending\`: Propuestas pendientes (default para propuestas)
  - \`accepted\`: Propuestas aceptadas
  - \`rejected\`: Propuestas rechazadas
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20, max: 100)

**Ejemplos:**
- \`GET /contracts\` - Contratos activos (default)
- \`GET /contracts?type=active\` - Contratos activos explícitamente
- \`GET /contracts?type=proposals&status=pending\` - Propuestas pendientes
- \`GET /contracts?type=history\` - Historial de contratos terminados
- \`GET /contracts?type=all\` - Todos los contratos y propuestas

**Restricciones:**
- Solo modelos y agencias pueden usar este endpoint
    `.trim(),
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['active', 'proposals', 'history', 'all'],
    description: 'Tipo de contratos: active (activos), proposals (propuestas), history (historial), all (todos)',
    example: 'active',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'accepted', 'rejected'],
    description: 'Estado de propuestas (solo aplica si type=proposals)',
    example: 'pending',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página (default: 1)',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Resultados por página (default: 20, max: 100)',
    type: Number,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de contratos obtenida exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '❌ Parámetros inválidos o rol no permitido',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  async listContracts(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      if (userInfo.role !== 'model' && userInfo.role !== 'agency') {
        throw new BadRequestException('Solo modelos y agencias pueden ver contratos');
      }

      const contractType = type || 'active'; // Default: active
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 20;

      let result: any[] = [];

      // Si type=proposals, usar listProposals
      if (contractType === 'proposals') {
        const proposals = await this.contractsService.listProposals(
          userInfo.userId,
          userInfo.role as 'model' | 'agency',
          status || 'pending',
        );
        result = proposals.map(p => this.contractsService.mapProposalToDto(p));
      }
      // Si type=history, usar listContractHistory
      else if (contractType === 'history') {
        const history = await this.contractsService.listContractHistory(
          userInfo.userId,
          userInfo.role as 'model' | 'agency',
        );
        result = history.map(c => this.contractsService.mapContractToDto(c));
      }
      // Si type=all, obtener todos
      else if (contractType === 'all') {
        const active = await this.contractsService.listContracts(
          userInfo.userId,
          userInfo.role as 'model' | 'agency',
          false, // Solo activos
        );
        const proposals = await this.contractsService.listProposals(
          userInfo.userId,
          userInfo.role as 'model' | 'agency',
          undefined, // Todas las propuestas
        );
        const history = await this.contractsService.listContractHistory(
          userInfo.userId,
          userInfo.role as 'model' | 'agency',
        );
        
        result = [
          ...active.map(c => ({ ...this.contractsService.mapContractToDto(c), itemType: 'contract' })),
          ...proposals.map(p => ({ ...this.contractsService.mapProposalToDto(p), itemType: 'proposal' })),
          ...history.map(c => ({ ...this.contractsService.mapContractToDto(c), itemType: 'history' })),
        ];
        
        // Ordenar por fecha descendente
        result.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      }
      // Default: active contracts
      else {
        const contracts = await this.contractsService.listContracts(
          userInfo.userId,
          userInfo.role as 'model' | 'agency',
          false, // Solo activos y en proceso de terminación
        );
        result = contracts.map(c => this.contractsService.mapContractToDto(c));
      }

      // Aplicar paginación
      const skip = (pageNum - 1) * limitNum;
      const paginatedResult = result.slice(skip, skip + limitNum);

      return {
        success: true,
        data: paginatedResult,
        message: 'Contratos obtenidos exitosamente',
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.length,
          totalPages: Math.ceil(result.length / limitNum),
          hasMore: skip + limitNum < result.length,
        },
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
   * 
   * **IMPORTANTE:** Esta ruta debe estar ANTES de @Get(':contractId') para evitar conflictos de routing
   * 
   * **NOTA:** Este endpoint se mantiene por compatibilidad, pero se recomienda usar \`GET /contracts?type=proposals\`
   */
  @Get('proposals')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '📋 Listar propuestas de contrato (Deprecado - usar GET /contracts?type=proposals)',
    description: `
**¿Para qué sirve?**
Retorna todas las propuestas de contrato del usuario.

**⚠️ DEPRECADO:** Este endpoint se mantiene por compatibilidad. Se recomienda usar:
\`GET /contracts?type=proposals&status={status}\`

**Query params:**
- \`status\`: Filtrar por estado (pending, accepted, rejected)
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20)
    `.trim(),
  })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'accepted', 'rejected'], description: 'Filtrar por estado' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Resultados por página', type: Number })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de propuestas obtenida exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '❌ Rol no permitido',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  async listProposals(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
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

      // Aplicar paginación
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 20;
      const skip = (pageNum - 1) * limitNum;
      const paginatedProposals = proposals.slice(skip, skip + limitNum);

      return {
        success: true,
        data: paginatedProposals.map(p => this.contractsService.mapProposalToDto(p)),
        message: 'Propuestas obtenidas exitosamente',
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: proposals.length,
          totalPages: Math.ceil(proposals.length / limitNum),
          hasMore: skip + limitNum < proposals.length,
        },
      };
    } catch (error: any) {
      this.logger.error('Error al listar propuestas', error?.stack, 'listProposals', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /contracts/history
   * Listar historial de contratos terminados
   * 
   * **IMPORTANTE:** Esta ruta debe estar ANTES de @Get(':contractId') para evitar conflictos de routing
   * 
   * **NOTA:** Este endpoint se mantiene por compatibilidad, pero se recomienda usar \`GET /contracts?type=history\`
   */
  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '📋 Historial de contratos terminados (Deprecado - usar GET /contracts?type=history)',
    description: `
**¿Para qué sirve?**
Retorna todos los contratos terminados del usuario.

**⚠️ DEPRECADO:** Este endpoint se mantiene por compatibilidad. Se recomienda usar:
\`GET /contracts?type=history\`

**Query params:**
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20)
    `.trim(),
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Resultados por página', type: Number })
  @ApiResponse({
    status: 200,
    description: '✅ Historial de contratos obtenido exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '❌ Rol no permitido',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  async listContractHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      if (userInfo.role !== 'model' && userInfo.role !== 'agency') {
        throw new BadRequestException('Solo modelos y agencias pueden ver historial de contratos');
      }

      const history = await this.contractsService.listContractHistory(
        userInfo.userId,
        userInfo.role as 'model' | 'agency',
      );

      // Aplicar paginación
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 20;
      const skip = (pageNum - 1) * limitNum;
      const paginatedHistory = history.slice(skip, skip + limitNum);

      return {
        success: true,
        data: paginatedHistory.map(c => this.contractsService.mapContractToDto(c)),
        message: 'Historial de contratos obtenido exitosamente',
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: history.length,
          totalPages: Math.ceil(history.length / limitNum),
          hasMore: skip + limitNum < history.length,
        },
      };
    } catch (error: any) {
      this.logger.error('Error al listar historial', error?.stack, 'listContractHistory', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /contracts/:contractId
   * Obtener contrato por ID
   * 
   * **IMPORTANTE:** Este endpoint debe estar DESPUÉS de todas las rutas específicas (/contracts/proposals, /contracts/history)
   * para evitar conflictos de routing. En NestJS, las rutas más específicas deben definirse primero.
   */
  @Get(':contractId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '📄 Obtener contrato por ID',
    description: `
**¿Para qué sirve?**
Obtiene los detalles completos de un contrato específico por su ID.

**Casos de uso:**
- Ver detalles completos de un contrato activo
- Revisar información de un contrato terminado
- Verificar términos y condiciones de un contrato

**Información incluida:**
- Datos de participantes (agencia y modelo)
- Términos del contrato (porcentajes, comisiones)
- Fechas importantes (inicio, terminación)
- Estadísticas (ganancias totales, número de pagos)
- Estado del contrato
- URL del PDF del contrato (si existe)

**Restricciones:**
- Solo puedes ver contratos donde eres participante (agencia o modelo)
- Si el contrato no existe o no tienes acceso, retorna 404

**Ejemplo de uso:**
\`\`\`
GET /contracts/contract_agency123_model456_1234567890
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "contractId": "contract_agency123_model456_1234567890",
    "agencyId": "agency_123",
    "modelId": "model_456",
    "agencyName": "Model Agency Pro",
    "modelName": "Ana Martínez",
    "modelPercentage": 88,
    "agencyPercentage": 12,
    "status": "active",
    "startDate": "2024-01-15T10:00:00Z",
    "totalEarnings": 500000,
    "pdfUrl": "https://cdn.bravas.com/contracts/contract_123.pdf"
  },
  "message": "Contrato obtenido exitosamente"
}
\`\`\`
    `.trim(),
  })
  @ApiParam({ name: 'contractId', description: 'ID único del contrato', example: 'contract_agency123_model456_1234567890' })
  @ApiResponse({
    status: 200,
    description: '✅ Contrato obtenido exitosamente',
    type: ContractDto,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ No tienes acceso a este contrato',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Contrato no encontrado',
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

}

