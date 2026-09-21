import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { EXPO_PUSH_TOKEN_PATTERN } from './expo-push-token.util';

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
    if (!EXPO_PUSH_TOKEN_PATTERN.test(expoPushToken)) {
      throw new BadRequestException('expoPushToken possui formato inválido');
    }

    await this.prisma.deviceToken.deleteMany({
      // Cast to primitive string right at the query boundary — blocks object/operator
      // injection into Prisma's `where` even if a caller ever skips the DTO validation above.
      where: { expoPushToken: String(expoPushToken), personId: String(personId) },
    });
  }
}
