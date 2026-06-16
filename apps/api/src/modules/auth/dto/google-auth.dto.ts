import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'ID token obtenido del cliente Google Sign-In' })
  @IsString()
  idToken: string;
}
