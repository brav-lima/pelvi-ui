import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DevicePlatform } from '@prisma/client';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty({ message: 'expoPushToken é obrigatório' })
  expoPushToken: string;

  @IsEnum(DevicePlatform, { message: 'platform deve ser IOS ou ANDROID' })
  platform: DevicePlatform;
}
