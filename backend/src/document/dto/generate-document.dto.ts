import { IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Contexto livre — cada template valida o que precisa internamente.
export class GenerateDocumentDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  context: Record<string, string> = {};
}
