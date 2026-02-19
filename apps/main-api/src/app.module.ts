import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigModuleOptions } from '@nestjs/config';
import { DatabaseModule } from './infra/database/database.module';
import { UserModule } from './resources/user/user.module';
import { SeedModule } from './_seed/seed.module';
import { LoggerModule } from './infra/logging/logger.module';
import { RpcGlobalExceptionFilter } from './filters/rpc-global-exception.filter';
import { NatsJetStreamModule } from './infra/transport/nats-jetstream.module';

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
    NatsJetStreamModule.forRootAsync({
      useFactory: () => {
        return {
          streamName: 'USERS',
          consumerName: 'MAIN_API_USER_CONSUMER',
          filterSubject: 'auth.user.*',
          messageHandler: () => console.log('done messagehandler2'),
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
