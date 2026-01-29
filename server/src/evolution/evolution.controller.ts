import { Controller } from '@nestjs/common';
import { EvolutionService } from './evolution.service';

@Controller('evolutions')
export class EvolutionController {
  constructor(private readonly evolutionService: EvolutionService) {}
}
