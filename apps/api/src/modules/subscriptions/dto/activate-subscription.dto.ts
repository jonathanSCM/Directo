import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ActivateSubscriptionDto {
  @ApiProperty({ format: 'uuid', description: 'Plan a contratar' })
  @IsUUID()
  plan_id: string;
}
