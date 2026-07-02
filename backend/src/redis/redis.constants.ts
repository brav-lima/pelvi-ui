export const REDIS_CLIENT = 'REDIS_CLIENT';

export const orgAccessCacheKey = (organizationId: string) =>
  `cache:org-access:${organizationId}`;
