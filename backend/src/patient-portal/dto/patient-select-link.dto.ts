import { IsString } from 'class-validator';

export class PatientSelectLinkDto {
  @IsString()
  preAuthToken!: string;

  @IsString()
  linkId!: string;
}
