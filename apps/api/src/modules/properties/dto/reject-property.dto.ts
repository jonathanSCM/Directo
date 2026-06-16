import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectPropertyDto {
  @ApiProperty({ example: 'Las fotos no corresponden a la propiedad.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
