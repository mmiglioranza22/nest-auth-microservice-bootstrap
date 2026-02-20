import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { EnvVariables } from 'config/env-variables';
import { NATS_SERVICE } from '../constants/services';
import {
  NatsJetStreamModule,
  NatsJetStreamService,
} from '@packages/nats-jetstream-transport-module';

// TODO not working, should refactor to concentrate all transport layer here
@Global()
@Module({
  imports: [
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
          consumerName: 'AUTH_MS_USERS_CONSUMER',
          filterSubject: 'app.user.*',
          messageHandler: () => console.log('done messagehandler2'),
          clientProxy: clientProxy,
          configService: configService,
        };
      },
    }),
  ],
  providers: [NatsJetStreamService],
  exports: [ClientsModule, NatsJetStreamService],
})
export class TransportModule {
  static forRoot(options: { isGlobal: boolean }) {
    return {
      module: TransportModule,
      global: options.isGlobal ?? false,
    };
  }
}
