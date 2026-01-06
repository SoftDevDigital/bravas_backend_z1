import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check básico' })
  @ApiResponse({ status: 200, description: 'Servicio saludable' })
  health() {
    return {
      status: 'ok',
      service: 'contracts-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check detallado' })
  @ApiResponse({ status: 200, description: 'Información detallada del servicio' })
  detailed() {
    return {
      status: 'ok',
      service: 'contracts-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev',
      uptime: process.uptime(),
    };
  }
}















