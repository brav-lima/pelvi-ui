import { IsOptional, IsString } from 'class-validator';

export class QueryProfessionalDto {
  @IsOptional()
  @IsString()
  search?: string;
}
