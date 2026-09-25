import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class QueryBowelDiaryEntriesDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Data inicial inválida' })
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Data final inválida' })
  to?: Date;
}
