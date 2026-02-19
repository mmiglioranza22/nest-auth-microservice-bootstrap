import { AuthUser } from 'src/resources/auth/modules/auth-user/entities/auth-user.entity';
import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';

export type RequestAgent = Pick<AuthUser, 'id' | 'active'> & {
  roles: UserRole[];
};
