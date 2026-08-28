import { Module } from '@nestjs/common';
import { AgendaBlockController } from './agenda-block.controller';
import { AgendaBlockService } from './agenda-block.service';

@Module({
  controllers: [AgendaBlockController],
  providers: [AgendaBlockService],
})
export class AgendaBlockModule {}
