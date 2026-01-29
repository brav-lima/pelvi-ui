import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProcedureService } from './procedure.service';

@ApiTags('Procedures')
@Controller('procedures')
export class ProcedureController {
  constructor(private readonly procedureService: ProcedureService) {}
}
