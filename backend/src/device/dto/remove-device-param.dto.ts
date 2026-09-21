import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { EXPO_PUSH_TOKEN_PATTERN } from '../expo-push-token.util';

export class RemoveDeviceParamDto {
  @IsString()
  @IsNotEmpty({ message: 'expoPushToken é obrigatório' })
  @Matches(EXPO_PUSH_TOKEN_PATTERN, { message: 'expoPushToken possui formato inválido' })
  expoPushToken: string;
}
