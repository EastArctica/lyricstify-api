export class TokenEntity {
  clientId: string;
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
  isAnonymous: boolean;
  _notes?: string;

  constructor(partial: Partial<TokenEntity>) {
    Object.assign(this, partial);
  }
}
