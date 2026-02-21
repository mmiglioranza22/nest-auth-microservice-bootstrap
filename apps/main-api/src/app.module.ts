import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import {
  ConfigModule,
  ConfigModuleOptions,
  ConfigService,
} from '@nestjs/config';
import { DatabaseModule } from './infra/database/database.module';
import { UserModule } from './resources/user/user.module';
import { SeedModule } from './_seed/seed.module';
import { LoggerModule } from './infra/logging/logger.module';
import { RpcGlobalExceptionFilter } from './filters/rpc-global-exception.filter';
import { NatsJetStreamModule } from '@packages/nats-jetstream-transport-module';
import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { NATS_SERVICE } from './infra/constants/services';
import { EnvVariables } from 'config/env-variables';

const CONFIG_MODULE_OPTIONS: Record<string, ConfigModuleOptions> = {
  development: {
    ignoreEnvFile: true, // Let dotenvx handle the environment loading
  },
  production: { ignoreEnvFile: true },
  test: {
    envFilePath: './config/.env.test',
  },
  ci: {
    envFilePath: './config/.env.test',
  },
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ...CONFIG_MODULE_OPTIONS[`${process.env.NODE_ENV}`],
    }),
    LoggerModule,
    DatabaseModule,
    ClientsModule.registerAsync({
      isGlobal: true,
      clients: [
        {
          inject: [ConfigService],
          name: NATS_SERVICE,
          useFactory: (configService: ConfigService<EnvVariables>) => {
            const natsServers = configService.getOrThrow<string[]>(
              'NATS_SERVERS',
              {
                infer: true,
              },
            );
            return {
              transport: Transport.NATS,
              options: {
                servers: natsServers,
              },
            };
          },
        },
      ],
    }),
    NatsJetStreamModule.forRootAsync({
      inject: [NATS_SERVICE],
      useFactory: (clientProxy: ClientProxy, configService: ConfigService) => {
        return {
          streamName: 'USERS',
          consumerName: 'MAIN_API_USER_CONSUMER',
          filterSubject: 'auth.user.*',
          clientProxy: clientProxy,
          configService: configService,
          ackMessageInLoop: false,
        };
      },
    }),
    UserModule,
    SeedModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: RpcGlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
