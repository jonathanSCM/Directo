import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const RESOLVE_STATUSES = ['reviewed', 'dismissed'] as const;

export class ResolveReportDto {
  @ApiProperty({ enum: RESOLVE_STATUSES })
  @IsIn(RESOLVE_STATUSES)
  status: 'reviewed' | 'dismissed';
}
