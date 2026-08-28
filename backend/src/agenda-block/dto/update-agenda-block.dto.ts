import { PartialType } from '@nestjs/swagger';
import { CreateAgendaBlockDto } from './create-agenda-block.dto';

export class UpdateAgendaBlockDto extends PartialType(CreateAgendaBlockDto) {}
