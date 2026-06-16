import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

const PAYMENT_METHODS = ['qr', 'visa', 'paypal'] as const;

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid', description: 'Suscripción pendiente de pago' })
  @IsUUID()
  subscription_id: string;

  @ApiProperty({ enum: PAYMENT_METHODS, description: 'Método de pago' })
  @IsIn(PAYMENT_METHODS)
  method: string;
}
