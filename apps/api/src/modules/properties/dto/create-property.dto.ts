import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const OPERATIONS = ['sale', 'rent', 'anticretico'] as const;
export type Operation = (typeof OPERATIONS)[number];

export class CreatePropertyDto {
  @ApiProperty({ example: 'Casa amplia en Equipetrol' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Hermosa casa de 3 dormitorios con jardín...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ format: 'uuid', description: 'ID del tipo de propiedad' })
  @IsUUID()
  property_type_id: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'ID de la zona' })
  @IsOptional()
  @IsUUID()
  zone_id?: string;

  @ApiProperty({ enum: OPERATIONS, example: 'sale' })
  @IsIn(OPERATIONS)
  operation: Operation;

  @ApiProperty({ example: 120000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Av. San Martín #123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: -17.76 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -63.19 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 180.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  area_m2?: number;

  @ApiPropertyOptional({ example: '+59170000000', description: 'Teléfono de contacto para la propiedad' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contact_phone?: string;

  @ApiPropertyOptional({ example: '+59170000000', description: 'WhatsApp del propietario' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;
}
