import { MessagePattern, Payload } from '@nestjs/microservices';
import { Controller } from '@nestjs/common';
import { LogLevel, LogLevelService } from './log-level.service';

@Controller()
export class LogLevelController {
  constructor(private readonly service: LogLevelService) {}

  @MessagePattern('log-level.main-api')
  getLevel() {
    return { level: this.service.getLevel() };
  }
  @MessagePattern('log-level.change.main-api')
  setLevel(@Payload() level: LogLevel) {
    this.service.setLevel(level);
    return { level };
  }
}
