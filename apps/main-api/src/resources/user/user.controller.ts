import { MessagePattern, Payload } from '@nestjs/microservices';
import { Controller } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDTO } from './dto/create-user.dto';
import { UpdateUserDTO } from './dto/update-user.dto';
import { UserResponseDTO } from './dto/user-response.dto';
import { type RequestAgent } from 'src/common/interfaces/request-agent.interface';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern('user.create')
  createUser(
    @Payload()
    {
      createUserDto,
      agent,
    }: {
      createUserDto: CreateUserDTO;
      agent: RequestAgent;
    },
  ): Promise<UserResponseDTO | null> {
    return this.userService.createUser(createUserDto, agent);
  }

  @MessagePattern('user.find.all')
  findAll() {
    return this.userService.findAll();
  }

  @MessagePattern('user.find.by.id')
  findOne(@Payload() { id }: { id: string }) {
    return this.userService.findOneById(id);
  }

  @MessagePattern('user.deactivate.by.id')
  deactivateUser(
    @Payload() { id, agent }: { id: string; agent: RequestAgent },
  ) {
    return this.userService.deactivateUser(id, agent);
  }

  @MessagePattern('user.update.by.id')
  update(
    @Payload()
    {
      id,
      updateUserDto,
      agent,
    }: {
      id: string;
      updateUserDto: UpdateUserDTO;
      agent: RequestAgent;
    },
  ) {
    return this.userService.updateUser(id, updateUserDto, agent);
  }

  @MessagePattern('user.delete')
  delete(@Payload() { id, agent }: { id: string; agent: RequestAgent }) {
    return this.userService.deleteUser(id, agent);
  }
}
