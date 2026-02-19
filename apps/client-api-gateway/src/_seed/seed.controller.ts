import { Controller, Get, Inject } from '@nestjs/common';
import { NATS_SERVICE } from 'src/common/constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('seed')
export class SeedController {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  @Get()
  async runAllSeeds() {
    const response = await Promise.all([
      firstValueFrom(this.client.send('auth.seed', {})),
      firstValueFrom(this.client.send('main.seed', {})),
    ]);
    return response;
  }
}
