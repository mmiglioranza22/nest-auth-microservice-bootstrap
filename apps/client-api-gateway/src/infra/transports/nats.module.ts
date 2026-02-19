import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EnvVariables } from 'config/env-variables';
import { NATS_SERVICE } from 'src/common/constants/services';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync({
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
  ],
  exports: [ClientsModule],
})
export class NatsModule {
  static forRoot(options: { isGlobal: boolean }) {
    return {
      module: NatsModule,
      global: options.isGlobal ?? false,
    };
  }
}
