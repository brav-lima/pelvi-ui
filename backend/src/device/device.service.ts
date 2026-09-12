import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async register(personId: string, dto: RegisterDeviceDto) {
    return this.prisma.deviceToken.upsert({
      where: { expoPushToken: dto.expoPushToken },
      update: { personId, platform: dto.platform },
      create: {
        personId,
        expoPushToken: dto.expoPushToken,
        platform: dto.platform,
      },
    });
  }

  async remove(personId: string, expoPushToken: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({
      where: { expoPushToken, personId },
    });
  }
}
