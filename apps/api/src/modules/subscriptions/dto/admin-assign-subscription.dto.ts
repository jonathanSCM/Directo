import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AdminAssignSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  user_id: string;

  @ApiProperty()
  @IsUUID()
  plan_id: string;
}
