import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GeocodeQueryDto {
  @ApiProperty({ example: 'Av. San Martín 123, Equipetrol' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  address: string;

  @ApiPropertyOptional({ example: 'Santa Cruz de la Sierra' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;
}
