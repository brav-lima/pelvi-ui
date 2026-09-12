import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { ExpoPushService } from './expo-push.service';

@Module({
  controllers: [DeviceController],
  providers: [DeviceService, ExpoPushService],
  exports: [ExpoPushService],
})
export class DeviceModule {}
