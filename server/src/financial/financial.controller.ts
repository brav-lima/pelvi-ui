import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinancialService } from './financial.service';

@ApiTags('Financial')
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}
}
