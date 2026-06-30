import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkAppointmentItemDto {
  @IsUUID('4') patientId: string;
  @IsUUID('4') professionalId: string;
  @IsUUID('4') procedureId: string;
  @IsDateString() startAt: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID('4') treatmentPackageId?: string;
  @IsInt() @Min(0) recurrenceIndex: number;
}

export class CreateBulkAppointmentDto {
  @IsUUID('4') recurrenceGroupId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAppointmentItemDto)
  appointments: BulkAppointmentItemDto[];
}
