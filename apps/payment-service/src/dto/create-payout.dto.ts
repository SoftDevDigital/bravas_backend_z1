import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, Min, IsOptional } from 'class-validator';

export class CreatePayoutDto {
  @ApiProperty({
    description: 'ID del creador/modelo que recibe el retiro',
    example: 'model_456',
  })
  @IsString()
  recipientId: string;

  @ApiProperty({
    description: 'Stripe Connect Account ID del creador',
    example: 'acct_1234567890',
  })
  @IsString()
  connectedAccountId: string;

  @ApiProperty({
    description: 'Monto a retirar en centavos',
    example: 10000, // $100.00
    minimum: 1000, // Mínimo $10.00
  })
  @IsNumber()
  @Min(1000)
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
    description: 'IDs de pagos a incluir en este retiro',
    example: ['payment_123', 'payment_456'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  paymentIds: string[];

  @ApiProperty({
    description: 'Clave de idempotencia (opcional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}




















