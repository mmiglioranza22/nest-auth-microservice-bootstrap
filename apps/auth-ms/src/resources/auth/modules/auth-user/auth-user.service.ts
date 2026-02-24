// https://stackoverflow.com/questions/59645009/how-to-return-only-some-columns-of-a-relations-with-typeorm
import * as ErrorMessages from 'src/common/constants/error-messages';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from './entities/auth-user.entity';

import { CreateUserDTO } from './dto/create-user.dto';
import { UpdateUserDTO } from './dto/update-user.dto';

import {
  checkHash,
  checkAllowedActionOn_User,
  generateHash,
  checkAllowed_User_UpdateAction,
  checkAllowed_User_CreateAction,
} from 'src/utils';

import { LoginSlugDTO } from '../../dto/request/login-slug.dto';
import { type RequestAgent } from 'src/resources/auth/interfaces/request-agent.interface';
import { UserResponseDTO } from './dto/user-response.dto';

import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';
import { Role } from 'src/resources/auth/modules/role/entities/role.entity';
import { RoleService } from 'src/resources/auth/modules/role/role.service';
import { BadRequestRpcException } from 'src/common/exceptions/bad-request-rpc.exception';

type Slug = keyof Pick<AuthUser, 'email' | 'username'>;

@Injectable()
export class AuthUserService {
  constructor(
    @InjectRepository(AuthUser)
    private readonly authUserRepository: Repository<AuthUser>,
    private readonly roleService: RoleService,
  ) {}

  // * Interface of return type should be shared in basic props at least with main api UserService
  async createUser(
    { password, roles, ...rest }: CreateUserDTO,
    agent?: RequestAgent,
  ): Promise<UserResponseDTO | null> {
    // * User / guest check. Auth user creation via signup should skip it
    if (agent) {
      const canPerformAction = checkAllowed_User_CreateAction(agent);
      if (!canPerformAction) {
        throw new BadRequestRpcException(
          ErrorMessages.INVALID_ACTION_MISSING_CLEAREANCE,
        );
      }
    }
    const userDto = {
      hash: await generateHash(password),
      ...rest,
    };

    const userRoles = await this.parseAllowedRoles(roles, agent);

    const user = this.authUserRepository.create(userDto);

    user.roles = userRoles;

    await this.authUserRepository.save(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hash, ...userResponse } = user;

    return userResponse;
  }

  // * Allowed to be null. Top method must handle null case
  async findOneById(id: string): Promise<AuthUser | null> {
    const user = await this.authUserRepository.findOne({
      where: {
        id,
      },
      relations: { roles: true },
    });

    return user;
  }

  // * Allowed to be null. Top method must handle null case
  async findOneBySlug({ slug }: LoginSlugDTO): Promise<AuthUser | null> {
    const key: Slug = slug.includes('@') ? 'email' : 'username';

    const user = await this.authUserRepository.findOne({
      where: { [key]: slug },
      relations: {
        roles: true,
      },
    });

    return user;
  }

  // TODO: checks should be done in main app user service
  // async updateUser(
  //   id: string,
  //   { email, password, oldPassword, roles, ...rest }: UpdateUserDTO,
  //   agent: RequestAgent,
  // ): Promise<AuthUser> {
  //   const user = await this.findActiveUser(id);

  //   const canPerformAction = checkAllowed_User_UpdateAction(user, agent, roles);

  //   if (!canPerformAction) {
  //     throw new BadRequestRpcException(ErrorMessages.INVALID_AGENT_ACTION_USER);
  //   }

  //   // * Only same user should be able to change password and email
  //   if (user.id === agent.id) {
  //     await this.canUpdatePassword(user, password, oldPassword);
  //     if (password) {
  //       user.hash = await generateHash(password);
  //       // ? can use mail service to inform password change
  //     }
  //     if (email) {
  //       user.email = email;
  //       // ? can use mail service to inform email change
  //     }
  //   }
  //   // * email and password change made by other users (admins, sysadmins) fail silently

  //   // * Role changes can be made only in specific cases, and as a rule of thumb, not to self
  //   user.roles = await this.updateTargetUserRoles(user, roles);

  //   const updatedUser = await this.authUserRepository.save({
  //     ...user,
  //     ...rest,
  //   });

  //   return updatedUser;
  // }

  async updateUserPassword(user: AuthUser, newPassword: string) {
    // ? Mind that if token is obtained, this could leak password being brute forced. Long throttle is key to avoid it.
    // ? Failing silently here is bad UX
    if (await checkHash(newPassword, user.hash)) {
      throw new BadRequestRpcException(
        ErrorMessages.INVALID_NEW_PASSWORD_ALREADY_USED,
      );
    }
    await this.authUserRepository.update(user.id, {
      hash: await generateHash(newPassword),
    });
  }

  // * Deactivation does not alter quest ownership or status, deleting user from database does
  // deactivated users are can no longer interact with application, entities and are not assignable to quests
  async deactivateUser(id: string, agent: RequestAgent): Promise<void> {
    const user = await this.findActiveUser(id);

    const canPerformAction = checkAllowedActionOn_User(user, agent);

    if (!canPerformAction) {
      throw new BadRequestRpcException(ErrorMessages.INVALID_AGENT_ACTION_USER);
    }

    // * action to self is allowed
    await Promise.all([
      this.authUserRepository.update(id, { active: false }),
      // this.cacheService.invalidate(id),
    ]);
    // this.client.emit('auth.invalidate.user.tokens', { id })
  }

  // async deleteUser(id: string, agent: RequestAgent): Promise<void> {
  //   const user = await this.authUserRepository.findOne({
  //     where: {
  //       id,
  //     },
  //     relations: {
  //       roles: true,
  //     },
  //   });

  //   if (!user) {
  //     throw new BadRequestRpcException(
  //       ErrorMessages.IMPOSSIBLE_ACTION_USER_NOT_FOUND,
  //     );
  //   }

  //   const canPerformAction = checkAllowedActionOn_User(user, agent);

  //   if (!canPerformAction) {
  //     throw new BadRequestRpcException(ErrorMessages.INVALID_AGENT_ACTION_USER);
  //   }

  //   // * action to self is allowed
  //   await Promise.all([
  //     this.authUserRepository.remove(user),
  //     // this.cacheService.invalidate(id),
  //   ]);
  //   // this.client.emit('auth.invalidate.user.tokens', { id })
  // }

  async verifyUserAccount(user: AuthUser): Promise<void> {
    user.verifiedAccount = true;
    await this.authUserRepository.save(user);
  }

  private async findActiveUser(id: string): Promise<AuthUser> {
    return this.authUserRepository.findOneOrFail({
      where: { id, active: true },
      relations: {
        roles: true,
      },
    });
  }

  private async canUpdatePassword(
    user: AuthUser,
    newPassword?: string,
    oldPassword?: string,
  ): Promise<void> {
    if ((newPassword && !oldPassword) || (oldPassword && !newPassword)) {
      throw new BadRequestRpcException(ErrorMessages.MISSING_USER_PASSWORDS);
    }
    if (newPassword && oldPassword) {
      if (newPassword === oldPassword) {
        // Using an old password as a new one
        if (newPassword && (await checkHash(newPassword, user.hash))) {
          throw new BadRequestRpcException(
            ErrorMessages.INVALID_USER_NEW_PASSWORD,
          );
        }
      } else {
        // Using an invalid old password
        if (oldPassword && !(await checkHash(oldPassword, user.hash))) {
          throw new BadRequestRpcException(
            ErrorMessages.INVALID_USER_OLD_PASSWORD,
          );
        }
      }
    }
  }

  // * Roles are sent as immutable (not specified gets filtered out)
  // If no roles are sent in DTO, don't modify current target user's roles (final else case)
  // If roles are sent, distinguish between empty list (remove roles) and new roles assigned (user -> admin) (second if case)
  // Roles array with valid roles, assign those roles (must contain previous roles if these are to be kept)
  // Empty array of roles, assign GUEST (readonly resources) (nested else case)
  private async updateTargetUserRoles(
    targetUser: AuthUser,
    roles: UserRole[] | undefined,
  ): Promise<Role[]> {
    if (roles) {
      if (roles.length > 0) {
        return await this.roleService.findRoles(roles);
      } else {
        return await this.roleService.findRoles([UserRole.GUEST]);
      }
    } else {
      return targetUser.roles;
    }
  }

  private async parseAllowedRoles(
    roles?: UserRole[],
    agent?: RequestAgent,
  ): Promise<Role[]> {
    // * Specific condition from authService when creating users during signup (assigns sysadmin role always)
    if (!agent && roles) {
      return await this.roleService.findRoles(roles);
    }

    if (!agent) {
      throw new BadRequestRpcException(
        ErrorMessages.INVALID_ACTION_MISSING_CLEAREANCE,
      );
    } else {
      if (roles) {
        if (agent?.roles.includes(UserRole.SYS_ADMIN)) {
          return await this.roleService.findRoles(roles);
        } else {
          // * Admins can't create sysadmins
          if (agent.roles.includes(UserRole.ADMIN)) {
            roles = roles?.filter((role) => role !== UserRole.SYS_ADMIN);
            return await this.roleService.findRoles(roles);
          }
          // * Users and guests redundant check
          else {
            throw new BadRequestRpcException(
              ErrorMessages.INVALID_ACTION_MISSING_CLEAREANCE,
            );
          }
        }
      } else {
        throw new BadRequestRpcException('Invalid action. Missing roles');
      }
    }
  }
}
