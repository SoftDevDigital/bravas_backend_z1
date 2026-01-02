import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsObject, Min, Max } from 'class-validator';

export enum PaymentType {
  TIP = 'tip',
  PPV = 'ppv',
}

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID del usuario que realiza el pago',
    example: 'user_123',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'ID del creador/modelo que recibe el pago',
    example: 'model_456',
  })
  @IsString()
  recipientId: string;

  @ApiProperty({
    description: 'Monto en centavos (ej: 1999 = $19.99)',
    example: 1999,
    minimum: 50, // Mínimo $0.50
  })
  @IsNumber()
  @Min(50)
  amount: number;

  @ApiProperty({
    description: 'Moneda (actualmente solo USD)',
    example: 'usd',
    default: 'usd',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Tipo de pago',
    enum: PaymentType,
    example: PaymentType.TIP,
  })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({
    description: 'Stripe Customer ID del usuario',
    example: 'cus_1234567890',
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: 'Metadatos adicionales (opcional)',
    example: { contentId: 'content_123', messageId: 'msg_456' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;

  @ApiProperty({
    description: 'ID de agencia (si el creador tiene agencia)',
    example: 'agency_789',
    required: false,
  })
  @IsString()
  @IsOptional()
  agencyId?: string;

  @ApiProperty({
    description: 'Clave de idempotencia (opcional, se genera automáticamente si no se proporciona)',
    example: 'user_123_1234567890_abc123',
    required: false,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}














