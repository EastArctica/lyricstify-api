import { HttpService } from '@nestjs/axios';
import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosRequestConfig } from 'axios';
import { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import { httpCatchAxiosError } from '../common/http/http.catch-axios-error';
import { TokenEntity } from './entities/token.entity';
import { TOTP, Secret } from 'otpauth';

@Injectable()
export class TokenService {
  private readonly baseURL: string = 'https://open.spotify.com';

  private readonly headers: AxiosRequestConfig['headers'] = {
    Accept: 'application/json',
    'App-Platform': 'WebPlayer',
    Cookie: this.configService.get<string>('app.spotifyCookie'),
  };

  private readonly totpSecretHex: string =
    '333736313336333837353338343539383933383833333132333130393131393932383437313132343438383934343130323130353131323937313038';
  private readonly totpVersion: string = '61';
  private readonly totp = new TOTP({
    period: 30,
    algorithm: 'SHA1',
    digits: 6,
    secret: Secret.fromHex(this.totpSecretHex),
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create() {
    const code = this.totp.generate({ timestamp: Date.now() });
    const request$ = this.httpService
      .get<TokenEntity>('/api/token', {
        baseURL: this.baseURL,
        headers: this.headers,
        params: {
          reason: 'init',
          productType: 'web-player',
          totp: code,
          totpServer: code,
          totpVer: this.totpVersion,
        },
      })
      .pipe(
        httpCatchAxiosError({
          defaultStatusText:
            'Failed to retrieve Spotify internal token, please check your SPOTIFY_COOKIE environment',
        }),
      );

    const { data: token } = await firstValueFrom(request$);

    if (token.isAnonymous === true) {
      throw new InternalServerErrorException(
        'Your token is treated as anonymous, please check your SPOTIFY_COOKIE environment.',
      );
    }

    return new TokenEntity(token);
  }

  async findOneOrCreate() {
    const key = 'access_token';
    const cached = await this.cacheManager.get<TokenEntity>(key);

    if (cached !== undefined) {
      return cached;
    }

    const token = await this.create();
    await this.cacheManager.set(
      key,
      token,
      // Make sure the cached token is expired 5s faster before its actual expired time
      token.accessTokenExpirationTimestampMs - 5000 - new Date().getTime(),
    );

    return token;
  }
}
