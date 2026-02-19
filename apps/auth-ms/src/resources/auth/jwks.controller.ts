import { Controller, Get } from '@nestjs/common';
import { publicKeyToJwk } from 'src/utils/jwk.util';

// TODO Add throttler
@Controller('.well-known')
export class JwksController {
  @Get('jwks.json')
  async getJwks() {
    const jwk = await publicKeyToJwk();
    console.log('hit');
    return {
      keys: [{ ...jwk, use: 'sig', alg: 'RS256', kid: 'auth-key-1' }],
    };
  }
}
