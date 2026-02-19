import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisFactory } from './redis.factory';

@Global()
@Module({
  providers: [RedisFactory, CacheService],
  exports: [CacheService],
})
export class CacheModule {}
