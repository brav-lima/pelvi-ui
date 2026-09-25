// Expo push tokens always look like ExponentPushToken[xxxxx] or ExpoPushToken[xxxxx].
// Enforced before expoPushToken reaches any Prisma `where` clause so a malformed
// (non-string-shaped) value never gets query-planned as a filter object.
export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;
