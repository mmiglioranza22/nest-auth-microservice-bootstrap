import { PickType } from '@nestjs/swagger';
import { UserResponseDTO } from './user-response.dto';

// TODO rename/delete
export class QuestUserResponseDTO extends PickType(UserResponseDTO, [
  'id',
  'name',
  'username',
  'active',
] as const) {}
