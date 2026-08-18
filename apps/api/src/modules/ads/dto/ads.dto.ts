import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Constructora Andina' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'https://miempresa.com' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo_url?: string;
}

export class CreateAdDto {
  @ApiProperty({ example: 'Departamentos en preventa' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'https://miempresa.com/promo' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  link_url?: string;

  @ApiPropertyOptional({
    description:
      'IDs de zona objetivo, como JSON stringificado (ej. \'["uuid1","uuid2"]\'). Vacío = se muestra en cualquier sector.',
    example: '["3fa85f64-5717-4562-b3fc-2c963f66afa6"]',
  })
  @IsOptional()
  @IsString()
  zone_ids?: string;
}

/** Anuncio "casa" creado directamente por el admin, sin empresa/suscripción de por medio. */
export class AdminCreateAdDto {
  @ApiProperty({ example: 'Constructora Andina — Preventa' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'https://miempresa.com/promo' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  link_url?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del anuncio (ISO). Vacío = sin vencimiento.',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @ApiPropertyOptional({
    enum: ['banner', 'popup', 'both'],
    description:
      'Dónde se muestra: "banner" (tarjeta chica en el detalle de propiedad), "popup" (modal al entrar a Explorar) o "both" (ambos).',
    default: 'both',
  })
  @IsOptional()
  @IsIn(['banner', 'popup', 'both'])
  placement?: 'banner' | 'popup' | 'both';

  @ApiPropertyOptional({
    description:
      'IDs de zona objetivo, como JSON stringificado. Vacío = se muestra en cualquier sector.',
    example: '["3fa85f64-5717-4562-b3fc-2c963f66afa6"]',
  })
  @IsOptional()
  @IsString()
  zone_ids?: string;
}

export class AdminUpdateAdDto {
  @ApiPropertyOptional({ example: 'Constructora Andina — Preventa' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 'https://miempresa.com/promo' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  link_url?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @ApiPropertyOptional({ enum: ['active', 'paused'] })
  @IsOptional()
  @IsIn(['active', 'paused'])
  status?: 'active' | 'paused';

  @ApiPropertyOptional({
    enum: ['banner', 'popup', 'both'],
    description:
      'Dónde se muestra: "banner" (tarjeta chica en el detalle de propiedad), "popup" (modal al entrar a Explorar) o "both" (ambos).',
  })
  @IsOptional()
  @IsIn(['banner', 'popup', 'both'])
  placement?: 'banner' | 'popup' | 'both';
}
