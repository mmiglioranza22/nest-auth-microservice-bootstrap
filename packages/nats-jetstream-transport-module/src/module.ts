import {
  Global,
  Module,
  type DynamicModule,
  type Provider,
} from "@nestjs/common";
import { NatsJetStreamService } from "./service";
import type { NatsJetStreamModuleOptions } from "./interface";
import { NATS_JETSTREAM_OPTIONS } from "./tokens";

@Global()
@Module({
  providers: [NatsJetStreamService],
  exports: [NatsJetStreamService],
})
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
      exports: [NatsJetStreamService],
    };
  }
}
