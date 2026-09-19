import { IsString } from 'class-validator';

export class PatientLogoutDto {
  @IsString()
  refreshToken!: string;
}
