import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export enum PlanType {
  BASIC = 'basic',
  PREMIUM = 'premium',
  VIP = 'vip',
}

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'ID del usuario que se suscribe',
    example: 'user_123',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'ID del creador/modelo',
    example: 'model_456',
  })
  @IsString()
  recipientId: string;

  @ApiProperty({
    description: 'Tipo de plan',
    enum: PlanType,
    example: PlanType.PREMIUM,
  })
  @IsEnum(PlanType)
  planType: PlanType;

  @ApiProperty({
    description: 'Monto mensual en centavos',
    example: 1999,
    minimum: 100, // Mínimo $1.00
  })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({
    description: 'Moneda',
    example: 'usd',
    default: 'usd',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Stripe Customer ID del usuario',
    example: 'cus_1234567890',
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: 'Stripe Connect Account ID del creador',
    example: 'acct_1234567890',
  })
  @IsString()
  connectedAccountId: string;

  @ApiProperty({
    description: 'ID de agencia (opcional)',
    example: 'agency_789',
    required: false,
  })
  @IsString()
  @IsOptional()
  agencyId?: string;

  @ApiProperty({
    description: 'Clave de idempotencia (opcional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}























