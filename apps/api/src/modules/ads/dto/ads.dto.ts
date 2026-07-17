import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

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
