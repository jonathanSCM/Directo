import { IsBoolean } from 'class-validator';

export class SetVerifiedDto {
  @IsBoolean()
  is_verified: boolean;
}
