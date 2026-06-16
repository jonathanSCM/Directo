import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminLogsQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por admin' })
  @IsOptional()
  @IsUUID()
  admin_id?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de entidad (user, property, subscription, payment)' })
  @IsOptional()
  @IsString()
  entity_type?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
