import Express from 'express';
import Crypto from 'node:crypto';

export default class Tokens {
  private static readonly ACCESS_TOKEN_PREFIX = 'mcauth_A_';
  private static readonly EXCHANGE_TOKEN_PREFIX = 'mcauth_E_';

  static generateAccessToken(): string {
    return this.generateToken(this.ACCESS_TOKEN_PREFIX);
  }

  static generateExchangeToken(): string {
    return this.generateToken(this.EXCHANGE_TOKEN_PREFIX);
  }

  static checkTokenSyntax(token: string): boolean {
    return token.length === this.getTotalTokenLength() &&
        (token.startsWith(this.ACCESS_TOKEN_PREFIX) || token.startsWith(this.EXCHANGE_TOKEN_PREFIX));
  }

  static extractBearerToken(req: Express.Request): string | null {
    const authHeader = req.headers.authorization;
    if (typeof authHeader != 'string') {
      return null;
    }

    if (!authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7);
  }

  private static generateToken(prefix: string): string {
    let i = 0;
    let token;
    do {
      const tokenBytes = Crypto.randomBytes(21);
      token = `${prefix}${tokenBytes.toString('base64url')}`;

      ++i;
      if (i > 100) {
        throw new Error('Unable to generate a valid token after 100 tries');
      }
    } while (token.includes('-', prefix.length) || token.includes('_', prefix.length));

    return token;
  }

  private static getTotalTokenLength(): number {
    return this.ACCESS_TOKEN_PREFIX.length + 28 || this.EXCHANGE_TOKEN_PREFIX.length + 28;
  }
}
