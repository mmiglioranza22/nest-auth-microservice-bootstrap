import { DataSource } from 'typeorm';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { type EnvVariables } from 'config/env-variables';

import { seed } from 'src/_seed/data/seed';
import { RoleService } from 'src/resources/auth/modules/role/role.service';
import { UserService } from 'src/resources/user/user.service';
import { GENERAL_SEED_ERROR } from 'src/common/constants/error-messages';
import { BadRequestRpcException } from '../common/exceptions/bad-request-rpc.exception';
import { InternalServerRpcException } from '../common/exceptions/internal-server-rpc.exception';

@Injectable()
export class SeedService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly roleService: RoleService,
    private readonly userService: UserService,
    private readonly datasource: DataSource,
    private readonly configService: ConfigService<EnvVariables>,
    // private readonly cacheService: CacheService,
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
      await Promise.all([this.datasource.dropDatabase()]);
      // this.client.send('cache.drop.database',{})
      this.logger.info('Database cleared. Setting db...');
      await this.datasource.synchronize();

      //  ! ORDER OF PROMISES IS RELEVANT!! (roles -> user)
      const { role } = seed;

      const promises = [...role.map((r) => this.roleService.create(r))];
      await Promise.all(promises);

      this.logger.info('Database set. Seed entities created.');

      return { ok: true };
    } catch (error: unknown) {
      this.logger.error(error);
      throw new InternalServerRpcException(GENERAL_SEED_ERROR);
    }
  }
}
