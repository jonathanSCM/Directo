import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsOptional } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Refresh token emitido en login/registro. Opcional: el panel admin lo manda vía cookie httpOnly en vez del body.',
  })
  @IsOptional()
  @IsJWT()
  refreshToken?: string;
}
