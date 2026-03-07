import { IsBoolean, IsIn, IsNumber, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  whatsappNotificationsEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @IsIn([3, 6, 12, 24])
  reminderHours?: number;
}
