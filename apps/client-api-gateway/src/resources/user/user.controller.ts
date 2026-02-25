import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Inject,
} from '@nestjs/common';
import { CreateUserDTO } from './dto/create-user.dto';
import { UpdateUserDTO } from './dto/update-user.dto';
import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';
import { Private } from 'src/resources/auth/guards/private/private.decorator';
import { UUIDParam } from 'src/common/decorators/uuid-param/uuid-param.decorator';
import { GetUser } from 'src/resources/auth/decorators/get-user/get-user.decorator';
import { type RequestAgent } from 'src/resources/auth/interfaces/request-agent.interface';
import { Protected } from 'src/resources/auth/decorators/protected/protected.decorator';
import { AuthorizedRoles } from 'src/resources/auth/decorators/authorized-roles/authorized-roles.decorator';
import { UserResponseDTO } from './dto/user-response.dto';
import { CsrfCheck } from 'src/resources/auth/decorators/csrf-check/csrf-check.decorator';
import { API_TAG } from 'src/swagger/constants';
import { NATS_SERVICE } from 'src/common/constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

@ApiTags(API_TAG.User.name)
@Private()
@Controller('user')
export class UserController {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  @Protected()
  @Post()
  createUser(
    @Body() createUserDto: CreateUserDTO,
    @GetUser() agent: RequestAgent,
  ): Observable<UserResponseDTO | null> {
    return this.client.send('user.create', { createUserDto, agent });
  }

  @Get()
  findAll() {
    return this.client.send('user.find.all', {});
  }

  @Get(':id')
  findOne(@UUIDParam('id') id: string) {
    return this.client.send('user.find.by.id', { id });
  }

  @Protected()
  @Patch('deactivate/:id')
  deactivateUser(@UUIDParam('id') id: string, @GetUser() agent: RequestAgent) {
    return this.client.send('user.deactivate.by.id', { id, agent });
  }

  @Protected()
  @Patch(':id')
  update(
    @UUIDParam('id') id: string,
    @Body() updateUserDto: UpdateUserDTO,
    @GetUser() agent: RequestAgent,
  ) {
    return this.client.send('user.update.by.id', { id, updateUserDto, agent });
  }

  @AuthorizedRoles(UserRole.SYS_ADMIN)
  @CsrfCheck()
  @Delete(':id')
  delete(@UUIDParam('id') id: string, @GetUser() agent: RequestAgent) {
    return this.client.send('user.delete', { id, agent });
  }
}
