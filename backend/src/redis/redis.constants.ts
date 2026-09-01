export const REDIS_CLIENT = 'REDIS_CLIENT';

export const orgAccessCacheKey = (organizationId: string) =>
  `cache:org-access:${organizationId}`;

export const subscriptionStatusCacheKey = (organizationId: string) =>
  `subscription:status:${organizationId}`;
