import { Controller } from '@nestjs/common';
import { AnamnesisService } from './anamnesis.service';

@Controller('anamneses')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}
}
