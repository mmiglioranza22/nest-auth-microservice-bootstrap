import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';

interface Role {
  role: UserRole;
}

interface Seed {
  role: Role[];
}

export const seed: Seed = {
  role: [
    {
      role: UserRole.SYS_ADMIN,
    },
    {
      role: UserRole.USER,
    },
    {
      role: UserRole.ADMIN,
    },
    {
      role: UserRole.GUEST,
    },
  ],
};
