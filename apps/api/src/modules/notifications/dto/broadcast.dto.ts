import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const AUDIENCES = ['all', 'owners'] as const;
export type Audience = (typeof AUDIENCES)[number];

export class BroadcastDto {
  @ApiPropertyOptional({
    enum: AUDIENCES,
    default: 'all',
    description: "Audiencia: 'all' (todos los activos) o 'owners' (propietarios con propiedades)",
  })
  @IsOptional()
  @IsIn(AUDIENCES)
  audience?: Audience = 'all';

  @ApiPropertyOptional({
    type: [String],
    description: 'IDs de usuarios específicos (tiene prioridad sobre audience)',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  user_ids?: string[];

  @ApiProperty({ example: '¡Nueva propiedad en Equipetrol!' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Mira esta casa que acaba de publicarse.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ enum: ['promotion', 'system'], default: 'promotion' })
  @IsOptional()
  @IsIn(['promotion', 'system'])
  type?: 'promotion' | 'system' = 'promotion';

  @ApiPropertyOptional({ description: 'Enlace asociado (p. ej. al detalle de la propiedad)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;
}
