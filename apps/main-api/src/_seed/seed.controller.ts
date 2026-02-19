import { Controller, Get } from '@nestjs/common';
import { SeedService } from './seed.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @MessagePattern('main.seed')
  run() {
    return this.seedService.run();
  }
}
