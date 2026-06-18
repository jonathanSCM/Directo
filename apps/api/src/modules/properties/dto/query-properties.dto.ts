import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { OPERATIONS } from './create-property.dto';
import type { Operation } from './create-property.dto';

export const SORTS = ['recent', 'price_asc', 'price_desc', 'relevance'] as const;
export type Sort = (typeof SORTS)[number];

/** Filtros del listado público de propiedades (§7). */
export class QueryPropertiesDto {
  @ApiPropertyOptional({ description: 'Búsqueda por texto (título/descripción)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Slug del tipo de propiedad', example: 'casa' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'ID de la zona' })
  @IsOptional()
  @IsUUID()
  zone_id?: string;

  @ApiPropertyOptional({ example: 'Santa Cruz de la Sierra' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: OPERATIONS })
  @IsOptional()
  @IsIn(OPERATIONS)
  operation?: Operation;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_price?: number;

  @ApiPropertyOptional({ example: 200000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  @ApiPropertyOptional({ description: 'Mínimo de habitaciones', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ description: 'Mínimo de baños', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  // Bounding box para el mapa (§5) — legacy, aún soportado
  @ApiPropertyOptional({ description: 'Latitud mínima (bbox del mapa)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  min_lat?: number;

  @ApiPropertyOptional({ description: 'Latitud máxima (bbox del mapa)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  max_lat?: number;

  @ApiPropertyOptional({ description: 'Longitud mínima (bbox del mapa)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  min_lng?: number;

  @ApiPropertyOptional({ description: 'Longitud máxima (bbox del mapa)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  max_lng?: number;

  // Radio-based filtering (preferred over bbox)
  @ApiPropertyOptional({ description: 'Latitud del centro de búsqueda' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud del centro de búsqueda' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Radio en km', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(100)
  radius_km?: number;

  @ApiPropertyOptional({ enum: SORTS, default: 'recent' })
  @IsOptional()
  @IsIn(SORTS)
  sort?: Sort = 'recent';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
