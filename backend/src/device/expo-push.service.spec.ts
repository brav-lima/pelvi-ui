jest.mock('expo-server-sdk', () => {
  const sendPushNotificationsAsync = jest.fn().mockResolvedValue([{ status: 'ok' }]);
  const chunkPushNotifications = jest.fn((messages: unknown[]) => [messages]);
  const ExpoMock: any = jest.fn().mockImplementation(() => ({
    chunkPushNotifications,
    sendPushNotificationsAsync,
  }));
  ExpoMock.isExpoPushToken = jest.fn((token: string) => token.startsWith('ExponentPushToken'));
  return { Expo: ExpoMock };
});

import { Expo } from 'expo-server-sdk';
import { ExpoPushService } from './expo-push.service';

describe('ExpoPushService', () => {
  let service: ExpoPushService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExpoPushService();
  });

  it('valida token via Expo.isExpoPushToken', () => {
    expect(service.isValidToken('ExponentPushToken[abc]')).toBe(true);
    expect(service.isValidToken('token-invalido')).toBe(false);
  });

  it('divide mensagens em chunks e envia cada chunk', async () => {
    const messages = [{ to: 'ExponentPushToken[abc]', title: 't', body: 'b' }];

    await service.send(messages as any);

    const expoInstance = (Expo as unknown as jest.Mock).mock.results[0].value;
    expect(expoInstance.chunkPushNotifications).toHaveBeenCalledWith(messages);
    expect(expoInstance.sendPushNotificationsAsync).toHaveBeenCalledWith(messages);
  });
});
