import { Module } from '@nestjs/common';
import { VersionController } from './version.controller';
import { InfoController } from './info.controller';

@Module({
  controllers: [VersionController, InfoController],
})
export class VersionModule {}
