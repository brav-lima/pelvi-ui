import { Controller, Post, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('patient-analysis/:patientId')
  @ApiOperation({ summary: 'Gera análise clínica do paciente com IA' })
  async analyzePatient(
    @OrgId() organizationId: string,
    @Param('patientId') patientId: string,
  ): Promise<{ analysis: string }> {
    const analysis = await this.aiService.analyzePatient(organizationId, patientId);
    return { analysis };
  }
}
