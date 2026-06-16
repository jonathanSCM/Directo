import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

const PAYMENT_STATUSES = [
  'pending',
  'in_review',
  'confirmed',
  'rejected',
  'cancelled',
  'refunded',
] as const;

const PAYMENT_METHODS = ['qr', 'visa', 'paypal'] as const;

export class PaymentsQueryDto {
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  user_id?: string;
}
