import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { Private } from 'src/resources/auth/guards/private/private.decorator';
import { CsrfCheck } from 'src/resources/auth/decorators/csrf-check/csrf-check.decorator';
import { AuthorizedRoles } from 'src/resources/auth/decorators/authorized-roles/authorized-roles.decorator';
import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';
import { NATS_SERVICE } from 'src/common/constants/services';
import { ClientProxy } from '@nestjs/microservices';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export type Service = 'auth-ms' | 'main-api' | 'client-gateway';

@Private()
@CsrfCheck()
@AuthorizedRoles(UserRole.SYS_ADMIN)
@Controller('admin/log-level')
export class LogLevelController {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  @Get(':service')
  getLevel(@Param('service') service: Service) {
    return this.client.send(`log-level.${service}`, {});
  }

  @Post()
  setLevel(@Body() { level, service }: { level: LogLevel; service: Service }) {
    return this.client.send(`log-level.change.${service}`, { level });
  }
}
