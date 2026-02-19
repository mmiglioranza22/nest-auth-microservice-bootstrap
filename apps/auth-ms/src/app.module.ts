import { Module } from '@nestjs/common';
import { AuthModule } from './resources/auth/auth.module';
import { ConfigModule, ConfigModuleOptions } from '@nestjs/config';
import { LoggerModule } from './infra/logging/logger.module';
import { SeedModule } from './_seed/seed.module';
import { APP_FILTER } from '@nestjs/core';
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
    SeedModule,
    // NatsJetStreamModule.forRoot({
    //   streamName: 'sape',
    //   consumerName: 'sape-consumer',
    //   messageHandler: () => console.log('done messagehandler'),
    // }),
    NatsJetStreamModule.forRootAsync({
      useFactory: () => {
        return {
          streamName: 'USERS',
          consumerName: 'AUTH_MS_USERS_CONSUMER',
          filterSubject: 'app.user.*',
          messageHandler: () => console.log('done messagehandler2'),
        };
      },
    }),
    AuthModule,
    LoggerModule, // TODO review is needed
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: RpcGlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
