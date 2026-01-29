import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnamnesisService } from './anamnesis.service';

@ApiTags('Anamneses')
@Controller('anamneses')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}
}
