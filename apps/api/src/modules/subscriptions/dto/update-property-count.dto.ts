import { IsInt, Max, Min } from 'class-validator';

export class UpdatePropertyCountDto {
  @IsInt()
  @Min(1)
  @Max(100)
  property_count: number;
}
