import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { RoleMode } from '../types/jwt-payload.interface';

export class SwitchRoleDto {
  @ApiProperty({ enum: ['buyer', 'owner'], example: 'owner' })
  @IsIn(['buyer', 'owner'])
  role: RoleMode;
}
