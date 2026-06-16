import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Profesional' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 24.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({ example: 30, description: 'Duración de la suscripción en días' })
  @IsInt()
  @Min(1)
  duration_days: number;

  @ApiPropertyOptional({ description: 'Máx. propiedades activas (omitir = ilimitado)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  max_active_properties?: number;

  @ApiPropertyOptional({ description: 'Máx. fotos por propiedad (omitir = ilimitado)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  max_images_per_property?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allows_featured?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includes_statistics?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  priority_in_results?: boolean;

  @ApiPropertyOptional({ description: 'Duración de cada publicación en días' })
  @IsOptional()
  @IsInt()
  @Min(1)
  publication_duration_days?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
