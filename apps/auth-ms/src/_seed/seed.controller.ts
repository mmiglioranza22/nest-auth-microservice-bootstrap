import { Controller } from '@nestjs/common';
import { SeedService } from './seed.service';
import { Ctx, MessagePattern, NatsContext } from '@nestjs/microservices';

@Controller()
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @MessagePattern('auth.seed')
  run(@Ctx() context: NatsContext) {
    return this.seedService.run();
  }
}
