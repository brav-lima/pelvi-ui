import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProfessionalService } from './professional.service';

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalController {
  constructor(
    private readonly professionalService: ProfessionalService,
  ) {}
}
