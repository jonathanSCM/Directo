import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token emitido en login/registro.' })
  @IsJWT()
  refreshToken: string;
}
