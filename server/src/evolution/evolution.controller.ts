import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EvolutionService } from './evolution.service';

@ApiTags('Evolutions')
@Controller('evolutions')
export class EvolutionController {
  constructor(private readonly evolutionService: EvolutionService) {}
}
