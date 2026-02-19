import { OmitType } from '@nestjs/swagger';
import { AuthUser } from '../entities/auth-user.entity';

export class UserResponseDTO extends OmitType(AuthUser, ['hash'] as const) {}
