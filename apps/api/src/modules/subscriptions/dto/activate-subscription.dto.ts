import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ActivateSubscriptionDto {
  @ApiProperty({ format: 'uuid', description: 'Plan a contratar' })
  @IsUUID()
  plan_id: string;

  @ApiPropertyOptional({
    description:
      'Cantidad de propiedades a publicar (las que excedan las incluidas del plan se cobran como extra)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  property_count?: number;
}

export class RenewSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Nueva cantidad de propiedades (por defecto, la actual)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  property_count?: number;
}
