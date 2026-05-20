import { Global, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({ url: config.getOrThrow<string>('REDIS_URL') }),
        ttl: 30_000,
      }),
    }),
  ],
})
export class AppCacheModule {}
