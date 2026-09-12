// Mock para expo-server-sdk nos testes e2e.
// O pacote é ESM puro (type: module, sem build CJS); os testes auth/tenant
// não exercitam envio de push de verdade, um stub CJS é suficiente pro
// módulo carregar sem erro.
class ExpoMock {
  chunkPushNotifications(messages) {
    return [messages];
  }

  async sendPushNotificationsAsync() {
    return [];
  }
}

ExpoMock.isExpoPushToken = (token) =>
  typeof token === 'string' && token.startsWith('ExponentPushToken');

module.exports = { Expo: ExpoMock };
