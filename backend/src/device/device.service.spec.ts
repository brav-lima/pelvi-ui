import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceService', () => {
  let service: DeviceService;
  let prisma: { deviceToken: any };

  beforeEach(async () => {
    prisma = {
      deviceToken: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DeviceService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DeviceService>(DeviceService);
  });

  it('registra um device token via upsert pelo expoPushToken', async () => {
    prisma.deviceToken.upsert.mockResolvedValue({ id: 'device-1' });

    await service.register('person-1', {
      expoPushToken: 'ExponentPushToken[abc]',
      platform: 'IOS' as any,
    });

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
      where: { expoPushToken: 'ExponentPushToken[abc]' },
      update: { personId: 'person-1', platform: 'IOS' },
      create: {
        personId: 'person-1',
        expoPushToken: 'ExponentPushToken[abc]',
        platform: 'IOS',
      },
    });
  });

  it('remove um device token só se pertencer à pessoa autenticada', async () => {
    prisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

    await service.remove('person-1', 'ExponentPushToken[abc]');

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { expoPushToken: 'ExponentPushToken[abc]', personId: 'person-1' },
    });
  });
});
