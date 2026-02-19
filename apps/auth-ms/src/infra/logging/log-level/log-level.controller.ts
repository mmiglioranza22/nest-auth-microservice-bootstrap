import { MessagePattern, Payload } from '@nestjs/microservices';
import { Controller } from '@nestjs/common';
import { type LogLevel, LogLevelService } from './log-level.service';

@Controller()
export class LogLevelController {
  constructor(private readonly service: LogLevelService) {}

  @MessagePattern('log-level.auth-ms')
  getLevel() {
    return { level: this.service.getLevel() };
  }
  @MessagePattern('log-level.change.auth-ms')
  setLevel(@Payload() level: LogLevel) {
    this.service.setLevel(level);
    return { level };
  }
}
