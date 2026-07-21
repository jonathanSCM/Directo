import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateQrSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  account_holder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  account_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}
