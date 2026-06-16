import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido en el flujo de recuperación.' })
  @IsString()
  @MinLength(10)
  token: string;

  @ApiProperty({ example: 'NuevoSecreto123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
