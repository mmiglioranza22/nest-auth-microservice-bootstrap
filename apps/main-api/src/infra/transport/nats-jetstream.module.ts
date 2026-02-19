import {
  Global,
  Module,
  type DynamicModule,
  type Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import type { EnvVariables } from 'config/env-variables';
import { NATS_SERVICE } from '../constants/services';
import { NatsJetStreamService } from './nats-jetstream.service';
import type { NatsJetStreamModuleOptions } from './nats-jetstream-module-options.interface';
import { NATS_JETSTREAM_OPTIONS } from './nats-jetstream.tokens';

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
  providers: [NatsJetStreamService],
  exports: [ClientsModule, NatsJetStreamService],
})
// Jetstream config can be done here
export class NatsJetStreamModule {
  static forRoot(options: NatsJetStreamModuleOptions): DynamicModule {
    return {
      module: NatsJetStreamModule,
      providers: [
        {
          provide: NATS_JETSTREAM_OPTIONS,
          useValue: options,
        },
        NatsJetStreamService,
      ],
      exports: [NatsJetStreamService],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[] // inject, provide, etc
    ) => Promise<NatsJetStreamModuleOptions> | NatsJetStreamModuleOptions;
    inject?: any[];
    extraProviders?: Provider[];
  }): DynamicModule {
    return {
      module: NatsJetStreamModule,
      providers: [
        {
          provide: NATS_JETSTREAM_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        ...(options.extraProviders || []),
        NatsJetStreamService,
      ],
      exports: [
        NatsJetStreamService,
        // ...(options.extraProviders || [])
      ],
    };
  }
}
