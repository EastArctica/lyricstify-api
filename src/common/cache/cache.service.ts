import {
  type CacheModuleOptions,
  type CacheOptionsFactory,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

@Injectable()
export class CacheService implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  async createCacheOptions(): Promise<CacheModuleOptions> {
    const ttl = this.configService.get<number>('redis.ttl');
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');
    const password = this.configService.get<string>('redis.password');
    const tlsEnabled = this.configService.get<boolean>('redis.tlsEnabled');

    if (host !== undefined && port !== undefined) {
      const redisOptions: Parameters<typeof redisStore>[0] = {
        host,
        port,
        password,
        ttl,
      };

      if (tlsEnabled) {
        redisOptions.tls = {};
      }

      return {
        store: await redisStore(redisOptions),
      };
    }

    return {};
  }
}
