import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { seed } from 'src/_seed/data/seed';
import { RoleService } from 'src/resources/auth/modules/role/role.service';
import { DataSource } from 'typeorm';
import { AuthUserService } from 'src/resources/auth/modules/auth-user/auth-user.service';
import { GENERAL_SEED_ERROR } from 'src/common/constants/error-messages';
import { AuthUser } from 'src/resources/auth/modules/auth-user/entities/auth-user.entity';
import { generateHash } from 'src/utils';
import { UserRole } from 'src/resources/auth/modules/role/enum/user-role.enum';
import { CreateUserDTO } from 'src/resources/auth/modules/auth-user/dto/create-user.dto';
import { CacheService } from 'src/infra/cache/cache.service';

import { ConfigService } from '@nestjs/config';
import { type EnvVariables } from 'config/env-variables';
import { BadRequestRpcException } from 'src/common/exceptions/bad-request-rpc.exception';
import { InternalServerRpcException } from 'src/common/exceptions/internal-server-rpc.exception';

@Injectable()
export class SeedService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly roleService: RoleService,
    private readonly authUserService: AuthUserService,
    private readonly datasource: DataSource,
    private readonly configService: ConfigService<EnvVariables>,
    private readonly cacheService: CacheService,
  ) {
    this.logger.setContext(SeedService.name);
  }

  // * Sys admin created directly in db, must fail if not created
  async run() {
    if (this.configService.getOrThrow('NODE_ENV') === 'production') {
      throw new BadRequestRpcException(
        'Seed method only enabled for development / testing',
      );
    }

    try {
      this.logger.info('Clearing database...');
      await Promise.all([
        this.datasource.dropDatabase(),
        this.cacheService._dropDevDatabase(),
      ]);
      this.logger.info('Database cleared. Setting db...');
      await this.datasource.synchronize();

      //  ! ORDER OF PROMISES IS RELEVANT!! (roles -> user)
      const { role, user, sysadmin } = seed;

      const promises = [...role.map((r) => this.roleService.create(r))];
      await Promise.all(promises);

      await this.createSysAdminUser(sysadmin);

      await Promise.all(user.map((u) => this.authUserService.createUser(u)));

      this.logger.info('Database set. Seed entities created.');

      return { ok: true };
    } catch (error: unknown) {
      this.logger.error(error);
      throw new InternalServerRpcException(GENERAL_SEED_ERROR);
    }
  }

  // * Most restricted method. Access should be limited as much as possible.
  private async createSysAdminUser(user: CreateUserDTO): Promise<void> {
    const queryRunner = this.datasource.createQueryRunner();

    try {
      // * Roles must be initialized
      const sysRole = await this.roleService.findRoles([UserRole.SYS_ADMIN]);

      await queryRunner.connect();
      await queryRunner.startTransaction();

      const { password } = user;

      const dto = {
        ...user,
        hash: await generateHash(password),
        roles: sysRole,
        verifiedAccount: true,
      };

      await queryRunner.manager.save(AuthUser, dto);
      await queryRunner.commitTransaction();
    } catch (error: unknown) {
      this.logger.error(error);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }
}
