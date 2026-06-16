import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsOptional } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Refresh token a revocar. Si se omite, se cierran todas las sesiones del usuario.',
  })
  @IsOptional()
  @IsJWT()
  refreshToken?: string;
}
