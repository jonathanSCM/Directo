import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendUserDto {
  @ApiPropertyOptional({ description: 'Motivo de la suspensión' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
